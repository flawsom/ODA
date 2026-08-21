// ODA Omni-Viewer: client-side text extraction across formats.
// Plain text formats are read directly; DOCX via mammoth; PDF via pdf.js.
// Images (PNG/JPG/WebP/BMP/TIFF…) and scanned PDFs get a real OCR pass via
// Tesseract.js — free forever, runs in the browser, no keys, no servers.

import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseDocx } from "./docxparse";
import { pdfItemsToText, type PdfTextItemLike } from "./pdftext";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface ExtractionResult {
  text: string;
  format: string;
  supported: boolean;
  note?: string;
}

const MAX_TEXT = 120_000;
const MAX_OCR_PAGES = 12;

export function extOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export const PLAIN_TEXT_EXTS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "xml",
  "log",
  "html",
  "htm",
  "rtf",
  "yaml",
  "yml",
  "ini",
  "conf",
]);

export const IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "bmp",
  "tif",
  "tiff",
  "gif",
]);

// ---------------------------------------------------------------------------
// OCR — lazy, singleton Tesseract worker (kept out of the initial bundle)
// ---------------------------------------------------------------------------

type OcrWorker = {
  recognize: (input: Blob | HTMLCanvasElement) => Promise<{ data: { text: string } }>;
};

let ocrWorkerPromise: Promise<OcrWorker> | null = null;

function getOcrWorker(): Promise<OcrWorker> {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return (await createWorker("eng")) as unknown as OcrWorker;
    })();
  }
  return ocrWorkerPromise;
}

async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const worker = await getOcrWorker();
  const res = await worker.recognize(canvas);
  return res.data.text ?? "";
}

async function ocrBlob(blob: Blob): Promise<string> {
  const worker = await getOcrWorker();
  const res = await worker.recognize(blob);
  return res.data.text ?? "";
}

/** Render a scanned PDF page to a canvas and OCR it. */
async function ocrPdf(buffer: ArrayBuffer, onProgress?: (label: string) => void): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const worker = await getOcrWorker();
  const parts: string[] = [];
  const pages = Math.min(doc.numPages, MAX_OCR_PAGES);
  for (let i = 1; i <= pages; i++) {
    onProgress?.(`OCR · page ${i} of ${pages}…`);
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvas, viewport }).promise;
    const res = await worker.recognize(canvas);
    parts.push(res.data.text ?? "");
  }
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export async function extractText(
  file: File,
  name: string,
  onProgress?: (label: string) => void,
): Promise<ExtractionResult> {
  const format = extOf(name);
  try {
    if (PLAIN_TEXT_EXTS.has(format)) {
      let text = await file.text();
      if (format === "rtf") text = stripRtf(text);
      if (format === "html" || format === "htm") text = stripHtml(text);
      return {
        text: text.slice(0, MAX_TEXT),
        format,
        supported: true,
      };
    }
    if (format === "docx") {
      const buffer = await file.arrayBuffer();
      // Structural parse first (fidelity PRD §4.2/§4.1): tables survive as
      // pipe-delimited rows and the letterhead image is recovered — mammoth's
      // raw text flattens both, which is how exports lost the table and the
      // letterhead. Falls back to mammoth when the zip/OOXML path is
      // unavailable or yields nothing.
      try {
        const parsed = await parseDocx(buffer);
        if (parsed.supported && parsed.text.trim().length > 0) {
          return {
            text: parsed.text.slice(0, MAX_TEXT),
            format,
            supported: true,
            note: parsed.note,
          };
        }
      } catch {
        /* fall through to mammoth */
      }
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return { text: result.value.slice(0, MAX_TEXT), format, supported: true };
    }
    if (format === "pdf") {
      const buffer = await file.arrayBuffer();
      const text = await extractPdf(buffer);
      if (text.trim().length === 0) {
        // Scanned PDF — rebuild a text layer with OCR (free, on-device).
        try {
          onProgress?.("Scanned PDF detected — running OCR…");
          const ocrText = await ocrPdf(buffer, onProgress);
          if (ocrText.trim()) {
            return {
              text: ocrText.slice(0, MAX_TEXT),
              format,
              supported: true,
              note: "OCR · scanned PDF text layer rebuilt",
            };
          }
        } catch {
          /* OCR unavailable in this browser — report honestly below. */
        }
        return {
          text: "",
          format,
          supported: false,
          note: "No selectable text found — the PDF looks scanned and OCR could not run in this browser. Try a document with a text layer.",
        };
      }
      return { text: text.slice(0, MAX_TEXT), format, supported: true };
    }
    if (IMAGE_EXTS.has(format)) {
      onProgress?.(`OCR · ${format.toUpperCase()}…`);
      const text = await ocrBlob(file);
      if (!text.trim()) {
        return {
          text: "",
          format,
          supported: false,
          note: "No text was detected in the image. Try a clearer scan or photograph.",
        };
      }
      return {
        text: text.slice(0, MAX_TEXT),
        format,
        supported: true,
        note: `OCR · ${format.toUpperCase()} text layer`,
      };
    }
    return {
      text: "",
      format,
      supported: false,
      note: `Not readable yet (${format}) — use TXT, MD, CSV, JSON, HTML, RTF, DOCX, PDF, or an image (PNG/JPG/WebP/BMP/TIFF).`,
    };
  } catch (err) {
    return {
      text: "",
      format,
      supported: false,
      note: err instanceof Error ? `Extraction failed: ${err.message}` : "Extraction failed",
    };
  }
}



async function extractPdf(buffer: ArrayBuffer): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    parts.push(pdfItemsToText(content.items as PdfTextItemLike[]));
  }
  return parts.join("\n\n");
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function stripRtf(rtf: string): string {
  return rtf
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\[a-z]+\d?\s?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
