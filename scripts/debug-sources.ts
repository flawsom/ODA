#!/usr/bin/env bun
/** Debug: print source text lines (2+ Latin words) of letters still failing. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { parseDocx } from "../src/lib/oda/docxparse.ts";
import { parseDoc } from "../src/lib/oda/docparse.ts";

const INBOX = "letters/8-ALL NEW LETTER";

const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(docx|doc)$/i.test(entry) && !entry.startsWith("~")) files.push(p);
  }
};
walk(INBOX);
files.sort();

const FAILING = process.argv[2] ? new Set(process.argv.slice(2).map((s) => s.toLowerCase())) : null;

async function extract(name: string, path: string): Promise<string> {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const ext = extname(name).toLowerCase();
  if (ext === ".docx") {
    const parsed = await parseDocx(ab);
    return parsed.supported ? parsed.text : "";
  }
  const parsed = parseDoc(ab);
  return parsed.supported ? parsed.text : "";
}

for (const file of files) {
  const rel = file.replace(INBOX, "").replace(/^[\\/]+/, "");
  if (FAILING && !FAILING.has(rel.toLowerCase())) continue;
  const text = await extract(basename(file), file);
  const lines = text.split(/\r?\n/);
  const flagged = lines
    .map((l) => l.trim())
    .filter((l) => {
      if (l.length === 0 || /[।]/.test(l) || /[१२३४५६७८९०]/.test(l)) return false;
      const words = l.match(/[A-Za-z]+/g) ?? [];
      if (words.length < 2) return false;
      const lower = l.toLowerCase();
      if (/^(cpf|rnj|ngp|tlhr|samb|dhn|asn|rmg|bkr|wcl|ecl|mcl|secl|secl|blp|r-i|r-ii|r-iii)/.test(lower)) return false;
      return true;
    });
  if (flagged.length > 0 || FAILING) {
    console.log(`\n========== ${rel} ==========`);
    for (const l of flagged) console.log(`  | ${l}`);
    if (!FAILING) continue;
    // when filtering, show all Latin-heavy lines incl. those skipped by heuristic
    const heavy = lines
      .map((l) => l.trim())
      .filter((l) => (l.match(/[A-Za-z]+/g) ?? []).length >= 2 && l.length > 0);
    console.log(`  -- all latin-heavy lines --`);
    for (const l of heavy) console.log(`  | ${l}`);
  }
}
