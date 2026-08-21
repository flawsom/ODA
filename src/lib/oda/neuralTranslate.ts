// ODA SEGMENTED TRANSLATION — the never-truncated, never-partial neural path.
//
// Every neural engine (the cloud action in src/convex/generate.ts, the
// on-device forge in localForge.ts, the CI batch forge) used to translate the
// whole document in ONE model call with a fixed output budget. Long documents
// hit the output cap mid-sentence and shipped a partial translation — the
// exact failure the fidelity PRD forbids.
//
// This module is the shared guarantee every engine now runs:
//   1. `chunkSource` splits the document into paragraph-aligned segments that
//      fit the model's output budget, so no document is ever truncated.
//   2. `translateDocumentFully` translates each segment, strips a re-echoed
//      letterhead from later segments, and stitches them back together.
//   3. `estimateCompleteness` gates the result: it counts genuine English
//      prose lines left below the letterhead (names, codes, numbers, address
//      lines and already-translated lines are never false positives).
//   4. REPEAT UNTIL DONE: the gate drives an escalating repair loop — each
//      segment is re-asked for its leftover lines round after round, the
//      stitched whole gets a full re-translate then line-only splice repairs
//      (a numbered reply that cannot truncate), and whatever the model still
//      misses goes through the deterministic floor (`sweepLeftovers`) so an
//      English prose line can NEVER ship. Failure is not an option: the
//      output is fully in the target script or honestly marked partial.
//
// The result is a translation that is COMPLETE or honestly marked partial —
// never silently half-done, whatever the document length.

import {
  buildLineRepairPrompt,
  buildRetryPrompt,
  buildSegmentPrompt,
  buildUserPrompt,
  TRANSLATE_SYSTEM,
  type NeuralPromptInput,
} from "./neuralPrompts";
import { letterheadCutIndex } from "./refine";
import {
  ensureComplete as sharedEnsureComplete,
  estimateCompleteness as sharedEstimateCompleteness,
  spliceLines as sharedSpliceLines,
  type CompletenessResult,
} from "./completeness";

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/**
 * Split a document into paragraph-aligned segments, each ≤ `maxChars`
 * characters. Blank lines are preferred boundaries so paragraphs (and table
 * rows) never split mid-line; a single over-long line overflows its own chunk
 * rather than being cut. The letterhead naturally rides in segment 0.
 */
