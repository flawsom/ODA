// Letterhead guarantee in the UI: every translation view leads with the
// source document's actual letterhead, captured as an image from the first
// page (PDF render or top-of-scan crop). This is the "letterhead exactly as
// the input" promise made visible — the same image the HTML/DOCX exports
// embed. Text-only sources (txt/docx) have no visual letterhead and render
// nothing; the letterhead is always a bonus, never a blocker.

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { renderLetterheadImage, type LetterheadImage } from "@/lib/oda/letterhead";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";

/** Fetch + render the source letterhead for a document. Returns null when the
 * source has no visual letterhead or rendering fails. */
export async function fetchLetterheadImage(
  storageUrl: string,
  format: string,
): Promise<LetterheadImage | null> {
  try {
    const res = await fetch(storageUrl);
    if (!res.ok) return null;
    return await renderLetterheadImage(await res.blob(), format);
  } catch {
    return null;
  }
}

/**
 * Reactive letterhead for a document: resolves the source file from Convex
 * storage and renders its letterhead once per document. Callers render the
 * image above translation output; exports can pass the result to the
 * exporters so the delivered letter carries the same letterhead.
 */
export function useLetterheadImage(documentId: Id<"documents"> | null): LetterheadImage | null {
  const doc = useQuery(api.documents.get, documentId ? { id: documentId } : "skip");
  const [image, setImage] = useState<LetterheadImage | null>(null);

  useEffect(() => {
    let on = true;
    setImage(null);
    if (!doc?.storageUrl || !doc.storageId) return;
    void fetchLetterheadImage(doc.storageUrl, doc.format).then((img) => {
      if (on) setImage(img);
    });
    return () => {
      on = false;
    };
  }, [doc?.storageUrl, doc?.storageId, doc?.format]);

  return image;
}

/** The source document's letterhead as an image, in a paper-white frame. */
export function LetterheadImage({
  documentId,
  className = "",
}: {
  documentId: Id<"documents">;
  className?: string;
}) {
  const image = useLetterheadImage(documentId);
  if (!image) return null;
  return (
    <div className={`overflow-hidden rounded-xl border border-border/70 bg-white ${className}`}>
      <img src={image.dataUrl} alt="Original letterhead" className="block w-full" />
    </div>
  );
}
