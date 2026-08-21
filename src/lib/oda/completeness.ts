// ODA COMPLETENESS — the shared gate that makes "failure is not an option"
// enforceable. This module has NO imports: every engine (the neural
// orchestrator in neuralTranslate.ts, the adaptive wrapper in refine.ts, the
// cloud action, the on-device forge, the CI forge) uses the SAME flag
// heuristics and the SAME splice/ensure helpers, so a line the gate flags in
// one engine is flagged in every engine, and a line the deterministic floor
// fixes is fixed everywhere identically.

// ---------------------------------------------------------------------------
// Completeness gate
// ---------------------------------------------------------------------------

/** Target-script detector per language — the gate's primary signal. */
const SCRIPT_RE: Record<string, RegExp> = {
  Hindi: /[\u0900-\u097F]/,
  Marathi: /[\u0900-\u097F]/,
  Sanskrit: /[\u0900-\u097F]/,
  Tamil: /[\u0B80-\u0BFF]/,
  Bengali: /[\u0980-\u09FF]/,
  Telugu: /[\u0C00-\u0C7F]/,
  Kannada: /[\u0C80-\u0CFF]/,
  Gujarati: /[\u0A80-\u0AFF]/,
  Malayalam: /[\u0D00-\u0D7F]/,
  Punjabi: /[\u0A00-\u0A7F]/,
  Odia: /[\u0B00-\u0B7F]/,
  Urdu: /[\u0600-\u06FF]/,
  Arabic: /[\u0600-\u06FF]/,
  Persian: /[\u0600-\u06FF]/,
  Russian: /[\u0400-\u04FF]/,
  Chinese: /[\u4E00-\u9FFF]/,
  Japanese: /[\u3040-\u30FF\u4E00-\u9FFF]/,
  Korean: /[\uAC00-\uD7AF]/,
};

/**
 * High-frequency English function words AND the official-correspondence nouns
 * that dominate untranslated CMPF prose. A line scoring ≥ 3 of these (with at
 * least 4 words) is prose the engine left in the source language.
 */
const PROSE_HINT = new Set([
  "the", "of", "and", "to", "in", "is", "are", "was", "were", "for", "with",
  "on", "at", "this", "that", "your", "our", "their", "his", "her", "shall",
  "will", "have", "has", "had", "been", "being", "from", "as", "by", "or",
  "if", "be", "it", "its", "not", "you", "we", "may", "kindly", "please",
  "under", "above", "below", "following", "member", "office", "region",
  "card", "period", "working", "forwarded", "ensured", "posting",
  "contribution", "contributing", "jurisdiction", "duly", "completed",
  "hereby", "therefore", "requested", "request", "supply", "forwarding",
  "reference", "subject", "dated", "letter", "stated", "inform", "informed",
  "intimated", "accordance", "respect", "said", "undermentioned",
  // Table-cell and mixed-script remnant vocabulary (the 7-ALL OLD LETTER
  // corpus): table headers and stint cells the cell passes must translate.
  "name", "company", "colly", "colliery", "project", "area", "till",
  "date", "desired", "statement", "extract", "receipt", "enclosed",
  "herewith", "ledger", "worked", "currently", "available", "placed",
  "kind", "seen", "prepared", "authenticated", "submitted", "accordingly",
  "forwarding", "january", "february", "march", "april", "june", "july",
  "august", "september", "october", "november", "december", "jan", "feb",
  "sir", "yours", "faithfully", "thank", "thanking", "dear", "madam",
  "application", "certificate", "transfer", "school", "college",
  "manager", "director", "officer", "request", "issue", "father",
  "city", "state", "district", "mine", "office", "region",
  "pension", "employee", "retirement", "salary", "promotion",
  "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
]);

export interface CompletenessResult {
  complete: boolean;
  /** Genuine untranslated prose lines (each trimmed, ≤ 300 chars). */
  untranslated: string[];
}

