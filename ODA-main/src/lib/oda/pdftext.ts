// PDF text-layer reconstruction (pure, no pdf.js imports so tests can load
// it directly). Given the raw items pdf.js returns for a page, rebuild the
// text with its real line structure:
//   • breaks lines where hasEOL is set or the baseline jumps (y > 4 units),
//   • inserts a word space between horizontally separated runs (gap > 0.75),
//   • inserts a pipe between wide column gaps (gap > 10) so PDF tables come
//     out as pipe-delimited rows and flow through the normal table pipeline.
//
// Naively joining items with a space destroys documents: the address block,
// the file-number + date pair and the table columns collapse into one run,
// which breaks the translator's line-based rules (a "Date:" line is never
// seen as a line, the To-block never translates, tables never form).

export interface PdfTextItemLike {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
}

export function pdfItemsToText(items: PdfTextItemLike[]): string {
  let out = "";
  let lastX: number | null = null;
  let lastY: number | null = null;
  let lastW = 0;
  for (const item of items) {
    if (typeof item.str !== "string" || item.str.length === 0) continue;
    const str = item.str.replace(/^\s+|\s+$/g, "");
    if (str.length === 0) continue;
    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    const w = item.width ?? 0;
    if (lastX !== null && lastY !== null) {
      const yDiff = Math.abs(y - lastY);
      const xGap = x - (lastX + lastW);
      if (item.hasEOL || yDiff > 4) {
        out += "\n";
      } else if (xGap > 10) {
        out += " | ";
      } else if (xGap > 0.75) {
        out += " ";
      }
    }
    out += str;
    lastX = x;
    lastY = y;
    lastW = w;
  }
  return out
    .replace(/[ \t]+/g, " ")
    .replace(/ *\| */g, " | ")
    .replace(/ \n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
