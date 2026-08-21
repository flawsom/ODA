import { normalizeFragmentedCodes } from "../src/lib/oda/recover.ts";
const cases = [
  "On the subject and reference cited above, please find enclosed herewith the extract in respect of Shri Rajesh Kumar Barik, CMPF A/C No- RNJ/ 51 / 244 as desired .",
  "TLHR- 10 Please acknowledge the receipt",
  "RNJ / 38 / 3288",
  "Des 2 012",
  "3/2018To 3/2021",
];
for (const c of cases) console.log(JSON.stringify(c), "→", JSON.stringify(normalizeFragmentedCodes(c)));