/**
 * Lowercase Latin word runs inside a Devanagari line that are NOT glued to
 * digits (codes) — the mixed-script remnant signal ("…एल.सी. in our
 * आउट…", "…off ice पत्र…", "…, Sri Mahamood Miya, सीएमपीएफ…"). A
 * capitalized word is a name/org word the reference pass owns separately;
 * one stray lowercase word (a code letter like "b" in "'B' Colliery")
 * never trips the gate.
 */
function hasMixedRemnants(t: string): boolean {
  let count = 0;
  const re = /[A-Za-z]{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const w = m[0];
    if (!/[a-z]/.test(w)) continue; // ALL-CAPS run — code/abbreviation
    const before = t[m.index - 1] ?? "";
    const after = t[m.index + w.length] ?? "";
    if (/[0-9]/.test(before) || /[0-9]/.test(after)) continue; // glued to digits — code
    count += 1;
    if (count >= 2) return true;
  }
  return false;
}

/**
 * A table-cell remnant: a pure-Latin prose cell ("Name of the Company",
 * "april-2000 toapril-2007") or a mixed-script cell with Latin remnants —
 * the cell passes must finish them. Data cells (member names, account
 * codes, dates) never flag.
 */
function isTableCellProse(c: string, script: RegExp): boolean {
  if (script.test(c)) return hasMixedRemnants(c);
  if (c.length < 8 || c.length > 300) return false;
  if (!/[a-z]/.test(c)) return false;
  if (/^[0-9A-Z/.,:()\-\s]+$/.test(c)) return false; // pure code/data cell
  const words = c.split(/[^A-Za-z]+/).filter((w) => w.length >= 2);
  if (words.length < 2) return false;
  const hints = words.filter((w) =>
    PROSE_HINT.has(w.toLowerCase().replace(/^(from|to|till)/, "")),
  ).length;
  return hints >= 2;
}

/** Lines that are data, not prose — never counted as untranslated. */
function isDataLine(t: string): boolean {
  if (/\S+@\S+/.test(t)) return true; // email-carrying lines
  if (/^(add(ress)?|e-?mail|phone|fax|tel|www|website)\b/i.test(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^[\d.,/:\-–()\s]+$/.test(t)) return true; // pure numbers/codes
  // File-number style codes (CPF/59, RNJ/31) are data — but all-caps
  // address/header lines like "EMBASSY OF INDIA" need translation.
  if (/^[A-Z]{2,}\/[A-Z0-9]{1,5}$/.test(t)) return true;
  if (/^sl\.?\s*no/i.test(t)) return true;
  if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(t)) return true; // a date line
  if (/^(no\.?|ref\.?|file\s*no\.?|letter\s*no\.?)\s*[:#-]/i.test(t)) return true;
  return false;
}

/** True when the line looks like untranslated English prose. */
function isEnglishProse(t: string, script: RegExp): boolean {
  if (script.test(t)) return false;
  // Short Latin lines in Hindi documents are still prose that needs
  // translation ("Thanking you,", "Yours faithfully,", "CC:").
  // Only skip ALL-CAPS data/headers and single-character lines.
  if (t.length < 2 || t.length > 600) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 1) return false;
  if (!/[a-z]/.test(t)) return false; // ALL-CAPS data/headers — never prose
  // Proper-noun-heavy lines (recipient names, org blocks) are data the
  // reference pass localizes separately — at least 60% capital-initial words.
  const caps = words.filter((w) => /^[A-Z]/.test(w)).length;
  // Only skip truly proper-noun-dense lines (85%+ caps) that have NO
  // lowercase function words. "The Director," has lowercase letters in "The"
  // and should be translated; "Dilip Kumar Panda" has no lowercase and can
  // be skipped as a name block.
  if (caps / words.length >= 0.85 && !/[a-z]/.test(t)) return false;
  // Short lines (≤ 3 words) with no prose hints are likely labels/data —
  // skip them.  Longer lines need prose hints to be flagged.
  if (words.length < 4) {
    const hints = words.filter((w) => PROSE_HINT.has(w.replace(/[.,;:()]+$/, "").toLowerCase())).length;
    return hints >= 1;
  }
  const hints = words.filter((w) => PROSE_HINT.has(w.replace(/[.,;:()]+$/, "").toLowerCase())).length;
  return hints >= 3;
}

/**
 * The completeness gate. Scans `content` from `startLine` (the caller passes
 * the first line below the letterhead — 0 when there is none) for genuine
 * prose left in the source script — names, codes, numbers, addresses, table
 * rows and already-translated lines never count. Targets with a distinct
 * script (Hindi, Tamil, …) are gated strictly; Latin-script targets have no
 * reliable signal and always pass (segmentation already bounds every model
 * call, so truncation cannot silently happen there).
 */
export function estimateCompleteness(
  content: string,
  language: string,
  startLine = 0,
): CompletenessResult {
  const script = SCRIPT_RE[language] ?? SCRIPT_RE[language.trim()];
  if (!script) return { complete: true, untranslated: [] };
  const lines = content.split("\n");
  const start = Math.max(0, Math.min(startLine, lines.length));
  const untranslated: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.length === 0) continue;
    // Table rows: the cell/header passes own the cells, so a row is gated
    // cell by cell — Latin prose remnants inside a cell flag exactly like
    // standalone lines (the old gate skipped every pipe line entirely, which
    // let "Name of the Company" and stint cells ship untranslated). The
    // WHOLE row is the flagged unit so the deterministic floor can splice it.
    if (t.includes("|")) {
      for (const cell of t.split("|")) {
        const c = cell.trim();
        if (c.length > 0 && isTableCellProse(c, script)) {
          untranslated.push(t);
          break;
        }
      }
      continue;
    }
    if (isDataLine(t)) continue;
    if (isEnglishProse(t, script)) {
      untranslated.push(t);
      continue;
    }
    // Mixed-script remnant: a Devanagari line that still carries lowercase
    // Latin words is half-translated — the reference pass must finish it
    // ("…एल.सी. in our आउट…" → "…एल.सी. इन-आउट…").
    if (script.test(t) && hasMixedRemnants(t)) {
      untranslated.push(t);
    }
  }
  return { complete: untranslated.length === 0, untranslated };
}

