import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocx } from "../src/lib/oda/docxparse";
import { recoverLineStructure } from "../src/lib/oda/recover";

const dir = "/tmp/old-letters";
const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".docx")).sort();

// A line is prose if it looks like a body sentence (≥ 5 words, lowercase-heavy).
function isProseLine(t: string): boolean {
  if (t.length < 40) return false;
  if (/^[\d.,/:\-–()\s|]+$/.test(t)) return false;
  if (t.includes("|")) return false; // table rows
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 7) return false;
  const lower = (t.match(/[a-z]/g) ?? []).length;
  const upper = (t.match(/[A-Z]/g) ?? []).length;
  return lower >= 12 && lower > upper;
}

const clusters = new Map<string, { count: number; example: string; files: string[] }>();

for (const f of files) {
  const buf = readFileSync(join(dir, f));
  const r = await parseDocx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  if (!r.supported) continue;
  const recovered = recoverLineStructure(r.text);
  let letterhead = true;
  for (const raw of recovered.split("\n")) {
    const t = raw.trim();
    if (letterhead) {
      if (/^(date|dated|ref|reference|sub|subject|to[,:]?|sir[,:]?|no\.?|the\s+)/i.test(t) || /^[A-Z]{2,}\s*\/\s*[A-Z0-9]/.test(t)) letterhead = false;
      else continue;
    }
    if (!isProseLine(t)) continue;
    // Normalize digits/names to a pattern key so variants cluster.
    const key = t
      .replace(/\d+[./-]*\d*/g, "N")
      .replace(/\b[A-Z][A-Za-z]*\b/g, "W") // capitalized words
      .replace(/["'“”‘’,;:().\-–—]+/g, " ")
      .replace(/\s+/g, " ")
      .toLowerCase()
      .trim()
      .slice(0, 140);
    const c = clusters.get(key) ?? { count: 0, example: t.slice(0, 300), files: [] };
    c.count += 1;
    if (c.files.length < 5) c.files.push(f);
    clusters.set(key, c);
  }
}

console.log(`Distinct prose clusters: ${clusters.size}\n`);
let i = 0;
for (const [key, c] of [...clusters.entries()].sort((a, b) => b[1].count - a[1].count)) {
  i += 1;
  console.log(`--- [${i}] ×${c.count} :: ${key.slice(0, 110)}`);
  console.log(`    EX: ${c.example}`);
  console.log(`    IN: ${c.files.join("; ")}`);
}
