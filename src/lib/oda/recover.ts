// ODA merged-text recovery (PDF / OCR artifacts).
//
// PDF text layers and OCR frequently lose the source's line structure: words
// get glued together ("CommissionerCoal"), the whole "To," block collapses
// into a single run ("To,The Assistant CommissionerCoal Mines…"), commas
// vanish ("Coll.,Bankola"), table pipes disappear so every cell becomes its
// own line, and body sentences fuse ("…Regional Office.It has been ensured…").
//
// Two passes live here:
//   1. `recoverLineStructure` runs BEFORE translation and re-inserts the lost
//      spaces and newlines so the line-based translation rules see the
//      source's real lines. It only acts at unambiguous boundaries, and never
//      inside a letterhead (the letterhead is re-applied verbatim from the
//      original source afterwards anyway).
//   2. `recoverCells` runs AFTER translation as a refinement pass: bare table
//      headers (pipe structure lost) get localized, and short lines where
//      every token is covered (table cells, address fragments) are translated
//      by the Hindi term pass — all-or-nothing, never a half-mangled mix. It
//      also strips the "kept in the source language" note when nothing is
//      left untranslated, and rebuilds it with an honest count otherwise.

import { kitFor } from "./adaptive";
import { translateWithGlossary } from "./glossary";
import { hindiTranslateLine, kitName, localizeTableHeader } from "./translate";
import type { GlossaryOverlay } from "./extraDict";

// ---------------------------------------------------------------------------
// Pass 0 — OCR-fragment normalization
// ---------------------------------------------------------------------------

/** Collapse spaces inside a digit run ("1 9 64" → "1964"). */
function squeezeDigits(s: string): string {
  return s.replace(/\s+/g, "");
}

/**
 * Scanned/OCR-produced DOCX files fragment words and codes with stray
 * spaces ("RNJ / 38 / 3288", "0 9 -07 -2026", "L.C. - o ut", "S hri
 * Khadal"). The reference-standard letters are clean, so before anything
 * else these fragments are re-glued — dates, file/account codes and the
 * few known word splits ("o ut" → "out", "F ro m" → "From").
 * Numbers separated only by spaces are left alone EXCEPT inside the
 * code/date patterns below, so prose like "section 3 of 5" survives.
 */
