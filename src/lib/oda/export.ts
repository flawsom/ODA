// Dispatch Forge exports: download a generated response or translation as
// DOCX, TXT, Markdown, HTML or JSON. Pipe-delimited rows (the document tables)
// are rendered as real bordered tables in DOCX and HTML — never left as raw
// text lines.
//
// For translations, the letterhead block (everything above the first
// structural line) is rendered like a printed letterhead — centered bold
// organization lines, right-aligned address/contact block, and a horizontal
// rule — with no product title stamped above it, so the export reads as the
// source document's exact twin.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { LetterheadImage } from "./letterhead";
import { fontSpecForText } from "./fontRegistry";
import { ADDRESS_START, safeLetterheadCut } from "./refine";
import { assertCleanForExport, sanitizeForExport } from "./sanitize";
import { buildDocumentIR } from "./irBuilder";
import { findMatchingTemplate, hasCmpfSignals } from "./templates/registry";
import {
  PrecisionRenderError,
  renderPrecisionTemplate,
} from "./templates/precisionEngine";
import {
  renderGenericCmpfDocx,
  universalBannerParagraph,
} from "./templates/genericRenderer";
import { logExportDecision } from "./exportLog";
import type { DocumentIR } from "./ir";

export type ExportFormat = "docx" | "txt" | "md" | "html" | "json";

export interface ResponseExport {
  documentName: string;
  content: string;
  language: string;
  formality: string;
  strategy: "ai" | "adaptive";
  createdAt: number;
  kind?: "response" | "translation";
  /** Original document format so translations can export "same as original". */
  sourceFormat?: string;
  /**
   * The source document's letterhead captured as an image — embedded above
   * the translated body in HTML/DOCX so the delivered letter carries the
   * original letterhead exactly as-is.
   */
  letterhead?: LetterheadImage | null;
}

/**
 * Resolve the closest faithful export format for a translation: keep the
 * source document's own format family whenever we can write it client-side,
 * and fall back to DOCX for binary layouts (PDF/PPTX) that need a text layer
 * rebuild. This is the "same as original" promise made honest. */
export function exportFormatForSource(sourceFormat: string | undefined): ExportFormat {
  switch ((sourceFormat ?? "").toLowerCase()) {
    case "docx":
      return "docx";
    case "md":
    case "markdown":
      return "md";
    case "html":
    case "htm":
      return "html";
    case "txt":
    case "csv":
    case "tsv":
    case "rtf":
    case "log":
    case "json":
    case "xml":
    case "yaml":
    case "yml":
      // Text-based sources stay plain text — the translation is the same text
      // layer in the target language.
      return "txt";
    case "pdf":
    case "ppt":
    case "pptx":
    case "xls":
    case "xlsx":
      // Binary layouts can't be reproduced from the text layer — deliver an
      // editable DOCX with the same name and structure instead.
      return "docx";
    default:
      return "docx";
  }
}

function safeName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "-").slice(0, 60);
  return base || "oda-document";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportResponse(exp: ResponseExport, format: ExportFormat) {
  const base = safeName(exp.documentName);
  // Export Sanitization Layer (fidelity PRD §4.6): preview furniture — engine
  // badges, the partial-translation disclaimer, UI meta strips, branding
  // footers — never reaches a delivered file. Stripped always; asserted hard
  // in dev so a regression is caught at the source, not by a recipient.
  const clean: ResponseExport = { ...exp, content: sanitizeForExport(exp.content) };
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    assertCleanForExport(clean.content, exp.documentName);
  }
  switch (format) {
    case "txt":
      triggerDownload(
        new Blob([clean.content], { type: "text/plain;charset=utf-8" }),
        `${base}.txt`,
      );
      break;
    case "md":
      triggerDownload(
        new Blob([clean.content], { type: "text/markdown;charset=utf-8" }),
        `${base}.md`,
      );
      break;
    case "html":
      triggerDownload(
        new Blob([toHtml(clean)], { type: "text/html;charset=utf-8" }),
        `${base}.html`,
      );
      break;
    case "json":
      triggerDownload(
        new Blob(
          [
            JSON.stringify(
              {
                document: clean.documentName,
                language: clean.language,
                formality: clean.formality,
                strategy: clean.strategy,
                kind: clean.kind ?? "response",
                generatedAt: new Date(clean.createdAt).toISOString(),
                content: clean.content,
              },
              null,
              2,
            ),
          ],
          { type: "application/json;charset=utf-8" },
        ),
        `${base}.json`,
      );
      break;
    case "docx":
      const blob = await toDocxBlob(clean);
      triggerDownload(blob, `${base}.docx`);
      break;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Split content into paragraphs and pipe-delimited table rows. */
function splitRows(content: string): Array<{ type: "para"; lines: string[] } | { type: "table"; rows: string[][] }> {
  const out: Array<{ type: "para"; lines: string[] } | { type: "table"; rows: string[][] }> = [];
  const blocks = content.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n");
    let para: string[] = [];
    let table: string[][] = [];
    const flushPara = () => {
      if (para.length > 0) {
        out.push({ type: "para", lines: para });
        para = [];
      }
    };
    const flushTable = () => {
      if (table.length > 0) {
        out.push({ type: "table", rows: table });
        table = [];
      }
    };
    for (const line of lines) {
      if (line.includes("|")) {
        flushPara();
        table.push(line.split("|").map((c) => c.trim()));
      } else {
        flushTable();
        para.push(line);
      }
    }
    flushPara();
    flushTable();
  }
  return out;
}

