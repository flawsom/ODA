// scripts/fixtures-cmpf.ts
//
// Shared CMPF L.C.-Out fixtures, used by both the golden verification
// (verify-precision.ts) and the CI fit-scan (fit-scan.mts) so the two
// harnesses can never drift apart.
//
// FLATTENED_FIXTURE is the exact Hindi translation payload the app stores
// for the gold reference letter (one cell per line — the flattened table
// shape the instant engine emits). PIPE_FIXTURE is the same letter in
// pipe-delimited shape (DOCX structural sources). MEDIUM/HEAVY build on the
// same letterhead/body/signature with more members and stints.

export const FLATTENED_FIXTURE = [
  "सीपीएफ/118/विविध/एल.सी.-आउट/आरएनजे-21 एवं 14/आर-I/एएसएन/ दिनांक:09-07-2026",
  "सेवा में,",
  "सहायक आयुक्त,",
  "कोयला खान भविष्य निधि संगठन,",
  "बी.बी. कॉलेज रोड,",
  "आसनसोल, क्षेत्र-III",
  "जिला. पश्चिम बर्धमान – 713303",
  "पश्चिम बंगाल",
  "विषय:- लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण।",
  "संदर्भ:- सीपीएफ/59/एल.सी.-रिक्वेस्ट/बीकेआर-32/आर-III/एएसएन/41 दिनांक 07/07/2026",
  "महोदय,",
  "सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-35 दिनांक-12.02.1975 में निर्धारित संशोधित प्रक्रिया के दृष्टिगत, मुझे यह कहना है कि नीचे उल्लिखित सदस्य/सदस्यों का लेजर कार्ड आपके क्षेत्रीय कार्यालय को अग्रेषित किया जा रहा है।",
  "यह सुनिश्चित किया गया है कि जिस अवधि के दौरान सदस्य इस क्षेत्र में कार्यरत था, उस अवधि के लिए लेजर कार्ड में प्रविष्टियाँ की/अद्यतन की जा चुकी हैं।",
  "क्र.सं.",
  "सदस्य का नाम",
  "सीएमपीएफ खाता संख्या",
  "कोलियरी का नाम जहाँ सदस्य पूर्व में कार्यरत था",
  "कोलियरी का नाम जहाँ सदस्य वर्तमान में कार्यरत है",
  "एल.सी. संख्या",
  "1",
  "श्री तन्मय भट्टाचार्य",
  "आरएनजे/21/1964",
  "खंडरा कोलियरी, बांकोला क्षेत्र",
  "(20.04.2015 से 05.06.2025 तक)",
  "बांकोला क्षेत्र कार्यालय",
  "(06.06.2025 से 31.08.2025 तक)",
  "ईसीएल मुख्यालय, ईसीएल",
  "1",
  "2",
  "श्री हिरोक सरकार",
  "एनजीपी/64/79",
  "बांकोला एएचक्यू, बांकोला, ईसीएल",
  "(02.08.2021 से 18.08.2024 तक)",
  "ईसीएल मुख्यालय, ईसीएल",
  "1",
  "कृपया उपरोक्त की प्राप्ति की सूचना शीघ्रातिशीघ्र दें।",
  "भवदीय,",
  "(अजय कुमार सिंह)",
  "क्षेत्रीय आयुक्त - I",
].join("\n");

