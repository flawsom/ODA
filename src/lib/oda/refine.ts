// Reference-standard post-processing (Hindi only): after the structural
// translator has run, this pass transliterates the document's own codes and
// names so the output reads like the official Hindi twin of the source — the
// exact reference the CMPFO letters set:
//   • file / reference numbers   CPF/118/Misc./L.C.-Out/RNJ-21… → सीपीएफ/118/विविध/एल.सी.-आउट/आरएनजे-21…
//   • account numbers in tables  RNJ/21/1964 → आरएनजे/21/1964
//   • member names               Shri Tonmoy Bhattacharjee → श्री तन्मय भट्टाचार्य
//   • signature names            (Ajay Kumar Singh) → (अजय कुमार सिंह)
//   • file-number + date lines   CPF/118/… / Date: 09-07-2026 → one line,
//                                code left, दिनांक:09-07-2026 right (the
//                                official header shape)
//   • Latin names/codes inside   "…श्री Ravindra Yadav, … RNJ/12/1011…" →
//     translated sentences       "…श्री रविंद्र यादव, … आरएनजे/12/1011…"
// Everything else — letterhead, translated prose, localized labels — passes
// through untouched.
//
// This module also guarantees the letterhead: `reapplyLetterhead` replaces
// whatever an engine emitted above the first structural line with the source
// document's exact letterhead block, so the header is byte-identical to the
// input across every output (AI or adaptive) — the reference letters carry
// the same CMPFO letterhead in every one of them.
//
// It also re-exports `translateAdaptive` so app callers get the refined
// output without changing the base translator's contract.

import {
  translateAdaptive as baseTranslateAdaptive,
  transliterateName,
  transliterateRef,
  hindiTranslateLine,
  addressLineNeedsComma,
  refineAddressLine,
  translateHindiSubject,
  type TranslateResult,
} from "./translate";
import { type AdaptiveDoc, type AdaptiveOptions } from "./adaptive";
import { recoverCells, recoverLineStructure } from "./recover";
import { MONTHS, PLACES } from "./glossary";
import type { GlossaryOverlay } from "./extraDict";
import { ensureComplete } from "./completeness";
import { sweepLeftoverLines } from "./translate";
import { rateTranslation, referenceDecision, type TranslationRating } from "./rating";

export type { TranslateResult } from "./translate";

/** A translation plus its per-letter translator rating (reference decision +
 * completion grade, decided intelligently per letter — see rating.ts). */
export interface RatedTranslateResult extends TranslateResult {
  rating: TranslationRating;
  ratingNote: string;
  ratingScore: number;
}

/**
 * The first structural line (Date:/Ref:/No./To,/Subject:/Sir,/…, a bare
 * file-number code like CPF/118/…, or a table row) marks the end of the
 * letterhead. Everything above it — organization names, office addresses,
 * phone/email/website lines — is kept exactly as-is, because that is the
 * letterhead the user wants untouched. Mirrors the base translator's rule.
 */
const STRUCTURAL_START =
  /^(date|dated|ref|reference|file\s*no|no\.?|sub|subject|to\s*[,:]?|dear|respected|sir[,:]?|madam[,:]?|mahoday|the\s+(?:regional|deputy|joint|assistant|commissioner|director|registrar)|विषय|संदर्भ|दिनांक|प्रति|सेवा में)/i;

/**
 * True for a reference-CODE line ("No. RNJ/31-1512/2026", "Ref:- CPF/59/…")
 * whose value is code-like — NOT a prose sentence that merely starts with
 * "Reference" ("Reference your application No. … dated …" must reach the
 * translation memory and get fully translated, never mechanically
 * transliterated into a half-mangled mix).
 */
function isCodeRefLine(line: string): boolean {
  // The Devanagari संख्या opener (the base translator's Hindi rendering of
  // "No.") closes the letterhead and transliterates its code just like the
  // Latin "No." form — a non-CMPF "No. DEPT/42-2026/118" becomes "संख्या
  // डीईपीटी/42-2026/118", not a half-Latin header.
  const m = line.match(/^(?:ref|no\.?|file\s*no\.?|letter\s*no\.?|संख्या)\s*[:#-]?\s*(.+)$/i);
  if (!m) return false;
  const value = m[1].replace(/\s+dated\s+/i, " ");
  // A lowercase word at the START of the value is prose, not a code —
  // "No. of LC" (the table header) has value "of LC", which the mid-value
  // check below would miss ("of" sits at position 0). Guarding it keeps the
  // header out of the code-transliteration path so the header table matches
  // it as एल.सी. संख्या instead of mangling it to "No.of एल.सी.".
  return /[A-Z]{2,}/.test(value) && !/\s[a-z]{2,}\s/i.test(value) && !/^[a-z]{2,}\s/i.test(value);
}

/** Lines that are a bare code from the very start (CPF/118/…, RNJ/31-1512/…). */
const CODE_LINE = /^[A-Z]{2,}\/[A-Z0-9]/;

/** The localized date form the base translator emits for Hindi (दिनांक:09-07-2026). */
const HI_DATE = /^दिनांक:\d/;

/**
 * Where the letterhead's right-aligned address/contact block starts. In the
 * CMPFO letters (and most official Indian letterheads) everything after
 * "पता / Address :" sits right-aligned; the organization block above it is
 * centered.
 */
export const ADDRESS_START =
  /^(पता|पत्ता|address|முகவரி|ঠিকানা|విళాసం|ವಿಳಾಸ|સરનામું|ठिकाणा|telephone|phone|फोन|दूरभाष)/i;

/**
 * A real letterhead is a short run of organization/address lines — never body
 * prose, the partial-translation note, bullets or sentence-like lines. This
 * guards against the structural marker landing mid-document (e.g. an English
 * "The Commissioner" recipient line inside a partially translated non-Hindi
 * body), which would otherwise render body text as a fake letterhead.
 */
export function looksLikeLetterhead(lines: string[]): boolean {
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0 || nonEmpty.length > 12) return false;
  return nonEmpty.every((l) => {
    const t = l.trim();
    if (t.startsWith("—") || t.startsWith("–") || t.startsWith("-") || t.startsWith("*")) return false;
    if (/[.!?।]$/.test(t)) return false; // ends like a sentence
    return t.length <= 120;
  });
}

/**
 * The safe letterhead cut for a piece of output content: the index of the
 * first structural line when the block above it genuinely looks like a
 * letterhead, otherwise 0 (no letterhead). Used by both the app renderer and
 * the exporters so every surface agrees on where the letterhead ends.
 */
export function safeLetterheadCut(content: string): number {
  const lines = content.split("\n");
  const cut = letterheadCutIndex(lines);
  if (cut <= 0 || cut >= lines.length) return 0;
  if (!looksLikeLetterhead(lines.slice(0, cut))) return 0;
  return cut;
}

/** The index of the first line that ends the letterhead; lines.length when none. */
export function letterheadCutIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    // Also stop at a transliterated code line (सीपीएफ/118/… — Devanagari
    // run followed by a slash and a digit), so an already-Hindi file number
    // ends the letterhead too. The letterhead's own phone line (फोन नं०/…)
    // never matches because a letter, not a digit, follows its slash.
    if (
      STRUCTURAL_START.test(t) ||
      t.includes("|") ||
      CODE_LINE.test(t) ||
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
      // Space-fragmented code headers ("C PF/118/…" — a single OCR-split
      // letter before the code) and the serial+file-number header
      // ("SL. No. : 85 CPF/…") — both open the letter body, never the
      // letterhead.
      /^[A-Z]\s+[A-Z]{2,}\s*\/\s*[A-Z0-9]/.test(t) ||
      /^[A-Z]{2,}\s*\/\s*[A-Z0-9]/.test(t) ||
      /^sl\.?\s*no/i.test(t)
    ) {
      return i;
    }
  }
  return lines.length;
}

