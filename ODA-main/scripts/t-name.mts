import { transliterateName } from "../src/lib/oda/translate";
for (const n of ["Shri Saikat Mondal", "Shri Surjakanta Nayak", "Shri Sanjay Kumar Singh", "Binay Kumar Pattanayak", "Anil Rajbhar", "Dharamraj Kurmi", "Shri Ramesh Verma", "Mic Jhanjra", "Bina Project", "Lodna Colliary", "Samdih Patherdih", "Pundi Project", "Chora Block Incline", "Ganesh Prasad", "Priya Sharma", "Arun Kumar"]) {
  console.log(JSON.stringify(n), "->", JSON.stringify(transliterateName(n)));
}