/** The same letter in pipe-delimited shape (DOCX structural sources). */
export const PIPE_FIXTURE = FLATTENED_FIXTURE
  .replace(
    [
      "क्र.सं.",
      "सदस्य का नाम",
      "सीएमपीएफ खाता संख्या",
      "कोलियरी का नाम जहाँ सदस्य पूर्व में कार्यरत था",
      "कोलियरी का नाम जहाँ सदस्य वर्तमान में कार्यरत है",
      "एल.सी. संख्या",
    ].join("\n"),
    "क्र.सं. | सदस्य का नाम | सीएमपीएफ खाता संख्या | कोलियरी का नाम जहाँ सदस्य पूर्व में कार्यरत था | कोलियरी का नाम जहाँ सदस्य वर्तमान में कार्यरत है | एल.सी. संख्या",
  )
  .replace(
    [
      "1",
      "श्री तन्मय भट्टाचार्य",
      "आरएनजे/21/1964",
      "खंडरा कोलियरी, बांकोला क्षेत्र",
    ].join("\n"),
    "1 | श्री तन्मय भट्टाचार्य | आरएनजे/21/1964 | खंडरा कोलियरी, बांकोला क्षेत्र",
  )
  .replace(
    [
      "(06.06.2025 से 31.08.2025 तक)",
      "ईसीएल मुख्यालय, ईसीएल",
      "1",
    ].join("\n"),
    "(06.06.2025 से 31.08.2025 तक) | ईसीएल मुख्यालय, ईसीएल | 1",
  )
  .replace(
    [
      "2",
      "श्री हिरोक सरकार",
      "एनजीपी/64/79",
      "बांकोला एएचक्यू, बांकोला, ईसीएल",
    ].join("\n"),
    "2 | श्री हिरोक सरकार | एनजीपी/64/79 | बांकोला एएचक्यू, बांकोला, ईसीएल",
  )
  .replace(
    [
      "(02.08.2021 से 18.08.2024 तक)",
      "ईसीएल मुख्यालय, ईसीएल",
      "1",
    ].join("\n"),
    "(02.08.2021 से 18.08.2024 तक) | ईसीएल मुख्यालय, ईसीएल | 1",
  );

// ---------------------------------------------------------------------------
// EXTRACT_FIXTURE — the REAL Surendra Koiri Extract-out letter (proof-outputs
// /153): table-less, bilingual — the exact shape that previously crashed
// Track B's "no table rows" requirement. Verified by the PRD package.
// ---------------------------------------------------------------------------

export const EXTRACT_FIXTURE = [
  "सीपीएफ/ 118/विविध/आरएनजे-16/Ext-आउट/आर-I/एएसएन/          दिनांक 08/05/2026",
  "To The Regional Commissioner",
  "C.M.P.F, Singrauli",
  "PO- Jayant Dist-Singrauli-486890",
  "मध्य प्रदेश",
  "विषय:- Supply of Extract of \"वी.वी.\" statement।",
  "संदर्भ:- आपके कार्यालय का पत्र संख्या सीपीएफ/16/सिंग/13/25 दिनांक 26/03/2026",
  "महोदय,",
  "On the subject and reference cited above ,please find enclosed herewith the extract in respect of Shri Surendra Koiri , CMPF A/C No- RNJ/38/520 as desired.",
  "भवदीय,",
  "(अजय कुमार सिंह)",
  "क्षेत्रीय आयुक्त - I",
].join("\n");

// ---------------------------------------------------------------------------
// NAYAK_FIXTURE — the REAL Susanta Kumar Nayak Extract-out letter
// (proof-outputs /179): second extract-family verification, with the
// "Inter Regional Transfer of Extract" subject ("transfer" alone must NOT
// route it to the L.C.-out family).
// ---------------------------------------------------------------------------

export const NAYAK_FIXTURE = [
  "सीपीएफ/ 118/विविध/एक्सट्रैक्ट-रिक्वेस्ट/आर-I/एएसएन/          दिनांक 09/07/2026",
  "To The Regional Commissioner",
  "कोयला खान भविष्य निधि",
  "Mcl Complex Anandvihar",
  "Po-Jagruti Vihar",
  "Sambalpur",
  "ओडिशा 768020",
  "विषय:- Inter Regional Transfer of Extract।",
  "संदर्भ:- सीपीएफ/एसबीपी/एक्सट्रैक्ट-Req./332 दिनांक 29/06/2026",
  "महोदय,",
  "On the subject and reference cited above, please find enclosed herewith the extract in respect of Shri Susanta Kumar Nayak , CMPF A/C No- RNJ/38/3274 as desired.",
  "भवदीय,",
  "(अजय कुमार सिंह)",
  "क्षेत्रीय आयुक्त - I",
].join("\n");

// ---------------------------------------------------------------------------
// JENA_FIXTURE — the REAL Khadal Jena L.C.-out letter (proof-outputs /162):
// English-heavy wording that missed the OLD exact-AND matcher, a 5-column
// member table (no एल.सी. संख्या column), "दिनांक" without a colon, an
// English procedure line and a "To The Regional Commissioner" address. The
// scored matcher must route it to cmpf-lc-out-v1.
// ---------------------------------------------------------------------------

