#!/usr/bin/env bun
/** Debug: run the translation pipeline stage by stage for a source file. */
import { readFileSync } from "node:fs";
import { parseDocx } from "../src/lib/oda/docxparse.ts";
import { parseDoc } from "../src/lib/oda/docparse.ts";
import { translateAdaptive as baseTranslateAdaptive } from "../src/lib/oda/translate.ts";
import { referenceStandardPass } from "../src/lib/oda/refine.ts";
import { recoverCells, recoverLineStructure } from "../src/lib/oda/recover.ts";

const file = process.argv[2]!;
const buf = readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const parsed = file.endsWith(".docx") ? await parseDocx(ab) : parseDoc(ab);
const text = parsed.supported ? parsed.text : "";
console.log("=== SOURCE ===");
console.log(text.replace(/\n{2,}/g, "\n"));
console.log("\n=== RECOVERED ===");
console.log(recoverLineStructure(text));

const doc = { name: file, text, type: "Letter", language: "English" };
const base = baseTranslateAdaptive(doc, { language: "Hindi", formality: "Formal", format: "Same as original" });
console.log("\n=== BASE TRANSLATE ===");
console.log(base.content);
const refined = referenceStandardPass(base.content);
console.log("\n=== REFINED ===");
console.log(refined);
const cells = recoverCells(refined, "Hindi");
console.log("\n=== RECOVERED CELLS ===");
console.log(cells.content);
