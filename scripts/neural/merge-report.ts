#!/usr/bin/env bun
/**
 * ODA NEURAL FORGE — REPORT MERGER.
 *
 * The CI workflow runs the forge as a matrix of batches (each writes its own
 * results.json under a part-<offset>/ directory). This script walks the
 * combined output tree, merges every batch's results and writes one
 * REPORT.md + merged results.json for the whole run.
 *
 * Usage:
 *   bun scripts/neural/merge-report.ts --dir letters/out/neural
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const DIR = flag("dir", "letters/out/neural");

interface LetterResult {
  file: string;
  format: string;
  extractedChars: number;
  engine: "neural" | "adaptive";
  translate: {
    complete: boolean;
    rating: string;
    ratingNote: string;
    ratingScore: number;
    chars: number;
    untranslatedLatinWords: number;
  } | null;
  response: { chars: number } | null;
  error?: string;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (entry === "results.json") out.push(p);
  }
}

const files: string[] = [];
walk(DIR, files);
const results: LetterResult[] = [];
for (const f of files) {
  try {
    const batch = JSON.parse(readFileSync(f, "utf8")) as LetterResult[];
    results.push(...batch);
  } catch {
    // skip unreadable batch files
  }
}
results.sort((a, b) => a.file.localeCompare(b.file));

const neural = results.filter((r) => r.engine === "neural").length;
const adaptive = results.filter((r) => r.engine === "adaptive").length;
const complete = results.filter((r) => r.translate?.complete).length;
const incomplete = results.filter((r) => r.translate && !r.translate.complete).length;
const extractFail = results.filter((r) => r.error === "EXTRACT-FAILED").length;

const lines: string[] = [];
lines.push("# ODA Neural Forge Report — full batch");
lines.push("");
lines.push(`- **Letters:** ${results.length} (${extractFail} extraction failures)`);
lines.push(`- **Engines:** neural × ${neural} · adaptive × ${adaptive}`);
lines.push(`- **Translations:** ${complete} complete · ${incomplete} incomplete`);
lines.push(`- **Pipeline:** app extraction → glossary training memory → neural/adaptive translation → reference-standard pass → per-letter rating`);
lines.push("");
lines.push("| Letter | Format | Chars | Engine | Hindi | Rating | Untranslated | Response |");
lines.push("|---|---|---|---|---|---|---|---|");
for (const r of results) {
  const tr = r.translate;
  lines.push(
    `| ${r.file} | ${r.format} | ${r.extractedChars} | ${r.engine} | ${tr ? (tr.complete ? "✅" : "❌") : "—"} | ${tr ? `${tr.rating} (${tr.ratingScore})` : "—"} | ${tr ? tr.untranslatedLatinWords : "—"} | ${r.response && r.response.chars > 0 ? "✅" : "❌"} |`,
  );
}
lines.push("");
lines.push(`- Complete: ${complete}/${results.length} · neural: ${neural} · adaptive: ${adaptive}`);
if (incomplete > 0) {
  lines.push(`- Incomplete: ${results.filter((r) => r.translate && !r.translate.complete).map((r) => r.file).join("; ")}`);
}
lines.push("");
lines.push("_Merged by scripts/neural/merge-report.ts — free neural forge on GitHub Actions._");
writeFileSync(join(DIR, "REPORT.md"), lines.join("\n"));
writeFileSync(join(DIR, "results.json"), JSON.stringify(results, null, 2));
console.log(`Merged ${results.length} results → ${join(DIR, "REPORT.md")}`);
