#!/usr/bin/env node
/**
 * ODA Report Publisher — renders forge-reports/FORGE_REPORT.md (plus latest.json)
 * into a small themed static site at <out>/index.html for GitHub Pages.
 *
 * Usage: bun scripts/publish-report.mjs [--src forge-reports] [--out site]
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const SRC = flag("src", "forge-reports");
const OUT = flag("out", "site");

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\|/.test(line) && lines[i + 1] && /^\|[\s:|-]+$/.test(lines[i + 1])) {
      // Table block
      const header = line.split("|").map((c) => c.trim()).filter(Boolean);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i].split("|").map((c) => c.trim()).filter(Boolean));
        i += 1;
      }
      const th = header.map((h) => `<th>${esc(h)}</th>`).join("");
      const trs = rows
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
        .join("");
      out.push(`<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`);
      continue;
    }
    if (/^#\s/.test(line)) out.push(`<h1>${esc(line.replace(/^#\s/, ""))}</h1>`);
    else if (/^##\s/.test(line)) out.push(`<h2>${esc(line.replace(/^##\s/, ""))}</h2>`);
    else if (/^-\s/.test(line)) out.push(`<li>${esc(line.replace(/^-\s/, ""))}</li>`);
    else if (line.trim() === "") out.push("");
    else out.push(`<p>${esc(line)}</p>`);
    i += 1;
  }
  return out.join("\n");
}

const reportMd = join(SRC, "FORGE_REPORT.md");
const reportJson = join(SRC, "latest.json");

let body;
let title = "ODA Forge Report";
let updatedAt = new Date().toISOString();

if (existsSync(reportMd)) {
  const md = readFileSync(reportMd, "utf8");
  if (existsSync(reportJson)) {
    try {
      const json = JSON.parse(readFileSync(reportJson, "utf8"));
      if (json.summary?.generatedAt) updatedAt = json.summary.generatedAt;
      if (json.summary?.engine) title = `ODA Forge Report · ${json.summary.engine}`;
    } catch {
      /* keep defaults */
    }
  }
  body = mdToHtml(md);
} else {
  body =
    "<p>No forge report yet. The nightly <em>Master Forge</em> workflow or a manual " +
    "<code>Run workflow</code> will produce one.</p>";
}

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0;
    background: oklch(0.14 0.02 265);
    color: oklch(0.92 0.02 90);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    line-height: 1.6;
  }
  main { max-width: 900px; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 1.75rem; letter-spacing: 0.01em; }
  h1, h2 { color: oklch(0.83 0.11 80); }
  h2 { font-size: 1.15rem; margin-top: 2rem; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.85rem; }
  th, td { border: 1px solid oklch(0.3 0.03 265); padding: 0.45rem 0.6rem; text-align: left; }
  th { background: oklch(0.2 0.025 265); color: oklch(0.83 0.11 80); font-weight: 600; }
  p, li { font-size: 0.9rem; }
  .meta { color: oklch(0.7 0.02 90); font-size: 0.8rem; margin-bottom: 2rem; }
  code { background: oklch(0.22 0.02 265); border-radius: 4px; padding: 0.1rem 0.35rem; font-size: 0.85em; }
</style>
</head>
<body>
<main>
  <h1>${esc(title)}</h1>
  <p class="meta">Generated ${esc(updatedAt)} · free forever, no API keys</p>
  ${body}
</main>
</body>
</html>`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "index.html"), page);
if (existsSync(reportJson)) {
  writeFileSync(join(OUT, "latest.json"), readFileSync(reportJson, "utf8"));
}
console.log(`Report site written to ${join(OUT, "index.html")}`);
