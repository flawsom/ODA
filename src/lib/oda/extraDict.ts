// Glossary overlay — the user-grown translation memory.
//
// The seed pack (glossary.ts) is compiled into the engine, but coverage must
// grow WITHOUT code changes: the Glossary page stores new sentence and token
// rows in the Convex `glossaryEntries` table, and the engine merges them over
// the seed at translation time through a `GlossaryOverlay`. Custom entries are
// consulted FIRST everywhere (phrase matching, word tokens, abbreviations,
// reference codes, name transliteration, table headers), so an entry with the
// same source as a seed row cleanly overrides it. When no overlay is present
// the engine behaves exactly as before — every overlay parameter is optional.

import type { GlossaryEntry } from "./glossary";

/** Token tables a custom row can extend, mirroring the seed consts. */
export const TOKEN_TABLES = [
  "HI_TOKENS", // English word → Devanagari (address blocks, designations, cells)
  "HI_PHRASES", // regex → replacement, applied inside hindiTranslateLine
  "HI_ABBR", // abbreviation whose trailing period becomes a comma (HQ., Coll.)
  "REF_TOKENS", // code fragment → Devanagari (CPF → सीपीएफ, L.C. → एल.सी.)
  "NAME_TABLE", // person name (lowercase) → Devanagari
  "TABLE_HEADERS", // table header phrase → Hindi
] as const;

export type TokenTableName = (typeof TOKEN_TABLES)[number];

/** Engine shape of a stored glossary row (mirrors the Convex table). */
export interface GlossaryRow {
  kind: "sentence" | "token";
  table?: string;
  en: string;
  hi?: string;
  tr?: Record<string, string>;
}

export interface GlossaryOverlay {
  /** Custom sentence-dictionary rows (all carry `tr`; matched before seed). */
  sentences: GlossaryEntry[];
  HI_TOKENS: Record<string, string>;
  HI_PHRASES: Array<[string, string]>;
  HI_ABBR: Set<string>;
  REF_TOKENS: Record<string, string>;
  NAME_TABLE: Record<string, string>;
  TABLE_HEADERS: Record<string, Record<string, string>>;
}

export function emptyOverlay(): GlossaryOverlay {
  return {
    sentences: [],
    HI_TOKENS: {},
    HI_PHRASES: [],
    HI_ABBR: new Set(),
    REF_TOKENS: {},
    NAME_TABLE: {},
    TABLE_HEADERS: {},
  };
}

/** Convert stored rows into the merged overlay the engine consults. */
export function buildOverlay(rows: GlossaryRow[] | null | undefined): GlossaryOverlay {
  const overlay = emptyOverlay();
  for (const row of rows ?? []) {
    const en = row.en?.trim();
    if (!en) continue;
    if (row.kind === "sentence") {
      const tr = row.tr && Object.keys(row.tr).length > 0 ? row.tr : row.hi?.trim() ? { Hindi: row.hi.trim() } : null;
      if (tr) overlay.sentences.push({ en, tr });
      continue;
    }
    const value = row.hi?.trim();
    switch (row.table) {
      case "HI_TOKENS":
        if (value) overlay.HI_TOKENS[en.toLowerCase()] = value;
        break;
      case "HI_PHRASES":
        if (value) overlay.HI_PHRASES.push([en, value]);
        break;
      case "HI_ABBR":
        overlay.HI_ABBR.add(en.toLowerCase());
        break;
      case "REF_TOKENS":
        if (value) overlay.REF_TOKENS[en.toLowerCase()] = value;
        break;
      case "NAME_TABLE":
        if (value) overlay.NAME_TABLE[en.toLowerCase()] = value;
        break;
      case "TABLE_HEADERS":
        if (value) overlay.TABLE_HEADERS[en.toLowerCase()] = { Hindi: value };
        break;
    }
  }
  return overlay;
}

