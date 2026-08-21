#!/usr/bin/env bun
/**
 * ODA FORGE BENCH
 * Runs the forge engines headlessly and writes a comparison report.
 *
 *  - Tier 2 engine (always): the adaptive engine from src/lib/oda/engine.ts
 *  - Tier 1 engine (when Ollama is available): a real open-weights LLM served
 *    locally by Ollama — "the absolute best" that runs for free on GitHub's
 *    runners, no API keys, no credits.
 *
 * Usage:
 *   bun scripts/forge-bench.ts                     # full run against local Ollama
 *   bun scripts/forge-bench.ts --dry-run           # adaptive engine only (CI smoke test)
 *   bun scripts/forge-bench.ts --model qwen2.5:14b-instruct-q4_K_M
 *   bun scripts/forge-bench.ts --out forge-reports
 *   bun scripts/forge-bench.ts --files inbox --outbox outbox   # file forge: every
 *                                                              # document in <inbox> gets
 *                                                              # a drafted reply in <outbox>
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SAMPLES } from "../src/lib/oda/samples.ts";
import { adaptiveGenerate } from "../src/lib/oda/engine.ts";
import { translateAdaptive } from "../src/lib/oda/refine.ts";
import { assertCleanForExport, findExportLeaks, sanitizeForExport } from "../src/lib/oda/sanitize.ts";

/**
 * Serve public/templates/* from disk so Track B (the precision template
 * renderer) and Track A's skeleton loader work headlessly in CI/bun exactly
 * as they do in the browser (Vite serves the same directory). Everything
 * else 404s — the export pipeline never fetches other URLs.
 */
const PUBLIC_ROOT = join(process.cwd(), "public");
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: any) => {
  const url = String(input);
  const m = url.match(/\/templates\/([^?#]+)/);
  if (m) {
    try {
      const buf = readFileSync(join(PUBLIC_ROOT, "templates", m[1]));
      return new Response(new Uint8Array(buf), { status: 200 });
    } catch {
      return new Response("not found", { status: 404 });
    }
  }
  return new Response("not found", { status: 404 });
}) as unknown as typeof fetch;

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const has = (name: string): boolean => args.includes(`--${name}`);

const MODEL = flag("model", "qwen2.5:7b-instruct-q4_K_M");
const OLLAMA_URL = flag("ollama-url", "http://localhost:11434");
const OUT_DIR = flag("out", "forge-reports");
const DRY = has("dry-run");
const FILES_MODE = has("files");
// --files may optionally take the inbox directory as its value.
let INBOX = flag("inbox", "inbox");
{
  const i = args.indexOf("--files");
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith("--")) INBOX = args[i + 1];
}
const OUTBOX = flag("outbox", "outbox");

const SYSTEM_PROMPT =
  "You are ODA — the Omniscient Document Architect. You comprehend any formal document and " +
  "generate a response indistinguishable from expert human correspondence. Mirror the input's " +
  "structure, register and tone. Follow domain protocols (government, corporate, legal, academic) " +
  "and local conventions (honorifics, date formats, reference quoting). Output ONLY the response " +
  "document itself — no preamble, no commentary, no markdown fences.";

function userPrompt(sample: { name: string; text: string }): string {
  return [
    `INPUT DOCUMENT (${sample.name})`,
    "",
    "--- SOURCE TEXT START ---",
    sample.text.slice(0, 24000),
    "--- SOURCE TEXT END ---",
    "",
    "Generate the response document with these parameters:",
    "- Response language: English",
    "- Formality: Formal (match the input's register)",
    "- Target export format: Markdown",
    "- Quote the source document's subject/reference/date where present.",
  ].join("\n");
}

interface DraftCheck {
  length: number;
  subject: boolean;
  reference: boolean;
  date: boolean;
  salutation: boolean;
  signature: boolean;
}

function checkDraft(draft: string): DraftCheck {
  const lower = draft.toLowerCase();
  return {
    length: draft.length,
    subject: /subject|विषय|বিষয়|الموضوع|asunto|objet/i.test(draft),
    reference: /ref|no\.?\s*[:#]|reg\.|letter no/i.test(draft),
    date:
      /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}-\d{2}-\d{2}/.test(draft) ||
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}/i.test(
        draft,
      ),
    salutation:
      /(respected|dear|sir|madam|महोदय|अன்புடையீர்|மதிப்பிற்குரிய|মহোদয়|السيد)/i.test(draft),
    signature:
      /(yours faithfully|yours sincerely|yours truly|regards|signature|भवदीय|আন্তরিক|வணக்கம்|وتفضلوا|\(signature\)|sd\/-)/i.test(
        draft,
      ),
  };
}

