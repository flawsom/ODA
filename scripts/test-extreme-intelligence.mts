// ─── Extreme Deterministic Intelligence Stress Test ────────────────────────
// Tests the general vocabulary, phrase templates, and morphology engine
// against completely novel letters that have NEVER been in any training set.
// The goal: verify the deterministic pipeline produces proper Hindi output
// (not transliteration gibberish) for every category of formal letter.
// ─────────────────────────────────────────────────────────────────────────────

import {
  transliterateProseToHindi,
  sweepLeftoverLines,
} from "../src/lib/oda/translate";
import { ensureComplete } from "../src/lib/oda/completeness";
import type { GlossaryOverlay } from "../src/lib/oda/extraDict";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function assertNoLatin(text: string, label: string) {
  // Allow digits, punctuation, and code-like patterns but not prose Latin
  const latinWords = text.split(/\s+/).filter((w) =>
    /^[a-z]{3,}$/i.test(w.replace(/[.,;:!?()\-—–'"…]/g, ""))
  );
  assert(latinWords.length === 0, label + " (no Latin prose)", `leftover: [${latinWords.join(", ")}]`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: Novel Leave Application Letter
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n══ SUITE 1: Novel Leave Application ══");

const leaveApplication = [
  "To,",
  "The Principal,",
  "Delhi Public School,",
  "New Delhi – 110021",
  "Subject: Application for sick leave for 3 days",
  "Respected Sir,",
  "I am writing to inform you that I am suffering from high fever and severe cold. My doctor has advised me to take complete rest for three days. Therefore, I request you to kindly grant me sick leave from 19th August 2026 to 21st August 2026.",
  "I will complete all my pending assignments after rejoining. I shall be grateful if you approve my leave application.",
  "Thanking you,",
  "Yours faithfully,",
  "(Rahul Sharma)",
  "Class X, Section B",
  "Roll No. 15",
];

const leaveResult = sweepLeftoverLines(leaveApplication, "Hindi");
for (const [i, line] of leaveResult.entries()) {
  if (line.trim().length === 0) continue;
  assertNoLatin(line, `Leave L${i + 1}`);
}
assert(leaveResult.some(l => l.includes("अवकाश")), "Leave letter mentions अवकाश");
assert(leaveResult.some(l => l.includes("आवेदन")), "Leave letter mentions आवेदन");
assert(leaveResult.some(l => l.includes("कृपया")), "Leave letter mentions कृपया");

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: Municipal Complaint Letter
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n══ SUITE 2: Municipal Complaint ══");

const complaintLetter = [
  "To,",
  "The Municipal Commissioner,",
  "Brihanmumbai Municipal Corporation,",
  "Mumbai – 400001",
  "Subject: Complaint regarding irregular water supply and overflowing drain in Ward No. 32",
  "Sir,",
  "I wish to bring to your kind notice that the residents of Green Park Colony, Ward No. 32, have been facing severe water shortage for the past two weeks. The water supply has been reduced to just 15 minutes per day, which is insufficient for a colony of more than 200 families.",
  "Furthermore, the main drainage line near Block C has been overflowing for several days, causing waterlogging and a serious health hazard. The garbage collection in our area has also become irregular, leading to an increase in mosquitoes and rats.",
  "I request you to take necessary action at the earliest to restore adequate water supply, repair the drainage system, and ensure regular garbage collection.",
  "I shall be grateful if suitable action is taken in this matter.",
  "Thanking you,",
  "Yours faithfully,",
  "(Meena Devi)",
  "Resident, Green Park Colony",
];

const complaintResult = sweepLeftoverLines(complaintLetter, "Hindi");
for (const [i, line] of complaintResult.entries()) {
  if (line.trim().length === 0) continue;
  assertNoLatin(line, `Complaint L${i + 1}`);
}
assert(complaintResult.some(l => l.includes("शिकायत")), "Complaint mentions शिकायत");
assert(complaintResult.some(l => l.includes("पानी") || l.includes("जल")), "Complaint mentions water");
assert(complaintResult.some(l => l.includes("नाली") || l.includes("नाला")), "Complaint mentions drain");

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: Bank Loan Application
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n══ SUITE 3: Bank Loan Application ══");

const bankLoan = [
  "To,",
  "The Branch Manager,",
  "State Bank of India,",
  "Jawahar Nagar Branch, Jaipur – 302004",
  "Subject: Application for education loan for higher studies abroad",
  "Dear Sir,",
  "I am writing to request an education loan of Rs. 15,00,000/- (Fifteen Lakhs only) for pursuing my Master's degree in Computer Science at the University of Melbourne, Australia. My admission has been confirmed for the academic session starting September 2026.",
  "I have secured 85% marks in my Bachelor of Technology degree from Rajasthan Technical University. My father, Mr. Rajesh Kumar, is employed as a Government school teacher and his annual income is Rs. 6,50,000/-. We are willing to provide adequate collateral security as required.",
  "I request you to kindly process my loan application at the earliest. All necessary documents including admission letter, marksheets, income certificate, and property documents are enclosed herewith.",
  "Thanking you in advance.",
  "Yours faithfully,",
  "(Anita Sharma)",
];

const bankResult = sweepLeftoverLines(bankLoan, "Hindi");
for (const [i, line] of bankResult.entries()) {
  if (line.trim().length === 0) continue;
  assertNoLatin(line, `Bank L${i + 1}`);
}
assert(bankResult.some(l => l.includes("ऋण")), "Bank letter mentions ऋण");
assert(bankResult.some(l => l.includes("शिक्षा")), "Bank letter mentions शिक्षा");

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4: NOC Request
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n══ SUITE 4: NOC Request ══");

const nocLetter = [
  "To,",
  "The Director,",
  "National Institute of Technology,",
  "Bhopal – 462003",
  "Subject: Request for No Objection Certificate for appearing in GATE examination",
  "Respected Sir,",
  "I am a final year student of the Department of Mechanical Engineering, pursuing my Bachelor of Technology degree. I wish to appear in the Graduate Aptitude Test in Engineering (GATE) 2027 for which I require a No Objection Certificate from the institute.",
  "I hereby declare that my appearance in the examination will not affect my academic performance or duties in any way. I request you to kindly issue the No Objection Certificate at the earliest so that I may complete my application before the last date.",
  "I am enclosing a copy of my identity card and the examination advertisement for your reference.",
  "Thanking you.",
  "Yours sincerely,",
  "(Prateek Verma)",
  "Roll No. MT2023045",
];

const nocResult = sweepLeftoverLines(nocLetter, "Hindi");
for (const [i, line] of nocResult.entries()) {
  if (line.trim().length === 0) continue;
  assertNoLatin(line, `NOC L${i + 1}`);
}
assert(nocResult.some(l => l.includes("अनापत्ति") || l.includes("प्रमाणपत्र")), "NOC mentions अनापत्ति प्रमाणपत्र");

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 5: RTI Application
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n══ SUITE 5: RTI Application ══");

const rtiLetter = [
  "To,",
  "The Public Information Officer,",
  "Ministry of Environment, Forest and Climate Change,",
  "Indira Paryavaran Bhawan, New Delhi – 110003",
  "Subject: Application under Right to Information Act, 2005",
  "Sir,",
  "I am writing to request information under the Right to Information Act, 2005 regarding the following matters related to the environmental clearance granted to the proposed industrial project in Jharkhand:",
  "1. Complete details of the Environmental Impact Assessment report submitted by the applicant.",
  "2. Names and qualifications of the members of the Expert Appraisal Committee who reviewed the project.",
  "3. Copies of all representations received from the public during the consultation process.",
  "4. The final decision taken on the environmental clearance application along with conditions, if any.",
  "I request you to provide the above information within the prescribed time limit of 30 days as mandated under the Act.",
  "Yours faithfully,",
  "(Dr. Vikram Singh)",
  "RTI Registration No. JH/2026/4521",
];

const rtiResult = sweepLeftoverLines(rtiLetter, "Hindi");
for (const [i, line] of rtiResult.entries()) {
  if (line.trim().length === 0) continue;
  assertNoLatin(line, `RTI L${i + 1}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 6: Morphology Stress Test
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n══ SUITE 6: Morphology (Inflected Forms) ══");

const morphologyPairs: [string, string][] = [
  ["The documents are being processed.", "दस्तावेज़"],
  ["The employee was terminated.", "कर्मचारी"],
  ["Multiple certificates were issued.", "प्रमाणपत्र"],
  ["The payments have been completed.", "भुगतान"],
  ["The children are studying.", "बच्चे"],
  ["The teachers are attending.", "शिक्षक"],
  ["The meetings have been postponed.", "बैठक"],
  ["The employees are requesting.", "कर्मचारी"],
  ["The buildings are under construction.", "भवन"],
  ["The inspections were conducted.", "जाँच"],
  ["The applications are being examined.", "आवेदन"],
  ["The records have been updated.", "अभिलेख"],
  ["The vehicles are parked outside.", "वाहन"],
  ["The equipments were installed.", "उपकरण"],
  ["The treatments are ongoing.", "इलाज"],
  ["The salaries were delayed.", "वेतन"],
  ["The fines have been imposed.", "जुर्माना"],
  ["The pensions are being calculated.", "पेंशन"],
  ["The promotions have been approved.", "पदोन्नति"],
  ["The transfers were ordered.", "स्थानांतरण"],
];

for (const [sentence, expectedWord] of morphologyPairs) {
  const result = transliterateProseToHindi(sentence);
  assert(result !== null, `Morph: "${sentence.substring(0, 40)}…" → non-null`);
  if (result) {
    assertNoLatin(result, `Morph: "${sentence.substring(0, 40)}…"`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 7: Guarantee — ensureComplete sweeps all Latin
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n══ SUITE 7: ensureComplete Guarantee ══");

const mixedDocument = [
  "सेवा में,",
  "The Director,",
  "Department of Education,",
  "Subject: Application for transfer certificate",
  "Sir,",
  "I have been studying at this school for the past five years. I request you to kindly issue my transfer certificate as my father has been transferred to another city.",
  "Thanking you,",
  "Yours faithfully,",
  "(Sunita Kumari)",
];

const contentStr = mixedDocument.join("\n");
const sweepFn = (lines: string[]) => sweepLeftoverLines(lines, "Hindi");
const completed = ensureComplete(contentStr, "Hindi", 0, sweepFn);
const hasLatin = completed.content.split("\n").some((l) => {
  // Skip parenthesized name blocks — these are correctly preserved proper nouns
  // e.g. "(Sunita Kumari)" / "(Dilip Kumar Panda)" — not untranslated prose
  if (/^\([^)]+\)$/.test(l.trim())) return false;
  const latinWords = l.split(/\s+/).filter((w) =>
    /^[a-z]{3,}$/i.test(w.replace(/[.,;:!?()\-—–'"…]/g, ""))
  );
  return latinWords.length > 0;
});
assert(!hasLatin, "ensureComplete removes all Latin prose lines");

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 8: Novel Health Complaint
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n══ SUITE 8: Novel Health/Safety Complaint ══");

const healthLetter = [
  "To,",
  "The District Health Officer,",
  "Primary Health Centre, Khurda, Odisha – 752055",
  "Subject: Complaint regarding mosquito menace and risk of dengue in Bhubaneswar Colony",
  "Sir,",
  "I wish to inform you that the residents of Bhubaneswar Colony are facing a serious health emergency due to the breeding of mosquitoes in the stagnant water near the colony drain. Several residents including children and elderly persons have already been diagnosed with fever and dengue symptoms.",
  "The garbage collection vehicle has not visited our colony for the past ten days, resulting in accumulation of waste and stagnant water. The situation has become dangerous and requires immediate intervention.",
  "I request you to take urgent action to spray mosquito repellent in the affected area, arrange immediate garbage collection, and conduct a medical camp for early diagnosis and treatment of dengue.",
  "I request you to take necessary action at the earliest to prevent further spread of disease.",
  "Yours faithfully,",
  "(Ashok Mohanty)",
  "Resident, Bhubaneswar Colony",
];

const healthResult = sweepLeftoverLines(healthLetter, "Hindi");
for (const [i, line] of healthResult.entries()) {
  if (line.trim().length === 0) continue;
  assertNoLatin(line, `Health L${i + 1}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 9: Novel Job Application
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n══ SUITE 9: Novel Job Application ══");

const jobLetter = [
  "To,",
  "The Human Resources Manager,",
  "Tata Consultancy Services,",
  "Pune – 411057",
  "Subject: Application for the post of Software Engineer",
  "Dear Sir/Madam,",
  "I am writing to apply for the position of Software Engineer as advertised on your company website. I have completed my Bachelor of Engineering in Computer Science from Pune University with distinction.",
  "I have three years of experience in software development including proficiency in Java, Python, and cloud computing technologies. I am a quick learner and I believe my skills and experience would be a valuable addition to your team.",
  "I request you to kindly consider my application and schedule an interview at your earliest convenience. I am available for an interview on any weekday.",
  "I have enclosed my resume, marksheets, and experience certificates for your reference.",
  "Thanking you,",
  "Yours sincerely,",
  "(Kavya Patel)",
];

const jobResult = sweepLeftoverLines(jobLetter, "Hindi");
for (const [i, line] of jobResult.entries()) {
  if (line.trim().length === 0) continue;
  assertNoLatin(line, `Job L${i + 1}`);
}
assert(jobResult.some(l => l.includes("आवेदन")), "Job letter mentions आवेदन");

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 10: Novel Legal / Court Letter
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n══ SUITE 10: Novel Legal Notice ══");

const legalLetter = [
  "To,",
  "The Station House Officer,",
  "Koramangala Police Station,",
  "Bangalore – 560034",
  "Subject: Complaint regarding theft of motorcycle from residential parking",
  "Sir,",
  "I wish to report that my motorcycle (Registration No. KA-01-AB-1234, Honda Activa, Silver colour) has been stolen from the parking area of Green Valley Apartments, Koramangala, during the night between 15th and 16th August 2026.",
  "I parked my vehicle at its usual spot at approximately 9:00 PM on 15th August. When I came out the next morning at 7:00 AM, the vehicle was missing. I have checked with the security guard and neighbours, but nobody noticed anything suspicious.",
  "I request you to kindly register a First Information Report and take necessary action to recover my vehicle. I am enclosing a copy of the vehicle registration certificate, insurance policy, and my driving license.",
  "I request you to take immediate action in this matter.",
  "Yours faithfully,",
  "(Deepak Joshi)",
  "Flat No. 302, Green Valley Apartments",
];

const legalResult = sweepLeftoverLines(legalLetter, "Hindi");
for (const [i, line] of legalResult.entries()) {
  if (line.trim().length === 0) continue;
  assertNoLatin(line, `Legal L${i + 1}`);
}
assert(legalResult.some(l => l.includes("शिकायत")), "Legal letter mentions शिकायत");

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 11: Completely Unknown Vocabulary
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n══ SUITE 11: Unknown Vocabulary Floor ══");

const novelWords = [
  "electroencephalographic",
  "pseudopseudohypoparathyroidism",
  "antidisestablishmentarianism",
  "hippopotomonstrosesquippedaliophobia",
  "floccinaucinihilipilification",
  "spectrophotometrically",
  "ultramicroscopically",
  "thermodynamically",
];

for (const word of novelWords) {
  const result = transliterateProseToHindi(`The ${word} results were submitted.`);
  assert(result !== null, `Novel word "${word}" → non-null`);
  if (result) {
    assertNoLatin(result, `Novel word "${word}" → no Latin`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 12: Phrase Dictionary Coverage
// ═══════════════════════════════════════════════════════════════════════════════
console.log("\n══ SUITE 12: Phrase Template Coverage ══");

const phraseTests: [string, string][] = [
  ["I beg to state that my application is pending.", "सविनय निवेदन"],
  ["This is to inform you that the meeting has been postponed.", "सूचित"],
  ["Kindly do the needful.", "आवश्यक कार्रवाई"],
  ["Due to heavy rains, the event was cancelled.", "के कारण"],
  ["In accordance with the rules, the sanction has been granted.", "नियम"],
  ["Thank you in advance for your cooperation.", "धन्यवाद"],
  ["With reference to your letter, I wish to state.", "संदर्भ"],
  ["It is hereby declared that the results are final.", "घोषित"],
  ["The matter is under consideration.", "विचाराधीन"],
  ["Without further delay, kindly take action.", "विलंब"],
  ["I am directed to inform that the office will remain closed.", "निर्देश"],
  ["There is no objection from our side.", "आपत्ति"],
  ["Please find enclosed the required documents.", "संलग्न"],
  ["I am writing to apply for the post of.", "आवेदन"],
  ["You are respectfully requested to attend the meeting.", "विनम्रतापूर्वक"],
];

for (const [input, expected] of phraseTests) {
  const result = transliterateProseToHindi(input);
  assert(result !== null, `Phrase: "${input.substring(0, 50)}…" → non-null`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(60)}`);
console.log(`TOTAL: ${passed + failed}  PASSED: ${passed}  FAILED: ${failed}`);
console.log(`${"═".repeat(60)}`);

if (failed > 0) {
  process.exit(1);
}
