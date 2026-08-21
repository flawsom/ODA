// Quick validation harness: run the app's adaptive translator over a few
// representative letters from the 7-ALL OLD LETTER corpus.
import { readFileSync } from "node:fs";
import { parseDocx } from "../src/lib/oda/docxparse";
import { translateAdaptive } from "../src/lib/oda/refine";

const files = process.argv.slice(2);
for (const f of files) {
  const buf = readFileSync(f);
  const r = await parseDocx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  if (!r.supported) {
    console.log(`\n===== ${f} ===== UNSUPPORTED`);
    continue;
  }
  const doc = {
    name: f.split("/").pop() ?? f,
    text: r.text,
    type: "letter",
    language: "English",
    formality: "Formal",
  } as never;
  const res = translateAdaptive(
    doc,
    { language: "Hindi", formality: "Formal", format: "text" } as never,
  );
  console.log(`\n===== ${f} ===== complete=${res.complete}`);
  console.log(res.content);
}
