#!/usr/bin/env bun
/**
 * ODA consumer QA — proves the promises the UI makes:
 *  1. A response generated in Hindi/Tamil/Bengali/Spanish/French/Arabic reads
 *     fully in that language (frame AND body — no English template leakage).
 *  2. "Translate document" preserves structure and keeps names, references,
 *     dates and amounts unchanged, while localizing the frame.
 *  3. "Same as original" export resolves to the source format family.
 *  4. A real-world government letter (Sub:-/Ref:- hyphen format, To-block,
 *     table) is parsed correctly — the subject, reference, recipient and date
 *     are the document's own, with no table/artifact leakage.
 *  5. Document uniqueness: a document with a member table gets that table's
 *     members and account numbers named in the response (localized frame),
 *     and the reply is addressed to whoever SENT the document — while a
 *     document without a table never gets a fabricated roster.
 */
import { adaptiveGenerate } from "../src/lib/oda/engine";
import { translateAdaptive } from "../src/lib/oda/refine";
import { exportFormatForSource } from "../src/lib/oda/export";
import { SAMPLES } from "../src/lib/oda/samples";

const sample = SAMPLES[0]; // L.C.-Out transfer order (has ref, date, names, amounts)

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

// Template phrases that must never leak into a non-English response. Quoted
// subject text and reference values (which correctly stay in the source) are
// stripped before checking. Per-language allowances for cognates that are
// legitimate words in the target language (e.g. "communication" and
// "signature" are French words too).
const ENGLISH_LEAK = [
  "acknowledge",
  "yours faithfully",
  "yours sincerely",
  "communication",
  "regret",
  "inconvenience",
  "regarding",
  "complaint has been",
  "signature",
  "concerned authority",
  "we have",
  "this is to",
];

const FRENCH_ALLOW = new Set(["communication", "regret", "signature"]);

const LANG_SCRIPT: Record<string, RegExp> = {
  Hindi: /[\u0900-\u097F]/,
  Tamil: /[\u0B80-\u0BFF]/,
  Bengali: /[\u0980-\u09FF]/,
  Telugu: /[\u0C00-\u0C7F]/,
  Kannada: /[\u0C80-\u0CFF]/,
  Gujarati: /[\u0A80-\u0AFF]/,
  Marathi: /[\u0900-\u097F]/,
  Spanish: /[áéíóúñü¿¡]/i,
  French: /[àâçéèêëîïôûùüœ]/i,
  Arabic: /[\u0600-\u06FF]/,
};

console.log("1) Fully localized adaptive responses");
for (const [lang, scriptRe] of Object.entries(LANG_SCRIPT)) {
  const out = adaptiveGenerate(sample, {
    language: lang,
    formality: "Formal",
    format: "Markdown",
  }).content;
  if (!scriptRe.test(out)) fail(`${lang}: output contains no ${lang} script`);
  if (out.length < 200) fail(`${lang}: output suspiciously short (${out.length})`);

  const stripped = out
    .replace(/"[^"]*"/g, "") // quoted subject stays source-language
    .replace(/Ref:.*$/gm, "")
    .replace(/RNJ[^\n]*/g, "")
    .replace(/APP\/88-214[^\n]*/g, "");
  for (const word of ENGLISH_LEAK) {
    if (lang === "French" && FRENCH_ALLOW.has(word)) continue;
    if (stripped.toLowerCase().includes(word)) fail(`${lang}: English leak "${word}"`);
  }
  ok(`${lang} — ${out.length} chars, no template leakage`);
}

console.log("2) English response still quotes ref/date/subject");
const en = adaptiveGenerate(sample, {
  language: "English",
  formality: "Formal",
  format: "Markdown",
}).content;
if (!en.includes("Ref:")) fail("English: missing Ref line");
if (!en.includes("L.C.-Out")) fail("English: subject not quoted");
ok("English response complete");

console.log("3) Structure-preserving translation fallback");
const tr = translateAdaptive(sample, {
  language: "Hindi",
  formality: "Formal",
  format: "Same as original",
});
if (!tr.content.includes("विषय:")) fail("translate: subject label not localized");
if (!tr.content.includes("दिनांक:")) fail("translate: date label not localized");
if (!tr.content.includes("आरएनजे/31-1512/2026")) fail("translate: reference not transliterated");
if (!tr.content.includes("02 March 2026")) fail("translate: date value not preserved");
if (!tr.content.includes("श्री भास्कर कुमार सिन्हा")) fail("translate: name not transliterated");

