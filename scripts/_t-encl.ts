import { readFileSync } from "node:fs";
import { parseDocx } from "../src/lib/oda/docxparse";
import { recoverLineStructure } from "../src/lib/oda/recover";

const buf = readFileSync("/tmp/old-letters/1-AVTAR SINGH ( Ranchi-1 ).docx");
const r = await parseDocx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const recovered = recoverLineStructure(r.text);
for (const line of recovered.split("\n")) {
  if (/encl/i.test(line)) {
    console.log("SOURCE:", JSON.stringify(line));
    const m = line.trim().match(/^(encl(?:osure)?|संलग्न)[\s.:：-]+\s*(.+)$/i);
    console.log("ENCL MATCH:", m ? JSON.stringify(m[2]) : null);
  }
}
