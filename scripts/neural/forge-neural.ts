#!/usr/bin/env bun
/**
 * ODA NEURAL FORGE — headless batch forge with a REAL open-weight LLM.
 *
 * Runs the app's exact neural pipeline with a self-hosted model via
 * llama.cpp (node-llama-cpp): NO API key, NO vendor — free forever on
 * GitHub Actions (see .github/workflows/oda-neural-forge.yml).
 *
 * Same contract as every other ODA engine:
 *   • shared neural prompts (src/lib/oda/neuralPrompts.ts)
 *   • glossary training memory (glossaryPromptBlock + enforceGlossary)
 *   • intelligent reference-standard pass (referenceDecision)
 *   • per-letter translator rating (rateTranslation)
 *   • byte-identical letterhead guarantee (reapplyLetterhead)
 *
 * If no model is given (or it fails), the script degrades to the app's
 * adaptive engine — the forge always produces output.
 *
 * Usage:
 *   bun scripts/neural/forge-neural.ts --model scripts/neural/models/Qwen3-8B-Q4_K_M.gguf
 *   bun scripts/neural/forge-neural.ts --no-neural                 # adaptive only
 *   bun scripts/neural/forge-neural.ts --dir letters --offset 12 --limit 12
 *   bun scripts/neural/forge-neural.ts --glossary glossary.json    # training memory
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, statSync, rmSync } from "node:fs";
import { join, basename, extname, dirname } from "node:path";
import { parseDocx } from "../../src/lib/oda/docxparse.ts";
import { parseDoc } from "../../src/lib/oda/docparse.ts";
import { reapplyLetterhead, referenceStandardPass, translateAdaptive } from "../../src/lib/oda/refine.ts";
import { adaptiveGenerate } from "../../src/lib/oda/engine.ts";
import {
  buildOverlay,
  enforceGlossary,
  glossaryPromptBlock,
  type GlossaryOverlay,
} from "../../src/lib/oda/extraDict.ts";
import { rateTranslation, referenceDecision } from "../../src/lib/oda/rating.ts";
import {
  buildUserPrompt,
  RESPONSE_SYSTEM,
  TRANSLATE_SYSTEM,
  type NeuralPromptInput,
} from "../../src/lib/oda/neuralPrompts.ts";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const has = (name: string): boolean => args.includes(`--${name}`);

const INBOX = flag("dir", "letters/8-ALL NEW LETTER");
const OUT = flag("out", "letters/out/neural");
const MODEL_PATH = flag("model", "");
const MODEL_NAME = flag("model-name", MODEL_PATH ? basename(MODEL_PATH) : "adaptive");
const GLOSSARY = flag("glossary", "");
const TASK = flag("task", "both"); // both | translate | response
const LANG = flag("lang", "Hindi");
const OFFSET = Number(flag("offset", "0"));
const LIMIT = Number(flag("limit", "0")); // 0 = all
const MAX_TOKENS = Number(flag("max-tokens", "1500"));
const MAX_CHARS = Number(flag("max-chars", "24000"));
const CTX = Number(flag("ctx", "8192"));
const NO_NEURAL = has("no-neural");

interface LetterResult {
  file: string;
  format: string;
  extractedChars: number;
  engine: "neural" | "adaptive";
  translate: {
    complete: boolean;
    rating: string;
    ratingNote: string;
    ratingScore: number;
    chars: number;
    untranslatedLatinWords: number;
  } | null;
  response: { chars: number } | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Extraction — the app's own extractors (exact code the browser uses).
// ---------------------------------------------------------------------------
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
      const dev = (l.match(/[\u0900-\u097F]/g) ?? []).length;
      const lat = (l.match(/[A-Za-z]/g) ?? []).length;
      if (dev > 0 && dev >= lat) return false;
      if (/@/.test(l)) return false;
      if (/\b\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)\b/i.test(l)) return false;
      if (/^(add(ress)?|e-?mail|phone|fax|tel|website|www)\b/i.test(l)) return false;
      const lower = l.toLowerCase();
      if (/^(cpf|rnj|ngp|tlhr|samb|dhn|asn|rmg|bkr|wcl|ecl|mcl|secl|blp|r-i|r-ii|r-iii)/.test(lower)) return false;
      return true;
    });
}

// ---------------------------------------------------------------------------
// Neural engine — llama.cpp via node-llama-cpp, dynamically imported so the
// adaptive-only mode runs without the runtime installed.
//
// CRITICAL: We create exactly ONE LlamaChatSession per system prompt and reuse
// it for every letter.  Creating a new session per call grabbed a new sequence
// from the context pool each time, exhausting it ("No sequences left" on CI).
// ---------------------------------------------------------------------------

let _translateSession: any = null;
let _responseSession: any = null;

async function initNeuralEngine(): Promise<{
  translate: (user: string) => Promise<string>;
  response: (user: string) => Promise<string>;
}> {
  if (_translateSession) {
    return {
      translate: (u: string) => _translateSession.prompt(u, { maxTokens: MAX_TOKENS }),
      response: (u: string) => _responseSession?.prompt(u, { maxTokens: MAX_TOKENS }),
    };
  }

  const { getLlama, LlamaChatSession } = await import("node-llama-cpp");
  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath: MODEL_PATH, gpu: false });
  const context = await model.createContext({ contextSize: CTX });

  // Qwen3 outputs `<think>` tokens by default. Disable thinking mode
  // so the model goes straight to translation output.
  const isQwen3 = /qwen.?3/i.test(MODEL_NAME);
  const translateSys = isQwen3 ? `${TRANSLATE_SYSTEM}\n/no_think` : TRANSLATE_SYSTEM;
  const responseSys = isQwen3 ? `${RESPONSE_SYSTEM}\n/no_think` : RESPONSE_SYSTEM;

  // Create ONE session per task using separate sequences from the context.
  // Each LlamaChatSession manages its own sequence internally.
  _translateSession = new LlamaChatSession({
    contextSequence: context.getSequence(),
    systemPrompt: translateSys,
  });

  // Only create response session if task includes responses (uses 2nd sequence).
  // On 7GB runners with small contexts, skip the response session to save memory.
  if (TASK === "both" || TASK === "response") {
    try {
      _responseSession = new LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: responseSys,
      });
    } catch (err) {
      console.warn(`[forge] Could not create response session (continuing with translate only): ${err instanceof Error ? err.message : err}`);
      _responseSession = null;
    }
  }

  return {
    translate: (u: string) => _translateSession.prompt(u, { maxTokens: MAX_TOKENS }),
    response: (u: string) => _responseSession?.prompt(u, { maxTokens: MAX_TOKENS }) ?? Promise.resolve(""),
  };
}

function loadOverlay(): GlossaryOverlay {
  if (!GLOSSARY) return buildOverlay(null);
  try {
    const rows = JSON.parse(readFileSync(GLOSSARY, "utf8"));
    return buildOverlay(Array.isArray(rows) ? rows : rows?.rows);
  } catch (err) {
    console.warn(`[forge] Could not load glossary ${GLOSSARY}: ${err instanceof Error ? err.message : err}`);
    return buildOverlay(null);
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const overlay = loadOverlay();
  const neural = !NO_NEURAL && MODEL_PATH.length > 0;
  if (neural) console.log(`[forge] Neural engine: ${MODEL_NAME} (${MODEL_PATH}) — free, keyless, local`);
  else console.log("[forge] Adaptive engine only (no --model given or --no-neural)");

  // Pre-initialize neural engine so model loads once before the letter loop
  let engine: { translate: (u: string) => Promise<string>; response: (u: string) => Promise<string> } | null = null;
  if (neural) {
    try {
      engine = await initNeuralEngine();
    } catch (err) {
      console.error(`[forge] Failed to load neural model: ${err instanceof Error ? err.message : err}`);
      console.log("[forge] Falling back to adaptive engine");
    }
  }

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

  const batch = files.slice(OFFSET, LIMIT > 0 ? OFFSET + LIMIT : undefined);
  if (batch.length === 0) {
    console.log(`[forge] No letters in range offset=${OFFSET} limit=${LIMIT} — nothing to do.`);
    return;
  }
  console.log(`[forge] ${batch.length} letter(s) of ${files.length} total (offset ${OFFSET})`);

  const results: LetterResult[] = [];
  let neuralOk = 0;
  let adaptiveFallback = 0;

  for (const file of batch) {
    const name = basename(file);
    const rel = file.replace(INBOX, "").replace(/^[\\/]+/, "");
    const stem = rel.replace(/\.[^.]+$/, "");
    const { text, format } = await extract(name, file);
    const devanagari = /[\u0900-\u097F]/.test(text);

    const result: LetterResult = {
      file: rel,
      format,
      extractedChars: text.length,
      engine: neural ? "neural" : "adaptive",
      translate: null,
      response: null,
    };

    if (text.trim().length === 0) {
      result.error = "EXTRACT-FAILED";
      writeFileSync(join(OUT, `${stem}.EXTRACT-FAILED.txt`), "No text extracted by the app pipeline.");
      results.push(result);
      continue;
    }

    const doc = { name, text, type: "Letter", language: devanagari ? "Hindi" : "English" };
    const mk = (sub: string) => {
      mkdirSync(join(OUT, dirname(stem)), { recursive: true });
      return join(OUT, `${stem}.${sub}`);
    };

    // ---- Translation flow ----
    if (TASK === "both" || TASK === "translate") {
      try {
        const source = text.slice(0, MAX_CHARS);

        let content: string;
        let engineName: "neural" | "adaptive" = "adaptive";
        let complete = false;
        if (neural && engine) {
          try {
            const input: NeuralPromptInput = {
              sourceText: source,
              sourceName: name,
              sourceType: doc.type,
              sourceLanguage: doc.language,
              language: LANG,
              formality: "Formal",
              format: "Same as original",
              task: "translate",
            };
            const user = `${buildUserPrompt(input)}\n${glossaryPromptBlock(overlay, LANG)}`;
            content = await engine.translate(user);
            engineName = "neural";
            neuralOk++;
            // Training memory guarantee + reference-standard + letterhead —
            // identical post-processing to the cloud forge.
            content = enforceGlossary(content, overlay, LANG);
            if (referenceDecision(source, LANG) !== "none") {
              content = referenceStandardPass(content, overlay);
            }
            content = reapplyLetterhead(content, source);
            complete = true;
          } catch (err) {
            adaptiveFallback++;
            console.warn(`[forge] neural failed for ${rel} — adaptive fallback: ${err instanceof Error ? err.message : err}`);
            const res = translateAdaptive(doc, { language: LANG, formality: "Formal", format: "Same as original" }, overlay);
            content = res.content;
            complete = res.complete;
          }
        } else {
          const res = translateAdaptive(doc, { language: LANG, formality: "Formal", format: "Same as original" }, overlay);
          content = res.content;
          complete = res.complete;
        }
        result.engine = engineName;
        const keptNote = /kept in the source language/.test(content);
        const untranslated = untranslatedProseLines(content);
        const reallyComplete = engineName === "neural" ? untranslated.length === 0 : complete && !keptNote && untranslated.length === 0;
        const rated = rateTranslation({ sourceText: text, complete: reallyComplete, language: LANG });
        result.translate = {
          complete: reallyComplete,
          rating: rated.rating,
          ratingNote: rated.note,
          ratingScore: rated.score,
          chars: content.length,
          untranslatedLatinWords: untranslated.length,
        };
        writeFileSync(mk("hi.txt"), content);
        if (untranslated.length > 0) {
          writeFileSync(mk("hi.untranslated.txt"), untranslated.join("\n"));
        }
      } catch (err) {
        result.translate = {
          complete: false,
          rating: "partial",
          ratingNote: "Translation failed",
          ratingScore: 0,
          chars: 0,
          untranslatedLatinWords: -1,
        };
        writeFileSync(mk("hi.ERROR.txt"), String(err));
      }
    }

    // ---- Response flow ----
    if (TASK === "both" || TASK === "response") {
      try {
        let content: string;
        if (neural && engine) {
          const input: NeuralPromptInput = {
            sourceText: text.slice(0, MAX_CHARS),
            sourceName: name,
            sourceType: doc.type,
            sourceLanguage: doc.language,
            language: "English",
            formality: "Formal",
            format: "Markdown",
            task: "response",
          };
          content = await engine.response(buildUserPrompt(input));
          neuralOk++;
        } else {
          content = adaptiveGenerate(doc, { language: "English", formality: "Formal", format: "Markdown" }).content;
        }
        result.response = { chars: content.length };
        writeFileSync(mk("response.md"), content);
      } catch (err) {
        result.response = { chars: 0 };
        writeFileSync(mk("response.ERROR.txt"), String(err));
      }
    }

    results.push(result);
    const tr = result.translate;
    console.log(
      `${tr ? (tr.complete ? "✅" : "❌") : "—"} ${rel}  [${format}]  ${text.length} chars  engine:${result.engine}` +
        (tr ? `  rating:${tr.rating}` : "") +
        (tr && tr.untranslatedLatinWords > 0 ? `  ${tr.untranslatedLatinWords} untranslated` : ""),
    );
  }

  // ---- Report + machine-readable results (merged across matrix jobs) ----
  writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 2));
  const lines: string[] = [];
  lines.push("# ODA Neural Forge Report");
  lines.push("");
  lines.push(`- **Input:** \`${INBOX}\` — batch of ${batch.length} letter(s) (offset ${OFFSET})`);
  lines.push(`- **Output:** \`${OUT}\``);
  lines.push(`- **Engine:** ${neural ? `neural · ${MODEL_NAME} (llama.cpp, keyless, free)` : "adaptive (no model given)"}`);
  lines.push(`- **Pipeline:** app extraction → glossary training memory (${overlay.sentences.length} sentence entries) → neural/adaptive translation → reference-standard pass → per-letter rating`);
  lines.push("");
  lines.push("| Letter | Format | Chars | Engine | Hindi | Rating | Untranslated | Response |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const tr = r.translate;
    lines.push(
      `| ${r.file} | ${r.format} | ${r.extractedChars} | ${r.engine} | ${tr ? (tr.complete ? "✅" : "❌") : "—"} | ${tr ? `${tr.rating} (${tr.ratingScore})` : "—"} | ${tr ? tr.untranslatedLatinWords : "—"} | ${r.response && r.response.chars > 0 ? "✅" : "❌"} |`,
    );
  }
  lines.push("");
  lines.push(`- Neural completions: ${neuralOk} · adaptive fallbacks: ${adaptiveFallback}`);
  lines.push("");
  lines.push("_Generated by scripts/neural/forge-neural.ts — the same code the browser and the cloud forge use._");
  writeFileSync(join(OUT, "REPORT.md"), lines.join("\n"));

  console.log(`\nReport: ${join(OUT, "REPORT.md")}`);
  console.log(`Neural completions: ${neuralOk} · adaptive fallbacks: ${adaptiveFallback}`);
}

void main();
