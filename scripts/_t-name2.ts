import { transliterateName } from "../src/lib/oda/translate";
for (const n of ["Sri Mahamood Miya", "Shri C Srikanth", "Sri Achintya Lal Yadav", "Sri Mohit Kumar Chandel", "Sri Kishore Ram Ratan", "Sri Salek Rajbhar", "Sri Idrish Mia", "Sri Mukul Balonkar", "Sri Ajai Kumar Mehta"]) {
  console.log(n, "=>", JSON.stringify(transliterateName(n)));
}
