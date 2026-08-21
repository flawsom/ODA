// ODA DOCX structural parser — the "direct OOXML→IR" path the fidelity PRD
// calls for. Mammoth's extractRawText flattens <w:tbl> into bare lines and
// drops every image, which is why exports had no table and no letterhead.
// This module reads the OOXML directly: tables come back with their column
// grid and rows, and the letterhead image is recovered byte-identical from
// word/media/* (Strategy A — native asset reuse).
//
// ZIP reading uses the platform's native DecompressionStream("deflate-raw")
// (browsers and Node 18+); when it is unavailable the parser reports
// `supported: false` and callers fall back to mammoth as today.

export interface DocxTableCell {
  text: string;
  /** Header-cell shading, e.g. "D9D9D9". */
  fill: string | null;
  bold: boolean;
}

export interface DocxTable {
  /** Column widths from the source tblGrid, summed to 1.0 (empty when the
   * source carries no grid). */
  columnRatios: number[];
  rows: Array<{ isHeader: boolean; cells: DocxTableCell[] }>;
}

export interface DocxLetterheadImage {
  /** Media path, e.g. word/media/image10.png. */
  path: string;
  dataUrl: string;
  /** Rendered width vs page content width (0…1). */
  widthRatio: number;
}

export interface DocxParseResult {
  supported: boolean;
  /** Plain-text reconstruction: letterhead lines, body prose, and tables as
   * pipe-delimited rows so the whole downstream pipeline (translation,
   * export) treats them uniformly. */
  text: string;
  tables: DocxTable[];
  letterhead: DocxLetterheadImage | null;
  note?: string;
}

// ---------------------------------------------------------------------------
// Minimal ZIP reader (central directory)
// ---------------------------------------------------------------------------

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
}

function u16(buf: DataView, off: number): number {
  return buf.getUint16(off, true);
}
function u32(buf: DataView, off: number): number {
  return buf.getUint32(off, true);
}

function findEocd(buf: Uint8Array): number {
  // EOCD signature 0x06054b50, within the last 65 557 bytes.
  const start = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}

