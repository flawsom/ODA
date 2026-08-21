// src/lib/oda/templates/precisionEngine.ts
//
// Track B: renders a DocumentIR into a known template family's .docx asset
// via text-node substitution (docxtemplater), preserving the template's
// existing letterhead image, table borders, fonts and alignment exactly.
// This module never rebuilds OOXML from scratch — it only fills placeholders
// inside a document Word already produced correctly.
//
// npm i docxtemplater pizzip

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { DocumentIR, TableBlock } from "../ir";
import type { TemplateDefinition } from "./registry";
import { logExportDecision } from "../exportLog";
// Shrink-to-fit is shared with Track A (the generic renderer) so both tracks
// use the same calibrated sizing — see ./shared/shrinkToFit.ts.
export {
  applyShrinkToFit,
  documentContentWeight,
  pickFontTier,
  tableContentWeight,
  type FontTier,
} from "./shared/shrinkToFit";
import { applyShrinkToFit, pickFontTier, type FontTier } from "./shared/shrinkToFit";

export class PrecisionRenderError extends Error {
  readonly templateId: string;
  readonly cause?: unknown;

  constructor(message: string, templateId: string, cause?: unknown) {
    super(message);
    this.name = "PrecisionRenderError";
    this.templateId = templateId;
    this.cause = cause;
  }
}

/**
 * Resolve a registry assetPath ("templates/x.docx") to an absolute URL for
 * this deployment. Vite dev serves it at "/templates/x.docx"; static builds
 * with --base=./ (GitHub Pages sub-path /ODA/) resolve "./templates/x.docx"
 * against the page URL, so hash-routed pages land on the right file. When
 * import.meta.env is unavailable (plain Node runs/tests) it degrades to "/".
 */
export function templateAssetUrl(assetPath: string): string {
  const base =
    typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
      ? String(import.meta.env.BASE_URL)
      : "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}${assetPath.replace(/^\/+/, "")}`;
}

/**
 * docxtemplater interprets literal `{`/`}` inside injected values as tags.
 * Source-derived fields (names, colliery history, codes) never legitimately
 * contain braces, so map them to their fullwidth lookalikes rather than
 * letting a stray brace corrupt the render.
 */
function safeTemplateValue(value: string): string {
  return value.replace(/[{}]/g, (c) => (c === "{" ? "（" : "）"));
}

/** A break run exactly as docxtemplater's `linebreaks: true` emits it. */
const BREAK_RUN_RE = /<w:r>(?:<w:rPr>.*?<\/w:rPr>)?<w:br\s*\/?><\/w:r>/g;

/**
 * The reference letters render the recipient address as one paragraph PER
 * LINE, left-aligned — never as a single justified paragraph with <w:br/>
 * breaks (which stretches every line except the last across the full text
 * column). docxtemplater emits each `\n` of a field value as its own run
 * separated by a lone `<w:r><w:br/></w:r>` run, so the split is exact: cut
 * the paragraph at each break run, clone the paragraph properties minus any
 * justification, and emit one <w:p> per line. Paragraphs inside tables are
 * untouched (multi-stint colliery cells rely on <w:br/>).
 */
export function splitBreakParagraphs(xml: string): string {
  const paragraphs = /<w:p[ >].*?<\/w:p>/gs;
  let depth = 0; // <w:tbl> nesting — break runs inside cells stay intact
  let out = "";
  let last = 0;
  // A paragraph open tag must NOT be self-closing (<w:p .../> spacer
  // paragraphs sit right before the member table; matching one would swallow
  // the <w:tbl> opener into the "paragraph", hiding it from the depth
  // counter and wrongly splitting the table cells' <w:br/> stints).
  for (const m of xml.matchAll(/<w:tbl>|<\/w:tbl>|<w:p\b(?:(?!\/>)[^>])*>(?:(?!<\/w:p>)[\s\S])*?<\/w:p>/gs)) {
    const tok = m[0];
    if (tok === "<w:tbl>") {
      depth += 1;
    } else if (tok === "</w:tbl>") {
      depth -= 1;
    } else if (depth === 0) {
      out += xml.slice(last, m.index) + splitParagraphAtBreaks(tok);
      last = m.index + tok.length;
      continue;
    }
    out += xml.slice(last, m.index) + tok;
    last = m.index + tok.length;
  }
  return out + xml.slice(last);
}

