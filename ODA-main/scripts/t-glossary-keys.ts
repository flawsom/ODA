// scripts/t-glossary-keys.ts
//
// En-key collision guard for the glossary TM. Every sentence-dictionary row
// lives in ONE array (glossary.ts) across two families: the `hi` post-pass
// templates (named {slots}) and the `tr` phrase-pass sentences ({1} slots).
// Both families match on the English source, so two rows with the same
// normalized `en` silently shadow each other — the phrase pass wins for the
// exact sentence and the post-pass row (or a second row in the same family)
// is dead weight, or worse, renders a different Hindi than the one the
// contributor intended.
//
// This test fails on ANY normalized-`en` collision so future entries can
// never shadow a sibling silently: extend the existing entry instead of
// adding a lookalike. It also fails on an entry carrying BOTH families (the
// phrase pass reads `tr`, the post-pass compiles every row with `hi`, so a
// both-carrying row double-fires). Normalization mirrors the engine's own
// matcher (glossary.ts `normalize`): lowercase, non-alphanumerics → single
// space. A synthetic-case assertion proves the detector itself works, so the
// guard can never pass vacuously.

import { GLOSSARY } from "../src/lib/oda/glossary";

/** Same normalization the engine's post-pass matcher applies. */
function normEn(en: string): string {
  return en
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Problem {
  message: string;
}

/** Returns every en-key collision / family violation in a glossary array. */
function detectProblems(
  entries: Array<{ en: string; hi?: string; tr?: Record<string, string> }>,
): Problem[] {
  const problems: Problem[] = [];
  const byKey = new Map<string, Array<{ index: number; family: "hi" | "tr"; hi: string | null }>>();
  entries.forEach((e, index) => {
    const family: "hi" | "tr" = e.tr ? "tr" : "hi";
    const key = normEn(e.en);
    const list = byKey.get(key) ?? [];
    list.push({ index, family, hi: e.hi ?? e.tr?.Hindi ?? null });
    byKey.set(key, list);
  });
  for (const [key, rows] of byKey) {
    if (rows.length < 2) continue;
    const renderings = new Set(rows.map((r) => r.hi ?? ""));
    problems.push({
      message: `${renderings.size > 1 ? "conflicting renderings" : "duplicate en"}: ${key}` +
        rows.map((r) => `  #[${r.index}] family=${r.family} hi=${JSON.stringify(r.hi)}`).join("\n"),
    });
  }
  entries.forEach((e, index) => {
    if (e.hi && e.tr) {
      problems.push({
        message: `entry #[${index}] carries BOTH hi and tr families — the two passes would double-fire: ${e.en}`,
      });
    }
  });
  return problems;
}

// --- Self-check: the detector must catch a planted duplicate + a both-family
// row, or the guard is useless. These are the exact regressions it exists for.
const synthetic = [
  { en: "Please acknowledge the receipt of the above at the earliest.", hi: "कृपया …" },
  {
    en: "Please acknowledge the receipt of the above at the earliest.",
    tr: { Hindi: "कृपया …" },
  },
  {
    en: "Report for joining at the {1} on or before {2}.",
    hi: "{2} से पूर्व …",
    tr: { Hindi: "{1} में …" },
  },
];
const syntheticProblems = detectProblems(synthetic);
if (syntheticProblems.length !== 2) {
  console.error(
    `❌ self-check failed: detector found ${syntheticProblems.length} problem(s), expected 2:\n${syntheticProblems.map((p) => p.message).join("\n")}`,
  );
  process.exit(1);
}

const problems = detectProblems(GLOSSARY);
if (problems.length === 0) {
  console.log("✅ GLOSSARY EN-KEY GUARD PASSED — no duplicate or conflicting en keys across the two families");
  process.exit(0);
}
for (const p of problems) {
  console.error(`❌ ${p.message}`);
}
console.error(
  `\nGLOSSARY EN-KEY GUARD FAILED: ${problems.length} problem(s). Extend the existing entry instead of adding a lookalike — the extra row would silently shadow the one you can see.`,
);
process.exit(1);
