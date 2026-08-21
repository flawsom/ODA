// src/lib/oda/templates/registry.ts
//
// Registry of "known template family" definitions for Track B (precision
// replacement) export. Each entry maps a SCORED matcher (how strongly does
// this document belong to this family?) to a bundled .docx template asset
// and a field contract that tells the render engine how to populate it from
// DocumentIR.
//
// Matching (PRD fix #2): the old matcher required an exact two-phrase AND
// (organisation name + subject) that real letters routinely missed. The
// current matcher scores Hindi/English synonym-tolerant signals (organisation
// markers, transfer-out subject variants, extract markers) plus structural
// signals (member table with the CMPF account column, signature block,
// refCode) and picks the highest-scoring family above a confidence floor.
// Below the floor — or with no CMPF signals at all — Track A renders.
//
// To onboard a new template family: obtain one verified reference .docx,
// tag its dynamic text with {placeholders} (see
// src/lib/oda/templates/assets/README.md for the authoring procedure used
// for cmpf-lc-out-v1 and cmpf-extract-out-v1), drop the asset in ./assets/
// and public/templates/, and add one entry here. No changes to the
// matching/rendering engine are required.

import type { DocumentIR } from "../ir";
import {
  addressLineNeedsComma,
  refineAddressLine,
  stripDesignationTail,
  transliterateRef,
} from "../translate";

export interface TemplateFieldMap {
  [placeholder: string]: keyof DocumentIR["fields"] | ((ir: DocumentIR) => string);
}

export interface TemplateDefinition {
  /** Stable id, also used as the debug-log identifier. Version-suffixed. */
  id: string;
  /** Human-readable label for the export debug panel. */
  label: string;
  /**
   * How strongly this document belongs to this family. Higher is better;
   * findMatchingTemplate picks the best score above CONFIDENCE_FLOOR, so a
   * family never matches on a vague phrase alone and a letter that belongs
   * to no known family falls through to Track A instead of being
   * force-fit into the closest template.
   */
  score: (ir: DocumentIR, rawText: string) => number;
  /** Path to the bundled .docx template asset. Lives in public/templates/ so
   * Vite serves it in dev and copies it into dist for static hosting; the
   * precision engine resolves it against import.meta.env.BASE_URL so the
   * GitHub Pages sub-path (/ODA/) works without changes. */
  assetPath: string;
  /** Top-level (non-repeating) placeholder → IR field mapping. */
  fieldMap: TemplateFieldMap;
  /** Placeholders allowed to render empty (body paragraphs on a letter that
   * has fewer of them, etc.) without failing the Track B render. */
  optionalFields?: string[];
  /** docxtemplater loop tag name used for the repeating table rows, e.g.
   * "members". Absent for table-less families (e.g. Extract-out letters) —
   * the renderer then skips table population entirely (PRD fix #3). */
  rowLoopTag?: string;
  /** Per-row placeholder → source key inside each row's data object. */
  rowFieldMap?: Record<string, string>;
}

/** Below this score no family is "good enough" — Track A takes the letter. */
export const CONFIDENCE_FLOOR = 30;

// ---------------------------------------------------------------------------
// Matcher signals (Hindi/English, synonym-tolerant)
// ---------------------------------------------------------------------------

// Real letters say "कोयला खान भविष्य निधि" (no संगठन suffix) and Latin
// "C.M.P.F, Singrauli" — both are CMPFO organisation markers.
const ORG_RE =
  /कोयला खान भविष्य निधि|सी\.?\s*एम\.?\s*पी\.?\s*एफ|coal\s+mines\s+provident\s+fund|c\.?\s*m\.?\s*p\.?\s*f/i;
const COMMISSIONER_RE = /सीएमपीएफ आयुक्त|cmpf\s+commissioner|regional\s+commissioner/i;