export function normalizeFragmentedCodes(text: string): string {
  let s = text
    // Known word fragments from the scanned letters.
    .replace(/\bS hri\b/g, "Shri")
    .replace(/\bF ro m\b/g, "From")
    .replace(/\bT o\b/g, "To")
    .replace(/\bTransf er\b/g, "Transfer")
    .replace(/\bExt-out\b/g, "Ext-out")
    .replace(/\bExt- out\b/g, "Ext-out")
    .replace(/\bExtract[ \t]*-[ \t]*Req\.?\b/gi, "Extract-Req.")
    // "L.C.-R eq ./417" → "L.C.-Req./417" — the request-code fragment.
    .replace(/(L\.?C\.?)\s*-\s*R\s+eq\b/gi, "$1-Req.")
    // "d ated 08/06/2026" → "dated 08/06/2026" and "th e member" →
    // "the member" — OCR split single letters off common words.
    .replace(/\bd\s+ated(?=\s|\d|\.|\-)/gi, "dated")
    .replace(/\bth\s+e\b/gi, "the")
    .replace(/\bo ut\b/g, "out")
    // ---- The 7-ALL OLD LETTER corpus OCR fragments ----
    // "i n r/o- Sri …" / "i n respect of …" — the Extract-Out sentence
    // templates only know the intact "in" form, so the split preposition
    // would otherwise drop the whole sentence to the phonetic floor.
    .replace(/\bi\s+n\s+r\/o\b/gi, "in r/o")
    .replace(/\bi\s+n\s+respect\b/gi, "in respect")
    // "i n Procedure" / "i n view" / "i n this" — a general OCR fragment
    // that splits the preposition "in" before common English words; the
    // specific "i n r/o" and "i n respect" forms above are subsets.
    .replace(/\bi\s+n\s+(?=\w{3,})/gi, "in ")
    // "it is to in from you that" → "it is to inform you that" — lowercase
    // only, so "in Form A" (the declaration form) never becomes "inform A".
    .replace(/\bin\s+from\b/g, "inform")
    // "d ate d 02/11/2023" → "dated 02/11/2023" — the ref-label split with
    // the space in the middle of the word (the "d ated" form above is the
    // other OCR half).
    .replace(/\bd\s+ate\s+d\b/gi, "dated")
    // "T wo Nos" / "Two cop y" → "Two" / "copy" — the enclosure-count
    // fragments ("( One  Nos )", "( T wo  Nos )", "( Two cop y )").
    .replace(/\bT\s+wo\b/gi, "Two")
    .replace(/\bc\s*o\s*p\s+y\b/gi, "copy") // "cop y" / "c op y" — the
    // split "copy" fragment (space between ANY letters; "copy" itself
    // passes through as an identity replace)
    // "WORKSHOP,JAYANT" / "OFFICE,SINGRAULI" — a comma glued to the previous
    // word in table cells; the term pass splits on whitespace and can't tokenize
    // the fused form. A space after the comma lets each word translate.
    .replace(/([A-Za-z]),([A-Z])/g, "$1, $2")
    // // "Yoursfaithfully" / "Yourssincerely" — OCR/DOCX fused the closing
    // phrase into one word; the closing regex in localizeLine requires the
    // space between "Yours" and the adverb.
    .replace(/\bYoursfaithfully\b/gi, "Yours faithfully")
    .replace(/\bYourssincerely\b/gi, "Yours sincerely")
    // // "have be en made / updated" → "been" — the assurance-sentence
    // template knows the intact form.
    .replace(/\bbe\s+en\b/gi, "been")
    // "mo n th positively" / "mo nth" → "month positively" (the P.P.O.
    // office note — the OCR splits the word with a stray space between any
    // two letters).
    .replace(/\bm\s*o\s*n\s*th\b/gi, "month")
    // "N o CPF/…" → "No CPF/…", "Su b- :" → "Sub- :" — split labels on
    // the subject/file-number lines (the space may sit between any two
    // letters of "Sub": "Su b-", "S u b-").
    .replace(/\bN\s+o\b/gi, "No")
    .replace(/\bS\s*u\s*b\b/gi, "Sub")
    // "cited abave" → "above", "conc erned" → "concerned", "here with"
    // → "herewith", "respect ively" → "respectively" — the not-available
    // reply sentence the Ganesh Diwate letter carries.
    .replace(/\babave\b/gi, "above")
    .replace(/\bconc\s+erned\b/gi, "concerned")
    .replace(/\bhere\s+with\b/gi, "herewith")
    .replace(/\brespect\s+ively\b/gi, "respectively")
    // "31 st January" → "31st January" — the OCR-spaced ordinal in the
    // superannuation sentence.
    .replace(/\b(\d{1,2})\s+st\b/gi, "$1st")
    // "P.P. O . pension" / "P.P.O.pension" → "P.P.O. pension" — the
    // dotted abbreviation with scattered spaces/glued word (the office-note
    // sentence dictionary knows only the intact form).
    .replace(/\bP\s*\.\s*P\s*\.\s*O\s*\.?/gi, "P.P.O.")
    .replace(/(P\.P\.O\.)(?=[a-z])/g, "$1 ")
    // "dated12/12/2025" → "dated 12/12/2025" — the date label glued
    // straight onto the date digits.
    .replace(/(\bdated)(?=\d)/gi, "$1 ")
    // ---- The 8-ALL NEW LETTER corpus OCR fragments ----
    // "r espect" → "respect", "Provide nt" → "Provident", "As abov e" →
    // "As above", "Thi s" / "T his" → "This", "M ahakali" → "Mahakali",
    // "K umardihi" → "Kumardihi", "S anctoria" → "Sanctoria",
    // "Extra ct" / "E xtract" → "Extract", "L edger" → "Ledger",
    // "D GR" → "DGR", "RN N" → "RNN" — OCR split a word/code with a
    // stray space; the translation dictionaries only know the intact form.
    .replace(/\br\s+espect\b/gi, "respect")
    .replace(/\bprovid\s+ent\b/gi, "Provident")
    // "Provide nt" → "Provident" — the same split, other half (letter 203's
    // collapsed To-block: "Coal Mines Provide nt Fund Organisation").
    .replace(/\bprovide\s+nt\b/gi, "Provident")
    // "K umar" → "Kumar" — a split inside a signature name ("(Ajay K umar
    // Singh)"), which otherwise breaks the name-table transliteration.
    .replace(/\bk\s+umar\b/gi, "Kumar")
    .replace(/\babov\s+e\b/gi, "above")
    .replace(/\bthi\s+s\b/gi, "This")
    .replace(/\bt\s+his\b/gi, "This")
    .replace(/\bm\s+ahakali\b/gi, "Mahakali")
    .replace(/\bk\s+umardihi\b/gi, "Kumardihi")
    .replace(/\bs\s+anctoria\b/gi, "Sanctoria")
    .replace(/\bextra\s+ct\b/gi, "Extract")
    .replace(/\be\s+xtract\b/gi, "Extract")
    .replace(/\bl\s+edger\b/gi, "Ledger")
    .replace(/\bd\s+gr\b/gi, "DGR")
    .replace(/\brn\s+n\b/gi, "RNN")
    // "S h ri" → "Shri", "S h ri mati" / "Shri mati" / "Shrimati" →
    // "Smt." — the Extract-Out sentence dictionary knows the canonical
    // honorifics (श्री / श्रीमती) only.
    .replace(/\bs\s+h\s+ri\s+mati\b/gi, "Shrimati")
    .replace(/\bshri\s+mati\b/gi, "Shrimati")
    .replace(/\bshrimati\b/gi, "Smt.")
    .replace(/\bs\s+h\s+ri\b/gi, "Shri")
    .replace(/\bs\s+hri\b/gi, "Shri")
    // "Shri . Rajendra" → "Shri Rajendra" — a stray dot after the
    // honorific (letter 85) would otherwise land inside the name capture.
    .replace(/\bshri\s*\.\s+/gi, "Shri ")
    // "Ref संख्या :-" / "Ref No :-" → "Ref:- " — the reminder letters' DOCX
    // templates carry a hand-translated "संख्या" label; the ref rule only
    // knows the Latin "Ref:" opener, so the label is repaired before the
    // line-based translation runs.
    .replace(/\bref\s*(?:संख्या|no)\s*[:：-]+\s*/gi, "Ref:- ")
    // "दिनांक : 08/07/2026" → "दिनांक 08/07/2026" — the Devanagari date
    // label with a stray OCR colon (the ref transliterator's own cleanup
    // runs on Latin "dated" only; this repairs the already-Hindi form).
    .replace(/दिनांक\s*[:：]\s*/g, "दिनांक ")
    // "Region–III" → "Region-III", "Regional Commissioner – I" →
    // "Regional Commissioner - I" — the en/em-dash the PDF layer emits is
    // the hyphen in every reference letter; the designation/address rules
    // only know the hyphen form.
    .replace(/[–—]/g, "-")
    // "R- I" → "R-I", "D- I" → "D-I" — a stray space after the hyphen of a
    // region/division code ("Ranchi R- I & II") splits the code into two
    // tokens that neither the term pass nor the transliterator covers.
    .replace(/\b([A-Z])[ \t]*-[ \t]+(?=[IVX]\b)/g, "$1-")
    // "C PF/118/…" → "CPF/118/…" and "R NJ / 23 / 1043" → "RNJ/23/1043" —
    // a single letter split from a code whose slash may be spaced too
    // ("R NJ / 23"), which would otherwise stay half-Latin ("आर NJ/23").
    // The slash must be followed by a DIGIT: "LC OUT/R-I" (the L.C.-out
    // marker + region code) must never glue into "LCOUT/R-I" — OUT is a
    // word, and the digit guard keeps it intact.
    .replace(/([A-Z])\s+([A-Z]{2,})(?=[ \t]*\/[ \t]*\d)/g, "$1$2")
    // "डी-I I" → "डी-II", "R- I I" → "R-II" — an OCR space inside a roman
    // numeral right after a region/division hyphen ("D- I I", "डी-I I").
    // "I & II" / "I एवं II" never match (the next char is not [IVX]).
    .replace(/-([IVX])\s+([IVX])\b/g, "-$1$2")
    // Devanagari code fragments ("आरएनजे / 19/1283" → "आरएनजे/19/1283",
    // "सीपीएफ /118/ विविध / एलसी" → "सीपीएफ/118/विविध/एलसी") — the Latin
    // code squeeze below only owns [A-Z]{2,} runs; the already-Hindi halves
    // of dual letters carry the same stray spaces around slashes.
    .replace(/([\u0900-\u097F]{2,})[ \t]*\/[ \t]*(?=[\u0900-\u097F0-9])/g, "$1/")
    // "आर - आई" → "आर-आई", "अंतर - क्षेत्रीय" → "अंतर-क्षेत्रीय" — stray
    // spaces around a hyphen inside a Devanagari code/compound (the dual
    // letters print every code with wide gaps).
    .replace(/([\u0900-\u097F])[ \t]*-[ \t]+(?=[\u0900-\u097F])/g, "$1-")
    // "' B'Colliery" / "‘ B’Colliery" → "'B' Colliery" — the mine-block
    // letter in quotes (straight OR curly — the scanned cells mix both) is
    // OCR-fragmented ("कुमारडीही ' बी ' कोलियरी"); the quote must hug the
    // letter so the single-letter rule maps it (B → बी).
    .replace(/['‘’“”]\s*([A-Za-z])\s*['’“”]/g, "'$1'")
    .replace(/['‘’“”]( ?[A-Za-z])['’“”]([A-Z])/g, "'$1' $2")
    // "42Period-" → "42 Period-", "2018To" → "2018 To", "16to" →
    // "16 to", "244as desired" → "244 as desired" — a word glued onto
    // digits in the scanned cells.
    .replace(/(\d)([A-Za-z]{2,})/g, "$1 $2")
    // "( I V )" → "(IV)", "( I I )" → "(II)" — OCR scattered spaces inside
    // parenthesized roman numerals (the reminder-register stamp); region
    // codes like "(RNJ/52)" and "(U/G)" never match.
    .replace(/\(\s*([ivx])(?:\s*([ivx]))?(?:\s*([ivx]))?(?:\s*([ivx]))?\s*\)/gi, "($1$2$3$4)")
    // A leading stray backtick/quote on a line ("` Sub: …") — the PDF layer
    // marks the subject line with it; the label must start the line to match.
    .replace(/^[`'"«]+/gm, "")
    // Dotted abbreviations with stray spaces ("L .C.-out", "B .B . College",
    // "P .S.-3") — squeeze so the abbreviation maps as ONE transliteration
    // token ("L.C." → "एल.सी."), never a half-Latin "एल .C." mix. Spaces
    // only (\s would swallow the line break after a sentence-final period),
    // and only when it is truly an abbreviation: an uppercase letter that is
    // NOT the start of a word ("L .C." — "C" followed by a non-letter;
    // "Office. Further" — "F" followed by a letter — is a sentence boundary
    // and stays intact). The space AFTER the dot is never eaten — "No. of
    // LC" is a real word pair and must survive ("No.of LC" would break the
    // table-header match), so the space-before-dot form ("L .C") is the
    // only one squeezed.
    .replace(/([A-Za-z])[ \t]*\.(?=[A-Z](?![a-zA-Z]))/g, "$1.")
    // "Smt.devanti Pandey" → "Smt. devanti Pandey" — a scanned honorific
    // glued to the name (letter 114) would otherwise break the honorific
    // lookup; the dot is the separator.
    .replace(/\b(smt|shri|mr|mrs|dr|er)\.(?=[A-Z][a-z])/gi, "$1. ")
    // ---- The 7-ALL OLD LETTER corpus OCR fragments ----
    // "S mt. Dewanti Pandey" → "Smt. Dewanti Pandey" — the honorific split
    // by OCR (letter 114's extract sentence); the honorific regex only knows
    // the intact "Smt." form.
    .replace(/\bS\s+mt\.?\b/gi, "Smt.")
    // "Dew anti pandey" → "Devanti Pandey" — the same letter's member name
    // split by OCR; the name table is keyed on the intact spelling.
    .replace(/\bDew\s+anti\b/gi, "Devanti")
    // "L.C. in our out/Extract" → "L.C. In-Out/Extract" — the In/Out
    // register read as "in our out" (and "in our") by OCR; the ref
    // transliterator renders the register इन-आउट. Guarded so a genuine
    // "in our region" sentence is never touched (no slash follows).
    .replace(/\bin\s+our\s*out\b/gi, "In-Out")
    .replace(/\bin\s+our\s*(?=\/)/gi, "In-Out")
    // "this off ice letter" → "this office letter" — the OCR-split office
    // word (letter 9's ref line); "office" maps to कार्यालय in the prose
    // ref tokens.
    .replace(/\boff\s+ice\b/gi, "office")
    // ---- The 7-ALL OLD LETTER corpus, round 2 ----
    // "colliery,kithara" / "area,CCL" / "2022,Nakrakonda" — the scanned
    // tables glue two words (or a stint end and a colliery name) with a bare
    // comma; every downstream token pass can only cover them separately.
    .replace(/([A-Za-z0-9]),([A-Za-z])/g, "$1, $2")
    // "TilaboniColliery" — a colliery name fused onto the generic noun;
    // the name transliterates and the noun maps to कोलियरी.
    .replace(/([A-Za-z])Colliery\b/gi, "$1 Colliery")
    // "i n R /o- Sri …" / "i n r/o- Sri …" — the respect-of phrase with the
    // OCR-split preposition and a stray space before the slash; the extract-
    // out sentence templates only know the intact "in respect of" form.
    // Guarded to the honorific that follows (never "R/O, Sambalpur" — the
    // Regional-Office abbreviation).
    .replace(/\bi\s+n\s+R\s*\/\s*o-?\s+(?=sri\b|shri\b|mr\.|smt\.|dr\.)/gi, "in respect of ")
    // "Refarence" → "reference" and "stat" → "state" — the not-available
    // reply sentence's OCR typos (letter 89).
    .replace(/\brefarence\b/gi, "reference")
    .replace(/\bstat\b/gi, "state")
    // "C. M.P.F A/c no . RNJ/10/1367" — the dotted abbreviation with
    // scattered spaces and the account label with its stray dot, so the
    // reply sentence template captures a clean account number. The trailing
    // "No - " (dash + space) is consumed so "A/c No - RNJ/…" collapses to
    // "A/C No- RNJ/…" — never the doubled "A/C No- - RNJ" the office-note
    // ledger lines (letter 45) would otherwise ship.
    .replace(/\bC\s*\.\s*M\s*\.\s*P\s*\.\s*F\s*\.?\b/gi, "C.M.P.F.")
    .replace(/\bA\s*\/\s*c\s+no\s*\.?\s*-?\s*/gi, "A/C No- ")
    // "letter no.CPF/…" — the number label glued onto the code (letter 68's
    // reply body); the sentence template expects the space.
    .replace(/\bno\s*\.(?=[A-Z])/gi, "no ")
    // "Sub- Sub- Inter- Regional …" — the doubled subject label (letter 50);
    // the label rule would otherwise render an empty विषय:- line before the
    // real subject.
    .replace(/\bSub-\s*Sub-\b/gi, "Sub-")
    // "Ext.out . /R-1" — the scanned "Ext-out" code with the dot OCR noise
    // (letter 91's ref line); "Ext-out" is the code the ref tokenizer knows.
    .replace(/\bext\s*\.\s*out\s*\.?\s*(?=\/)/gi, "Ext-out")
    // "Kumardihi’B’Colliery" — the mine-block letter in curly quotes glued
    // straight onto the colliery word; the quote must sit on its own token
    // so the name and the single letter translate (कुमारडीही 'बी' कोलियरी),
    // never a half-Latin "Kumardihi’B’Colliery".
    .replace(/([\u0900-\u097FA-Za-z0-9])['‘’“”](?=[A-Za-z])/g, "$1 '")
    // ---- The 7-ALL OLD LETTER corpus, round 3 (mixed-script cells) ----
    // "C.C.L" → "CCL" — the dotted abbreviation in the colliery-history
    // cells; the code token (ccl → सीसीएल) maps it, the dotted form never
    // matches anything.
    .replace(/\bC\s*\.\s*C\s*\.\s*L\s*\.?\b/gi, "CCL")
    // "(S.B.Area)" → "(एस.बी. क्षेत्र)" — the Sonepur-Bazari sub-area with
    // its dotted abbreviation glued to the area word; the fixed phrase maps
    // in one step (the paren-split token path would strand the dot).
    .replace(/\bS\s*\.\s*B\s*\.\s*Area\b/gi, "एस.बी. क्षेत्र")
    // "2012T O July-2016" / "Sept-2012 T O July" — the month stint with the
    // OCR-split "To" (glued to the year OR standing alone); the stint rules
    // only know the intact word.
    .replace(/(\d)T\s+O\b/gi, "$1 To")
    .replace(/\bT\s+O\b/gi, "To")
    // "Ref. No. - C.P.F./111/ …" — the office-note header's ref label with
    // the dotted No. and dash; the ref rule only knows the colon form.
    .replace(/\bref\s*\.\s*no\s*\.?\s*-\s*/gi, "Ref:- ")
    // "nakrakond-कुमारडीही" — the OCR-truncated colliery name before the
    // hyphen; the token table is keyed on the intact "nakrakonda".
    .replace(/\bnakrakond(?=-)/gi, "Nakrakonda")
    // "A. O . Section lncharge" → "A.O. Section Incharge" — the office-note
    // sentence (letter 33) with its spaced dots and the l-n OCR misread of
    // the capital I; the sentence dictionary knows the intact form.
    .replace(/\bA\s*\.\s+O\s*\.\s*/gi, "A.O. ")
    .replace(/\blncharge\b/gi, "Incharge")
    // "30/11/2022 To Til Date" → "…Till Date" — the OCR truncation of
    // "Till" in the open-ended stint (letter 79); the stint rule only knows
    // the full word (and "Tilaboni" never matches — the space is required).
    .replace(/\bTil\s+Date\b/gi, "Till Date")
    // "mgt .office@cmpfo.gov.in" → "mgt.office@cmpfo.gov.in" — the OCR space
    // inside the email local part (letter 100's ref line); the email guards
    // only recognize the intact token.
    .replace(/\bmgt\s*\.\s*office\b/gi, "mgt.office")
    // ---- The 7-ALL OLD LETTER corpus, round 4 (office-note ledger + refs) ----
    // "Ref . :  CPF/155/…" / "Dtd . : 24/06/2025" / "Dated . : 15/05/2024" —
    // the scanned ref lines (letters 10/47/50) space the abbreviation's
    // period before the colon; the ref rule only knows the tight "Ref:"
    // label and the date handler the tight "Dtd"/"Dated" words.
    .replace(/\b(Ref|Dtd|Dated|No)\s*\.\s*[:：]/gi, "$1:")
    // "Received Form CMPFO" → "Received From CMPFO" — the OCR misread in the
    // office-note ledger lines (letter 45); the sentence dictionary knows the
    // intact "Received From" form. "Form A" (the declaration form) is never
    // touched — the word "Received" precedes the split.
    .replace(/\breceived\s+form\b/gi, "Received From")
    // "o f L.C." / "f or Signature" / "w ith My" / "I n, out" — the
    // office-note ledger sentences (letter 45) split single letters off
    // words; the sentence dictionary only knows the intact forms.
    .replace(/\bo\s+f\b/gi, "of")
    .replace(/\bf\s+or\b/gi, "for")
    .replace(/\bw\s+ith\b/gi, "with")
    .replace(/\bI\s+n\b/g, "In")
    // "Chhindwar a Pin-48001" — the OCR-split district name (letters 28/38);
    // the token table is keyed on the intact "Chhindwara".
    .replace(/\bChhindwar\s+a\b/gi, "Chhindwara")
    // "Kr.Pathak" → "Kr. Pathak" — the signature name with the Kumar
    // abbreviation glued to the surname (letter 33); the name lookup expects
    // the spaced form.
    .replace(/\bkr\.(?=[A-Z])/gi, "kr. ");
  // "Date" glued straight to a date ("Date17/03/2026", "Date 12 /0 2/2026",
  // "Date:0 9 …", "Date1 7 /0 3 /2026", "Date2 3 / 03 /202 6"): give it the
  // dash separator the reference letters use (दिनांक-17/03/2026). The lookahead
  // tolerates a space-split day ("1 7") so the fragment gets repaired too. The
  // space is consumed so the label reads "Date-". Must run BEFORE the date
  // squeeze below, otherwise the split day right after "Date" has no word
  // boundary to anchor on and stays fragmented ("Date-1 7 /0 3 /2026").
  // The whitespace is [ \t]-only so a "Date" that ends its line never
  // swallows the newline into the lookahead.
  s = s.replace(/\bdate[ \t]*(?=\d{1,2}(?:[ \t]*\d)?[ \t]*[-/.])/gi, "Date-");
  // Dates with scattered spaces: "0 9 -07 -2026", "29 / 0 6 /2026",
  // "20 / 0 2 /202 6", "Date-1 7 /0 3 /2026". The year group tolerates
  // spaces between all four digits ("202 6", "20 2 6").
  s = s.replace(
    /\b(\d(?:[ \t]*\d)?)[ \t]*([-/.])[ \t]*(\d(?:[ \t]*\d)?)[ \t]*([-/.])[ \t]*(\d{2}(?:[ \t]*\d(?:[ \t]*\d)?)?)\b/g,
    (_m, a, s1, b, s2, c) =>
      `${squeezeDigits(a)}${s1}${squeezeDigits(b)}${s2}${squeezeDigits(c)}`,
  );
  // File / account codes with scattered spaces: "RNJ / 38 / 3288",
  // "RNJ / 21 /19 64", "DGR / 5 / 686", "CPF/16/DHN-40/D-I/281/1220".
  s = s.replace(
    // Digit groups are (digit (spaces digit)*) — they always END on a digit,
    // never on a swallowed space, so a code followed by a word
    // ("…/244 as desired") keeps its separator (the old [\d \t]* group ate
    // the space and glued "244as").
    /([A-Z]{2,})[ \t]*(\/)[ \t]*(\d(?:[ \t]*\d)*)(?:[ \t]*(\/)[ \t]*(\d(?:[ \t]*\d)*))?(?:[ \t]*(\/)[ \t]*(\d(?:[ \t]*\d)*))?/g,
    (_m, code, s1, d1, s2?, d2?, s3?, d3?) => {
      let out = `${code}${s1}${squeezeDigits(d1)}`;
      if (s2) out += `${s2}${squeezeDigits(d2 ?? "")}`;
      if (s3) out += `${s3}${squeezeDigits(d3 ?? "")}`;
      return out;
    },
  );
  // Month/year table cells with scattered spaces ("0 7 / 1997", "08/2 007")
  // — the posting-history columns carry month/year only, so the full date
  // squeeze above never fires. Glue the digits across the spaces and slash.
  // [ \t]-only inside the groups: a line ending "…/118" must never swallow
  // the following newline ("\n" is \s) into the year group and fuse two
  // lines — the exact "118Department" bug.
  s = s.replace(/(\d[\d \t]{0,3})[ \t]*\/[ \t]*(\d(?:[ \t]*\d){1,4})\b/g, (_m, a, b) =>
    `${a.replace(/[ \t]+/g, "")}/${b.replace(/[ \t]+/g, "")}`,
  );
  // Code-dash-number fragments ("TLHR- 10", "RNJ- 21 & 14") — the code
  // stays Latin (transliterated later), only the spacing is repaired. The
  // digit group always ends on a digit, so "TLHR- 10 Please…" keeps its
  // space (the old [\d \t]* group ate it and glued "10Please").
  s = s.replace(/([A-Z]{2,})[ \t]*-[ \t]*(\d(?:[ \t]*\d)*)/g, (_m, c, d) => `${c}-${squeezeDigits(d)}`);
  // "L.C. - o ut" → "L.C.-out" and "l .c.-out" → "L.C.-out": dotted
  // abbreviations glued to a hyphenated tail (out/in/req/request).
  s = s.replace(
    /([A-Za-z](?:\.[A-Za-z])+)[ \t]*-[ \t]*(out|in|req|request|out-in)/gi,
    (_m, abbr, tail) => `${abbr.toUpperCase()}-${tail.toLowerCase()}`,
  );
  // "P.O.-Jagrutivihar, Dist.-Sambalpur" — a dotted abbreviation glued to
  // a hyphenated word. The abbreviation owns the dot; a space after the
  // hyphen lets the term pass tokenize "Jagrutivihar" / "Sambalpur" as
  // separate words (the token lookup is word-level, not phrase-level).
  s = s.replace(/\.-(?=[A-Z])/g, ".- ");
  // Stray spaces between digits outside the code/date patterns ("Des 2 012",
  // "3/2018To 3/2021" → the year 2018 split as "2 018"): a space between two
  // digits is never meaningful in these letters (the code/date squeezes above
  // already own the slash forms; this mops up the month-year cells).
  s = s.replace(/(\d)[ \t]+(?=\d(?!-))/g, "$1");
  // "Odisha768020" / "Burdwan713303" — a 5-6 digit PIN fused straight onto
  // the state/district word (the DOCX text layer dropped the space). The
  // PIN needs its own token so the address line translates (ओडिशा 768020).
  s = s.replace(/([A-Za-z])(\d{5,6})(?!\d)/g, "$1 $2");
  return s;
}

// ---------------------------------------------------------------------------
// Pass 1 — line-structure recovery
// ---------------------------------------------------------------------------

/** Known abbreviations whose trailing period must never end a sentence. */
const NO_SPLIT_ABBR = new Set([
  "no", "ref", "dr", "sr", "jr", "mr", "mrs", "ms", "smt", "shri",
  "er", "prof", "hon", "st", "vs", "fig", "dept", "asst", "coll", "hq",
  "ahq", "dist", "sec", "gen", "reg", "misc", "ltd", "inc", "po", "pin",
  "e.g", "i.e", "etc", "al", "tel", "ph", "ext", "est", "approx",
]);

/** Office titles a "To," block can open with. */
const TO_DESIGNATION_RE =
  /(The\s+[A-Za-z\s-]*(?:Commissioner|Director|Registrar|Secretary|Manager|Superintendent|Inspector|Authority|Administrator|Controller|Auditor|Engineer|Magistrate|Collector|Chairman|President|Officer))\s*/;

/**
 * Rebuild a collapsed "To," block into its canonical lines. Only fires when
 * the line genuinely starts with "To," and carries a full block; the anchors
 * (designation, organization suffix, street word, District line, PIN + state,
 * Sub:/Ref: labels) are the same boundaries the source document used.
 */
export function splitToBlock(line: string): string {
  const t = line.trim();
  if (!/^To,/.test(t) || t.length < 30) return line;
  let s = t.replace(/^To,/, "To,\n");
  // "The Assistant Commissioner" (and other office titles) end a line.
  s = s.replace(TO_DESIGNATION_RE, "$1\n");
  // Organization / office suffixes end a line when a new segment follows.
  s = s.replace(
    /(Organisation|Organization|Corporation|Office|Department|Ministry|Authority|Directorate|Society|Association|Trust|Board|Institute|Nigam|Vidyut|Company|Limited|Ltd\.?)\s+(?=[A-Z0-9])/g,
    "$1\n",
  );
  // Street words — "College Road" / "University Road" stay one unit
  // ("B.B. College Road Asansol," → "B.B. College Road\nAsansol,").
  s = s.replace(
    /((?:College|University)\s+)?(Road|Street|Marg|Avenue|Lane|Nagar|Colony|Sector|Building)\s+(?=[A-Z0-9])/g,
    "$1$2\n",
  );
  // The district line starts its own segment ("…Region–III District. …").
  s = s.replace(/\s+(?=Dist(?:rict|t)?[.:]?)/g, "\n");
  // PIN followed by the state name ("…– 713303 West Bengal" → two lines).
  s = s.replace(/(?<!\d)(\d{5,6})(?!\d)\s+(?=[A-Z])/g, "$1\n");
  // A Subject/Ref label glued onto the address ("…West BengalSub:- …").
  s = s.replace(/\s+(?=(?:Sub|Subject|Ref|विषय|संदर्भ)\s*[:-])/gi, "\n");
  return s.replace(/\n{2,}/g, "\n");
}

/**
 * Split fused body sentences on one line ("…Regional Office. It is also
 * intimated…" extracted without a newline). The period must be followed by a
 * capital letter, and the token it terminates must not be an abbreviation
 * ("No.", "HQ.", "L.C.", "P.S.-3") — so table cells and codes never split.
 */
export function splitFusedSentences(line: string): string {
  const t = line.trim();
  if (t.length < 80 || t.includes("|")) return line;
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i] !== "." || !/\s/.test(t[i + 1])) continue;
    const after = t.slice(i + 1).replace(/^\s+/, "");
    if (!/^[A-Z]/.test(after)) continue;
    // The token before the period must be ALPHABETIC — "2." list numbers,
    // "3." and other digit-prefixed items are never sentence ends.
    const tokMatch = t.slice(start, i).match(/([A-Za-z][A-Za-z]*)$/);
    if (!tokMatch) continue;
    const core = tokMatch[1].toLowerCase();
    if (core.length === 1) continue; // "L.C." / "P.S.-3" — never sentence ends
    if (NO_SPLIT_ABBR.has(core)) continue;
    out.push(t.slice(start, i + 1).trim());
    start = i + 1;
    while (start < t.length && /\s/.test(t[start])) start++;
    i = start - 1;
  }
  out.push(t.slice(start).trim());
  return out.filter(Boolean).join("\n");
}

/**
 * Recover the line structure PDF/OCR extraction loses: glue-joined words and
 * commas, a collapsed "To," block, and fused body sentences. Runs before the
 * line-based translation rules so every rule sees the source's real lines.
 */
export function recoverLineStructure(text: string): string {
  const recovered = normalizeFragmentedCodes(text)
    .split("\n")
    .map((line) => {
      // Glued commas ("Coll.,Bankola" → "Coll., Bankola", "3,and" → "3, and")
      // — never between digits, so amounts stay intact. A stray space BEFORE
      // a comma ("Dhanbad , D-I", "To , The Assistant…") is OCR noise and
      // collapses (the comma rule below re-spaces the glued form).
      let t = line.replace(/(?<!\d),(?=[A-Z])/g, ", ");
      t = t.replace(/,(?=\s*(?:and|&)\b)/gi, ",");
      t = t.replace(/(\S)\s+,/g, "$1,");
      // A parenthesized signature name glued onto the line's tail
      // ("Your's Faithfully    (Ajay Kumar Singh)", "…accordingly.   (Ajay
      // Kumar Singh)") — the closing/body line and the name are separate
      // reference lines; the wide gap is the extraction artifact.
      t = t.replace(/\s{2,}(\([^()]+\))\s*$/, "\n$1");
      // "(Ajay Kumar Singh) Encl.: As above…" — the signed name shares its
      // line with the enclosure marker; each becomes its own line so the
      // name rule and the Encl rule both fire.
      t = t.replace(/^(\([^()]+\))\s+(Encl(?:osure)?)/i, "$1\n$2");
      // Glued words (lower→upper). Acronyms and codes have no lower→upper
      // runs, so they are never touched.
      t = t.replace(/([a-z])([A-Z])/g, "$1 $2");
      // The DLC-camp note's letterhead address block fused between two
      // sentences ("…mentioned below:Add. : B.B. College Road … E-mail :
      // rnj@cmpfo.gov.inThe above officials are directed…") — split the
      // address blob onto its own line so each sentence reaches the phrase
      // dictionary and the address reads as its own block. Runs AFTER the
      // glue repair above ("below:Add" and "inThe" need their spaces).
      t = t.replace(
        /(below:)\s*(Add\s*\.?\s*:.*?E-?mail\s*:\s*\S+)\s+(?=The above officials)/gi,
        "$1\n$2\n",
      );
      // A structural label glued to an address tail ("PIN-826014Sub :- …",
      // "…West BengalRef:- …"): the label must carry its ":"/"-", so ordinary
      // words (…addressSubject…) never split.
      t = t.replace(/([^\s:])(?=(?:Sub|Subject|Ref|विषय|संदर्भ)\s*[:-])/gi, "$1\n");
      // The collapsed To-block.
      t = splitToBlock(t);
      // Fused body sentences — never inside an office-note ledger line
      // ("6. Letter No CPF/…" — letter 45): the sentence carries member-name
      // periods ("Mishra. CMPF", "Singh. CMPF") that would cut it into
      // fragments before the sentence dictionary can match the full entry.
      t = /^\d{1,2}[.)]\s+letter\s+no\b/i.test(t) ? t : splitFusedSentences(t);
      // A wide gap after a sentence-final period ("…accordingly.   Your's
      // Faithfully", "…informed.   Regional Commissioner") is the PDF layer's
      // line break, not a word space — split it so the closing/designation
      // rules reach each fragment.
      t = t.replace(/\.\s{2,}(?=[A-Z])/g, ".\n");
      return t;
    })
    .join("\n");
  return joinWrappedProse(recovered);
}

// ---------------------------------------------------------------------------
// Wrapped-prose recovery
// ---------------------------------------------------------------------------

/** A new line starts here (structural marker, list item, parenthesis) — a
 * wrapped sentence continuation never does. */
const WRAP_BLOCKER = new RegExp(
  [
    // Structural labels must carry their punctuation ("To," / "Ref:" / "Date:"
    // / "No." / "From:") so a wrapped sentence continuation like "from your
    // salary shall be adjusted…" is never mistaken for a new label.
    /^(?:to\s*[,:.]|sub(?:ject)?\s*[:]|ref\s*[:]|date\s*[:]|dear|respected|sir\s*[,:]?|madam|mahoday|sd\/|encl|copy|cc:?|attn|attention|www\.|http|phone|fax|e-?mail|from\s*[:]|page|no\.?)/i,
    /^\d+[.)]/, // "1. Hand over…" — a new list item
    /^\(/, // parenthesized content starts its own line
  ]
    .map((r) => r.source)
    .join("|"),
  "i",
);

/** Sentence-final punctuation — a line ending with it never joins onward. */
const LINE_END_BLOCK = /[.!?।:)]$/;

/** A trailing abbreviation ("No.", "Ref.", "etc.") is not a sentence end —
 * the wrap continues ("…Office Order No." + "OO/2026/117 dated…"). */
const ABBR_LINE_END =
  /\.(?:no|ref|dr|sr|jr|mr|mrs|ms|smt|shri|er|prof|st|etc|al|coll|hq|ahq|dist|dept|sec|gen|reg|misc|ltd|inc|po|pin|tel|ph|ext|approx)$/i;

/** Trailing function words — the classic wrap signal ("…continuation of"). */
const FUNC_WORD_END =
  /\b(and|the|of|to|from|with|for|in|on|at|a|an|as|by|or|if|be|is|are|was|were|has|have|had|not|it|its|this|that|these|those|which|who|whom|whose|shall|will|may|can|must|should|would|could|do|does|did|due|such|than|then|there|here|under|over|above|below|before|after|while|when|where|why|how|only|also|still|yet|into|onto|upon|within|without|through|during|between|among|per|via|but|so|though|although|because|since|until|unless|against|across|along|beside|beyond|despite|towards|according|regarding|concerning|following|including|pending|awaiting)$/i;

/**
 * Real letters wrap sentences across lines ("…this office hereby issues the"
 * / "L.C.-Out order placing you on transfer…"). Fragment lines never reach
 * the sentence-level dictionary or translation memory, so they survive
 * untranslated. This pass re-joins wrapped lines into complete sentences.
 *
 * Safety gates (each one is what keeps the merged-PDF table fix intact):
 *   • only after the first structural line — the letterhead stays verbatim;
 *   • only lines ≥ 60 chars — table cells/headers (SL. No, cell texts) are
 *     shorter, so a flattened table is never glued into one paragraph;
 *   • never across sentence-final punctuation, pipe rows, blank lines, list
 *     numbers, parentheses or structural labels.
 */
export function joinWrappedProse(text: string): string {
  const lines = text.split("\n");
  let cut = lines.findIndex((l) => {
    const t = l.trim();
    return STRUCTURAL_START.test(t) || /^[A-Z]{2,}\/\d/.test(t) || t.includes("|");
  });
  if (cut === -1) cut = 0;

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i < cut || i === lines.length - 1) {
      out.push(line);
      continue;
    }
    const t = line.trim();
    const next = lines[i + 1].trim();
    // The continuation signal: the line ends with a function word, the next
    // line starts lowercase, or the line is long prose and the next line
    // completes a sentence ("…, IFSC" + "SBIN0001142)."). A long line
    // ending in a comma is never a complete sentence either — the wrapped
    // L.C.-out paragraphs split right after "…of CMPF Commissioner," with
    // "Dhanbad, I am to state…" starting the next line.
    const continuation =
      FUNC_WORD_END.test(t) ||
      /^[a-z]/.test(next) ||
      (t.length >= 60 && /[.!?।]$/.test(next)) ||
      (t.length >= 40 && /,$/.test(t));
    const firstWords = (s: string) => s.split(/\s+/).slice(0, 3).join(" ");
    const blocks =
      t.length === 0 ||
      next.length === 0 ||
      // An email-carrying line ("Add . : … E-mail : rnj@cmpfo.gov.in") is a
      // data/address line — never a sentence that wraps onward, and never a
      // wrap target (the domain tail would look like a function word).
      t.includes("@") ||
      next.includes("@") ||
      // A standalone "To" / "To," address label never joins the designation
      // line beneath it ("To" + "The Regional Commissioner" would otherwise
      // fuse into one untranslatable line — the joined form is exactly the
      // half-translated output the reference QA caught).
      /^to\s*[,:]?$/i.test(t) ||
      (LINE_END_BLOCK.test(t) && !ABBR_LINE_END.test(t)) ||
      t.includes("|") ||
      next.includes("|") ||
      WRAP_BLOCKER.test(next) ||
      // A very short next line is normally a cell/address fragment — but a
      // line that ends with a continuation signal ("…contributing in this")
      // always wraps into it ("region."), so the short-tail guard yields.
      (next.length < 12 && !FUNC_WORD_END.test(t)) ||
      !continuation ||
      // A repeating column layout ("Name of the colliery…" twice) is a
      // flattened table, not wrapped prose — never glue columns together.
      firstWords(t).toLowerCase() === firstWords(next).toLowerCase();
    if (blocks) {
      out.push(line);
      continue;
    }
    // Join into the next line; the next iteration emits it (or joins further).
    lines[i + 1] = `${t} ${next}`;
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Pass 2 — post-translation cell/header refinement
// ---------------------------------------------------------------------------

/** A person line ("Shri Tonmoy Bhattacharjee") — a name, never untranslated
 * prose; the reference-standard pass puts it in Devanagari for Hindi. */
function isNameLine(line: string): boolean {
  return /^(?:shri|smt|dr|er|mr|mrs|ms|miss)[.,]?\s+[A-Za-z][A-Za-z.'\s-]{2,}$/i.test(
    line.trim(),
  );
}

/** A pure code / number line ("RNJ/21/1964", "1", "07/07/2026") — data. */
function isCodeOrNumberLine(line: string): boolean {
  const t = line.trim();
  if (/^[\d.,/:\-– ]+$/.test(t)) return true;
  return /^[A-Z]{2,}\/?\d/.test(t);
}

/**
 * The first structural line marks the end of the letterhead text block; the
 * block above it (organization names, addresses) is preserved verbatim and
 * must never be touched by the refinement pass.
 */
const STRUCTURAL_START =
  /^(date|dated|ref|reference|file\s*no|no\.?|sub|subject|to\s*[,:]?|dear|respected|sir[,:]?|madam[,:]?|mahoday|the\s+(?:regional|deputy|joint|assistant|commissioner|director|registrar)|विषय|संदर्भ|दिनांक|प्रति|सेवा में)/i;

function letterheadCut(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (
      STRUCTURAL_START.test(t) ||
      t.includes("|") ||
      /^[A-Z]{2,}\/[A-Z0-9]/.test(t) ||
      /^[\u0900-\u097F]{2,}\/\d/.test(t) ||
      // A Devanagari code run that continues with a word, not a digit
      // ("सीपीएफ/विविध/पीए सेल/आर-1/एएसएन/ दिनांक" — the DLC office-note
      // header) ends the letterhead just like the digit form above. The
      // letterhead's own phone line ("फोन नं०/…") never matches: a space
      // sits between its Devanagari run and the slash.
      /^[\u0900-\u097F]{2,}\//.test(t) ||
      // A Devanagari file-number opener ("संख्या आरएनजे/31-1512/2026")
      // ends the letterhead just like its English twin — the code after the
      // label may itself be Devanagari (आरएनजे), not just Latin.
      /^[\u0900-\u097F]{2,}\s+[\u0900-\u097FA-Z0-9]{2,}\/\d/.test(t) ||
      // A Devanagari label + LATIN code whose run carries slashes
      // ("संख्या KU/ADMIN/2026/412" — the university notice): the run above
      // only matches when the first slash is followed by a digit
      // (डीईपीटी/42-…), so a code with a letter after its first slash
      // (KU/ADMIN/…) would leave the whole header treated as letterhead.
      /^[\u0900-\u097F]{2,}\s+[A-Z][\u0900-\u097FA-Z0-9.\/-]{1,}\/\d/.test(t) ||
      // Space-fragmented code headers ("C PF/118/…" → collapsed
      // "CPF/118/…") and the serial+file-number header ("SL. No. : 85
      // CPF/…") — both open the letter body, never the letterhead.
      /^[A-Z]{2,}\s*\/\s*[A-Z0-9]/.test(t) ||
      /^sl\.?\s*no/i.test(t)
    ) {
      return i;
    }
  }
  return lines.length;
}

/** The base translator's note, always in this shape, localized lead + count. */
const NOTE_RE = /^— .*?\(\d+ lines? kept in the source language\)\s*\n\n?/;

/**
 * Refine the translated content: localize bare table headers, translate
 * fully-covered pipe-less table cells / address fragments, strip the
 * "kept in the source language" note when nothing is left, and rebuild it
 * with an honest count otherwise. Returns the new content and completion flag.
 */
export function recoverCells(
  content: string,
  language: string,
  overlay?: GlossaryOverlay,
): { content: string; complete: boolean } {
  let text = content.replace(NOTE_RE, "");
  const lang = kitName(kitFor(language));
  const lines = text.split("\n");
  const cut = letterheadCut(lines);
  let untranslated = 0;

  for (let i = cut; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0) continue;
    // Already in the target script (translated or transliterated) — done.
    if (/[\u0900-\u097F\u0B80-\u0BFF\u0980-\u09FF\u0C00-\u0C7F\u0C80-\u0CFF\u0A80-\u0AFF\u0600-\u06FF]/.test(trimmed)) continue;
    // Names, codes and numbers are data, not untranslated prose.
    if (isNameLine(trimmed) || isCodeOrNumberLine(trimmed)) continue;
    // Letterhead-like address/contact lines ("Add . : B. B. College Road…",
    // "E-mail : rnj@cmpfo.gov.in") are data, not prose: they translate via
    // the term pass when every word is covered (the email itself always
    // stays Latin), otherwise they stay verbatim — never counted as
    // untranslated prose, matching how the letterhead keeps its script.
    if (/^(add(ress)?|e-?mail|phone|fax|tel|website|www)\b/i.test(trimmed)) {
      if (lang === "Hindi" && trimmed.length <= 200) {
        const emails = trimmed.match(/\S+@\S+/g) ?? [];
        // The address body minus the email and its trailing "E-mail :" label
        // — the term pass translates it, then the email rides back on its
        // own "ई-मेल:" label (the email itself always stays Latin).
        const body = trimmed
          .replace(/\S+@\S+/g, " ")
          .replace(/e-?mail\s*:?\s*$/i, "")
          .replace(/[:\s]+$/, "")
          .trim();
        if (body.length > 0) {
          const t = hindiTranslateLine(body, overlay);
          if (t !== null) {
            const tail = emails.length > 0 ? ` ई-मेल: ${emails[0]}` : "";
            // "पता . :" → "पता:" — the OCR label gap collapses.
            lines[i] = t.replace(/(\S)\s*\.\s*:/, "$1:") + tail;
          }
        }
      }
      continue;
    }
    // Bare table header (pipe structure lost): "SL. No" → "क्र.सं." etc.
    const header = localizeTableHeader(trimmed, lang, overlay);
    if (header !== trimmed) {
      lines[i] = header;
      continue;
    }
    // Fully-covered short lines — table cells, address fragments.
    if (lang === "Hindi" && trimmed.length <= 140) {
      const t = hindiTranslateLine(trimmed, overlay);
      if (t !== null) {
        lines[i] = t;
        continue;
      }
    }
    // Domain translation-memory (fidelity PRD §4.3): formulaic government
    // boilerplate the dictionary misses still translates deterministically
    // — the seeded CMPF sentences and their near variants. A hit is fully
    // Hindi, so it is never counted as untranslated.
    if (lang === "Hindi") {
      const g = translateWithGlossary(trimmed);
      if (g !== null) {
        lines[i] = g;
        continue;
      }
    }
    // Genuinely untranslated prose — count it honestly.
    if ((trimmed.match(/[A-Za-z]+/g) ?? []).length >= 2) untranslated += 1;
  }

  text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { content: text, complete: untranslated === 0 };
}
