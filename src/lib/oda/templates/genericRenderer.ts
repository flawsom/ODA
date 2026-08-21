// src/lib/oda/templates/genericRenderer.ts
//
// Track A — the generic CMPF letter renderer (PRD fix #1).
//
// Renders a DocumentIR into a .docx by walking the block stream, with no
// known template family and no table required, so it can never hard-fail on
// a letter Track B doesn't have a template for. It reproduces the CMPFO
// letter conventions:
//   • the shared letterhead image, taken from the universal skeleton asset
//     (cmpf-universal-skeleton.docx — the single source of the letterhead
//     image across every asset, PRD fix #7),
//   • the right-aligned closing block via the shared signatureBlock module
//     (PRD fix #5),
//   • the same shrink-to-fit sizing the precision engine uses, via the
//     shared shrinkToFit module (PRD fix #4 — content weight now includes
//     paragraphs/address blocks, not just table rows).
//
// Unlike Track B it rebuilds OOXML from scratch with the docx package; it is
// the safety net, not a replacement for verified family templates — a
// genuinely new recurring CMPF letter type should still get its own Track B
// template (see templates/assets/README.md).

import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingType,
  WidthType,
} from "docx";
import PizZip from "pizzip";
import type { DocBlock, DocumentIR, Run, TableBlock } from "../ir";
import { fontSpecForText } from "../fontRegistry";
import { logExportDecision } from "../exportLog";
import { templateAssetUrl } from "./precisionEngine";
import { pickFontTier, type FontTier } from "./shared/shrinkToFit";
import { closingBlockParagraphs } from "./shared/signatureBlock";

/** The skeleton asset that carries the single shared CMPFO letterhead. */
export const GENERIC_CMPF_SKELETON = "templates/cmpf-universal-skeleton.docx";

/**
 * Display width of the letterhead, px at 96dpi — the FULL 8.5" page width
 * (edge-to-edge), matching the Track B templates' page-anchored banner. The
 * image is stretched to the frame (the banner's own design tolerates the
 * small horizontal stretch) so no white gutter shows on the right edge.
 */
const LETTERHEAD_WIDTH_PX = 816;

interface SkeletonImage {
  data: Uint8Array;
  type: "jpg" | "png";
  /** Aspect ratio (height/width) the skeleton displays the image at. */
  displayAspect: number;
}

/** JPEG dimensions from the SOF marker (dependency-free header parse). */
function jpegSize(data: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i < data.length - 9) {
    if (data[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = data[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3) {
      const height = (data[i + 5] << 8) | data[i + 6];
      const width = (data[i + 7] << 8) | data[i + 8];
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const seglen = (data[i + 2] << 8) | data[i + 3];
    i += 2 + seglen;
  }
  return null;
}

/** PNG dimensions from the IHDR chunk (bytes 16–24). */
function pngSize(data: Uint8Array): { width: number; height: number } | null {
  if (data.length < 24) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width > 0 && height > 0) return { width, height };
  return null;
}

/** Pull the letterhead image out of the universal skeleton. Never throws. */
async function loadSkeletonImage(): Promise<SkeletonImage | null> {
  try {
    const res = await fetch(templateAssetUrl(GENERIC_CMPF_SKELETON));
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const zip = new PizZip(buf);
    const media = Object.keys(zip.files).filter((n) =>
      /^word\/media\/.+\.(jpe?g|png)$/i.test(n),
    );
    if (media.length === 0) return null;
    const name = media[0];
    const entry = zip.file(name);
    if (!entry) return null;
    const data: Uint8Array =
      typeof entry.asUint8Array === "function"
        ? entry.asUint8Array()
        : new Uint8Array([...entry.asBinary()].map((c) => c.charCodeAt(0)));
    const type: "jpg" | "png" = /\.png$/i.test(name) ? "png" : "jpg";
    const dims = type === "png" ? pngSize(data) : jpegSize(data);
    if (!dims) return null;
    // Display aspect from the skeleton's DrawingML (wp:extent) so the
    // letterhead keeps the exact proportions Word shows; fall back to the
    // natural pixel aspect when the extent is missing.
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const ext = xml.match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/);
    const displayAspect = ext
      ? Number(ext[2]) / Number(ext[1])
      : dims.height / dims.width;
    if (!(displayAspect > 0)) return null;
    return { data, type, displayAspect };
  } catch {
    return null;
  }
}