/** The letterhead block of a translation — index of the first structural line. */
function letterheadCut(exp: ResponseExport): number {
  if (exp.kind !== "translation") return 0;
  return safeLetterheadCut(exp.content);
}

/** HTML letterhead: centered bold org block, right-aligned address, rule. */
function letterheadHtml(lines: string[]): string {
  let inAddress = false;
  const rows = lines
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      if (!inAddress && ADDRESS_START.test(line.trim())) inAddress = true;
      return `<p style="margin:3px 0;${inAddress ? "text-align:right;" : "text-align:center;font-weight:600;"}">${escapeHtml(line)}</p>`;
    })
    .join("\n");
  return `<div style="border-bottom:2px solid #000;margin-bottom:24px;padding-bottom:8px;">${rows}</div>`;
}

function toHtml(exp: ResponseExport): string {
  const cut = letterheadCut(exp);
  const allLines = exp.content.split("\n");
  const letterhead =
    exp.letterhead != null
      ? `<div class="letterhead"><img src="${exp.letterhead.dataUrl}" alt="Original letterhead"/></div>`
      : cut > 0
        ? letterheadHtml(allLines.slice(0, cut))
        : null;
  const body = splitRows(cut > 0 ? allLines.slice(cut).join("\n") : exp.content)
    .map((part) => {
      if (part.type === "table") {
        const rowsHtml = part.rows
          .map(
            (row, i) =>
              `<tr>${row
                .map(
                  (c) =>
                    `<${i === 0 ? "th" : "td"}>${escapeHtml(c).replace(/\n/g, "<br/>")}</${i === 0 ? "th" : "td"}>`,
                )
                .join("")}</tr>`,
          )
          .join("\n");
        return `<table>${rowsHtml}</table>`;
      }
      return part.lines
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
        .join("\n");
    })
    .join("\n");
  const docHead =
    letterhead !== null
      ? letterhead
      : `<h1>${escapeHtml(exp.documentName)}</h1>\n<div class="meta">${escapeHtml(exp.language)} · ${escapeHtml(exp.formality)}</div>`;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(exp.documentName)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', Mangal, 'Noto Sans Devanagari', serif; max-width: 720px; margin: 48px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.65; }
  h1 { font-size: 20px; border-bottom: 2px solid #b08d3e; padding-bottom: 12px; }
  .meta { font-size: 12px; color: #666; font-family: monospace; margin-bottom: 32px; }
  .letterhead { margin-bottom: 24px; border-bottom: 2px solid #b08d3e; padding-bottom: 8px; }
  .letterhead img { width: 100%; height: auto; display: block; }
  p { margin: 14px 0; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #000; padding: 6px 10px; font-size: 13px; vertical-align: top; }
  th { background: #f3efe6; }
</style>
</head>
<body>
${docHead}
${body}
</body>
</html>`;
}

// Latin default for the document style — every run declares its own script
// font via the typography registry (fidelity PRD §4.4), so the default only
// matters for the rare run that forgets.
const RUN_FONT = {
  ascii: "Times New Roman",
  hAnsi: "Times New Roman",
  cs: "Times New Roman",
  eastAsia: "Times New Roman",
  lang: "en-IN",
} as const;

const TABLE_BORDER = () => ({ style: BorderStyle.SINGLE, size: 4, color: "1F1F1F" });

/**
 * Native Word table (fidelity PRD §4.2): single borders sz=4, header row
 * shaded D9D9D9 and centered, column widths from the source's tblGrid (via
 * `ratios`) set in DXA on BOTH the table and every cell — Word breaks if
 * only one side is set. Equal proportional widths when no source grid is
 * available.
 */
function docxTableFrom(rows: string[][], ratios?: number[]): Table {
  const b = TABLE_BORDER();
  const borders = {
    top: b,
    bottom: b,
    left: b,
    right: b,
    insideHorizontal: b,
    insideVertical: b,
  };
  const maxCols = Math.max(...rows.map((r) => r.length), 1);
  const TOTAL = 9400; // the CMPFO reference table's tblW
  const widths: number[] = [];
  if (ratios && ratios.length === maxCols && ratios.every((r) => r > 0)) {
    const sum = ratios.reduce((a, b) => a + b, 0);
    for (const r of ratios) widths.push(Math.max(300, Math.round((r / sum) * TOTAL)));
  } else {
    const w = Math.max(400, Math.floor(TOTAL / maxCols));
    for (let i = 0; i < maxCols; i++) widths.push(w);
  }
  const docRows = rows.map((row, ri) => {
    const isHeader = ri === 0;
    return new TableRow({
      tableHeader: isHeader,
      children: Array.from({ length: maxCols }, (_, ci) => {
        const text = row[ci] ?? "";
        const font = fontSpecForText(text);
        // A cell may carry several visual lines (e.g. multi-stint colliery
        // history "…क्षेत्र\n(20.04.2015 से … तक)") — each renders as its own
        // paragraph inside the cell; docx.js does not render \n in a TextRun.
        const cellParas = text.split("\n").map(
          (ln) =>
            new Paragraph({
              alignment: isHeader || ci === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: { after: 60, line: 260 },
              children: [
                new TextRun({
                  text: ln,
                  bold: isHeader,
                  size: 22,
                  color: "1F1F1F",
                  font,
                  language: { value: font.lang },
                }),
              ],
            }),
        );
        return new TableCell({
          borders,
          shading: isHeader ? { fill: "D9D9D9" } : undefined,
          width: { size: widths[ci] ?? widths[0], type: WidthType.DXA },
          children: cellParas,
        });
      }),
    });
  });
  return new Table({
    rows: docRows,
    width: { size: TOTAL, type: WidthType.DXA },
    borders,
  });
}

/**
 * Alignment Rules Engine (fidelity PRD §4.5): only genuine multi-line body
 * prose (≥ 80 chars, ≥ 10 words, sentence-final punctuation) justifies —
 * exactly the paragraphs the gold file justifies. Everything synthesized —
 * flattened table cells, labels, address lines, salutations, signature
 * blocks — stays left, and nothing short is ever stretched.
 */
function paragraphAlignmentFor(lines: string[]) {
  const joined = lines.join(" ").trim();
  const isProse =
    joined.length >= 80 && joined.split(/\s+/).length >= 10 && /[.!?।]$/.test(joined);
  return isProse ? AlignmentType.JUSTIFIED : AlignmentType.LEFT;
}

function docxParagraphFrom(lines: string[], right = false): Paragraph {
  const first = lines[0];
  const rest = lines.slice(1);
  const isHeading =
    /^(subject|ref|date|to[,:]?|from|re|reg)\b/i.test(first) ||
    lines.join(" ").length < 80;
  const runs: TextRun[] = [];
  const push = (text: string, extra: { bold?: boolean } = {}) => {
    const font = fontSpecForText(text);
    runs.push(
      new TextRun({
        text,
        size: 24,
        color: "1F1F1F",
        font,
        language: { value: font.lang },
        ...extra,
      }),
    );
  };
  if (isHeading) {
    push(first, { bold: true });
  } else {
    push(first);
  }
  for (const line of rest) {
    runs.push(new TextRun({ text: "", break: 1 }));
    push(line);
  }
  return new Paragraph({
    alignment: right ? AlignmentType.RIGHT : paragraphAlignmentFor(lines),
    spacing: { after: 200, line: 300 },
    children: runs,
  });
}

/**
 * A paragraph that is the letter's closing block — भवदीय, / the signed
 * name / the designation. These render right-aligned (the reference sign-off)
 * while the address and body stay left. A block whose first line is the
 * closing or a parenthesized signed name is the closing block.
 */
function isClosingBlock(lines: string[]): boolean {
  const first = lines[0]?.trim() ?? "";
  return (
    /^(भवदीय|आपका विश्वासी|yours\s+faithfully|yours\s+sincerely|regards)[,.]?$/i.test(first) ||
    /^\([^()]+\)$/.test(first)
  );
}

type DocxImageType = "jpg" | "png" | "gif" | "bmp";

/**
 * Re-encode a letterhead format Word cannot embed (webp/avif/…) to PNG in the
 * browser — the exporter runs client-side, so a canvas is always available.
 */
function reencodeToPng(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * DOCX letterhead image: the source document's letterhead embedded as-is at
 * the top of the letter, followed by the thin horizontal rule. The run type
 * is derived from the image's real MIME (a PNG letterhead must never be
 * declared a JPEG — Word and strict OOXML validators reject the mismatch),
 * and unsupported formats are re-encoded to PNG. Width is capped to keep the
 * page layout sane; height scales proportionally.
 */
async function docxLetterheadImage(lh: LetterheadImage): Promise<Paragraph[]> {
  let dataUrl = lh.dataUrl;
  let type: DocxImageType = "jpg";
  const mime = (dataUrl.match(/^data:image\/([a-z0-9.+-]+)[;,]/i) ?? [])[1]?.toLowerCase();
  if (mime === "jpeg" || mime === "jpg") type = "jpg";
  else if (mime === "png") type = "png";
  else if (mime === "gif") type = "gif";
  else if (mime === "bmp") type = "bmp";
  else {
    const png = await reencodeToPng(dataUrl);
    if (png) {
      dataUrl = png;
      type = "png";
    }
  }
  const maxW = 600;
  const scale = Math.min(1, maxW / Math.max(1, lh.width));
  const width = Math.max(1, Math.round(lh.width * scale));
  const height = Math.max(1, Math.round(lh.height * scale));
  const data = Uint8Array.from(atob(dataUrl.split(",")[1] ?? ""), (c) => c.charCodeAt(0));
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new ImageRun({ type, data, transformation: { width, height } })],
    }),
    new Paragraph({
      spacing: { before: 40, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1F1F1F" } },
      children: [],
    }),
  ];
}

/**
 * DOCX letterhead: centered bold organization lines, right-aligned
 * address/contact block, and the thin horizontal rule — the look of the
 * reference letters. Font sizes stay close to the body (20/18 half-points).
 */
function docxLetterheadBlock(lines: string[]): Paragraph[] {
  const out: Paragraph[] = [];
  let inAddress = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (!inAddress && ADDRESS_START.test(line)) inAddress = true;
    const font = fontSpecForText(line);
    out.push(
      new Paragraph({
        alignment: inAddress ? AlignmentType.RIGHT : AlignmentType.CENTER,
        spacing: { after: 40, line: 240 },
        children: [
          new TextRun({
            text: line,
            bold: !inAddress && !line.startsWith("("),
            size: inAddress ? 18 : 20,
            color: "1F1F1F",
            font,
            language: { value: font.lang },
          }),
        ],
      }),
    );
  }
  out.push(
    new Paragraph({
      spacing: { before: 80, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1F1F1F" } },
      children: [],
    }),
  );
  return out;
}

/**
 * DOCX export entry — fidelity PRD §7.4 routing. Track B (precision template
 * replacement into a verified .docx) engages when the payload is a
 * translation that matches a known template family; otherwise Track A (the
 * generic structural renderer) handles it. Every Track B miss or failure is
 * logged (see exportLog.ts / the Responses "Export debug" panel) and falls
 * through to Track A — a template problem never hard-fails the export.
 */
export async function toDocxBlob(exp: ResponseExport): Promise<Blob> {
  const ir: DocumentIR = buildDocumentIR(exp);
  // Track B is for translations of known letter families — responses never
  // get force-fit into a template.
  const match =
    exp.kind === "translation" ? findMatchingTemplate(ir, ir.rawText) : undefined;
  if (match) {
    try {
      return await renderPrecisionTemplate(match, ir);
    } catch (err) {
      logExportDecision({
        path: "track-b-failed",
        templateId: match.id,
        error: err instanceof PrecisionRenderError ? err.message : String(err),
      });
      // fall through to Track A below
    }
  } else {
    logExportDecision({ path: "track-a" });
  }
  // Track A: CMPF-signalled translations get the IR-driven generic CMPF
  // renderer — the SHARED CMPFO letterhead (the current banner, not the
  // source's older header), right-aligned sign-off and calibrated
  // shrink-to-fit, with no known template family required (see
  // templates/genericRenderer.ts). CMPF letters always lead with that banner
  // whether or not the source carried an older letterhead image, so "the
  // output letters carry this header" holds universally. Everything else
  // (responses, non-CMPF letters) keeps the plain structural renderer below.
  // The generic CMPF renderer itself degrading to the plain renderer is the
  // final safety net — a template problem never hard-fails the export.
  if (exp.kind === "translation" && hasCmpfSignals(ir.rawText)) {
    try {
      return await renderGenericCmpfDocx(ir);
    } catch (err) {
      logExportDecision({
        path: "track-a",
        error: `generic-cmpf renderer failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return renderGenericDocx(exp);
}

/** Track A — the generic structural renderer (real tables, letterhead
 * image/block, run-level bold, source column ratios). */
async function renderGenericDocx(exp: ResponseExport): Promise<Blob> {
  const cut = letterheadCut(exp);
  const allLines = exp.content.split("\n");
  const children: Array<Paragraph | Table> = [];
  // Every translation export leads with the universal letterhead banner
  // (edge-to-edge, page-anchored at 0,0 — the same position Track A and
  // Track B use), so a non-CMPF letter carries the user-approved header
  // instead of the source's own older letterhead or none at all. When the
  // banner is present it replaces the source letterhead image/block.
  const banner = exp.kind === "translation" ? await universalBannerParagraph() : null;
  if (banner) {
    children.push(banner);
  } else if (exp.letterhead != null) {
    // The real letterhead image replaces the text block so the delivered
    // letter carries the source letterhead exactly as-is.
    children.push(...(await docxLetterheadImage(exp.letterhead)));
  } else if (cut > 0) {
    children.push(...docxLetterheadBlock(allLines.slice(0, cut)));
  }
  const parts = splitRows(cut > 0 ? allLines.slice(cut).join("\n") : exp.content);
  // The closing block (भवदीय, / signed name / designation) right-aligns in a
  // translated letter. It may be followed by an enclosure line (संलग्न- …), so
  // the LAST closing-shaped paragraph wins — never a mid-letter parenthesized
  // note, and never a response paragraph (responses stay left).
  const lastClosing = parts.reduceRight(
    (acc, p, i) => (acc === -1 && p.type === "para" && isClosingBlock(p.lines) ? i : acc),
    -1,
  );
  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi];
    if (part.type === "table") {
      children.push(docxTableFrom(part.rows, exp.letterhead?.tableRatios));
      children.push(new Paragraph({ spacing: { after: 120 } }));
    } else {
      const isClosing = exp.kind === "translation" && pi === lastClosing;
      children.push(docxParagraphFrom(part.lines, isClosing));
    }
  }

  // Translations lead with the universal banner and carry no product title;
  // everything else (responses) keeps the title + meta strip.
  const headerChildren: Paragraph[] = [];
  if (exp.kind !== "translation" && cut === 0 && exp.letterhead == null) {
    headerChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: exp.documentName.replace(/\.[^.]+$/, ""),
            bold: true,
            size: 28,
            color: "1F1F1F",
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: `${exp.language} · ${exp.formality}`,
            size: 18,
            color: "666666",
          }),
        ],
      }),
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: RUN_FONT, size: 24, color: "1F1F1F" },
          paragraph: { spacing: { line: 300 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            // 1" margins — the CMPFO reference page setup; the broken
            // outputs used 1100 twips uniformly.
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: [...headerChildren, ...children],
      },
    ],
  });

  return Packer.toBlob(doc);
}
