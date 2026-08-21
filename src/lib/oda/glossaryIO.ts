// Moving a translation memory between deployments.
//
// The Glossary page exports the user-grown (stored) entries — seed rows ship
// with the code, so only custom rows travel — and imports the same shape back
// into a fresh deployment. The two pure functions here power the page and are
// kept side-effect free so the round trip is testable headlessly.

export const GLOSSARY_EXPORT_FORMAT = "oda-glossary";

export interface GlossaryEntryExport {
  kind: "sentence" | "token";
  table?: string;
  en: string;
  hi?: string;
  tr?: Record<string, string>;
  enabled: boolean;
}

export interface GlossaryExportFile {
  format: "oda-glossary";
  version: 1;
  exportedAt: string;
  count: number;
  entries: GlossaryEntryExport[];
}

/** Shape of a row stored in the glossaryEntries table (Convex row minus ids). */
export interface StoredGlossaryRow {
  kind: string;
  table?: string | null;
  en: string;
  hi?: string | null;
  tr?: Record<string, string> | null;
  enabled?: boolean;
}

/** Canonical collision key for a stored row — sentence rows collide on the
 * source template, token rows on table + key. Case- and whitespace- insensitive
 * exactly like the engine's matchers, so "Sir," vs "sir," or "Kalinga" vs
 * "kalinga" in the same table would shadow each other and must be caught.
 * Shared by the import planner (idempotent re-import) and the Glossary page
 * (blocking a new custom row from shadowing an existing one). */
export function glossaryRowKey(row: {
  kind: string;
  table?: string | null;
  en: string;
}): string {
  return `${row.kind}|${row.table ?? ""}|${row.en.trim().toLowerCase()}`;
}

export function serializeGlossaryExport(rows: StoredGlossaryRow[]): GlossaryExportFile {
  return {
    format: GLOSSARY_EXPORT_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    count: rows.length,
    entries: rows.map((r) => ({
      kind: r.kind === "token" ? "token" : "sentence",
      table: r.table ?? undefined,
      en: r.en,
      hi: r.hi ?? undefined,
      tr: r.tr ?? undefined,
      enabled: r.enabled ?? true,
    })),
  };
}

/** Validate an uploaded JSON payload and plan which rows to insert.
 * Returns { ok: false, error } for a malformed file, otherwise the validated
 * rows with per-row invalid/duplicate entries counted in `skipped` — so
 * re-importing the same file is idempotent. */
export function planGlossaryImport(
  data: unknown,
  existing: StoredGlossaryRow[],
): { ok: boolean; error?: string; rows: GlossaryEntryExport[]; skipped: number } {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Not an ODA glossary export.", rows: [], skipped: 0 };
  }
  const d = data as { format?: unknown; entries?: unknown };
  if (d.format !== GLOSSARY_EXPORT_FORMAT || !Array.isArray(d.entries)) {
    return {
      ok: false,
      error: `Not an ODA glossary export — expected { format: "${GLOSSARY_EXPORT_FORMAT}", entries: [...] }.`,
      rows: [],
      skipped: 0,
    };
  }
  const present = new Set(existing.map(glossaryRowKey));
  const rows: GlossaryEntryExport[] = [];
  let skipped = 0;
  for (const e of d.entries) {
    const row = e as {
      kind?: unknown;
      table?: unknown;
      en?: unknown;
      hi?: unknown;
      tr?: unknown;
      enabled?: unknown;
    };
    if (!row || (row.kind !== "sentence" && row.kind !== "token")) {
      skipped++;
      continue;
    }
    const en = String(row.en ?? "").trim();
    if (!en) {
      skipped++;
      continue;
    }
    const key = glossaryRowKey({
      kind: row.kind,
      table: typeof row.table === "string" ? row.table : undefined,
      en,
    });
    if (present.has(key)) {
      skipped++;
      continue;
    }
    const tr =
      row.tr && typeof row.tr === "object"
        ? (Object.fromEntries(
            Object.entries(row.tr as Record<string, unknown>)
              .map(([k, v]) => [k, String(v).trim()] as const)
              .filter(([, v]) => v.length > 0),
          ) as Record<string, string>)
        : undefined;
    const hi = typeof row.hi === "string" ? row.hi : undefined;
    // Sentences need at least one translation; tokens need a value — except
    // HI_ABBR rows where the value is implicit (the trailing period becomes a
    // comma). Empty-value rows on other tables are no-ops to the engine
    // (extraDict's overlay skips them), so they're dropped here too.
    const hasTarget =
      row.kind === "sentence"
        ? Boolean(hi?.trim()) || (tr !== undefined && Object.keys(tr).length > 0)
        : Boolean(hi?.trim()) || row.table === "HI_ABBR";
    if (!hasTarget) {
      skipped++;
      continue;
    }
    rows.push({
      kind: row.kind,
      table: row.kind === "token" ? (typeof row.table === "string" ? row.table : "HI_TOKENS") : undefined,
      en,
      hi,
      tr: tr && Object.keys(tr).length > 0 ? tr : undefined,
      enabled: row.enabled !== false,
    });
    present.add(key);
  }
  return { ok: true, rows, skipped };
}
