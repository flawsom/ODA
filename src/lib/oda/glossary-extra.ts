// Seed coverage additions for the 8-ALL NEW LETTER corpus (reminder-register
// letters, the Deoghar/Singrauli extract letters, the DLC-camp office notes,
// and the colliery-history table cells).
//
// The core tables live in glossary.ts; this module carries the rows added for
// this corpus and translate.ts merges them into the seed records at module
// load, so the browser bundle sees one combined dictionary.
//
// Matching rules are identical to the seed pack: sentence templates are
// whitespace-flexible (PDF/OCR text with fused labels still matches) and
// {n} placeholders capture the varying dates/numbers verbatim.

import type { GlossaryEntry } from "./glossary";

/** Colliery/mining, address-block and reminder vocabulary (Hindi). */
export const HI_TOKENS_EXTRA: Record<string, string> = {
  // "PO & PS:- South Balanda" — the address abbreviation rides without its
  // dots in the scanned letters (the seed row only knows "p.s"); the
  // address form reads पीएस exactly like the reference letters.
  ps: "पीएस",
  // "Posting Details ( Two copy )" — the enclosure/table label pair reads
  // पदस्थापन विवरण in the reference standard.
  posting: "पदस्थापन",
  details: "विवरण",
  // mining / site terms
  ocp: "ओसीपी",
  ocm: "ओसीएम",
  oco: "ओसीओ",
  oc: "ओसी",
  ug: "यूजी",
  "u/g": "यूजी",
  pit: "पिट",
  north: "उत्तर",
  east: "पूर्व",
  main: "मुख्य",
  underground: "भूमिगत",
  "c.v": "सी.वी.",
  "o.c.p": "ओ.सी.पी.",
  // colliery / area names from the dataset's member tables
  shankarpur: "शंकरपुर",
  jhingurda: "झिंगुरडा",
  umrer: "उमरेर",
  makardhokda: "मकरधोकड़ा",
  pandaveswar: "पांडवेश्वर",
  lingaraj: "लिंगराज",
  kumardihi: "कुमारडीही",
  bhowra: "भोवरा",
  nakrakonda: "नकराकोंडा",
  nakarakonda: "नकराकोंडा",
  rajmahal: "राजमहल",
  basantimata: "बसंतीमाता",
  dahibari: "दहीबारी",
  bagdewa: "बगदेवा",
  singhali: "सिंघाली",
  surakachhar: "सुरकच्छर",
  nowrozabad: "नौरोजाबाद",
  johilla: "जोहिल्ला",
  orient: "ओरिएंट",
  lakhanpur: "लखनपुर",
  korba: "कोरबा",
  chandrapur: "चंद्रपुर",
  bhatgaon: "भटगांव",
  shivani: "शिवानी",
  katras: "कटरास",
  chattudih: "छत्तुडीह",
  tilaboni: "तिलाबोनी",
  shyamasundarpur: "श्यामासुंदरपुर",
  sanctoria: "सैंक्टोरिया",
  mahakali: "महाकाली",
  deoghar: "देवघर",
  ushagram: "उषाग्राम",
  bharatpur: "भरतपुर",
  soaner: "सोनेर",
  dinesh: "दिनेश",
  mahanadi: "महानदी",
  sarpi: "सरपी",
  khottadih: "खोटाडीह",
  palasthali: "पलासथली",
  hatia: "हटिया",
  mohal: "मोहल",
  ncl: "एनसीएल",
  gm: "जीएम",
  // address-block vocabulary (the Deoghar extract letters' recipient block)
  building: "बिल्डिंग",
  court: "कोर्ट",
  more: "मोड़",
  chowk: "चौक",
  vip: "वीआईपी",
  sonali: "सोनाली",
  above: "उपरोक्त",
  // reminder marker and office-note header
  reminder: "अनुस्मारक",
  note: "नोट",
  intimated: "सूचित",
  // generic colliery-cell and address vocabulary the scanned tables reuse
  colliery: "कोलियरी",
  colliary: "कोलियरी",
  mine: "माइन",
  and: "एवं",
  west: "पश्चिम",
  bengal: "बंगाल",
  rajgamar: "राजगामार",
  burdhanman: "बर्धमान",
  college: "कॉलेज",
  road: "रोड",
  "e-mail": "ई-मेल",
  email: "ई-मेल",
  add: "पता",
  "b.b": "बी.बी.",
  akk: "एकेके",
  mkd: "एमकेडी",
  // scanned typo of Colliery ("Kumardihi “B” Coliery")
  coliery: "कोलियरी",
  // "C.V.Area" — the Chirimiri-Valley sub-area glued to the area word
  "c.v.area": "सी.वी. क्षेत्र",
  // ---- The 7-ALL OLD LETTER corpus — floor/term vocabulary so the
  // deterministic sweep reads like Hindi instead of phonetic word soup ----
  letter: "पत्र",
  dated: "दिनांक",
  date: "दिनांक",
  received: "प्राप्त",
  regarding: "संबंधी",
  subject: "विषय",
  reference: "संदर्भ",
  below: "नीचे",
  this: "यह",
  that: "वह",
  our: "हमारे",
  your: "आपके",
  please: "कृपया",
  kindly: "कृपया",
  enclosed: "संलग्न",
  herewith: "साथ",
  not: "नहीं",
  available: "उपलब्ध",
  member: "सदस्य",
  name: "नाम",
  company: "कंपनी",
  working: "कार्यरत",
  worked: "कार्यरत",
  was: "था",
  were: "थे",
  is: "है",
  are: "हैं",
  have: "है",
  has: "है",
  had: "था",
  been: "गया",
  be: "हो",
  from: "से",
  on: "पर",
  as: "अनुसार",
  card: "कार्ड",
  ledger: "लेजर",
  copy: "प्रति",
  form: "फॉर्म",
  extract: "उद्धरण",
  statement: "विवरण",
  till: "तक",
  kenda: "केंदा",
  jamuna: "जमुना",
  kotama: "कोतमा",
  khandra: "खांड्रा",
  sonepur: "सोनेपुर",
  bazari: "बज़रि",
  "g.m.office": "जीएम कार्यालय",
  // ---- The 7-ALL OLD LETTER corpus — recipient-block places and address
  // vocabulary (the L.C.-OUT / L.C.-REQ letters' To-block address lines) ----
  singrauli: "सिंगरौली",
  jayant: "जयंत",
  sidhi: "सिधि",
  tinsukia: "तिनसुकिया",
  chhindwara: "छिंदवाड़ा",
  sambalpur: "संबलपुर",
  jagrutivihar: "जागृति विहार",
  odisha: "ओडिशा",
  maharashtra: "महाराष्ट्र",
  jharkhand: "झारखंड",
  nagpur: "नागपुर",
  bilaspur: "बिलासपुर",
  talcher: "तालचर",
  asansol: "आसनसोल",
  ranchi: "रांची",
  dhanbad: "धनबाद",
  opposite: "सामने",
  near: "निकट",
  gate: "गेट",
  sanatorium: "सेनिटोरियम",
  sanitorium: "सेनिटोरियम",
  block: "ब्लॉक",
  unit: "यूनिट",
  district: "जिला",
  pin: "पिन",
  margherita: "मार्गेरिटा",
  margarita: "मार्गेरिटा",
  margharita: "मार्गेरिटा",
  chindwara: "छिंदवाड़ा",
  csc: "सीएससी",
  // the Delhi L.C.-OUT letters' To-block address ("Unit No-F1 CSC No-2
  // Block G", "Delhi 110092") — F1 is the unit/shop number and Delhi the
  // city; without them the whole address line stays in the source script.
  f1: "एफ1",
  delhi: "दिल्ली",
  preet: "प्रीत",
  vihar: "विहार",
  // "No-F1" / "No-2" — the number marker in the address/unit lines (the
  // REF_TOKENS entry only serves the ref path; the term pass needs its own).
  no: "संख्या",
  // "CIL DEL/1" — the Coal India Ltd code in the colliery cells; the term
  // pass needs the word (the REF_TOKENS entry only serves the ref path).
  cil: "सीआईएल",
  // "PO- GupteswarShaktinagar" — the Jabalpur office address (letter 0); the
  // REF_TOKENS entries only serve the ref path, the term pass needs its own.
  gupteswar: "गुप्तेश्वर",
  shaktinagar: "शक्तिनगर",
  // "Received From CMPFO Talcher" — the forwarding office in the office-note
  // ledger lines (letter 45); the term pass needs the word (CODE_TOKEN_RE
  // requires a separator, so plain "CMPFO" would fall to the name fallback
  // and read कमपफो).
  cmpfo: "सीएमपीएफओ",
  // "P.O.-Jagrutivihar, Dist.-Sambalpur" — the full address line in letters
  // 17/29/58 reads जागृति विहार (two words); the term pass splits on spaces
  // "Jabalpur" as a standalone address token (the REF_TOKENS entry only
  // serves the ref path; the term pass and address lines need it too).
  jabalpur: "जबलपुर",
  mp: "म.प्र.",
  // ---- The 7-ALL OLD LETTER corpus, round 2 — floor/term vocabulary so the
  // deterministic sweep and the cell passes read like Hindi instead of
  // phonetic word soup ----
    // Table cell vocabulary: colliery names, area names, months, prepositions
  nigahi: "निगाही",
  workshop: "कार्यालय",
  march: "मार्च",
  april: "अप्रैल",
  to: "से",
  post: "पोस्ट",
  "post-margarita": "पोस्ट-मार्गेरिटा",
  "main road": "मुख्य मार्ग",
  assam: "असम",
  kithara: "किठारा",
  kathara: "कथरा",
  nakrakond: "नकराकोंडा",
  "in-out": "इन-आउट",
  // the not-available / inadvertently-sent reply vocabulary
  cited: "उद्धृत",
  respect: "संबंध में",
  state: "कहा जाता है",
  inform: "सूचित",
  original: "मूल",
  inadvertently: "अनजाने में",
  sent: "भेजा",
  instead: "के स्थान पर",
  refund: "वापसी",
  earliest: "शीघ्रातिशीघ्र",
  receipt: "प्राप्ति",
  various: "विभिन्न",
  members: "सदस्यों",
  enclosures: "संलग्नियाँ",
  requisition: "प्राप्ति",
  absence: "अभाव",
  requisite: "आवश्यक",
  precludes: "रोकता",
  further: "आगे",
  processing: "कार्रवाई",
  requested: "अनुरोध",
  necessary: "आवश्यक",
  documents: "दस्तावेज़",
  furnished: "उपलब्ध कराए",
  enable: "सक्षम",
  proceed: "आगे बढ़ने",
  matter: "मामले",
  prompt: "त्वरित",
  attention: "ध्यान",
  highly: "अत्यधिक",
  appreciated: "सराहनीय",
  enclousure: "संलग्नक",
  enclosure: "संलग्नक",
  found: "प्राप्त",
  resignation: "इस्तीफा",
  accepted: "स्वीकृत",
  acceptanced: "स्वीकृत",
  toppa: "तोप्पा",
  // ---- Comprehensive formal-letter vocabulary ----
  request: "अनुरोध",
  security: "सुरक्षा",
  measures: "उपाय",
  enhanced: "संवर्धित",
  staff: "कर्मचारी",
  officers: "अधिकारी",
  quarters: "आवास",
  housing: "आवास",
  residence: "आवास",
  periodically: "आवधिक रूप से",
  periodic: "आवधिक",
  solitary: "एकांत",
  occupancy: "अधिवास",
  travel: "यात्रा",
  incidents: "घटनाएँ",
  incident: "घटना",
  theft: "चोरी",
  vicinity: "आसपास",
  presently: "वर्तमान में",
  residing: "निवास कर रहा",
  family: "परिवार",
  however: "हालाँकि",
  occasions: "अवसर",
  outside: "बाहर",
  station: "स्टेशन",
  visits: "भ्रमण",
  tours: "दौरे",
  native: "मूल",
  hometown: "मूल निवास",
  unattended: "अविरक्त",
  without: "बिना",
  responsible: "जिम्मेदार",
  person: "व्यक्ति",
  present: "उपस्थित",
  notice: "सूचना",
  bring: "लाना",
  occurred: "घटित",
  reportedly: "कथित रूप से",
  blocks: "ब्लॉक",
  located: "स्थित",
  recent: "हालिया",
  past: "अतीत",
  bachelor: "अविवाहित",
  nearby: "निकट",
  unable: "असमर्थ",
  depend: "निर्भर",
  safeguard: "सुरक्षा",
  belongings: "संपत्ति",
  convenience: "सुविधा",
  obligation: "बाध्यता",
  property: "संपत्ति",
  therefore: "अतः",
  remain: "रहता",
  apprehensive: "चिंतित",
  safety: "सुरक्षा",
  particularly: "विशेषकर",
  night: "रात्रि",
  hours: "घंटे",
  families: "परिवार",
  colony: "कॉलोनी",
  deployment: "तैनाती",
  guard: "गार्ड",
  periods: "अवधि",
  leave: "अवकाश",
  installation: "स्थापना",
  adequate: "पर्याप्त",
  lighting: "प्रकाश व्यवस्था",
  street: "सड़क",
  around: "आसपास",
  residential: "आवासीय",
  grateful: "कृतज्ञ",
  suitable: "उचित",
  action: "कार्रवाई",
  residents: "निवासी",
  temporarily: "अस्थायी रूप से",
  away: "दूर",
  thanking: "धन्यवाद",
  faithfully: "वफादारी",
  forwarded: "प्रेषित",
  information: "जानकारी",
  ensure: "सुनिश्चित",
  mentioned: "उल्लेखित",
  although: "हालाँकि",
  safeguarding: "सुरक्षा",
  during: "दौरान",
  especially: "विशेषकर",
  before: "पहले",
  after: "बाद",
  between: "बीच",
  against: "विरुद्ध",
  towards: "की ओर",
  until: "तक",
  about: "के बारे में",
  per: "प्रति",
  own: "अपना",
  // ---- Remaining phonetic-remnant cleanup ----
  ssa: "एसएसए",
  am: "",
  at: "पर",
  or: "अथवा",
  the: "",
  a: "",
  an: "",
  of: "",
  in: "में",
  for: "के लिए",
  with: "साथ",
  my: "मेरा",
  their: "उनके",
  his: "उनका",
  her: "उनकी",
  its: "इसका",
  we: "हम",
  they: "वे",
  he: "वह",
  she: "वह",
  you: "आप",
  me: "मुझे",
  us: "हमें",
  them: "उन्हें",
  him: "उन्हें",
  but: "लेकिन",
  so: "इसलिए",
  if: "यदि",
  than: "से",
  being: "रहा",
  will: "होगा",
  would: "होता",
  could: "सकता",
  should: "चाहिए",
  may: "सकता",
  might: "सकता",
  shall: "होगा",
  can: "सकता",
  do: "",
  does: "",
  did: "",
  nor: "नहीं",
  only: "केवल",
  same: "एक ही",
  then: "तब",
  when: "जब",
  where: "जहाँ",
  which: "जो",
  while: "जबकि",
  who: "जो",
  whom: "जिसे",
  what: "क्या",
  how: "कैसे",
  all: "सभी",
  into: "में",
  over: "पर",
  under: "के तहत",
  upon: "पर",
  also: "भी",
  any: "कोई",
  because: "क्योंकि",
  both: "दोनों",
  each: "प्रत्येक",
  few: "कुछ",
  most: "अधिकांश",
  other: "अन्य",
  some: "कुछ",
  such: "ऐसा",
  just: "केवल",
  very: "बहुत",
  too: "भी",
  again: "फिर से",
  always: "हमेशा",
  never: "कभी नहीं",
  here: "यहाँ",
  there: "वहाँ",
  now: "अब",
  still: "अभी भी",
  already: "पहले से",
  // ---- Fix: remove generic "I" to avoid Roman numeral breakage ----
  // "I" as first-person pronoun is handled by the sentence patterns.
  // Roman numerals (I, II, III) must NOT be translated.
  andor: "अथवा",
};

