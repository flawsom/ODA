// scripts/t-glossary-overlay.ts
//
// Growth-path proof for the Glossary page: a brand-new sentence and token
// rows added ONLY through the glossary store (buildOverlay) translate
// through the real pipeline with zero engine changes. Before the overlay the
// sentence stays English; after it, it reads fully in Hindi.

import { translateAdaptive } from "../src/lib/oda/refine";
import { buildOverlay } from "../src/lib/oda/extraDict";
import { toDocxBlob } from "../src/lib/oda/export";
import { readFileSync, writeFileSync } from "node:fs";
import PizZip from "pizzip";

const doc = {
  name: "stock-verification.txt",
  text: [
    "CPF/NGP/118/Misc./999",
    "To,",
    "The Concerned Authority,",
    "Nagpur",
    "",
    "Subject:- Stock verification",
    "",
    "Respected Sir,",
    "",
    "We inform you that the office remains closed on account of the annual stock verification on 15 August 2026.",
    "",
    "Sl. No | Name | Remarks",
    "1 | Rajesh Mehra | verified",
    "",
    "Yours faithfully,",
    "(Rajesh Mehra)",
    "Regional Commissioner - I",
  ].join("\n"),
};

const opts = { language: "Hindi", formality: "Formal", format: "Same as original" };

const base = translateAdaptive(doc, opts);
if (base.content.includes("वार्षिक स्टॉक सत्यापन")) {
  throw new Error("seed dictionary already covers the sentence — test is meaningless");
}
if (!base.content.includes("annual stock verification")) {
  throw new Error("expected the unknown sentence to stay English without the overlay");
}
console.log("✅ base: unknown sentence kept in English (no overlay)");

// The rows the Glossary page would persist — sentences and token tables.
const overlay = buildOverlay([
  {
    kind: "sentence",
    en: "We inform you that the office remains closed on account of the annual stock verification on {1}.",
    hi: "हम आपको सूचित करते हैं कि वार्षिक स्टॉक सत्यापन के कारण {1} को कार्यालय बंद रहेगा।",
  },
  { kind: "token", table: "HI_TOKENS", en: "concerned", hi: "संबंधित" },
  { kind: "token", table: "TABLE_HEADERS", en: "sl. no", hi: "क्र.सं." },
  { kind: "token", table: "NAME_TABLE", en: "rajesh mehra", hi: "राजेश मेहरा" },
  { kind: "token", table: "REF_TOKENS", en: "ngp", hi: "नागपुर" },
]);

const res = translateAdaptive(doc, opts, overlay);
const c = res.content;
const checks: Array<[string, boolean]> = [
  ["sentence translates with the date slot", c.includes("वार्षिक स्टॉक सत्यापन के कारण 15 अगस्त 2026 को कार्यालय बंद रहेगा")],
  ["custom word token applies", c.includes("संबंधित")],
  ["custom ref token applies", c.includes("नागपुर/118")],
  ["custom table header applies", c.includes("क्र.सं.")],
  ["custom name applies", c.includes("राजेश मेहरा")],
  ["completion flag true", res.complete === true],
];
let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failed += 1;
}

// The exported DOCX carries the same custom translations (no re-education).
const blob = await toDocxBlob({
  documentName: doc.name,
  content: c,
  language: "Hindi",
  formality: "Formal",
  strategy: "adaptive",
  createdAt: Date.now(),
  kind: "translation",
  sourceFormat: "txt",
});
const zip = new PizZip(Buffer.from(await blob.arrayBuffer()));
const xml = zip.files["word/document.xml"].asText();
for (const [label, needle] of [
  ["docx has custom sentence", "वार्षिक स्टॉक"],
  ["docx has custom name", "राजेश मेहरा"],
]) {
  const ok = xml.includes(needle);
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failed += 1;
}

if (failed > 0) throw new Error(`glossary overlay growth test failed: ${failed} check(s)`);
console.log("\nGLOSSARY OVERLAY GROWTH TEST PASSED — no code changes needed to grow coverage");
