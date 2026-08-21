import { transliterateProseRef, transliterateRef } from "../src/lib/oda/translate.ts";
const s1 = "In view of the revised Procedures prescribed in Procedure Office Order No-35 Dated-12.02.1975 of CMPF Commissioner,Dhanbad, I am to state that the Ledger Cards of the following members is hereby forwarded to your Regional Office.";
const s2 = "your office letter no. CPF/16/DHN-40/D-I/281/1220 dated 20 / 0 2 /202 6 .";
console.log("PROSE:", transliterateProseRef(s2));
console.log("REF:", transliterateRef("CPF/118/Misc/Ext-out/R-I/ASN/  Date- 24 /0 4 /2026"));