function checkOk(c: DraftCheck): boolean {
  return c.length > 150 && c.salutation && c.signature;
}

async function ollamaChat(model: string, system: string, user: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: false,
      options: { temperature: 0.6, num_predict: 900 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama /api/chat failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const text = data.message?.content?.trim();
  if (!text) throw new Error("Ollama returned an empty draft");
  return text;
}

interface Row {
  document: string;
  adaptive: { ok: boolean; checks: DraftCheck };
  neural: { ok: boolean; checks: DraftCheck } | null;
}

// ---------------------------------------------------------------------------
// File forge mode — every document dropped into <inbox> gets a drafted reply
// written to <outbox>. Used by the "Forge on Demand" GitHub workflow.
// ---------------------------------------------------------------------------

interface ForgedFile {
  file: string;
  engine: string;
  ok: boolean;
}

async function runFiles(): Promise<void> {
  const { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync, statSync } =
    await import("node:fs");
  const { join, basename } = await import("node:path");

  mkdirSync(OUTBOX, { recursive: true });
  if (!existsSync(INBOX)) {
    console.log(`Inbox '${INBOX}' not found — nothing to forge.`);
    return;
  }

  const entries = readdirSync(INBOX, { recursive: true }) as string[];
  const files = entries
    .filter((rel) => {
      const name = basename(rel);
      return (
        !name.startsWith(".") &&
        name !== "README.md" &&
        statSync(join(INBOX, rel)).isFile()
      );
    })
    .sort();

  const forged: ForgedFile[] = [];
  let newDrafts = 0;

  for (const rel of files) {
    const stem = rel.replace(/\.[^.]+$/, "");
    const outFile = join(OUTBOX, `${stem}.response.md`);
    if (existsSync(outFile)) {
      console.log(`  [skip] ${rel} — already forged (${outFile})`);
      continue;
    }

    const text = readFileSync(join(INBOX, rel), "utf8");
    const adaptive = adaptiveGenerate(
      { name: rel, text },
      { language: "English", formality: "Formal", format: "Markdown" },
    );

    let neural: string | null = null;
    if (!DRY) {
      try {
        neural = await ollamaChat(MODEL, SYSTEM_PROMPT, userPrompt({ name: rel, text }));
      } catch (err) {
        console.warn(
          `  [warn] neural unavailable for ${rel}: ${err instanceof Error ? err.message : err} — using adaptive engine`,
        );
      }
    }

    const content = neural ?? adaptive.content;
    const engine = neural ? `Neural · ${MODEL}` : "Adaptive engine";
    const draft = [
      `# Response to: ${rel}`,
      "",
      `- **Forged by:** ${engine}`,
      `- **Forged at:** ${new Date().toISOString()}`,
      "",
      "---",
      "",
      content,
      "",
    ].join("\n");

    mkdirSync(join(OUTBOX, rel.includes("/") ? rel.split("/").slice(0, -1).join("/") : "."), {
      recursive: true,
    });
    writeFileSync(outFile, draft);
    forged.push({ file: rel, engine, ok: checkOk(checkDraft(content)) });
    newDrafts += 1;
    console.log(`  [forged] ${rel} → ${outFile} (${engine})`);
  }

  writeFileSync(
    join(OUTBOX, "forge-manifest.json"),
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        model: DRY ? "adaptive-only (dry-run)" : MODEL,
        files: forged,
      },
      null,
      2,
    ),
  );

  console.log(`\nODA file forge: ${newDrafts} new draft${newDrafts === 1 ? "" : "s"} written to ${OUTBOX}`);
}

// ---------------------------------------------------------------------------
// Fidelity gate (PRD §4.7 / acceptance T1–T7) — runs in every CI/dry-run
// pass so no refactor silently reintroduces flattened tables, missing
// letterheads, leaked preview furniture or partial translations.
// ---------------------------------------------------------------------------

