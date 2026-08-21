#!/usr/bin/env node
// ODA Forge Report Site — renders forge-reports/forge-results.json into a
// browsable, self-contained GitHub Pages site (zero dependencies).
//
// Usage: node scripts/publish-report.mjs
//   env FORGE_REPORTS_DIR (default "forge-reports") — reads
//   forge-results.json + FORGE_REPORT.md, writes <dir>/site/index.html.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = process.env.FORGE_REPORTS_DIR || "forge-reports";
const siteDir = join(dir, "site");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ratingBadge(rating) {
  const cls =
    rating === "reference" ? "ref" : rating === "complete" ? "ok" : "part";
  return `<span class="badge ${cls}">${esc(rating)}</span>`;
}

async function main() {
  const [resultsRaw, reportMd] = await Promise.all([
    readFile(join(dir, "forge-results.json"), "utf8").catch(() => null),
    readFile(join(dir, "FORGE_REPORT.md"), "utf8").catch(() => ""),
  ]);
  const data = resultsRaw ? JSON.parse(resultsRaw) : { docs: [], engine: "—", model: "—", language: "Hindi", generatedAt: new Date().toISOString() };
  const docs = data.docs ?? [];

  const counts = { total: docs.length, reference: 0, complete: 0, partial: 0, responseOk: 0 };
  for (const d of docs) {
    if (d.rating === "reference") counts.reference++;
    else if (d.rating === "complete") counts.complete++;
    else counts.partial++;
    if (d.responseOk) counts.responseOk++;
  }

  const cards = docs
    .map((d) => {
      const trans = (d.translation ?? "").replace(/\n$/, "");
      const resp = (d.response ?? "").replace(/\n$/, "");
      return `
<article class="card">
  <header>
    <h2>${esc(d.name)}</h2>
    <div class="meta">
      <span class="chip">${esc(d.format)}</span>
      <span class="chip">${d.chars} chars</span>
      <span class="chip">${esc(d.script)}</span>
      <span class="chip">engine: ${esc(d.tEngine)}</span>
      ${ratingBadge(d.rating)}
    </div>
  </header>
  <details>
    <summary>Hindi translation (${esc(d.tEngine)})</summary>
    <pre>${esc(trans)}</pre>
  </details>
  <details>
    <summary>Response draft (${esc(d.rEngine)}) — ${d.responseOk ? "ok" : "needs review"}</summary>
    <pre>${esc(resp)}</pre>
  </details>
</article>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ODA Forge Report</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif; background: #0b0f14; color: #e6edf3; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 32px 20px 80px; }
  h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.02em; }
  .sub { color: #8b98a5; font-size: 14px; margin-bottom: 24px; }
  .stats { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 28px; }
  .stat { background: #131a22; border: 1px solid #1f2937; border-radius: 10px; padding: 10px 16px; }
  .stat b { display: block; font-size: 20px; }
  .stat span { color: #8b98a5; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
  .card { background: #131a22; border: 1px solid #1f2937; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; }
  .card h2 { font-size: 15px; margin: 0 0 10px; word-break: break-word; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 6px; }
  .chip { background: #1c2530; border: 1px solid #243040; border-radius: 999px; padding: 2px 10px; font-size: 11px; color: #aab8c4; }
  .badge { border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 600; }
  .badge.ref { background: rgba(46, 160, 67, 0.15); color: #3fb950; border: 1px solid rgba(46, 160, 67, 0.4); }
  .badge.ok { background: rgba(56, 139, 253, 0.15); color: #58a6ff; border: 1px solid rgba(56, 139, 253, 0.4); }
  .badge.part { background: rgba(210, 153, 34, 0.15); color: #d29922; border: 1px solid rgba(210, 153, 34, 0.4); }
  details { margin-top: 8px; border-top: 1px dashed #243040; padding-top: 8px; }
  summary { cursor: pointer; font-size: 13px; color: #58a6ff; user-select: none; }
  pre { white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; line-height: 1.55; background: #0b0f14; border: 1px solid #1f2937; border-radius: 8px; padding: 12px; max-height: 420px; overflow: auto; }
  .report { background: #131a22; border: 1px solid #1f2937; border-radius: 12px; padding: 18px 20px; font-size: 13px; line-height: 1.6; margin-bottom: 24px; }
  .report h1 { font-size: 18px; }
  .report pre { border: none; padding: 0; }
  footer { color: #5c6b78; font-size: 12px; margin-top: 32px; text-align: center; }
</style>
</head>
<body>
<div class="wrap">
  <h1>ODA Forge Report</h1>
  <div class="sub">Every document. Understood. Answered — free forever, no API keys. Generated ${esc(data.generatedAt ?? new Date().toISOString())} · engine ${esc(data.engine)}${data.model ? ` · model ${esc(data.model)}` : ""} · translation → ${esc(data.language)}</div>
  <div class="stats">
    <div class="stat"><b>${counts.total}</b><span>documents</span></div>
    <div class="stat"><b>${counts.reference}</b><span>reference-grade</span></div>
    <div class="stat"><b>${counts.complete}</b><span>complete</span></div>
    <div class="stat"><b>${counts.partial}</b><span>partial</span></div>
    <div class="stat"><b>${counts.responseOk}</b><span>responses ok</span></div>
  </div>
  ${reportMd ? `<div class="report"><pre>${esc(reportMd)}</pre></div>` : ""}
  ${cards || "<p>No documents forged yet — run the forge workflow first.</p>"}
  <footer>ODA — Omniscient Document Architect · forged on free GitHub Actions compute</footer>
</div>
</body>
</html>`;

  await mkdir(siteDir, { recursive: true });
  await writeFile(join(siteDir, "index.html"), html, "utf8");
  console.log(`[publish-report] wrote ${join(siteDir, "index.html")} (${docs.length} documents)`);
}

main().catch((err) => {
  console.error("[publish-report] fatal:", err);
  process.exit(1);
});