// L.C.-out transfer signals — Hindi and English. "inter regional transfer"
// alone is NOT enough (extract letters say "Inter Regional Transfer of
// Extract"); it only counts combined with the Ledger Card signal or when the
// word "extract" is absent (handled in the scorer).
const LC_TRANSFER_RE =
  /लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण|अंतर-क्षेत्रीय स्थानांतरण|एल\.?\s*सी\.?\s*-?\s*आउट|l\.?\s*c\.?\s*[- ]?out|transfer[- ]out|ledger\s+card|inter\s+regional\s+transfer/i;

const EXTRACT_RE = /एक्सट्रैक्ट|एक्सट्रेक्ट|extract|वी\.?\s*वी\.?|statement/i;

/** Member account references in the extract body ("CMPF A/C No- RNJ/38/520"). */
const CMPF_ACCOUNT_RE = /CMPF\s+A\/?C\s+No|सीएमपीएफ खाता/i;

/** True when the raw text carries any CMPFO organisation signal — the gate
 * that sends Track A misses to the generic CMPF renderer (shared letterhead
 * + right-aligned sign-off + shrink-to-fit) instead of the plain structural
 * renderer. */
export function hasCmpfSignals(rawText: string): boolean {
  // Require the full organization name ("Coal Mines Provident Fund"
  // in Hindi or English), OR the CMPF acronym WITH the commissioner.
  // A bare "CMPF" in a table header is not enough to trigger the
  // reference-standard pass on non-CMPFO government letters that
  // merely mention the CMPF acronym (e.g., transfer orders).
  const hasFullOrg = /कोयला खान भविष्य निधि|coal\s+mines\s+provident\s+fund/i.test(rawText);
  if (hasFullOrg) return true;
  const hasAcronym = /सी\.?\s*एम\.?\s*पी\.?\s*एफ|c\.?\s*m\.?\s*p\.?\s*f/i.test(rawText);
  const hasCommissioner = COMMISSIONER_RE.test(rawText);
  return hasAcronym && hasCommissioner;
}

function orgScore(rawText: string): number {
  if (ORG_RE.test(rawText)) return 20;
  if (COMMISSIONER_RE.test(rawText)) return 10;
  return 0;
}

/** Structural CMPF member-table signal: a real table with the account column. */
function memberTableScore(ir: DocumentIR): number {
  const table = ir.blocks.find((b) => b.type === "table");
  if (!table || table.rows.length === 0) return 0;
  const headers = table.headers.join(" ").toLowerCase();
  let s = 5;
  if (/सीएमपीएफ खाता|account/.test(headers)) s += 20;
  return s;
}

// ---------------------------------------------------------------------------
// cmpf-lc-out-v1 — Ledger Card transfer-out letter (has the member table)
// ---------------------------------------------------------------------------