// ---------------------------------------------------------------------------
// NEURAL LIFT — the glossary as training memory for the neural forge.
//
// The glossary is the user's confidential translation memory. Two levers make
// every neural engine inherit it:
//   1. `glossaryPromptBlock` — a compact constraint block injected into the
//      LLM prompt: the model MUST use these exact translations. Sorted
//      longest-source-first and capped, so it costs a handful of tokens.
//   2. `enforceGlossary` — a deterministic post-pass that catches whatever
//      the model ignored (untranslated leftovers), so custom entries always
//      win no matter which engine produced the text.
// ---------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The language-key lookup used by sentence rows ("Hindi", "Tamil", …). */
function pickTranslation(
  tr: Record<string, string> | undefined,
  language: string,
): string | null {
  if (!tr) return null;
  const hit = tr[language] ?? tr[language.toLowerCase()];
  if (typeof hit === "string" && hit.trim().length > 0) return hit.trim();
  return null;
}

/**
 * The custom-sentence rows the user grew on the Glossary page, filtered to
 * the target language, longest source first (most specific wins in prompts).
 */
export function glossarySentences(
  overlay: GlossaryOverlay,
  language: string,
): Array<{ en: string; tr: string }> {
  return overlay.sentences
    .map((s) => {
      const tr = pickTranslation(s.tr, language);
      const en = s.en?.trim();
      if (!en || !tr || tr === en || en.length < 4) return null;
      return { en, tr };
    })
    .filter((s): s is { en: string; tr: string } => s !== null)
    .sort((a, b) => b.en.length - a.en.length);
}

/**
 * A compact constraint block for the LLM prompt. When the user has grown a
 * glossary, the neural forge is "trained" on it: the model must use these
 * exact translations. Capped (longest first) so an ever-growing glossary
 * never inflates the token bill — the deterministic pass covers the rest.
 */
export function glossaryPromptBlock(overlay: GlossaryOverlay, language: string): string {
  const isHindi = /hindi/i.test(language);
  const parts: string[] = [];

  const sentences = glossarySentences(overlay, language).slice(0, 40);
  if (sentences.length > 0) {
    parts.push(
      "CUSTOM SENTENCE TRANSLATIONS (authoritative — use these EXACT translations when the sentence or its meaning appears; they override any other choice):",
      ...sentences.map((s) => `- "${s.en}" → "${s.tr}"`),
    );
  }

  if (isHindi) {
    const tokenRows: Array<[string, string]> = [
      ...Object.entries(overlay.HI_TOKENS),
      ...Object.entries(overlay.NAME_TABLE),
      ...Object.entries(overlay.REF_TOKENS),
      ...Object.entries(overlay.TABLE_HEADERS).map(([k, v]) => [k, v.Hindi ?? ""] as [string, string]),
    ].filter(([en, hi]) => en && hi && en.length >= 2);
    if (tokenRows.length > 0) {
      parts.push(
        "CUSTOM HINDI TERMS (authoritative — use these EXACT Devanagari forms for these terms, names and codes):",
        ...tokenRows
          .sort((a, b) => b[0].length - a[0].length)
          .slice(0, 60)
          .map(([en, hi]) => `- ${en} → ${hi}`),
      );
    }
  }

  if (parts.length === 0) return "";
  return `\n${parts.join("\n")}\n`;
}

/**
 * Deterministic enforcement pass on any engine's output: custom glossary
 * entries that the model left untranslated (or translated differently) are
 * rewritten to the user's exact forms. Runs after AI output so the user's
 * translation memory always wins — the neural "training" guarantee.
 */
export function enforceGlossary(
  content: string,
  overlay: GlossaryOverlay,
  language: string,
): string {
  let out = content;
  const isHindi = /hindi/i.test(language);

  // Sentences: replace verbatim leftovers (case-insensitive), longest first.
  for (const { en, tr } of glossarySentences(overlay, language)) {
    out = out.replace(new RegExp(escapeRegExp(en), "gi"), tr);
  }

  if (!isHindi) return out;

  // Word-boundary tokens: custom Devanagari forms for terms, names, codes.
  const tokenRows: Array<[string, string]> = [
    ...Object.entries(overlay.HI_TOKENS),
    ...Object.entries(overlay.NAME_TABLE),
    ...Object.entries(overlay.REF_TOKENS),
    ...Object.entries(overlay.TABLE_HEADERS).map(([k, v]) => [k, v.Hindi ?? ""] as [string, string]),
  ].filter(([en, hi]) => en && hi && en.length >= 2);
  for (const [en, hi] of tokenRows) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(en)}\\b`, "gi"), hi);
  }

  return out;
}