function readCentralDirectory(buf: Uint8Array): ZipEntry[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const eocd = findEocd(buf);
  if (eocd === -1) throw new Error("Not a ZIP archive (no end-of-central-directory)");
  const count = u16(view, eocd + 10);
  const dirOffset = u32(view, eocd + 16);
  const out: ZipEntry[] = [];
  let off = dirOffset;
  for (let i = 0; i < count; i++) {
    if (u32(view, off) !== 0x02014b50) throw new Error("Corrupt ZIP central directory");
    const method = u16(view, off + 10);
    const compressedSize = u32(view, off + 20);
    const uncompressedSize = u32(view, off + 24);
    const nameLen = u16(view, off + 28);
    const extraLen = u16(view, off + 30);
    const commentLen = u16(view, off + 32);
    const localOffset = u32(view, off + 42);
    const name = new TextDecoder().decode(buf.slice(off + 46, off + 46 + nameLen));
    out.push({ name, method, compressedSize, uncompressedSize, localOffset });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  // data.slice() copies to its own ArrayBuffer, satisfying Blob's typing.
  const stream = new Blob([data.slice()]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

/** Extract one entry's bytes. Returns null when compression is unsupported. */
async function readEntry(buf: Uint8Array, entry: ZipEntry): Promise<Uint8Array | null> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const lo = entry.localOffset;
  if (u32(view, lo) !== 0x04034b50) throw new Error("Corrupt ZIP local header");
  const nameLen = u16(view, lo + 26);
  const extraLen = u16(view, lo + 28);
  const dataStart = lo + 30 + nameLen + extraLen;
  const data = buf.slice(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRaw(data);
  return null;
}

// ---------------------------------------------------------------------------
// OOXML extraction
// ---------------------------------------------------------------------------

function decodeXml(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function attr(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

/** Text of every <w:t> run inside an XML fragment, joined with spaces. */
function runsText(xml: string): string {
  const texts: string[] = [];
  const tRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let t: RegExpExecArray | null;
  while ((t = tRe.exec(xml)) !== null) texts.push(decodeEntities(t[1]).replace(/\s+/g, " ").trim());
  return texts.join(" ").trim();
}

function extractTables(documentXml: string): DocxTable[] {
  const tables: DocxTable[] = [];
  const tblRe = /<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/g;
  let m: RegExpExecArray | null;
  while ((m = tblRe.exec(documentXml)) !== null) {
    const tblXml = m[1];
    const grid: number[] = [];
    const gridRe = /<w:gridCol\b[^>]*\/>/g;
    let g: RegExpExecArray | null;
    while ((g = gridRe.exec(tblXml)) !== null) {
      const w = attr(g[0], "w:w");
      if (w && /^\d+$/.test(w)) grid.push(Number(w));
    }
    const total = grid.reduce((a, b) => a + b, 0);
    const ratios = total > 0 ? grid.map((v) => v / total) : [];

    const rows: Array<{ isHeader: boolean; cells: DocxTableCell[] }> = [];
    const trRe = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
    let tr: RegExpExecArray | null;
    while ((tr = trRe.exec(tblXml)) !== null) {
      const cells: DocxTableCell[] = [];
      const tcRe = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
      let tc: RegExpExecArray | null;
      while ((tc = tcRe.exec(tr[1])) !== null) {
        const tcXml = tc[1];
        const shd = tcXml.match(/<w:shd\b[^>]*\/>/)?.[0] ?? "";
        const fill = attr(shd, "w:fill");
        const bold = /<w:b\b[^>]*\/>/.test(tcXml);
        cells.push({
          text: runsText(tcXml),
          fill: fill && fill !== "auto" ? fill : null,
          bold,
        });
      }
      if (cells.length > 0) rows.push({ isHeader: /<w:tblHeader\b/.test(tr[1]), cells });
    }
    if (rows.length > 0) tables.push({ columnRatios: ratios, rows });
  }
  return tables;
}

/** Page content width in dxa (twentieths of a point) from pgSz minus margins. */
function pageContentWidth(documentXml: string): number {
  const sz = documentXml.match(/<w:pgSz\b[^>]*\/>/)?.[0] ?? "";
  const mar = documentXml.match(/<w:pgMar\b[^>]*\/>/)?.[0] ?? "";
  const pageW = Number(attr(sz, "w:w") ?? 12240);
  const left = Number(attr(mar, "w:left") ?? 1440);
  const right = Number(attr(mar, "w:right") ?? 1440);
  return Math.max(1, pageW - left - right);
}

interface Drawing {
  embed: string | null;
  /** Absolute offset in document.xml — comparable with paragraph offsets. */
  offset: number;
  widthDxa: number;
  heightDxa: number;
}

function extractDrawings(documentXml: string): Drawing[] {
  const out: Drawing[] = [];
  const drawRe = /<w:drawing\b[^>]*>([\s\S]*?)<\/w:drawing>/g;
  let m: RegExpExecArray | null;
  while ((m = drawRe.exec(documentXml)) !== null) {
    const d = m[1];
    const blip = d.match(/<a:blip\b[^>]*>/)?.[0] ?? "";
    const embed = attr(blip, "r:embed") ?? attr(blip, "r:link");
    const extent = d.match(/<wp:extent\b[^>]*\/>/)?.[0] ?? "";
    const cx = Number(attr(extent, "cx") ?? 0);
    const cy = Number(attr(extent, "cy") ?? 0);
    // 914400 EMU per inch; 1440 dxa per inch.
    const widthDxa = (cx / 914400) * 1440;
    const heightDxa = (cy / 914400) * 1440;
    if (embed && cx > 0) out.push({ embed, offset: m.index, widthDxa, heightDxa });
  }
  return out;
}

/** Map r:id → media path from word/_rels/document.xml.rels. */
function relTargets(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /<Relationship\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml)) !== null) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) map.set(id, target);
  }
  return map;
}

