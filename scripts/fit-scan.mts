// scripts/fit-scan.mts
//
// Fit-scan for the shrink-to-fit tiers (CI render-and-measure pipeline):
// renders every fixture — the real gold letter plus the medium/heavy stress
// letters — at every (font size × top/bottom margin) combination from the
// tier design, and writes the letters to .tmp-letters/scan-*.docx. The
// workflow then converts them to PDF with headless LibreOffice, counts
// pages, and prints a fit table so the tier thresholds in pickFontTier()
// can be calibrated against REAL page counts (the browser can never measure
// pages itself).
//
// Run: bun scripts/fit-scan.mts   (CI: FIT_SCAN=1 bun scripts/smoke-precision.mts is separate)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildDocumentIR } from "../src/lib/oda/irBuilder";
import {
  renderWithTier,
  pickFontTier,
  tableContentWeight,
  type FontTier,
} from "../src/lib/oda/templates/precisionEngine";
import { findMatchingTemplate } from "../src/lib/oda/templates/registry";
import {
  FLATTENED_FIXTURE,
  MEDIUM_FIXTURE,
  HEAVY_FIXTURE,
  EXTRACT_FIXTURE,
  NAYAK_FIXTURE,
  JENA_FIXTURE,
} from "./fixtures-cmpf";

/** Template buffers per registry assetPath (the scan renders each fixture
 * through its own matched family's template). */
const TEMPLATES: Record<string, Uint8Array> = {
  "templates/cmpf-lc-out-v1.docx": readFileSync("public/templates/cmpf-lc-out-v1.docx"),
  "templates/cmpf-extract-out-v1.docx": readFileSync("public/templates/cmpf-extract-out-v1.docx"),
};

/** Every combination the tier design can emit: each font size at the default
 * margins, tighter top/bottom margins, and tighter top/bottom + left/right
 * margins (1440 twips = 1"). Left/right tightening widens the text area,
 * which shrinks the member table rows — the main page-length driver. */
const TIERS: FontTier[] = [
  // 10pt — the legacy baseline, kept for comparison.
  { fontSizePt: 10, sz: "20", possibleOverflow: false },
  // 9pt at increasing margin tightening.
  { fontSizePt: 9, sz: "18", possibleOverflow: false },
  { fontSizePt: 9, sz: "18", topBottomMarginTwips: 1080, possibleOverflow: false },
  { fontSizePt: 9, sz: "18", topBottomMarginTwips: 900, possibleOverflow: false },
  { fontSizePt: 9, sz: "18", topBottomMarginTwips: 900, sideMarginTwips: 1080, possibleOverflow: false },
  // 8pt at increasing margin tightening.
  { fontSizePt: 8, sz: "16", possibleOverflow: false },
  { fontSizePt: 8, sz: "16", topBottomMarginTwips: 1080, possibleOverflow: false },
  { fontSizePt: 8, sz: "16", topBottomMarginTwips: 900, possibleOverflow: false },
  { fontSizePt: 8, sz: "16", topBottomMarginTwips: 900, sideMarginTwips: 1080, possibleOverflow: false },
  // Floor tier — the honest-overflow combination.
  { fontSizePt: 8, sz: "16", topBottomMarginTwips: 900, sideMarginTwips: 900, possibleOverflow: true },
];

const FIXTURES: Array<{ name: string; content: string }> = [
  { name: "light-2rows", content: FLATTENED_FIXTURE },
  { name: "medium-5rows", content: MEDIUM_FIXTURE },
  { name: "heavy-8rows", content: HEAVY_FIXTURE },
  { name: "extract", content: EXTRACT_FIXTURE }, // real Koiri
  { name: "nayak", content: NAYAK_FIXTURE }, // real Nayak
  { name: "jena", content: JENA_FIXTURE }, // real Jena (1-row, 5-col)
];

mkdirSync(".tmp-letters", { recursive: true });

for (const fx of FIXTURES) {
  const ir = buildDocumentIR({
    content: fx.content,
    language: "Hindi",
    documentName: fx.name,
  });
  const def = findMatchingTemplate(ir, ir.rawText);
  if (!def) {
    console.error(`fixture ${fx.name}: template not matched`);
    process.exit(1);
  }
  const template = TEMPLATES[def.assetPath];
  if (!template) {
    console.error(`fixture ${fx.name}: no template buffer for ${def.assetPath}`);
    process.exit(1);
  }
  const weight = tableContentWeight(ir);
  const chosen = pickFontTier(ir);
  console.log(
    `fixture ${fx.name}: weight=${weight} rows=${(ir.blocks.find((b) => b.type === "table") as { rows: unknown[] } | undefined)?.rows.length} chosen=${chosen.fontSizePt}pt overflow=${chosen.possibleOverflow}`,
  );
  for (const tier of TIERS) {
    const blob = renderWithTier(template, def, ir, tier);
    const tb = tier.topBottomMarginTwips ?? 1440;
    const lr = tier.sideMarginTwips ?? 1440;
    const file = `.tmp-letters/scan-${fx.name}-${tier.fontSizePt}pt-tb${tb}-lr${lr}.docx`;
    writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
    console.log(`  wrote ${file}`);
  }
}

console.log("fit-scan complete — workflow converts these to PDF and counts pages.");
