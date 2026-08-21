// Hit tracking for glossary entries — which translation-memory rows actually
// fire while documents are translated.
//
// The engine records a hit every time a glossary-driven rule translates text
// (sentence-dictionary phrase, HI_TOKENS word, HI_PHRASES regex, HI_ABBR
// abbreviation, REF_TOKENS code fragment, NAME_TABLE name, TABLE_HEADERS
// header). Counts are kept in the browser (localStorage) so they work in
// every mode — the on-device instant engine, DOCX export, and seed-only
// deployments. The Convex forge runs server-side and is not tracked here.
//
// The Glossary page subscribes to the same module and shows the counts per
// entry. Keys are `scope::key` where scope is the token table name (or
// "sentence") and key is the entry's source (phrase template, token, regex
// source, abbreviation, code fragment, name, header phrase).

export type HitScope =
  | "sentence"
  | "HI_TOKENS"
  | "HI_PHRASES"
  | "HI_ABBR"
  | "REF_TOKENS"
  | "NAME_TABLE"
  | "TABLE_HEADERS";

const STORAGE_KEY = "oda-glossary-hits-v1";
const SEP = "::";

const counts = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;
let lastPersist = 0;

function load(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, number>;
    for (const [k, n] of Object.entries(parsed)) {
      if (typeof n === "number" && n > 0) counts.set(k, n);
    }
  } catch {
    // Corrupt/oversized storage — start fresh this session.
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(counts)));
  } catch {
    // Storage full / private mode — hits stay in-memory for the session.
  }
}

function notify(): void {
  version++;
  for (const l of listeners) l();
}

/** Record that a glossary entry translated something. Called from the engine's
 * match sites; cheap (one Map set + throttled localStorage write). */
export function trackHit(scope: HitScope, key: string, n = 1): void {
  if (!key) return;
  const k = scope + SEP + key;
  counts.set(k, (counts.get(k) ?? 0) + n);
  const now = Date.now();
  if (now - lastPersist > 200) {
    lastPersist = now;
    persist();
  }
  notify();
}

export function hitCount(scope: HitScope, key: string): number {
  return counts.get(scope + SEP + key) ?? 0;
}

/** All counts as `scope::key` → number. */
export function getHitCounts(): Record<string, number> {
  return Object.fromEntries(counts);
}

/** Wipe every count (local browser-only reset). */
export function clearHits(): void {
  counts.clear();
  persist();
  notify();
}

export function getHitsVersion(): number {
  return version;
}

export function subscribeHits(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

load();
