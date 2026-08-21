#!/usr/bin/env bun
// ---------------------------------------------------------------------------
// ODA FORGE BENCH — the keyless headless forge.
//
// Runs the EXACT engine code the browser uses (translateAdaptive /
// adaptiveGenerate / reference-standard passes / per-letter rating) against a
// folder of documents — inbox/, a corpus folder, or the built-in samples —
// and writes, per document:
//   <name>.<lang>.txt        the translation (default: Hindi)
//   <name>.response.md       the formal response draft (default: English)
// plus forge-reports/forge-results.json and forge-reports/FORGE_REPORT.md.
//
// Engines:
//   --dry-run   the deterministic adaptive engine only (zero network, zero
//               keys, used by CI smoke tests). This is the default.
//   --neural    a real open-weights LLM served locally by Ollama (or any
//               OpenAI-compatible endpoint) — the same prompt contract and
//               the same post-processing as the app's cloud forge, so a
//               Qwen3 model on a free GitHub Actions runner and GPT-5.6 on a
//               paid key produce the same reference-standard, rated output.
//               Every document falls back to the adaptive engine if the
//               model is unreachable, so a forge run NEVER fails outright.
//
// Sharding: --shard i --shard-total n lets a workflow parallelize one corpus
// across n free runners (each writes forge-reports/shards/shard-<i>.json);
// --merge then combines them into the final results + report.
//
// Idempotent: --manifest tracks a content hash + engine per document, so
// already-forged, unchanged documents are skipped on re-runs.
// ---------------------------------------------------------------------------
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, relative, sep } from "node:path";
import type { AdaptiveDoc, AdaptiveOptions } from "../src/lib/oda/adaptive";
import { parseDoc } from "../src/lib/oda/docparse";
import { parseDocx } from "../src/lib/oda/docxparse";
import { adaptiveGenerate, classifyType } from "../src/lib/oda/engine";
import {
  buildOverlay,
  emptyOverlay,
  enforceGlossary,
  glossaryPromptBlock,
  type GlossaryOverlay,
  type GlossaryRow,
} from "../src/lib/oda/extraDict";
import {
  buildUserPrompt,
  RESPONSE_SYSTEM,
  type NeuralPromptInput,
} from "../src/lib/oda/neuralPrompts";
import {
  ensureComplete,
  estimateCompleteness,
  translateDocumentFully,
} from "../src/lib/oda/neuralTranslate";
import { sweepLeftoverLines } from "../src/lib/oda/translate";
import { rateTranslation, referenceDecision } from "../src/lib/oda/rating";
import { reapplyLetterhead, referenceStandardPass, translateAdaptive } from "../src/lib/oda/refine";
import { SAMPLES } from "../src/lib/oda/samples";

