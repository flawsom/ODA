// Golden-style verification for the Track B precision template engine.
//
// Renders the real CMPF L.C.-Out translation fixture (both the flattened
// one-cell-per-line shape the instant engine emits and the pipe-delimited
// shape DOCX structural sources produce) through the bundled
// cmpf-lc-out-v1.docx template and asserts the OOXML result:
//   • template matched and rendered without throwing,
//   • every member row cloned (2 rows), names/accounts/collieries present,
//   • the reference header, procedure line and signature blocks filled,
//   • no leftover {placeholders} and no engine/UI furniture in the file.
//
// Run: bun scripts/verify-precision.ts
// Exits non-zero on any failed assertion.

import { readFileSync } from "node:fs";
import PizZip from "pizzip";
import { FLATTENED_FIXTURE, PIPE_FIXTURE, JENA_FIXTURE, EXTRACT_FIXTURE, NAYAK_FIXTURE, TRACK_A_FIXTURE } from "./fixtures-cmpf";
import { buildDocumentIR } from "../src/lib/oda/irBuilder";
import {
  renderTemplateFromBuffer,
} from "../src/lib/oda/templates/precisionEngine";
import { findMatchingTemplate } from "../src/lib/oda/templates/registry";
import { toDocxBlob } from "../src/lib/oda/export";

let failures = 0;
function check(name: string, cond: boolean): void {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) failures += 1;
}

/** Concatenated <w:t> text of a rendered document, with XML entities decoded
 * (docxtemplater escapes `"` as &quot; / `&` as &amp; — Word shows the raw
 * characters, so assertions must too). */
