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
    .replace(/\bd\s+ated\b/gi, "dated")
    .replace(/\bth\s+e\b/gi, "the")
    .replace(/\bo ut\b/g, "out")
    // Dotted abbreviations with stray spaces ("L .C.-out", "B .B . College",
    // "P .S.-3") — squeeze so the abbreviation maps as ONE transliteration
    // token ("L.C." → "एल.सी."), never a half-Latin "एल .C." mix. Spaces
    // only (\s would swallow the line break after a sentence-final period),
    // and only when it is truly an abbreviation: a lowercase letter follows
    // ("e.g ."), or an uppercase letter that is NOT the start of a word
    // ("L . C ." — "C" followed by a non-letter; "Office. Further" — "F"
    // followed by a letter — is a sentence boundary and stays intact).
    .replace(/([A-Za-z])[ \t]*\.[ \t]*(?=[a-z]|[A-Z](?![a-zA-Z]))/g, "$1.");
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
    /([A-Z]{2,})[ \t]*(\/)[ \t]*(\d[\d \t]*)(?:[ \t]*(\/)[ \t]*(\d[\d \t]*))?(?:[ \t]*(\/)[ \t]*(\d[\d \t]*))?/g,
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
  s = s.replace(/(\d[\d \t]{0,3})[ \t]*\/[ \t]*(\d[\d \t]{1,4})\b/g, (_m, a, b) =>
    `${a.replace(/[ \t]+/g, "")}/${b.replace(/[ \t]+/g, "")}`,
  );
  // Code-dash-number fragments ("TLHR- 10", "RNJ- 21 & 14") — the code
  // stays Latin (transliterated later), only the spacing is repaired.
  s = s.replace(/([A-Z]{2,})[ \t]*-[ \t]*(\d[\d \t]*)/g, (_m, c, d) => `${c}-${squeezeDigits(d)}`);
  // "L.C. - o ut" → "L.C.-out" and "l .c.-out" → "L.C.-out": dotted
  // abbreviations glued to a hyphenated tail (out/in/req/request).
  s = s.replace(
    /([A-Za-z](?:\.[A-Za-z])+)[ \t]*-[ \t]*(out|in|req|request|out-in)/gi,
    (_m, abbr, tail) => `${abbr.toUpperCase()}-${tail.toLowerCase()}`,
  );
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
      // — never between digits, so amounts stay intact.
      let t = line.replace(/(?<!\d),(?=[A-Z])/g, ", ");
      t = t.replace(/,(?=\s*(?:and|&)\b)/gi, ",");
      // Glued words (lower→upper). Acronyms and codes have no lower→upper
      // runs, so they are never touched.
      t = t.replace(/([a-z])([A-Z])/g, "$1 $2");
      // A structural label glued to an address tail ("PIN-826014Sub :- …",
      // "…West BengalRef:- …"): the label must carry its ":"/"-", so ordinary
      // words (…addressSubject…) never split.
      t = t.replace(/([^\s:])(?=(?:Sub|Subject|Ref|विषय|संदर्भ)\s*[:-])/gi, "$1\n");
      // The collapsed To-block.
      t = splitToBlock(t);
      // Fused body sentences.
      t = splitFusedSentences(t);
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
    // completes a sentence ("…, IFSC" + "SBIN0001142).").
    const continuation =
      FUNC_WORD_END.test(t) ||
      /^[a-z]/.test(next) ||
      (t.length >= 60 && /[.!?।]$/.test(next));
    const firstWords = (s: string) => s.split(/\s+/).slice(0, 3).join(" ");
    const blocks =
      t.length === 0 ||
      next.length === 0 ||
      // A standalone "To" / "To," address label never joins the designation
      // line beneath it ("To" + "The Regional Commissioner" would otherwise
      // fuse into one untranslatable line — the joined form is exactly the
      // half-translated output the reference QA caught).
      /^to\s*[,:]?$/i.test(t) ||
      (LINE_END_BLOCK.test(t) && !ABBR_LINE_END.test(t)) ||
      t.includes("|") ||
      next.includes("|") ||
      WRAP_BLOCKER.test(next) ||
      next.length < 12 ||
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
  if (untranslated > 0) {
    const kit = kitFor(language);
    const note = `— ${kit.noteNeural} (${untranslated} line${untranslated === 1 ? "" : "s"} kept in the source language)`;
    const all = text.split("\n");
    const cut = letterheadCut(all);
    // The note sits immediately AFTER the first structural line (the file
    // number/date line), so the letterhead guarantee (`reapplyLetterhead` —
    // which owns everything ABOVE that line) can never drop it: the header
    // stays byte-identical and the honest count survives into the preview.
    // Exporters still strip it entirely (sanitize layer).
    if (cut > 0 && cut < all.length) {
      all.splice(cut + 1, 0, note);
      text = all.join("\n");
    } else {
      text = `${note}\n\n${text}`;
    }
  }
  return { content: text, complete: untranslated === 0 };
}