export const JENA_FIXTURE = [
  "सीपीएफ/ 118/विविध/एल.सी.-आउट/आर-I/एएसएन/          दिनांक 24/04/2026",
  "To The Regional Commissioner",
  "कोयला खान भविष्य निधि,",
  "R.O- Talcher",
  "AT:- Jagannath colony",
  "P.O & P.S:- South Balanda",
  "Dist:- Angul, State:- Odisha",
  "पिन:- 759116",
  "विषय:- Inter Regional Transfer of Ledger Card, DA, PS-3 & 4।",
  "संदर्भ:- संख्या सीपीएफ/155/विविध/एल.सी. इनकमिंग/TLHR-10/Talcher/25-26/41 दिनांक 02/04/2026",
  "महोदय,",
  "In view of the revised Procedures prescribed in Procedure Office Order No-35 Dated-12.02.1975 of CMPF Commissioner, Dhanbad, I am to state that the Ledger Cards of the following members is hereby forwarded to your Regional Office.",
  "Further, it is informed that the Form A & P.S.-3 & P.S.-4 forms are not available in this region.",
  "It has been ensured that the posting in the Ledger Cards have been made/updated for the periods the member was working in this Region.",
  "SL. No.",
  "सदस्य का नाम",
  "सीएमपीएफ खाता संख्या",
  "कोलियरी का नाम जहाँ सदस्य पूर्व में कार्यरत था",
  "कोलियरी का नाम जहाँ सदस्य वर्तमान में कार्यरत है",
  "01",
  "Shri Khadal Jena",
  "RNJ/22/1586",
  "Moira Colliery (RNJ/22)",
  "टीएलएचआर/10",
  "कृपया उपरोक्त की प्राप्ति की सूचना शीघ्रातिशीघ्र दें।",
  "भवदीय,",
  "(अजय कुमार सिंह)",
  "क्षेत्रीय आयुक्त - I",
].join("\n");

// ---------------------------------------------------------------------------
// TRACK_A_FIXTURE — CMPF-signalled (organisation marker) but no known family
// above the confidence floor: no member table, no signatory block, no
// refCode line. Must fall to Track A's generic CMPF renderer with the shared
// letterhead — this is the "never silent-fail for any letter" guarantee.
// ---------------------------------------------------------------------------

export const TRACK_A_FIXTURE = [
  "कोयला खान भविष्य निधि संगठन",
  "क्षेत्रीय कार्यालय",
  "विषय:- आवेदन के संबंध में सूचना।",
  "महोदय,",
  "निम्नलिखित सदस्य के संबंध में आवेदन प्राप्त हुआ है। आपसे अनुरोध है कि उपलब्ध अभिलेखों के आधार पर आवश्यक कार्रवाई करें।",
  "धन्यवाद।",
].join("\n");

// ---------------------------------------------------------------------------
// Synthetic stress fixtures built on the same letterhead/body/signature —
// only the member table grows, which is what actually drives page length.
// ---------------------------------------------------------------------------

interface MemberRow {
  slNo: string;
  name: string;
  accountNo: string;
  /** Each stint is two lines: place, then date range. */
  stints: Array<{ place: string; dates: string }>;
  currColliery: string;
  lcNo: string;
}

const HEADER_LINES = [
  "क्र.सं.",
  "सदस्य का नाम",
  "सीएमपीएफ खाता संख्या",
  "कोलियरी का नाम जहाँ सदस्य पूर्व में कार्यरत था",
  "कोलियरी का नाम जहाँ सदस्य वर्तमान में कार्यरत है",
  "एल.सी. संख्या",
];

const STINT_1 = { place: "खंडरा कोलियरी, बांकोला क्षेत्र", dates: "(20.04.2015 से 05.06.2025 तक)" };
const STINT_2 = { place: "बांकोला क्षेत्र कार्यालय", dates: "(06.06.2025 से 31.08.2025 तक)" };
const STINT_3 = { place: "ईसीएल सीएमपीएफ क्षेत्रीय कार्यालय", dates: "(01.09.2025 से अब तक)" };

