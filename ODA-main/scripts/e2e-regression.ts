// scripts/e2e-regression.ts
//
// Consolidated end-to-end regression: every document suite runs through the
// full pipeline (parseDocx → translateAdaptive → toDocxBlob) and is gated by
// one shared runner. CI runs this single script as one step.
//
// Suites:
//   cmpf — the 10 real CMPF letters vs the reference outputs in
//          C:\Users\sibap\Documents\Training\files (skips when the dir is
//          absent, e.g. on the CI runner)
//   new  — the six new CMPF letters vs their gold Hindi references
//          (skips when the Downloads dir is absent)
//   appt — the non-CMPF Appointment Order (repo inbox fixture — always runs)
//   univ — the second non-CMPF University Notice (repo inbox fixture — always runs)
//
// Run: node_modules/.bin/tsx scripts/e2e-regression.ts

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import PizZip from "pizzip";
import { parseDocx } from "../src/lib/oda/docxparse";
import { translateAdaptive } from "../src/lib/oda/refine";
import { toDocxBlob } from "../src/lib/oda/export";
import { sanitizeForExport } from "../src/lib/oda/sanitize";
import { findMatchingTemplate } from "../src/lib/oda/templates/registry";
import { buildDocumentIR } from "../src/lib/oda/irBuilder";

const TRAINING = "C:\\Users\\sibap\\Documents\\Training";
const DOWNLOADS = "C:\\Users\\sibap\\Downloads";
const OUT = join(tmpdir(), "e2e-regression");

// Serve public/templates/* to the precision engine's fetch() so Track B
// renders in Node exactly as it does in the browser (Vite serves the same
// directory). Everything else 404s — the pipeline never fetches other URLs.
const PUBLIC_ROOT = join(process.cwd(), "public");
(globalThis as unknown as { fetch: typeof fetch }).fetch = (async (input: any) => {
  const url = String(input);
  const m = url.match(/\/templates\/([^?#]+)/);
  if (m) {
    try {
      const buf = readFileSync(join(PUBLIC_ROOT, "templates", m[1]));
      return new Response(new Uint8Array(buf), {
        status: 200,
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      });
    } catch {
      return new Response("not found", { status: 404 });
    }
  }
  return new Response("not found", { status: 404 });
}) as typeof fetch;

function pngDims(data: Uint8Array): { width: number; height: number } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDims(data: Uint8Array): { width: number; height: number } {
  let i = 2;
  while (i < data.length - 9) {
    if (data[i] !== 0xff) { i += 1; continue; }
    const mk = data[i + 1];
    if (mk === 0xc0 || mk === 0xc1 || mk === 0xc2 || mk === 0xc3) {
      return { width: (data[i + 7] << 8) | data[i + 8], height: (data[i + 5] << 8) | data[i + 6] };
    }
    if (mk === 0xd8 || mk === 0xd9 || (mk >= 0xd0 && mk <= 0xd7)) { i += 2; continue; }
    const seg = (data[i + 2] << 8) | data[i + 3];
    i += 2 + seg;
  }
  return { width: 1, height: 1 };
}

/** Extract paragraphs (with <w:br/> splits) from a rendered DOCX. */
function zipText(zip: PizZip): Array<{ text: string; img: boolean }> {
  const xml = zip.file("word/document.xml")?.asText() ?? "";
  const paras: Array<{ text: string; img: boolean }> = [];
  for (const m of xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)) {
    const p = m[0];
    const chunks: string[] = [];
    const tokenRe = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:br[^>]*\/?>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tokenRe.exec(p)) !== null) {
      if (tm[1] !== undefined) {
        chunks.push(
          tm[1]
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">"),
        );
      } else {
        chunks.push("\n");
      }
    }
    const text = chunks.join("");
    for (const ln of text.split("\n")) {
      const clean = ln.trim();
      paras.push({ text: clean, img: p.includes("<w:drawing") });
    }
  }
  return paras;
}

/** Collapse whitespace runs — layout gaps are cosmetic; line order and
 * content are what the comparison judges. */
