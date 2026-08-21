// Scan a folder of Hindi translation outputs for quality gaps:
// 1. Latin word remnants inside Devanagari lines (mixed-script prose).
// 2. Pure-Latin prose lines.
// Usage: bun scripts/_scan-remnants.ts [dir]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "/tmp/old-out2";
const files = readdirSync(dir).filter((f) => f.endsWith(".hi.txt")).sort();
const latinWords = (t: string) =>
  t.split(/[^A-Za-z]+/).filter((w) => /^[a-z][a-z']*$/i.test(w) && w.length >= 3);
const CODEISH = /^([A-Z]{1,3}|[A-Z][A-Z0-9\/.\-]+)$/;

const filesWith = new Map<string, string[]>();
let pureLatinCount = 0;
let filesPure = new Set<string>();

for (const f of files) {
  const content = readFileSync(join(dir, f), "utf8");
  const lines = content.split("\n");
  const hits: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.length === 0) continue;
    if (/[\u0900-\u097F]/.test(t)) {
      // Mixed-script: Devanagari line with lowercase Latin words that aren't
      // single codes/abbreviations.
      const words = latinWords(t).filter((w) => !CODEISH.test(w));
      const real = words.filter((w) => /[a-z]{2}/.test(w) && !/^[A-Z]{2,}$/.test(w));
      if (real.length >= 1) hits.push(t.slice(0, 200));
    } else if (/[a-z]{4}/.test(t) && t.split(/\s+/).length >= 4) {
      pureLatinCount++;
      filesPure.add(f);
    }
  }
  if (hits.length > 0) filesWith.set(f, hits.slice(0, 8));
}

console.log(`Files with mixed-script remnants: ${filesWith.size} / ${files.length}`);
let i = 0;
for (const [f, hits] of [...filesWith.entries()].sort()) {
  i++;
  console.log(`\n== [${i}] ${f} (${hits.length}+ lines)`);
  for (const h of hits.slice(0, 4)) console.log("   " + h);
}
console.log(`\nPure-Latin prose lines: ${pureLatinCount} across ${filesPure.size} file(s)`);
