import { referenceStandardPass } from "../src/lib/oda/refine";
import { hindiTranslateLine, transliterateProseToHindi } from "../src/lib/oda/translate";

const cases: Array<[string, string]> = [
  ["extract-sentence remnant", "उपरोक्त विषय एवं संदर्भ के आलोक में, Sri Mahamood Miya, सीएमपीएफ खाता संख्या- एनजीपी/19/2724 के संबंध में संलग्न उद्धरण (एक्सट्रैक्ट) आपके अवलोकनार्थ प्रेषित है।"],
  ["श्री + latin name", "उपरोक्त विषय एवं संदर्भ के आलोक में, श्री Upendra Rai, सीएमपीएफ खाता संख्या- केटीएस/17/169 के संबंध में संलग्न उद्धरण (एक्सट्रैक्ट) आपके अवलोकनार्थ प्रेषित है।"],
  ["ref with in our", "संदर्भ:- आपके कार्यालय का पत्र संख्या सीपीएफ/सिंग/16/एल.सी. in our आउट/एक्सट्रैक्ट/2345 दिनांक 16/12/2025"],
  ["ref off ice", "संदर्भ:- इस off ice पत्र का क्रम संख्या 1847 दिनांक 31.12.25 क्रमशः"],
  ["subject non-receipt", "विषय:- Non-receipt of enclosures regarding Ledger Card requisition of various members."],
  ["table header company", "क्र.सं. | सदस्य का नाम | सीएमपीएफ खाता संख्या | कोलियरी का नाम जहाँ सदस्य वर्तमान में कार्यरत है | कोलियरी का नाम जहाँ सदस्य पूर्व में कार्यरत था | Name of the Company | पदस्थापन"],
  ["table header colly variants", "क्र.सं. | सदस्य का नाम | सीएमपीएफ खाता संख्या | Name of the colly where member worked in this region | Name o the colliery where member working in your region"],
  ["colliery cell khandra", "Khandra Colliery (आरएनजे/21) From 01.9.2016"],
  ["colliery cell sonepur till date", "Sonepur Bazari Project (एस B.Area) | 08-06-2012 To Till Date"],
  ["stint april fused", "april-2000 toapril-2007"],
  ["stint month name", "Sep - 2007 to Des 2012"],
  ["to block one line", "To, The Regional Commissioner"],
  ["to block org", "the Regional Commissioner Coal Mines Provident Fund Singrauli P.O. Jayant, Dist. Sidhi Singrauli Singrauli (Madhya Pradesh) 486890"],
  ["ref OCR spaced", "Ref . :  CPF/155/Extract incoming/TLHR-12/Misc/Tal/448 Dtd . : 24/06/2025"],
  ["signature designation", "( Apurva  Kr.Pathak ) Assistant Commissioner - ( R -1 )"],
  ["numbered list", "1. All Dealing Assistants for strict compliance"],
  ["office note 6", "6. Letter No  CPF/118/Misc/L.C. Out/Req/Extract/Voll-2/R-1/ASN . Dated - 00-00-2025 Received Form CMPFO  Talcher  Regarding Requisition o f L.C. in R/o  Sri Bishikesh Naik  CMPF  A/c No - RNJ/27/1497"],
  ["office note placed here", "CMPF A/c  No- RNJ/29/801  Placed Here w ith My Kindly Be Seen Now Extract Prepared by Concerned D-Asst as well as Authenticated By S/o Submitted in Extract in, out Section Accordingly Forwarding Lette"],
  ["name and sri line", "CMPF A/c No-RNJ/29/940 And Sri Rabindra Singh."],
  ["kumardihi B colliery", "Kumardihi’B’Colliery (आरएनजे/18)"],
  ["l.c. not available", "L.C. is Not available at Kenda Area (आरएनजे/24)"],
  ["gm office", "G.M.Office, jamuna kotama Area, BLP/65"],
  ["ecl pandaveswar", "ECL/Pandaveswar Colliery (आरएनजे/7)"],
  ["devanti pandey line", "Dew anti pandey, CMPF A/C No- RNJ/11/212 as desired."],
  ["district tinsukia", "District Tinsukia - 786181"],
  ["unit no f1", "Unit No-F1 CSC No-2 Block G"],
  ["near tb sanatorium", "Near T. B. Sanatorium, Chhindwar a Pin-48001 (Madhya Pradesh)"],
  ["po jagrutivihar", "P.O.- Jagrutivihar, Dist.- Sambalpur"],
  ["subject fused odisha", "Odisha 768020 Sub :- Inter Regional Transfer of Ledger Card."],
  ["subject su b", "Su b- : Inter Regional Transfer of Ledger Card, DA, PS-3 & 4"],
];

for (const [label, line] of cases) {
  const viaRef = referenceStandardPass(line).trim();
  const floor = transliterateProseToHindi(line);
  console.log(`\n== ${label}`);
  console.log(`SRC  : ${line.slice(0, 140)}`);
  console.log(`REF  : ${viaRef.slice(0, 140)}${viaRef === line.trim() ? "  <== UNCHANGED" : ""}`);
  if (floor) console.log(`FLOOR: ${floor.slice(0, 140)}`);
}