/** The source document's letterhead block — the header preserved verbatim. */
export function extractLetterhead(text: string): string {
  const lines = text.split("\n");
  return lines.slice(0, letterheadCutIndex(lines)).join("\n").trim();
}

/**
 * Letterhead guarantee: replace everything above the first structural line of
 * the given content with the source document's exact letterhead, so the
 * header is byte-identical to the input across every output (AI or adaptive).
 * Content without a letterhead (or without a structural line) passes through.
 */
export function reapplyLetterhead(content: string, sourceText: string): string {
  const letterhead = extractLetterhead(sourceText);
  if (letterhead.length === 0) return content;
  const lines = content.split("\n");
  const cut = letterheadCutIndex(lines);
  const body = lines.slice(cut).join("\n").replace(/^\n+/, "").trim();
  return `${letterhead}\n\n${body}`;
}

/** Known English terms (longest first) that can survive inside an otherwise
 * Devanagari sentence — "Regional Director, Nalanda" → "क्षेत्रीय निदेशक,
 * नालंदा" — so phrase captures never stay half-Latin. */
const TERMS = Object.entries(PLACES).sort((a, b) => b[0].length - a[0].length);

function replaceKnownTerms(s: string): string {
  for (const [en, hi] of TERMS) {
    if (!s.includes(en)) continue;
    s = s.replace(new RegExp(`\\b${en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), hi);
  }
  return s;
}

/**
 * Devanagari refine for Hindi prose: Latin account/file codes and member
 * names captured into a translated sentence are transliterated so the line
 * reads fully in Devanagari — the reference standard (श्री रविंद्र यादव,
 * सीएमपीएफ खाता संख्या- आरएनजे/12/1011). Only lines that already contain
 * Devanagari are touched, so pure-Latin letterhead lines pass untouched.
 */
function hindiRefineLine(line: string, overlay?: GlossaryOverlay): string {
  if (!/[\u0900-\u097F]/.test(line)) return line;
  // ABSOLUTE FLOOR: always proceed to transliteration — never bail out.
  // The old pre-flight gate returned the line unchanged when < 20% of
  // Latin words were known, which left mixed-script lines half-finished.
  // Now the code/name-group passes below run on every Devanagari line
  // that carries Latin remnants, so no line ships with Latin prose in a
  // Hindi document.
  // Emails are parked on opaque placeholders BEFORE the code/name-group
  // passes: the passes would otherwise transliterate the local part
  // ("pallav.khastagir@coalindia.in" → "पल्लव.khastagir@…") because the
  // dot-bound lookarounds only guard the domain side. The placeholder has
  // no letters, so no pass touches it, and it is restored before return.
  const emails: string[] = [];
  let s = replaceKnownTerms(line).replace(/\S+@\S+/g, (m) => {
    emails.push(m);
    // Digits-only placeholder (no letters) — the code/name-group passes
    // never match it, so it survives untouched until the restore below.
    return `\u0001${emails.length - 1}\u0001`;
  });
  // "CMPF A/C No-" / "CMPF A/C No. " and the partially-localized
  // "सीएमपीएफ ए/C No-" — the extract-sentence slot carries the account
  // label with it; the reference standard reads सीएमपीएफ खाता संख्या-.
  s = s.replace(/\bCMPF\s*(?:A\/?C\.?)?\s*No\.?\s*-?/gi, "सीएमपीएफ खाता संख्या");
  s = s.replace(/सीएमपीएफ\s*ए\/C\s*No\.?\s*-?/gi, "सीएमपीएफ खाता संख्या");
  // The extract template's trailing "as desired." — the slot capture keeps
  // it on the line ("…RNN/12/2077 as desired . के संबंध में…"); the
  // reference sentence drops it entirely (…के संबंध में संलग्न उद्धरण…).
  s = s.replace(/,?\s*as\s+desired\s*\.?/gi, "");
  // Code/ref tokens inside a Devanagari sentence ("…पत्र संख्या- CPF/118/
  // Misc./Ext-out/R-I/ASN/993 दिनांक…" — a sentence-template capture) are
  // transliterated as ONE reference code (सीपीएफ/118/विविध/एक्सट-आउट/आर-I/
  // एएसएन/993). This runs BEFORE the name-group pass below: if the group
  // pass got there first, it would letter-mangle each code fragment
  // phonetically ("CPF" → "कपफ", "ASN" → "असन") and the digits would
  // block the code rule entirely.
  s = s.replace(
    /(^|[\s(,;:])([A-Za-z][A-Za-z0-9/.\-]*[0-9][A-Za-z0-9/.\-]*)(?=[\s),;:।]|$)/g,
    (m, lead: string, tok: string) => `${lead}${transliterateRef(tok, overlay)}`,
  );
  // Latin word groups inside a Devanagari line — a posting/designation or org
  // name captured into a translated sentence ("…आपको Joint Commissioner,
  // Central Division के रूप में…") — are localized by the term pass
  // (…संयुक्त आयुक्त, केंद्रीय प्रभाग…). All-or-nothing per group: any
  // unknown word keeps the group as-is, so names and codes never half-mangle.
  s = s.replace(
    /(?<![A-Za-z0-9.@])[A-Za-z][A-Za-z.\-']*(?:\s+[A-Za-z][A-Za-z.\-']*)*(?![A-Za-z0-9@])/g,
    (group: string) => {
      if (!/[A-Za-z]/.test(group)) return group;
      // Dot-ending groups are dotted abbreviations ("Mr.", "L.C.", "B.B.") —
      // the term pass would keep the dot and emit a malformed honorific
      // ("श्री."); the abbreviation/code rules handle those separately.
      if (/\.$/.test(group)) return group;
      // An email's local/domain parts ("singrauli@cmpfo.gov.in") never match:
      // the guards above stop a group right before/after "@" or a dot-bound
      // domain segment, and a group that slipped through ("cmpfo.gov.in")
      // fails the all-or-nothing term pass and stays verbatim.
      const t = hindiTranslateLine(group, overlay);
      if (t !== null && /[\u0900-\u097F]/.test(t)) return t;
      // A code/abbreviation fragment the term pass could not cover ("CPF",
      // "Misc", "Ext-out" — parts of a sentence-template ref capture) reads
      // via the reference code transliterator (सीपीएफ, विविध, एक्सट-आउट),
      // never a phonetic letter-by-letter mangling (कपफ, मिसक). Person-name
      // words transliterate identically either way, so this is safe.
      // Single-token groups only — a multi-word group ("Upendra Rai")
      // would come back HALF-transliterated ("उपेंद्रा Rai") and must fall
      // through to the name transliterator for the full, clean rendering.
      const code =
        !group.includes(" ") ? transliterateRef(group, overlay) : group;
      if (code !== group && /[\u0900-\u097F]/.test(code)) return code;
      // A proper-noun group the term pass could not cover — a member name
      // captured into a translated sentence ("…, Dewanti Pandey,
      // सीएमपीएफ…") — falls back to the name transliterator. Guarded to
      // capitalized person-name shapes (≤ 4 words) and never org/office
      // nouns, so an organization group the term pass missed stays verbatim
      // instead of letter-mangling (कोल for Coal).
      const n = transliterateName(group, overlay);
      const words = group.split(/\s+/).filter(Boolean);
      if (
        n !== null &&
        words.length <= 4 &&
        words.every((w) => /^[A-Z]/.test(w)) &&
        !/\b(coal|mines|fund|provident|office|company|ltd|limited|corporation|organisation|organization|association|commissioner|director|secretary|manager|superintendent|inspector)\b/i.test(group)
      ) {
        return n;
      }
      return group;
    },
  );
  s = s.replace(
    /(श्री|श्रीमती|डॉ\.)\s+([A-Za-z][A-Za-z.\- ]+?)(?=[,;:।]|$)/g,
    (m, hon: string, name: string) => {
      const en =
        hon === "श्री" ? `Shri ${name.trim()}` : hon === "श्रीमती" ? `Smt ${name.trim()}` : `Dr ${name.trim()}`;
      const t = transliterateName(en, overlay);
      return t !== null ? t : m;
    },
  );
  // Latin honorific + name inside a Devanagari sentence ("…, Shri C
  // Srikanth, सीएमपीएफ…", "…, B. Mahamood Miya, सीएमपीएफ…") — the extract
  // slot fills the name in Latin and the term pass cannot cover names;
  // transliterate the whole honorific + name run (श्री सी श्रीकांत, बी.
  // महमूद मिया). Guarded to the honorific/initial opener so prose groups
  // are never mistaken for names.
  s = s.replace(
    // The lookahead accepts "(" and a trailing space too: a sentence-template
    // capture often rides straight into a parenthesized account clause
    // ("…Sri Shiv Lal Mishra (सीएमपीएफ खाता संख्या- …)") or a period-and-
    // Devanagari tail ("…Sri Rabindra Singh. सीएमपीएफ…") and must still
    // match — otherwise the name falls to the phonetic floor (स्रि शिव लल
    // मिशरा / स्रि रबिंद्रा सिंह).
    /(^|[\s(,;:])(shrimati|shri\.?|sri\.?|s\.?h\.?|smt\.?|mr\.?|mrs\.?|dr\.?|er\.?|[A-Z]\.)\s+([A-Za-z][A-Za-z.\- ]+?)(?=[,;:।(\s]|$)/gi,
    (m, lead: string, hon: string, name: string) => {
      const t = transliterateName(`${hon} ${name.trim()}`, overlay);
      return t !== null ? `${lead}${t}` : m;
    },
  );
  // Restore the parked emails (see the placeholder note at the top).
  s = s.replace(/\u0001(\d+)\u0001/g, (_m, i: string) => emails[Number(i)]);
  return s;
}

/**
 * The localized To-block opener (सेवा में, / प्रति, / To,). The lines after
 * it are the recipient address block; the reference letters end each short
 * line with a comma (सहायक आयुक्त, कोयला खान भविष्य निधि संगठन, …) except the
 * tail lines — the region/city line, the district+PIN line and the state —
 * which end bare.
 */
const TO_BLOCK_START = /^(?:सेवा में|प्रति|to)[.,:]?$/i;

/** A line that ends the recipient block (next section, table, list). */
function endsToBlock(t: string): boolean {
  return (
    t.length === 0 ||
    t.includes("|") ||
    CODE_LINE.test(t) ||
    /^\d+[.)]/.test(t) ||
    /^(?:विषय|संदर्भ|दिनांक|महोदय|कृपया|सूचित|प्रिय|माननीय)/.test(t)
  );
}

/**
 * Ranges of lines that form a recipient address block: the "सेवा में," line
 * plus the short address lines that follow until a structural line ends it.
 */
function toBlockRanges(lines: string[]): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < lines.length) {
    if (TO_BLOCK_START.test(lines[i].trim())) {
      let j = i + 1;
      while (j < lines.length && !endsToBlock(lines[j].trim())) j++;
      if (j - i >= 2) ranges.push({ start: i, end: j });
      i = j;
    } else {
      i++;
    }
  }
  return ranges;
}

/**
 * The reference comma rule for one recipient address line: a short fully-
 * Devanagari line that does not already end with punctuation, a digit (PIN),
 * a closing paren, or a region/office code tail (क्षेत्र-III, डी-II, आर-I)
 * gets a trailing comma — the official Hindi letter style the gold reference
 * sets (धनबाद, डी-II and धनबाद (झारखंड) stay bare).
 */
function toBlockComma(t: string): boolean {
  return addressLineNeedsComma(t);
}

export function referenceStandardPass(content: string, overlay?: GlossaryOverlay): string {
  const lines = content.split("\n");
  // "To, The Regional Commissioner" — the To-block opener fused with the
  // recipient designation on one line (the scanned letters' collapsed To,
  // block). Split into the canonical two-line form so the block scanner
  // below detects it and every following address line gets the reference
  // treatment (सेवा में, / क्षेत्रीय आयुक्त, …).
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(/^to[,:]?\s+(.+)$/i);
    if (m) {
      lines[i] = "To,";
      lines.splice(i + 1, 0, m[1].trim());
    }
  }
  // Pre-scan the recipient address blocks so the comma rule can skip each
  // block's final line (the state / last address line stays bare).
  const ranges = toBlockRanges(lines);
  const inBlock: Record<number, number> = {};
  for (const r of ranges) {
    for (let i = r.start; i < r.end; i++) inBlock[i] = r.end;
  }
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      // Collapse whitespace-only lines (tabs/wide gaps between the closing
      // and the signature) to a clean empty line.
      out.push("");
      continue;
    }

    // An address tail fused with the subject label ("Odisha 768020 Sub :-
    // Inter Regional Transfer of Ledger Card.") — the reference splits the
    // address line and the विषय line so neither half ships half-Latin.
    const fusedSub = trimmed.match(/^(.*?)\s+sub(?:ject)?\s*[:：-]+\s*(.+)$/i);
    if (fusedSub) {
      const addr = fusedSub[1].trim();
      const subj = translateHindiSubject(fusedSub[2].trim(), overlay) ?? fusedSub[2].trim();
      if (addr.length > 0) out.push(hindiTranslateLine(addr, overlay) ?? addr);
      out.push(`विषय:- ${subj}`);
      continue;
    }

    // Recipient address block: every line but the block's last gets the
    // reference comma unless it already ends with punctuation/digit or carries
    // its own comma/label. Lines are tidied first (fully-covered Latin lines
    // read in Hindi, stray OCR spaces collapse, label colons and the PIN get
    // canonical spacing) so the comma rule — and the DOCX renderer's own
    // pass — see the same clean line. The block's LAST line (the state / a
    // truncated tail like "Jabalpur (MP") is translated too — just without
    // the comma.
    if (inBlock[i] !== undefined) {
      let t = refineAddressLine(trimmed);
      // A person-name line in the recipient block ("Shri Rajesh Mehra") reads
      // in Devanagari (श्री राजेश मेहरा) — the term pass can't cover names.
      // Guarded to honorific-prefixed lines so org/office lines the term pass
      // misses are never mangled by the name fallback.
      if (
        !/[\u0900-\u097F]/.test(t) &&
        /^(shri|smt\.?|mr\.?|mrs\.?|dr\.?|er\.?)\b/i.test(trimmed)
      ) {
        const n = transliterateName(trimmed, overlay);
        if (n !== null) t = n;
      }
      // Still Latin after the strict term pass (org/place words the
      // dictionary has not seen — "Singrauli P.O. Jayant, Dist. Sidhi…") —
      // relax to the proper-noun fallback so place names transliterate
      // instead of shipping English. Function words never reach it.
      if (!/[\u0900-\u097F]/.test(t)) {
        const tn = hindiTranslateLine(trimmed, overlay, true);
        if (tn !== null) t = tn;
      }
      const isLast = i >= inBlock[i] - 1;
      const collapsed = t.replace(/  +/g, " "); out.push(isLast ? collapsed : toBlockComma(collapsed) ? collapsed.replace(/\s*$/, "") + "," : collapsed);
      continue;
    }

    // The "sd/-" marker renders as (हस्ताक्षर); the reference letters drop
    // it entirely when a signed name line follows ((अजय कुमार सिंह)).
    if (/^\((हस्ताक्षर|Signature)\)$/i.test(trimmed)) {
      let k = i + 1;
      while (k < lines.length && lines[k].trim().length === 0) k++;
      const next = lines[k]?.trim() ?? "";
      if (/^\([^()]+\)$/.test(next) && !/^\((हस्ताक्षर|Signature)\)$/i.test(next)) {
        continue;
      }
    }

    // The serial + file-number header ("SL. No. : 85 CPF/Misc/PA
    // Cell/R-1/ASN / Date: 02-01-2026" — the extract letters print the
    // serial on the file-number line) reads क्र.सं. : 85 … with the code
    // transliterated, exactly the reference header shape.
    const slNo = trimmed.match(/^sl\.?\s*no\.?\s*:?\s*(\d+)\s+([A-Za-z].*)$/i);
    if (slNo && /[A-Z]{2,}\s*\/\s*[A-Z0-9]/.test(slNo[2])) {
      out.push(`क्र.सं. : ${slNo[1]} ${transliterateRef(slNo[2], overlay)}`);
      continue;
    }

    // Multi-member extract list lines ("(II) Shri Kanchan kr. Passi, CMPF
    // A/C NO- RNJ/18/1289") — the roman numeral, honorific + name, the
    // account label and the code all localize; the reference multi-member
    // letters set this shape.
    const mList = trimmed.match(
      /^\(([IVXivx]+)\)\s+(shrimati|shri\.?|s\.?h\.?|smt\.?|mr\.?|mrs\.?|dr\.?|er\.?)\s+([A-Za-z][A-Za-z.\- ]+?),\s*CMPF\s*A\/?C\.?\s*No\.?\s*-?\s*(.+)$/i,
    );
    if (mList) {
      const name = transliterateName(`${mList[2]} ${mList[3].trim()}`, overlay);
      // The single-member template's "as desired." tail glues onto the last
      // list line ("…RNJ/19/1257 as desired.") — the reference list lines
      // drop it entirely (the extract sentence itself owns the tail).
      const code = mList[4].replace(/\s*as\s+desired\s*\.?\s*$/i, "");
      out.push(
        `(${mList[1].toUpperCase()}) ${name ?? `${mList[2]} ${mList[3].trim()}`}, सीएमपीएफ खाता संख्या- ${transliterateRef(code, overlay)}`,
      );
      continue;
    }

    // File-number line immediately followed by a localized date line merge
    // into the official one-line header: transliterated code left, दिनांक:…
    // right — exactly the CMPFO reference letter shape.
    const next = lines[i + 1]?.trim() ?? "";
    if ((isCodeRefLine(trimmed) || CODE_LINE.test(trimmed)) && HI_DATE.test(next)) {
      const code = /[A-Za-z]/.test(trimmed) ? transliterateRef(trimmed, overlay) : trimmed;
      const gap = " ".repeat(Math.max(4, 92 - (code.length + next.length)));
      out.push(code + gap + next);
      i += 1;
      continue;
    }

    // Table rows: transliterate member names and account codes; colliery
    // history cells get the reference's multi-line shape; headers and
    // already-translated cells stay as-is.
    if (trimmed.includes("|")) {
      out.push(
        tidyDevLine(
          trimmed
            .split("|")
            .map((cell, ci) => {
              const c = cell.trim();
              if (c.length === 0) return c;
              // A dual English+Hindi cell ("श्री अरुण कुमार Shri Arun
              // kumar", "आरएनजे/19/1283 Rnj /19/1283") — the template prints
              // the name/account in both scripts; the Hindi half is already
              // the reference form, so the Latin duplicate is dropped.
              if (/[\u0900-\u097F]/.test(c) && /[A-Za-z]/.test(c)) {
                const nameDup = c.match(
                  /^([\u0900-\u097F][\u0900-\u097F\s.'-]+?)\s+(?:shrimati|shri\.?|s\.?h\.?|smt\.?|mr\.?|mrs\.?|dr\.?|er\.?)\s+[A-Za-z][A-Za-z\s.'-]+$/i,
                );
                if (nameDup) return nameDup[1].replace(/\s+$/g, "");
                const codeDup = c.match(/^([\u0900-\u097F][\u0900-\u097F0-9/.\-]*)\s+[A-Za-z][A-Za-z0-9/.\- ]+$/);
                if (codeDup) return codeDup[1].trim();
              }
              // OCR-split serial numbers ("0 1" → "1") — first column only.
              // The No.-of-LC column keeps its "01" (the reference letters
              // print the leading zero there).
              if (ci === 0 && /^\d[\d\s]{0,3}$/.test(c)) {
                return c.replace(/\s+/g, "").replace(/^0+(?=\d)/, "");
              }
              const n = transliterateName(c, overlay);
              if (n !== null) return n;
              if (!/\s/.test(c) && /[A-Za-z]/.test(c) && /[0-9]/.test(c)) {
                return transliterateRef(c, overlay);
              }
              // Multi-word colliery-history cells translate + split into lines
              // — the multi-line shape belongs to the PREVIOUS-colliery column
              // (current-place cells stay inline, as the references do).
              if (/\s/.test(c)) return refineCollieryCell(c, ci === 3, overlay);
              return c;
            })
            .join(" | "),
        ),
      );
      continue;
    }

    // File / reference numbers: CPF/118/… → सीपीएफ/118/… (digits, separators
    // and roman numerals stay untouched; lines already in Devanagari pass).
    if (isCodeRefLine(trimmed) || CODE_LINE.test(trimmed)) {
      out.push(/[A-Za-z]/.test(trimmed) ? transliterateRef(trimmed, overlay) : line);
      continue;
    }

    // Parenthesized names — the signature block: (Ajay Kumar Singh) → (अजय
    // कुमार सिंह). A known term/place inside the parens ("(Jharkhand)" —
    // the To-block state line) translates via the term pass FIRST, so it
    // reads झारखंड instead of a letter-by-letter transliteration (झरखंड);
    // names never hit the term pass and fall through to transliterateName.
    if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(1, -1);
      if (!inner.includes("(") && !inner.includes(")")) {
        const term = hindiTranslateLine(inner, overlay);
        if (term !== null) {
          out.push(`(${term})`);
          continue;
        }
        const t = transliterateName(inner, overlay);
        if (t !== null) {
          out.push(`(${t})`);
          continue;
        }
      }
    }
    // "(Ajay Kumar Singh)   Regional Commissioner - I" / "( Apurva
    // Kr.Pathak ) Assistant Commissioner - ( R -1 )" — the signed name and
    // the designation share one source baseline (the L.C.-REQ letters and
    // the office note set it so), with OCR spaces inside the parens and an
    // optional parenthesized region-code tail. Split into the reference's
    // closing lines: (नाम) / पदनाम / (क्षेत्र-कोड).
    const sigSplit =
      trimmed.match(/^\(\s*([^()]+?)\s*\)\s+([^()]{2,60}?)\s*\(\s*([^()]+?)\s*\)\s*$/) ??
      trimmed.match(/^\(\s*([^()]+?)\s*\)\s+([^()]{2,60})$/);
    if (sigSplit) {
      const t = transliterateName(sigSplit[1], overlay);
      if (t !== null) {
        out.push(`(${t})`);
        const desig = hindiTranslateLine(sigSplit[2].trim(), overlay) ?? sigSplit[2].trim();
        if (sigSplit[3] !== undefined) {
          // "R -1" → "आर-1" — the region code tail reads with the tight
          // hyphen, exactly the reference letters' (आर-1) shape.
          const region = sigSplit[3].trim().replace(/\s*[-–—]\s*/g, "-");
          const r = hindiTranslateLine(region, overlay) ?? transliterateRef(region, overlay);
          out.push(`${desig} (${r})`);
        } else {
          out.push(desig);
        }
        continue;
      }
    }

    // Common formal-letter closings ("Thanking you", "With thanks", etc.)
    // are prose, not names — translate them properly before the name
    // transliterator can phonetically mangle them.
    if (/^[a-z\s,]+$/i.test(trimmed)) {
      const t = hindiTranslateLine(trimmed, overlay);
      if (t !== null && /[\u0900-\u097F]/.test(t)) {
        out.push(t);
        continue;
      }
    }
    // Whole-line names (To-block, lists): Shri Bhaskar Kumar Sinha → श्री भास्कर कुमार सिन्हा.
    const n = transliterateName(trimmed, overlay);
    if (n !== null) {
      // Inside the recipient block, a name line takes the reference comma
      // like any other address line (श्री भास्कर कुमार सिन्हा,).
      const inTo = inBlock[i] !== undefined && i < inBlock[i] - 1;
      out.push(inTo ? `${n},` : n);
      continue;
    }

    // Pure Latin prose lines get the full phrase+term translation pass.
    // Mixed Devanagari+Latin lines get the refine pass to clean remnants.
    if (!/[\u0900-\u097F]/.test(trimmed) && /[A-Za-z]/.test(trimmed)) {
      const t = hindiTranslateLine(trimmed, overlay);
      out.push(t !== null ? t : tidyDevLine(hindiRefineLine(line, overlay)));
    } else {
      out.push(tidyDevLine(hindiRefineLine(line, overlay)));
    }
  }
  // Context-aware "I" pronoun conversion in the finalize pass:
  // Standalone "I" at sentence boundaries (start, after comma/space)
  // is converted to "मैं". But "I" after a dash (Roman numeral) is preserved.
  let result = out.join("\n");
  result = result.replace(/(^|[\s,;(])I\b(?!\s*$)/g, "$1मैं");
  result = result.replace(/[-]\s*मैं(?=[,\s\u0964]|$)/g, (m) => m.replace("मैं", "I"));
  return result;
}

/**
 * Reference-standard line tidying for Devanagari output: the stray space
 * before a comma ("धनबाद , डी-II" → "धनबाद, डी-II") and the spaces inside
 * parentheses ("धनबाद ( झारखंड )" → "धनबाद (झारखंड)", "(एक  संख्या )" →
 * "(एक संख्या)") that the source DOCX fragments carry. Punctuation-only and
 * Latin lines pass through untouched.
 */
function tidyDevLine(line: string): string {
  if (!/[\u0900-\u097F]/.test(line)) return line;
  return line
    // DOCX text layers often carry double spaces between words — collapse
    // them so the Hindi output reads clean ("कोयला  खान" → "कोयला खान").
    .replace(/  +/g, " ")
    .replace(/([^\s]),/g, "$1,")
    .replace(/(\S)\s+,/g, "$1,")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
}

/** Short → full month-name map — the MONTHS table is keyed by full names
 * (january, december); the stint captures may be short ("Dec", "Jan") and
 * "Des" is the scanned "Dec". */
const MONTH_FULL: Record<string, string> = {
  jan: "january", feb: "february", mar: "march", apr: "april", may: "may",
  jun: "june", jul: "july", aug: "august", sep: "september", oct: "october",
  nov: "november", dec: "december", des: "december",
};

/**
 * English stint ranges inside a colliery-history cell. The "From … to …"
 * form keeps its parens ("(20.04.2015 से 05.06.2025 तक)" — the Khandra /
 * Bankola references); the bare "… To …" form reads अवधि: without parens
 * ("अवधि: 01.08.2007 से 19.05.2023 तक" — the Bahula reference).
 */
const FROM_STINT_RE =
  /\(?\bfrom\s+(\d{1,2})[-/.]?(\d{1,2})[-/.]?(\d{2,4})\s+to\s+(\d{1,2})[-/.]?(\d{1,2})[-/.]?(\d{2,4})\b\)?/gi;
const TO_STINT_RE =
  /\(?\b(\d{1,2})[-/.]?(\d{1,2})[-/.]?(\d{2,4})\s+to\s*(\d{1,2})[-/.]?(\d{1,2})[-/.]?(\d{2,4})\b\)?/gi;

/** A translated stint range line — parenthesized or the अवधि: form. */
const STINT_LINE_RE =
  /(अवधि:\s*\d{1,2}\.\d{1,2}\.\d{2,4}\s+से\s+\d{1,2}\.\d{1,2}\.\d{2,4}\s+तक|\(\d{1,2}\.\d{1,2}\.\d{2,4}\s+से\s+\d{1,2}\.\d{1,2}\.\d{2,4}\s+तक\))/g;

/** Parenthesized organization codes that close a colliery history cell. */
const ORG_PAREN_RE =
  /\(\s*(?:ईसीएल|बीसीसीएल|डब्ल्यूसीएल|एमसीएल|एसईसीएल|सीएमपीएफ|सीसीएल)\s*\)/;

/**
 * Split + translate a member-table colliery cell into the reference's shape:
 * "Bahula Colliery,(RNJ/31) (01-08-2007 To 19-05-2023) (ECL)" → "बहुला
 * कोलियरी (आरएनजे/31)" / "अवधि: 01.08.2007 से 19.05.2023 तक" / "(ईसीएल)".
 * The multi-line shape belongs to the PREVIOUS-colliery column (`splitLines`,
 * the references split stints and org codes there) — current-place cells
 * stay inline ("गौरी ओपनकास्ट माइन नं.1, एनजीपी/59 (डब्ल्यूसीएल)"). Also
 * strips the "Please acknowledge…" fragment scanned tables fuse into the
 * last cell (the template renders that sentence itself) and repairs OCR
 * artifacts ("No.1NGP/59" → "नं.1, एनजीपी/59", "AHQ ., Bankola ," →
 * "एएचक्यू, ईसीएल").
 */
function refineCollieryCell(cell: string, splitLines = false, overlay?: GlossaryOverlay): string {
  let s = cell.trim();
  if (s.length === 0) return s;
  // "TLHR/10Please acknowledge the receipt of the above at the earliest." —
  // the acknowledgement sentence fused into the last table cell is the
  // template's own कृपया paragraph; drop it from the cell.
  s = s.replace(/(\S)Please acknowledge[\s\S]*$/i, "$1");
  // "Period- 08.01.2000 to 31-05-2012" / "Periods -22.05.2013 to14.03.2020"
  // / "Period: June 2017 to May 2023" — the stinted-period label is the
  // अवधि form's English twin (dash OR colon separator); drop it so the
  // stint renders once (अवधि: …).
  s = s.replace(/\bperiods?\s*[:—-]*\s*/gi, "");
  // OCR repairs from the scanned cells: "OCO" is the scanned "OCP" and
  // "And Area" a fragment of "Area" (Lakhanpur OCO, And Area, SBP/11).
  s = s.replace(/\bOCO\b/gi, "OCP").replace(/\bAnd\s+Area\b/gi, "Area");

  const latin = /[A-Za-z]/.test(s) || /\bto\b/i.test(s);
  if (latin) {
    // Month.year stints ("3/2018 To 3/2021", "03/16 to 3/20", "08.2006 to
    // 04.2022") — the posting-history columns carry month/year only (the
    // 2-digit years are the scanned "MM/YY" form). Runs BEFORE the full
    // date stints so "3/2018" never mangles into 3.20.18. The source
    // separator is kept. The boundary guards stop a full-date range
    // ("07/06/2023 to 22/05/2024") from matching as month/year — the
    // month/year group must not be glued inside a bigger date.
    s = s.replace(
      /(?<![-/.]\d)(\d{1,2})([-/.])(\d{2,4})\s+to\s*(\d{1,2})([-/.])(\d{2,4})\b(?![-/.]\d)/gi,
      (_m, a, s1, b, d, s2, e) => `अवधि: ${a}${s1}${b} से ${d}${s2}${e} तक`,
    );
    // Month-name stints ("Sep - 2007 to Des 2012", "Dec-2014 to Jun-2022",
    // "June 2017 to May 2023", "april-2000 toapril-2007" — the OCR-fused
    // "to" glues to the next month) — the month reads in Devanagari,
    // exactly the अवधि: shape of the numeric form. "Des" is the scanned
    // "Dec".
    s = s.replace(
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Des)\s*-?\s*(\d{4})\s+to\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Des)\s*-?\s*(\d{4})\b/gi,
      (_m, a, ay, b, by) => {
        // The MONTHS table is keyed by FULL names (january, december); the
        // capture may be short ("Dec", "Jan") or full ("December"), and
        // "Des" is the scanned "Dec" — normalize before the lookup so the
        // month reads in Devanagari instead of falling back to Latin.
        const m1 = MONTHS[MONTH_FULL[a.toLowerCase()] ?? a.toLowerCase()] ?? a;
        const m2 = MONTHS[MONTH_FULL[b.toLowerCase()] ?? b.toLowerCase()] ?? b;
        return `अवधि: ${m1} ${ay} से ${m2} ${by} तक`;
      },
    );
    // Open-ended stints: "From 01.9.2016" (still working — no end date)
    // reads 01.9.2016 से, and "08-06-2012 To Till Date" reads अवधि: 08.06.2012
    // से अब तक. Runs BEFORE the paired stint rules (the lookahead guards the
    // "From … to …" pairs from being halved).
    s = s.replace(
      /\bfrom\s+(\d{1,2})[-/.]?(\d{1,2})[-/.]?(\d{2,4})\b(?!\s+to\b)/gi,
      (_m, a, b, c) => `${a}.${b}.${c} से`,
    );
    s = s.replace(
      /\(?\b(\d{1,2})[-/.]?(\d{1,2})[-/.]?(\d{2,4})\s+(?:to)\s*(?:till\s+)?date\b\)?/gi,
      (_m, a, b, c) => `अवधि: ${a}.${b}.${c} से अब तक`,
    );
    // "From … to …" stints keep their parens; the bare "To" form (the
    // CMPFO "01-08-2007 To 19-05-2023" shape) becomes the अवधि: line.
    s = s.replace(FROM_STINT_RE, (_m, a, b, c, d, e, f) => `(${a}.${b}.${c} से ${d}.${e}.${f} तक)`);
    s = s.replace(TO_STINT_RE, (_m, a, b, c, d, e, f) => `अवधि: ${a}.${b}.${c} से ${d}.${e}.${f} तक`);
    // "(WCL)." → "(WCL)"; "No.1NGP/59" → "नं.1, एनजीपी/59" (the mine
    // number fuses with the site code in scanned tables).
    s = s.replace(/\)\.$/, ")").replace(/No\.\s*(\d+)(?=[A-Z][A-Z0-9/])/gi, "नं.$1, ");
    // "59(WCL)" → "59 (WCL)" — the recovery pass fuses a parenthesized org
    // code onto the site code; the space lets the org translate on its own.
    s = s.replace(/([A-Za-z0-9/])\(/g, "$1 (");
    // "(RNJ/38)अवधि: …" → "(RNJ/38) अवधि: …" — a parenthesized code glued
    // to the stint tail gets its space so each part translates on its own.
    s = s.replace(/\)(?=\S)/g, ") ");
    // Codes in parens — spaces tolerated inside ("( WCL )", "(RNJ/38,40)"
    // — the comma reads एवं in the code transliterator): "(RNJ/31)" →
    // "(आरएनजे/31)". A NAME/PLACE group inside the parens ("(Bhowra
    // Area)") translates via the term pass first (भोवरा क्षेत्र) — the code
    // transliterator would letter-mangle it (भोवरा अरे); codes that the
    // term pass cannot cover fall back to the code transliterator.
    s = s.replace(
      /\(\s*([A-Za-z][A-Za-z0-9/,.\- ]*?)\s*\)/g,
      (_m, inner: string) => {
        const core = inner.trim();
        // All-caps inners are codes/abbreviations ("(WCL)", "(RNJ/31)",
        // "(SECL)") — the code transliterator owns them (डब्ल्यूसीएल,
        // आरएनजे/31, एसईसीएल); the term pass would letter-mangle them
        // (वकल). Mixed-case inners are name/place groups ("(Bhowra
        // Area)") → भोवरा क्षेत्र.
        if (/^[A-Z0-9/.\-, ]+$/.test(core)) {
          return `(${transliterateRef(core, overlay)})`;
        }
        const term = hindiTranslateLine(core, overlay, true);
        return `(${term ?? transliterateRef(core, overlay)})`;
      },
    );
    // "कोलियरी,(आरएनजे/31)" → "कोलियरी (आरएनजे/31)" — the account rides on
    // its own space, exactly as the reference letters set it. Runs BEFORE the
    // token translation so the comma doesn't break the "Colliery" token match.
    s = s.replace(/,(?=\s*\()/g, " ");
    // Colliery-name tokens ("Bahula Colliery" → "बहुला कोलियरी"). The
    // `allowNames` fallback transliterates proper nouns the dictionary has
    // not seen (Bagdewa, Umrer, AKK…) without ever touching function words.
    const translated = hindiTranslateLine(s, overlay, true);
    if (translated !== null) s = translated;
  }
  // OCR tidies for both fresh and already-translated cells: "AHQ ., Bankola"
  // → "AHQ, Bankola", the leftover double comma, and the repeated area word
  // ("बांकोला एएचक्यू, बांकोला, ईसीएल" → "बांकोला एएचक्यू, ईसीएल").
  s = s
    .replace(/\s*\.\s*,/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/^(\S+)\s+(.*?)\s+\1,\s*/, "$1 $2 ")
    .trim();
  if (!splitLines) return s;
  // Normalize every visual boundary to its own line: stints, parenthesized
  // org codes, and a bare org riding after an account code ("(आरएनजे/38)
  // ईसीएल"). The colliery name keeps its account code attached.
  s = s
    .replace(STINT_LINE_RE, "\n$1\n")
    .replace(ORG_PAREN_RE, "\n$&\n")
    .replace(/(\([^()]+\))\s+(ईसीएल|बीसीसीएल|डब्ल्यूसीएल|एमसीएल|एसईसीएल|सीसीएल)(?=\s|$)/g, "$1\n$2");
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * A dual English+Hindi document: the user pastes the English letter and its
 * Hindi translation into one file (the "(HINDI)" letters do this). The
 * English letter runs first, then a full Devanagari twin. Translating the
 * whole thing would mangle the Devanagari half (its spaces are often lost),
 * so when a complete Hindi letter follows the English one, the Hindi
 * duplicate is cut and only the English part is translated — which yields
 * the same clean Hindi as a fresh English-only upload.
 */
function stripTrailingHindiDup(text: string): string {
  const lines = text.split("\n");
  const firstEnglishCode = lines.findIndex((l) => /^cpf\s*\/\s*\d/i.test(l.replace(/\s+/g, "")));
  if (firstEnglishCode === -1 || firstEnglishCode >= lines.length - 4) return text;
  for (let i = firstEnglishCode + 1; i < lines.length; i++) {
    if (!lines[i].includes("सीपीएफ")) continue;
    const rest = lines.slice(i).join("\n");
    // The Hindi half must be a complete letter (opener, address, salutation,
    // closing) — a stray Devanagari line inside an English letter never cuts.
    if (/सेवा/.test(rest) && /महोदय/.test(rest) && /भवदीय/.test(rest)) {
      return lines.slice(0, i).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
  }
  return text;
}

/**
 * The app-facing translator: identical to the base `translateAdaptive`, but
 * Hindi output additionally gets the reference-standard transliteration pass
 * (file numbers, account codes, member and signature names in Devanagari, and
 * the merged file-number + date header line), and every output gets the
 * letterhead re-applied from the source so the header is byte-identical.
 */
export function translateAdaptive(
  doc: AdaptiveDoc,
  opts: AdaptiveOptions,
  overlay?: GlossaryOverlay,
): RatedTranslateResult {
  // Dual English+Hindi uploads translate only the English part (see above).
  const single = doc.text ? { ...doc, text: stripTrailingHindiDup(doc.text) } : doc;
  // Recover the line structure PDF/OCR extraction loses (glued words, a
  // collapsed "To," block, fused sentences, lost table pipes) before the
  // line-based rules run — the letterhead below is still re-applied from the
  // ORIGINAL source text, byte-identical.
  const recovered = single.text
    ? { ...single, text: recoverLineStructure(single.text) }
    : single;
  let result = baseTranslateAdaptive(recovered, opts, overlay);
  // Intelligent reference-standard gate — not a blunt language check: Hindi
  // letters get the Devanagari script-standard pass always; letters from a
  // known CMPFO family additionally get the full reference shaping.
  if (referenceDecision(doc.text ?? "", opts.language) !== "none") {
    result = { ...result, content: referenceStandardPass(result.content, overlay) };
  }
  // Second pass: localize bare table headers and translate fully-covered
  // pipe-less cells; drop the "kept in the source language" note when
  // nothing is left, otherwise keep an honest count.
  const refined = recoverCells(result.content, opts.language, overlay);
  // Per-letter translator rating — the intelligent reference-standard decision
  // (CMPFO family detection on the ORIGINAL source text) plus the completion
  // grade, so every letter is rated before it ships.
  // THE GUARANTEE (adaptive tier — zero AI keys required): gate the final
  // artifact and finish any residual English prose line with the
  // deterministic floor (phonetic Devanagari), so a Hindi letter can NEVER
  // ship with an English line — failure is not an option. When the floor
  // clears everything, the base engine's "kept in the source language" note
  // is dropped because the document is now fully in the target script.
  const finalContent = reapplyLetterhead(refined.content, doc.text ?? "");
  const cutLines = finalContent.split("\n");
  const cut = letterheadCutIndex(cutLines);
  const start = cut > 0 && cut < cutLines.length ? cut : 0;
  const finalPass = ensureComplete(
    finalContent,
    opts.language,
    start,
    (lines) => sweepLeftoverLines(lines, opts.language, overlay),
  );
  // THE GUARANTEE on the shipped bytes: when the gate passes, the base
  // engine's "kept in the source language" note is stripped wherever it sits
  // (after reapplyLetterhead the note is no longer at position 0 — a
  // position-anchored strip silently shipped it before).
  const shipped = finalPass.complete
    ? finalPass.content.replace(/(^|\n)— [^\n]*kept in the source language[^\n]*\n?/g, "$1")
    : finalPass.content;
  // Collapse double spaces from DOCX text layers.
  const shippedClean = shipped.replace(/  +/g, " ");
  // Per-letter translator rating — the intelligent reference-standard decision
  // (CMPFO family detection on the ORIGINAL source text) plus the final
  // completion grade from the gate, so every letter is rated before it ships.
  const rated = rateTranslation({
    sourceText: doc.text ?? "",
    complete: finalPass.complete,
    language: opts.language,
  });
  return {
    ...result,
    content: shippedClean,
    complete: finalPass.complete,
    rating: rated.rating,
    ratingNote: rated.note,
    ratingScore: rated.score,
  };
}
