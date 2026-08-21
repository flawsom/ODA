// Adversarial-review edge tests for this session's changes.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PizZip from "pizzip";
import { toDocxBlob } from "../src/lib/oda/export";
import { translateAdaptive } from "../src/lib/oda/refine";

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
}) as typeof fetch;

function paraAlignments(zip: PizZip): Array<{ text: string; align: string }> {
  const xml = zip.file("word/document.xml")?.asText() ?? "";
  const out: Array<{ text: string; align: string }> = [];
  for (const m of xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)) {
    const p = m[0];
    const text = [...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((t) => t[1]).join("");
    const jc = p.match(/<w:jc w:val="([^"]+)"/);
    if (text.trim().length > 0) out.push({ text: text.slice(0, 30), align: jc?.[1] ?? "left" });
  }
  return out;
}

let fails = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "✅" : "❌"} ${name}`);
  if (!cond) fails += 1;
}

async function render(kind: "translation" | "response", content: string) {
  const blob = await toDocxBlob({
    documentName: "edge-test",
    content,
    language: "Hindi",
    formality: "Formal",
    strategy: "adaptive",
    createdAt: Date.now(),
    kind,
    sourceFormat: "txt",
    letterhead: null,
  });
  return paraAlignments(new PizZip(Buffer.from(await blob.arrayBuffer())));
}

async function main() {
  // 1. Translation: closing followed by enclosure — closing right, enclosure left.
  const withEncl = [
    "विषय:- परीक्षण",
    "",
    "महोदय,",
    "",
    "यह एक परीक्षण पत्र है।",
    "",
    "भवदीय,",
    "(अजय कुमार सिंह)",
    "क्षेत्रीय आयुक्त - I",
    "",
    "संलग्न- उपरोक्तानुसार",
  ].join("\n");
  const r1 = await render("translation", withEncl);
  const closing1 = r1.find((p) => p.text.startsWith("भवदीय"));
  const encl1 = r1.find((p) => p.text.startsWith("संलग्न"));
  check("closing right-aligned when enclosure follows", closing1?.align === "right");
  check("enclosure stays left", encl1?.align !== "right");

  // 2. Translation: mid-letter parenthesized note — stays left.
  const midNote = [
    "विषय:- परीक्षण",
    "",
    "महोदय,",
    "",
    "(कृपया ध्यान दें) यह सूचना है।",
    "",
    "भवदीय,",
    "(अजय कुमार सिंह)",
  ].join("\n");
  const r2 = await render("translation", midNote);
  const note = r2.find((p) => p.text.startsWith("(कृपया"));
  const closing2 = r2.find((p) => p.text.startsWith("भवदीय"));
  check("mid-letter parenthesized note stays left", note?.align !== "right");
  check("closing still right", closing2?.align === "right");

  // 3. Response with a parenthesized line — never right-aligned.
  const resp = ["Hello,", "", "(1) First point of the reply.", "", "Thanks."].join("\n");
  const r3 = await render("response", resp);
  const pt = r3.find((p) => p.text.startsWith("(1)"));
  check("response parenthesized line stays left", pt?.align !== "right");

  // 4. Mr. inside a Devanagari line stays Latin (never श्री.).
  const res = translateAdaptive(
    { name: "edge", text: "नियुक्ति Mr. Rajesh Mehra के लिए।" },
    { language: "Hindi", formality: "Formal", format: "Same as original" },
  );
  check("Mr. not turned into श्री.", res.content.includes("Mr.") && !res.content.includes("श्री. Rajesh"));

  // 5. The real appointment letter still closes right.
  const SRC = join(process.cwd(), "inbox", "Appointment-Order_Rajesh-Mehra_DEPT-42-2026.txt");
  const text = readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
  const tr = translateAdaptive(
    { name: "appt", text },
    { language: "Hindi", formality: "Formal", format: "Same as original" },
  );
  const r5 = await render("translation", tr.content);
  const closing5 = r5.find((p) => p.text.startsWith("भवदीय"));
  check("appointment closing right-aligned", closing5?.align === "right");

  console.log(fails === 0 ? "\nALL EDGE TESTS PASSED" : `\n${fails} FAILURE(S)`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
