// src/lib/oda/templates/shared/shrinkToFit.ts
//
// Shrink-to-fit (PRD "Shrink-to-Fit — Keep Letters on One Page"), shared by
// Track B (precision template rendering) and Track A (generic renderer).
//
// The renderers work entirely client-side (fetch template → docxtemplater →
// blob), so page count can't be measured before shipping — instead the
// engine estimates how much content is coming and picks a smaller
// font/margin combination up front, based on what was observed to fit when
// actually rendered during development.
//
// IMPORTANT CALIBRATION NOTE: the template's runs carry no explicit w:sz at
// all, so the renderer's fallback size is what the reference letter renders
// at. The tier table in pickFontTier() is calibrated against REAL page
// counts from the CI render-and-measure workflow (headless LibreOffice +
// poppler), not visual guesses — see that table for the measured truth.

import type { DocumentIR, TableBlock } from "../../ir";

export interface FontTier {
  /** Font size in points for every run of the rendered letter. */
  fontSizePt: 10 | 9 | 8;
  /** Same size in half-points (OOXML w:sz / w:szCs value). */
  sz: string;
  /** When set, the page's top/bottom margins are overridden (twips; 1440 = 1"). */
  topBottomMarginTwips?: number;
  /** When set, the page's left/right margins are overridden too (twips).
   * Widening the text area shrinks the member table rows, which is what
   * actually drives page length on heavy letters. */
  sideMarginTwips?: number;
  /** True when even the floor tier isn't expected to keep the letter on one page. */
  possibleOverflow: boolean;
}

/**
 * Score the table block's content weight — the fields observed to drive
 * page length: row count, multi-stint (\n-joined) history entries, and cell
 * character count.
 *
 * weight = 4·rows + 2·extraStints + ⌊chars/60⌋. The tier thresholds in
 * pickFontTier() are calibrated against the CI render-and-measure harness
 * (.github/workflows/render-measure.yml), which renders each fixture to PDF
 * via headless LibreOffice and counts pages.
 */
export function tableContentWeight(ir: DocumentIR): number {
  const tableBlock = ir.blocks.find((b): b is TableBlock => b.type === "table");
  const rows = tableBlock?.rows ?? [];
  let extraStints = 0;
  let charCount = 0;
  for (const row of rows) {
    for (const value of Object.values(row.cellsByKey ?? {})) {
      charCount += value.length;
      extraStints += (value.match(/\n/g) ?? []).length;
    }
  }
  return rows.length * 4 + extraStints * 2 + Math.floor(charCount / 60);
}

/**
 * Total content weight of a letter — the table weight (above) plus the
 * structural blocks that also consume vertical space: body paragraphs
 * (which is what table-less Extract-out letters are made of), the address
 * block, subject/reference lines and the signature block. Track A letters
 * have no table at all, so this is what keeps their sizing honest.
 */
export function documentContentWeight(ir: DocumentIR): number {
  let w = tableContentWeight(ir);
  for (const b of ir.blocks) {
    if (b.type === "paragraph") {
      const t = b.runs.map((r) => r.text).join("");
      w += 1 + Math.floor(t.length / 120);
    } else if (b.type === "address-block") {
      w += Math.floor(b.lines.join("").length / 200);
    } else if (b.type === "subject-line" || b.type === "reference-line" || b.type === "salutation") {
      w += 1;
    } else if (b.type === "signature-block") {
      w += 1;
    }
  }
  return w;
}

/**
 * Map a content weight to the shrink-to-fit tier. Calibrated against the
 * CI render-and-measure harness (headless LibreOffice, poppler page counts):
 *
 * | Weight | Font | Top/bottom margins | Overflow flag |
 * |--------|------|--------------------|---------------|
 * | ≤ 40   | 9pt  | 1" (default)       | no            |
 * | ≤ 100  | 8pt  | 900 twips (~0.6")  | no            |
 * | > 100  | 8pt  | 900 twips          | yes           |
 *
 * Measured truth (Mangal isn't on Linux, so LibreOffice substitutes a wider
 * Devanagari font than Word uses): the gold 2-row letter fits one page at
 * 9pt but overflows at 10pt; the 5-row × 2-stint stress letter fits at 8pt
 * with 900-twip top/bottom margins. The 8-row × 3-stint floor case stays at
 * 2 pages even at the floor tier, which is exactly why `possibleOverflow`
 * exists: the app warns instead of silently shipping an overflowing letter.
 * The thresholds above are expressed in the *document* weight (table +
 * blocks) so table-less Extract-out letters land on the same calibrated
 * tiers — the gold letter scores ~31, the 5-row stress case ~74, the 8-row
 * floor case ~152 (measured by scripts/smoke-precision.mts).
 */
export function pickFontTier(ir: DocumentIR): FontTier {
  const weight = documentContentWeight(ir);
  if (weight <= 40) return { fontSizePt: 9, sz: "18", possibleOverflow: false };
  if (weight <= 100)
    return { fontSizePt: 8, sz: "16", topBottomMarginTwips: 900, possibleOverflow: false };
  return { fontSizePt: 8, sz: "16", topBottomMarginTwips: 900, possibleOverflow: true };
}

/**
 * Rewrite the rendered document.xml so every run is pinned to the tier's
 * font size (replacing any existing w:sz/w:szCs, adding one where a run has
 * no rPr) and, for the heaviest tiers, the page's top/bottom margins are
 * tightened. This is a uniform pass — it never changes which runs exist, so
 * bold/italic/letterhead/table structure are all preserved.
 */
export function applyShrinkToFit(xml: string, tier: FontTier): string {
  const { sz } = tier;
  let out = xml;

  // 1) Pin every existing run-properties block to the tier size.
  out = out.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/g, (rpr) => {
    const cleaned = rpr
      .replace(/<w:sz\b[^>]*\/>\s*/g, "")
      .replace(/<w:szCs\b[^>]*\/>\s*/g, "");
    return cleaned.replace(
      /<\/w:rPr>/,
      `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`,
    );
  });

  // 2) Runs with no rPr at all (docxtemplater copies template runs, so this
  //    only guards against a bare run in a future template) get one.
  out = out.replace(
    /<w:r(?:\s[^>]*)?>((?:(?!<\/w:r>)[\s\S])*?)<\/w:r>/g,
    (run) => {
      if (/<w:sz\b/.test(run)) return run; // already sized by pass 1
      if (/<w:rPr>[\s\S]*?<\/w:rPr>/.test(run)) {
        return run.replace(
          /<\/w:rPr>/,
          `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`,
        );
      }
      return run.replace(
        /^(<w:r(?:\s[^>]*)?>)/,
        `$1<w:rPr><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`,
      );
    },
  );

  // 3) Heavy tiers also tighten the page margins: top/bottom always, and
  //    left/right when the tier asks for a wider text area (that shrinks the
  //    member table rows, the main page-length driver).
  if (tier.topBottomMarginTwips !== undefined) {
    const v = tier.topBottomMarginTwips;
    out = out.replace(/<w:pgMar\b[^>]*\/>/g, (pg) =>
      pg
        .replace(/w:top="\d+"/, `w:top="${v}"`)
        .replace(/w:bottom="\d+"/, `w:bottom="${v}"`),
    );
  }
  if (tier.sideMarginTwips !== undefined) {
    const v = tier.sideMarginTwips;
    out = out.replace(/<w:pgMar\b[^>]*\/>/g, (pg) =>
      pg
        .replace(/w:left="\d+"/, `w:left="${v}"`)
        .replace(/w:right="\d+"/, `w:right="${v}"`),
    );
  }

  return out;
}