function splitParagraphAtBreaks(p: string): string {
  BREAK_RUN_RE.lastIndex = 0;
  if (!BREAK_RUN_RE.test(p)) return p;
  BREAK_RUN_RE.lastIndex = 0;
  const open = /^<w:p[^>]*>/.exec(p)?.[0] ?? "<w:p>";
  const ppr = /^(?:<w:p[^>]*>)(<w:pPr>.*?<\/w:pPr>)/s.exec(p)?.[1] ?? "";
  // The address block is a list of lines, not prose — drop any justification
  // so every line sits flush-left like the reference letters.
  const pprClean = ppr.replace(/<w:jc w:val="[^"]*"\/>/g, "");
  const body = p.slice(open.length + ppr.length, p.length - "</w:p>".length);
  const lines = body.split(BREAK_RUN_RE).filter((seg) => seg.trim().length > 0);
  return lines.map((seg) => `${open}${pprClean}${seg}</w:p>`).join("");
}

/**
 * Optional placeholder paragraphs (the {enclosureLine} closing line) must
 * vanish entirely when the letter has no such content — an empty paragraph
 * would otherwise leave a blank line between the signature and the end.
 * Removes only the ONE paragraph containing the needle (never crosses
 * `</w:p>`), so surrounding paragraphs are untouched.
 */
export function dropParagraphContaining(xml: string, needle: string): string {
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return xml.replace(
    new RegExp(`<w:p[ >](?:(?!<\/w:p>)[^])*?${esc}(?:(?!<\/w:p>)[^])*?<\/w:p>`, "g"),
    "",
  );
}

/**
 * Populate the docxtemplater data object from the IR. Top-level fields come
 * from ir.fields via the template's fieldMap (or from fieldMap functions,
 * which the table-less Extract-out family uses for its body placeholders);
 * the repeating table rows come from the IR's table block via the
 * rowFieldMap — only when the family declares one (PRD fix #3: the table is
 * optional, so Extract-out letters no longer crash on "no table rows").
 * Throws PrecisionRenderError when a required field is missing — callers
 * MUST fall back to Track A.
 */
function buildRenderData(templateDef: TemplateDefinition, ir: DocumentIR): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const [placeholder, source] of Object.entries(templateDef.fieldMap)) {
    const value = typeof source === "function" ? source(ir) : ir.fields[source as string];
    if (value === undefined || value === "") {
      if (templateDef.optionalFields?.includes(placeholder)) {
        data[placeholder] = "";
        continue;
      }
      throw new PrecisionRenderError(
        `Missing required field "${placeholder}" for template ${templateDef.id}`,
        templateDef.id,
      );
    }
    data[placeholder] = safeTemplateValue(value);
  }

  if (templateDef.rowLoopTag && templateDef.rowFieldMap) {
    const tableBlock = ir.blocks.find((b): b is TableBlock => b.type === "table");
    if (!tableBlock || tableBlock.rows.length === 0) {
      throw new PrecisionRenderError(
        `No table rows found in IR for template ${templateDef.id}`,
        templateDef.id,
      );
    }

    data[templateDef.rowLoopTag] = tableBlock.rows.map((row) => {
      const rowObj: Record<string, string> = {};
      for (const [tag, cellKey] of Object.entries(templateDef.rowFieldMap!)) {
        const value = row.cellsByKey?.[cellKey];
        if (value === undefined) {
          throw new PrecisionRenderError(
            `Row missing field "${cellKey}" (tag "${tag}") for template ${templateDef.id}`,
            templateDef.id,
          );
        }
        rowObj[tag] = safeTemplateValue(value);
      }
      return rowObj;
    });
  }

  return data;
}

