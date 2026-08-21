// src/lib/oda/templates/shared/signatureBlock.ts
//
// CMPFO sign-off convention, shared by BOTH export tracks so they can never
// drift apart (PRD fix #5): the closing block —
//
//     भवदीय,
//     ({signatoryName})
//     {signatoryDesignation}
//
// — sits right-aligned below the body, per the user's layout: address and
// body flush-left, signature flush-right. Track B gets this from the
// template asset itself (the paragraphs carry jc=right); Track A
// (genericRenderer.ts) builds its paragraphs from scratch, so it uses
// closingBlockParagraphs() below to apply the same convention.

import { AlignmentType, Paragraph, TextRun } from "docx";
import { fontSpecForText } from "../../fontRegistry";

/** The closing salutation line CMPFO letters sign off with. */
export const CLOSING_SALUTATION = "भवदीय,";

export interface ClosingBlockOptions {
  /** Font size in half-points (docx TextRun size); default 18 = 9pt. */
  size?: number;
}

/**
 * The right-aligned closing block paragraphs for the generic renderer:
 * salutation, then the signatory name in parentheses (bold), then the
 * designation (bold). All three flush-right, matching the template assets.
 */
export function closingBlockParagraphs(
  name: string,
  designation: string,
  options: ClosingBlockOptions = {},
): Paragraph[] {
  const size = options.size ?? 18;
  const make = (text: string, bold: boolean): Paragraph => {
    const font = fontSpecForText(text);
    return new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 40, line: 280 },
      children: [
        new TextRun({
          text,
          bold,
          size,
          color: "1F1F1F",
          font,
          language: { value: font.lang },
        }),
      ],
    });
  };
  const out: Paragraph[] = [make(CLOSING_SALUTATION, false)];
  if (name) out.push(make(`(${name})`, true));
  if (designation) out.push(make(designation, true));
  return out;
}
