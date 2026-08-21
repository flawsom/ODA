// scripts/patch-cmpf-table-grid.mjs
//
// Fix: the author's Word re-save of cmpf-lc-out-v1.docx rebalanced the
// table's w:tblGrid column widths (col 4, the prevColliery history column,
// shrank from 2700 to 1990 twips), while the cells kept their original
// gold-verified tcW values. LibreOffice lays the table out from the grid,
// so the history text wrapped ~30% more and every multi-stint row grew —
// enough to push 5-row letters off one page at every shrink tier.
//
// This script rewrites w:tblGrid to match the first data row's tcW values
// (700/1700/1500/2700/1900/900, sum 9400 = w:tblW), restoring the verified
// geometry. Idempotent: re-running is a no-op.
//
// Run: bun scripts/patch-cmpf-table-grid.mjs <file.docx> [more.docx ...]

import { readFileSync, writeFileSync } from "node:fs";
import PizZip from "pizzip";

for (const file of process.argv.slice(2)) {
  const buf = readFileSync(file);
  const zip = new PizZip(buf);
  const xml = zip.file("word/document.xml").asText();

  const grid = xml.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/);
  if (!grid) {
    console.error(`${file}: no w:tblGrid found`);
    process.exit(1);
  }

  // Gold widths from the first data row's cells (each tcW appears twice in
  // the template — header + data row — so take the first 6 in document
  // order). Fall back to the verified constants if cells are absent.
  const tcWs = [...xml.matchAll(/<w:tcW w:w="(\d+)"[^/]*\/>/g)].map((m) => Number(m[1]));
  const widths =
    tcWs.length >= 6
      ? tcWs.slice(0, 6)
      : [700, 1700, 1500, 2700, 1900, 900];

  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum !== 9400) {
    console.error(`${file}: derived column widths sum to ${sum}, expected 9400`);
    process.exit(1);
  }

  const newGrid = `<w:tblGrid>${widths
    .map((w) => `<w:gridCol w:w="${w}"/>`)
    .join("")}</w:tblGrid>`;
  if (grid[0] === newGrid) {
    console.log(`${file}: grid already matches cells (no-op)`);
    continue;
  }

  zip.file("word/document.xml", xml.replace(grid[0], newGrid));
  writeFileSync(file, zip.generate({ type: "nodebuffer" }));
  console.log(
    `${file}: tblGrid rewritten to ${widths.join("/")} (was ${[...grid[0].matchAll(/w:w="(\d+)"/g)].map((m) => m[1]).join("/")})`,
  );
}
