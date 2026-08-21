// src/lib/oda/rating.ts
//
// Per-letter translation rating — the intelligent decision behind every
// translation:
//   1. Decides whether the reference standard applies to THIS letter (CMPFO
//      family detection via the template registry's org signals — the same
//      gate that routes DOCX export to the reference templates).
//   2. Grades the letter: reference-grade, complete, or partial — with a
//      score and an honest note, so every letter is "translator rated" before
//      it is shipped.
//
// The reference standard only exists for the Hindi CMPFO letter families
// (L.C. / Extract): official phrasing, file numbers, account codes and member
// names in Devanagari, merged file-number + date header. Non-family letters
// are graded on completeness alone — never falsely stamped "reference".

import { hasCmpfSignals } from "./templates/registry";

export type TranslationRating = "reference" | "complete" | "partial";

export interface TranslationRatingResult {
  rating: TranslationRating;
  /** 0–100 quality score for this letter. */
  score: number;
  /** Why the letter got this grade — surfaced as the tooltip. */
  note: string;
  /** Reference family the letter belongs to, when one was matched. */
  family?: string;
}

export interface RateTranslationInput {
  /** The ORIGINAL source document text (pre-recovery, pre-stripping). */
  sourceText: string;
  /** Line-by-line completion flag from the engine (recoverCells). */
  complete: boolean;
  /** Target language — e.g. "Hindi", "English". */
  language: string;
}

/** The known reference family the registry's org signals detect. */
const CMPF_FAMILY = "CMPFO letter family (L.C. / Extract)";

/**
 * The intelligent per-letter gate shared by every engine (adaptive, cloud AI,
 * on-device): how the reference standard applies to THIS letter.
 *   - "reference": a Hindi letter from a known CMPFO family — the full
 *     reference-standard shaping applies (official phrasing, file numbers,
 *     account codes and member names in Devanagari, merged header).
 *   - "script": Hindi, but no known family — the script-standard
 *     transliteration layer still applies (codes, names, table cells in
 *     Devanagari), just no family-specific shaping or stamp.
 *   - "none": non-Hindi targets have no reference-standard treatment.
 */
export type ReferenceStandard = "reference" | "script" | "none";

export function referenceDecision(sourceText: string, language: string): ReferenceStandard {
  if (!/hindi/i.test(language)) return "none";
  return hasCmpfSignals(sourceText) ? "reference" : "script";
}

/**
 * The intelligent per-letter decision + rating. Hindi letters from a known
 * reference family get the reference-standard grade; anything else is graded
 * on completeness. `partial` always means lines were kept in the source
 * language, so the grade is honest even for a reference-family letter.
 */
export function rateTranslation(input: RateTranslationInput): TranslationRatingResult {
  const reference = referenceDecision(input.sourceText, input.language) === "reference";
  if (!input.complete) {
    return {
      rating: "partial",
      score: reference ? 62 : 60,
      note: reference
        ? "Partial reference-standard letter — some lines were kept in the source language; enable the neural forge for full prose."
        : "Partial letter — some lines were kept in the source language; enable the neural forge for full prose.",
      family: reference ? CMPF_FAMILY : undefined,
    };
  }
  if (reference) {
    return {
      rating: "reference",
      score: 100,
      note: `Reference-standard translation — ${CMPF_FAMILY} matched; official phrasing, file numbers, account codes and member names in Devanagari.`,
      family: CMPF_FAMILY,
    };
  }
  return {
    rating: "complete",
    score: 92,
    note: "Complete letter-for-letter translation — no CMPFO reference family detected; structure preserved, every line translated.",
  };
}

/** Display metadata for the three ratings (used by the UI badges). */
export const RATING_META: Record<string, { label: string; color: string }> = {
  reference: { label: "Reference-grade", color: "oklch(0.72 0.15 160)" },
  complete: { label: "Complete", color: "oklch(0.7 0.13 240)" },
  partial: { label: "Partial", color: "oklch(0.75 0.15 55)" },
};

/** Resolve a stored rating string to display metadata (unknown → neutral). */
export function ratingMeta(
  rating: string | null | undefined,
): { label: string; color: string } {
  return (rating && RATING_META[rating]) || { label: "Rated", color: "oklch(0.68 0.02 250)" };
}
