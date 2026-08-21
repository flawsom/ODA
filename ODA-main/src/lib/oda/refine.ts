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
  kitName,
} from "./translate";
import { kitFor, type AdaptiveDoc, type AdaptiveOptions } from "./adaptive";
import { recoverCells, recoverLineStructure } from "./recover";
import { PLACES } from "./glossary";
import type { GlossaryOverlay } from "./extraDict";

export type { TranslateResult } from "./translate";

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
  return /[A-Z]{2,}/.test(value) && !/\s[a-z]{2,}\s/i.test(value);
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
      // A Devanagari file-number opener ("संख्या आरएनजे/31-1512/2026")
      // ends the letterhead just like its English twin — the code after the
      // label may itself be Devanagari (आरएनजे), not just Latin.
      /^[\u0900-\u097F]{2,}\s+[\u0900-\u097FA-Z0-9]{2,}\/\d/.test(t) ||
      // A Devanagari label + LATIN code whose run carries slashes
      // ("संख्या KU/ADMIN/2026/412" — the university notice): the run above
      // only matches when the first slash is followed by a digit
      // (डीईपीटी/42-…), so a code with a letter after its first slash
      // (KU/ADMIN/…) would leave the whole header treated as letterhead.
      /^[\u0900-\u097F]{2,}\s+[A-Z][\u0900-\u097FA-Z0-9.\/-]{1,}\/\d/.test(t)
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
  let s = replaceKnownTerms(line);
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
      return t !== null && /[\u0900-\u097F]/.test(t) ? t : group;
    },
  );
  s = s.replace(
    /(^|[\s(,;:])([A-Za-z][A-Za-z0-9/.\-]*[0-9][A-Za-z0-9/.\-]*)(?=[\s),;:।]|$)/g,
    (m, lead: string, tok: string) => `${lead}${transliterateRef(tok, overlay)}`,
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

    // Recipient address block: every line but the block's last gets the
    // reference comma unless it already ends with punctuation/digit or carries
    // its own comma/label. Lines are tidied first (fully-covered Latin lines
    // read in Hindi, stray OCR spaces collapse, label colons and the PIN get
    // canonical spacing) so the comma rule — and the DOCX renderer's own
    // pass — see the same clean line.
    if (inBlock[i] !== undefined && i < inBlock[i] - 1) {
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
      out.push(toBlockComma(t) ? t.replace(/\s*$/, "") + "," : t);
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

    // Parenthesized names — the signature block: (Ajay Kumar Singh) → (अजय कुमार सिंह).
    if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
      const inner = trimmed.slice(1, -1);
      if (!inner.includes("(") && !inner.includes(")")) {
        const t = transliterateName(inner, overlay);
        if (t !== null) {
          out.push(`(${t})`);
          continue;
        }
      }
    }
    // "(Ajay Kumar Singh)   Regional Commissioner - I" — the signed name and
    // the designation share one source baseline (the L.C.-REQ letters set it
    // so). Split them into the reference's two closing lines.
    const sigSplit = trimmed.match(/^\(([^()]+)\)\s+([^()]{2,60})$/);
    if (sigSplit) {
      const t = transliterateName(sigSplit[1], overlay);
      if (t !== null) {
        out.push(`(${t})`);
        out.push(hindiTranslateLine(sigSplit[2], overlay) ?? sigSplit[2]);
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

    // Devanagari refine for phrase output that still carries Latin names/codes.
    out.push(tidyDevLine(hindiRefineLine(line, overlay)));
  }
  return out.join("\n");
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
    .replace(/([^\s]),/g, "$1,")
    .replace(/(\S)\s+,/g, "$1,")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
}

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
  // — the stinted-period label is the अवधि form's English twin; drop it so
  // the stint renders once (अवधि: …).
  s = s.replace(/\bperiods?\s*-+\s*/gi, "");

  const latin = /[A-Za-z]/.test(s) || /\bto\b/i.test(s);
  if (latin) {
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
    // Codes in parens: "(RNJ/31)" → "(आरएनजे/31)".
    s = s.replace(
      /\(([A-Za-z][A-Za-z0-9/.\- ]*?)\)/g,
      (_m, inner: string) => `(${transliterateRef(inner.trim(), overlay)})`,
    );
    // "कोलियरी,(आरएनजे/31)" → "कोलियरी (आरएनजे/31)" — the account rides on
    // its own space, exactly as the reference letters set it. Runs BEFORE the
    // token translation so the comma doesn't break the "Colliery" token match.
    s = s.replace(/,(?=\s*\()/g, " ");
    // Colliery-name tokens ("Bahula Colliery" → "बहुला कोलियरी") all-or-nothing.
    const translated = hindiTranslateLine(s, overlay);
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
): ReturnType<typeof baseTranslateAdaptive> {
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
  if (kitName(kitFor(opts.language)) === "Hindi") {
    result = { ...result, content: referenceStandardPass(result.content, overlay) };
  }
  // Second pass: localize bare table headers and translate fully-covered
  // pipe-less cells; drop the "kept in the source language" note when
  // nothing is left, otherwise keep an honest count.
  const refined = recoverCells(result.content, opts.language, overlay);
  return {
    ...result,
    content: reapplyLetterhead(refined.content, doc.text ?? ""),
    complete: refined.complete,
  };
}