// ---------------------------------------------------------------------------
// Line splice + the guarantee helper
// ---------------------------------------------------------------------------

/**
 * Splice per-line replacements back into a document. Each pair matches the
 * gate's reported slice (a trimmed line, ≤ 300 chars) against the document's
 * own lines; the FIRST exact match is replaced with the new text. Lines that
 * cannot be matched are left untouched (they stay flagged — honest).
 */
export function spliceLines(
  content: string,
  replacements: Array<{ match: string; replacement: string }>,
): string {
  const lines = content.split("\n");
  for (const { match, replacement } of replacements) {
    const idx = lines.findIndex((l) => l.trim() === match || l.trim().startsWith(match));
    if (idx !== -1) lines[idx] = replacement;
  }
  return lines.join("\n");
}

/**
 * The final guarantee, runnable on ANY artifact: gate the content (from
 * `startLine`, the first line below the letterhead); if lines are still
 * flagged, pass them through the deterministic floor and splice the results
 * in. Returns the finished content, the honest completion grade and the
 * swept-line count — so an English prose line can NEVER ship.
 */
export function ensureComplete(
  content: string,
  language: string,
  startLine: number,
  sweepLeftovers?: (lines: string[]) => string[],
): { content: string; complete: boolean; swept: number; untranslated: string[] } {
  let gate = estimateCompleteness(content, language, startLine);
  let swept = 0;
  if (!gate.complete && gate.untranslated.length > 0 && sweepLeftovers) {
    const replaced = sweepLeftovers(gate.untranslated);
    const pairs = gate.untranslated
      .map((line, i) => {
        const r = replaced[i];
        if (!r || r === line) return null;
        return { match: line, replacement: r };
      })
      .filter((p): p is { match: string; replacement: string } => p !== null);
    if (pairs.length > 0) {
      content = spliceLines(content, pairs);
      swept = pairs.length;
    }
    gate = estimateCompleteness(content, language, startLine);
  }
  return { content, complete: gate.complete, swept, untranslated: gate.untranslated };
}
