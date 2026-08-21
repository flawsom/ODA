/**
 * Targeted tests for translate.ts and refine.ts changes.
 * Tests the "no English prose ever ships" guarantee.
 * Run: bun scripts/test-translation-changes.mts
 */

import {
  transliterateProseToHindi,
  sweepLeftoverLines,
  translateHindiSubject,
} from "../src/lib/oda/translate";
import {
  estimateCompleteness,
  ensureComplete,
} from "../src/lib/oda/neuralTranslate";
import { referenceStandardPass } from "../src/lib/oda/refine";

const DEVANAGARI_RE = /[\u0900-\u097F]/;
const LATIN_RE = /[A-Za-z]{4,}/;

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// =====================================================================
// TEST 1: transliterateProseToHindi never returns null for non-CMPFO text
// =====================================================================
console.log("\n=== TEST 1: transliterateProseToHindi never returns null ===");

const nonCmpfoLines = [
  "Request for enhanced security measures at staff quarters",
  "The Estate Officer",
  "Coal Mines Provident Fund Organisation",
  "Subject: Request for enhanced security measures at staff quarters",
  "I wish to bring to your kind notice that several incidents of theft",
  "Thanking you,",
  "Copy forwarded for information and necessary action to:",
  "Deployment of a night security guard for my residence",
  "Installation of adequate street lighting in and around the residential blocks",
];

for (const line of nonCmpfoLines) {
  const result = transliterateProseToHindi(line);
  assert(
    `"${line.slice(0, 50)}..." never null`,
    result !== null,
    result === null ? "returned null — English would ship!" : undefined,
  );
}

// =====================================================================
// TEST 2: Formal phrase dictionary translates known phrases correctly
// =====================================================================
console.log("\n=== TEST 2: FORMAL_PHRASES dictionary accuracy ===");

const phraseTests: Array<[string, string]> = [
  ["security measures", "\u0938\u0941\u0930\u0915\u094D\u0937\u093E \u0909\u092A\u093E\u092F"],
  ["staff quarters", "\u0915\u0930\u094D\u092E\u091A\u093E\u0930\u0940 \u0906\u0935\u093E\u0938"],
  ["coal mines provident fund organisation", "\u0915\u094B\u092F\u0932\u093E \u0916\u093E\u0928 \u092D\u0935\u093F\u0937\u094D\u092F \u0928\u093F\u0927\u093F \u0938\u0902\u0917\u0920\u0928"],
  ["theft", "\u091A\u094B\u0930\u0940"],
  ["vicinity", "\u0906\u0938\u092A\u093E\u0938"],
  ["yours faithfully", "\u092D\u0935\u0926\u0940\u092F"],
  ["at the earliest", "\u0936\u0940\u0918\u094D\u0930\u093E\u0924\u093F\u0936\u0940\u0918\u094D\u0930"],
  ["thank you", "\u0927\u0928\u094D\u092F\u0935\u093E\u0926"],
  ["street lighting", "\u0938\u0921\u093C\u0915 \u092A\u094D\u0930\u0915\u093E\u0936"],
  ["residential blocks", "\u0906\u0935\u093E\u0938\u0940\u092F \u092C\u094D\u0932\u0949\u0915"],
  ["night security guard", "\u0930\u093E\u0924\u094D\u0930\u093F \u0938\u0941\u0930\u0915\u094D\u0937\u093E \u0917\u093E\u0930\u094D\u0921"],
  ["belongings", "\u0938\u0902\u092A\u0924\u094D\u0924\u093F"],
  ["west bengal", "\u092A\u0936\u094D\u091A\u093F\u092E \u092C\u0902\u0917\u093E\u0932"],
  ["in view of", "\u0915\u094B \u0926\u0947\u0916\u0924\u0947 \u0939\u0941\u090F"],
  ["above-mentioned", "\u0909\u092A\u0930\u094D\u092F\u0941\u0915\u094D\u0924"],
  ["bachelor staff", "\u0905\u0935\u093F\u0935\u093E\u0939\u093F\u0924 \u0915\u0930\u094D\u092E\u091A\u093E\u0930\u0940"],
  ["colony", "\u0915\u0949\u0932\u094B\u0928\u0940"],
  ["regional office", "\u0915\u094D\u0937\u0947\u0924\u094D\u0930\u0940\u092F \u0915\u093E\u0930\u094D\u092F\u093E\u0932\u092F"],
];