/** True for genuine multi-line body prose — the gold file justifies only these. */
function isProse(text: string): boolean {
  const t = text.trim();
  return t.length >= 80 && t.split(/\s+/).length >= 10 && /[.!?।]$/.test(t);
}

function textRun(text: string, size: number, bold = false): TextRun {
  const font = fontSpecForText(text);
  return new TextRun({
    text,
    bold,
    size,
    color: "1F1F1F",
    font,
    language: { value: font.lang },
  });
}

function paragraph(
  text: string,
  size: number,
  opts: { bold?: boolean } = {},
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 140, line: 280 },
    children: [textRun(text, size, opts.bold)],
  });
}

function paragraphFromRuns(runs: Run[], size: number): Paragraph {
  const text = runs.map((r) => r.text).join("");
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 140, line: 280 },
    children: runs.map((r) => textRun(r.text, size, r.bold)),
  });
}

const TABLE_BORDER = () => ({ style: BorderStyle.SINGLE, size: 4, color: "1F1F1F" });

/** The gold-verified CMPF member-table column widths (sum 9400 twips). */
const GOLD_COL_WIDTHS = [700, 1700, 1500, 2700, 1900, 900];

function tableFrom(block: TableBlock, size: number): Table {
  const b = TABLE_BORDER();
  const borders = {
    top: b,
    bottom: b,
    left: b,
    right: b,
    insideHorizontal: b,
    insideVertical: b,
  };
  const maxCols = Math.max(block.headers.length, ...block.rows.map((r) => r.cells.length), 1);
  const widths =
    maxCols === 6 ? GOLD_COL_WIDTHS : Array.from({ length: maxCols }, () => Math.floor(9400 / maxCols));
  const rows = block.rows.map((row, ri) =>
    new TableRow({
      tableHeader: false,
      children: Array.from({ length: maxCols }, (_, ci) => {
        const text = row.cells[ci] ?? "";
        // Multi-line cells (multi-stint colliery history) render as one
        // paragraph per visual line, like the reference letters.
        const cellParas = text.split("\n").map(
          (ln) =>
            new Paragraph({
              alignment: ci === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: { after: 40, line: 240 },
              children: [textRun(ln, size)],
            }),
        );
        return new TableCell({
          borders,
          width: { size: widths[ci] ?? widths[0], type: WidthType.DXA },
          children: cellParas,
        });
      }),
    }),
  );
  const headerCells = Array.from({ length: maxCols }, (_, ci) => {
    const text = block.headers[ci] ?? "";
    const font = fontSpecForText(text);
    return new TableCell({
      borders,
      shading: { fill: "D9D9D9" },
      width: { size: widths[ci] ?? widths[0], type: WidthType.DXA },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40, line: 240 },
          children: [
            new TextRun({
              text,
              bold: true,
              size,
              color: "1F1F1F",
              font,
              language: { value: font.lang },
            }),
          ],
        }),
      ],
    });
  });
  return new Table({
    rows: [new TableRow({ tableHeader: true, children: headerCells }), ...rows],
    width: { size: 9400, type: WidthType.DXA },
    borders,
  });
}

