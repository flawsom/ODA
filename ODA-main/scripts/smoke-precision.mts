// scripts/smoke-precision.mts
//
// Headless smoke test for Track B (precision template rendering):
//   1. the closing block stays right-aligned after a real docxtemplater render
//   2. the shrink-to-fit tiers pin run font sizes and tighten margins as
//      designed, and the overflow flag fires for the heaviest letters
//   3. the letterhead image survives the render + rewrite pass
//
// Run: bun scripts/smoke-precision.mts

import { readFileSync } from "node:fs";
import PizZip from "pizzip";
import {
  pickFontTier,
  renderTemplateFromBuffer,
} from "../src/lib/oda/templates/precisionEngine";
import { renderGenericCmpfDocx } from "../src/lib/oda/templates/genericRenderer";
import { getExportLog } from "../src/lib/oda/exportLog";
import { findMatchingTemplate, type TemplateDefinition } from "../src/lib/oda/templates/registry";
import { buildDocumentIR } from "../src/lib/oda/irBuilder";
import { FLATTENED_FIXTURE, MEDIUM_FIXTURE, HEAVY_FIXTURE, EXTRACT_FIXTURE, NAYAK_FIXTURE, JENA_FIXTURE, TRACK_A_FIXTURE } from "./fixtures-cmpf";

const TEMPLATE = "public/templates/cmpf-lc-out-v1.docx";

const templateDef: TemplateDefinition = {
  id: "cmpf-lc-out-v1",
  label: "CMPF Ledger Card Transfer-Out Letter",
  score: () => 100,
  assetPath: "templates/cmpf-lc-out-v1.docx",
  fieldMap: {
    refCode: "refCode",
    date: "date",
    recipientDesignation: "recipientDesignation",
    recipientOrg: "recipientOrg",
    recipientLine1: "recipientLine1",
    recipientLine2: "recipientLine2",
    recipientDistrict: "recipientDistrict",
    recipientState: "recipientState",
    subject: "subject",
    referenceLine: "referenceLine",
    procedureOfficeLocation: "procedureOfficeLocation",
    procedureOrderNo: "procedureOrderNo",
    procedureOrderDate: "procedureOrderDate",
    signatoryName: "signatoryName",
    signatoryDesignation: "signatoryDesignation",
  },
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

// The light/medium/heavy letters come from scripts/fixtures-cmpf.ts — the
// SAME content the fit-scan and verify-precision harnesses render, so tier
// selection, smoke assertions, and CI page counts all measure identical
// letters (and the gold heavy fixture is what actually trips the overflow
// flag).
const lightIr = buildDocumentIR({
  content: FLATTENED_FIXTURE,
  language: "Hindi",
  documentName: "light-2rows",
});
const mediumIr = buildDocumentIR({
  content: MEDIUM_FIXTURE,
  language: "Hindi",
  documentName: "medium-5rows",
});
const heavyIr = buildDocumentIR({
  content: HEAVY_FIXTURE,
  language: "Hindi",
  documentName: "heavy-8rows",
});
const extractIr = buildDocumentIR({
  content: EXTRACT_FIXTURE,
  language: "Hindi",
  documentName: "extract-out",
});
const nayakIr = buildDocumentIR({
  content: NAYAK_FIXTURE,
  language: "Hindi",
  documentName: "nayak-extract",
});
const jenaIr = buildDocumentIR({
  content: JENA_FIXTURE,
  language: "Hindi",
  documentName: "jena-lc-out",
});
const trackAIr = buildDocumentIR({
  content: TRACK_A_FIXTURE,
  language: "Hindi",
  documentName: "track-a-generic",
});

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`ok:   ${msg}`);
  }
}

async function xmlOf(blob: Blob): Promise<string> {
  const buf = Buffer.from(await blob.arrayBuffer());
  const zip = new PizZip(buf);
  return zip.file("word/document.xml").asText();
}

async function mediaOf(blob: Blob): Promise<string[]> {
  const zip = new PizZip(Buffer.from(await blob.arrayBuffer()));
  return Object.keys(zip.files).filter((n) => n.startsWith("word/media/") && !n.endsWith("/"));
}

// When WRITE_LETTERS=1 (the CI render-and-measure workflow), persist the
// rendered letters so LibreOffice can convert them to PDF and count pages.
const writeLetters = process.env.WRITE_LETTERS === "1";
const LETTERS_DIR = ".tmp-letters";