function textOf(xml: string): string {
  return [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join("")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// The golden fixtures (FLATTENED_FIXTURE / PIPE_FIXTURE) now live in
// ./fixtures-cmpf.ts so the fit-scan harness measures the exact same letters.

const TEMPLATE_BUF = readFileSync("public/templates/cmpf-lc-out-v1.docx");

async function renderAndVerify(label: string, content: string): Promise<void> {
  console.log(`\n=== ${label} ===`);
  const ir = buildDocumentIR({
    content,
    language: "Hindi",
    documentName: "198-SHRI TONMOY BHATTACHARJEE & HIROK SARKAR-L.C. OUT (REGIONAL OFFICE-III).docx",
  });
  const match = findMatchingTemplate(ir, ir.rawText);
  check("template matched", match?.id === "cmpf-lc-out-v1");

  check("refCode extracted", ir.fields.refCode === "118/विविध/एल.सी.-आउट/आरएनजे-21 एवं 14/आर-I/एएसएन/");
  check("date extracted", ir.fields.date === "09-07-2026");
  check("recipient designation extracted", ir.fields.recipientDesignation === "सहायक आयुक्त");
  check("recipient org extracted", ir.fields.recipientOrg === "कोयला खान भविष्य निधि संगठन");
  check("recipient line1 extracted", ir.fields.recipientLine1 === "बी.बी. कॉलेज रोड");
  check("recipient line2 extracted", ir.fields.recipientLine2 === "आसनसोल, क्षेत्र-III");
  check("district extracted", (ir.fields.recipientDistrict ?? "").includes("पश्चिम बर्धमान"));
  check("state extracted", ir.fields.recipientState === "पश्चिम बंगाल");
  check("subject extracted", ir.fields.subject === "लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण");
  check(
    "reference line extracted",
    (ir.fields.referenceLine ?? "").startsWith("सीपीएफ/59/एल.सी.-रिक्वेस्ट/बीकेआर-32/आर-III/एएसएन/41"),
  );
  check("procedure location extracted", ir.fields.procedureOfficeLocation === "धनबाद");
  check("procedure order no extracted", ir.fields.procedureOrderNo === "35");
  check("procedure order date extracted", ir.fields.procedureOrderDate === "12.02.1975");
  check("signatory name extracted", ir.fields.signatoryName === "अजय कुमार सिंह");
  check("signatory designation extracted", ir.fields.signatoryDesignation === "क्षेत्रीय आयुक्त - I");

  const table = ir.blocks.find((b) => b.type === "table");
  check("table block present", table?.type === "table");
  if (table?.type === "table") {
    check("table has 2 member rows", table.rows.length === 2);
    check(
      "row 1 prev colliery multi-line history",
      (table.rows[0].cellsByKey?.prevColliery ?? "").includes("खंडरा कोलियरी") &&
        (table.rows[0].cellsByKey?.prevColliery ?? "").includes("(20.04.2015 से 05.06.2025 तक)") &&
        (table.rows[0].cellsByKey?.prevColliery ?? "").includes("बांकोला क्षेत्र कार्यालय"),
    );
    check("row 1 current colliery", table.rows[0].cellsByKey?.currColliery === "ईसीएल मुख्यालय, ईसीएल");
    check("row 2 name", table.rows[1].cellsByKey?.name === "श्री हिरोक सरकार");
    check("row 2 account no", table.rows[1].cellsByKey?.accountNo === "एनजीपी/64/79");
  }

  const blob = renderTemplateFromBuffer(TEMPLATE_BUF, match!, ir);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const zip = new PizZip(bytes);
  const xml = zip.file("word/document.xml")?.asText() ?? "";
  check("rendered document.xml present", xml.length > 0);

  // Assert text against concatenated <w:t> nodes (document order) rather than
  // raw XML: the FIXED template was re-saved in Word, which fragments literal
  // and placeholder text across runs, so a filled string can span several
  // <w:t> elements even though Word displays it as one contiguous line.
  const textOnly = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join("");

  check("reference header filled", textOnly.includes("सीपीएफ/118/विविध/एल.सी.-आउट/आरएनजे-21 एवं 14/आर-I/एएसएन/"));
  check("date filled", textOnly.includes("09-07-2026"));
  check("address block filled", textOnly.includes("सहायक आयुक्त") && textOnly.includes("कोयला खान भविष्य निधि संगठन"));
  check("subject filled", textOnly.includes("लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण"));
  check("procedure line filled", textOnly.includes("आदेश संख्या-35 दिनांक-12.02.1975"));
  check("member 1 name filled", textOnly.includes("श्री तन्मय भट्टाचार्य"));
  check("member 1 account filled", textOnly.includes("आरएनजे/21/1964"));
  check("member 1 prev history filled", textOnly.includes("खंडरा कोलियरी, बांकोला क्षेत्र"));
  check("member 2 name filled", textOnly.includes("श्री हिरोक सरकार"));
  check("member 2 account filled", textOnly.includes("एनजीपी/64/79"));
  check("row loop cloned (2 × current colliery)", (textOnly.match(/ईसीएल मुख्यालय, ईसीएल/g) ?? []).length === 2);
  check("signatory filled", textOnly.includes("अजय कुमार सिंह") && textOnly.includes("क्षेत्रीय आयुक्त - I"));
  // Brace check must scan <w:t> text only: the letterhead's DrawingML carries
  // a legitimate Office GUID ({28A0092B-...}) whose braces are not
  // placeholders — unresolved docxtemplater tags, by contrast, always end up
  // in text nodes.
  check("no leftover placeholders in text", !/[{}]/.test(textOnly));
  check("no UI furniture", !/adaptive engine|kept in the source language|Match Input|ODA Translation/i.test(textOnly));
}

await renderAndVerify("flattened table shape (instant engine)", FLATTENED_FIXTURE);
await renderAndVerify("pipe-delimited table shape (DOCX structural sources)", PIPE_FIXTURE);

// --- scored matcher: the REAL Khadal Jena letter (5-col table, English
// wording, "दिनांक" sans colon) that the OLD exact-AND matcher missed --------
console.log("\n=== Khadal Jena (real letter, 1 row × 5 columns, English wording) ===");
{
  const ir = buildDocumentIR({
    content: JENA_FIXTURE,
    language: "Hindi",
    documentName: "162_Khadal_Jena_LC_out",
  });
  const match = findMatchingTemplate(ir, ir.rawText);
  check("Jena routed to cmpf-lc-out-v1 (scored matcher beats exact-AND)", match?.id === "cmpf-lc-out-v1");
  check("Jena refCode extracted", ir.fields.refCode === "118/विविध/एल.सी.-आउट/आर-I/एएसएन/");
  check("Jena date extracted (दिनांक sans colon)", ir.fields.date === "24/04/2026");
  check("Jena subject extracted", ir.fields.subject === "Inter Regional Transfer of Ledger Card, DA, PS-3 & 4");
  check("Jena English procedure line extracted",
    ir.fields.procedureOrderNo === "35" && ir.fields.procedureOrderDate === "12.02.1975" && ir.fields.procedureOfficeLocation === "Dhanbad");
  check("Jena designation extracted (To The Regional Commissioner)", ir.fields.recipientDesignation === "To The Regional Commissioner");
  const table = ir.blocks.find((b) => b.type === "table");
  check("Jena 5-column table parsed with 1 member row", table?.type === "table" && table.rows.length === 1);
  if (table?.type === "table") {
    check("Jena member row cells",
      table.rows[0].cellsByKey?.name === "Shri Khadal Jena" &&
      table.rows[0].cellsByKey?.accountNo === "RNJ/22/1586" &&
      table.rows[0].cellsByKey?.prevColliery === "Moira Colliery (RNJ/22)" &&
      table.rows[0].cellsByKey?.currColliery === "टीएलएचआर/10" &&
      table.rows[0].cellsByKey?.lcNo === "");
  }
  if (match && table?.type === "table") {
    const blob = renderTemplateFromBuffer(TEMPLATE_BUF, match, ir);
    const zip = new PizZip(new Uint8Array(await blob.arrayBuffer()));
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const textOnly = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join("");
    check("Jena member filled in the gold template", textOnly.includes("Shri Khadal Jena") && textOnly.includes("RNJ/22/1586") && textOnly.includes("Moira Colliery (RNJ/22)"));
    check("Jena procedure line rendered in gold Hindi", textOnly.includes("आदेश संख्या-35 दिनांक-12.02.1975"));
    check("Jena single row cloned once", (textOnly.match(/Moira Colliery/g) ?? []).length === 1);
    check("Jena closing right-aligned", (xml.match(/<w:jc w:val="right"\/>/g) ?? []).length >= 3);
  }
}

// --- table-less Extract-out family: the REAL Koiri + Nayak letters --------
async function verifyExtract(label: string, content: string, member: string, account: string, orgLine: string): Promise<void> {
  console.log(`\n=== ${label} (real Extract-out letter, no member table) ===`);
  const EXTRACT_BUF = readFileSync("public/templates/cmpf-extract-out-v1.docx");
  const ir = buildDocumentIR({
    content,
    language: "Hindi",
    documentName: label,
  });
  const match = findMatchingTemplate(ir, ir.rawText);
  check(`${label} routed to cmpf-extract-out-v1`, match?.id === "cmpf-extract-out-v1");
  check(`${label} IR has no table block`, !ir.blocks.some((b) => b.type === "table"));
  check(`${label} designation extracted`, ir.fields.recipientDesignation === "To The Regional Commissioner");
  check(`${label} signatory extracted`, ir.fields.signatoryName === "अजय कुमार सिंह");
  if (match) {
    const blob = renderTemplateFromBuffer(EXTRACT_BUF, match, ir); // must NOT throw on no table
    const zip = new PizZip(new Uint8Array(await blob.arrayBuffer()));
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    const textOnly = textOf(xml);
    // The address block is rendered in the gold Hindi (e.g. the org line
    // "C.M.P.F, Singrauli" reads "सीएमपीएफ, सिंगरौली"), so assert the
    // translated form rather than the raw English field.
    check(`${label} address block filled`, textOnly.includes("To The Regional Commissioner") && textOnly.includes(orgLine));
    check(`${label} member sentence filled`, textOnly.includes(member) && textOnly.includes(account));
    check(`${label} subject filled`, textOnly.includes(ir.fields.subject ?? ""));
    check(`${label} signatory filled`, textOnly.includes("अजय कुमार सिंह") && textOnly.includes("क्षेत्रीय आयुक्त - I"));
    check(`${label} closing right-aligned`, (xml.match(/<w:jc w:val="right"\/>/g) ?? []).length >= 3);
    check(`${label} letterhead image present`, Object.keys(zip.files).some((n) => /^word\/media\//.test(n)));
    check(`${label} no leftover placeholders`, !/[{}]/.test(textOnly));
  }
}

await verifyExtract("153_Surendra_Koiri_extract", EXTRACT_FIXTURE, "Shri Surendra Koiri", "RNJ/38/520", "सीएमपीएफ, सिंगरौली");
await verifyExtract("179_Susanta_Kumar_Nayak_extract", NAYAK_FIXTURE, "Shri Susanta Kumar Nayak", "RNJ/38/3274", "कोयला खान भविष्य निधि");

// --- full routing path (export.ts → toDocxBlob) with a fetch mock ----------
console.log("\n=== full routing (toDocxBlob + asset fetch) ===");
{
  const templateBytes = TEMPLATE_BUF;
  const EXTRACT_BUF = readFileSync("public/templates/cmpf-extract-out-v1.docx");
  const SKELETON_BUF = readFileSync("public/templates/cmpf-universal-skeleton.docx");
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("cmpf-lc-out-v1.docx")) {
      return new Response(templateBytes, { status: 200 });
    }
    if (url.includes("cmpf-extract-out-v1.docx")) {
      return new Response(EXTRACT_BUF, { status: 200 });
    }
    if (url.includes("cmpf-universal-skeleton.docx")) {
      return new Response(SKELETON_BUF, { status: 200 });
    }
    return realFetch(input, init);
  }) as typeof fetch;

  try {
    const blob = await toDocxBlob({
      documentName: "198-SHRI TONMOY BHATTACHARJEE & HIROK SARKAR-L.C. OUT (REGIONAL OFFICE-III).docx",
      content: FLATTENED_FIXTURE,
      language: "Hindi",
      formality: "Match Input",
      strategy: "adaptive",
      createdAt: Date.now(),
      kind: "translation",
      sourceFormat: "docx",
      letterhead: null,
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const zip = new PizZip(bytes);
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    check("toDocxBlob routed into Track B (2 member rows)",
      (xml.match(/ईसीएल मुख्यालय, ईसीएल/g) ?? []).length === 2);
    const tText = [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join("");
    check("toDocxBlob output has no placeholders", !/[{}]/.test(tText));

    // A response (kind !== "translation") must NEVER be template-fit.
    const responseBlob = await toDocxBlob({
      documentName: "198-SHRI TONMOY BHATTACHARJEE & HIROK SARKAR-L.C. OUT (REGIONAL OFFICE-III).docx",
      content: "To, The Commissioner\nSir,\nThis is a response to your letter dated 07/07/2026.",
      language: "English",
      formality: "Formal",
      strategy: "adaptive",
      createdAt: Date.now(),
      kind: "response",
      sourceFormat: "docx",
      letterhead: null,
    });
    const rbytes = new Uint8Array(await responseBlob.arrayBuffer());
    const rzip = new PizZip(rbytes);
    const rxml = rzip.file("word/document.xml")?.asText() ?? "";
    check("responses render generically (never template-fit)",
      rxml.includes("This is a response to your letter dated 07/07/2026."));

    // Track A for a CMPF-signalled letter with no family match: the generic
    // CMPF renderer must apply the shared letterhead + body from the IR.
    const trackABlob = await toDocxBlob({
      documentName: "CMPF-Signalled-Unknown-Type",
      content: TRACK_A_FIXTURE,
      language: "Hindi",
      formality: "Formal",
      strategy: "adaptive",
      createdAt: Date.now(),
      kind: "translation",
      sourceFormat: "docx",
      letterhead: null,
    });
    const tbytes = new Uint8Array(await trackABlob.arrayBuffer());
    const tzip = new PizZip(tbytes);
    check("Track A CMPF letterhead image embedded from the universal skeleton",
      Object.keys(tzip.files).some((n) => /^word\/media\//.test(n)));
    const txml = tzip.file("word/document.xml")?.asText() ?? "";
    const trackAText = [...txml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join("");
    check("Track A CMPF body rendered from the IR blocks",
      trackAText.includes("निम्नलिखित सदस्य के संबंध में आवेदन"));
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log(`\n${failures === 0 ? "✅ All precision-template checks passed." : `❌ ${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