/** Normalize a rels target ("media/image10.png") to an archive path. */
function mediaPath(target: string): string {
  const t = target.replace(/^\.\//, "");
  if (t.startsWith("word/")) return t;
  return `word/${t}`;
}

const BODY_START_RE =
  /^(date|dated|ref|reference|file\s*no|no\.?|sub|subject|to\s*[,:]?|dear|respected|sir[,:]?|madam[,:]?|mahoday|विषय|संदर्भ|दिनांक|प्रति|सेवा में)/i;

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

/**
 * Strategy A letterhead detection: the offset of the first structural
 * paragraph (Date:/Ref:/To,/… or a bare file-number code) is the body cut;
 * any wide drawing before it is letterhead material. The widest such drawing
 * (the composite banner in CMPF-style templates) becomes THE letterhead —
 * its bytes are re-embedded byte-identical.
 */
export async function parseDocx(buf: ArrayBuffer): Promise<DocxParseResult> {
  const bytes = new Uint8Array(buf);
  try {
    if (typeof DecompressionStream === "undefined") {
      return { supported: false, text: "", tables: [], letterhead: null };
    }
    const entries = readCentralDirectory(bytes);
    const byName = new Map(entries.map((e) => [e.name, e]));
    const read = async (name: string): Promise<Uint8Array | null> => {
      const e = byName.get(name);
      return e ? readEntry(bytes, e) : null;
    };

    const documentXml = decodeXml((await read("word/document.xml")) ?? new Uint8Array());
    if (!documentXml) {
      return { supported: false, text: "", tables: [], letterhead: null };
    }
    const relsXml = decodeXml((await read("word/_rels/document.xml.rels")) ?? new Uint8Array());
    const rels = relTargets(relsXml);

    const tables = extractTables(documentXml);
    const contentWidth = pageContentWidth(documentXml);
    const drawings = extractDrawings(documentXml);

    // Walk the body in document order: <w:tbl>…</w:tbl> and <w:p>…</w:p>.
    const bodyMatch = documentXml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/);
    const body = bodyMatch?.[1] ?? documentXml;
    // Block offsets below are body-relative; drawings carry document-relative
    // offsets, so remember the absolute start of the body for the cut test.
    const bodyAbs = bodyMatch ? (bodyMatch.index ?? 0) + bodyMatch[0].length - bodyMatch[1].length : 0;
    const blockRe = /<w:(tbl|p)\b[^>]*>[\s\S]*?<\/w:\1>/g;
    const blocks: Array<{ start: number; end: number; tag: "tbl" | "p"; xml: string }> = [];
    let bm: RegExpExecArray | null;
    while ((bm = blockRe.exec(body)) !== null) {
      blocks.push({ start: bm.index, end: bm.index + bm[0].length, tag: bm[1] as "tbl" | "p", xml: bm[0] });
    }

    // First structural paragraph (absolute document.xml coordinate) = cut;
    // everything before it is letterhead material. A file-number line may
    // carry a leading OCR/scan fragment ("-729877-85872400CPF/118/…") that
    // hides the code, so strip a leading non-alphanumeric junk run before
    // testing.
    let bodyCut = documentXml.length;
    for (const block of blocks) {
      if (block.tag === "p") {
        const t = runsText(block.xml).replace(/^[^\w\u0900-\u097F]+/, "");
        if (BODY_START_RE.test(t) || /^[A-Z]{2,}\/[A-Z0-9]/.test(t) || t.includes("|")) {
          bodyCut = bodyAbs + block.start;
          break;
        }
      }
    }

    // Letterhead candidate: the largest-AREA wide drawing in the head region
    // (first three blocks). The CMPFO composite banner usually sits INSIDE
    // the file-number paragraph (or the paragraph right above it), never
    // above the first structural line — the old "widest before the cut" rule
    // therefore picked a thin 0.21" strip or the emblem. Wide-only keeps a
    // body photo from ever winning; the 3-block limit keeps the search in
    // the letterhead zone.
    const headBlocks = blocks.slice(0, 3);
    const headEnd =
      headBlocks.length > 0 ? bodyAbs + headBlocks[headBlocks.length - 1].end : bodyCut;
    const candidates = drawings
      .filter((d) => d.offset < headEnd && d.widthDxa >= contentWidth * 0.55)
      .sort((a, b) => b.widthDxa * b.heightDxa - a.widthDxa * a.heightDxa);
    let letterhead: DocxLetterheadImage | null = null;
    const top = candidates[0];
    if (top?.embed) {
      const target = rels.get(top.embed);
      if (target) {
        const path = mediaPath(target);
        const mime = IMAGE_MIME[path.slice(path.lastIndexOf(".")).toLowerCase()] ?? "image/png";
        const data = await read(path);
        if (data && data.length > 0) {
          // Chunked conversion: spreading a >100 KB image throws RangeError
          // ("Maximum call stack size exceeded") in V8.
          let binary = "";
          for (let i = 0; i < data.length; i += 0x8000) {
            binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
          }
          const b64 = btoa(binary);
          letterhead = {
            path,
            dataUrl: `data:${mime};base64,${b64}`,
            widthRatio: contentWidth > 0 ? top.widthDxa / contentWidth : 1,
          };
        }
      }
    }

    // Reconstruct the text layer: paragraphs in order; tables as pipe rows.
    const textBlocks: string[] = [];
    let tblIdx = 0;
    for (const block of blocks) {
      if (block.tag === "tbl") {
        const tbl = tables[tblIdx++];
        if (!tbl) continue;
        const header = tbl.rows.find((r) => r.isHeader) ?? tbl.rows[0];
        if (header) textBlocks.push(header.cells.map((c) => c.text).join(" | "));
        for (const row of tbl.rows) {
          if (row === header) continue;
          textBlocks.push(row.cells.map((c) => c.text).join(" | "));
        }
      } else {
        const t = runsText(block.xml);
        if (t.trim().length > 0) textBlocks.push(t.trim());
      }
    }

    return {
      supported: true,
      text: textBlocks.join("\n"),
      tables,
      letterhead,
      note: "DOCX · structural parse (tables and letterhead preserved)",
    };
  } catch {
    return { supported: false, text: "", tables: [], letterhead: null };
  }
}