async function persist(name: string, blob: Blob): Promise<void> {
  if (!writeLetters) return;
  const { mkdirSync, writeFileSync } = await import("node:fs");
  mkdirSync(LETTERS_DIR, { recursive: true });
  writeFileSync(`${LETTERS_DIR}/${name}.docx`, Buffer.from(await blob.arrayBuffer()));
  console.log(`wrote ${LETTERS_DIR}/${name}.docx`);
}

const tpl = readFileSync(TEMPLATE);

// --- Tier selection -------------------------------------------------------
const lightTier = pickFontTier(lightIr);
const mediumTier = pickFontTier(mediumIr);
const heavyTier = pickFontTier(heavyIr);
console.log(`light weight → tier ${lightTier.fontSizePt}pt (overflow: ${lightTier.possibleOverflow})`);
console.log(`medium weight → tier ${mediumTier.fontSizePt}pt (overflow: ${mediumTier.possibleOverflow})`);
console.log(`heavy weight → tier ${heavyTier.fontSizePt}pt (overflow: ${heavyTier.possibleOverflow})`);
// Calibrated tiers (see pickFontTier): the reference letter fits one page
// at 9pt under the CI renderer; the 5-row stress case needs 8pt/900 twips.
assert(lightTier.fontSizePt === 9 && !lightTier.possibleOverflow, "reference-like letter → 9pt, no overflow flag");
assert(mediumTier.fontSizePt === 8 && mediumTier.topBottomMarginTwips === 900 && !mediumTier.possibleOverflow, "5-row multi-stint letter → 8pt/900-twips, no overflow flag");
assert(heavyTier.fontSizePt === 8 && heavyTier.possibleOverflow === true && heavyTier.topBottomMarginTwips === 900, "heaviest letter → 8pt, 900-twip margins, overflow flag");

// --- Renders --------------------------------------------------------------
const mediumBlob = renderTemplateFromBuffer(tpl, templateDef, mediumIr);
const mediumXml = await xmlOf(mediumBlob);
const mediumSzs = [...mediumXml.matchAll(/<w:sz w:val="(\d+)"\/>/g)].map((m) => m[1]);
assert(mediumSzs.length > 0 && mediumSzs.every((v) => v === "16"), `medium render pins every run to 8pt (${new Set(mediumSzs).size} distinct size)`);
await persist("letter-medium-5rows-8pt", mediumBlob);

const lightBlob = renderTemplateFromBuffer(tpl, templateDef, lightIr);
const lightXml = await xmlOf(lightBlob);
await persist("letter-light-2rows-9pt", lightBlob);
const rightCount = (lightXml.match(/<w:jc w:val="right"\/>/g) ?? []).length;
assert(rightCount === 3, `closing block right-aligned in rendered letter (${rightCount} × w:jc right)`);

const szs = [...lightXml.matchAll(/<w:sz w:val="(\d+)"\/>/g)].map((m) => m[1]);
assert(szs.length > 0 && szs.every((v) => v === "18"), `light render pins every run to 9pt (${new Set(szs).size} distinct size)`);

// Multi-stint history: member 1's two stints render inside the flat cell
// via <w:br/> (linebreaks) — the verified approach; see the registry note
// on why a nested loop was rejected.
// Gold fixture stint lines (colliery and dates are separate lines in the
// source table; the extractor \n-joins them and linebreaks renders each as
// a <w:br/> in the cell).
const STINT_A = "खंडरा कोलियरी, बांकोला क्षेत्र";
const STINT_B = "बांकोला क्षेत्र कार्यालय";
assert(lightXml.includes(STINT_A) && lightXml.includes(STINT_B), "both stints render in the cell");
assert((lightXml.match(/<w:br\b/g) ?? []).length >= 1, "stints joined with <w:br/> inside the cell");
assert(!lightXml.includes("{prevColliery}"), "no placeholder survives the render");

const pgMarLight = lightXml.match(/<w:pgMar[^>]*\/>/)?.[0] ?? "";
assert(/w:top="1440"/.test(pgMarLight), "light render keeps default 1\" top margin");

const heavyBlob = renderTemplateFromBuffer(tpl, templateDef, heavyIr);
const heavyXml = await xmlOf(heavyBlob);
await persist("letter-heavy-8rows-8pt-overflow", heavyBlob);
const heavySzs = [...heavyXml.matchAll(/<w:sz w:val="(\d+)"\/>/g)].map((m) => m[1]);
assert(heavySzs.length > 0 && heavySzs.every((v) => v === "16"), `heavy render pins every run to 8pt (${new Set(heavySzs).size} distinct size)`);
const pgMarHeavy = heavyXml.match(/<w:pgMar[^>]*\/>/)?.[0] ?? "";
assert(/w:top="900"/.test(pgMarHeavy) && /w:bottom="900"/.test(pgMarHeavy), "heavy render tightens top/bottom margins to 900 twips");
assert((heavyXml.match(/<w:jc w:val="right"\/>/g) ?? []).length === 3, "closing block still right-aligned on the heavy render");

