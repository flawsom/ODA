// Group every phonetic-floor (dictionary-gap) line across outputs.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "/tmp/old-out";
const files = readdirSync(dir).filter((f) => f.endsWith(".hi.txt")).sort();

// Normalize a Devanagari line to a pattern key: keep Devanagari letters only.
function patternKey(t: string): string {
  return t
    .replace(/[^\u0900-\u097F]/g, "")
    .replace(/(\S)\1{2,}/g, "$1$1") // collapse 3+ repeats
    .slice(0, 120);
}

const groups = new Map<string, { count: number; examples: string[]; files: string[] }>();
const ENGLISH = /[a-z]/i;

for (const f of files) {
  const content = readFileSync(join(dir, f), "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!/[\u0900-\u097F]/.test(t) || !ENGLISH.test(t)) continue;
    if (t.length < 24) continue;
    // Heuristic: the floor's fingerprint is Devanagari mixed with many Latin
    // letters that are part of phonetic words (not codes/numbers).
    const latinWords = t.split(/[\s|]+/).filter((w) => /^[a-z][a-z']*$/i.test(w));
    if (latinWords.length < 3) continue;
    const key = patternKey(t);
    const g = groups.get(key) ?? { count: 0, examples: [], files: [] };
    g.count += 1;
    if (g.examples.length < 2) g.examples.push(t.slice(0, 180));
    if (g.files.length < 6) g.files.push(f);
    groups.set(key, g);
  }
}

console.log(`Distinct floored patterns: ${groups.size}\n`);
let i = 0;
for (const [key, g] of [...groups.entries()].sort((a, b) => b[1].count - a[1].count)) {
  i += 1;
  console.log(`--- [${i}] ×${g.count} ${g.files.join("; ")}`);
  for (const e of g.examples) console.log(`    ${e}`);
}
