// src/lib/oda/ir.ts — see PRD Section 5 for full rationale.

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface TableRowData {
  /** ordered, matches headers */
  cells: string[];
  /** optional per-cell rich runs, e.g. multi-line date ranges */
  cellRuns?: Run[][];
  /** keyed access for template field mapping (Track B), e.g. { name, accountNo, ... } */
  cellsByKey?: Record<string, string>;
}

export type DocBlock =
  | { type: "meta-line"; label?: string; value: string }
  | { type: "reference-line"; refCode: string; date?: string }
  | { type: "address-block"; lines: string[]; align: "left" | "right" }
  | { type: "salutation"; text: string }
  | { type: "subject-line"; text: string; bold: true }
  | { type: "paragraph"; runs: Run[] }
  | TableBlock
  | { type: "letterhead"; imageRef: string; position: "header" | "inline" }
  | { type: "signature-block"; name: string; designation: string; align: "left" | "right" };

export interface TableBlock {
  type: "table";
  headers: string[];
  rows: TableRowData[];
}

export interface DocumentIR {
  sourceLanguage: string;
  outputLanguage: string;
  docType: string;
  templateFamily?: string;
  blocks: DocBlock[];
  /** flat key→value map feeding Track B placeholder substitution */
  fields: Record<string, string>;
  /** raw extracted text, used by template matchers */
  rawText: string;
}