/**
 * Render `ir` into an already-loaded template buffer at an explicit tier.
 * Exported for the fit-scan harness, which needs to render the same letter
 * at every (font, margin) combination to measure which one fits one page.
 */
export function renderWithTier(
  templateBuf: ArrayBuffer | Uint8Array,
  templateDef: TemplateDefinition,
  ir: DocumentIR,
  tier: FontTier,
): Blob {
  const data = buildRenderData(templateDef, ir);
  const tableBlock = ir.blocks.find((b): b is TableBlock => b.type === "table");

  try {
    const zip = new PizZip(templateBuf);
    // The {enclosureLine} closing paragraph exists only when the letter
    // carries an enclosure — otherwise the placeholder paragraph must be
    // removed BEFORE rendering (docxtemplater would leave an empty one).
    const hasEnclosure = Boolean(data.enclosureLine);
    const preXml = zip.file("word/document.xml")?.asText() ?? "";
    if (!hasEnclosure && preXml.includes("{enclosureLine}")) {
      zip.file("word/document.xml", dropParagraphContaining(preXml, "{enclosureLine}"));
    }
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true, // converts \n in field values (e.g. multi-stint colliery history) to <w:br/>
    });
    doc.render(data);

    // Shrink-to-fit: pin every run to the tier's size (see pickFontTier).
    const xmlEntry = doc.getZip().file("word/document.xml");
    if (!xmlEntry) {
      throw new PrecisionRenderError(
        "Template asset has no word/document.xml",
        templateDef.id,
      );
    }
    const xml = xmlEntry.asText();
    // The recipient address renders as one paragraph per line (reference
    // layout), then shrink-to-fit pins every run to the tier's size.
    doc.getZip().file("word/document.xml", applyShrinkToFit(splitBreakParagraphs(xml), tier));

    const out = doc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    logExportDecision({
      path: "track-b",
      templateId: templateDef.id,
      rowCount: tableBlock?.rows.length ?? 0,
      fontSizePt: tier.fontSizePt,
      possibleOverflow: tier.possibleOverflow,
    });
    return out;
  } catch (err) {
    throw new PrecisionRenderError(
      `docxtemplater render failed for template ${templateDef.id}`,
      templateDef.id,
      err,
    );
  }
}

/**
 * Renders `ir` into an already-loaded template buffer, picking the
 * shrink-to-fit tier automatically from the content weight.
 */
export function renderTemplateFromBuffer(
  templateBuf: ArrayBuffer | Uint8Array,
  templateDef: TemplateDefinition,
  ir: DocumentIR,
): Blob {
  return renderWithTier(templateBuf, templateDef, ir, pickFontTier(ir));
}

/**
 * Renders `ir` into the given template family's bundled .docx asset.
 * Throws PrecisionRenderError on any failure (missing field, malformed
 * template, docxtemplater render error) — callers MUST catch this and fall
 * back to the generic Track A renderer (see export.ts), never surface a
 * hard failure to the user for a Track B miss.
 */
export async function renderPrecisionTemplate(
  templateDef: TemplateDefinition,
  ir: DocumentIR,
): Promise<Blob> {
  let templateBuf: ArrayBuffer;
  try {
    const res = await fetch(templateAssetUrl(templateDef.assetPath));
    if (!res.ok) throw new Error(`Template asset fetch failed: ${res.status}`);
    templateBuf = await res.arrayBuffer();
  } catch (err) {
    throw new PrecisionRenderError(
      `Could not load template asset ${templateDef.assetPath}`,
      templateDef.id,
      err,
    );
  }
  return renderTemplateFromBuffer(templateBuf, templateDef, ir);
}
