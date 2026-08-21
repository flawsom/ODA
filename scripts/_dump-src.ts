import { readFileSync } from "node:fs";
import { parseDocx } from "../src/lib/oda/docxparse";

const files = process.argv.slice(2);
for (const f of files) {
  const buf = readFileSync(f);
  const r = await parseDocx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  console.log(`\n===== ${f} =====`);
  console.log(r.text);
}
