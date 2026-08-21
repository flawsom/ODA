#!/usr/bin/env bun
/**
 * ODA LETTER FORGE — run the bundled reference letters through the app's
 * REAL on-device pipeline, headlessly:
 *
 *   1. Extract text with the app's own extractors (structural DOCX parse,
 *      legacy DOC/OLE2 parse — the exact code the browser uses).
 *   2. Translate the letter to Hindi via translateAdaptive (the app's
 *      primary Dispatch Forge action, including the reference-standard
 *      Devanagari pass and letterhead re-application).
 *   3. Forge a response via adaptiveGenerate.
 *   4. Write every output to <out>/ and a quality report that flags
 *      incomplete translations, untranslated lines, and missing structural
 *      fields (subject/ref/date/table/name/account).
 *
 * Usage:
 *   bun scripts/forge-letters.ts
 *   bun scripts/forge-letters.ts --dir "letters/8-ALL NEW LETTER" --out letters/out
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, statSync, rmSync } from "node:fs";
import { join, basename, extname, dirname } from "node:path";
import { parseDocx } from "../src/lib/oda/docxparse.ts";
import { parseDoc } from "../src/lib/oda/docparse.ts";
import { translateAdaptive } from "../src/lib/oda/refine.ts";
import { adaptiveGenerate } from "../src/lib/oda/engine.ts";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const INBOX = flag("dir", "letters/8-ALL NEW LETTER");
const OUT = flag("out", "letters/out");

interface LetterResult {
  file: string;
  format: string;
  extractedChars: number;
  devanagari: boolean;
  english: boolean;
  dual: boolean;
  translate: {
    complete: boolean;
    chars: number;
    untranslatedLatinWords: number;
    keptInSourceNote: boolean;
  } | null;
  response: {
    chars: number;
    hasSubject: boolean;
    hasRef: boolean;
    hasDate: boolean;
    hasSalutation: boolean;
    hasSignature: boolean;
    quotesMembers: boolean;
  } | null;
}

async function extract(name: string, path: string): Promise<{ text: string; format: string }> {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const ext = extname(name).toLowerCase();
  if (ext === ".docx") {
    const parsed = await parseDocx(ab);
    if (parsed.supported && parsed.text.trim().length > 0) return { text: parsed.text, format: "docx" };
    return { text: "", format: "docx" };
  }
  if (ext === ".doc") {
    const parsed = parseDoc(ab);
    if (parsed.supported && parsed.text.trim().length > 0) return { text: parsed.text, format: "doc" };
    return { text: "", format: "doc" };
  }
  return { text: readFileSync(path, "utf8"), format: ext.slice(1) || "txt" };
}

function latinWords(s: string): string[] {
  return s.match(/[A-Za-z]+/g) ?? [];
}

function untranslatedProseLines(content: string): string[] {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => {
      if (l.length === 0 || /[।]/.test(l) || /[१२३४५६७८९०]/.test(l)) return false;
      const words = latinWords(l);
      if (words.length < 2) return false;
      // A Devanagari-dominated line is translated — any Latin left in it is
      // data (roman numerals in "डी-I एवं II", codes in "कार्ड-II/डी-II",
      // the email/time in the ref line), not untranslated prose.
      const dev = (l.match(/[\u0900-\u097F]/g) ?? []).length;
      const lat = (l.match(/[A-Za-z]/g) ?? []).length;
      if (dev > 0 && dev >= lat) return false;
      // Emails and clock times are data, not prose.
      if (/@/.test(l)) return false;
      if (/\b\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)\b/i.test(l)) return false;
      // Letterhead-style address/contact lines stay in the source script.
      if (/^(add(ress)?|e-?mail|phone|fax|tel|website|www)\b/i.test(l)) return false;
      // Codes/numbers/references are data, not prose.
      const lower = l.toLowerCase();
      if (/^(cpf|rnj|ngp|tlhr|samb|dhn|asn|rmg|bkr|wcl|ecl|mcl|secl|secl|blp|r-i|r-ii|r-iii)/.test(lower)) return false;
      return true;
    });
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(docx|doc|txt)$/i.test(entry) && !entry.startsWith("~")) files.push(p);
    }
  };
  walk(INBOX);
  files.sort();

  /** All generated artifact paths under the out dir (for stale cleanup). */
  const walkOut = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) out.push(...walkOut(p));
      else out.push(p);
    }
    return out;
  };

  // Stale artifacts from earlier runs (a letter that was partial before a fix)
  // must not linger — every run starts clean so the report reflects THIS code.
  const stale = walkOut(OUT);
  for (const p of stale) {
    if (/\.(untranslated|ERROR)\.txt$/.test(p)) rmSync(p);
  }

  const results: LetterResult[] = [];

  for (const file of files) {
    const name = basename(file);
    const rel = file.replace(INBOX, "").replace(/^[\\/]+/, "");
    const stem = rel.replace(/\.[^.]+$/, "");
    const { text, format } = await extract(name, file);
    const devanagari = /[\u0900-\u097F]/.test(text);
    const english = /[A-Za-z]/.test(text);
    const dual = devanagari && english;

    const result: LetterResult = {
      file: rel,
      format,
      extractedChars: text.length,
      devanagari,
      english,
      dual,
      translate: null,
      response: null,
    };

    if (text.trim().length > 0) {
      // ---- Translation flow (the app's primary Dispatch Forge action) ----
      const doc = { name, text, type: "Letter", language: devanagari ? "Hindi" : "English" };
      try {
        const tr = translateAdaptive(doc, { language: "Hindi", formality: "Formal", format: "Same as original" });
        const keptNote = /kept in the source language/.test(tr.content);
        const untranslated = untranslatedProseLines(tr.content);
        result.translate = {
          // A letter is complete only when the translator is done AND the
          // untranslated-prose detector finds nothing — the app's own quality
          // gate ("beyond perfect" = zero Latin prose left in the output).
          complete: tr.complete && !keptNote && untranslated.length === 0,
          chars: tr.content.length,
          untranslatedLatinWords: untranslated.length,
          keptInSourceNote: keptNote,
        };
        mkdirSync(join(OUT, dirname(stem)), { recursive: true });
        writeFileSync(join(OUT, `${stem}.hi.txt`), tr.content);
        if (untranslated.length > 0) {
          writeFileSync(join(OUT, `${stem}.hi.untranslated.txt`), untranslated.join("\n"));
        }
      } catch (err) {
        result.translate = {
          complete: false,
          chars: 0,
          untranslatedLatinWords: -1,
          keptInSourceNote: false,
        };
        writeFileSync(join(OUT, `${stem}.hi.ERROR.txt`), String(err));
      }

      // ---- Response flow ----
      try {
        const res = adaptiveGenerate(doc, { language: "English", formality: "Formal", format: "Markdown" });
        const lower = res.content.toLowerCase();
        result.response = {
          chars: res.content.length,
          hasSubject: /subject|विषय/i.test(res.content),
          hasRef: /ref|letter no/i.test(res.content),
          hasDate: /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(res.content),
          hasSalutation: /(respected|dear|sir|madam|महोदय)/i.test(res.content),
          hasSignature: /(yours faithfully|yours sincerely|regards|भवदीय|\(.*\))/i.test(res.content),
          quotesMembers: /shri|smt|mr\.|mrs\./i.test(res.content),
        };
        mkdirSync(join(OUT, dirname(stem)), { recursive: true });
        writeFileSync(join(OUT, `${stem}.response.md`), res.content);
      } catch (err) {
        result.response = {
          chars: 0,
          hasSubject: false,
          hasRef: false,
          hasDate: false,
          hasSalutation: false,
          hasSignature: false,
          quotesMembers: false,
        };
        writeFileSync(join(OUT, `${stem}.response.ERROR.txt`), String(err));
      }
    } else {
      writeFileSync(join(OUT, `${stem}.EXTRACT-FAILED.txt`), "No text extracted by the app pipeline.");
    }

    results.push(result);
    const flagS = (ok: boolean) => (ok ? "✅" : "❌");
    const tr = result.translate;
    console.log(
      `${flagS(tr ? tr.complete : false)} ${rel}  [${format}]  ${text.length} chars` +
        (tr ? `  hi:${tr.complete ? "complete" : `partial(${tr.untranslatedLatinWords} untranslated)`}` : "  extract-fail"),
    );
  }

  // ---- Report ----
  const lines: string[] = [];
  lines.push("# ODA Letter Forge Report");
  lines.push("");
  lines.push(`- **Input:** \`${INBOX}\` — ${files.length} letter file(s)`);
  lines.push(`- **Output:** \`${OUT}\``);
  lines.push(`- **Pipeline:** app extraction (DOCX structural / DOC OLE2) → translateAdaptive (Hindi) → adaptiveGenerate (response)`);
  lines.push("");
  lines.push("| Letter | Format | Chars | Script | Hindi translation | Untranslated lines | Response ok |");
  lines.push("|---|---|---|---|---|---|---|");
  const incomplete: string[] = [];
  const failExtract: string[] = [];
  for (const r of results) {
    const tr = r.translate;
    const ok = tr ? tr.complete : false;
    if (tr && !tr.complete) incomplete.push(r.file);
    if (r.extractedChars === 0) failExtract.push(r.file);
    lines.push(
      `| ${r.file} | ${r.format} | ${r.extractedChars} | ${r.devanagari ? (r.dual ? "dual" : "Hindi") : "English"} | ${tr ? (ok ? "✅" : "❌") : "—"} | ${tr ? tr.untranslatedLatinWords : "—"} | ${r.response && r.response.chars > 0 ? "✅" : "❌"} |`,
    );
  }
  lines.push("");
  lines.push(`- Complete Hindi translations: ${results.length - incomplete.length - failExtract.length}/${results.length}`);
  if (incomplete.length > 0) lines.push(`- Incomplete: ${incomplete.join("; ")}`);
  if (failExtract.length > 0) lines.push(`- Extraction failures: ${failExtract.join("; ")}`);
  lines.push("");
  lines.push("_Generated by scripts/forge-letters.ts — runs the same code the browser uses._");
  writeFileSync(join(OUT, "REPORT.md"), lines.join("\n"));
  console.log(`\nReport: ${join(OUT, "REPORT.md")}`);
  console.log(`Complete: ${results.length - incomplete.length - failExtract.length}/${results.length}`);
}

void main();