function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Letterhead anchor summary for the rendered docx. */
function anchorSummary(zip: PizZip): string {
  const xml = zip.file("word/document.xml")?.asText() ?? "";
  const anchors: string[] = [];
  for (const m of xml.matchAll(/<wp:anchor[\s\S]*?<\/wp:anchor>/g)) {
    const a = m[0];
    const ph = a.match(/<wp:positionH relativeFrom="([^"]+)"><wp:posOffset>([^<]+)/);
    const pv = a.match(/<wp:positionV relativeFrom="([^"]+)"><wp:posOffset>([^<]+)/);
    const ext = a.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
    const img = a.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    const w = (n: number) => (n / 914400).toFixed(2);
    anchors.push(
      `H:${ph ? ph[1] + "@" + ph[2] : "?"} V:${pv ? pv[1] + "@" + pv[2] : "?"} ` +
        `frame:${ext ? w(+ext[1]) + "x" + w(+ext[2]) : "?"} img:${img ? w(+img[1]) + "x" + w(+img[2]) : "?"}`,
    );
  }
  const inlines = (xml.match(/<wp:inline/g) ?? []).length;
  return `anchors=[${anchors.join(" ; ")}] inline=${inlines}`;
}

/** Shared gate runner: run every suite, print a verdict per suite, write the
 * combined report, and exit non-zero if any suite failed. */
type SuiteResult = { name: string; ok: boolean; skipped?: string; lines: string[] };
type Suite = (report: SuiteResult) => Promise<void>;

async function runSuites(suites: Array<{ name: string; run: Suite }>): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const results: SuiteResult[] = [];
  for (const s of suites) {
    const r: SuiteResult = { name: s.name, ok: true, lines: [] };
    try {
      await s.run(r);
    } catch (e) {
      r.ok = false;
      r.lines.push(`ERROR: ${(e as Error).message ?? e}`);
    }
    results.push(r);
  }

  const all = results.map((r) => r.lines).join("\n");
  writeFileSync(join(OUT, "report.txt"), all, "utf8");

  let failed = 0;
  for (const r of results) {
    if (r.skipped) {
      console.log(`== ${r.name}: SKIPPED (${r.skipped})`);
    } else if (r.ok) {
      console.log(`== ${r.name}: PASS`);
    } else {
      console.log(`== ${r.name}: FAIL`);
      failed++;
    }
  }
  console.log(`\nE2E REGRESSION: ${results.length - failed} pass, ${failed} fail`);
  if (failed > 0) process.exit(1);
}

/** Compare two paragraph lists line-by-line (whitespace-normalized). */
function compareParas(
  outParas: Array<{ text: string }>,
  refParas: Array<{ text: string }>,
  lines: string[],
): boolean {
  const a = outParas.filter((p) => p.text.length > 0).map((p) => norm(p.text));
  const b = refParas.filter((p) => p.text.length > 0).map((p) => norm(p.text));
  const same = a.length === b.length && a.every((t, i) => t === b[i]);
  lines.push(`TEXT_MATCH: ${same ? "YES" : "NO"}  (out ${a.length} lines vs ref ${b.length})`);
  if (!same) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        lines.push(`  DIFF@${i} out: ${JSON.stringify(a[i] ?? "")}`);
        lines.push(`        ref: ${JSON.stringify(b[i] ?? "")}`);
      }
    }
  }
  return same;
}

/** Hard gate: every content line must read fully in Hindi — a surviving
 * English prose word (≥2 Latin words on a line) fails the run. */
