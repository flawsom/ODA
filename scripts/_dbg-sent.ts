import { GLOSSARY } from "../src/lib/oda/glossary";
import { GLOSSARY_EXTRA } from "../src/lib/oda/glossary-extra";

type Phrase = { en: string; tr: Record<string, string> };
interface PhraseSet {
  sorted: Phrase[];
  re: Map<Phrase, RegExp>;
  flex: Map<Phrase, RegExp>;
}
function compilePhrases(entries: Phrase[]): PhraseSet {
  const sorted = [...entries].sort((a, b) => b.en.length - a.en.length);
  const re = new Map<Phrase, RegExp>();
  const flex = new Map<Phrase, RegExp>();
  for (const p of sorted) {
    const escaped = p.en.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
    re.set(p, new RegExp("^" + escaped.replace(/\{(\d+)\}/g, "(.{1,120}?)") + "$", "i"));
    flex.set(p, new RegExp("^" + escaped.replace(/\{(\d+)\}/g, "(.{1,120}?)").replace(/\s+/g, "\\s*") + "$", "i"));
  }
  return { sorted, re, flex };
}
const all: Phrase[] = [...(GLOSSARY as Phrase[]), ...(GLOSSARY_EXTRA as Phrase[])];
const set = compilePhrases(all);

const lines = [
  "Further, all the Dealing Assistants are also directed to submit the  settled P.P.O. pension  files of each month to Pension Section in the next  corresponding mo n th positively.",
  "S.O. And A. O . Section lncharge are also directed to ensure that the settled  P.P.O. files are handedover by the Dealing Assistants to the Pension Section  positively after settlement of claim in same month.",
];
for (const line of lines) {
  const normalized = line
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/No\.[\s-]*-/gi, "No-")
    .replace(/\s+/g, " ")
    .trim();
  console.log("LINE:", normalized);
  let hit: string | null = null;
  for (const p of set.sorted) {
    const m = normalized.match(set.re.get(p)!) ?? normalized.match(set.flex.get(p)!);
    if (m) {
      hit = p.en;
      break;
    }
  }
  console.log("  hit:", hit ?? "NONE");
}
