import { hindiTranslateLine } from "../src/lib/oda/translate";
const lines = ["Sri. A.K. Sharma", "Sri B.K. Singh", "To,", "SRI R.N. Prasad", "Sri.",
  "S/Sri. A.K. Sharma", "S/Shri A.K. Sharma"];
for (const l of lines) console.log(l, "=>", JSON.stringify(hindiTranslateLine(l)));
