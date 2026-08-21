// Round-trip test for the glossary import/export serialization
// (src/lib/oda/glossaryIO.ts) — the same module the Glossary page uses.
//
// Exercises: export serialization, import planning with dedupe (idempotent
// re-import), per-row validation (bad kind / empty en / no target), and
// malformed-file rejection. Uses realistic stored rows incl. full tr maps.

import { GLOSSARY, HI_TOKENS, NAME_TABLE } from "../src/lib/oda/glossary";
import {
  glossaryRowKey,
  planGlossaryImport,
  previewPhraseTranslation,
  serializeGlossaryExport,
  type StoredGlossaryRow,
} from "../src/lib/oda/glossaryIO";

let failures = 0;
const check = (label: string, cond: boolean, detail = "") => {
  if (cond) {
    console.log(`  ✅ ${label}`);
  } else {
    failures++;
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
};

// Build a realistic "stored" set: a couple of sentence rows (one with a full
// 10-language tr map) plus token rows across tables.
const stored: StoredGlossaryRow[] = [
  {
    kind: "sentence",
    en: "On the subject and reference cited above, please find enclosed herewith the extract in respect of Shri {1}, CMPF A/C No- {2} as desired.",
    hi: "उपरोक्त विषय एवं संदर्भ के आलोक में, श्री {1}, सीएमपीएफ खाता संख्या- {2} के संबंध में संलग्न उद्धरण (एक्सट्रैक्ट) आपके अवलोकनार्थ प्रेषित है।",
    tr: {
      Hindi: "उपरोक्त विषय एवं संदर्भ के आलोक में, श्री {1}, सीएमपीएफ खाता संख्या- {2} के संबंध में संलग्न उद्धरण (एक्सट्रैक्ट) आपके अवलोकनार्थ प्रेषित है।",
      Tamil: "தமிழ் {1}",
      Arabic: "عربي {2}",
    },
    enabled: true,
  },
  {
    kind: "sentence",
    en: "Sir,",
    hi: "महोदय,",
    enabled: true,
  },
  {
    kind: "token",
    table: "HI_TOKENS",
    en: "kalinga",
    hi: "कलिंगा",
    enabled: true,
  },
  {
    kind: "token",
    table: "NAME_TABLE",
    en: "sujata mishra",
    hi: "सुजाता मिश्रा",
    enabled: false,
  },
];

console.log("== 1. Export serialization ==");
const file = serializeGlossaryExport(stored);
check("format tag", file.format === "oda-glossary", file.format);
check("count matches", file.count === stored.length, String(file.count));
check("kind/table/en/hi/enabled preserved", (() => {
  const t = file.entries.find((e) => e.en === "kalinga");
  return t !== undefined && t.kind === "token" && t.table === "HI_TOKENS" && t.hi === "कलिंगा" && t.enabled === true;
})());
check("tr map preserved incl. non-Hindi", (() => {
  const s = file.entries.find((e) => e.en.startsWith("On the subject"));
  return s?.tr?.Tamil === "தமிழ் {1}" && s.tr.Arabic === "عربي {2}" && s.tr.Hindi !== undefined;
})());
check("disabled flag preserved", file.entries.find((e) => e.en === "sujata mishra")?.enabled === false);

console.log("\n== 2. Fresh-deployment import (empty store) ==");
const fresh = planGlossaryImport(file, []);
check("accepts the export", fresh.ok === true, fresh.error ?? "");
check("all rows import", fresh.rows.length === stored.length, `${fresh.rows.length} vs ${stored.length}`);
check("nothing skipped", fresh.skipped === 0, String(fresh.skipped));
check("token default table applied only when missing", fresh.rows.find((r) => r.en === "kalinga")?.table === "HI_TOKENS");

console.log("\n== 3. Re-import after import (idempotent) ==");
const second = planGlossaryImport(file, stored);
check("zero new rows", second.rows.length === 0, String(second.rows.length));
check("all skipped as duplicates", second.skipped === stored.length, String(second.skipped));

console.log("\n== 4. Partial overlap + invalid rows ==");
const mixed = {
  format: "oda-glossary",
  version: 1,
  entries: [
    ...file.entries, // already present
    { kind: "sentence", en: "New sentence", hi: "नया वाक्य", enabled: true }, // new
    { kind: "nonsense", en: "bad kind", hi: "x" }, // invalid kind
    { kind: "sentence", en: "   ", hi: "x" }, // empty en
    { kind: "sentence", en: "No target" }, // missing hi/tr
    { kind: "token", en: "newtoken", hi: "नया", enabled: true }, // new token, no table -> HI_TOKENS
  ],
};
const plan = planGlossaryImport(mixed, stored);
check("accepts mixed file", plan.ok === true, plan.error ?? "");
check("imports the 2 new rows", plan.rows.length === 2, plan.rows.map((r) => r.en).join(","));
check("skips 3 invalid + 4 duplicates", plan.skipped === 3 + stored.length, String(plan.skipped));
check("missing table defaults to HI_TOKENS", plan.rows.find((r) => r.en === "newtoken")?.table === "HI_TOKENS");

console.log("\n== 5. Malformed files rejected ==");
check("non-object", planGlossaryImport(null, []).ok === false);
check("wrong format tag", planGlossaryImport({ format: "other", entries: [] }, []).ok === false);
check("missing entries array", planGlossaryImport({ format: "oda-glossary" }, []).ok === false);
check("entries not an array", planGlossaryImport({ format: "oda-glossary", entries: 42 }, []).ok === false);

console.log("\n== 6. Round trip with real seed data (sanity volume) ==");
const seedAsStored: StoredGlossaryRow[] = GLOSSARY.map((e) => ({
  kind: "sentence",
  en: e.en,
  hi: e.hi ?? (e.tr ? e.tr.Hindi ?? "" : ""),
  tr: e.tr,
  enabled: true,
}));
const seedFile = serializeGlossaryExport(seedAsStored);
const seedBack = planGlossaryImport(seedFile, []);
check("every seed sentence survives round trip", seedBack.ok && seedBack.rows.length === seedAsStored.length, `${seedBack.rows.length} of ${seedAsStored.length}`);
// Meaningful token rows only (empty-value HI_TOKENS entries are no-ops to the
// engine and are dropped at import) + an HI_ABBR row, whose value is implicit
// and must survive with no hi at all.
const tokenStored: StoredGlossaryRow[] = Object.entries(HI_TOKENS)
  .filter(([, v]) => v.trim().length > 0)
  .map(([en, hi]) => ({ kind: "token", table: "HI_TOKENS", en, hi, enabled: true }));
const nameStored: StoredGlossaryRow[] = Object.entries(NAME_TABLE).map(([en, hi]) => ({
  kind: "token", table: "NAME_TABLE", en, hi, enabled: true,
}));
const abbrStored: StoredGlossaryRow = {
  kind: "token", table: "HI_ABBR", en: "HQ.", hi: undefined, enabled: true,
};
const tokensBack = planGlossaryImport(
  serializeGlossaryExport([...tokenStored, ...nameStored, abbrStored]),
  [],
);
check(
  "all meaningful token rows survive round trip",
  tokensBack.ok && tokensBack.rows.length === tokenStored.length + nameStored.length + 1,
  `${tokensBack.rows.length} of ${tokenStored.length + nameStored.length + 1}`,
);
check("value-less HI_ABBR row imports (implicit value)", (() => {
  const a = tokensBack.rows.find((r) => r.en === "HQ.");
  return a !== undefined && a.kind === "token" && a.table === "HI_ABBR" && !a.hi;
})());

console.log("\n== 7. Shadow-collision keys (shared by the Glossary page save handlers) ==");
const k = (kind: "sentence" | "token", table: string | undefined, en: string) =>
  glossaryRowKey({ kind, table, en });
check(
  "identical sentences collide",
  k("sentence", undefined, "Sir,") === k("sentence", undefined, "Sir,"),
);
check(
  "case-insensitive sentence collision",
  k("sentence", undefined, "Sir,") === k("sentence", undefined, "sir,"),
);
check(
  "whitespace-trimmed sentence collision",
  k("sentence", undefined, " Sir, ") === k("sentence", undefined, "Sir,"),
);
check(
  "different sentences do not collide",
  k("sentence", undefined, "Sir,") !== k("sentence", undefined, "Madam,"),
);
check(
  "tokens collide on table + key (case-insensitive)",
  k("token", "HI_TOKENS", "Kalinga") === k("token", "HI_TOKENS", "kalinga"),
);
check(
  "same key in different tables does not collide",
  k("token", "HI_TOKENS", "mcl") !== k("token", "REF_TOKENS", "mcl"),
);
check(
  "sentence vs token with the same text do not collide",
  k("sentence", undefined, "mcl") !== k("token", "HI_TOKENS", "mcl"),
);
check(
  "import planner uses the same key (in-file duplicate skipped)",
  (() => {
    const p = planGlossaryImport(
      {
        format: "oda-glossary",
        version: 1,
        entries: [
          { kind: "sentence", en: "Sir,", hi: "महोदय,", enabled: true },
          { kind: "sentence", en: "sir,", hi: "महोदय,", enabled: true },
        ],
      },
      [],
    );
    return p.ok && p.rows.length === 1 && p.skipped === 1;
  })(),
);

console.log("\n== 8. Sentence preview rendering (slot capture + substitution) ==
");
check(
  "exact match fills slots",
  previewPhraseTranslation(
    "On the subject, Shri {1}, CMPF A/C No- {2}.",
    "विषय पर, श्री {1}, सीएमपीएफ खाता संख्या {2}.",
    "On the subject, Shri Susanta Nayak, CMPF A/C No- RNJ/38/3274.",
  ) === "विषय पर, श्री Susanta Nayak, सीएमपीएफ खाता संख्या RNJ/38/3274.",
);
check(
  "case-insensitive source match",
  previewPhraseTranslation(
    "Sir,",
    "महोदय,",
    "sir,",
  ) === "महोदय,",
);
check(
  "non-matching sample returns null",
  previewPhraseTranslation("Sir,", "महोदय,", "Something else") === null,
);
check(
  "empty inputs return null",
  previewPhraseTranslation("", "", "") === null,
);

console.log("\n== 9. Token-table conflict guard (conflicting values only) ==
");
const tokenStored: StoredGlossaryRow[] = [
  { kind: "token", table: "HI_TOKENS", en: "mcl", hi: "एमसीएल", enabled: true },
  { kind: "token", table: "HI_TOKENS", en: "hindi", hi: "हिंदी", enabled: true },
  { kind: "token", table: "HI_ABBR", en: "hq.", enabled: true },
];
check(
  "same key + same value = no conflict",
  (() => {
    const p = planGlossaryImport(
      {
        format: "oda-glossary",
        version: 1,
        entries: [{ kind: "token", table: "HI_TOKENS", en: "mcl", hi: "एमसीएल", enabled: true }],
      },
      tokenStored,
    );
    return p.ok && p.rows.length === 0 && p.skipped === 1;
  })(),
);
check(
  "same key + different value = conflict (skipped by idempotent import)",
  (() => {
    const p = planGlossaryImport(
      {
        format: "oda-glossary",
        version: 1,
        entries: [{ kind: "token", table: "HI_TOKENS", en: "mcl", hi: "नया", enabled: true }],
      },
      tokenStored,
    );
    return p.ok && p.rows.length === 0 && p.skipped === 1;
  })(),
);
check(
  "new token key = allowed",
  (() => {
    const p = planGlossaryImport(
      {
        format: "oda-glossary",
        version: 1,
        entries: [{ kind: "token", table: "HI_TOKENS", en: "zebra", hi: "ज़ेब्रा", enabled: true }],
      },
      tokenStored,
    );
    return p.ok && p.rows.length === 1;
  })(),
);
check(
  "case-insensitive token key collision",
  (() => {
    const p = planGlossaryImport(
      {
        format: "oda-glossary",
        version: 1,
        entries: [{ kind: "token", table: "HI_TOKENS", en: "MCL", hi: "एमसीएल", enabled: true }],
      },
      tokenStored,
    );
    return p.ok && p.rows.length === 0 && p.skipped === 1;
  })(),
);
check(
  "same key different table = no conflict",
  (() => {
    const p = planGlossaryImport(
      {
        format: "oda-glossary",
        version: 1,
        entries: [{ kind: "token", table: "REF_TOKENS", en: "mcl", hi: "एमसीएल", enabled: true }],
      },
      tokenStored,
    );
    return p.ok && p.rows.length === 1;
  })(),
);

if (failures > 0) {
  console.error(`\nGLOSSARY IO TEST FAILED: ${failures} check(s)`);
  process.exit(1);
}
console.log("\nGLOSSARY IO ROUND-TRIP TEST PASSED — export → fresh import → idempotent re-import");