// --- Letterhead + log -----------------------------------------------------
const media = await mediaOf(heavyBlob);
assert(media.length === 1 && /\.(png|jpe?g)$/i.test(media[0]), `letterhead image preserved (${media.join(", ")})`);

const last = getExportLog().slice(-2);
const heavyDecision = last.find((d) => d.templateId === "cmpf-lc-out-v1" && d.possibleOverflow === true);
assert(!!heavyDecision && heavyDecision.fontSizePt === 8, "export log carries fontSizePt + possibleOverflow for the heavy render");

// --- Table-less Extract-out family (Track B, no table required) ------------
const extractTier = pickFontTier(extractIr);
console.log(`extract weight → tier ${extractTier.fontSizePt}pt (overflow: ${extractTier.possibleOverflow})`);
assert(extractTier.fontSizePt === 9 && !extractTier.possibleOverflow, "extract-out letter → 9pt, no overflow flag");
const nayakTier = pickFontTier(nayakIr);
assert(nayakTier.fontSizePt === 9 && !nayakTier.possibleOverflow, "nayak extract letter → 9pt, no overflow flag");
const jenaTier = pickFontTier(jenaIr);
assert(jenaTier.fontSizePt === 9 && !jenaTier.possibleOverflow, "jena lc-out letter → 9pt, no overflow flag");

const extractDef = findMatchingTemplate(extractIr, extractIr.rawText);
assert(extractDef?.id === "cmpf-extract-out-v1", "extract fixture matched to the extract-out family");
const extractTpl = readFileSync("public/templates/cmpf-extract-out-v1.docx");
const extractBlob = renderTemplateFromBuffer(extractTpl, extractDef!, extractIr);
const extractXml = await xmlOf(extractBlob);
await persist("letter-extract-out", extractBlob);
assert(!extractXml.includes("<w:tbl"), "extract render has no member table");
assert(!extractXml.includes("{body1}") && !extractXml.includes("{recipientAddressBlock}"), "extract placeholders all resolve");
// The address block renders in the gold Hindi — the org line "C.M.P.F,
// Singrauli" reads "सीएमपीएफ, सिंगरौली" (the designation stays as-is).
assert(extractXml.includes("To The Regional Commissioner") && extractXml.includes("सीएमपीएफ, सिंगरौली"), "extract address block filled");
assert(extractXml.includes("Shri Surendra Koiri") && extractXml.includes("RNJ/38/520"), "extract member sentence filled");
assert((extractXml.match(/<w:jc w:val="right"\/>/g) ?? []).length === 3, "extract closing block right-aligned");
const extractMedia = await mediaOf(extractBlob);
assert(extractMedia.length === 1, `extract letterhead image preserved (${extractMedia.join(", ")})`);

// --- Track A generic renderer (CMPF-signalled, no family match) ------------
{
  const skeleton = readFileSync("public/templates/cmpf-universal-skeleton.docx");
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("cmpf-universal-skeleton.docx")) {
      return new Response(skeleton, { status: 200 });
    }
    return realFetch(input, init);
  }) as typeof fetch;
  try {
    const genericBlob = await renderGenericCmpfDocx(trackAIr);
    const genericXml = await xmlOf(genericBlob);
    await persist("letter-generic-track-a", genericBlob);
    assert(genericXml.includes("निम्नलिखित सदस्य के संबंध में आवेदन"), "track-a renders the IR body blocks");
    const gMedia = await mediaOf(genericBlob);
    assert(gMedia.length === 1 && /\.(png|jpe?g)$/i.test(gMedia[0]), `track-a embeds the shared letterhead (${gMedia.join(", ")})`);
    const gSzs = [...genericXml.matchAll(/<w:sz w:val="(\d+)"\/>/g)].map((m) => m[1]);
    assert(gSzs.length > 0 && gSzs.every((v) => v === "18"), `track-a pins runs to the 9pt tier (${new Set(gSzs).size} distinct size)`);
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log(process.exitCode === 1 ? "\nSMOKE FAILED" : "\nSMOKE PASSED — closing block right-aligned, tiers verified, letterhead intact, extract + track-a render");
