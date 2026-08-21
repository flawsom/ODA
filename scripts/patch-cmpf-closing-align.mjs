// scripts/patch-cmpf-closing-align.mjs
//
// CMPFO sign-off convention (see the "Signature Block Alignment Fix" PRD):
// the closing block —
//     भवदीय,
//     ({signatoryName})
//     {signatoryDesignation}
// — sits flush-right below the body, mirroring the English sibling letter.
// The Hindi gold file the template was authored from had this block
// left-aligned (an inconsistency in the source), so this script adds
// <w:jc w:val="right"/> to exactly those three paragraphs in the bundled
// template asset. Nothing else in the document is touched.
//
// Run: bun scripts/patch-cmpf-closing-align.mjs
// Idempotent: re-running is a no-op (paragraphs already carry w:jc right).

import PizZip from "pizzip";
import fs from "node:fs";

const FILE = "public/templates/cmpf-lc-out-v1.docx";
const XML_PATH = "word/document.xml";

/** The exact text of the three closing-block paragraphs. */
const CLOSING_LINES = ["भवदीय,", "({signatoryName})", "{signatoryDesignation}"];

const zip = new PizZip(fs.readFileSync(FILE));
const xml = zip.file(XML_PATH).asText();

/** Runs over every <w:p …>…</w:p>, patching the three closing paragraphs. */
function rightAlignClosingBlock(source) {
  const paragraphRe = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  let patched = 0;
  const out = source.replace(paragraphRe, (para) => {
    const text = [...para.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((m) => m[1])
      .join("");
    if (!CLOSING_LINES.includes(text)) return para;
    if (/<w:pPr>[\s\S]*?<\/w:pPr>/.test(para)) {
      if (/<w:jc\b/.test(para)) return para; // already aligned
      return para.replace(
        /<w:pPr>([\s\S]*?)<\/w:pPr>/,
        (_m, inner) => `<w:pPr><w:jc w:val="right"/>${inner}</w:pPr>`,
      );
    }
    patched += 1;
    return para.replace(/^(<w:p(?:\s[^>]*)?>)/, `$1<w:pPr><w:jc w:val="right"/></w:pPr>`);
  });
  return { out, patched };
}

const before = [...xml.matchAll(/<w:jc\b[^>]*\/>/g)].map((m) => m[0]);
const { out, patched } = rightAlignClosingBlock(xml);

if (patched === 0 && /<w:jc w:val="right"\/>/.test(out)) {
  console.log("Closing block already right-aligned — no change needed.");
} else if (patched !== CLOSING_LINES.length) {
  console.error(
    `Expected to patch ${CLOSING_LINES.length} closing paragraphs, patched ${patched}.`,
  );
  process.exit(1);
} else {
  zip.file(XML_PATH, out);
  fs.writeFileSync(FILE, zip.generate({ type: "nodebuffer" }));
}

// Report: alignment spread before/after + letterhead media intact.
const after = [...out.matchAll(/<w:jc\b[^>]*\/>/g)].map((m) => m[0]);
const count = (xs, v) => xs.filter((x) => x.includes(`w:val="${v}"`)).length;
console.log(
  `jc alignment before → after:\n` +
    `  left:    ${count(before, "left")} → ${count(after, "left")}\n` +
    `  center:  ${count(before, "center")} → ${count(after, "center")}\n` +
    `  both:    ${count(before, "both")} → ${count(after, "both")}\n` +
    `  right:   ${count(before, "right")} → ${count(after, "right")}`,
);
const media = Object.keys(zip.files).filter((n) => n.startsWith("word/media/"));
console.log(`letterhead media preserved: ${media.length} file(s) — ${media.join(", ")}`);