const tr2 = translateAdaptive(SAMPLES[1], {
  language: "Tamil",
  formality: "Formal",
  format: "Same as original",
});
if (!tr2.content.includes("9876543210")) fail("translate: phone not preserved");
if (!tr2.content.includes("PPO/D-77412")) fail("translate: PPO ref not preserved");
if (!tr2.content.includes("SBIN0001142")) fail("translate: IFSC not preserved");
if (!tr2.content.includes("பொருள்:")) fail("translate: Tamil subject label missing");
if (tr.complete) fail("translate: must be honest that prose is not fully translated");
ok("translateAdaptive — frame localized, structure + entities preserved, honest note");

console.log("3b) Full-document translation — body prose + table headers translated, letterhead untouched");
const gtr = translateAdaptive(SAMPLES[2], {
  language: "Hindi",
  formality: "Formal",
  format: "Same as original",
});
if (!gtr.content.includes("प्राप्ति की सूचना")) fail("gtr: closing sentence not translated");
if (!gtr.content.includes("यह सुनिश्चित किया गया है")) fail("gtr: assurance sentence not translated");
if (!gtr.content.includes("अग्रेषित किया जा रहा है")) fail("gtr: forwarding sentence not translated");
if (!gtr.content.includes("सदस्य का नाम")) fail("gtr: table header 'Name of the Member' not translated");
if (!gtr.content.includes("सीएमपीएफ खाता संख्या")) fail("gtr: table header 'CMPF A/C No' not translated");
if (!gtr.content.includes("श्री तन्मय भट्टाचार्य")) fail("gtr: member name not transliterated");
if (!gtr.content.includes("आरएनजे/21/1964")) fail("gtr: account number not transliterated");
if (!gtr.content.includes("सीपीएफ/59/एल.सी.-रिक्वेस्ट/बीकेआर-32/आर-III/एएसएन/41"))
  fail("gtr: reference not transliterated");
if (!gtr.content.includes("सीपीएफ/118/विविध/एल.सी.-आउट")) fail("gtr: file line not transliterated");
// Full-document fidelity (the PRD's "no stripped-down output"): the recipient
// block, salutation, designation and table cells all read in Hindi.
if (!gtr.content.includes("सेवा में,")) fail("gtr: To-block opener not translated");
if (!gtr.content.includes("सहायक आयुक्त")) fail("gtr: recipient designation not translated");
if (!gtr.content.includes("कोयला खान भविष्य निधि संगठन"))
  fail("gtr: organization name in address block not translated");
if (!gtr.content.includes("पश्चिम बंगाल")) fail("gtr: address block region not translated");
if (!gtr.content.includes("लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण"))
  fail("gtr: subject value not translated");
if (!gtr.content.includes("महोदय,")) fail("gtr: salutation not translated");
if (!gtr.content.includes("क्र.सं.") || !gtr.content.includes("सीएमपीएफ खाता संख्या"))
  fail("gtr: table headers not translated");
if (!gtr.content.includes("खंडरा कोलियरी")) fail("gtr: colliery cell not translated");
if (!gtr.content.includes("ईसीएल मुख्यालय")) fail("gtr: ECL HQ cell not translated");
if (!gtr.content.includes("20.04.2015 से 05.06.2025 तक"))
  fail("gtr: date range in cell not localized (से…तक)");
if (!gtr.content.includes("क्षेत्रीय आयुक्त - I"))
  fail("gtr: signature designation not translated");
if (!gtr.content.includes("(अजय कुमार सिंह)")) fail("gtr: signature name not transliterated");
if (!gtr.content.includes("श्री हिरोक सरकार") || !gtr.content.includes("एनजीपी/64/79"))
  fail("gtr: row-2 name/account not transliterated");
// Reference-standard format: the labels and values match the official Hindi
// twin exactly (विषय:- / संदर्भ:- / दिनांक: / transliterated file number).
if (!gtr.content.includes("विषय:- लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण।"))
  fail("gtr: subject line not in reference format");
if (!gtr.content.includes("संदर्भ:- ")) fail("gtr: reference label not in reference format");
if (!gtr.content.includes("दिनांक:09-07-2026")) fail("gtr: date line not in reference format");
if (!gtr.content.includes("सीपीएफ/118/विविध/एल.सी.-आउट/आरएनजे-21 एवं 14/आर-I/एएसएन/"))
  fail("gtr: full file line not transliterated");
if (gtr.complete === false)
  fail("gtr: full CMPFO letter should translate completely (complete=false)");
// It must NOT look like the old stripped-down acknowledgment response.
if (gtr.content.includes("आपके पत्र की प्राप्ति स्वीकार"))
  fail("gtr: response boilerplate leaked into translation");
if (gtr.content.includes("ODA Response")) fail("gtr: response title leaked into translation");
ok("CMPFO letter: full document translated — address block, subject, salutation, body, table cells, closing");

