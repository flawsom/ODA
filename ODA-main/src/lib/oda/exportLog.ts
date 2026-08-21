// src/lib/oda/exportLog.ts
//
// Lightweight, in-memory export-decision log surfaced in the Dispatch
// Forge's "Export debug" panel: which track was used, which template
// matched (if any), and why a Track B attempt fell back to Track A.
// Keep this dependency-free (no Convex import) so it works even for
// signed-out, fully client-side exports.

export interface ExportDecision {
  path: "track-a" | "track-b" | "track-b-failed";
  templateId?: string;
  rowCount?: number;
  /** Shrink-to-fit tier chosen for a Track B render (10/9/8). */
  fontSizePt?: number;
  /** True when the floor tier still isn't expected to fit on one page. */
  possibleOverflow?: boolean;
  error?: string;
  timestamp?: number;
}

const log: ExportDecision[] = [];
const MAX_ENTRIES = 50;

export function logExportDecision(decision: Omit<ExportDecision, "timestamp">): void {
  log.push({ ...decision, timestamp: Date.now() });
  if (log.length > MAX_ENTRIES) log.shift();
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[oda:export]", decision);
  }
}

export function getExportLog(): readonly ExportDecision[] {
  return log;
}

export function clearExportLog(): void {
  log.length = 0;
}