function fullHindiFailures(content: string): string[] {
  const fails: string[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.length === 0) continue;
    const latinWords = l.split(/\s+/).filter((w) => /^[A-Za-z][A-Za-z.,\-']*$/.test(w));
    if (latinWords.length >= 2) fails.push(`line ${i + 1}: ${l}`);
  }
  return fails;
}

// ---------------------------------------------------------------------------
// Suite: the 10 real CMPF letters vs the reference outputs.
// ---------------------------------------------------------------------------
async function suiteCmpf(r: SuiteResult): Promise<void> {
  if (!existsSync(TRAINING)) {
    r.skipped = "Training dir not present";
    return;
  }
  const srcs = readdirSync(TRAINING)
    .filter((n) => n.endsWith(".docx") && !n.startsWith("~$"))
    .sort((a, b) => Number(a.slice(0, 3)) - Number(b.slice(0, 3)));

  let pass = 0;
  let fail = 0;

  for (const src of srcs) {
    const num = src.slice(0, 3);
    const buf = readFileSync(join(TRAINING, src));
    const parsed = await parseDocx(buf);
    const docText = parsed.supported ? parsed.text : "";

    const res = translateAdaptive(
      { name: src, text: docText },
      { language: "Hindi", formality: "Formal", format: "Same as original" },
    );
    res.content = sanitizeForExport(res.content);

    let letterhead: null | { dataUrl: string; width: number; height: number; tableRatios?: number[] } = null;
    if (parsed.letterhead) {
      const b64 = parsed.letterhead.dataUrl.split(",")[1] ?? "";
      const data = Uint8Array.from(Buffer.from(b64, "base64"));
      const dims = parsed.letterhead.dataUrl.includes("png") ? pngDims(data) : jpegDims(data);
      letterhead = {
        dataUrl: parsed.letterhead.dataUrl,
        width: dims.width,
        height: dims.height,
        tableRatios: parsed.tables[0]?.columnRatios,
      };
    }

    const blob = await toDocxBlob({
      documentName: src,
      content: res.content,
      language: "Hindi",
      formality: "Formal",
      strategy: "adaptive",
      createdAt: Date.now(),
      kind: "translation",
      sourceFormat: "docx",
      letterhead,
    });

    const outZip = new PizZip(Buffer.from(await blob.arrayBuffer()));
    const outParas = zipText(outZip);
    const outMedia = Object.keys(outZip.files).filter((n) => n.startsWith("word/media/") && !n.endsWith("/"));

    writeFileSync(join(OUT, `cmpf-${src}`), Buffer.from(await blob.arrayBuffer()));

    // Reference
    const files = TRAINING + "\\files";
    const refName = existsSync(files) ? readdirSync(files).find((n) => n.startsWith(num + "_")) : "";
    let refParas: Array<{ text: string; img: boolean }> = [];
    let refMedia: string[] = [];
    if (refName) {
      const refZip = new PizZip(readFileSync(join(files, refName)));
      refParas = zipText(refZip);
      refMedia = Object.keys(refZip.files).filter((n) => n.startsWith("word/media/") && !n.endsWith("/"));
    }

    const ir = buildDocumentIR({ content: res.content, language: "Hindi", documentName: src });
    const tmpl = findMatchingTemplate(ir, ir.rawText);

    r.lines.push(`\n======== ${num} ${src} ========`);
    r.lines.push(`[template] ${tmpl?.id ?? "none (Track A)"}`);
    r.lines.push(`[translated content]`);
    r.lines.push(res.content.split("\n").map((l) => "  | " + l).join("\n"));
    r.lines.push(`[output docx paras (${outParas.length})] media=${outMedia.join(",")}`);
    for (const p of outParas) r.lines.push(`  ${p.img ? "[IMG] " : ""}${p.text}`);
    if (refName) {
      r.lines.push(`[reference docx paras (${refParas.length})] media=${refMedia.join(",")}`);
      for (const p of refParas) r.lines.push(`  ${p.img ? "[IMG] " : ""}${p.text}`);
      const same = compareParas(outParas, refParas, r.lines);
      if (same) pass++;
      else fail++;
    }
  }

  r.lines.push(`\nMATCH: ${pass} / ${fail + pass}`);
  r.ok = fail === 0 && pass > 0;
}

// ---------------------------------------------------------------------------
// Suite: the six new CMPF letters vs their gold Hindi references.
// ---------------------------------------------------------------------------
const NEW_INPUTS: Array<{ file: string; gold?: string }> = [
  { file: "205-SHRI BINAY KUMAR PATTANAYAK (NAGPUR-WCL)L.C. REQ..docx" },
  { file: "212-SHRI SAIKAT MONDAL & SURJAKANTA NAYAK-L.C. OUT (REGIONAL OFFICE-III).docx" },
  { file: "219-SHRI SANJOY KUMAR SINGH (DHANBAD-(D-I  & II)L.C. REQ. .docx" },
  { file: "219-SHRI SANJOY KUMAR SINGH (RANCHI-(R-I  & II)L.C. REQ. .docx" },
  {
    file: "217-SHRI ANIL RAJBHAR (SINGRAULI) L.C.-OUT (HINDI) .docx",
    gold: "Hindi_Translation_Anil_Rajbhar_L.C.Out_Singrauli.docx",
  },
  {
    file: "217-SHRI DHARAMRAJ KURMI (SINGRAULI) L.C.-OUT (HINDI) .docx",
    gold: "Hindi_Translation_Dharamraj_Kurmi_L.C.Out_Singrauli.docx",
  },
];

async function suiteNew(r: SuiteResult): Promise<void> {
  if (!existsSync(DOWNLOADS)) {
    r.skipped = "Downloads dir not present";
    return;
  }
  let pass = 0;
  let fail = 0;

  for (const { file, gold } of NEW_INPUTS) {
    const buf = readFileSync(join(DOWNLOADS, file));
    const parsed = await parseDocx(buf);
    const docText = parsed.supported ? parsed.text : "";
    const res = translateAdaptive(
      { name: file, text: docText },
      { language: "Hindi", formality: "Formal", format: "Same as original" },
    );
    res.content = sanitizeForExport(res.content);

    let letterhead: null | { dataUrl: string; width: number; height: number; tableRatios?: number[] } = null;
    if (parsed.letterhead) {
      letterhead = {
        dataUrl: parsed.letterhead.dataUrl,
        width: 100,
        height: 50,
        tableRatios: parsed.tables[0]?.columnRatios,
      };
    }

    const blob = await toDocxBlob({
      documentName: file,
      content: res.content,
      language: "Hindi",
      formality: "Formal",
      strategy: "adaptive",
      createdAt: Date.now(),
      kind: "translation",
      sourceFormat: "docx",
      letterhead,
    });
    const outZip = new PizZip(Buffer.from(await blob.arrayBuffer()));
    const outParas = zipText(outZip);
    const outMedia = Object.keys(outZip.files).filter((n) => n.startsWith("word/media/") && !n.endsWith("/"));

    writeFileSync(join(OUT, `new-${file.replace(/[\\/:*?"<>|]/g, "_")}`), Buffer.from(await blob.arrayBuffer()));

    r.lines.push(`\n======== ${file} ========`);
    r.lines.push(`[translated content]`);
    r.lines.push(res.content.split("\n").map((l) => "  | " + l).join("\n"));
    r.lines.push(`[output docx paras (${outParas.length})] media=${outMedia.join(",")} ${anchorSummary(outZip)}`);
    for (const p of outParas) r.lines.push(`  ${p.img ? "[IMG] " : ""}${p.text}`);

    if (gold) {
      const refZip = new PizZip(readFileSync(join(DOWNLOADS, gold)));
      const refParas = zipText(refZip);
      r.lines.push(`[reference (${basename(gold)}) paras (${refParas.length})]`);
      for (const p of refParas) r.lines.push(`  ${p.img ? "[IMG] " : ""}${p.text}`);
      const same = compareParas(outParas, refParas, r.lines);
      if (same) pass++;
      else fail++;
    }
  }

  r.lines.push(`\nGOLD MATCH: ${pass} / ${pass + fail}`);
  r.ok = fail === 0 && pass > 0;
}

// ---------------------------------------------------------------------------
// Suite: the non-CMPF Appointment Order (repo inbox fixture).
// ---------------------------------------------------------------------------
async function suiteAppt(r: SuiteResult): Promise<void> {
  const src = join(process.cwd(), "inbox", "Appointment-Order_Rajesh-Mehra_DEPT-42-2026.txt");
  const docText = readFileSync(src, "utf8").replace(/\r\n/g, "\n");
  const res = translateAdaptive(
    { name: "Appointment-Order_Rajesh-Mehra_DEPT-42-2026", text: docText },
    { language: "Hindi", formality: "Formal", format: "Same as original" },
  );
  res.content = sanitizeForExport(res.content);

  const blob = await toDocxBlob({
    documentName: "Appointment-Order_Rajesh-Mehra_DEPT-42-2026",
    content: res.content,
    language: "Hindi",
    formality: "Formal",
    strategy: "adaptive",
    createdAt: Date.now(),
    kind: "translation",
    sourceFormat: "txt",
    letterhead: null,
  });
  const outZip = new PizZip(Buffer.from(await blob.arrayBuffer()));
  const outParas = zipText(outZip);
  const outMedia = Object.keys(outZip.files).filter((n) => n.startsWith("word/media/") && !n.endsWith("/"));
  writeFileSync(join(OUT, "appointment.docx"), Buffer.from(await blob.arrayBuffer()));

  r.lines.push(`======== Appointment-Order (non-CMPF) ========`);
  r.lines.push(`[translated content]`);
  r.lines.push(res.content.split("\n").map((l) => "  | " + l).join("\n"));
  r.lines.push(`[output docx paras (${outParas.length})] media=${outMedia.join(",")} ${anchorSummary(outZip)}`);
  for (const p of outParas) r.lines.push(`  ${p.img ? "[IMG] " : ""}${p.text}`);

  const fails = fullHindiFailures(res.content);
  const anchor = anchorSummary(outZip);
  if (!anchor.includes("frame:8.50x2.24") || !anchor.includes("H:page@0")) {
    fails.push(`letterhead anchor wrong: ${anchor}`);
  }
  if (fails.length > 0) {
    r.lines.push(`\nAPPOINTMENT GATE FAILED:\n${fails.join("\n")}`);
    r.ok = false;
    return;
  }
  r.ok = true;
}

// ---------------------------------------------------------------------------
// Suite: the second non-CMPF University Notice (repo inbox fixture).
// ---------------------------------------------------------------------------
async function suiteUniv(r: SuiteResult): Promise<void> {
  const src = join(process.cwd(), "inbox", "University-Notice_Kalinga-University_KU-ADMIN-2026-412.txt");
  const docText = readFileSync(src, "utf8").replace(/\r\n/g, "\n");
  const res = translateAdaptive(
    { name: "University-Notice_Kalinga-University_KU-ADMIN-2026-412", text: docText },
    { language: "Hindi", formality: "Formal", format: "Same as original" },
  );
  res.content = sanitizeForExport(res.content);

  const blob = await toDocxBlob({
    documentName: "University-Notice_Kalinga-University_KU-ADMIN-2026-412",
    content: res.content,
    language: "Hindi",
    formality: "Formal",
    strategy: "adaptive",
    createdAt: Date.now(),
    kind: "translation",
    sourceFormat: "txt",
    letterhead: null,
  });
  const outZip = new PizZip(Buffer.from(await blob.arrayBuffer()));
  const outParas = zipText(outZip);
  const outMedia = Object.keys(outZip.files).filter((n) => n.startsWith("word/media/") && !n.endsWith("/"));
  writeFileSync(join(OUT, "university.docx"), Buffer.from(await blob.arrayBuffer()));

  r.lines.push(`======== University-Notice (non-CMPF #2) ========`);
  r.lines.push(`[translated content]`);
  r.lines.push(res.content.split("\n").map((l) => "  | " + l).join("\n"));
  r.lines.push(`[output docx paras (${outParas.length})] media=${outMedia.join(",")} ${anchorSummary(outZip)}`);
  for (const p of outParas) r.lines.push(`  ${p.img ? "[IMG] " : ""}${p.text}`);

  const fails = fullHindiFailures(res.content);
  const anchor = anchorSummary(outZip);
  if (!anchor.includes("frame:8.50x2.24") || !anchor.includes("H:page@0")) {
    fails.push(`letterhead anchor wrong: ${anchor}`);
  }
  if (fails.length > 0) {
    r.lines.push(`\nUNIVERSITY NOTICE GATE FAILED:\n${fails.join("\n")}`);
    r.ok = false;
    return;
  }
  r.ok = true;
}

// ---------------------------------------------------------------------------
async function main() {
  await runSuites([
    { name: "cmpf (10 CMPF letters vs references)", run: suiteCmpf },
    { name: "new (6 new CMPF letters vs golds)", run: suiteNew },
    { name: "appt (appointment order)", run: suiteAppt },
    { name: "univ (university notice)", run: suiteUniv },
  ]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
