/**
 * BRUTAL STRESS TEST — out-of-dictionary, novel, and adversarial words.
 * Tests the absolute floor: transliterateProseToHindi, sweepLeftoverLines,
 * and the completeness gate against words NOT in any glossary.
 *
 * Run: bun scripts/test-stress-novel.mts
 */

import {
  transliterateProseToHindi,
  sweepLeftoverLines,
} from "../src/lib/oda/translate";
import { estimateCompleteness, ensureComplete } from "../src/lib/oda/neuralTranslate";

const DEVANAGARI_RE = /[\u0900-\u097F]/;
const LATIN_RE = /[A-Za-z]{4,}/;

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    const msg = `✗ ${label}${detail ? ` — ${detail}` : ""}`;
    console.log(`  ${msg}`);
    failures.push(msg);
  }
}

// =====================================================================
// SECTION 1: Completely novel formal-letter words NOT in any dictionary
// =====================================================================
console.log("\n=== SECTION 1: Novel formal-letter words (out-of-dictionary) ===");

const novelWords = [
  // Complex multi-syllable words never seen in training
  "electroencephalographic",
  "pseudopseudohypoparathyroidism",
  "floccinaucinihilipilification",
  "antidisestablishmentarianism",
  "deinstitutionalization",
  "counterrevolutionaries",
  "intercommunication",
  "microspectrophotometrically",
  // Real government/legal words that might not be in glossary
  "jurisprudential",
  "habeas corpus",
  "subpoena duces tecum",
  "ex officio",
  "inter alia",
  "prima facie",
  "ultra vires",
  "res judicata",
  "de facto",
  "pro bono",
  // Technical/modern words
  "blockchain",
  "cryptocurrency",
  "infrastructure",
  "telecommunications",
  "electromagnetic",
  "biodegradable",
  "nanotechnology",
  "quantum",
  "synergistic",
  "paradigm",
  // Obscure/archaic formal words
  "indemnification",
  "adjudication",
  "promulgation",
  "requisitioning",
  "expropriation",
  "requisition",
  "ratification",
  "annulment",
  "concomitant",
  "auspices",
  // Brand names / proper nouns / neologisms
  "Zyxophrenia",
  "Bhoomiputra",
  "Xenogenesis",
  "Quixotical",
  "Sycophantic",
  "Sesquipedalian",
];

for (const word of novelWords) {
  const result = transliterateProseToHindi(word);
  assert(
    `"${word}" → not null`,
    result !== null,
    result === null ? "null — English would ship!" : undefined,
  );
  if (result !== null) {
    assert(
      `"${word}" → Devanagari`,
      DEVANAGARI_RE.test(result),
      `got "${result}" (no Devanagari script)`,
    );
  }
}

// =====================================================================
// SECTION 2: Novel multi-word formal sentences (not in phrase dictionary)
// =====================================================================
console.log("\n=== SECTION 2: Novel formal sentences ===");

const novelSentences = [
  "The undersigned respectfully submits this petition for reconsideration of the previously denied application.",
  "Pursuant to the directive issued by the Honorable High Court, all pending cases shall be expedited.",
  "This memorandum serves to inform all stakeholders of the impending organizational restructuring.",
  "The committee hereby recommends the immediate suspension of the implicated officials pending investigation.",
  "In consideration of the foregoing circumstances, the Board of Directors has resolved to approve the merger.",
  "The petitioner seeks declaratory relief and injunctive relief against the respondent organization.",
  "Notwithstanding any provision to the contrary, the arbitrator's decision shall be final and binding.",
  "The Government of India has promulgated an ordinance amending the provisions of the said Act.",
  "The environmental impact assessment reveals significant ecological degradation in the watershed area.",
  "Due diligence analysis indicates material discrepancies in the financial statements for the fiscal year.",
  "The semiconductor fabrication facility requires specialized calibration of photolithographic equipment.",
  "Electromagnetic interference patterns suggest an anomalous resonance in the quantum field.",
  "The cryptographic hash function employs elliptic curve mathematics for asymmetric key generation.",
  "Machine learning models demonstrate superhuman performance on multimodal classification benchmarks.",
  "Neuroplasticity research suggests cortical reorganization following prolonged sensory deprivation.",
];

for (const sentence of novelSentences) {
  const result = transliterateProseToHindi(sentence);
  assert(
    `"${sentence.slice(0, 50)}..." → not null`,
    result !== null,
    result === null ? "null — English would ship!" : undefined,
  );
  if (result !== null) {
    assert(
      `"${sentence.slice(0, 40)}..." → has Devanagari`,
      DEVANAGARI_RE.test(result),
      `got "${result.slice(0, 60)}"`,
    );
  }
}

// =====================================================================
// SECTION 3: Edge cases — single words, punctuation, mixed scripts
// =====================================================================
console.log("\n=== SECTION 3: Edge cases ===");

const edgeCases: Array<[string, string]> = [
  ["x", "empty/single char"],
  ["!!", "punctuation only"],
  ["12345", "numbers only"],
  ["A", "single uppercase letter"],
  ["email@test.com", "email address"],
  ["https://example.com/very/long/path", "URL"],
  ["CPF/118/Misc/L.C.-Out/R-I/ASN/993", "file code with slashes"],
  ["N/A", "abbreviation with slash"],
  ["Mr. & Mrs. Smith", "abbreviation with ampersand"],
  ["The 3rd quarter of FY 2026-27", "mixed numbers and letters"],
  ["Rs. 50,000/- (Rupees Fifty Thousand Only)", "Indian currency format"],
  ["01/01/2026 to 31/12/2026", "date range"],
  ["Block-2, Type-2, Qr. No. G", "compound identifier"],
  ["SSA/CLERK/STENO", "multi-title slash code"],
];

