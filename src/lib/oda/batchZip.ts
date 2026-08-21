// src/lib/oda/batchZip.ts
//
// Client-side batch download for the ingestion queue: bundles the original
// files (when the browser still holds them) plus the extracted text layers
// into one .zip. Reuses the same PizZip library the DOCX template renderers
// already ship — no new dependency. PizZip is a JSZip 2.x-era fork, so zips
// are generated synchronously via `generate({ type: "blob" })`, the same call
// the precision template renderer already makes. File bytes are read with
// `await` first, then handed to PizZip as Uint8Array (it cannot deflate a raw
// Blob entry).

import PizZip from "pizzip";

export interface BatchZipItem {
  /** File name as it should appear in the archive (may carry an extension). */
  name: string;
  /** Original file bytes — archived verbatim when still in hand. */
  file?: File | Blob;
  /** Extracted text layer — archived under `_extracted/<name>.txt`. */
  text?: string;
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

/**
 * Zip a batch and download it. Originals are stored verbatim (already binary,
 * so no recompression gain); extracted text layers ride along in a
 * `_extracted/` folder so the archive carries both what you uploaded and what
 * ODA read from it.
 */
export async function downloadBatchZip(items: BatchZipItem[], zipName: string): Promise<void> {
  const zip = new PizZip();
  for (const item of items) {
    if (item.file) {
      const bytes = await item.file.arrayBuffer();
      zip.file(item.name, new Uint8Array(bytes));
    }
    if (item.text && item.text.trim().length > 0) {
      const base = item.name.replace(/\.[^.]+$/, "") || "oda-document";
      zip.file(`_extracted/${base}.txt`, item.text);
    }
  }
  const blob = zip.generate({
    type: "blob",
    mimeType: "application/zip",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  triggerDownload(blob, zipName);
}
