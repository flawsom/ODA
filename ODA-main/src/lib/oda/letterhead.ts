// Letterhead capture — the "letterhead exactly as the input" guarantee for
// image letterheads (CMPFO and most official Indian letterheads are raster or
// vector images the text layer never sees). For PDFs we render page 1 and
// keep the top region; for image uploads we crop the top of the scan. The
// result is a JPEG data URL that DocumentDetail shows above the translation
// and that DOCX/HTML exports embed, so the delivered letter carries the
// source's exact letterhead above the translated body.

import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseDocx } from "./docxparse";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface LetterheadImage {
  dataUrl: string;
  width: number;
  height: number;
  /** Column width ratios of the source document's first table (from its
   * OOXML tblGrid) — the exporters reproduce them instead of guessing. */
  tableRatios?: number[];
}

const IMAGE_FORMATS = new Set(["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "gif"]);

/** Keep the top ~40% of the first page — the letterhead zone of a letter. */
const CROP = 0.4;

function cropTop(source: HTMLCanvasElement): HTMLCanvasElement {
  const height = Math.max(1, Math.floor(source.height * CROP));
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(source, 0, 0, source.width, height, 0, 0, source.width, height);
  return canvas;
}

function imageToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas unavailable"));
      ctx.drawImage(img, 0, 0);
      resolve(cropTop(canvas));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image decode failed"));
    };
    img.src = url;
  });
}

/**
 * Render the letterhead of a source file. Returns null for formats without a
 * visual letterhead (txt/docx) or when rendering fails — callers treat the
 * letterhead as a bonus, never a blocker.
 */
export async function renderLetterheadImage(
  file: Blob,
  format: string,
): Promise<LetterheadImage | null> {
  try {
    let canvas: HTMLCanvasElement;
    const fmt = format.toLowerCase();
    if (fmt === "pdf") {
      const buffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 1.6 });
      const full = document.createElement("canvas");
      full.width = Math.floor(viewport.width);
      full.height = Math.floor(viewport.height);
      const ctx = full.getContext("2d");
      if (!ctx) return null;
      await page.render({ canvas: full, viewport }).promise;
      canvas = cropTop(full);
    } else if (IMAGE_FORMATS.has(fmt)) {
      canvas = await imageToCanvas(file);
    } else if (fmt === "docx") {
      // Strategy A — native asset reuse: the letterhead image inside the
      // DOCX (word/media/*) is recovered byte-identical, zero recompression.
      // This is the exact-fidelity fast path for DOCX sources; PDF/images
      // keep the render-and-crop path above.
      const parsed = await parseDocx(await file.arrayBuffer());
      const lh = parsed.letterhead;
      if (!lh) return null;
      const dims = await dataUrlSize(lh.dataUrl);
      if (!dims) return null;
      return {
        dataUrl: lh.dataUrl,
        width: dims.width,
        height: dims.height,
        tableRatios: parsed.tables[0]?.columnRatios,
      };
    } else {
      return null;
    }
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { dataUrl, width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

/** Natural pixel size of a data URL image (browser-only helper). */
function dataUrlSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