/** Reference/file-number vocabulary additions (Hindi). */
export const REF_TOKENS_EXTRA: Record<string, string> = {
  sl: "क्र.सं.",
  no: "संख्या",
  dtd: "दिनांक",
  pa: "पीए",
  cell: "सेल",
  even: "क्रम",
  respectively: "क्रमशः",
  hr: "एचआर",
  per: "पीईआर",
  agt: "एजीटी",
  jnr: "जेएनआर",
  jpc: "जेपीसी",
  nk: "एनके",
  kb: "केबी",
  da: "डी.ए.",
  ps: "पी.एस.",
  rnn: "आरएनएन",
  deoghar: "देवघर",
  ushagram: "उषाग्राम",
  // "Tr.of" (Transfer of) and "Ext.out" / "Ext-out" (the Ext-out code) —
  // the ref codes as the scanned letters carry them (dots inside the token).
  "tr.of": "ट्रांसफर ऑफ",
  "ext.out": "एक्सट-आउट",
  "ext-out": "एक्सट-आउट",
  "ext.out.": "एक्सट-आउट",
  // the office-note header codes (33-FILE): "C.P.F./111/Pen.Sec/R-1/ASN/"
  "c.p.f.": "सी.पी.एफ.",
  "c.p.f": "सी.पी.एफ.",
  "pen.sec": "पेन.सेक.",
  "pen.sec.": "पेन.सेक.",
  // "L.C.Req" — the L.C.-requisition code with the suffix glued to the dot
  // abbreviation (letters 89/105), read एल.सी.रेक.
  "l.c.req": "एल.सी.रेक.",
  "l.c.req.": "एल.सी.रेक.",
  // the reminder-register ref codes and the DLC note's codes
  cmpf: "सीएमपीएफ",
  kgl: "केजीएल",
  akk: "एकेके",
  mkd: "एमकेडी",
  "w.b": "प.ब.",
  "b.b": "बी.बी.",
  "no.": "नं.",
  // the extract / ledger-card ref lines the scanned letters carry
  ledger: "लेजर",
  card: "कार्ड",
  pen: "पेंशन",
  tal: "ताल",
  inco: "इन्को.",
  lc: "एल.सी.",
  "l.c.in": "एल.सी.इन",
  // "…/Misc/ L.C.Transfer /513" — the transfer-order file-number component
  // renders एल.सी.-ट्रांसफर (the एल.सी.-आउट pattern), never a Latin remnant.
  "l.c.transfer": "एल.सी.-ट्रांसफर",
  transfer: "ट्रांसफर",
  in: "इन",
  updation: "अद्यतन",
  kts: "केटीएस",
  ka: "केए",
  pnl: "पीएनएल",
  dhn: "डीएचएन",
  bkr: "बीकेआर",
  // the 7-ALL OLD LETTER corpus — account/region codes and address places
  mgm: "एमजीएम", // Jabalpur account codes (MGM/12/796) — never the phonetic "मगम"
  "c.s": "सी.एस.", // C.S.-8 — the section code in the JBP extract refs
  jabalpur: "जबलपुर",
  mp: "मप्र",
  // "GM/SBA/ Pers /59/2024/994" — the personnel section code in the office
  // ref lines (letter 47); the code token reads पर्स.
  pers: "पर्स",
  // "CIL DEL/1" — the Coal India Ltd + Delhi region code in the current-
  // colliery cells of the Delhi L.C.-OUT letters; सीआईएल, never the
  // phonetic "किल" the name fallback produces.
  cil: "सीआईएल",
  del: "देल",
  // "Received From CMPFO  Talcher" — the forwarding office in the office-note
  // ledger lines (letter 45); the code token reads सीएमपीएफओ, never the
  // phonetic "कमपफो" the name fallback would produce.
  cmpfo: "सीएमपीएफओ",
  // "Voll-2" — the volume component of the file number (letter 45's
  // CPF/118/…/Voll-2/R-1/ASN); the code token reads वोल.
  voll: "वोल",
  po: "पो",
  gupteswar: "गुप्तेश्वर",
  shaktinagar: "शक्तिनगर",
  // government register terms — the reference letters write the full word
  // (CPF/118/Misc./L.C. Requisition/…) and the CMPFO Hindi twin uses
  // रिक्वेस्ट, never a letter-by-letter transliteration of "Requisition"
  requisition: "रिक्वेस्ट",
  reqn: "रिक्वेस्ट",
  requisitioning: "रिक्वेस्ट",
  // names inside reference numbers ("CPF/Pen/Sing/15/B.K. Singh/2435")
  singh: "सिंह",
  "b.k": "बी.के.",
  samiran: "समीरन",
};

/** Curated member/signature names from the 8-ALL NEW LETTER corpus — the
 * exact Devanagari the reference letters use (the rule-based fallback is a
 * last resort and mis-spells several). Keys are the normalized lookup form
 * (lowercase, punctuation → space). */
