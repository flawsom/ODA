import { recoverLineStructure } from "../src/lib/oda/recover.ts";
import { translateAdaptive } from "../src/lib/oda/refine.ts";
const body = `CPF/118/Misc . /L.C.- out/R-I/ASN/  Date- 24 /0 4 /2026
To
The Regional Commissioner
Coal Mines Provident Fund ,
R.O- Talcher
AT:- Jagannath colony
P.O &P.S:- South Balanda
Dist :-Angul ,State:- Odisha
Pin:- 759116
Sub:- Inter Regional Transfer of Ledger Card, DA, PS -3 & 4.
Ref:-No. CPF/155/Misc./L.C. Incoming /TLHR- 10/Talcher/25-26/41   dated 02 / 0 4 /2026
Sir,
In view of the revised Procedures prescribed in Procedure Office Order No-35 Dated-12.02.1975 of CMPF Commissioner,Dhanbad, I am to state that the Ledger Cards of the following members is hereby forwarded to your Regional Office. Further, it is informed that the Form A & P.S.-3 & P.S.-4 forms are not available in this region.`;
const recovered = recoverLineStructure(body);
console.log("=== RECOVERED ===");
console.log(recovered);
console.log("=== TRANSLATED ===");
const res = translateAdaptive({ name: "t", text: body }, { language: "Hindi", formality: "Formal", format: "Same as original" });
console.log(res.content);