// ---------------------------------------------------------------------------
// Node fetch shim — the DOCX template renderers load public/templates/* via
// fetch (Vite serves that directory in the browser). In Node, serve the same
// files from disk so the DOCX export smoke check works headlessly.
// ---------------------------------------------------------------------------
if (typeof process !== "undefined" && process.versions?.node) {
  const { readFileSync } = await import("node:fs");
  const { join: joinPath } = await import("node:path");
  const PUBLIC_ROOT = joinPath(process.cwd(), "public");
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: any) => {
    const url = String(input);
    const m = url.match(/\/templates\/([^?#]+)/);
    if (m) {
      try {
        const buf = readFileSync(joinPath(PUBLIC_ROOT, "templates", m[1]));
        return new Response(new Uint8Array(buf), { status: 200 });
      } catch {
        return new Response("not found", { status: 404 });
      }
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface Cli {
  docs: string[];
  out: string;
  reportDir: string;
  manifestPath: string;
  neural: boolean;
  model: string;
  endpoint: string;
  language: string;
  responseLanguage: string;
  shard: number;
  shardTotal: number;
  merge: boolean;
  glossaryPath: string | null;
  includeSamples: boolean;
  docxSmoke: boolean;
}

const LANG_CODE: Record<string, string> = {
  Hindi: "hi",
  Tamil: "ta",
  Bengali: "bn",
  Telugu: "te",
  Kannada: "kn",
  Gujarati: "gu",
  Marathi: "mr",
  Punjabi: "pa",
  Odia: "or",
  Malayalam: "ml",
  English: "en",
  Spanish: "es",
  French: "fr",
  German: "de",
  Arabic: "ar",
};

function langCode(lang: string): string {
  return LANG_CODE[lang] ?? lang.slice(0, 2).toLowerCase();
}

function parseCli(argv: string[]): Cli {
  const cli: Cli = {
    docs: [],
    out: "outbox",
    reportDir: "forge-reports",
    manifestPath: "forge-reports/forge-manifest.json",
    neural: false,
    model: process.env.ODA_FORGE_MODEL ?? "qwen3:4b",
    endpoint: process.env.ODA_FORGE_ENDPOINT ?? "http://127.0.0.1:11434/v1",
    language: "Hindi",
    responseLanguage: "English",
    shard: -1,
    shardTotal: 1,
    merge: false,
    glossaryPath: null,
    includeSamples: true,
    docxSmoke: false,
  };
  const take = (i: number) => argv[i + 1];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--docs":
        cli.docs.push(take(i++));
        break;
      case "--out":
        cli.out = take(i++);
        break;
      case "--report-dir":
        cli.reportDir = take(i++);
        break;
      case "--manifest":
        cli.manifestPath = take(i++);
        break;
      case "--neural":
        cli.neural = true;
        break;
      case "--dry-run":
        cli.neural = false;
        break;
      case "--model":
        cli.model = take(i++);
        break;
      case "--endpoint":
        cli.endpoint = take(i++);
        break;
      case "--language":
        cli.language = take(i++);
        break;
      case "--response-language":
        cli.responseLanguage = take(i++);
        break;
      case "--shard":
        cli.shard = Number(take(i++));
        break;
      case "--shard-total":
        cli.shardTotal = Number(take(i++));
        break;
      case "--merge":
        cli.merge = true;
        break;
      case "--glossary":
        cli.glossaryPath = take(i++);
        break;
      case "--no-samples":
        cli.includeSamples = false;
        break;
      case "--docx-smoke":
        cli.docxSmoke = true;
        break;
      case "-h":
      case "--help": {
        console.log(
          [
            "ODA Forge Bench — keyless headless forge (runs the app's exact engine).",
            "",
            "Usage: bun scripts/forge-bench.ts [flags]",
            "  --docs <dir>            document folder(s) to forge (repeatable; default: none — samples only)",
            "  --out <dir>             output folder for per-document drafts (default: outbox)",
            "  --report-dir <dir>      results + report folder (default: forge-reports)",
            "  --manifest <path>       skip already-forged docs by content hash (default: <report-dir>/forge-manifest.json)",
            "  --neural                use a local open-weights LLM (Ollama / OpenAI-compatible endpoint)",
            "  --dry-run               adaptive engine only, zero network (default)",
            "  --model <tag>           Ollama model (default: qwen3:4b; env ODA_FORGE_MODEL)",
            "  --endpoint <url>        OpenAI-compatible base URL (default: http://127.0.0.1:11434/v1; env ODA_FORGE_ENDPOINT)",
            "  --language <lang>       translation language (default: Hindi)",
            "  --response-language     response language (default: English)",
            "  --shard i --shard-total n   forge only shard i of n (parallel free runners)",
            "  --merge                 combine forge-reports/shards/*.json into the final report",
            "  --glossary <path>       JSON array of GlossaryRow rows to train the forge on",
            "  --no-samples            do not include the bundled sample corpus",
            "  --docx-smoke            render the first translation to DOCX and validate it",
          ].join("\n"),
        );
        process.exit(0);
      }
    }
  }
  return cli;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

function detectScript(text: string): string {
  const dev = (text.match(/[\u0900-\u097f]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (dev > 0 && latin > 0) return "dual";
  if (dev > 0) return "Hindi";
  return "English";
}

function detectLanguage(text: string): string | undefined {
  if (/[\u0900-\u097f]/.test(text)) return "Hindi";
  return "English";
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Walk a folder recursively for supported document files. */
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/^(readme(\..*)?)$/i.test(e.name)) continue; // documentation, not a document
    else if (/\.(txt|md|docx|doc|csv|rtf|html|htm|json|yaml|yml)$/i.test(e.name)) out.push(p);
  }
  return out.sort();
}

// ---------------------------------------------------------------------------
// Document extraction — the same parsers the browser uses
// ---------------------------------------------------------------------------

interface DocSource {
  name: string;
  text: string;
  format: string;
  note?: string;
}

async function readDocSource(filePath: string): Promise<DocSource | null> {
  const ext = extname(filePath).toLowerCase();
  const buf = await readFile(filePath);
  if (ext === ".docx") {
    const r = await parseDocx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    if (!r.supported) return null;
    return { name: basename(filePath, ext), text: r.text, format: "docx", note: r.note };
  }
  if (ext === ".doc") {
    const r = parseDoc(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    if (!r.supported) return null;
    return { name: basename(filePath, ext), text: r.text, format: "doc", note: r.note };
  }
  return { name: basename(filePath, ext), text: buf.toString("utf8"), format: "txt" };
}

// ---------------------------------------------------------------------------
// Neural engine (Ollama / any OpenAI-compatible endpoint) — keyless, local
// ---------------------------------------------------------------------------

async function neuralComplete(endpoint: string, model: string, system: string, user: string): Promise<string> {
  const url = `${endpoint.replace(/\/+$/, "")}/chat/completions`;
  const body = {
    model,
    temperature: 0.6,
    max_tokens: 8192,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return content;
      throw new Error("model returned empty content");
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("neural request failed");
}

// ---------------------------------------------------------------------------
// Forging
// ---------------------------------------------------------------------------

interface DocResult {
  name: string;
  rel: string;
  format: string;
  chars: number;
  script: string;
  translation: string;
  tEngine: string;
  complete: boolean;
  rating: string;
  ratingNote: string;
  ratingScore: number;
  response: string;
  rEngine: string;
  responseOk: boolean;
  ms: number;
}

interface ForgeConfig {
  neural: boolean;
  model: string;
  endpoint: string;
  language: string;
  responseLanguage: string;
  overlay: GlossaryOverlay;
  out: string;
}

const ATTRIBUTION = (model: string) =>
  `\n\n— Forged by ODA Neural Forge · ${model} · GitHub Actions — free forever, no API keys`;

async function forgeOne(doc: DocSource, rel: string, cfg: ForgeConfig): Promise<DocResult> {
  const t0 = Date.now();
  const text = doc.text ?? "";
  const opts: AdaptiveOptions = { language: cfg.language, formality: "Formal", format: "markdown" };
  const respOpts: AdaptiveOptions = { language: cfg.responseLanguage, formality: "Formal", format: "markdown" };
  const adaptiveDoc: AdaptiveDoc = {
    name: doc.name,
    text,
    type: classifyType(text, doc.name),
    language: detectLanguage(text),
    formality: "Formal",
  };

  // ---- Translation --------------------------------------------------------
  let translation = "";
  let complete = true;
  let tEngine = "adaptive";
  let ratingNote = "";
  if (cfg.neural) {
    try {
      const input: NeuralPromptInput = {
        sourceText: text,
        sourceName: doc.name,
        sourceType: adaptiveDoc.type,
        sourceLanguage: adaptiveDoc.language,
        language: cfg.language,
        formality: "Formal",
        format: "markdown",
        task: "translate",
      };
      // Neural training memory: the confidential glossary rides in the prompt
      // (same contract as the app's cloud forge) and is enforced
      // deterministically afterwards — the user's translations always win.
      const glossaryBlock = glossaryPromptBlock(cfg.overlay, cfg.language);
      const provider = async (system: string, user: string) =>
        neuralComplete(
          cfg.endpoint,
          cfg.model,
          system,
          user + (glossaryBlock ? `\n${glossaryBlock}` : ""),
        );
      // The never-truncated path: any document length is split into segments,
      // translated fully, completeness-gated and retried — a neural forge run
      // can no longer ship a partial translation cut at max_tokens.
      const res = await translateDocumentFully(input, provider, {
        language: cfg.language,
        chunkSize: 12000,
        maxRetries: 3,
        maxWholeRounds: 3,
        // The deterministic floor — whatever the model could not finish is
        // rendered fully in Devanagari so a neural forge run can never ship
        // a partial translation.
        sweepLeftovers: (lines) => sweepLeftoverLines(lines, cfg.language, cfg.overlay),
      });
      let content = res.content;
      content = enforceGlossary(content, cfg.overlay, cfg.language);
      if (referenceDecision(text, cfg.language) !== "none") {
        content = referenceStandardPass(content, cfg.overlay);
      }
      content = reapplyLetterhead(content, text);
      // THE GUARANTEE on the shipped bytes — same floor the app engines run.
      const finalPass = ensureComplete(content, cfg.language, (lines) =>
        sweepLeftoverLines(lines, cfg.language, cfg.overlay),
      );
      if (finalPass.content !== content) {
        content = finalPass.content;
        if (referenceDecision(text, cfg.language) !== "none") {
          content = referenceStandardPass(content, cfg.overlay);
        }
        content = reapplyLetterhead(content, text);
      }
      translation = content + ATTRIBUTION(cfg.model);
      tEngine = `neural:${cfg.model}`;
      complete = estimateCompleteness(content, cfg.language).complete;
    } catch (err) {
      console.warn(`  ⚠ neural translation failed for ${rel} — falling back to adaptive: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (!translation) {
    const res = translateAdaptive(adaptiveDoc, opts, cfg.overlay);
    translation = res.content;
    complete = res.complete;
    tEngine = "adaptive";
    ratingNote = res.ratingNote;
  }
  // Every letter is translator-rated before it ships, whichever engine forged it.
  const rated = rateTranslation({ sourceText: text, complete, language: cfg.language });

  // ---- Response -----------------------------------------------------------
  let response = "";
  let rEngine = "adaptive";
  if (cfg.neural) {
    try {
      const input: NeuralPromptInput = {
        sourceText: text,
        sourceName: doc.name,
        sourceType: adaptiveDoc.type,
        sourceLanguage: adaptiveDoc.language,
        language: cfg.responseLanguage,
        formality: "Formal",
        format: "markdown",
        task: "response",
      };
      response = await neuralComplete(cfg.endpoint, cfg.model, RESPONSE_SYSTEM, buildUserPrompt(input));
      response = response.trim() + ATTRIBUTION(cfg.model);
      rEngine = `neural:${cfg.model}`;
    } catch (err) {
      console.warn(`  ⚠ neural response failed for ${rel} — falling back to adaptive: ${err instanceof Error ? err.message : err}`);
    }
  }
  if (!response) {
    response = adaptiveGenerate(adaptiveDoc, respOpts).content;
    rEngine = "adaptive";
  }

  return {
    name: doc.name,
    rel,
    format: doc.format,
    chars: text.length,
    script: detectScript(text),
    translation,
    tEngine,
    complete,
    rating: rated.rating,
    ratingNote: rated.note || ratingNote,
    ratingScore: rated.score,
    response,
    rEngine,
    responseOk: response.trim().length > 60,
    ms: Date.now() - t0,
  };
}

// ---------------------------------------------------------------------------
// Output writers
// ---------------------------------------------------------------------------

function safeRel(rel: string): string {
  // Keep sub-folder structure but never escape the out dir.
  return rel.replace(/^\.?\/+/, "").replace(/[/\\]/g, sep);
}

async function writeDocOutputs(out: string, res: DocResult, lang: string): Promise<void> {
  const rel = safeRel(res.rel);
  const base = rel.endsWith(res.name) ? rel : join(dirname(rel), res.name);
  const dir = join(out, dirname(base));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${basename(base)}.${langCode(lang)}.txt`), res.translation, "utf8");
  await writeFile(join(dir, `${basename(base)}.response.md`), res.response, "utf8");
}

const esc = (s: string) => s.replace(/\|/g, "\\|");

function renderReport(results: DocResult[], meta: { engine: string; model: string; neural: boolean; language: string; total: number; skipped: number }): string {
  const rows = results
    .map((r) => {
      const tr =
        r.complete && r.rating === "reference"
          ? "✅ reference"
          : r.complete
            ? "✅ complete"
            : "⚠ partial";
      return `| ${esc(r.name)} | ${r.format} | ${r.chars} | ${r.script} | ${tr} (${r.ratingScore}) | ${esc(r.tEngine)} | ${r.responseOk ? "✅" : "⚠"} |`;
    })
    .join("\n");
  const ratingSummary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.rating] = (acc[r.rating] ?? 0) + 1;
    return acc;
  }, {});
  return [
    "# ODA Forge Report",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Engine: ${meta.engine}${meta.neural ? ` · model ${meta.model}` : ""}`,
    `- Translation language: ${meta.language}`,
    `- Documents forged: ${meta.total} (${meta.skipped} skipped from the manifest)`,
    "",
    "| Letter | Format | Chars | Script | Hindi translation | Engine | Response ok |",
    "|---|---|---|---|---|---|---|",
    rows,
    "",
    "- Translations rated: " +
      Object.entries(ratingSummary)
        .map(([k, v]) => `${v} ${k}`)
        .join(" · "),
    "",
    "_Generated automatically by the ODA forge workflow — free forever, no API keys._",
  ].join("\n");
}

interface Manifest {
  files: Record<string, { hash: string; engine: string; tEngine: string; rEngine: string; rating: string }>;
}

async function loadManifest(path: string): Promise<Manifest> {
  if (!(await exists(path))) return { files: {} };
  try {
    return JSON.parse(await readFile(path, "utf8")) as Manifest;
  } catch {
    return { files: {} };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2));
  await mkdir(cli.out, { recursive: true });
  await mkdir(cli.reportDir, { recursive: true });
  await mkdir(join(cli.reportDir, "shards"), { recursive: true });

  // ---- Merge mode: combine shard outputs into the final report ------------
  if (cli.merge) {
    const shardDir = join(cli.reportDir, "shards");
    const files = (await readdir(shardDir).catch(() => [])).filter((f) => f.startsWith("shard-") && f.endsWith(".json"));
    const all: DocResult[] = [];
    const metas: Array<{ model?: string; language?: string }> = [];
    for (const f of files) {
      try {
        const j = JSON.parse(await readFile(join(shardDir, f), "utf8")) as { docs: DocResult[]; model?: string; language?: string };
        all.push(...j.docs);
        metas.push({ model: j.model, language: j.language });
      } catch {
        /* skip corrupt shard */
      }
    }
    if (all.length === 0) {
      // Everything was already forged (manifest skip) — reuse the previous
      // results so the report/Pages site never renders empty.
      const prev = await readFile(join(cli.reportDir, "forge-results.json"), "utf8").catch(() => null);
      if (prev) {
        try {
          const p = JSON.parse(prev) as { docs?: DocResult[] };
          all.push(...(p.docs ?? []));
        } catch {
          /* ignore corrupt previous results */
        }
      }
    }
    all.sort((a, b) => a.rel.localeCompare(b.rel));

    // Union the per-shard manifests so already-forged docs stay skipped on
    // re-runs (each shard exports forge-reports/shards/manifest-<i>.json).
    const manifestFiles = (await readdir(shardDir).catch(() => [])).filter((f) => f.startsWith("manifest-") && f.endsWith(".json"));
    const mergedManifest = await loadManifest(cli.manifestPath);
    for (const f of manifestFiles) {
      try {
        const j = JSON.parse(await readFile(join(shardDir, f), "utf8")) as Manifest;
        Object.assign(mergedManifest.files, j.files);
      } catch {
        /* skip corrupt shard manifest */
      }
    }
    if (manifestFiles.length > 0) {
      await mkdir(dirname(cli.manifestPath), { recursive: true });
      await writeFile(cli.manifestPath, JSON.stringify(mergedManifest, null, 2), "utf8");
      console.log(`[merge] unioned ${manifestFiles.length} shard manifest(s) → ${cli.manifestPath}`);
    }

    const engine = all.some((d) => d.tEngine.startsWith("neural")) ? "neural" : "adaptive";
    const model = metas.find((m) => m.model)?.model;
    const report = renderReport(all, {
      engine: engine + (engine === "neural" && model ? ` (${model})` : ""),
      model: model ?? "",
      neural: engine === "neural",
      language: metas.find((m) => m.language)?.language ?? "Hindi",
      total: all.length,
      skipped: 0,
    });
    await writeFile(join(cli.reportDir, "forge-results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), engine, model, docs: all }, null, 2), "utf8");
    await writeFile(join(cli.reportDir, "FORGE_REPORT.md"), report, "utf8");
    console.log(`[merge] combined ${all.length} document(s) from ${files.length} shard(s) → ${cli.reportDir}/FORGE_REPORT.md`);
    return;
  }

  // ---- Collect documents --------------------------------------------------
  const sources: Array<{ doc: DocSource; rel: string }> = [];
  for (const dir of cli.docs) {
    if (!(await exists(dir))) continue;
    for (const file of await walk(dir)) {
      const doc = await readDocSource(file);
      if (!doc) continue;
      sources.push({ doc, rel: relative(dir, file) });
    }
  }
  if (cli.includeSamples) {
    for (const s of SAMPLES) {
      sources.push({
        doc: { name: s.name.replace(/\.[^.]+$/, ""), text: s.text, format: "txt" },
        rel: `samples/${s.name}`,
      });
    }
  }
  if (sources.length === 0) {
    console.warn("[forge] no documents found — drop files into inbox/ (or pass --docs) and re-run.");
    return;
  }

  // ---- Sharding -----------------------------------------------------------
  let docs = sources;
  if (cli.shard >= 0 && cli.shardTotal > 1) {
    docs = sources.filter((_, i) => i % cli.shardTotal === cli.shard);
    console.log(`[forge] shard ${cli.shard}/${cli.shardTotal} — ${docs.length} of ${sources.length} document(s)`);
  }

  // ---- Overlay (glossary training memory) ---------------------------------
  let overlay: GlossaryOverlay = emptyOverlay();
  if (cli.glossaryPath && (await exists(cli.glossaryPath))) {
    const rows = JSON.parse(await readFile(cli.glossaryPath, "utf8")) as GlossaryRow[];
    overlay = buildOverlay(rows);
    console.log(`[forge] glossary training memory loaded: ${rows.length} row(s)`);
  }

  // ---- Forge ---------------------------------------------------------------
  const manifest = await loadManifest(cli.manifestPath);
  const cfg: ForgeConfig = {
    neural: cli.neural,
    model: cli.model,
    endpoint: cli.endpoint,
    language: cli.language,
    responseLanguage: cli.responseLanguage,
    overlay,
    out: cli.out,
  };
  const engineLabel = cfg.neural ? `neural · ${cfg.model}` : "adaptive";
  console.log(`[forge] engine: ${engineLabel} · translation → ${cli.language} · response → ${cli.responseLanguage}`);

  const results: DocResult[] = [];
  let skipped = 0;
  for (const { doc, rel } of docs) {
    const key = rel.split(sep).join("/");
    const hash = sha256(doc.text);
    const prev = manifest.files[key];
    const hiFile = join(cli.out, safeRel(key).replace(/\.[^.]+$/, "") + `.${langCode(cli.language)}.txt`);
    const respFile = join(cli.out, safeRel(key).replace(/\.[^.]+$/, "") + ".response.md");
    const prevEngine = prev?.engine ?? "";
    const wantEngine = cfg.neural ? `neural:${cfg.model}` : "adaptive";
    if (prev && prev.hash === hash && prevEngine === wantEngine && (await exists(hiFile)) && (await exists(respFile))) {
      skipped++;
      continue;
    }
    process.stdout.write(`  · ${rel} … `);
    const res = await forgeOne(doc, rel, cfg);
    await writeDocOutputs(cli.out, res, cli.language);
    results.push(res);
    manifest.files[key] = {
      hash,
      engine: wantEngine,
      tEngine: res.tEngine,
      rEngine: res.rEngine,
      rating: res.rating,
    };
    console.log(`${res.complete ? "✓" : "⚠"} translation ${res.rating} (${res.ratingScore}) · response ${res.responseOk ? "✓" : "⚠"} · ${res.ms}ms · ${res.tEngine}`);
  }

  // ---- Persist manifest + shard / report ----------------------------------
  await mkdir(dirname(cli.manifestPath), { recursive: true });
  await writeFile(cli.manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  if (cli.shard >= 0 && cli.shardTotal > 1) {
    await writeFile(
      join(cli.reportDir, "shards", `shard-${cli.shard}.json`),
      JSON.stringify({ shard: cli.shard, total: cli.shardTotal, model: cli.model, language: cli.language, docs: results }, null, 2),
      "utf8",
    );
    console.log(`[forge] shard ${cli.shard} done → ${join(cli.reportDir, "shards", `shard-${cli.shard}.json`)}`);
  } else {
    const report = renderReport(results, {
      engine: engineLabel,
      model: cli.model,
      neural: cfg.neural,
      language: cli.language,
      total: results.length,
      skipped,
    });
    await writeFile(join(cli.reportDir, "forge-results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), engine: engineLabel, model: cli.model, language: cli.language, docs: results }, null, 2), "utf8");
    await writeFile(join(cli.reportDir, "FORGE_REPORT.md"), report, "utf8");
    console.log(`[forge] done — ${results.length} forged, ${skipped} skipped → ${cli.out} + ${cli.reportDir}/FORGE_REPORT.md`);

    // Consumer-usage export smoke: render the first translation through the
    // app's real DOCX exporter and validate the result is a genuine zip with
    // word/document.xml — proves parse → translate → rate → render end to end.
    if (cli.docxSmoke && results.length > 0) {
      const { toDocxBlob } = await import("../src/lib/oda/export");
      const r = results[0];
      const blob = await toDocxBlob({
        documentName: r.name,
        content: r.translation,
        language: cli.language,
        formality: "Formal",
        strategy: "adaptive",
        createdAt: Date.now(),
        kind: "translation",
        sourceFormat: r.format,
      } as never);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const head = String.fromCharCode(...bytes.slice(0, 4));
      if (head !== "PK\x03\x04") throw new Error(`DOCX smoke failed: not a valid zip (${head})`);
      const text = new TextDecoder("latin1").decode(bytes);
      if (!text.includes("document.xml")) throw new Error("DOCX smoke failed: missing word/document.xml");
      console.log(`[forge] DOCX export smoke ✓ — ${r.name} → ${bytes.length} bytes, valid zip with word/document.xml`);
    }
  }
}

main().catch((err) => {
  console.error("[forge] fatal:", err);
  process.exit(1);
});