export const NAME_TABLE_EXTRA: Record<string, string> = {
  // extract-letter members
  "rajesh kumar barik": "राजेश कुमार बारिक",
  "krishna manjhi": "कृष्ण मांझी",
  "kanchan kr passi": "कंचन कुमार पासी",
  "kanchan kumar passi": "कंचन कुमार पासी",
  "ranjeet kumar rana": "रंजीत कुमार राणा",
  "sudip dasgupta": "सुदीप दासगुप्ता",
  "c srikanth": "सी श्रीकांत",
  "santosh rao": "संतोष राव",
  "devanti pandey": "देवंती पांडेय",
  "ram palt harijan": "राम पलट हरिजन",
  "mahendra pratap singh": "महेंद्र प्रताप सिंह",
  "akshay balsaraf": "अक्षय बलसराफ",
  "samiran mukherjee": "समीरन मुखर्जी",
  "birendra kumar singh": "बिरेंद्र कुमार सिंह",
  "b mahamood miya": "बी. महमूद मिया",
  "mahamood miya": "महमूद मिया",
  "prasanta kumar routray": "प्रसंता कुमार राउत्रे",
  "sourabh mali": "सौरभ माली",
  "nimai chandra routh": "निमाई चंद्र राउत",
  "sunny vishwakarma": "सनी विश्वकर्मा",
  "manas kumar mondal": "मानस कुमार मोंडल",
  "sanjoy kumar singh": "संजय कुमार सिंह",
  "jaydev roy": "जयदेव राय",
  "rajendra kumar harijan": "राजेंद्र कुमार हरिजन",
  "madhusudan madhav": "मधुसूदन माधव",
  "subhadip ray": "सुभदीप राय",
  "anjani kumar singh": "अंजनी कुमार सिंह",
  "santosh kumar nishad": "संतोष कुमार निषाद",
  "sagar kumar singh": "सागर कुमार सिंह",
  "bhaskar pal": "भास्कर पाल",
  // single-word lookups the multi-word entries build on
  krishna: "कृष्ण",
  kanchan: "कंचन",
  ranjeet: "रंजीत",
  manjhi: "मांझी",
  passi: "पासी",
  rana: "राणा",
  dasgupta: "दासगुप्ता",
  srikanth: "श्रीकांत",
  rao: "राव",
  barik: "बारिक",
  balsaraf: "बलसराफ",
  miya: "मिया",
  mahamood: "महमूद",
  routray: "राउत्रे",
  mali: "माली",
  routh: "राउत",
  vishwakarma: "विश्वकर्मा",
  mondal: "मोंडल",
  roy: "राय",
  madhav: "माधव",
  ray: "राय",
  nishad: "निषाद",
  harijan: "हरिजन",
  pandey: "पांडेय",
  palt: "पलट",
  "  mahendra pratap": "महेंद्र प्रताप",
  "b.b.singh": "बी.बी. सिंह",
  "shri b.b.singh": "श्री बी.बी. सिंह",
  "apurva kr.pathak": "अपूर्वा कृ. पाठक",
  "apurva krpathak": "अपूर्वा कृ. पाठक",
  "apurva": "अपूर्वा",
  "birendra kumar": "बिरेंद्र कुमार",
  "prasanta kumar": "प्रसंता कुमार",
  "manas kumar": "मानस कुमार",
  "rajendra kumar": "राजेंद्र कुमार",
  "santosh kumar": "संतोष कुमार",
  "sagar kumar": "सागर कुमार",
  "anjani kumar": "अंजनी कुमार",
  "mahendra": "महेंद्र",
  "birendra": "बिरेंद्र",
  "prasanta": "प्रसंता",
  "sourabh": "सौरभ",
  "nimai": "निमाई",
  "sunny": "सनी",
  "manas": "मानस",
  "sanjoy": "संजय",
  "jaydev": "जयदेव",
  "rajendra": "राजेंद्र",
  "madhusudan": "मधुसूदन",
  "subhadip": "सुभदीप",
  "anjani": "अंजनी",
  "santosh": "संतोष",
  "sagar": "सागर",
  "bhaskar": "भास्कर",
  // the 7-ALL OLD LETTER corpus — the Ranchi extract letters' member names
  // and the generic fallback words the rule-based transliterator misses.
  "upendra rai": "उपेंद्र राय",
  "upendra": "उपेंद्र",
  "rai": "राय",
  "mia": "मिया",
  "dewanti pandey": "देवंती पांडेय",
  "dew anti pandey": "देवंती पांडेय",
  "sanju kumar behera": "संजय कुमार बेहरा",
  "behera": "बेहरा",
  "sanju": "संजू",
  "mannoj kumar mandal": "मनोज कुमार मंडल",
  "manoj kumar mandal": "मनोज कुमार मंडल",
  "mandal": "मंडल",
  "manoj": "मनोज",
  "daya ram meghwal": "दया राम मेघवाल",
  "meghwal": "मेघवाल",
  "ram chandra prasad yadav": "राम चंद्र प्रसाद यादव",
  "yadav": "यादव",
  "avtar singh": "अवतार सिंह",
  "avtar": "अवतार",
  "sunil kumar rana": "सुनील कुमार राणा",
  "sunil": "सुनील",
  "achintya lal yadav": "अचिंत्या लाल यादव",
  "ganesh tukaram diwate": "गणेश तुकराम दिवते",
  "mukul balonkar": "मुकुल बालोंकर",
  "ajay kumar": "अजय कुमार",
  "jitendra gopal mishra": "जितेंद्र गोपाल मिश्रा",
  "jitendra": "जितेंद्र",
  "mishra": "मिश्रा",
  "dilip": "दिलीप",
  "smt devanti pandey": "श्रीमती देवंती पांडेय",
  // the DLC office-note ledger members (45-New Microsoft Word Document) —
  // the phrase captures carry the names; the reference pass's honorific rule
  // needs the full-name row so "Sri Shiv Lal Mishra" reads श्री शिव लाल
  // मिश्रा (the generic fallback drops the long vowels: लल / मिशरा).
  "shiv lal mishra": "शिव लाल मिश्रा",
  "shiv": "शिव",
  "lal": "लाल",
  "bishikesh naik": "बिशिकेश नाइक",
  "bishikesh": "बिशिकेश",
  "naik": "नाइक",
  "rabindra singh": "रबींद्र सिंह",
  "rabindra": "रबींद्र",
  // the DLC office-note signatory (33-FILE): "( Apurva Kr.Pathak )" reads
  // (अपूर्वा कुमार पाठक) — the generic fallback drops the long vowels
  // (अपुरवा कुमार पथक). The kr-normalized lookup key carries "kr".
  "apurva kr pathak": "अपूर्वा कुमार पाठक",
  "pathak": "पाठक",
};

/** Prose-reference frame-word additions (this office letter of even no. …). */
export const PROSE_REF_TOKENS_EXTRA: Record<string, string> = {
  even: "क्रम",
  respectively: "क्रमशः",
  // "Ref:- Email From : x To : y" — the email-header ref lines read
  // ईमेल प्रेषक : … प्राप्तकर्ता : … दिनांक …
  email: "ईमेल",
  // "…/448 Dtd. : 24/06/2025" — the scanned letters abbreviate the date
  // label; it reads दिनांक like the full "dated" form.
  dtd: "दिनांक",
};

