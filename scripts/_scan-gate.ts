// Scan a folder of Hindi translation outputs with the completeness gate.
// Usage: bun scripts/_scan-gate.ts [dir]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { estimateCompleteness } from "../src/lib/oda/completeness";

const dir = process.argv[2] ?? "/tmp/old-out";
const files = readdirSync(dir).filter((f) => f.endsWith(".hi.txt")).sort();
let total = 0;
const flagged: Array<{ file: string; lines: string[] }> = [];
for (const f of files) {
  const content = readFileSync(join(dir, f), "utf8");
  const res = estimateCompleteness(content, "Hindi");
  total++;
  if (!res.complete) flagged.push({ file: f, lines: res.untranslated });
}
console.log(`Files: ${total} | complete: ${total - flagged.length} | partial: ${flagged.length}`);
for (const { file, lines } of flagged) {
  console.log(`\n== ${file} (${lines.length} leftover)`);
  for (const l of lines.slice(0, 6)) console.log("   " + l.slice(0, 180));
}