const cmpfLcOutV1: TemplateDefinition = {
  id: "cmpf-lc-out-v1",
  label: "CMPF Ledger Card Transfer-Out Letter",
  score: (ir, rawText) => {
    let s = orgScore(rawText);
    const t = rawText;
    if (/लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण/.test(t)) s += 20;
    else if (/अंतर-क्षेत्रीय स्थानांतरण/.test(t)) s += 12;
    if (/ledger\s+card/i.test(t)) s += 15;
    // "Inter Regional Transfer" counts for L.C.-out only when the letter is
    // NOT an extract ("Inter Regional Transfer of Extract" is the extract
    // family's subject — see the extract score's penalty).
    if (/inter\s+regional\s+transfer/i.test(t) && !/extract/i.test(t)) s += 10;
    if (/एल\.?\s*सी\.?\s*-?\s*आउट|l\.?\s*c\.?\s*[- ]?out|transfer[- ]out/i.test(t)) s += 12;
    // Extract signal penalty must be script-agnostic: a translated subject
    // carries एक्सट्रैक्ट (Devanagari), which the Latin-only /extract/i miss.
    if (EXTRACT_RE.test(t)) s -= 25;
    s += memberTableScore(ir);
    return s;
  },
  assetPath: "templates/cmpf-lc-out-v1.docx",
  // The address block renders from the TRANSLATED content (free-form
  // {recipientAddressBlock}, \n-joined) instead of six fixed placeholders:
  // real L.C.-out letters each carry their own address shape (some have a
  // जिला line, some don't; the comma pattern varies), and the fixed
  // placeholder set force-fit the reference 198's shape onto every letter.
  fieldMap: {
    fileNoLine: (ir) => fileNoLine(ir),
    recipientAddressBlock: (ir) => addressBlockText(ir, true),
    subject: "subject",
    referenceLine: "referenceLine",
    procedureOfficeLocation: "procedureOfficeLocation",
    procedureOrderNo: "procedureOrderNo",
    procedureOrderDate: "procedureOrderDate",
    // "the following members" → निम्नलिखित, "under mentioned" → नीचे
    // उल्लिखित — read from the translated body so each letter keeps its own
    // intro word (the template itself carries no fixed wording).
    memberIntro: (ir) => memberIntroText(ir),
    // The "साथ ही, …" continuation sentence merges into the body paragraph
    // ("" when the letter has none — 198 has no Further… sentence).
    formsNote: (ir) => formsNoteText(ir),
    // "एल.सी. संख्या" header only when at least one member row carries an
    // L.C. number — 5-column letters (129/162/180) get no empty column.
    lcHeader: (ir) => lcHeaderText(ir),
    signatoryName: "signatoryName",
    signatoryDesignation: "signatoryDesignation",
    enclosureLine: (ir) => enclosureLineText(ir),
  },
  optionalFields: ["recipientAddressBlock", "enclosureLine", "memberIntro", "formsNote", "lcHeader"],
  rowLoopTag: "members",
  rowFieldMap: {
    slNo: "slNo",
    name: "name",
    accountNo: "accountNo",
    prevColliery: "prevColliery",
    currColliery: "currColliery",
    lcNo: "lcNo",
  },
};

// NOTE on per-stint structured rows: the template renders each member's
// multi-stint colliery history from the flat, newline-joined `prevColliery`
// value (the renderer's `linebreaks: true` turns each \n into a <w:br/>). A
// nested docxtemplater loop was researched (paragraphLoop and dash syntax)
// and rejected: both wrap the repeated body in a <w:p> nested inside the
// tag paragraph — schema-invalid OOXML that risks Word repair prompts. Keep
// the flat cell until a render-and-measure pipeline can validate a
// re-authored template (see assets/README.md).

// ---------------------------------------------------------------------------
// cmpf-extract-out-v1 — Extract supply/transfer letter (no member table)
// ---------------------------------------------------------------------------
//
// Track B home for the Extract-out letters the office actually sends
// (verified against the real Surendra Koiri and Susanta Kumar Nayak
// letters): same letterhead, page setup, fonts and right-aligned sign-off as
// the L.C.-out template, with the address rendered from one
// {recipientAddressBlock} placeholder (real extract addresses are English
// "To The Regional Commissioner…" blocks of varying length) and the body
// from {body1} (the real letters' body is a single sentence naming the
// member inline). The body placeholders are filled from the IR's paragraph
// blocks (address lines are excluded via the address-block lines).

/** The translated file-no/date header line (code left, दिनांक right) — the
 * template renders it VERBATIM so each letter keeps its source's separator
 * (दिनांक- vs दिनांक:) and exact code spelling. */
function fileNoLine(ir: DocumentIR): string {
  const meta = ir.blocks.find(
    (b): b is Extract<DocumentIR["blocks"][number], { type: "meta-line" }> => b.type === "meta-line",
  );
  return meta?.value ?? "";
}

/** The translated enclosure closing line (संलग्न- …) or "" when the letter
 * has none — the template's {enclosureLine} paragraph is dropped entirely
 * for empty values. The IR paragraph is the already-translated line; a
 * legacy saved content that still carries an English designation tail
 * ("संलग्न- As above Regional Commissioner-I") is normalized to the
 * reference form (संलग्न- उपरोक्तानुसार). */