export function chunkSource(text: string, maxChars = 12000): string[] {
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let cur: string[] = [];
  let curLen = 0;
  // A paragraph boundary is worth starting a new chunk once this much is
  // already buffered (keeps chunks reasonably full without splitting early).
  const paraMin = Math.min(2400, Math.floor(maxChars * 0.4));
  const flush = () => {
    if (cur.length > 0) {
      chunks.push(cur.join("\n"));
      cur = [];
      curLen = 0;
    }
  };
  for (const line of lines) {
    const blank = line.trim().length === 0;
    if (blank) {
      if (cur.length > 0 && curLen >= paraMin) flush();
      continue;
    }
    if (curLen + line.length + 1 > maxChars && cur.length > 0) flush();
    cur.push(line);
    curLen += line.length + 1;
  }
  flush();
  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Drop everything above the first structural line of a segment's output — a
 * model that re-echoes the document letterhead at the top of a later segment
 * would otherwise duplicate the header in the stitched translation.
 */
export function stripLeadingLetterhead(content: string): string {
  const lines = content.split("\n");
  const cut = letterheadCutIndex(lines);
  if (cut <= 0 || cut >= lines.length) return content.trim();
  return lines
    .slice(cut)
    .join("\n")
    .replace(/^\n+/, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Completeness gate
//
// The gate's heuristics live in ./completeness (shared with the adaptive
// wrapper so every engine flags — and fixes — the same lines). This module
// keeps the public estimateCompleteness/ensureComplete/spliceLines API and
// computes the letterhead cut through ./refine's letterheadCutIndex.
// ---------------------------------------------------------------------------

/**
 * The completeness gate. Scans everything below the letterhead for genuine
 * prose left in the source script — names, codes, numbers, addresses, table
 * rows and already-translated lines never count. Targets with a distinct
 * script (Hindi, Tamil, …) are gated strictly; Latin-script targets have no
 * reliable signal and always pass (the model handles them without truncation
 * now that segments bound every call).
 */
export function estimateCompleteness(content: string, language: string): CompletenessResult {
  const lines = content.split("\n");
  const cut = letterheadCutIndex(lines);
  // The letterhead cut is only skipped when a real structural line was found
  // (0 < cut < lines.length); a letterhead-less segment scans from line 0 —
  // otherwise a document with no header would gate as complete by scanning
  // nothing at all.
  const start = cut > 0 && cut < lines.length ? cut : 0;
  return sharedEstimateCompleteness(content, language, start);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface FullTranslateOptions {
  /** Max characters per segment (default 12000). */
  chunkSize?: number;
  /**
   * Repair rounds per segment (default 3). Each round is pinned to exactly
   * the lines the gate still flags, and only accepted when it shrinks the
   * leftover set — a model that keeps missing one line is re-asked for that
   * line, not for the whole segment again.
   */
  maxRetries?: number;
  /**
   * Escalating whole-document repair rounds (default 3). Round 1 re-asks for
   * the FULL corrected document pinned to the leftover lines; rounds 2+ use
   * the line-only repair prompt (numbered, tiny output — impossible to
   * truncate) whose answers are spliced back into the best draft.
   */
  maxWholeRounds?: number;
  language: string;
  /**
   * The deterministic floor — the absolute guarantee. Called with every line
   * the gate STILL flags after all neural rounds; whatever it returns is
   * spliced into the document. When it converts lines to the target script
   * (e.g. phonetic Devanagari), the document can never ship with English
   * prose: failure is not an option. Return a line unchanged to leave it
   * flagged (the result is then honestly `complete: false`).
   */
  sweepLeftovers?: (lines: string[]) => string[];
}

export interface FullTranslateResult {
  content: string;
  complete: boolean;
  /** Number of segments the document was split into. */
  chunks: number;
  /** How many neural repair passes actually replaced output. */
  retried: number;
  /** How many lines were finished by the deterministic floor. */
  swept: number;
  /** Leftover untranslated lines (empty when complete). */
  untranslated: string[];
}

/**
 * Parse a numbered repair answer ("1. …", "2) …") into ordered strings.
 * Returns null when fewer answers than requested arrived — a truncated reply
 * must never corrupt the document.
 */
function parseNumberedAnswers(raw: string, expected: number): string[] | null {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    const m = t.match(/^\d{1,3}[.)]\s*(.*)$/);
    if (!m) continue;
    const v = m[1].trim();
    if (v.length > 0) out.push(v);
    if (out.length >= expected) break;
  }
  return out.length === expected ? out : null;
}

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
  return sharedSpliceLines(content, replacements);
}

/**
 * Run one escalating whole-document repair round: round 0 re-asks for the
 * full corrected document; later rounds ask for ONLY the leftover lines
 * (numbered) and splice the answers back — the tiny output cannot truncate,
 * and a weak model only needs to handle the few lines it missed.
 */
async function wholeDocumentRepairRound(
  input: NeuralPromptInput,
  content: string,
  gate: CompletenessResult,
  round: number,
  language: string,
  callProvider: (system: string, user: string) => Promise<string>,
): Promise<{ content: string; gate: CompletenessResult } | null> {
  if (gate.complete || gate.untranslated.length === 0) return null;
  if (round === 0) {
    const whole = (await callProvider(TRANSLATE_SYSTEM, buildRetryPrompt(input, gate.untranslated))).trim();
    const wholeGate = estimateCompleteness(whole, language);
    const usable = wholeGate.untranslated.length < gate.untranslated.length && whole.length >= content.length * 0.5;
    return usable ? { content: whole, gate: wholeGate } : null;
  }
  const answers = await callProvider(TRANSLATE_SYSTEM, buildLineRepairPrompt(input, gate.untranslated));
  const parsed = parseNumberedAnswers(answers, gate.untranslated.length);
  if (!parsed) return null;
  const spliced = spliceLines(
    content,
    gate.untranslated.map((line, i) => ({ match: line, replacement: parsed[i] })),
  );
  const splicedGate = estimateCompleteness(spliced, language);
  return splicedGate.untranslated.length < gate.untranslated.length
    ? { content: spliced, gate: splicedGate }
    : null;
}

/**
 * The final guarantee, runnable on ANY artifact (callers re-run it after
 * their deterministic post-passes so the promise holds on the shipped
 * bytes): gate the content; if lines are still flagged, pass them through
 * the deterministic floor and splice the results in. Returns the finished
 * content, the honest completion grade and the swept-line count.
 */
export function ensureComplete(
  content: string,
  language: string,
  sweepLeftovers?: (lines: string[]) => string[],
): { content: string; complete: boolean; swept: number; untranslated: string[] } {
  const lines = content.split("\n");
  const cut = letterheadCutIndex(lines);
  const start = cut > 0 && cut < lines.length ? cut : 0;
  return sharedEnsureComplete(content, language, start, sweepLeftovers);
}

/**
 * Translate a document of ANY length through a provider — fully, segment by
 * segment, with a completeness gate and a REPEAT-UNTIL-DONE repair loop:
 *   • each segment is repaired round by round, pinned to its leftover lines;
 *   • the stitched whole gets escalating whole-document rounds (full
 *     re-translate, then line-only splice repair — impossible to truncate);
 *   • whatever the gate STILL flags after every neural round goes through the
 *     deterministic floor (`sweepLeftovers`), so an English prose line can
 *     never ship. `complete` is true exactly when the final gate passes.
 * `callProvider` receives the shared system prompt and a fully-built user
 * prompt and must return the model's raw output. The caller applies the
 * deterministic post-passes (glossary enforcement, reference-standard pass,
 * letterhead reapply) afterwards — and should re-run `ensureComplete` after
 * them so the guarantee holds on the final bytes.
 */
export async function translateDocumentFully(
  input: NeuralPromptInput,
  callProvider: (system: string, user: string) => Promise<string>,
  opts: FullTranslateOptions,
): Promise<FullTranslateResult> {
  const chunkSize = opts.chunkSize ?? 12000;
  const maxRetries = opts.maxRetries ?? 3;
  const maxWholeRounds = opts.maxWholeRounds ?? 3;
  const chunks = chunkSource(input.sourceText, chunkSize);
  const outputs: string[] = [];
  let retried = 0;

  for (let i = 0; i < chunks.length; i++) {
    const segment: NeuralPromptInput = { ...input, sourceText: chunks[i] };
    const prompt =
      i === 0
        ? buildUserPrompt(segment)
        : buildSegmentPrompt(segment, i + 1, chunks.length);
    let draft = (await callProvider(TRANSLATE_SYSTEM, prompt)).trim();
    if (i > 0) draft = stripLeadingLetterhead(draft);
    let gate = estimateCompleteness(draft, opts.language);
    // Per-segment repair loop: each round is pinned to exactly the lines the
    // gate still flags, and only accepted when it shrinks the leftover set.
    for (let r = 0; r < maxRetries && !gate.complete && gate.untranslated.length > 0; r++) {
      const retriedDraft = (await callProvider(TRANSLATE_SYSTEM, buildRetryPrompt(segment, gate.untranslated))).trim();
      const retriedGate = estimateCompleteness(retriedDraft, opts.language);
      if (retriedGate.untranslated.length < gate.untranslated.length) {
        draft = retriedDraft;
        gate = retriedGate;
        retried += 1;
      }
    }
    outputs.push(draft);
  }

  let content = outputs.join("\n\n");
  let gate = estimateCompleteness(content, opts.language);
  // Escalating whole-document repair rounds: full re-translate first, then
  // line-only splice repairs (a different strategy — a rejected full retry
  // must NOT stop the line repair from getting its chance). Keep going until
  // the gate passes or every round is exhausted; never accept a round that
  // leaves MORE lines behind.
  for (let r = 0; r < maxWholeRounds && !gate.complete; r++) {
    const repaired = await wholeDocumentRepairRound(input, content, gate, r, opts.language, callProvider);
    if (!repaired) continue;
    content = repaired.content;
    gate = repaired.gate;
    retried += 1;
  }

  // The deterministic floor — the absolute guarantee. Whatever the neural
  // model could not finish is converted to the target script so nothing
  // ships in the source language.
  const final = ensureComplete(content, opts.language, opts.sweepLeftovers);

  return {
    content: final.content,
    complete: final.complete,
    chunks: chunks.length,
    retried,
    swept: final.swept,
    untranslated: final.untranslated,
  };
}
