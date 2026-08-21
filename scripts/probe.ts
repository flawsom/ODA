import { hindiTranslateLine, transliterateRef } from "../src/lib/oda/translate.ts";
import { translateWithGlossary } from "../src/lib/oda/glossary.ts";
const lines = [
  "Dhanbad , D-I & II",
  "Coal Mines Provident Fund",
  "Police Line",
  "AKK OCP",
  "KGL/42 Dec-2014 to Jun-2022",
  "Nowrozabad Sub-area Colliery Johilla Area period: June 2017 to May 2023",
  "Lakhanpur OCO, And Area, SBP/11 Period- Dec-1994 to Jan 2003 Orient Colliery, Mine No.4, Orient Sub Area, SBP/05, Period-Feb-2003 to Sep-2007",
  "Rajgamar, BLP/9",
  "ECL Sanctoria, ECL HQ. Period:",
  "Encl.: As above.",
  "Encl.: As above. Regional Commissioner - I",
  "To   REMINDER- (IV)",
  "To  (REMINDER)",
  "To , The Assistant Commissioner Coal Mines Provide nt Fund Organisation B.B. College Road Asansol, Region–III",
  "Regional Commissioner - I",
];
for (const l of lines) {
  console.log("LINE:", JSON.stringify(l));
  console.log("  hindi:", JSON.stringify(hindiTranslateLine(l)));
  console.log("  glossary:", JSON.stringify(translateWithGlossary(l)));
  console.log("  transliterateRef:", JSON.stringify(transliterateRef(l)));
}
