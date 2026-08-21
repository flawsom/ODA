import { translateAdaptive } from "../src/lib/oda/refine.ts";
const body = `In view of the revised Procedures prescribed in Procedure Office Order No-35 Dated-12.02.1975 of CMPF Commissioner,Dhanbad, I am to state that the Ledger Cards of the following members is hereby forwarded to your Regional Office. Further, it is informed that the Form A & P.S.-3 & P.S.-4 forms are not available in this region.`;
const res = translateAdaptive({ name: "t", text: body }, { language: "Hindi", formality: "Formal", format: "Same as original" });
console.log(res.content);