export function enclosureLineText(ir: DocumentIR): string {
  const t = paragraphTexts(ir).find((x) => /^संलग्न[\s:：-]/.test(x));
  if (!t) return "";
  const value = t.replace(/^संलग्न[\s:：-]+/, "").trim();
  const { core } = stripDesignationTail(value);
  if (core === "") return ""; // bare marker + designation — nothing to enclose
  const mapped =
    core.toLowerCase() === "as above" ? "उपरोक्तानुसार" : transliterateRef(core);
  return `संलग्न- ${mapped}`;
}

function paragraphTexts(ir: DocumentIR): string[] {
  return ir.blocks
    .filter(
      (b): b is { type: "paragraph"; runs: { text: string }[] } => b.type === "paragraph",
    )
    .map((b) => b.runs.map((r) => r.text).join("").trim())
    .filter(Boolean);
}

/** "the following members" → निम्नलिखित; "under mentioned members" → नीचे
 * उल्लिखित — from the letter's own translated body. */
function memberIntroText(ir: DocumentIR): string {
  const body = paragraphTexts(ir).join("\n");
  if (/नीचे उल्लिखित सदस्य/.test(body)) return "नीचे उल्लिखित";
  return "निम्नलिखित";
}

/** The "साथ ही, …" sentence merged into the body paragraph, or "". */
function formsNoteText(ir: DocumentIR): string {
  const t = paragraphTexts(ir).find((x) => x.startsWith("साथ ही"));
  return t ? ` ${t}` : "";
}

/** "एल.सी. संख्या" when any member row carries an L.C. number, else "". */
function lcHeaderText(ir: DocumentIR): string {
  const table = ir.blocks.find((b) => b.type === "table");
  if (table?.type !== "table") return "";
  const hasLc = table.rows.some(
    (r) => (r as { cellsByKey?: Record<string, string> }).cellsByKey?.lcNo?.trim() !== "",
  );
  return hasLc ? "एल.सी. संख्या" : "";
}

const normLine = (s: string) => s.replace(/[,.]$/, "").trim();

function extractBodyParagraphs(ir: DocumentIR): string[] {
  const addressLines = new Set(
    ir.blocks
      .filter((b) => b.type === "address-block")
      .flatMap((b) => (b.type === "address-block" ? b.lines.map(normLine) : [])),
  );
  return paragraphTexts(ir).filter(
    (t) =>
      !/^(सेवा में|प्रति|to\s+the\s+regional\s+commissioner)/i.test(t) &&
      !/^संलग्न[\s:：-]/.test(t) &&
      !addressLines.has(normLine(t)),
  );
}

/** The full address block (all lines, \n-joined → <w:br/> in the template),
 * from the IR address-block, or parsed from rawText when the block is
 * missing (belt-and-braces — the IR parser handles the real letters).
 * `noOpener` skips prepending the सेवा में, / प्रति, / To opener — the
 * L.C.-out template already carries a fixed सेवा में, paragraph above the
 * address placeholder, so prepending would double it. */
