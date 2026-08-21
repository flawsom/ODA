import { transliterateName } from "../src/lib/oda/translate.ts";
import { transliterateRef } from "../src/lib/oda/translate.ts";
const names = [
  "Shri Rajesh Kumar Barik", "Shri Krishna Manjhi", "Shri Kanchan kr. Passi",
  "Shri Ranjeet Kumar Rana", "Shri Sudip Dasgupta", "Shri C Srikanth",
  "Shri Santosh Rao", "Smt devanti Pandey", "Shri Ram palt Harijan",
  "Shri Mahendra Pratap Singh", "Shri Akshay Balsaraf", "Shri Samiran Mukherjee",
  "Shri Birendra Kumar Singh", "Shri B.Mahamood Miya", "Shri Ravindra Yadav",
  "Shri Mithilesh Kumar", "Shri Prasanta Kumar Routray", "Shri Sourabh Mali",
  "Shri Nimai Chandra Routh", "Shri Sunny Vishwakarma", "Shri Manas Kumar Mondal",
  "Shri Binod Kumar", "Shri Sanjoy Kumar Singh", "Shri Jaydev Roy",
  "Shri Rajendra Kumar Harijan", "Shri Madhusudan Madhav", "Shri Subhadip Ray",
  "Shri Anjani Kumar Singh", "Shri Santosh Kumar Nishad", "Shri Sagar Kumar Singh",
  "Shri Krishna", "Shri Kanchan", "Shri Ranjeet",
];
for (const n of names) console.log("NAME", JSON.stringify(n), "→", JSON.stringify(transliterateName(n)));
const refs = ["CPF/Extract/Ledger Card/DGR/890", "CPF/Pen/Sing/15/B.K. Singh/2435", "CPF/DHN-76/Samiran Mukherjee/D-1/233", "CPF/155/Extract Inco./TLHR-25/Misc/Tal/1360", "CPF/Misc/PA Cell/R-1/ASN", "CPF/118/Misc/LC Req./RNJ-10/R-I/ASN", "KA/PNL/CMPF Ledger Card Updation/2026/457"];
for (const r of refs) console.log("REF", JSON.stringify(r), "→", JSON.stringify(transliterateRef(r)));