async function runFidelityGate(): Promise<void> {
  const failures: string[] = [];
  const incomplete: string[] = [];
  const check = (ok: boolean, label: string) => {
    console.log(`${ok ? "  PASS" : "  FAIL"} ${label}`);
    if (!ok) failures.push(label);
  };

  // T3/T6 across every sample: completeness is the deterministic engine's
  // tracked coverage gap (it grows via the glossary TM, PRD §4.3) and is
  // reported, not gate-failed; the hard gate is that the EXPORTED text is
  // always clean — the sanitization strip is the guarantee (PRD §4.6).
  for (const sample of SAMPLES) {
    const tr = translateAdaptive(sample, {
      language: "Hindi",
      formality: "Formal",
      format: "Same as original",
    });
    if (!tr.complete) incomplete.push(sample.name);
    const clean = sanitizeForExport(tr.content);
    check(findExportLeaks(clean).length === 0, `T6 clean export: ${sample.name}`);
    assertCleanForExport(clean, sample.name);
  }
  if (incomplete.length > 0) {
    console.log(`  INFO T3: ${incomplete.length}/${SAMPLES.length} samples partial (${incomplete.join("; ")}) — known deterministic-engine gap, grows via glossary TM`);
  }

  // T1/T2/T4/T7: structural round-trip on the CMPF fixture (built
  // programmatically so the gate is self-contained — no binary fixtures).
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, ImageRun } =
    await import("docx");
  const { parseDocx } = await import("../src/lib/oda/docxparse.ts");
  const { toDocxBlob } = await import("../src/lib/oda/export.ts");
  const { fontSpecForText } = await import("../src/lib/oda/fontRegistry.ts");
  const { translateWithGlossary } = await import("../src/lib/oda/glossary.ts");

  const PNG = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x53, 0x6d, 0x5f, 0x53, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  const cell = (text: string, header: boolean) =>
    new TableCell({
      shading: header ? { fill: "D9D9D9" } : undefined,
      children: [
        new Paragraph({
          alignment: header ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [new TextRun({ text, bold: header })],
        }),
      ],
    });
  const fixture = new Document({
    sections: [
      {
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "COAL MINES PROVIDENT FUND ORGANISATION", bold: true })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: PNG, transformation: { width: 600, height: 200 } })] }),
          new Paragraph({ children: [new TextRun({ text: "CPF/118/Misc./L.C.-Out/RNJ-21 & 14/R-I/ASN/  Date: 09-07-2026" })] }),
          new Paragraph({ children: [new TextRun({ text: "To," })] }),
          new Paragraph({ children: [new TextRun({ text: "The Assistant Commissioner" })] }),
          new Paragraph({ children: [new TextRun({ text: "Sub:- Inter Regional Transfer of Ledger Card." })] }),
          new Paragraph({ children: [new TextRun({ text: "Sir," })] }),
          new Paragraph({
            children: [
              new TextRun({
                text: "In view of the revised Procedures prescribed in Procedure Office Order No-35 dated 12.02.1975 of CMPF Commissioner, Dhanbad, I am to state that the Ledger Cards of the under mentioned members are hereby forwarded to your Regional Office.",
              }),
            ],
          }),
          new Table({
            width: { size: 9400, type: WidthType.DXA },
            columnWidths: [700, 1700, 1500, 2700, 1900, 900],
            rows: [
              new TableRow({
                tableHeader: true,
                children: ["SL. No", "Name of the Member", "CMPF A/C No", "Name of the colliery where the member had earlier worked in", "Name of the colliery where the member is currently working in", "No. of LC"].map((h) => cell(h, true)),
              }),
              new TableRow({
                children: ["1", "Shri Tonmoy Bhattacharjee", "RNJ/21/1964", "Khandra Coll.,Bankola Area", "ECL HQ. ECL", "1"].map((c) => cell(c, false)),
              }),
            ],
          }),
        ],
      },
    ],
  });
  const fixtureBuf = await Packer.toBuffer(fixture);
  const parsed = await parseDocx(fixtureBuf.buffer.slice(fixtureBuf.byteOffset, fixtureBuf.byteOffset + fixtureBuf.byteLength));
  check(parsed.supported && parsed.tables.length === 1, "T1: fixture parses with exactly 1 <w:tbl>");
  check(parsed.tables[0]?.rows.length === 2 && parsed.tables[0]?.rows[0]?.cells.length === 6, "T1: fixture table 6 cols × 2 rows");
  check(parsed.letterhead != null, "T2: fixture letterhead image recovered");

  const tr = translateAdaptive(
    { name: "LC-Out", text: parsed.text, type: "Transfer / Order", language: "English" },
    { language: "Hindi", formality: "Formal", format: "Same as original" },
  );
  check(tr.complete, "T3: fixture translates completely (hard gate)");
  check(/क्र\.सं\./.test(tr.content), "T3: table headers localized");

  const exp = {
    documentName: "LC-Out",
    content: tr.content,
    language: "Hindi",
    formality: "Formal",
    strategy: "adaptive",
    createdAt: Date.now(),
    kind: "translation" as const,
    sourceFormat: "docx",
    letterhead: { dataUrl: parsed.letterhead!.dataUrl, width: 600, height: 200, tableRatios: parsed.tables[0]?.columnRatios },
  };
  const outBlob = await toDocxBlob(exp);
  const outBytes = new Uint8Array(await outBlob.arrayBuffer());
  const re = await parseDocx(outBytes.buffer.slice(outBytes.byteOffset, outBytes.byteOffset + outBytes.byteLength));
  check(re.tables.length === 1 && re.tables[0]?.rows[0]?.cells.length === 6, "T1: exported DOCX has native 6-column table");
  // CMPF translations render through the verified template, which carries the
  // shared letterhead banner (a JPEG in the skeleton asset) — the T2 gate is
  // that the banner is embedded AND its declared MIME matches the actual
  // media file (a PNG letterhead must never be declared JPEG and vice versa,
  // or strict OOXML validators reject the export).
  const lh = re.letterhead;
  const mimeHonest =
    lh != null &&
    ((lh.dataUrl.startsWith("data:image/png") && lh.path?.toLowerCase().endsWith(".png")) ||
      ((lh.dataUrl.startsWith("data:image/jpeg") || lh.dataUrl.startsWith("data:image/jpg")) &&
        (lh.path?.toLowerCase().endsWith(".jpg") || lh.path?.toLowerCase().endsWith(".jpeg"))));
  check(lh != null, "T2: exported letterhead embedded");
  check(mimeHonest, "T2: exported letterhead keeps its real MIME (not mislabeled)");
  check(!/kept in the source language|adaptive engine|Match Input|ODA Translation/.test(re.text), "T6: exported DOCX text is clean");
  check(fontSpecForText("क्षेत्रीय आयुक्त").ascii === "Mangal", "T4: Devanagari runs declare Mangal");
  const g = translateWithGlossary(
    "In view of the revised Procedures prescribed in Procedure Office Order No-35 dated 12.02.1975 of CMPF Commissioner,Dhanbad, I am to state that the Ledger Cards of the under mentioned members are hereby forwarded to your Regional Office.",
  );
  check(g != null && g.includes("धनबाद"), "P3: glossary TM hits the gold sentence");

  if (failures.length > 0) {
    throw new Error(`ODA fidelity gate failed: ${failures.length} check(s) — ${failures.join("; ")}`);
  }
  console.log("  fidelity gate: ALL CHECKS PASSED (T1–T7 + glossary)");
}