function buildFlattened(rows: MemberRow[]): string {
  const lines: string[] = [
    "सीपीएफ/118/विविध/एल.सी.-आउट/आरएनजे-21 एवं 14/आर-I/एएसएन/ दिनांक:09-07-2026",
    "सेवा में,",
    "सहायक आयुक्त,",
    "कोयला खान भविष्य निधि संगठन,",
    "बी.बी. कॉलेज रोड,",
    "आसनसोल, क्षेत्र-III",
    "जिला. पश्चिम बर्धमान – 713303",
    "पश्चिम बंगाल",
    "विषय:- लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण।",
    "संदर्भ:- सीपीएफ/59/एल.सी.-रिक्वेस्ट/बीकेआर-32/आर-III/एएसएन/41 दिनांक 07/07/2026",
    "महोदय,",
    "सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-35 दिनांक-12.02.1975 में निर्धारित संशोधित प्रक्रिया के दृष्टिगत, मुझे यह कहना है कि नीचे उल्लिखित सदस्य/सदस्यों का लेजर कार्ड आपके क्षेत्रीय कार्यालय को अग्रेषित किया जा रहा है।",
    "यह सुनिश्चित किया गया है कि जिस अवधि के दौरान सदस्य इस क्षेत्र में कार्यरत था, उस अवधि के लिए लेजर कार्ड में प्रविष्टियाँ की/अद्यतन की जा चुकी हैं।",
    ...HEADER_LINES,
  ];
  for (const r of rows) {
    lines.push(r.slNo, r.name, r.accountNo);
    for (const s of r.stints) lines.push(s.place, s.dates);
    lines.push(r.currColliery, r.lcNo);
  }
  lines.push(
    "कृपया उपरोक्त की प्राप्ति की सूचना शीघ्रातिशीघ्र दें।",
    "भवदीय,",
    "(अजय कुमार सिंह)",
    "क्षेत्रीय आयुक्त - I",
  );
  return lines.join("\n");
}

const member = (slNo: string, name: string, accountNo: string, stints: MemberRow["stints"]): MemberRow => ({
  slNo,
  name,
  accountNo,
  stints,
  currColliery: "ईसीएल मुख्यालय, ईसीएल",
  lcNo: "1",
});

/** 5 rows × 2-stint histories — the mid-weight stress case (9pt tier). */
export const MEDIUM_FIXTURE = buildFlattened([
  member("1", "श्री अमित कुमार", "आरएनजे/21/1965", [STINT_1, STINT_2]),
  member("2", "श्री सुनील कुमार", "आरएनजे/21/1966", [STINT_1, STINT_2]),
  member("3", "श्री राजेश प्रसाद", "आरएनजे/21/1967", [STINT_1, STINT_2]),
  member("4", "श्री विकास यादव", "आरएनजे/21/1968", [STINT_1, STINT_2]),
  member("5", "श्री मनोज सिंह", "आरएनजे/21/1969", [STINT_1, STINT_2]),
]);

/** 8 rows × 3-stint histories — the floor-tier stress case (overflow flag). */
export const HEAVY_FIXTURE = buildFlattened([
  member("1", "श्री अमित कुमार", "आरएनजे/21/1965", [STINT_1, STINT_2, STINT_3]),
  member("2", "श्री सुनील कुमार", "आरएनजे/21/1966", [STINT_1, STINT_2, STINT_3]),
  member("3", "श्री राजेश प्रसाद", "आरएनजे/21/1967", [STINT_1, STINT_2, STINT_3]),
  member("4", "श्री विकास यादव", "आरएनजे/21/1968", [STINT_1, STINT_2, STINT_3]),
  member("5", "श्री मनोज सिंह", "आरएनजे/21/1969", [STINT_1, STINT_2, STINT_3]),
  member("6", "श्री दीपक शर्मा", "आरएनजे/21/1970", [STINT_1, STINT_2, STINT_3]),
  member("7", "श्री रवि कुमार", "आरएनजे/21/1971", [STINT_1, STINT_2, STINT_3]),
  member("8", "श्री अरविंद तिवारी", "आरएनजे/21/1972", [STINT_1, STINT_2, STINT_3]),
]);