export function addressBlockText(ir: DocumentIR, noOpener = false): string {
  const block = ir.blocks.find(
    (b): b is Extract<DocumentIR["blocks"][number], { type: "address-block" }> =>
      b.type === "address-block",
  );
  let lines: string[] = [];
  if (block && block.lines.length > 0) {
    lines = [...block.lines];
  } else {
    const rawLines = ir.rawText.split("\n");
    const start = rawLines.findIndex((l) =>
      /^(सेवा में|प्रति|to\s+the\s+regional\s+commissioner)/i.test(l.trim()),
    );
    if (start !== -1) {
      const addr: string[] = [];
      for (let i = start + 1; i < rawLines.length; i++) {
        const t = rawLines[i].trim();
        if (t.length === 0 || /^(विषय|संदर्भ|महोदय)/.test(t)) break;
        addr.push(t.replace(/,$/, "").trim());
      }
      lines = addr.filter(Boolean);
    }
  }
  if (lines.length === 0) return "";

  // Prepend the address opener (सेवा में, / प्रति, / To) when the block
  // itself starts with the designation — the English one-line "To The
  // Regional Commissioner" IS the designation and already leads the block.
  const opener = ir.rawText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^(सेवा में|प्रति|to)[.,:]?$/i.test(l));
  if (!noOpener && opener && !/^(सेवा में|प्रति|to)[.,:]?$/i.test(lines[0].trim())) {
    lines = [opener, ...lines];
  } else if (noOpener && /^(सेवा में|प्रति|to)[.,:]?$/i.test(lines[0].trim())) {
    // The L.C.-out template carries the opener as its own fixed paragraph —
    // drop a leading opener the IR block already includes.
    lines = lines.slice(1);
  }

  // Reference comma rule: every address line except the last takes a trailing
  // comma (क्षेत्रीय आयुक्त, … संबलपुर, ओडिशा 768020) unless it already
  // carries punctuation, its own comma, or a label (धनबाद, डी-II,
  // सीएमपीएफ, सिंगरौली, एटी:- जगन्नाथ कॉलोनी stay bare). Lines are tidied
  // first (fully-covered Latin lines read in Hindi, stray OCR spaces, label
  // colons, the PIN spacing) — shared with the text pass so both produce
  // identical addresses.
  const withCommas = lines.map((t, i) => {
    const s = refineAddressLine(t);
    if (i < lines.length - 1 && addressLineNeedsComma(s)) {
      return `${s},`;
    }
    return s;
  });
  return withCommas.join("\n");
}

const cmpfExtractOutV1: TemplateDefinition = {
  id: "cmpf-extract-out-v1",
  label: "CMPF Extract Supply / Transfer Letter",
  score: (ir, rawText) => {
    let s = orgScore(rawText);
    if (EXTRACT_RE.test(rawText)) s += 25;
    if (/वी\.?\s*वी\.?|statement/i.test(rawText)) s += 10;
    if (CMPF_ACCOUNT_RE.test(rawText)) s += 5;
    // Structural signals: a real CMPF letter (signatory + ref + subject) that
    // is NOT an L.C.-out (no member table, no Ledger Card wording).
    if (ir.fields.signatoryName) s += 10;
    if (ir.fields.refCode) s += 5;
    if (ir.fields.subject) s += 5;
    const hasTable = ir.blocks.some((b) => b.type === "table");
    if (hasTable) s -= 40;
    if (/ledger\s+card/i.test(rawText)) s -= 30;
    // "Inter Regional Transfer" alone is NOT an extract penalty when the
    // letter IS an extract — including the Devanagari form (एक्सट्रैक्ट).
    if (LC_TRANSFER_RE.test(rawText) && !EXTRACT_RE.test(rawText)) s -= 30;
    return s;
  },
  assetPath: "templates/cmpf-extract-out-v1.docx",
  fieldMap: {
    fileNoLine: (ir) => fileNoLine(ir),
    recipientAddressBlock: (ir) => addressBlockText(ir),
    subject: "subject",
    referenceLine: "referenceLine",
    body1: (ir) => extractBodyParagraphs(ir).join("\n"),
    signatoryName: "signatoryName",
    signatoryDesignation: "signatoryDesignation",
    enclosureLine: (ir) => enclosureLineText(ir),
  },
  optionalFields: ["recipientAddressBlock", "body1", "enclosureLine"],
};

export const TEMPLATE_REGISTRY: TemplateDefinition[] = [cmpfLcOutV1, cmpfExtractOutV1];

/**
 * Pick the best-matching template family for a document: the highest score
 * above CONFIDENCE_FLOOR, or undefined when no family is confident enough
 * (Track A then renders).
 */
export function findMatchingTemplate(ir: DocumentIR, rawText: string): TemplateDefinition | undefined {
  let best: TemplateDefinition | undefined;
  let bestScore = CONFIDENCE_FLOOR - 1;
  for (const t of TEMPLATE_REGISTRY) {
    const s = t.score(ir, rawText);
    if (s > bestScore) {
      best = t;
      bestScore = s;
    }
  }
  return best;
}