for (const [text, desc] of edgeCases) {
  const result = transliterateProseToHindi(text);
  assert(
    `edge "${desc}" ("${text.slice(0, 30)}") → not null`,
    result !== null,
    result === null ? "null" : undefined,
  );
}

// =====================================================================
// SECTION 4: sweepLeftoverLines — the absolute guarantee
// =====================================================================
console.log("\n=== SECTION 4: sweepLeftoverLines with novel text ===");

const novelSweepLines = [
  "The bioethics committee has raised concerns about the CRISPR-Cas9 gene editing protocol.",
  "Blockchain-based supply chain provenance verification ensures authenticity.",
  "Quantum entanglement enables instantaneous state correlation across light-years.",
  "Neuroplasticity-driven rehabilitation protocols demonstrate measurable cognitive improvement.",
  "The semiconductor supply chain faces unprecedented disruptions due to geopolitical tensions.",
  "Algorithmic bias in facial recognition systems disproportionately affects minority populations.",
  "Aerodynamic drag coefficients vary nonlinearly with Reynolds number at transonic velocities.",
  "Thermodynamic entropy production is maximized in irreversible quasi-static processes.",
  "The electromagnetic spectrum encompasses wavelengths from gamma rays to radio waves.",
  "Cryptographic non-repudiation protocols ensure message integrity via digital signatures.",
];

const swept = sweepLeftoverLines(novelSweepLines, "Hindi");
let allSwept = true;
for (let i = 0; i < novelSweepLines.length; i++) {
  const ok = swept[i] !== null && swept[i] !== undefined && swept[i]!.length > 0;
  if (!ok) allSwept = false;
  assert(
    `sweep "${novelSweepLines[i].slice(0, 40)}..." → non-empty`,
    ok,
  );
}

// =====================================================================
// SECTION 5: ensureComplete — mixed document with novel lines
// =====================================================================
console.log("\n=== SECTION 5: ensureComplete with mixed novel text ===");

const mixedDoc = `सेवा में,
महोदय,

The bioethics committee has raised concerns about the CRISPR-Cas9 gene editing protocol that was recently approved by the institutional review board. Furthermore, the quantum entanglement experiments have demonstrated significant improvements in the cryptographic key distribution infrastructure. We recommend immediate deinstitutionalization of the affected semiconductor fabrication processes.

The undersigned respectfully submits this petition for reconsideration.

भवदीय,
(हस्ताक्षर)`;

const completeResult = ensureComplete(mixedDoc, "Hindi", (lines) =>
  sweepLeftoverLines(lines, "Hindi"),
);

assert(
  `ensureComplete marks document complete`,
  completeResult.complete,
  `swept=${completeResult.swept}, untranslated=${completeResult.untranslated.length}: ${completeResult.untranslated.map(l => l.slice(0, 40)).join("; ")}`,
);

// =====================================================================
// SECTION 6: NO Latin prose in final output
// =====================================================================
console.log("\n=== SECTION 6: Final output quality check ===");

// Run the full pipeline: translate → ensureComplete → sweep
const fullResult = ensureComplete(
  mixedDoc,
  "Hindi",
  (lines) => sweepLeftoverLines(lines, "Hindi"),
);

const outputLines = fullResult.content.split("\n");
const proseLines = outputLines.filter((l) => {
  const t = l.trim();
  return t.length > 25 && LATIN_RE.test(t) && !DEVANAGARI_RE.test(t);
});

assert(
  `No untranslated Latin prose lines in final output`,
  proseLines.length === 0,
  proseLines.length > 0
    ? `${proseLines.length} lines still Latin: "${proseLines[0].slice(0, 60)}..."`
    : undefined,
);

// =====================================================================
// SECTION 7: Adversarial inputs — try to break the system
// =====================================================================
console.log("\n=== SECTION 7: Adversarial / adversarial-ish inputs ===");

const adversarial = [
  "null",           // the word "null"
  "undefined",      // the word "undefined"
  "true",           // boolean word
  "NaN",            // NaN word
  "",               // empty string
  "   ",            // whitespace only
  "\n\n\n",         // newlines only
  "a".repeat(500),  // very long single word
  "test123test",    // alphanumeric
  "café résumé naïve", // accented Latin
  "拖拉机",         // Chinese characters
  ";color:expression(alert(1))", // XSS-ish injection
  "SELECT * FROM users", // SQL injection
  "<script>alert(1)</script>", // HTML injection
  "\\n\\r\\t\\0",    // escape sequences
  "\u0000\u0001\u0002", // control characters
];

for (const text of adversarial) {
  const result = transliterateProseToHindi(text);
  assert(
    `adversarial "${text.slice(0, 25).replace(/\n/g, "\\n")}" → not null`,
    result !== null,
    `got null`,
  );
}

// =====================================================================
// RESULTS
// =====================================================================
console.log(`\n${"=".repeat(60)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"=".repeat(60)}`);

if (failures.length > 0) {
  console.log("\nFAILURES:");
  for (const f of failures.slice(0, 20)) {
    console.log(`  ${f}`);
  }
}

if (failed > 0) {
  process.exit(1);
}