for (const [en, expectedHi] of phraseTests) {
  const result = transliterateProseToHindi(en);
  assert(
    `"${en}" contains "${expectedHi.slice(0, 10)}..."`,
    result !== null && result.includes(expectedHi),
    result === null
      ? "returned null"
      : `got "${result.slice(0, 60)}"`,
  );
}

// =====================================================================
// TEST 3: sweepLeftoverLines never returns null
// =====================================================================
console.log("\n=== TEST 3: sweepLeftoverLines never returns null ===");

const sweepLines = [
  "Request for enhanced security measures at staff quarters",
  "I wish to bring to your kind notice that several incidents",
  "Yours faithfully,",
  "Installation of adequate street lighting",
  "Some completely novel English sentence that has no dictionary coverage at all",
];

const swept = sweepLeftoverLines(sweepLines, "Hindi");
for (let i = 0; i < sweepLines.length; i++) {
  assert(
    `sweep "${sweepLines[i].slice(0, 40)}..." not null`,
    swept[i] !== null && swept[i] !== undefined,
  );
}

// =====================================================================
// TEST 4: translateHindiSubject works for common subjects
// =====================================================================
console.log("\n=== TEST 4: translateHindiSubject ===");

const subjectTests: Array<[string, string]> = [
  ["Inter Regional Transfer of Ledger Card", "\u0932\u0947\u091C\u0930 \u0915\u093E\u0930\u094D\u0921"],
  ["Inter Regional Transfer of Extract", "\u0909\u0926\u094D\u0927\u0930\u0923"],
  ["Inter Regional Transfer of Ledger Card, D.A. and P.S.-3 and 4", "\u0921\u0940.\u090F."],
];

for (const [subj, expected] of subjectTests) {
  const result = translateHindiSubject(subj);
  assert(
    `"${subj.slice(0, 40)}..." contains "${expected}"`,
    result !== null && result.includes(expected),
    result === null ? "returned null" : `got "${result.slice(0, 60)}"`,
  );
}

// =====================================================================
// TEST 5: completeness gate flags English prose lines
// =====================================================================
console.log("\n=== TEST 5: completeness gate ===");

const partialDoc = `\u0938\u0947\u0935\u093E \u092E\u0947\u0902,
\u092E\u0939\u094B\u0926\u092F,
Request for enhanced security measures at staff quarters
I wish to bring to your kind notice that several incidents of theft
Yours faithfully,`;

const gate = estimateCompleteness(partialDoc, "Hindi");
assert(
  `Gate flags English prose lines`,
  gate.untranslated.length > 0,
  `found ${gate.untranslated.length} untranslated lines`,
);

// =====================================================================
// TEST 6: ensureComplete sweeps all lines to Devanagari
// =====================================================================
console.log("\n=== TEST 6: ensureComplete sweeps all lines ===");

const ensureResult = ensureComplete(partialDoc, "Hindi", (lines) =>
  sweepLeftoverLines(lines, "Hindi"),
);
assert(
  `ensureComplete marks document complete`,
  ensureResult.complete,
  `swept=${ensureResult.swept}, untranslated=${ensureResult.untranslated.length}`,
);

// =====================================================================
// TEST 7: Reference standard pass preserves Devanagari
// =====================================================================
console.log("\n=== TEST 7: referenceStandardPass preserves Devanagari ===");

const devDoc = `\u0938\u0947\u0935\u093E \u092E\u0947\u0902,
\u0936\u094D\u0930\u0940 \u0926\u093F\u0932\u0940\u092A \u0915\u0941\u092E\u093E\u0930 \u092A\u0902\u0921\u093E,
\u092E\u0939\u094B\u0926\u092F,

\u092D\u0935\u0926\u0940\u092F,
(\u0926\u093F\u0932\u0940\u092A \u0915\u0941\u092E\u093E\u0930 \u092A\u0902\u0921\u093E)`;

const refined = referenceStandardPass(devDoc);
assert(
  "Devanagari content preserved",
  refined.includes("\u092E\u0939\u094B\u0926\u092F") && refined.includes("\u092D\u0935\u0926\u0940\u092F"),
);
assert(
  "No gibberish introduced",
  !refined.includes("\u0930\u0947\u0915\u0941\u0938\u0924") && !refined.includes("\u090F\u0902\u0939\u0902\u0915\u0947\u0926"),
);

// =====================================================================
// RESULTS
// =====================================================================
console.log(`\n${"=".repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"=".repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}