/** Address-line phrase additions (the DLC camp letters' venue line). */
export const HI_PHRASES_EXTRA: Array<[RegExp, string]> = [
  // "P. Burdhanman-713303" — the abbreviated Paschim Burdwan district; the
  // reference letters spell it out in full (जिला. पश्चिम बर्धमान- 713303).
  [/\bP\.\s+Burdhanman\b/gi, "पश्चिम बर्धमान"],
  // The recipient-block organization (the L.C.-OUT letters' To-block):
  // "Coal Mines Provident Fund" reads कोयला खान भविष्य निधि — the term
  // pass must never letter-mangle it (कोल माइन्स फंड).
  [/\bCoal\s+Mines\s+Provident\s+Fund\s+Organisation\b/gi, "कोयला खान भविष्य निधि संगठन"],
  [/\bCoal\s+Mines\s+Provident\s+Fund\b/gi, "कोयला खान भविष्य निधि"],
  // "Madhya Pradesh" → मध्य प्रदेश (the To-block state lines).
  [/\bMadhya\s+Pradesh\b/gi, "मध्य प्रदेश"],
  // "as desired." — the extract-sentence tail dropped (the reference
  // sentence owns the tail; a leftover fragment must not ship it).
  [/[\s,]*as\s+desired\s*\.?\s*$/gi, ""],
  // "ENCLOUSURE NOT FOUND" — the scanned table cells (letter 71) read
  // संलग्नक उपलब्ध नहीं, never a phonetic "एंकलोसुरे नोत फोंद".
  [/\benclousure\s+not\s+found\b/gi, "संलग्नक उपलब्ध नहीं"],
  [/\benclosure\s+not\s+found\b/gi, "संलग्नक उपलब्ध नहीं"],
  // "Inter-Regional Extract In-Out" — the In/Out register subject reads
  // अंतर-क्षेत्रीय उद्धरण इन-आउट (the token pass would letter-mangle it).
  [/\bInter(?:-|\s+)Regional\s+Extract\s+In-Out\b/gi, "अंतर-क्षेत्रीय उद्धरण इन-आउट"],
  [/\bInter(?:-|\s+)Regional\b/gi, "अंतर-क्षेत्रीय"],
  // "2. All S.O ./ A.O" — the office-note numbered item (letter 33) reads
  // सभी एस.ओ./ए.ओ., never a phonetic "अल्ल एस.ओ ./ ए.ओ". The dotted
  // abbreviations carry a stray OCR dot around the slash too ("S.O ./ A.O").
  [/\bAll\s+S\.?\s*O\.?\s*\.?\s*\/\s*\.?\s*A\.?\s*O\.?\b/gi, "सभी एस.ओ./ए.ओ."],
  // "(L. C.- IN - OUT)" — the office-note header marker (letter 45) reads
  // (एल.सी.-इन-आउट), never a half-Latin "(एल. C.- IN - OUT)".
  [/\bL\.?\s*C\.?\s*[-–—]+\s*IN\s*[-–—]+\s*OUT\b/gi, "एल.सी.-इन-आउट"],
  // ========================================================================
  // COMPREHENSIVE FORMAL LETTER SENTENCE PATTERNS
  // These regex patterns translate common English formal letter prose into
  // proper Hindi BEFORE word-by-word phonetic transliteration runs.
  // ========================================================================

  // --- Subject line patterns ---
  [/\bRequest\s+for\s+enhanced\s+security\s+measures\s+at\s+staff\s+quarters/gi, "कर्मचारी आवासों में संवर्धित सुरक्षा उपायों का अनुरोध"],
  [/\bRequest\s+for\s+enhanced\s+security/gi, "संवर्धित सुरक्षा का अनुरोध"],
  [/\bRequest\s+for\s+better\s+security/gi, "बेहतर सुरक्षा का अनुरोध"],
  [/\bRequest\s+for\s+security\s+measures/gi, "सुरक्षा उपायों का अनुरोध"],

  // --- Common opening sentences ---
  [/\bpresently\s+residing\s+at\s+the\s+above[- ]mentioned\s+quarters/gi, "वर्तमान में उपर्युक्त आवास में निवास कर रहा हूँ"],
  [/\bam\s+presently\s+residing/gi, "वर्तमान में निवास कर रहा हूँ"],

  // --- Conditional/temporal clauses ---
  [/\bHowever[,\s]+on\s+occasions\s+when/gi, "हालाँकि, जिन अवसरों पर"],
  [/\bthe\s+quarters\s+remain\s+unattended/gi, "आवास अविरक्त रहते हैं"],
  [/\bwithout\s+any\s+family\s+member\s+or\s+other\s+responsible\s+person\s+present/gi, "बिना किसी परिवार के सदस्य या अन्य जिम्मेदार व्यक्ति की उपस्थिति के"],
  [/\bwithout\s+any\s+family\s+member/gi, "बिना किसी परिवार के सदस्य के"],

  // --- Notice/attention sentences ---
  [/\bI\s+wish\s+to\s+bring\s+to\s+your\s+kind\s+notice\s+that/gi, "मैं आपकी संज्ञान में लाना चाहता हूँ कि"],
  [/\bI\s+wish\s+to\s+bring\s+to\s+your\s+kind\s+notice/gi, "मैं आपकी संज्ञान में लाना चाहता हूँ"],
  [/\bbring\s+to\s+your\s+kind\s+notice/gi, "आपकी संज्ञान में लाना"],

  // --- Theft/security incident sentences ---
  [/\bseveral\s+incidents\s+of\s+theft\s+have\s+reportedly\s+occurred/gi, "चोरी की कई घटनाएँ कथित रूप से घटित हुई हैं"],
  [/\bseveral\s+incidents\s+of\s+theft/gi, "चोरी की कई घटनाएँ"],
  [/\bincidents\s+of\s+theft/gi, "चोरी की घटनाएँ"],
  [/\breportedly\s+occurred/gi, "कथित रूप से घटित हुई हैं"],
  [/\blocated\s+in\s+the\s+vicinity\s+of\s+my\s+residence/gi, "मेरे आवास के निकटवर्ती क्षेत्र में स्थित"],
  [/\bin\s+the\s+vicinity\s+of\s+my\s+residence/gi, "मेरे आवास के निकटवर्ती क्षेत्र में"],
  [/\bin\s+the\s+recent\s+past/gi, "हाल के दिनों में"],

  // --- Dependency/safeguard sentences ---
  [/\bI\s+am\s+unable\s+to\s+depend\s+on\s+them/gi, "मैं उन पर निर्भर नहीं रह सकता"],
  [/\bduring\s+such\s+periods\s+of\s+absence/gi, "ऐसी अनुपस्थिति की अवधि में"],
  [/\bas\s+they\s+come\s+and\s+go\s+as\s+per\s+their\s+own\s+convenience/gi, "क्योंकि वे अपनी सुविधानुसार आते-जाते हैं"],
  [/\bare\s+under\s+no\s+obligation/gi, "कोई बाध्यता नहीं है"],
  [/\bparticularly\s+during\s+the\s+night\s+hours/gi, "विशेषकर रात्रि के समय"],

  // --- Request/action sentences ---
  [/\bIn\s+view\s+of\s+the\s+above/gi, "उपरोक्त के आलोक में"],
  [/\bI\s+would\s+request\s+that/gi, "मैं अनुरोध करता हूँ कि"],
  [/\bDeployment\s+of\s+a\s+night\s+security\s+guard/gi, "रात्रि सुरक्षा गार्ड की तैनाती"],
  [/\bInstallation\s+of\s+adequate\s+street\s+lighting/gi, "पर्याप्त सड़क प्रकाश व्यवस्था की स्थापना"],
  [/\bin\s+and\s+around\s+the\s+residential\s+blocks/gi, "आवासीय ब्लॉकों में और उसके आसपास"],

  // --- Gratitude/action sentences ---
  [/\bI\s+would\s+be\s+grateful\s+if/gi, "मैं कृतज्ञ हूँगा यदि"],
  [/\bat\s+the\s+earliest/gi, "यथाशीघ्र"],
  [/\btemporarily\s+away\s+from\s+their\s+quarters/gi, "अस्थायी रूप से अपने आवासों से दूर"],

  // --- Closing/copy-forward ---
  [/\bThanking\s+you/gi, "धन्यवाद"],
  [/\bCopy\s+forwarded\s+for\s+information\s+and\s+necessary\s+action/gi, "जानकारी एवं आवश्यक कार्रवाई हेतु प्रतिलिपि प्रेषित"],
  [/\bCopy\s+forwarded/gi, "प्रतिलिपि प्रेषित"],

  // --- Generic formal letter building blocks ---
  [/\bIt\s+has\s+been\s+ensured/gi, "यह सुनिश्चित किया गया है"],
  [/\bIt\s+is\s+to\s+inform\s+you\s+that/gi, "यह सूचित किया जाता है कि"],
  [/\bIt\s+is\s+to\s+inform\s+that/gi, "यह सूचित किया जाता है कि"],
  [/\bWith\s+reference\s+to\s+the\s+subject\s+cited\s+above/gi, "उपर्युक्त विषय के संदर्भ में"],
  [/\bWith\s+reference\s+to\s+your\s+letter/gi, "आपके पत्र के संदर्भ में"],
  [/\bplease\s+find\s+enclosed/gi, "कृपया संलग्न प्राप्त करें"],
  [/\bfor\s+ready\s+reference/gi, "त्वरित संदर्भ हेतु"],
  [/\bfor\s+necessary\s+action/gi, "आवश्यक कार्रवाई हेतु"],
  [/\bfor\s+kind\s+perusal/gi, "कृपया अवलोकन हेतु"],
  [/\bfor\s+information\s+and\s+necessary\s+action/gi, "जानकारी एवं आवश्यक कार्रवाई हेतु"],
  [/\bare\s+hereby\s+directed/gi, "यहाँ निर्देशित किया जाता है"],
  [/\bthe\s+undersigned/gi, "अधोहस्ताक्षरी"],
  [/\bthis\s+office/gi, "इस कार्यालय"],
  [/\bthe\s+above[- ]mentioned/gi, "उपर्युक्त"],
  [/\babove[- ]mentioned/gi, "उपर्युक्त"],
  [/\bin\s+accordance\s+with/gi, "के अनुसार"],
  [/\bin\s+compliance\s+with/gi, "के अनुपालन में"],
  [/\bshall\s+be\s+highly\s+appreciated/gi, "अत्यंत सराहनीय होगा"],
  [/\bwill\s+be\s+highly\s+appreciated/gi, "अत्यंत सराहनीय होगा"],

  // --- Common address-block patterns ---
  [/\bRegional\s+Office\s*[-–—]?\s*I/gi, "क्षेत्रीय कार्यालय - I"],
  [/\bRegional\s+Office/gi, "क्षेत्रीय कार्यालय"],
  [/\bEstate\s+Officer/gi, "एस्टेट अधिकारी"],
  [/\bRegional\s+Commissioner/gi, "क्षेत्रीय आयुक्त"],
  [/\bWest\s+Bengal/gi, "पश्चिम बंगाल"],
  [/\bBlock[- ]2[,\s]+Type[- ]2/gi, "ब्लॉक-2, टाइप-2"],
  [/\bQr\.\s*No\.?/gi, "क्वार्टर संख्या"],
];

