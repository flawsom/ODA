// scripts/patch-cmpf-address-block.mjs
//
// The L.C.-out template's address was authored from reference 198 as six
// fixed placeholders ({recipientDesignation}, {recipientOrg}, {recipientLine1},
// {recipientLine2}, "जिला. {recipientDistrict}", {recipientState}). Real
// L.C.-out letters each carry their own address shape — some have a जिला
// line, some don't; the comma pattern and line count vary — so the fixed
// placeholder set force-fit reference 198's shape onto every letter.
//
// This script collapses those six address paragraphs into ONE
// {recipientAddressBlock} paragraph, filled from the translated content
// (see addressBlockText in templates/registry.ts). The static "सेवा में,"
// paragraph above them is untouched. Nothing else in the document changes.
//
// Run: node scripts/patch-cmpf-address-block.mjs
// Idempotent: re-running is a no-op.

import PizZip from "pizzip";
import fs from "node:fs";

const FILES = [
  "public/templates/cmpf-lc-out-v1.docx",
  "src/lib/oda/templates/assets/cmpf-lc-out-v1.docx",
];
const XML_PATH = "word/document.xml";

/** Text of the six address paragraphs being replaced (exact, concatenated). */
const ADDRESS_TEXTS = [
  "{recipientDesignation},",
  "{recipientOrg},",
  "{recipientLine1},",
  "{recipientLine2}",
  "जिला. {recipientDistrict}",
  "{recipientState}",
];

function patchAddressBlock(source) {
  const paragraphRe = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  const paras = [...source.matchAll(paragraphRe)];
  // Locate the contiguous run of the six address paragraphs.
  let start = -1;
  let end = -1;
  for (let i = 0; i < paras.length; i++) {
    const text = [...paras[i][0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((m) => m[1])
      .join("");
    if (text === ADDRESS_TEXTS[0]) start = i;
    if (start !== -1 && i >= start && text === ADDRESS_TEXTS[ADDRESS_TEXTS.length - 1]) {
      end = i;
      break;
    }
  }
  if (start === -1 || end === -1) return { out: source, patched: 0 };
  // Guard: the six must be contiguous and in order.
  for (let i = start; i <= end; i++) {
    const text = [...paras[i][0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((m) => m[1])
      .join("");
    if (text !== ADDRESS_TEXTS[i - start]) return { out: source, patched: 0 };
  }

  const from = paras[start].index;
  const to = paras[end].index + paras[end][0].length;
  const block =
    `<w:p><w:r><w:rPr><w:rFonts w:ascii="Mangal" w:eastAsia="Mangal" w:hAnsi="Mangal" w:cs="Mangal"/></w:rPr>` +
    `<w:t xml:space="preserve">{recipientAddressBlock}</w:t></w:r></w:p>`;
  return { out: source.slice(0, from) + block + source.slice(to), patched: 6 };
}

for (const FILE of FILES) {
  const zip = new PizZip(fs.readFileSync(FILE));
  const xml = zip.file(XML_PATH).asText();

  // Already patched (single address placeholder present, none of the six).
  const hasBlock = /{recipientAddressBlock}/.test(xml);
  const hasOld = ADDRESS_TEXTS.some((t) => t.includes("{") && xml.includes(t.split(" ")[0]));
  if (hasBlock && !/{recipientDesignation}/.test(xml) && !/{recipientOrg}/.test(xml)) {
    console.log(`${FILE}: already collapsed to {recipientAddressBlock} — no change.`);
    continue;
  }

  const { out, patched } = patchAddressBlock(xml);
  if (patched !== 6) {
    console.error(
      `${FILE}: expected to replace 6 address paragraphs, replaced ${patched}. Aborting.`,
    );
    process.exit(1);
  }
  if (/{recipientAddressBlock}/.test(out) && /{recipientDesignation}/.test(out)) {
    console.error(`${FILE}: patch produced both old and new placeholders — aborting.`);
    process.exit(1);
  }
  zip.file(XML_PATH, out);
  fs.writeFileSync(FILE, zip.generate({ type: "nodebuffer" }));
  const media = Object.keys(zip.files).filter((n) => n.startsWith("word/media/"));
  console.log(
    `${FILE}: address block collapsed → {recipientAddressBlock} (6 paragraphs), ` +
      `letterhead media preserved: ${media.join(", ")}`,
  );
}