function blocksToElements(blocks: DocBlock[], size: number): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  for (const b of blocks) {
    switch (b.type) {
      case "meta-line":
        out.push(paragraph(b.value, size, { bold: true }));
        break;
      case "reference-line":
        out.push(paragraph(`संदर्भ:- ${b.refCode}`, size));
        break;
      case "address-block":
        for (const line of b.lines) out.push(paragraph(line, size));
        break;
      case "salutation":
        out.push(paragraph(b.text, size));
        break;
      case "subject-line":
        out.push(paragraph(b.text, size, { bold: true }));
        break;
      case "paragraph":
        out.push(paragraphFromRuns(b.runs, size));
        break;
      case "table":
        out.push(tableFrom(b, size));
        out.push(new Paragraph({ spacing: { after: 120 } }));
        break;
      case "letterhead":
        break; // the shared skeleton letterhead is added by the caller
      case "signature-block":
        out.push(...closingBlockParagraphs(b.name, b.designation, { size }));
        break;
    }
  }
  return out;
}

/**
 * The universal letterhead banner as an anchored paragraph: page corner
 * (0,0), full 8.5" page width edge-to-edge, topAndBottom wrap so the letter
 * text starts below it. Shared by Track A (CMPF letters) and the plain
 * structural renderer (every other translation export) so ALL delivered
 * letters carry the same banner in the same position. Never throws — a
 * missing skeleton yields null and the caller renders without it.
 */
export async function universalBannerParagraph(): Promise<Paragraph | null> {
  const skeleton = await loadSkeletonImage();
  if (!skeleton) return null;
  const height = Math.max(1, Math.round(LETTERHEAD_WIDTH_PX * skeleton.displayAspect));
  return new Paragraph({
    children: [
      new ImageRun({
        type: skeleton.type,
        data: skeleton.data,
        transformation: { width: LETTERHEAD_WIDTH_PX, height },
        floating: {
          horizontalPosition: { relative: "page", offset: 0 },
          verticalPosition: { relative: "page", offset: 0 },
          zIndex: 251658240,
          behindDocument: false,
          wrap: { type: TextWrappingType.TOP_AND_BOTTOM },
        },
      }),
    ],
  });
}

/**
 * Render a DocumentIR as a generic CMPF letter (Track A): shared CMPFO
 * letterhead, structural body from the block stream, left-aligned sign-off
 * (as the reference letters set it), and the same calibrated shrink-to-fit
 * sizing as Track B. Never throws on a missing/malformed skeleton — a
 * letter without the letterhead image beats no letter at all.
 */
export async function renderGenericCmpfDocx(ir: DocumentIR): Promise<Blob> {
  const tier: FontTier = pickFontTier(ir);
  const size = tier.fontSizePt * 2; // docx TextRun size is in half-points
  const rowCount =
    ir.blocks.find((b): b is TableBlock => b.type === "table")?.rows.length ?? 0;

  const children: Array<Paragraph | Table> = [];
  const banner = await universalBannerParagraph();
  if (banner) children.push(banner);

  children.push(...blocksToElements(ir.blocks, size));

  // A CMPF letter always closes right-aligned; synthesize the block when the
  // IR carried the fields but the block stream missed it.
  const hasClosing = ir.blocks.some((b) => b.type === "signature-block");
  if (!hasClosing && (ir.fields.signatoryName || ir.fields.signatoryDesignation)) {
    children.push(
      ...closingBlockParagraphs(ir.fields.signatoryName ?? "", ir.fields.signatoryDesignation ?? "", {
        size,
      }),
    );
  }

  const topBottom = tier.topBottomMarginTwips ?? 1440;
  const side = tier.sideMarginTwips ?? 1440;

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: fontSpecForText(""), size, color: "1F1F1F" },
          paragraph: { spacing: { line: 280 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            // US Letter, 1" margins — the CMPFO reference page setup,
            // tightened only when the chosen tier asks for it.
            size: { width: 12240, height: 15840 },
            margin: { top: topBottom, bottom: topBottom, left: side, right: side },
          },
        },
        children,
      },
    ],
  });

  logExportDecision({
    path: "track-a",
    rowCount,
    fontSizePt: tier.fontSizePt,
    possibleOverflow: tier.possibleOverflow,
  });

  return Packer.toBlob(doc);
}
