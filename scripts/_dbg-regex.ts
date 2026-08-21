import { transliterateName } from "../src/lib/oda/translate";

const s1 = "उपरोक्त विषय एवं संदर्भ के आलोक में, Sri Mahamood Miya, सीएमपीएफ खाता संख्या- एनजीपी/19/2724 के संबंध में संलग्न उद्धरण (एक्सट्रैक्ट) आपके अवलोकनार्थ प्रेषित है।";
const s2 = "उपरोक्त विषय एवं संदर्भ के आलोक में, श्री Upendra Rai, सीएमपीएफ खाता संख्या- केटीएस/17/169 के संबंध में संलग्न उद्धरण (एक्सट्रैक्ट) आपके अवलोकनार्थ प्रेषित है।";

// rule 6: Devanagari honorific + latin name
const r6 = /(श्री|श्रीमती|डॉ\.)\s+([A-Za-z][A-Za-z.\- ]+?)(?=[,;:।]|$)/g;
console.log("rule6 s2:", s2.replace(r6, (m, hon, name) => {
  const en = hon === "श्री" ? `Shri ${name.trim()}` : hon === "श्रीमती" ? `Smt ${name.trim()}` : `Dr ${name.trim()}`;
  const t = transliterateName(en);
  console.log("  en:", JSON.stringify(en), "=>", JSON.stringify(t));
  return t !== null ? t : m;
}));

// rule 7: latin honorific + name — check "Sri" (no h) matches
const r7 = /(^|[\s(,;:])(shrimati|shri\.?|s\.?h\.?|smt\.?|mr\.?|mrs\.?|dr\.?|er\.?|[A-Z]\.)\s+([A-Za-z][A-Za-z.\- ]+?)(?=[,;:।]|$)/gi;
console.log("rule7 s1:", s1.replace(r7, (m, lead, hon, name) => {
  const t = transliterateName(`${hon} ${name.trim()}`);
  console.log("  hon:", JSON.stringify(hon), "name:", JSON.stringify(name.trim()), "=>", JSON.stringify(t));
  return t !== null ? `${lead}${t}` : m;
}));

// Does the Latin group rule eat the name first and leave a "." artifact?
const r1 = /(?<![A-Za-z0-9.@])[A-Za-z][A-Za-z.\-']*(?:\s+[A-Za-z][A-Za-z.\-']*)*(?![A-Za-z0-9@])/g;
console.log("group s1:", s1.replace(r1, (g) => `[${g}]`));
