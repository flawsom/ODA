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
