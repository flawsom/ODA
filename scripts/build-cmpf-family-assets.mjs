// scripts/build-cmpf-family-assets.mjs
//
// Builds the two derived CMPF template assets from the verified
// cmpf-lc-out-v1.docx, keeping the letterhead image, page setup, fonts and
// right-aligned sign-off byte-identical:
//
//   cmpf-extract-out-v1.docx  — the Extract-out family (table-less CMPFO
//                               letters). The L.C.-out procedure line, the
//                               "यह सुनिश्चित…" paragraph and the member
//                               table are replaced by generic {body1..3}
//                               paragraphs, and the static "कृपया…" request
//                               line becomes {closingLine} — so the office's
//                               table-less letters render through Track B
//                               instead of crashing the old engine.
//   cmpf-universal-skeleton.docx — the single shared CMPFO letterhead
//                               carrier: the same letterhead image, page
//                               setup and fonts with a minimal {body}
//                               placeholder. Track A's generic renderer
//                               (templates/genericRenderer.ts) pulls the
//                               letterhead from here.
//
// Both are written to BOTH template locations (assets/ authoring copy +
// public/templates/ shipped copy — the registry assetPath resolves against
// public/templates/). Idempotent: re-running skips files that already
// contain the new placeholders.
//
// Run: bun scripts/build-cmpf-family-assets.mjs

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import PizZip from "pizzip";

const SOURCE = "public/templates/cmpf-lc-out-v1.docx";
const LOCATIONS = [
  "src/lib/oda/templates/assets/",
  "public/templates/",
];

const MANGAL =
  '<w:rFonts w:ascii="Mangal" w:eastAsia="Mangal" w:hAnsi="Mangal" w:cs="Mangal"/>';

/** A justified Mangal body paragraph holding one placeholder. */
const bodyPara = (text) =>
  `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr>${MANGAL}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

const PARA_RE = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;

/** Replace the FIRST paragraph whose joined <w:t> text contains `needle`. */
function replacePara(xml, needle, replacement) {
  let found = false;
  const out = xml.replace(PARA_RE, (para) => {
    if (found) return para;
    const text = [...para.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((m) => m[1])
      .join("");
    if (!text.includes(needle)) return para;
    found = true;
    return replacement;
  });
  if (!found) throw new Error(`paragraph containing "${needle}" not found`);
  return out;
}

/** Replace the single member table with `replacement` ("" deletes it). */
function replaceTable(xml, replacement) {
  const m = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/);
  if (!m) throw new Error("member table (<w:tbl>) not found");
  return xml.replace(m[0], replacement);
}

function build(sourceXml) {
  // --- Extract-out template ------------------------------------------------
  // Real extract letters address the recipient in English ("To The Regional
  // Commissioner / C.M.P.F, Singrauli / …") with a variable-length block, so
  // the six L.C.-out address paragraphs collapse into one
  // {recipientAddressBlock} placeholder (\n-joined lines → <w:br/> via the
  // renderer's linebreaks). The L.C.-out procedure line, the "यह सुनिश्चित…"
  // paragraph and the member table become one {body1}; the static "कृपया…"
  // request line is dropped (extract letters close straight after the body).
  let extract = sourceXml;
  extract = replacePara(extract, "सेवा में,", bodyPara("{recipientAddressBlock}"));
  for (const needle of ["{recipientDesignation}", "{recipientOrg}", "{recipientLine1}", "{recipientLine2}", "जिला. {recipientDistrict}", "{recipientState}"]) {
    extract = replacePara(extract, needle, "");
  }
  extract = replacePara(extract, "{procedureOfficeLocation}", bodyPara("{body1}"));
  extract = replacePara(extract, "यह सुनिश्चित", "");
  extract = replaceTable(extract, "");
  extract = replacePara(extract, "कृपया उपरोक्त", "");

  // --- Universal skeleton (letterhead carrier for Track A) -----------------
  let skeleton = sourceXml;
  skeleton = replacePara(skeleton, "{procedureOfficeLocation}", bodyPara("{body}"));
  skeleton = replacePara(skeleton, "यह सुनिश्चित", "");
  skeleton = replaceTable(skeleton, "");
  skeleton = replacePara(skeleton, "कृपया उपरोक्त", "");

  return { extract, skeleton };
}

function writeAsset(zip, xml, filename) {
  zip.file("word/document.xml", xml);
  for (const dir of LOCATIONS) {
    const path = `${dir}${filename}`;
    writeFileSync(path, zip.generate({ type: "nodebuffer" }));
    console.log(`wrote ${path}`);
  }
}

const sourceXml = new PizZip(readFileSync(SOURCE)).file("word/document.xml").asText();
const { extract, skeleton } = build(sourceXml);

// Idempotency: a previously-built file already contains the new placeholders.
const extractDone = LOCATIONS.some((d) =>
  existsSync(`${d}cmpf-extract-out-v1.docx`) &&
  new PizZip(readFileSync(`${d}cmpf-extract-out-v1.docx`))
    .file("word/document.xml").asText().includes("{recipientAddressBlock}"),
);
const skeletonDone = LOCATIONS.some((d) =>
  existsSync(`${d}cmpf-universal-skeleton.docx`) &&
  new PizZip(readFileSync(`${d}cmpf-universal-skeleton.docx`))
    .file("word/document.xml").asText().includes("{body}"),
);

const baseZip = new PizZip(readFileSync(SOURCE));
if (extractDone) {
  console.log("cmpf-extract-out-v1.docx already built — skipping (idempotent).");
} else {
  writeAsset(baseZip, extract, "cmpf-extract-out-v1.docx");
}
if (skeletonDone) {
  console.log("cmpf-universal-skeleton.docx already built — skipping (idempotent).");
} else {
  writeAsset(baseZip, skeleton, "cmpf-universal-skeleton.docx");
}