/** Sentence-dictionary additions — reminder-register, extract and DLC lines. */
export const GLOSSARY_EXTRA: GlossaryEntry[] = [
  {
    // The 7-ALL OLD LETTER corpus — the extract-sentence name clause left as
    // its own line when the OCR recovery splits the member clause mid-name
    // (letter 114: "…in respect ofSmt. Devanti Pandey, CMPF A/C No- … as
    // desired."). {1} is the member name — transliterated by the reference
    // pass's name-group rule (देवंती पांडेय).
    en: "{1}, CMPF A/C No- {2} as desired.",
    tr: {
      Hindi: "{1}, सीएमपीएफ खाता संख्या- {2} के संबंध में।",
    },
  },
  {
    // The not-available L.C. table cell with the AREA captured — "L.C. is
    // Not available at Kenda Area (आरएनजे/24)" reads एल.सी. केंदा क्षेत्र
    // (आरएनजे/24) में उपलब्ध नहीं है; the area group is transliterated by
    // the reference pass.
    en: "L.C. is Not available at {1}",
    tr: {
      Hindi: "एल.सी. {1} में उपलब्ध नहीं है",
    },
  },
  {
    // The DLC office-note directive (33-FILE, ×1) — the numbered item's
    // sentence, matched after the "N. " list marker is peeled.
    en: "All Dealing Assistants for strict compliance",
    tr: {
      Hindi: "सभी प्रभारी सहायकों को सख्त अनुपालन हेतु",
    },
  },
  {
    // The DLC office-note requisition ledger lines (45-New Microsoft Word
    // Document, ×1) — "6. Letter No CPF/… Dated - … Received Form CMPFO
    // Talcher Regarding Requisition o f L.C. in R/o Sri … CMPF A/c No - …".
    // {3} is the forwarding office, {4} the member, {5} the account code;
    // names/codes are refined into Devanagari by the reference pass.
    en: "Letter No {1} Dated - {2} Received Form {3} Regarding Requisition o f L.C. in R/o {4} CMPF A/c No - {5}",
    tr: {
      Hindi: "पत्र संख्या {1} दिनांक {2}, {3} से प्राप्त, {4} (सीएमपीएफ खाता संख्या- {5}) के संबंध में एल.सी. की मांग।",
    },
  },
  {
    en: "Letter No {1} Dated - {2} Received Form {3} Regarding Requisition o f Extract in R/o {4} CMPF A/c No - {5}",
    tr: {
      Hindi: "पत्र संख्या {1} दिनांक {2}, {3} से प्राप्त, {4} (सीएमपीएफ खाता संख्या- {5}) के संबंध में उद्धरण (एक्सट्रैक्ट) की मांग।",
    },
  },
  {
    // The FULL DLC office-note ledger line (45-New Microsoft Word Document,
    // ×1) — the "Placed Here … Signature Please." tail rides on the same
    // baseline as the requisition sentence (letter 45's line 6). The tail
    // must be part of the pattern or the anchored matcher misses the whole
    // line. {3} is the forwarding office, {4} the member, {5} the account
    // code; names/codes are refined into Devanagari by the reference pass.
    en: "Letter No {1} Dated - {2} Received From {3} Regarding Requisition of L.C. in R/o {4} CMPF A/c No - {5} Placed Here with My Kindly Be Seen Now L.C. By Concerned D-Asst Submitted In, out Section Accordingly Forwarding Letter of Same is Prepared and Put Up for Signature Please.",
    tr: {
      Hindi: "पत्र संख्या {1} दिनांक {2}, {3} से प्राप्त। {4} (सीएमपीएफ खाता संख्या- {5}) के संबंध में एल.सी. की मांग हेतु यह पत्र मेरे समक्ष रखा गया। कृपया अवलोकन करें। एल.सी. संबंधित डी-असिस्टेंट द्वारा तैयार कर इन-आउट अनुभाग में प्रस्तुत की गई। तदनुसार उसी का अग्रेषण पत्र तैयार कर हस्ताक्षर हेतु प्रस्तुत किया जाता है।",
    },
  },
  {
    // The full EXTRACT variant (line 7) — the extract is prepared by the
    // concerned D-Asst, authenticated by the S.O., and submitted in the
    // Extract In-Out section. {5} carries both members' account clauses when
    // the line lists two ("…RNJ/29/940 And Sri Rabindra Singh. CMPF A/c
    // No- RNJ/29/801") — the reference pass refines the whole clause.
    en: "Letter No {1} Dated - {2} Received From {3} Regarding Requisition of Extract in R/o {4} CMPF A/c No - {5} Placed Here with My Kindly Be Seen Now Extract Prepared by Concerned D-Asst as well as Authenticated By S/o Submitted in Extract in, out Section Accordingly Forwarding Letter of Same is Prepared and Put Up for Signature Please.",
    tr: {
      Hindi: "पत्र संख्या {1} दिनांक {2}, {3} से प्राप्त। {4} (सीएमपीएफ खाता संख्या- {5}) के संबंध में उद्धरण (एक्सट्रैक्ट) की मांग हेतु यह पत्र मेरे समक्ष रखा गया। कृपया अवलोकन करें। उद्धरण (एक्सट्रैक्ट) संबंधित डी-असिस्टेंट द्वारा तैयार किया गया तथा एस.ओ. द्वारा प्रमाणित कर इन-आउट अनुभाग में प्रस्तुत किया गया। तदनुसार उसी का अग्रेषण पत्र तैयार कर हस्ताक्षर हेतु प्रस्तुत किया जाता है।",
    },
  },

  {
    // The CMPF Extract-Out body with the WHOLE member clause captured — the
    // scanned letters vary the honorific (Shri / Shrimati / Smt. / Mr.) and
    // OCR-split it, so the whole \"<name>, CMPF A/C No- <acct>\" capture is
    // refined into Devanagari by the reference-standard pass afterwards.
    en: "On the subject and reference cited above, please find enclosed herewith the extract in respect of {1} as desired.",
    tr: {
      Hindi: "उपरोक्त विषय एवं संदर्भ के आलोक में, {1} के संबंध में संलग्न उद्धरण (एक्सट्रैक्ट) आपके अवलोकनार्थ प्रेषित है।",
      Tamil: "மேற்கூறிய விஷயம் மற்றும் குறிப்பின் பார்வையில், {1} தொடர்பாக இணைக்கப்பட்ட சாற்றெடுப்பு (எக்ஸ்ட்ராக்ட்) உங்கள் பார்வைக்காக அனுப்பப்படுகிறது.",
      Bengali: "উপরোক্ত বিষয় ও সূত্রের প্রেক্ষিতে, {1} সম্পর্কে সংযুক্ত উদ্ধৃতি (এক্সট্রাক্ট) আপনার অবলোকনের জন্য প্রেরণ করা হলো।",
      Telugu: "పై విషయం మరియు సూచన దృష్ట్యా, {1} గురించి జోడించిన సారాంశం (ఎక్స్ట్రాక్ట్) మీ పరిశీలన కోసం పంపబడింది.",
      Kannada: "ಮೇಲಿನ ವಿಷಯ ಮತ್ತು ಉಲ್ಲೇಖದ ದೃಷ್ಟಿಯಿಂದ, {1} ಕುರಿತು ಲಗತ್ತಿಸಲಾದ ಸಾರ (ಎಕ್ಸ್ಟ್ರಾಕ್ಟ್) ನಿಮ್ಮ ಪರಿಶೀಲನೆಗಾಗಿ ಕಳುಹಿಸಲಾಗಿದೆ.",
      Gujarati: "ઉપરોક્ત વિષય અને સંદર્ભના આલોકમાં, {1} સંબંધિત જોડાયેલ અવતરણ (એક્સટ્રેક્ટ) તમારા અવલોકન માટે મોકલવામાં આવે છે.",
      Marathi: "वरील विषय आणि संदर्भाच्या अनुषंगाने, {1} संबंधी संलग्न उतारा (एक्सट्रॅक्ट) आपल्या अवलोकनासाठी पाठविला जात आहे.",
      Spanish: "En virtud del asunto y la referencia antes citados, se remite para su consideración el extracto adjunto relativo a {1}.",
      French: "Au vu de l'objet et de la référence susmentionnés, l'extrait ci-joint relatif à {1} est transmis pour votre examen.",
      Arabic: "على ضوء الموضوع والمرجع المذكورين أعلاه، تُرفق نسخة مستخرجة خاصة بـ {1} للإطلاع عليها.",
    },
  },
  {
    // The multi-member Extract-Out line 1 — the list continues on the next
    // lines, so no \"as desired.\" tail on this template.
    en: "On the subject and reference cited above, please find enclosed herewith the extract in respect of {1}",
    tr: {
      Hindi: "उपरोक्त विषय एवं संदर्भ के आलोक में, {1} के संबंध में संलग्न उद्धरण (एक्सट्रैक्ट) प्रेषित है:",
      Tamil: "மேற்கூறிய விஷயம் மற்றும் குறிப்பின் பார்வையில், {1} தொடர்பாக இணைக்கப்பட்ட சாற்றெடுப்பு (எக்ஸ்ட்ராக்ட்) அனுப்பப்படுகிறது:",
      Bengali: "উপরোক্ত বিষয় ও সূত্রের প্রেক্ষিতে, {1} সম্পর্কে সংযুক্ত উদ্ধৃতি (এক্সট্রাক্ট) প্রেরণ করা হলো:",
      Telugu: "పై విషయం మరియు సూచన దృష్ట్యా, {1} గురించి జోడించిన సారాంశం (ఎక్స్ట్రాక్ట్) పంపబడింది:",
      Kannada: "ಮೇಲಿನ ವಿಷಯ ಮತ್ತು ಉಲ್ಲೇಖದ ದೃಷ್ಟಿಯಿಂದ, {1} ಕುರಿತು ಲಗತ್ತಿಸಲಾದ ಸಾರ (ಎಕ್ಸ್ಟ್ರಾಕ್ಟ್) ಕಳುಹಿಸಲಾಗಿದೆ:",
      Gujarati: "ઉપરોક્ત વિષય અને સંદર્ભના આલોકમાં, {1} સંબંધિત જોડાયેલ અવતરણ (એક્સટ્રેક્ટ) મોકલવામાં આવે છે:",
      Marathi: "वरील विषय आणि संदर्भाच्या अनुषंगाने, {1} संबंधी संलग्न उतारा (एक्सट्रॅक्ट) पाठविला जात आहे:",
      Spanish: "En virtud del asunto y la referencia antes citados, se remite el extracto adjunto relativo a {1}:",
      French: "Au vu de l'objet et de la référence susmentionnés, l'extrait ci-joint relatif à {1} est transmis:",
      Arabic: "على ضوء الموضوع والمرجع المذكورين أعلاه، تُرفق نسخة مستخرجة خاصة بـ {1}:",
    },
  },
  {
    // Reminder-register body 1 — the ledger card is still awaited.
    en: "With reference to the subject cited above it is to inform that the demanded ledger card vide this office letter dated {1} is still awaited from your end (copy enclosed).",
    tr: {
      Hindi: "ऊपर उद्धृत विषय के संदर्भ में, यह सूचित किया जाता है कि इस कार्यालय पत्र दिनांक {1} के माध्यम से मांगा गया लेजर कार्ड अभी भी आपके यहाँ से प्राप्त नहीं हुआ है (प्रति संलग्न)।",
      Tamil: "மேற்கூறிய விஷயத்தைக் குறித்து, இந்த அலுவலக கடிதம் தேதி {1} மூலம் கோரப்பட்ட லெட்ஜர் அட்டை இன்னும் உங்களிடமிருந்து பெறப்படவில்லை எனத் தெரிவிக்கப்படுகிறது (நகல் இணைக்கப்பட்டுள்ளது).",
      Bengali: "উপরোক্ত বিষয়ের প্রেক্ষিতে জানানো হচ্ছে যে, এই কার্যালয় পত্র তারিখ {1} এর মাধ্যমে চাওয়া লেজার কার্ডটি এখনও আপনার কাছ থেকে পাওয়া যায়নি (কপি সংযুক্ত)।",
      Telugu: "పై విషయం గురించి, ఈ కార్యాలయ లేఖ తేదీ {1} ద్వారా కోరిన లెడ్జర్ కార్డ్ ఇంకా మీ నుండి అందలేదని తెలియజేయబడుతుంది (కాపీ జోడించబడింది).",
      Kannada: "ಮೇಲಿನ ವಿಷಯದ ಕುರಿತು, ಈ ಕಚೇರಿ ಪತ್ರ ದಿನಾಂಕ {1} ಮೂಲಕ ಕೋರಿದ ಲೆಡ್ಜರ್ ಕಾರ್ಡ್ ಇನ್ನೂ ನಿಮ್ಮಿಂದ ಸ್ವೀಕರಿಸಲಾಗಿಲ್ಲ ಎಂದು ತಿಳಿಸಲಾಗುತ್ತದೆ (ನಕಲು ಲಗತ್ತಿಸಲಾಗಿದೆ).",
      Gujarati: "ઉપરોક્ત વિષયના સંદર્ભમાં, આ કાર્યાલય પત્ર તારીખ {1} દ્વારા માંગવામાં આવેલ લેજર કાર્ડ હજુ પણ તમારી પાસેથી પ્રાપ્ત થયું નથી તે જાણ કરવામાં આવે છે (નકલ સંલગ્ન).",
      Marathi: "वरील विषयाच्या संदर्भात, या कार्यालयीन पत्र दिनांक {1} द्वारे मागितलेले लेजर कार्ड अद्याप तुमच्याकडून प्राप्त झालेले नाही, असे कळविले जाते (प्रत संलग्न).",
      Spanish: "Con referencia al asunto citado, se informa que la tarjeta de contabilidad solicitada mediante la carta de esta oficina de fecha {1} sigue pendiente de recibir (copia adjunta).",
      French: "Par référence à l'objet susmentionné, il est porté à votre connaissance que la carte de compte demandée par la lettre de ce bureau en date du {1} n'est toujours pas reçue (copie jointe).",
      Arabic: "بالإشارة إلى الموضوع المذكور أعلاه، يُعلم أن بطاقة الحساب المطلوبة بموجب خطاب هذا المكتب بتاريخ {1} لم يتم استلامها بعد (مرفقة نسخة).",
    },
  },
  {
    // Reminder-register body 2 — please supply the ledger card.
    en: "It is therefore, requested to supply the demanded ledger card of the member detailed below at the earliest.",
    tr: {
      Hindi: "अतः, नीचे विवरणित सदस्य का मांगा गया लेजर कार्ड शीघ्रातिशीघ्र उपलब्ध कराने का अनुरोध किया जाता है।",
      Tamil: "எனவே, கீழே விவரிக்கப்பட்டுள்ள உறுப்பினரின் கோரப்பட்ட லெட்ஜர் அட்டையை விரைவில் வழங்குமாறு கேட்டுக்கொள்ளப்படுகிறது.",
      Bengali: "অতএব, নীচে বর্ণিত সদস্যের চাওয়া লেজার কার্ডটি যথাশীঘ্র সম্ভব সরবরাহ করার অনুরোধ করা হচ্ছে।",
      Telugu: "కావున, క్రింద వివరించిన సభ్యుని కోరిన లెడ్జర్ కార్డును వీలైనంత త్వరగా అందించమని కోరబడుతుంది.",
      Kannada: "ಆದ್ದರಿಂದ, ಕೆಳಗೆ ವಿವರಿಸಿದ ಸದಸ್ಯರ ಕೋರಿದ ಲೆಡ್ಜರ್ ಕಾರ್ಡ್ ಅನ್ನು ಸಾಧ್ಯವಾದಷ್ಟು ಬೇಗ ಒದಗಿಸುವಂತೆ ವಿನಂತಿಸಲಾಗುತ್ತದೆ.",
      Gujarati: "તેથી, નીચે વર્ણવેલ સભ્યનું માંગેલ લેજર કાર્ડ શક્ય તેટલી વહેલી ઉપલબ્ધ કરાવવાની વિનંતી કરવામાં આવે છે.",
      Marathi: "म्हणून, खाली नमूद केलेल्या सदस्याचे मागितलेले लेजर कार्ड शक्य तितक्या लवकर उपलब्ध करून देण्याची विनंती करण्यात येते.",
      Spanish: "Se solicita, por tanto, que se facilite a la mayor brevedad la tarjeta de contabilidad solicitada del miembro que se detalla a continuación.",
      French: "Il est par conséquent demandé de fournir dans les plus brefs délais la carte de compte demandée du membre détaillé ci-dessous.",
      Arabic: "ولذلك، يرجى توفير بطاقة الحساب المطلوبة للعضو المذكور أدناه في أقرب وقت ممكن.",
    },
  },
  {
    // Reminder-register body 3 — cards already transferred out of the Region.
    en: "In case, the Ledger Card(s) already transferred from your Region, the Region to whom transferred, indicating the details of transfer and your letter number and date.",
    tr: {
      Hindi: "यदि लेजर कार्ड आपके क्षेत्र से पहले ही स्थानांतरित कर दिए गए हों, तो जिस क्षेत्र को स्थानांतरित किए गए हैं, स्थानांतरण के विवरण तथा आपके पत्र की संख्या एवं दिनांक की सूचना दी जाए।",
      Tamil: "லெட்ஜர் அட்டைகள் ஏற்கனவே உங்கள் பிராந்தியத்திலிருந்து மாற்றப்பட்டிருந்தால், மாற்றப்பட்ட பிராந்தியம், மாற்றத்தின் விவரங்கள் மற்றும் உங்கள் கடித எண் மற்றும் தேதி ஆகியவற்றைத் தெரிவிக்கவும்.",
      Bengali: "লেজার কার্ড(গুলি) ইতিমধ্যে আপনার অঞ্চল থেকে স্থানান্তরিত হয়ে থাকলে, যে অঞ্চলে স্থানান্তরিত হয়েছে, স্থানান্তরের বিবরণ এবং আপনার পত্রের নম্বর ও তারিখ জানানো হোক।",
      Telugu: "లెడ్జర్ కార్డ్(లు) ఇప్పటికే మీ ప్రాంతం నుండి బదిలీ చేయబడి ఉంటే, బదిలీ చేసిన ప్రాంతం, బదిలీ వివరాలు మరియు మీ లేఖ సంఖ్య మరియు తేదీని తెలియజేయండి.",
      Kannada: "ಲೆಡ್ಜರ್ ಕಾರ್ಡ್(ಗಳು) ಈಗಾಗಲೇ ನಿಮ್ಮ ಪ್ರದೇಶದಿಂದ ವರ್ಗಾವಣೆಯಾಗಿದ್ದರೆ, ವರ್ಗಾವಣೆಯಾದ ಪ್ರದೇಶ, ವರ್ಗಾವಣೆಯ ವಿವರಗಳು ಮತ್ತು ನಿಮ್ಮ ಪತ್ರ ಸಂಖ್ಯೆ ಮತ್ತು ದಿನಾಂಕವನ್ನು ತಿಳಿಸಿ.",
      Gujarati: "લેજર કાર્ડ(ઓ) પહેલેથી જ તમારા પ્રદેશમાંથી સ્થાનાંતરિત કરવામાં આવ્યા હોય, તો જે પ્રદેશમાં સ્થાનાંતરિત કરવામાં આવ્યા છે, સ્થાનાંતરણની વિગતો તથા તમારા પત્રનો નંબર અને તારીખ જાણ કરવી જોઈએ.",
      Marathi: "लेजर कार्ड(चे) आधीच तुमच्या प्रदेशातून हस्तांतरित केले गेले असल्यास, ज्या प्रदेशात हस्तांतरित केले आहेत, हस्तांतरणाचे तपशील तसेच तुमच्या पत्राचा क्रमांक आणि दिनांक कळवावा.",
      Spanish: "En caso de que la(s) tarjeta(s) de contabilidad ya se hayan transferido desde su Región, indíquese la Región a la que se transfirieron, con los detalles de la transferencia y el número y fecha de su carta.",
      French: "Si la ou les cartes de compte ont déjà été transférées de votre Région, veuillez indiquer la Région à laquelle elles ont été transférées, avec les détails du transfert ainsi que le numéro et la date de votre lettre.",
      Arabic: "في حال كانت بطاقات الحساب قد حوّلت بالفعل من منطقتكم، فيرجى بيان المنطقة التي حوّلت إليها مع تفاصيل التحويل ورقم وتاريخ خطابكم.",
    },
  },
  {
    // Reminder-register body 4 — no response received.
    en: "Regrettably, despite sending two prior letters on this subject, I have received no acknowledgment or response from your organization.",
    tr: {
      Hindi: "खेद है कि इस विषय पर दो पूर्व पत्र भेजने के बावजूद, मुझे आपके संगठन से कोई स्वीकृति या प्रतिक्रिया प्राप्त नहीं हुई है।",
      Tamil: "வருத்தத்துடன் தெரிவிக்கப்படுகிறது, இந்த விஷயத்தில் இரண்டு முந்தைய கடிதங்களை அனுப்பிய போதிலும், உங்கள் அமைப்பிடமிருந்து எந்த ஒப்புதலும் பதிலும் பெறப்படவில்லை.",
      Bengali: "খেদের বিষয়, এই বিষয়ে দুটি পূর্ববর্তী পত্র পাঠানো সত্ত্বেও, আপনার সংস্থা থেকে কোনো স্বীকৃতি বা প্রতিক্রিয়া পাওয়া যায়নি।",
      Telugu: "విచారకరమైన విషయం ఏమిటంటే, ఈ విషయంపై రెండు మునుపటి లేఖలు పంపినప్పటికీ, మీ సంస్థ నుండి ఎటువంటి అంగీకారం లేదా ప్రతిస్పందన అందలేదు.",
      Kannada: "ವಿಷಾದಕರವಾಗಿ, ಈ ವಿಷಯದ ಬಗ್ಗೆ ಎರಡು ಹಿಂದಿನ ಪತ್ರಗಳನ್ನು ಕಳುಹಿಸಿದರೂ, ನಿಮ್ಮ ಸಂಸ್ಥೆಯಿಂದ ಯಾವುದೇ ದೃಢೀಕರಣ ಅಥವಾ ಪ್ರತಿಕ್ರಿಯೆ ಸ್ವೀಕರಿಸಲಾಗಿಲ್ಲ.",
      Gujarati: "ખેદ સાથે જણાવવામાં આવે છે કે, આ વિષય પર બે પૂર્વ પત્રો મોકલવા છતાં, તમારી સંસ્થા તરફથી કોઈ સ્વીકૃતિ કે પ્રતિસાદ પ્રાપ્ત થયો નથી.",
      Marathi: "खेदाची बाब म्हणजे, या विषयावर दोन पूर्व पत्रे पाठवूनही, तुमच्या संस्थेकडून कोणतीही कबुली किंवा प्रतिसाद प्राप्त झालेला नाही.",
      Spanish: "Lamentablemente, a pesar de haber enviado dos cartas anteriores sobre este asunto, no he recibido acuse de recibo ni respuesta de su organización.",
      French: "Malheureusement, malgré l'envoi de deux lettres antérieures à ce sujet, je n'ai reçu aucun accusé de réception ni réponse de votre organisation.",
      Arabic: "لسوء الحظ، على الرغم من إرسال خطابين سابقين بهذا الشأن، لم أتلق أي إشعار أو رد من مؤسستكم.",
    },
  },
  {
    // Reminder-register body 5 — escalation notice.
    en: "Consequently, please take notice that should this matter remain unaddressed, I will be obligated to endorse a copy of all future correspondence to the Commissioner.",
    tr: {
      Hindi: "अतः, कृपया ध्यान दें कि यदि यह मामला अनसुलझा रहा, तो मैं भविष्य के सभी पत्राचार की एक प्रति आयुक्त को भेजने के लिए बाध्य होऊँगा।",
      Tamil: "எனவே, தயவுசெய்து கவனிக்கவும், இந்த விஷயம் தீர்க்கப்படாமல் இருந்தால், எதிர்கால கடிதங்கள் அனைத்தின் நகலையும் ஆணையருக்கு அனுப்ப நான் கடமைப்பட்டிருப்பேன்.",
      Bengali: "অতএব, অনুগ্রহ করে লক্ষ্য করুন, যদি এই বিষয়টি অমীমাংসিত থাকে, তাহলে আমি ভবিষ্যতের সমস্ত পত্রাচারের একটি কপি কমিশনারকে পাঠাতে বাধ্য হব।",
      Telugu: "కావున, దయచేసి గమనించండి, ఈ విషయం పరిష్కరించబడకపోతే, భవిష్యత్తులో జరిగే అన్ని ఉత్తర ప్రత్యుత్తరాల కాపీని కమిషనర్కు పంపడానికి నేను బాధ్యత వహించాల్సి ఉంటుంది.",
      Kannada: "ಆದ್ದರಿಂದ, ದಯವಿಟ್ಟು ಗಮನಿಸಿ, ಈ ವಿಷಯವು ಬಗೆಹರಿಯದೆ ಉಳಿದರೆ, ಭವಿಷ್ಯದ ಎಲ್ಲಾ ಪತ್ರವ್ಯವಹಾರಗಳ ಪ್ರತಿಯನ್ನು ಆಯುಕ್ತರಿಗೆ ಕಳುಹಿಸಲು ನಾನು ಬದ್ಧನಾಗಿರುತ್ತೇನೆ.",
      Gujarati: "તેથી, કૃપા કરીને નોંધ લો કે, જો આ બાબત અનસુલઝી રહેશે, તો હું ભવિષ્યના તમામ પત્રવ્યવહારની એક નકલ કમિશનરને મોકલવા બાધ્ય થઈશ.",
      Marathi: "म्हणून, कृपया नोंद घ्यावी की, ही बाब अनिर्णीत राहिल्यास, मी भविष्यातील सर्व पत्रव्यवहाराची एक प्रत आयुक्तांकडे पाठविण्यास बाध्य असेल.",
      Spanish: "En consecuencia, sírvanse tener presente que, si este asunto sigue sin resolverse, me veré obligado a remitir una copia de toda la correspondencia futura al Comisionado.",
      French: "En conséquence, veuillez noter que, si cette affaire reste sans suite, je serai obligé de transmettre une copie de toute la correspondance future au Commissaire.",
      Arabic: "وبناءً عليه، يرجى ملاحظة أنه إذا بقي هذا الأمر دون معالجة، فسأكون ملزماً بإرسال نسخة من جميع المراسلات المستقبلية إلى المفوض.",
    },
  },
  {
    // Reminder-register body 6 — Extract still awaited (the Extract family).
    en: "With reference to the subject cited above, it is regretted to inform that the Extract demanded vide our letter dated {1} is still awaited from your end (copy enclosed).",
    tr: {
      Hindi: "ऊपर उद्धृत विषय के संदर्भ में, यह खेद के साथ सूचित किया जाता है कि हमारे पत्र दिनांक {1} के माध्यम से मांगा गया एक्सट्रैक्ट अभी भी आपके यहाँ से प्राप्त नहीं हुआ है (प्रति संलग्न)।",
      Tamil: "மேற்கூறிய விஷயத்தைக் குறித்து, எங்கள் கடிதம் தேதி {1} மூலம் கோரப்பட்ட சாற்றெடுப்பு இன்னும் உங்களிடமிருந்து பெறப்படவில்லை என வருத்தத்துடன் தெரிவிக்கப்படுகிறது (நகல் இணைக்கப்பட்டுள்ளது).",
      Bengali: "উপরোক্ত বিষয়ের প্রেক্ষিতে, আমাদের পত্র তারিখ {1} এর মাধ্যমে চাওয়া এক্সট্রাক্টটি এখনও আপনার কাছ থেকে পাওয়া যায়নি বলে খেদের সাথে জানানো হচ্ছে (কপি সংযুক্ত)।",
      Telugu: "పై విషయం గురించి, మా లేఖ తేదీ {1} ద్వారా కోరిన సారాంశం ఇంకా మీ నుండి అందలేదని విచారంతో తెలియజేయబడుతుంది (కాపీ జోడించబడింది).",
      Kannada: "ಮೇಲಿನ ವಿಷಯದ ಕುರಿತು, ನಮ್ಮ ಪತ್ರ ದಿನಾಂಕ {1} ಮೂಲಕ ಕೋರಿದ ಸಾರವು ಇನ್ನೂ ನಿಮ್ಮಿಂದ ಸ್ವೀಕರಿಸಲಾಗಿಲ್ಲ ಎಂದು ವಿಷಾದದೊಂದಿಗೆ ತಿಳಿಸಲಾಗುತ್ತದೆ (ನಕಲು ಲಗತ್ತಿಸಲಾಗಿದೆ).",
      Gujarati: "ઉપરોક્ત વિષયના સંદર્ભમાં, અમારા પત્ર તારીખ {1} દ્વારા માંગવામાં આવેલ એક્સટ્રેક્ટ હજુ પણ તમારી પાસેથી પ્રાપ્ત થયો નથી તે ખેદ સાથે જાણ કરવામાં આવે છે (નકલ સંલગ્ન).",
      Marathi: "वरील विषयाच्या संदर्भात, आमच्या पत्र दिनांक {1} द्वारे मागितलेला उतारा अद्याप तुमच्याकडून प्राप्त झालेला नाही, असे खेदाने कळविले जाते (प्रत संलग्न).",
      Spanish: "Con referencia al asunto citado, lamentamos informar que el extracto solicitado mediante nuestra carta de fecha {1} sigue pendiente de recibir (copia adjunta).",
      French: "Par référence à l'objet susmentionné, il est regretté de vous informer que l'extrait demandé par notre lettre en date du {1} n'est toujours pas reçu (copie jointe).",
      Arabic: "بالإشارة إلى الموضوع المذكور أعلاه، نأسف لإعلامكم بأن النسخة المستخرجة المطلوبة بموجب خطابنا بتاريخ {1} لم يتم استلامها بعد (مرفقة نسخة).",
    },
  },
  {
    // Reminder-register body 7 — provide the Extract to post the contribution.
    en: "It is therefore, once again requested to provide the Extract at the earliest so as to enable this office to post the contribution on the individual ledger card.",
    tr: {
      Hindi: "अतः, इस कार्यालय द्वारा व्यक्तिगत लेजर कार्ड पर अंशदान अंकित करने हेतु एक्सट्रैक्ट शीघ्रातिशीघ्र उपलब्ध कराने का पुनः अनुरोध किया जाता है।",
      Tamil: "எனவே, தனிப்பட்ட லெட்ஜர் அட்டையில் பங்களிப்பைப் பதிவு செய்ய இந்த அலுவலகத்திற்கு உதவும் வகையில், சாற்றெடுப்பை விரைவில் வழங்க மீண்டும் கேட்டுக்கொள்ளப்படுகிறது.",
      Bengali: "অতএব, ব্যক্তিগত লেজার কার্ডে অবদান জমা করতে এই কার্যালয়কে সক্ষম করার জন্য এক্সট্রাক্টটি যথাশীঘ্র সম্ভব প্রদান করার পুনরায় অনুরোধ করা হচ্ছে।",
      Telugu: "కావున, వ్యక్తిగత లెడ్జర్ కార్డుపై విరాళాన్ని నమోదు చేయడానికి ఈ కార్యాలయాన్ని అనుమతించేందుకు సారాంశాన్ని వీలైనంత త్వరగా అందించమని మరోసారి కోరబడుతుంది.",
      Kannada: "ಆದ್ದರಿಂದ, ವೈಯಕ್ತಿಕ ಲೆಡ್ಜರ್ ಕಾರ್ಡ್‌ನಲ್ಲಿ ಕೊಡುಗೆಯನ್ನು ನಮೂದಿಸಲು ಈ ಕಚೇರಿಗೆ ಅನುವು ಮಾಡಿಕೊಡಲು ಸಾರವನ್ನು ಸಾಧ್ಯವಾದಷ್ಟು ಬೇಗ ಒದಗಿಸುವಂತೆ ಮತ್ತೊಮ್ಮೆ ವಿನಂತಿಸಲಾಗುತ್ತದೆ.",
      Gujarati: "તેથી, વ્યક્તિગત લેજર કાર્ડ પર અંશદાન નોંધવા માટે આ કાર્યાલયને સક્ષમ બનાવવા એક્સટ્રેક્ટ શક્ય તેટલી વહેલી ઉપલબ્ધ કરાવવાની ફરી વિનંતી કરવામાં આવે છે.",
      Marathi: "म्हणून, वैयक्तिक लेजर कार्डवर अंशदान नोंदविण्यास या कार्यालयाला सक्षम करण्यासाठी उतारा शक्य तितक्या लवकर उपलब्ध करून देण्याची पुन्हा विनंती करण्यात येते.",
      Spanish: "Se solicita, por tanto, una vez más, que se facilite el extracto a la mayor brevedad para que esta oficina pueda registrar la contribución en la tarjeta de contabilidad individual.",
      French: "Il est par conséquent demandé, une fois encore, de fournir l'extrait dans les plus brefs délais afin de permettre à ce bureau d'inscrire la cotisation sur la carte de compte individuelle.",
      Arabic: "ولذلك، يُرجى مرة أخرى توفير النسخة المستخرجة في أقرب وقت ممكن لتمكين هذا المكتب من تسجيل الاشتراك على بطاقة الحساب الفردية.",
    },
  },
  {
    // The DLC-camp office note (LETTER(SIBA)4 family).
    en: "Office Note",
    tr: { Hindi: "कार्यालय नोट" },
  },
  {
    en: "In continuation to this office's DLC Campaign 4.0 Schedule and in partial modification of the earlier order regarding deployment of staff for the camps scheduled on",
    tr: { Hindi: "इस कार्यालय की डीएलसी अभियान 4.0 अनुसूची की निरंतरता में तथा निर्धारित शिविरों हेतु कर्मचारियों की तैनाती संबंधी पूर्व आदेश में आंशिक संशोधन करते हुए" },
  },
  {
    en: "19.11.2025, 20.11.2025 and 24.11.2025, the competent authority has approved the replacement of the earlier nominated team of officials.",
    tr: { Hindi: "दिनांक 19.11.2025, 20.11.2025 एवं 24.11.2025 को आयोजित शिविरों हेतु पूर्व में नामित अधिकारियों की टीम के प्रतिस्थापन को सक्षम प्राधिकारी ने स्वीकृति प्रदान की है।" },
  },
  {
    en: "Accordingly, the following officials are hereby nominated to conduct and facilitate the Digital Life Certificate (DLC) Camps on the dates mentioned below:",
    tr: { Hindi: "तदनुसार, निम्नलिखित अधिकारियों को नीचे उल्लिखित तिथियों पर डिजिटल जीवन प्रमाण पत्र (डीएलसी) शिविरों के संचालन एवं सुविधा हेतु नामित किया जाता है:" },
  },
  {
    en: "The above officials are directed to attend the respective venues on the scheduled dates and ensure smooth organization of the DLC camps.",
    tr: { Hindi: "उपरोक्त अधिकारियों को निर्देशित किया जाता है कि वे निर्धारित तिथियों पर संबंधित स्थानों पर उपस्थित रहें तथा डीएलसी शिविरों का सुचारू आयोजन सुनिश्चित करें।" },
  },
  {
    en: "All concerned are informed accordingly.",
    tr: { Hindi: "सभी संबंधितों को तदनुसार सूचित किया जाता है।" },
  },
  {
    // The DLC note's second paragraph fused with the third ("…below: The
    // above officials…") — the extraction joins them on one line when the
    // colon carries the wrap.
    en: "Accordingly, the following officials are hereby nominated to conduct and facilitate the Digital Life Certificate (DLC) Camps on the dates mentioned below: The above officials are directed to attend the respective venues on the scheduled dates and ensure smooth organization of the DLC camps.",
    tr: {
      Hindi: "तदनुसार, निम्नलिखित अधिकारियों को नीचे उल्लिखित तिथियों पर डिजिटल जीवन प्रमाण पत्र (डीएलसी) शिविरों के संचालन एवं सुविधा हेतु नामित किया जाता है: उपरोक्त अधिकारियों को निर्देशित किया जाता है कि वे निर्धारित तिथियों पर संबंधित स्थानों पर उपस्थित रहें तथा डीएलसी शिविरों का सुचारू आयोजन सुनिश्चित करें।",
    },
  },
  {
    // Same fused pair with the note's own letterhead address block captured
    // (the (NEW-1) letters glue "Add : … E-mail : …" between the two
    // sentences); the address rides as its own segment in the output.
    en: "Accordingly, the following officials are hereby nominated to conduct and facilitate the Digital Life Certificate (DLC) Camps on the dates mentioned below: {1} The above officials are directed to attend the respective venues on the scheduled dates and ensure smooth organization of the DLC camps.",
    tr: {
      Hindi: "तदनुसार, निम्नलिखित अधिकारियों को नीचे उल्लिखित तिथियों पर डिजिटल जीवन प्रमाण पत्र (डीएलसी) शिविरों के संचालन एवं सुविधा हेतु नामित किया जाता है: {1} उपरोक्त अधिकारियों को निर्देशित किया जाता है कि वे निर्धारित तिथियों पर संबंधित स्थानों पर उपस्थित रहें तथा डीएलसी शिविरों का सुचारू आयोजन सुनिश्चित करें।",
    },
  },
  {
    // The L.C.-out opening as the ASANSOL / REGIONAL-OFFICE letters phrase it
    // — SINGLE member ("the Ledger Card of the following member is forwarded
    // to your office as he is working under jurisdiction of your region"),
    // with the date glued to the label by a dash ("Dated-12/02/1973"). This
    // is the L.C.-out family twin of the "under mentioned members" entries;
    // the reference Hindi reads निम्नलिखित सदस्य का लेजर कार्ड.
    en: "In view of the revised Procedure prescribed in Procedure Office Order No-{1} Dated-{2} of CMPF Commissioner, Dhanbad, I am to state that the Ledger Card of the following member is forwarded to your office as he is working under jurisdiction of your region.",
    tr: {
      Hindi: "सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-{1} दिनांक-{2} में निर्धारित संशोधित प्रक्रिया के दृष्टिगत, मुझे यह कहना है कि चूँकि वह आपके क्षेत्र के अधिकार क्षेत्र में कार्यरत है, निम्नलिखित सदस्य का लेजर कार्ड आपके कार्यालय को अग्रेषित किया जा रहा है।",
    },
  },
  {
    // The same single-member L.C.-out opening with the space-date form
    // ("dated 12/02/1973" — the printed letters alternate the separator).
    en: "In view of the revised Procedure prescribed in Procedure Office Order No-{1} dated {2} of CMPF Commissioner, Dhanbad, I am to state that the Ledger Card of the following member is forwarded to your office as he is working under jurisdiction of your region.",
    tr: {
      Hindi: "सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-{1} दिनांक-{2} में निर्धारित संशोधित प्रक्रिया के दृष्टिगत, मुझे यह कहना है कि चूँकि वह आपके क्षेत्र के अधिकार क्षेत्र में कार्यरत है, निम्नलिखित सदस्य का लेजर कार्ड आपके कार्यालय को अग्रेषित किया जा रहा है।",
    },
  },
  {
    // The same single-member L.C.-out opening with the "herewith" + "the
    // jurisdiction" phrasing the scanned letters also carry.
    en: "In view of the revised Procedure prescribed in Procedure Office Order No-{1} Dated-{2} of CMPF Commissioner, Dhanbad, I am to state that the Ledger Card of the following member is forwarded herewith to your office as he is working under the jurisdiction of your region.",
    tr: {
      Hindi: "सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-{1} दिनांक-{2} में निर्धारित संशोधित प्रक्रिया के दृष्टिगत, मुझे यह कहना है कि चूँकि वह आपके क्षेत्र के अधिकार क्षेत्र में कार्यरत है, निम्नलिखित सदस्य का लेजर कार्ड आपके कार्यालय को अग्रेषित किया जा रहा है।",
    },
  },
  {
    // The single-member L.C.-out second paragraph — the assurance that the
    // card is complete ("are duly completed for the periods for which the
    // member was contributing in this region"). "dully" is the scanned
    // spelling of "duly" — both variants are covered.
    en: "It is ensured that the posting in the Ledger Card are duly completed for the periods for which the member was contributing in this Region.",
    tr: {
      Hindi: "यह सुनिश्चित किया गया है कि जिस अवधि के दौरान सदस्य इस क्षेत्र में अंशदान कर रहा था, उस अवधि के लिए लेजर कार्ड में प्रविष्टियाँ पूर्ण रूप से की जा चुकी हैं।",
    },
  },
  {
    en: "It is ensured that the posting in the Ledger Card are dully completed for the periods for which the member was contributing in this Region.",
    tr: {
      Hindi: "यह सुनिश्चित किया गया है कि जिस अवधि के दौरान सदस्य इस क्षेत्र में अंशदान कर रहा था, उस अवधि के लिए लेजर कार्ड में प्रविष्टियाँ पूर्ण रूप से की जा चुकी हैं।",
    },
  },
  {
    // The 7-ALL OLD LETTER corpus — the L.C.-out opening as the Ranchi /
    // Dhanbad letters phrase it: "I am to state … along with Declaration in
    // Form "A" Form-I (Pen), PS-3 & 4 may kindly be forwarded to this office
    // as the member(s) is /are working in this region" (the ×28 corpus
    // sentence). The "is /are" split, the glued "Commissioner,Dhanbad" and
    // "(Pen),PS-3" are tolerated by the whitespace-flex matcher.
    en: 'In view of the revised Procedures prescribed in Procedure Office Order No-{1} Dated-{2} of CMPF Commissioner, Dhanbad, I am to state that the Ledger Cards of the following members along with Declaration in Form "A" Form-I (Pen), PS-3 & 4 may kindly be forwarded to this office as the member(s) is /are working in this region.',
    tr: {
      Hindi: 'सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-{1} दिनांक-{2} में निर्धारित संशोधित प्रक्रियाओं के दृष्टिगत, मुझे यह कहना है कि निम्नलिखित सदस्य/सदस्यों का लेजर कार्ड, फॉर्म "ए" फॉर्म-I (पेन), पी.एस.-3 एवं 4 में घोषणा सहित, चूँकि सदस्य इस क्षेत्र में कार्यरत है/हैं, इस कार्यालय को अग्रेषित किए जाने की कृपा की जाए।',
    },
  },
  {
    // The same L.C.-out family's second paragraph — the polite request form
    // ("may be made updated … in your Region") the Ranchi / Dhanbad letters
    // use (×28). The completed-form twin ("It has been ensured … have been
    // made/updated") lives in the seed pack.
    en: "It may kindly be ensured that the posting in the Ledger Cards may be made updated for the periods the member was working in your Region.",
    tr: {
      Hindi: "कृपया यह सुनिश्चित किया जाए कि जिस अवधि के दौरान सदस्य आपके क्षेत्र में कार्यरत था, उस अवधि के लिए लेजर कार्ड में प्रविष्टियाँ अद्यतन की जाएँ।",
    },
  },
  {
    // Fused closing forms from OCR/DOCX extraction ("Yoursfaithfully"
    // without a space — the pattern in translate.ts requires the space).
    en: "Yoursfaithfully",
    tr: { Hindi: "भवदीय," },
  },
  {
    en: "Yourssincerely",
    tr: { Hindi: "सादर," },
  },
  {
    // The L.C.-out closing request (×19) — the needful-action sentence.
    en: "In light of this, we kindly request you to do the needful action and kindly arrange the transfer of his ledger card from previous working zones and update the records accordingly.",
    tr: {
      Hindi: "इसके आलोक में, हम आपसे विनम्र अनुरोध करते हैं कि आवश्यक कार्रवाई की जाए तथा कृपया उनके लेजर कार्ड को पूर्व कार्य क्षेत्रों से स्थानांतरित करने की व्यवस्था की जाए और अभिलेखों को तदनुसार अद्यतन किया जाए।",
    },
  },
  {
    // The L.C.-out polite close (×19).
    en: "Thank you for your attention to this matter.",
    tr: {
      Hindi: "इस विषय पर आपका ध्यान देने के लिए धन्यवाद।",
    },
  },
  {
    // The Extract family's not-available reply (×14).
    en: "Ledger Card is not available in this region.",
    tr: {
      Hindi: "लेजर कार्ड इस क्षेत्र में उपलब्ध नहीं है।",
    },
  },
  {
    // The Extract-Out body with the "enclosed please find herewith … in
    // r/o-" phrasing and the "as required." tail (×10) — the twin of the
    // seed "in respect of … as desired." row. The OCR "i n r/o" split is
    // repaired by the recover pass; {1} is the member (transliterated by
    // the reference pass), {2} the CMPF account code.
    en: "On the subject and reference cited above, enclosed please find herewith the extract in r/o- {1} CMPF A/C No- {2} as required.",
    tr: {
      Hindi: "उपरोक्त विषय एवं संदर्भ के आलोक में, {1}, सीएमपीएफ खाता संख्या- {2} के संबंध में संलग्न उद्धरण (एक्सट्रैक्ट) आपके अवलोकनार्थ प्रेषित है।",
    },
  },
  {
    // The superannuation pair (the DILIP LC IN-OUT letters, ×3) — two
    // sentences fused on one line; the sentence splitter matches each half.
    en: "Member will be superannuate on {1}.",
    tr: {
      Hindi: "सदस्य {1} को सेवानिवृत्त होंगे।",
    },
  },
  {
    en: "Refund claim received to this office under Mission Biswas.",
    tr: {
      Hindi: "प्रतिपूर्ति दावा इस कार्यालय को मिशन बिस्वास के अंतर्गत प्राप्त हुआ।",
    },
  },
  {
    // The not-available L.C. reply with the dealing-assistant report tail
    // (the Ganesh Diwate letter, ×1). The OCR splits ("abave", "in from",
    // "conc erned", "here with") are repaired by the recover pass.
    en: "With reference to your letter cited above, it is to inform you that L.C. is not available in this region ({1}) report of concerned dealing assistant is enclosed herewith for ready reference.",
    tr: {
      Hindi: "आपके उपर्युक्त पत्र के संदर्भ में, यह सूचित किया जाता है कि एल.सी. इस क्षेत्र में उपलब्ध नहीं है ({1})। संबंधित प्रभारी सहायक की रिपोर्ट त्वरित संदर्भ हेतु संलग्न है।",
    },
  },
  {
    // The P.P.O. pension-files office note (33-FILE, ×1) — the four
    // directives; the recover pass repairs the "P.P. O ." / "mo n th" splits.
    en: "It has come to the notice of the undersigned that the settled P.P.O. pension files have not been handed over to the Pension Section regularly.",
    tr: {
      Hindi: "यह अधोहस्ताक्षरी के संज्ञान में आया है कि निपटाए गए पी.पी.ओ. पेंशन फाइलें नियमित रूप से पेंशन अनुभाग को सौंपी नहीं गई हैं।",
    },
  },
  {
    en: "All Dealing Assistants are hereby directed to submit all the settled P.P.O. pension files, which are kept with them and had not been submitted in the Pension Section till date, within 5 (Five) days of issue of this office note.",
    tr: {
      Hindi: "सभी प्रभारी सहायकों को निर्देशित किया जाता है कि वे अपने पास रखी गई तथा आज तक पेंशन अनुभाग में जमा न की गई सभी निपटाई गई पी.पी.ओ. पेंशन फाइलें, इस कार्यालय नोट के जारी होने के 5 (पाँच) दिनों के भीतर जमा करें।",
    },
  },
  {
    en: "Further, all the Dealing Assistants are also directed to submit the settled P.P.O. pension files of each month to Pension Section in the next corresponding month positively.",
    tr: {
      Hindi: "साथ ही, सभी प्रभारी सहायकों को यह भी निर्देशित किया जाता है कि प्रत्येक माह की निपटाई गई पी.पी.ओ. पेंशन फाइलें अगले संगत माह में पेंशन अनुभाग को अनिवार्य रूप से जमा करें।",
    },
  },
  {
    en: "S.O. And A.O. Section Incharge are also directed to ensure that the settled P.P.O. files are handedover by the Dealing Assistants to the Pension Section positively after settlement of claim in same month.",
    tr: {
      Hindi: "एस.ओ. एवं ए.ओ. अनुभाग प्रभारी को भी निर्देशित किया जाता है कि दावा निपटान के उसी माह में निपटाई गई पी.पी.ओ. फाइलें प्रभारी सहायकों द्वारा पेंशन अनुभाग को अनिवार्य रूप से सौंपी जाएँ, यह सुनिश्चित किया जाए।",
    },
  },
];
