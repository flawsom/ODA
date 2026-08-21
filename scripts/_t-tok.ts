import { transliterateRef, transliterateProseRef } from "../src/lib/oda/translate";
console.log("L.C.Transfer:", transliterateRef("L.C.Transfer"));
console.log("prose:", transliterateProseRef("CPF/ DEL/1/Misc/ L.C.Transfer /513 dated 02/11/2023"));
console.log("JUL:", transliterateRef("07/JUL/2025"));
console.log("prose2:", transliterateProseRef("CPF/ NAG/79/Misc/ L.C.Transfer /555 dated 07 / JUL/2025"));
