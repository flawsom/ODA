import { translateAdaptive } from "../src/lib/oda/refine";
const text = `Ref. : CPF/118/Misc/RNJ/LC/OUT/R-I/ASN/ Date : 10 /11/2024
To,
The Regional Commissioner
Coal Mines Provident Fund Organisation
Near T. B. Sanatorium, Chhindwara
Pin-48001 (Madhya Pradesh)
Sub- : Inter Regional Transfer of Ledger Card, DA, PS -3 & 4
Sir,
In view of the revised procedure prescribed in procedure office order No-230 Dated-12/02/1973 of CMPF Commissioner, Dhanbad, I am to state that the ledger card of the following member is forwarded to your office as he is working under jurisdiction of your region.
It is ensured that the posting in the ledger card are dully completed for the periods for which the member was contributing in this region.
SL. No | Name of the member | CMPF A/C No | Name of the colly where member worked in this region | Name o the colliery where member working in your region
1 | Sri Malay Chandan Chandra | KGL/17/1602 | Kathara colliery,kithara area,CCL | Kumardihi b colliery (RNJ/18)
Yours faithfully,
Assistant Commissioner`;

// 1) base translator only
import { translateAdaptive as baseTranslateAdaptive } from "../src/lib/oda/translate";
const base = baseTranslateAdaptive(
  { name: "x", text, type: "Letter", language: "English", formality: "Formal" },
  { language: "Hindi", formality: "Formal", format: "markdown" },
);
console.log("BASE:", JSON.stringify(base.content.split("\n").find((l) => l.includes("Kathara"))));

// 2) referenceStandardPass
import { referenceStandardPass } from "../src/lib/oda/refine";
const ref = referenceStandardPass(base.content);
console.log("REFINE:", JSON.stringify(ref.split("\n").find((l) => l.includes("Kathara") || l.includes("कथरा"))));

// 3) recoverCells
import { recoverCells } from "../src/lib/oda/recover";
const rec = recoverCells(ref, "Hindi");
console.log("RECOVER:", JSON.stringify(rec.content.split("\n").find((l) => l.includes("Kathara") || l.includes("कथरा"))));

// 4) transliterateProseToHindi on the row
import { transliterateProseToHindi } from "../src/lib/oda/translate";
const row = rec.content.split("\n").find((l) => l.includes("कथरा") || l.includes("Kathara")) ?? "";
console.log("SWEEP:", JSON.stringify(transliterateProseToHindi(row)));

// 5) full engine
const res = translateAdaptive(
  { name: "x", text, type: "Letter", language: "English", formality: "Formal" },
  { language: "Hindi", formality: "Formal", format: "markdown" },
);
console.log("FULL:", JSON.stringify(res.content.split("\n").find((l) => l.includes("कथरा") || l.includes("Kathara"))));