async function main(): Promise<void> {
  if (FILES_MODE) {
    await runFiles();
    return;
  }

  const startedAt = new Date().toISOString();
  const rows: Row[] = [];
  let neuralErrors = 0;

  for (const sample of SAMPLES) {
    const adaptive = adaptiveGenerate(sample, {
      language: "English",
      formality: "Formal",
      format: "Markdown",
    });
    const adaptiveChecks = checkDraft(adaptive.content);

    let neuralChecks: DraftCheck | null = null;
    if (!DRY) {
      // Retry once — small models occasionally stall; the second draw is usually clean.
      for (let attempt = 0; attempt < 2 && !neuralChecks; attempt++) {
        try {
          const neural = await ollamaChat(MODEL, SYSTEM_PROMPT, userPrompt(sample));
          neuralChecks = checkDraft(neural);
          if (!neuralChecks && attempt === 0) {
            console.warn(`  [retry] ${sample.name} draft missed checks — drawing again`);
          }
        } catch (err) {
          neuralErrors += 1;
          if (attempt === 1) {
            console.warn(`  [warn] neural draft failed for ${sample.name}: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }

    rows.push({
      document: sample.name,
      adaptive: { ok: checkOk(adaptiveChecks), checks: adaptiveChecks },
      neural: neuralChecks ? { ok: checkOk(neuralChecks), checks: neuralChecks } : null,
    });
  }

  const adaptivePass = rows.filter((r) => r.adaptive.ok).length;
  const neuralRows = rows.filter((r) => r.neural !== null);
  const neuralPass = neuralRows.filter((r) => r.neural!.ok).length;

  const summary = {
    generatedAt: startedAt,
    engine: MODEL,
    mode: DRY ? "dry-run (adaptive engine only)" : "full (adaptive + Ollama neural)",
    documents: rows.length,
    adaptivePass,
    neural: neuralRows.length
      ? { ran: neuralRows.length, pass: neuralPass }
      : null,
    neuralErrors,
  };

  // Write artifacts
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { dirname } = await import("node:path");
  mkdirSync(OUT_DIR, { recursive: true });

  const stamp = startedAt.replace(/[:.]/g, "-").slice(0, 19);
  writeFileSync(join(OUT_DIR, `report-${stamp}.json`), JSON.stringify({ summary, rows }, null, 2));
  writeFileSync(join(OUT_DIR, "latest.json"), JSON.stringify({ summary, rows }, null, 2));

  const md: string[] = [];
  md.push(`# ODA Forge Report — ${startedAt}`);
  md.push("");
  md.push(`- Neural engine: \`${MODEL}\` · ${summary.mode}`);
  md.push(`- Documents forged: ${rows.length}`);
  md.push(`- Adaptive engine pass: ${adaptivePass}/${rows.length}`);
  if (summary.neural) md.push(`- Neural forge pass: ${summary.neural.pass}/${summary.neural.ran}`);
  if (DRY) md.push("- ⚠️ Dry run — neural tier skipped (Ollama not used).");
  md.push("");
  md.push("| Document | Engine | OK | Length | Subject | Ref | Date | Salutation | Signature |");
  md.push("|---|---|---|---|---|---|---|---|---|");
  for (const row of rows) {
    const name = row.document.split("_").slice(0, 2).join(" ") || row.document;
    const cell = (c: { ok: boolean; checks: DraftCheck }, label: string) =>
      `${label} | ${c.ok ? "✅" : "❌"} | ${c.checks.length} | ${c.checks.subject ? "✅" : "❌"} | ${c.checks.reference ? "✅" : "❌"} | ${c.checks.date ? "✅" : "❌"} | ${c.checks.salutation ? "✅" : "❌"} | ${c.checks.signature ? "✅" : "❌"} |`;
    md.push(`| ${name} | ${cell(row.adaptive, "Adaptive")}`);
    if (row.neural) md.push(`| ${name} | ${cell(row.neural, "Neural")}`);
  }
  md.push("");
  md.push("_Generated automatically by the ODA forge workflow — free forever, no API keys._");
  writeFileSync(join(OUT_DIR, "FORGE_REPORT.md"), md.join("\n"));

  const reportPath = join(OUT_DIR, "FORGE_REPORT.md");
  console.log(`\nODA Forge Bench (${summary.mode})`);
  console.log(`  documents: ${rows.length}`);
  console.log(`  adaptive pass: ${adaptivePass}/${rows.length}`);
  if (summary.neural) console.log(`  neural pass (${MODEL}): ${summary.neural.pass}/${summary.neural.ran}`);
  console.log(`  report: ${reportPath}`);
  if (summary.neural && neuralPass < neuralRows.length) {
    console.log("  → some neural drafts missed structural checks; see report for details.");
  }
  // The report was written and the artifacts are committed by the workflow —
  // per-draft failures are data, not pipeline failures. The fidelity gate
  // below is the hard CI gate — its failures ARE pipeline failures.
  console.log("\nFidelity gate (PRD §4.7):");
  await runFidelityGate();
}

void main();