console.log("4) Same-as-original export mapping");
const cases: Array<[string, string]> = [
  ["docx", "docx"],
  ["pdf", "docx"],
  ["txt", "txt"],
  ["md", "md"],
  ["markdown", "md"],
  ["html", "html"],
  ["csv", "txt"],
  ["pptx", "docx"],
];
for (const [src, want] of cases) {
  const got = exportFormatForSource(src);
  if (got !== want) fail(`exportFormatForSource("${src}") = "${got}", want "${want}"`);
}
ok("all mappings correct");

console.log("5) Real-world govt letter (Sub:-/Ref:- hyphen format, To-block, table)");
const govt = adaptiveGenerate(SAMPLES[2], {
  language: "English",
  formality: "Formal",
  format: "Markdown",
}).content;
if (!govt.includes("Inter Regional Transfer of Ledger Card"))
  fail("govt: subject not extracted from Sub:- line");
if (!govt.includes("CPF/59/L.C.-Req./BKR-32/R-III/ASN/41"))
  fail("govt: reference not extracted from Ref:- line");
if (govt.includes("Ref: Region")) fail("govt: 'Region' leaked as the reference");
// The reply goes to whoever SENT the document — the signature block
// (Regional Commissioner - I), not the original's To-block and not a table row.
if (!govt.includes("The Regional Commissioner - I"))
  fail("govt: reply not addressed to the sender's office (Regional Commissioner - I)");
if (govt.includes("The Assistant Commissioner"))
  fail("govt: reply addressed to the original's To-block instead of the sender");
if (!govt.includes("09-07-2026")) fail("govt: source date not quoted");
// PRD Rule #1: a document with a table gets a TABLE in the response — full
// columns, full rows — not a prose summary.
if (!govt.includes("|")) fail("govt: response missing the member table (PRD Rule #1)");
if (!govt.includes("CMPF A/C No")) fail("govt: table header missing from response");
if (!govt.includes("RNJ/21/1964") || !govt.includes("NGP/64/79"))
  fail("govt: member account rows missing from response table");
if (govt.includes("CPF/118")) fail("govt: the document's own file number leaked as subject/ref");
ok("English response uses the document's own subject, ref, date, sender and member table");

const govtHi = adaptiveGenerate(SAMPLES[2], {
  language: "Hindi",
  formality: "Formal",
  format: "Markdown",
}).content;
if (!govtHi.includes("विषय:")) fail("govt-hi: subject label missing");
if (!govtHi.includes("Inter Regional Transfer of Ledger Card"))
  fail("govt-hi: subject not quoted in Hindi response");
if (!govtHi.includes("CPF/59/L.C.-Req./BKR-32/R-III/ASN/41"))
  fail("govt-hi: reference missing from Hindi response");
if (!govtHi.includes("Regional Commissioner - I"))
  fail("govt-hi: sender's office missing from Hindi response");
if (!govtHi.includes("दिनांक")) fail("govt-hi: date label missing");
if (!govtHi.includes("सदस्य का नाम") || !govtHi.includes("सीएमपीएफ खाता संख्या"))
  fail("govt-hi: response table headers not localized in Hindi");
ok("Hindi response quotes the document's subject, ref and sender with a localized member table");

console.log("6) Document-specific details — every document forges a unique response");
// The govt letter carries a member table: both members and their account
// numbers must be named, in the response language's frame.
if (!govt.includes("Shri Tonmoy Bhattacharjee (RNJ/21/1964)"))
  fail("govt: first member + account not named in English response");
if (!govt.includes("Shri Hirok Sarkar (NGP/64/79)"))
  fail("govt: second member + account not named in English response");
if (
  !govtHi.includes("Shri Tonmoy Bhattacharjee (RNJ/21/1964)") ||
  !govtHi.includes("Shri Hirok Sarkar (NGP/64/79)")
)
  fail("govt-hi: members + accounts not named in Hindi response");
if (!govtHi.includes("सदस्यों"))
  fail("govt-hi: member sentence not localized in Hindi");
// The two members must not be confused with each other's accounts.
const tonmoy = govt.indexOf("Shri Tonmoy Bhattacharjee");
const hirok = govt.indexOf("Shri Hirok Sarkar");
if (tonmoy === -1 || hirok === -1 || tonmoy > hirok)
  fail("govt: member ordering lost");

// A document WITHOUT a table must NOT get a fabricated member roster.
const plain = adaptiveGenerate(SAMPLES[0], {
  language: "English",
  formality: "Formal",
  format: "Markdown",
}).content;
if (plain.includes("under-mentioned members"))
  fail("plain: member roster fabricated for a document with no table");
// …but it still replies to its own sender.
if (!plain.includes("The Deputy Registrar"))
  fail("plain: reply not addressed to its sender (Deputy Registrar)");
ok("member tables are quoted per-document; non-table documents stay clean");

console.log("\n" + (failures === 0 ? "ALL CHECKS PASSED ✅" : `${failures} FAILURES ❌`));
process.exit(failures === 0 ? 0 : 1);
