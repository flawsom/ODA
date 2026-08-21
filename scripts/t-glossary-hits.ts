// Verify glossary hit tracking: translating a real CMPF letter must record
// hits for the glossary entries that actually fire — sentence phrases, address
// tokens, names, reference fragments — and nothing else.
//
// Runs the SAME engine path the app uses (refine.translateAdaptive, which
// wraps the base pass + referenceStandardPass + recoverCells), then asserts
// on the hit tracker module the Glossary page reads.

import { translateAdaptive } from "../src/lib/oda/refine";
import {
  clearHits,
  getHitCounts,
  hitCount,
  type HitScope,
} from "../src/lib/oda/hitTracker";

let failures = 0;
const check = (label: string, cond: boolean, detail = "") => {
  if (cond) {
    console.log(`  ✅ ${label}`);
  } else {
    failures++;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

const LETTER = `Ref:- CPF/SBP/Extract-Request/ 332 dated 29/06/2026
To,
The Regional Commissioner,
Coal Mines Provident Fund,
MCL Complex,
Sambalpur,
Odisha 768020
Sub:- Inter Regional Transfer of Extract.
Sir,
On the subject and reference cited above, please find enclosed herewith the extract in respect of Shri Susanta Kumar Nayak, CMPF A/C No- RNJ/38/3274 as desired.
Yours faithfully,
(Ajay Kumar Singh)
Regional Commissioner - I`;

console.log("== 1. Translate a CMPF letter through the app pipeline ==");
clearHits();
const res = translateAdaptive(
  { name: "hits-test.txt", text: LETTER },
  { language: "Hindi", formality: "Formal", format: "Same as original" },
);
check("translates completely", res.complete === true, res.content.slice(0, 200));
check("output is Devanagari (passes actually ran)", /[\u0900-\u097F]/.test(res.content));

const counts = getHitCounts();
console.log(`     total hits recorded: ${Object.values(counts).reduce((a, b) => a + b, 0)} across ${Object.keys(counts).length} entries`);
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`     ${k} → ${n}`);
}

console.log("\n== 2. Entries that fired ==");
check(
  "sentence 'Sir,' fired (frame regex → dictionary row)",
  hitCount("sentence", "Sir,") > 0,
  String(hitCount("sentence", "Sir,")),
);
check(
  "sentence 'Yours faithfully,' fired",
  hitCount("sentence", "Yours faithfully,") > 0,
  String(hitCount("sentence", "Yours faithfully,")),
);
check(
  "sentence extract paragraph fired",
  hitCount(
    "sentence",
    "On the subject and reference cited above, please find enclosed herewith the extract in respect of Shri {1}, CMPF A/C No- {2} as desired.",
  ) > 0,
  String(hitCount("sentence", "Sir,")),
);
check("address token 'regional' fired", hitCount("HI_TOKENS", "regional") > 0, String(hitCount("HI_TOKENS", "regional")));
check("address token 'sambalpur' fired", hitCount("HI_TOKENS", "sambalpur") > 0, String(hitCount("HI_TOKENS", "sambalpur")));
check("name 'ajay kumar singh' fired", hitCount("NAME_TABLE", "ajay kumar singh") > 0, String(hitCount("NAME_TABLE", "ajay kumar singh")));
check("ref code 'cpf' fired", hitCount("REF_TOKENS", "cpf") > 0, String(hitCount("REF_TOKENS", "cpf")));
check("ref code 'sbp' fired", hitCount("REF_TOKENS", "sbp") > 0, String(hitCount("REF_TOKENS", "sbp")));
check("ref code 'rnj' fired", hitCount("REF_TOKENS", "rnj") > 0, String(hitCount("REF_TOKENS", "rnj")));

console.log("\n== 3. Precision — nothing that did NOT fire is counted ==");
check("unused token 'kalinga' has zero hits", hitCount("HI_TOKENS", "kalinga") === 0, String(hitCount("HI_TOKENS", "kalinga")));
check("unused name 'sujata mishra' has zero hits", hitCount("NAME_TABLE", "sujata mishra") === 0, String(hitCount("NAME_TABLE", "sujata mishra")));
check("unknown word 'zebra' has zero hits", hitCount("HI_TOKENS", "zebra") === 0, String(hitCount("HI_TOKENS", "zebra")));

console.log("\n== 4. Reset works ==");
const totalBefore = Object.values(getHitCounts()).reduce((a, b) => a + b, 0);
clearHits();
check("clearHits zeroes every count", totalBefore > 0 && Object.keys(getHitCounts()).length === 0, String(totalBefore));

// Leave the store clean for other runs.
clearHits();

if (failures > 0) {
  console.error(`\nGLOSSARY HIT TRACKING TEST FAILED: ${failures} check(s)`);
  process.exit(1);
}
console.log("\nGLOSSARY HIT TRACKING TEST PASSED — entries fire and are counted precisely");
