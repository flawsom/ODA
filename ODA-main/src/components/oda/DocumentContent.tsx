// Formatted rendering for forged output: pipe-delimited rows (the document
// tables) render as real bordered tables — never raw text lines — and prose
// keeps its line structure. When content begins with the source letterhead
// text block (a translation whose letterhead lives in the text layer), it is
// rendered like a printed letterhead: centered bold organization lines,
// right-aligned address/contact block, thin rule. Pass hideLetterheadText
// when the letterhead image is shown instead, so the block is not duplicated.

import type { Id } from "@/convex/_generated/dataModel";
import { useLetterheadImage } from "@/components/oda/LetterheadImage";
import { ADDRESS_START, safeLetterheadCut } from "@/lib/oda/refine";

type Block = { type: "para"; lines: string[] } | { type: "table"; rows: string[][] };

function splitBlocks(content: string): Block[] {
  const out: Block[] = [];
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

/** The letterhead's address/contact block is right-aligned; org lines centered. */
function LetterheadTextBlock({ lines }: { lines: string[] }) {
  let inAddress = false;
  const rows = lines
    .filter((l) => l.trim().length > 0)
    .map((line, i) => {
      if (!inAddress && ADDRESS_START.test(line.trim())) inAddress = true;
      return (
        <p
          key={i}
          className={`text-[12.5px] leading-6 ${
            inAddress ? "text-right" : "text-center font-semibold"
          }`}
        >
          {line}
        </p>
      );
    });
  return (
    <div className="border-b border-border/70 pb-3">
      <div className="space-y-0.5">{rows}</div>
    </div>
  );
}

export function DocumentContent({
  content,
  hideLetterheadText = false,
  className = "",
}: {
  content: string;
  /** Drop the content's own letterhead text block (the image covers it). */
  hideLetterheadText?: boolean;
  className?: string;
}) {
  const lines = content.split("\n");
  const cut = safeLetterheadCut(content);
  const showTextLetterhead = cut > 0 && !hideLetterheadText;
  const body = showTextLetterhead ? lines.slice(cut).join("\n") : content;
  const blocks = splitBlocks(body);

  return (
    <div className={className}>
      {showTextLetterhead && <LetterheadTextBlock lines={lines.slice(0, cut)} />}
      {blocks.map((block, i) =>
        block.type === "table" ? (
          <div key={i} className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) =>
                      ri === 0 ? (
                        <th
                          key={ci}
                          className="whitespace-pre-wrap border border-border/70 bg-muted/60 px-3 py-2 text-left font-semibold"
                        >
                          {cell}
                        </th>
                      ) : (
                        <td
                          key={ci}
                          className="whitespace-pre-wrap border border-border/70 px-3 py-2 align-top"
                        >
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p key={i} className="whitespace-pre-wrap font-serif text-[13.5px] leading-7 text-foreground/85">
            {block.lines.join("\n")}
          </p>
        ),
      )}
    </div>
  );
}

/**
 * The complete translation view: the source document's letterhead image
 * (when the source has one) above the translated body — the letterhead
 * exactly as the input, every time. Text-only sources fall back to the
 * content's own letterhead text block.
 */
export function TranslationDocument({
  documentId,
  content,
  className = "",
}: {
  documentId: Id<"documents">;
  content: string;
  className?: string;
}) {
  const letterhead = useLetterheadImage(documentId);
  return (
    <div className={`space-y-4 ${className}`}>
      {letterhead != null && (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-white">
          <img src={letterhead.dataUrl} alt="Original letterhead" className="block w-full" />
        </div>
      )}
      <DocumentContent content={content} hideLetterheadText={letterhead != null} />
    </div>
  );
}
