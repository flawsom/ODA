// Domain Translation-Memory Engine (fidelity PRD §4.3) — seed pack.
//
// CMPF/PF correspondence is highly formulaic: the same boilerplate sentences
// recur across thousands of L.C.-Out and Extract letters. A fuzzy-matched
// translation memory gets the keyless engine to full coverage on this domain
// without any neural tier. Every entry below was taken from the user's own
// gold-standard Hindi twin of the CMPF inter-regional ledger-card transfer
// letter — the exact sentences that were surviving untranslated in the
// deterministic output.
//
// Matching normalizes both sides (case, whitespace, punctuation) and treats
// dates/numbers/codes as open slots, so "No-35 dated 12.02.1975" matches the
// template "No-{order} dated {date}" and the captured values flow into the
// Hindi template verbatim. A hit is instant, free, fully-Hindi output; a miss
// returns null and the caller escalates (neural tiers) or reports honestly —
// it never silently ships an untranslated sentence.

export interface GlossaryEntry {
  /** Source template; {slot} placeholders capture the varying values. */
  en: string;
  /** Target (Hindi) template with the same {slot} placeholders. The
   * sentence-dictionary family carries `tr` (all languages) instead. */
  hi?: string;
  /** Per-language target templates with {n} placeholders — the sentence
   * family used by the early phrase pass. */
  tr?: Record<string, string>;
  /** Optional slot dictionary for values that need their own translation
   * (place names etc.). */
  slotMap?: Record<string, string>;
}

export const PLACES: Record<string, string> = {
  Dhanbad: "धनबाद",
  Asansol: "आसनसोल",
  Raniganj: "रानीगंज",
  Bankola: "बांकोला",
  Burdwan: "बर्धमान",
  "Ranaghat Branch": "राणाघाट शाखा",
  Ranaghat: "राणाघाट",
  "Nalanda Regional Office": "नालंदा क्षेत्रीय कार्यालय",
  Nalanda: "नालंदा",
  "New Delhi": "नई दिल्ली",
  "Regional Cooperative Bank": "क्षेत्रीय सहकारी बैंक",
  "Regional Registrar of Cooperatives": "सहकारी समितियों के क्षेत्रीय पंजीयक",
  "Regional Director": "क्षेत्रीय निदेशक",
  "Ramesh Pandey": "रमेश पांडेय",
  "Senior Accounts Officer": "वरिष्ठ लेखा अधिकारी",
  "Usha Rani Devi": "उषा रानी देवी",
  "State Bank of India": "भारतीय स्टेट बैंक",
  "DigiLocker": "डिजिलॉकर",
  "Digi Locker": "डिजिलॉकर",
  "life certificate": "जीवन प्रमाण पत्र",
  "PPO": "पीपीओ",
  "VV": "वी.वी.",
};

/** English month name → Devanagari, for dates captured into slots. */
export const MONTHS: Record<string, string> = {
  january: "जनवरी",
  february: "फ़रवरी",
  march: "मार्च",
  april: "अप्रैल",
  may: "मई",
  june: "जून",
  july: "जुलाई",
  august: "अगस्त",
  september: "सितंबर",
  october: "अक्टूबर",
  november: "नवंबर",
  december: "दिसंबर",
};

/** Normalize for matching: lowercase, punctuation → single space. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build an anchored regex from a template: {slot} → lazy capture. */
function templateRegex(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withSlots = escaped.replace(/\\\{(\w+)\\\}/g, "(.+?)");
  return new RegExp(`^${withSlots.trim().replace(/\s+/g, "\\s+")}$`, "i");
}

/**
 * Fill a captured slot value: exact slotMap hit first, then dates with
 * English month names ("08 January 2026" → "08 जनवरी 2026"), then keep the
 * value verbatim (codes, account numbers).
 */
export function fillSlot(value: string, slotMap: Record<string, string> | undefined): string {
  const raw = value.trim();
  if (slotMap?.[raw]) return slotMap[raw];
  const date = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
  if (date) {
    const m = MONTHS[date[2].toLowerCase()];
    if (m) return `${date[1]} ${m} ${date[3]}`;
  }
  const withMonth = raw.replace(
    new RegExp(`\\b(${Object.keys(MONTHS).join("|")})\\b`, "gi"),
    (mm) => MONTHS[mm.toLowerCase()] ?? mm,
  );
  return withMonth;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    en: "In view of the revised Procedures prescribed in Procedure Office Order No-{order} dated {date} of CMPF Commissioner,{city}, I am to state that the Ledger Cards of the under mentioned members are hereby forwarded to your Regional Office.",
    hi: "सीएमपीएफ आयुक्त, {city} के प्रक्रिया कार्यालय आदेश संख्या-{order} दिनांक-{date} में निर्धारित संशोधित प्रक्रिया के दृष्टिगत, मुझे यह कहना है कि नीचे उल्लिखित सदस्य/सदस्यों का लेजर कार्ड आपके क्षेत्रीय कार्यालय को अग्रेषित किया जा रहा है।",
    slotMap: PLACES,
  },
  {
    en: "Sub:- Inter Regional Transfer of Ledger Card.",
    hi: "विषय:- लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण।",
  },
  {
    en: "Inter Regional Transfer of Ledger Card.",
    hi: "लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण।",
  },
  {
    en: "Sir,",
    hi: "महोदय,",
  },
  {
    en: "Yours faithfully,",
    hi: "भवदीय,",
  },
  // -------------------------------------------------------------------
  // Cooperative-bank L.C.-Out transfer order (wrapped-prose letter)
  // -------------------------------------------------------------------
  {
    en: "Reference your application No. {app} dated {d1} and in continuation of Office Order No. {oo} dated {d2}, this office hereby issues the L.C.-Out order placing you on transfer from the {from} to the {to} with effect from the forenoon of {d3}.",
    hi: "आपके आवेदन संख्या {app} दिनांक {d1} के संदर्भ में तथा कार्यालय आदेश संख्या {oo} दिनांक {d2} की निरंतरता में, यह कार्यालय आपको {from} से {to} में {d3} की पूर्वाह्न से प्रभावी रूप से स्थानांतरित करने हेतु एल.सी.-आउट आदेश जारी करता है।",
    slotMap: PLACES,
  },
  {
    en: "Hand over charge of all records, cash and stationery in your custody to Shri {name}, {desig}, who has been appointed to receive the charge.",
    hi: "अपने पास निहित सभी अभिलेखों, नकदी तथा लेखन सामग्री का प्रभार श्री {name}, {desig} को सौंपें, जिन्हें प्रभार ग्रहण करने हेतु नियुक्त किया गया है।",
    slotMap: PLACES,
  },
  {
    en: "Submit the charge report and stock verification statement (VV) to this office within 3 working days of relief.",
    hi: "प्रभार मुक्ति के 3 कार्य दिवसों के भीतर प्रभार रिपोर्ट तथा स्टॉक सत्यापन विवरण (वी.वी.) इस कार्यालय को प्रस्तुत करें।",
  },
  {
    en: "Report for joining at the {to} on or before {d}.",
    hi: "{to} में {d} को या उससे पूर्व कार्यभार ग्रहण करने हेतु उपस्थित हों।",
    slotMap: PLACES,
  },
  {
    en: "Your joining report should be submitted to the {desig}, Nalanda.",
    hi: "आपका जॉइनिंग रिपोर्ट क्षेत्रीय निदेशक, नालंदा को प्रस्तुत किया जाना चाहिए।",
    slotMap: PLACES,
  },
  {
    en: "TA/DA and transfer grant shall be admissible as per departmental rules.",
    hi: "विभागीय नियमों के अनुसार टी.ए./डी.ए. तथा स्थानांतरण अनुदान देय होगा।",
  },
  {
    en: "This issues with the approval of the {desig}.",
    hi: "यह {desig} के अनुमोदन से जारी किया जा रहा है।",
    slotMap: PLACES,
  },
  {
    en: "Office of the Regional Registrar of Cooperatives",
    hi: "सहकारी समितियों के क्षेत्रीय पंजीयक का कार्यालय",
  },
  {
    en: "Sector 14, New Ranaghat",
    hi: "सेक्टर 14, न्यू राणाघाट",
  },
  {
    en: "Accounts Officer (Grade II)",
    hi: "लेखा अधिकारी (ग्रेड II)",
  },
  {
    en: "Regional Cooperative Bank, Ranaghat Branch",
    hi: "क्षेत्रीय सहकारी बैंक, राणाघाट शाखा",
  },
  {
    en: "L.C.-Out Transfer Order — posting to Nalanda Regional Office",
    hi: "एल.सी.-आउट स्थानांतरण आदेश — नालंदा क्षेत्रीय कार्यालय में पदस्थापन",
  },
  {
    en: "Deputy Registrar",
    hi: "उप पंजीयक",
  },
  {
    en: "(M. Chatterjee)",
    hi: "(एम. चटर्जी)",
  },
  // -------------------------------------------------------------------
  // Pension non-delivery complaint
  // -------------------------------------------------------------------
  {
    en: "I, Smt. {name}, pensioner bearing PPO No. {ppo}, hereby lodge a formal complaint regarding the non-crediting of my pension for the months of January and February 2026 to my account with the {bank} (A/C No. {acct}, IFSC {ifsc}).",
    hi: "मैं, श्रीमती {name}, पेंशनभोगी, पीपीओ संख्या {ppo}, यह औपचारिक शिकायत दर्ज करती हूँ कि जनवरी एवं फरवरी 2026 माह का मेरा पेंशन {bank} में मेरे खाते (खाता संख्या {acct}, आईएफएससी {ifsc}) में जमा नहीं किया गया।",
    slotMap: PLACES,
  },
  {
    en: "Despite submitting the {lc} through {portal} on {d} and receiving acknowledgement Ref. No. {ref}, the payment has not been released.",
    hi: "{d} को {portal} के माध्यम से {lc} प्रस्तुत करने तथा संदर्भ संख्या {ref} की पावती प्राप्त करने के बावजूद, भुगतान जारी नहीं किया गया है।",
    slotMap: PLACES,
  },
  {
    en: "The Commissioner",
    hi: "आयुक्त महोदय",
  },
  {
    en: "Department of Pensions & Welfare",
    hi: "पेंशन एवं कल्याण विभाग",
  },
  {
    en: "P-Wing, Civil Lines, New Delhi",
    hi: "पी-विंग, सिविल लाइन्स, नई दिल्ली",
  },
  {
    en: "Complaint regarding non-delivery of pension for January–February 2026",
    hi: "जनवरी–फरवरी 2026 हेतु पेंशन का भुगतान न होने संबंधी शिकायत",
  },
  {
    en: "Pensioner, PPO/{ppo}",
    hi: "पेंशनभोगी, पीपीओ/{ppo}",
  },
  {
    en: "Contact: {phone}",
    hi: "संपर्क: {phone}",
  },

  // -------------------------------------------------------------------
  // Sentence dictionary — the base translator's sentence-level entries,
  // folded into the TM so ONE store serves both the early phrase pass
  // (entries carrying `tr`, all languages) and the post-pass (entries
  // with `hi`). New letters grow coverage by adding an entry here — no
  // engine code changes.
  // -------------------------------------------------------------------
  {
    // The second sentence of the CMPF L.C.-Out opening paragraph — the whole
    // paragraph is one line in the source, so sentence-splitting translates it
    // as two phrase hits joined with a space.
    en: "It is also intimated that Form A and P.S.-3 and P.S.-4 forms are not available in this Region.",
    tr: {
      Hindi: "साथ ही, यह भी सूचित किया जाता है कि फॉर्म ए तथा पी.एस.-3 एवं पी.एस.-4 फॉर्म इस क्षेत्र में उपलब्ध नहीं हैं।",
      Tamil: "மேலும், இந்த பிராந்தியத்தில் படிவம் ஏ மற்றும் பி.எஸ்.-3 மற்றும் பி.எஸ்.-4 படிவங்கள் கிடைக்கவில்லை என்பதும் தெரிவிக்கப்படுகிறது.",
      Bengali: "আরও জানানো হচ্ছে যে, এই অঞ্চলে ফর্ম এ এবং পি.এস.-৩ এবং পি.এস.-৪ ফর্ম পাওয়া যায় না।",
      Telugu: "అలాగే, ఈ ప్రాంతంలో ఫారం ఎ మరియు పి.ఎస్.-3 మరియు పి.ఎస్.-4 ఫారమ్లు అందుబాటులో లేవని కూడా తెలియజేయబడుతోంది.",
      Kannada: "ಇದಲ್ಲದೆ, ಈ ಪ್ರದೇಶದಲ್ಲಿ ಫಾರ್ಮ್ ಎ ಮತ್ತು ಪಿ.ಎಸ್.-3 ಮತ್ತು ಪಿ.ಎಸ್.-4 ಫಾರ್ಮ್‌ಗಳು ಲಭ್ಯವಿಲ್ಲ ಎಂದೂ ತಿಳಿಸಲಾಗುತ್ತದೆ.",
      Gujarati: "ઉપરાંત, આ પ્રદેશમાં ફોર્મ એ અને પી.એસ.-3 અને પી.એસ.-4 ફોર્મ ઉપલબ્ધ નથી તેમ પણ જાણ કરવામાં આવે છે.",
      Marathi: "तसेच, या प्रदेशात फॉर्म ए आणि पी.एस.-3 आणि पी.एस.-4 फॉर्म उपलब्ध नाहीत, असेही कळविले जाते.",
      Spanish: "Se informa asimismo de que los Formularios A y P.S.-3 y P.S.-4 no están disponibles en esta Región.",
      French: "Il est également porté à votre connaissance que les formulaires A et P.S.-3 et P.S.-4 ne sont pas disponibles dans cette Région.",
      Arabic: "كما يُعلم أيضاً أن النموذج (أ) ونموذجي P.S.-3 وP.S.-4 غير متوفرين في هذه المنطقة.",
    },
  },
  {
    // The CMPF Extract-Out body as the real letters actually phrase it
    // ("On the subject and reference cited above, please find enclosed
    // herewith the extract in respect of Shri …"). {1} = member name
    // (transliterated to Devanagari by the refine pass), {2} = CMPF account
    // number (transliterated आरएनजे/38/3274).
    en: "On the subject and reference cited above, please find enclosed herewith the extract in respect of Shri {1}, CMPF A/C No- {2} as desired.",
    tr: {
      Hindi: "उपरोक्त विषय एवं संदर्भ के आलोक में, श्री {1}, सीएमपीएफ खाता संख्या- {2} के संबंध में संलग्न उद्धरण (एक्सट्रैक्ट) आपके अवलोकनार्थ प्रेषित है।",
      Tamil: "மேற்கூறிய விஷயம் மற்றும் குறிப்பின் பார்வையில், திரு {1}, CMPF கணக்கு எண்- {2} தொடர்பாக இணைக்கப்பட்ட சாற்றெடுப்பு (எக்ஸ்ட்ராக்ட்) உங்கள் பார்வைக்காக அனுப்பப்படுகிறது.",
      Bengali: "উপরোক্ত বিষয় ও সূত্রের প্রেক্ষিতে, শ্রী {1}, সিএমপিএফ হিসাব নং- {2} সম্পর্কে সংযুক্ত উদ্ধৃতি (এক্সট্রাক্ট) আপনার অবলোকনের জন্য প্রেরণ করা হলো।",
      Telugu: "పై విషయం మరియు సూచన దృష్ట్యా, శ్రీ {1}, CMPF ఖాతా నం- {2} గురించి జోడించిన సారాంశం (ఎక్స్ట్రాక్ట్) మీ పరిశీలన కోసం పంపబడింది.",
      Kannada: "ಮೇಲಿನ ವಿಷಯ ಮತ್ತು ಉಲ್ಲೇಖದ ದೃಷ್ಟಿಯಿಂದ, ಶ್ರೀ {1}, CMPF ಖಾತೆ ಸಂಖ್ಯೆ- {2} ಕುರಿತು ಲಗತ್ತಿಸಲಾದ ಸಾರ (ಎಕ್ಸ್ಟ್ರಾಕ್ಟ್) ನಿಮ್ಮ ಪರಿಶೀಲನೆಗಾಗಿ ಕಳುಹಿಸಲಾಗಿದೆ.",
      Gujarati: "ઉપરોક્ત વિષય અને સંદર્ભના આલોકમાં, શ્રી {1}, CMPF ખાતું નં- {2} સંબંધિત જોડાયેલ અવતરણ (એક્સટ્રેક્ટ) તમારા અવલોકન માટે મોકલવામાં આવે છે.",
      Marathi: "वरील विषय आणि संदर्भाच्या अनुषंगाने, श्री {1}, CMPF खाते क्र- {2} संबंधी संलग्न उतारा (एक्सट्रॅक्ट) आपल्या अवलोकनासाठी पाठविला जात आहे.",
      Spanish: "En virtud del asunto y la referencia antes citados, se remite para su consideración el extracto adjunto de Shri {1}, cuenta CMPF N.º {2}.",
      French: "Au vu de l'objet et de la référence susmentionnés, l'extrait ci-joint de Shri {1}, compte CMPF n° {2}, est transmis pour votre examen.",
      Arabic: "على ضوء الموضوع والمرجع المذكورين أعلاه، تُرفق نسخة مستخرجة خاصة بالسيد {1}، حساب CMPF رقم {2}، للإطلاع عليها.",
    },
  },
  {
    // The CMPF Extract-Out body — "Shri {name}, CMPF A/C No. {acct}" captures
    // are transliterated into Devanagari by the refine pass (रविंद्र यादव, आरएनजे/12/1011).
    en: "In view of the above subject and reference, the extract of VV details of Shri {1}, CMPF A/C No.- {2} is forwarded herewith for your perusal.",
    tr: {
      Hindi: "उपरोक्त विषय एवं संदर्भ के आलोक में, श्री {1}, सीएमपीएफ खाता संख्या- {2} के संबंध में संलग्न उद्धरण (एक्सट्रैक्ट) आपके अवलोकनार्थ प्रेषित है।",
      Tamil: "மேற்கூறிய விஷயம் மற்றும் குறிப்பின் பார்வையில், திரு {1}, CMPF கணக்கு எண்- {2} தொடர்பாக இணைக்கப்பட்ட சாற்றெடுப்பு (எக்ஸ்ட்ராக்ட்) உங்கள் பார்வைக்காக அனுப்பப்படுகிறது.",
      Bengali: "উপরোক্ত বিষয় ও সূত্রের প্রেক্ষিতে, শ্রী {1}, সিএমপিএফ হিসাব নং- {2} সম্পর্কে সংযুক্ত উদ্ধৃতি (এক্সট্রাক্ট) আপনার অবলোকনের জন্য প্রেরণ করা হলো।",
      Telugu: "పై విషయం మరియు సూచన దృష్ట్యా, శ్రీ {1}, CMPF ఖాతా నం- {2} గురించి జోడించిన సారాంశం (ఎక్స్ట్రాక్ట్) మీ పరిశీలన కోసం పంపబడింది.",
      Kannada: "ಮೇಲಿನ ವಿಷಯ ಮತ್ತು ಉಲ್ಲೇಖದ ದೃಷ್ಟಿಯಿಂದ, ಶ್ರೀ {1}, CMPF ಖಾತೆ ಸಂಖ್ಯೆ- {2} ಕುರಿತು ಲಗತ್ತಿಸಲಾದ ಸಾರ (ಎಕ್ಸ್ಟ್ರಾಕ್ಟ್) ನಿಮ್ಮ ಪರಿಶೀಲನೆಗಾಗಿ ಕಳುಹಿಸಲಾಗಿದೆ.",
      Gujarati: "ઉપરોક્ત વિષય અને સંદર્ભના આલોકમાં, શ્રી {1}, CMPF ખાતું નં- {2} સંબંધિત જોડાયેલ અવતરણ (એક્સટ્રેક્ટ) તમારા અવલોકન માટે મોકલવામાં આવે છે.",
      Marathi: "वरील विषय आणि संदर्भाच्या अनुषंगाने, श्री {1}, CMPF खाते क्र- {2} संबंधी संलग्न उतारा (एक्सट्रॅक्ट) आपल्या अवलोकनासाठी पाठविला जात आहे.",
      Spanish: "En virtud del asunto y la referencia antes citados, se remite para su consideración el extracto adjunto de los detalles VV de Shri {1}, cuenta CMPF N.º {2}.",
      French: "Au vu de l'objet et de la référence susmentionnés, l'extrait ci-joint des détails VV de Shri {1}, compte CMPF n° {2}, est transmis pour votre examen.",
      Arabic: "على ضوء الموضوع والمرجع المذكورين أعلاه، تُرفق نسخة مستخرجة من تفاصيل VV الخاصة بالسيد {1}، حساب CMPF رقم {2}، للإطلاع عليها.",
    },
  },
  {
    en: "Please acknowledge the receipt of the above at the earliest.",
    tr: {
      Hindi: "कृपया उपरोक्त की प्राप्ति की सूचना शीघ्रातिशीघ्र दें।",
      Tamil: "மேற்கூறியவற்றின் பெறுப்புச் சீட்டை விரைவில் அனுப்புமாறு கேட்டுக்கொள்ளப்படுகிறது.",
      Bengali: "অনুগ্রহ করে উপরোক্তটির প্রাপ্তি স্বীকারের তথ্য যত দ্রুত সম্ভব জানান।",
      Telugu: "పైన పేర్కొన్న దాని రసీదును వీలైనంత త్వరగా ధృవీకరించండి.",
      Kannada: "ಮೇಲಿನದರ ರಶೀದಿಯ ದೃಢೀಕರಣವನ್ನು ಸಾಧ್ಯವಾದಷ್ಟು ಬೇಗ ನೀಡಿ.",
      Gujarati: "કૃપા કરીને ઉપરોક્તની પ્રાપ્તિની સ્વીકૃતિ શક્ય તેટલી વહેલી આપો.",
      Marathi: "कृपया वरील गोष्टीची पावती शक्य तितक्या लवकर द्या.",
      Spanish: "Sírvase acusar recibo de lo anterior a la mayor brevedad.",
      French: "Veuillez accuser réception de ce qui précède dans les plus brefs délais.",
      Arabic: "يرجى تأكيد استلام ما سبق في أقرب وقت ممكن.",
    },
  },
  {
    en: "In view of the revised Procedures prescribed in Procedure Office Order No-{1} dated {2} of CMPF Commissioner, Dhanbad, I am to state that the Ledger Cards of the under mentioned members are hereby forwarded to your Regional Office.",
    tr: {
      Hindi: "सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-{1} दिनांक-{2} में निर्धारित संशोधित प्रक्रिया के दृष्टिगत, मुझे यह कहना है कि नीचे उल्लिखित सदस्य/सदस्यों का लेजर कार्ड आपके क्षेत्रीय कार्यालय को अग्रेषित किया जा रहा है।",
      Tamil: "தன்பாத் CMPF ஆணையரின் நடைமுறை அலுவலக உத்தரவு எண்-{1} தேதி {2} இல் நிர்ணயிக்கப்பட்ட திருத்தப்பட்ட நடைமுறைகளின் அடிப்படையில், கீழே குறிப்பிடப்பட்ட உறுப்பினர்களின் லெட்ஜர் அட்டைகள் உங்கள் பிராந்திய அலுவலகத்திற்கு அனுப்பப்படுவதாகத் தெரிவித்துக் கொள்கிறேன்.",
      Bengali: "ধনবাদ CMPF কমিশনারের পদ্ধতি কার্যালয় আদেশ নং-{1} তারিখ {2} এ নির্ধারিত সংশোধিত পদ্ধতির পরিপ্রেক্ষিতে, আমি জানাতে চাই যে নিম্নলিখিত সদস্য/সদস্যদের লেজার কার্ড আপনার আঞ্চলিক কার্যালয়ে প্রেরণ করা হচ্ছে।",
      Telugu: "ధన్బాద్ CMPF కమిషనర్ యొక్క విధాన కార్యాలయ ఉత్తర్వు నం-{1} తేదీ {2} లో నిర్దేశించిన సవరించిన విధానాల దృష్ట్యా, క్రింద పేర్కొన్న సభ్యుల లెడ్జర్ కార్డులు మీ ప్రాంతీయ కార్యాలయానికి పంపబడుతున్నాయని తెలియజేస్తున్నాను.",
      Kannada: "ಧನ್ಬಾದ್ CMPF ಆಯುಕ್ತರ ಕಾರ್ಯವಿಧಾನ ಕಚೇರಿ ಆದೇಶ ಸಂಖ್ಯೆ-{1} ದಿನಾಂಕ {2} ರಲ್ಲಿ ನಿಗದಿಪಡಿಸಿದ ಪರಿಷ್ಕೃತ ಕಾರ್ಯವಿಧಾನಗಳ ದೃಷ್ಟಿಯಿಂದ, ಕೆಳಗೆ ಉಲ್ಲೇಖಿಸಲಾದ ಸದಸ್ಯರ ಲೆಡ್ಜರ್ ಕಾರ್ಡ್‌ಗಳನ್ನು ನಿಮ್ಮ ಪ್ರಾದೇಶಿಕ ಕಚೇರಿಗೆ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ ಎಂದು ತಿಳಿಸುತ್ತೇನೆ.",
      Gujarati: "ધનબાદ CMPF કમિશનરના પ્રક્રિયા કાર્યાલય આદેશ નં-{1} તારીખ {2} માં નિર્ધારિત સુધારેલી પ્રક્રિયાઓની દૃષ્ટિએ, હું જણાવવા માંગુ છું કે નીચે ઉલ્લેખિત સભ્યોના લેજર કાર્ડ તમારા પ્રાદેશિક કાર્યાલયને મોકલવામાં આવી રહ્યા છે.",
      Marathi: "धनबाद CMPF आयुक्तांच्या प्रक्रिया कार्यालय आदेश क्र.-{1} दिनांक {2} मध्ये निर्धारित सुधारित प्रक्रियांच्या अनुषंगाने, खाली नमूद सदस्यांचे लेजर कार्ड तुमच्या प्रादेशिक कार्यालयाकडे पाठविले जात आहेत, असे मी सांगू इच्छितो.",
      Spanish: "En virtud de los procedimientos revisados prescritos en la Orden de Oficina de Procedimiento N.º {1} de fecha {2} del Comisionado de CMPF, Dhanbad, comunico que las tarjetas de contabilidad de los miembros mencionados a continuación se remiten a su Oficina Regional.",
      French: "Au vu des procédures révisées prescrites par l'Ordre de Service de Procédure n° {1} du {2} du Commissaire CMPF, Dhanbad, j'ai l'honneur de vous informer que les cartes de comptes des membres mentionnés ci-dessous sont transmises à votre Bureau Régional.",
      Arabic: "استناداً إلى الإجراءات المنقحة المنصوص عليها في الأمر الإداري الإجرائي رقم {1} بتاريخ {2} الصادر عن مفوض الصندوق، دهانباد، أود أن أفيد بأن بطاقات الحسابات الخاصة بالأعضاء المذكورين أدناه تُحال إلى مكتبكم الإقليمي.",
    },
  },
  {
    // The L.C.-out opening as the Dhanbad / Talcher / Nagpur letters phrase
    // it — "the following members" (not "under mentioned"), which reads
    // निम्नलिखित सदस्य in the reference standard.
    en: "In view of the revised Procedures prescribed in Procedure Office Order No-{1} dated {2} of CMPF Commissioner, Dhanbad, I am to state that the Ledger Cards of the following members is hereby forwarded to your Regional Office.",
    tr: {
      Hindi: "सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-{1} दिनांक-{2} में निर्धारित संशोधित प्रक्रिया के दृष्टिगत, मुझे यह कहना है कि निम्नलिखित सदस्य/सदस्यों का लेजर कार्ड आपके क्षेत्रीय कार्यालय को अग्रेषित किया जा रहा है।",
      Tamil: "தன்பாத் CMPF ஆணையரின் நடைமுறை அலுவலக உத்தரவு எண்-{1} தேதி {2} இல் நிர்ணயிக்கப்பட்ட திருத்தப்பட்ட நடைமுறைகளின் அடிப்படையில், கீழே குறிப்பிடப்பட்ட உறுப்பினர்களின் லெட்ஜர் அட்டைகள் உங்கள் பிராந்திய அலுவலகத்திற்கு அனுப்பப்படுவதாகத் தெரிவித்துக் கொள்கிறேன்.",
      Bengali: "ধনবাদ CMPF কমিশনারের পদ্ধতি কার্যালয় আদেশ নং-{1} তারিখ {2} এ নির্ধারিত সংশোধিত পদ্ধতির পরিপ্রেক্ষিতে, আমি জানাতে চাই যে নিম্নলিখিত সদস্য/সদস্যদের লেজার কার্ড আপনার আঞ্চলিক কার্যালয়ে প্রেরণ করা হচ্ছে।",
      Telugu: "ధన్బాద్ CMPF కమిషనర్ యొక్క విధాన కార్యాలయ ఉత్తర్వు నం-{1} తేదీ {2} లో నిర్దేశించిన సవరించిన విధానాల దృష్ట్యా, క్రింద పేర్కొన్న సభ్యుల లెడ్జర్ కార్డులు మీ ప్రాంతీయ కార్యాలయానికి పంపబడుతున్నాయని తెలియజేస్తున్నాను.",
      Kannada: "ಧನ್ಬಾದ್ CMPF ಆಯುಕ್ತರ ಕಾರ್ಯವಿಧಾನ ಕಚೇರಿ ಆದೇಶ ಸಂಖ್ಯೆ-{1} ದಿನಾಂಕ {2} ರಲ್ಲಿ ನಿಗದಿಪಡಿಸಿದ ಪರಿಷ್ಕೃತ ಕಾರ್ಯವಿಧಾನಗಳ ದೃಷ್ಟಿಯಿಂದ, ಕೆಳಗೆ ಉಲ್ಲೇಖಿಸಲಾದ ಸದಸ್ಯರ ಲೆಡ್ಜರ್ ಕಾರ್ಡ್‌ಗಳನ್ನು ನಿಮ್ಮ ಪ್ರಾದೇಶಿಕ ಕಚೇರಿಗೆ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ ಎಂದು ತಿಳಿಸುತ್ತೇನೆ.",
      Gujarati: "ધનબાદ CMPF કમિશનરના પ્રક્રિયા કાર્યાલય આદેશ નં-{1} તારીખ {2} માં નિર્ધારિત સુધારેલી પ્રક્રિયાઓની દૃષ્ટિએ, હું જણાવવા માંગુ છું કે નીચે ઉલ્લેખિત સભ્યોના લેજર કાર્ડ તમારા પ્રાદેશિક કાર્યાલયને મોકલવામાં આવી રહ્યા છે.",
      Marathi: "धनबाद CMPF आयुक्तांच्या प्रक्रिया कार्यालय आदेश क्र.-{1} दिनांक {2} मध्ये निर्धारित सुधारित प्रक्रियांच्या अनुषंगाने, खाली नमूद सदस्यांचे लेजर कार्ड तुमच्या प्रादेशिक कार्यालयाकडे पाठविले जात आहेत, असे मी सांगू इच्छितो.",
      Spanish: "En virtud de los procedimientos revisados prescritos en la Orden de Oficina de Procedimiento N.º {1} de fecha {2} del Comisionado de CMPF, Dhanbad, comunico que las tarjetas de contabilidad de los miembros mencionados a continuación se remiten a su Oficina Regional.",
      French: "Au vu des procédures révisées prescrites par l'Ordre de Service de Procédure n° {1} du {2} du Commissaire CMPF, Dhanbad, j'ai l'honneur de vous informer que les cartes de comptes des membres mentionnés ci-dessous sont transmises à votre Bureau Régional.",
      Arabic: "استناداً إلى الإجراءات المنقحة المنصوص عليها في الأمر الإداري الإجرائي رقم {1} بتاريخ {2} الصادر عن مفوض الصندوق، دهانباد، أود أن أفيد بأن بطاقات الحسابات الخاصة بالأعضاء المذكورين أدناه تُحال إلى مكتبكم الإقليمي.",
    },
  },
  {
    // The "Further, it is informed …" sentence the Dhanbad / Talcher / Nagpur
    // letters attach to the L.C.-out opening paragraph — merged into the
    // same paragraph by the reference standard (साथ ही, …).
    en: "Further, it is informed that the Form A & P.S.-3 & P.S.-4 forms are not available in this region.",
    tr: {
      Hindi: "साथ ही, यह भी सूचित किया जाता है कि फॉर्म ए तथा पी.एस.-3 एवं पी.एस.-4 फॉर्म इस क्षेत्र में उपलब्ध नहीं हैं।",
      Tamil: "மேலும், இந்த பிராந்தியத்தில் படிவம் ஏ மற்றும் பி.எஸ்.-3 மற்றும் பி.எஸ்.-4 படிவங்கள் கிடைக்கவில்லை என்பதும் தெரிவிக்கப்படுகிறது.",
      Bengali: "আরও জানানো হচ্ছে যে, এই অঞ্চলে ফর্ম এ এবং পি.এস.-৩ এবং পি.এস.-৪ ফর্ম পাওয়া যায় না।",
      Telugu: "అలాగే, ఈ ప్రాంతంలో ఫారం ఎ మరియు పి.ఎస్.-3 మరియు పి.ఎస్.-4 ఫారమ్లు అందుబాటులో లేవని కూడా తెలియజేయబడుతోంది.",
      Kannada: "ಇದಲ್ಲದೆ, ಈ ಪ್ರದೇಶದಲ್ಲಿ ಫಾರ್ಮ್ ಎ ಮತ್ತು ಪಿ.ಎಸ್.-3 ಮತ್ತು ಪಿ.ಎಸ್.-4 ಫಾರ್ಮ್‌ಗಳು ಲಭ್ಯವಿಲ್ಲ ಎಂದೂ ತಿಳಿಸಲಾಗುತ್ತದೆ.",
      Gujarati: "ઉપરાંત, આ પ્રદેશમાં ફોર્મ એ અને પી.એસ.-3 અને પી.એસ.-4 ફોર્મ ઉપલબ્ધ નથી તેમ પણ જાણ કરવામાં આવે છે.",
      Marathi: "तसेच, या प्रदेशात फॉर्म ए आणि पी.एस.-3 आणि पी.एस.-4 फॉर्म उपलब्ध नाहीत, असेही कळविले जाते.",
      Spanish: "Se informa asimismo de que los Formularios A y P.S.-3 y P.S.-4 no están disponibles en esta Región.",
      French: "Il est également porté à votre connaissance que les formulaires A et P.S.-3 et P.S.-4 ne sont pas disponibles dans cette Région.",
      Arabic: "كما يُعلم أيضاً أن النموذج (أ) ونموذجي P.S.-3 وP.S.-4 غير متوفرين في هذه المنطقة.",
    },
  },
  {
    en: "It has been ensured that the posting in the Ledger Cards have been made/updated for the periods the member were working in this Region.",
    tr: {
      Hindi: "यह सुनिश्चित किया गया है कि जिस अवधि के दौरान सदस्य इस क्षेत्र में कार्यरत था, उस अवधि के लिए लेजर कार्ड में प्रविष्टियाँ की/अद्यतन की जा चुकी हैं।",
      Tamil: "இந்த பிராந்தியத்தில் உறுப்பினர்கள் பணியாற்றிய காலங்களுக்கு லெட்ஜர் அட்டைகளில் பதிவுகள் செய்யப்பட்டு/புதுப்பிக்கப்பட்டுள்ளன என்பது உறுதி செய்யப்பட்டுள்ளது.",
      Bengali: "সদস্যরা এই অঞ্চলে কর্মরত থাকাকালীন সময়ের জন্য লেজার কার্ডে এন্ট্রি করা/আপডেট করা হয়েছে বলে নিশ্চিত করা হয়েছে।",
      Telugu: "ఈ ప్రాంతంలో సభ్యులు పనిచేసిన కాలాలకు లెడ్జర్ కార్డులలో నమోదులు చేయబడ్డాయని/నవీకరించబడ్డాయని నిర్ధారించబడింది.",
      Kannada: "ಈ ಪ್ರದೇಶದಲ್ಲಿ ಸದಸ್ಯರು ಕೆಲಸ ಮಾಡಿದ ಅವಧಿಗಳಿಗೆ ಲೆಡ್ಜರ್ ಕಾರ್ಡ್‌ಗಳಲ್ಲಿ ನಮೂದುಗಳನ್ನು ಮಾಡಲಾಗಿದೆ/ನವೀಕರಿಸಲಾಗಿದೆ ಎಂದು ಖಚಿತಪಡಿಸಲಾಗಿದೆ.",
      Gujarati: "ખાતરી કરવામાં આવી છે કે આ પ્રદેશમાં સભ્યો કામ કરતા હતા તે સમયગાળા માટે લેજર કાર્ડમાં એન્ટ્રીઓ કરવામાં આવી છે/અપડેટ કરવામાં આવી છે.",
      Marathi: "या प्रदेशात सदस्य कार्यरत असलेल्या कालावधीसाठी लेजर कार्डमध्ये नोंदी केल्या गेल्या आहेत/अद्यतनित केल्या गेल्या आहेत, याची खात्री करण्यात आली आहे.",
      Spanish: "Se ha garantizado que las anotaciones en las tarjetas de contabilidad se han realizado/actualizado por los períodos en que los miembros trabajaron en esta Región.",
      French: "Il a été veillé à ce que les écritures des cartes de comptes soient effectuées/mises à jour pour les périodes durant lesquelles les membres ont travaillé dans cette Région.",
      Arabic: "لقد تم التأكد من أن القيود في بطاقات الحسابات قد تمت/تم تحديثها عن الفترات التي عمل فيها الأعضاء في هذه المنطقة.",
    },
  },
  {
    // The L.C.-out opening with "members is hereby" — the scanned Singrauli
    // letters write "is" for "are"; the Hindi twin is identical.
    en: "In view of the revised Procedures prescribed in Procedure Office Order No-{1} dated {2} of CMPF Commissioner, Dhanbad, I am to state that the Ledger Cards of the under mentioned members is hereby forwarded to your Regional Office.",
    tr: {
      Hindi: "सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-{1} दिनांक-{2} में निर्धारित संशोधित प्रक्रिया के दृष्टिगत, मुझे यह कहना है कि नीचे उल्लिखित सदस्य/सदस्यों का लेजर कार्ड आपके क्षेत्रीय कार्यालय को अग्रेषित किया जा रहा है।",
    },
  },
  {
    // The same assurance phrased with "was working" (singular) — the Dhanbad
    // / Talcher / Nagpur letters use it; both variants read the same in
    // Hindi (जिस अवधि के दौरान सदस्य … कार्यरत था).
    en: "It has been ensured that the posting in the Ledger Cards have been made/updated for the periods the member was working in this Region.",
    tr: {
      Hindi: "यह सुनिश्चित किया गया है कि जिस अवधि के दौरान सदस्य इस क्षेत्र में कार्यरत था, उस अवधि के लिए लेजर कार्ड में प्रविष्टियाँ की/अद्यतन की जा चुकी हैं।",
      Tamil: "இந்த பிராந்தியத்தில் உறுப்பினர்கள் பணியாற்றிய காலங்களுக்கு லெட்ஜர் அட்டைகளில் பதிவுகள் செய்யப்பட்டு/புதுப்பிக்கப்பட்டுள்ளன என்பது உறுதி செய்யப்பட்டுள்ளது.",
      Bengali: "সদস্যরা এই অঞ্চলে কর্মরত থাকাকালীন সময়ের জন্য লেজার কার্ডে এন্ট্রি করা/আপডেট করা হয়েছে বলে নিশ্চিত করা হয়েছে।",
      Telugu: "ఈ ప్రాంతంలో సభ్యులు పనిచేసిన కాలాలకు లెడ్జర్ కార్డులలో నమోదులు చేయబడ్డాయని/నవీకరించబడ్డాయని నిర్ధారించబడింది.",
      Kannada: "ಈ ಪ್ರದೇಶದಲ್ಲಿ ಸದಸ್ಯರು ಕೆಲಸ ಮಾಡಿದ ಅವಧಿಗಳಿಗೆ ಲೆಡ್ಜರ್ ಕಾರ್ಡ್‌ಗಳಲ್ಲಿ ನಮೂದುಗಳನ್ನು ಮಾಡಲಾಗಿದೆ/ನವೀಕರಿಸಲಾಗಿದೆ ಎಂದು ಖಚಿತಪಡಿಸಲಾಗಿದೆ.",
      Gujarati: "ખાતરી કરવામાં આવી છે કે આ પ્રદેશમાં સભ્યો કામ કરતા હતા તે સમયગાળા માટે લેજર કાર્ડમાં એન્ટ્રીઓ કરવામાં આવી છે/અપડેટ કરવામાં આવી છે.",
      Marathi: "या प्रदेशात सदस्य कार्यरत असलेल्या कालावधीसाठी लेजर कार्डमध्ये नोंदी केल्या गेल्या आहेत/अद्यतनित केल्या गेल्या आहेत, याची खात्री करण्यात आली आहे.",
      Spanish: "Se ha garantizado que las anotaciones en las tarjetas de contabilidad se han realizado/actualizado por los períodos en que los miembros trabajaron en esta Región.",
      French: "Il a été veillé à ce que les écritures des cartes de comptes soient effectuées/mises à jour pour les périodes durant lesquelles les membres ont travaillé dans cette Région.",
      Arabic: "لقد تم التأكد من أن القيود في بطاقات الحسابات قد تمت/تم تحديثها عن الفترات التي عمل فيها الأعضاء في هذه المنطقة.",
    },
  },
  {
    // The CMPF L.C.-REQ opening — the request-family twin of the L.C.-out
    // opening ("…may kindly be forwarded to this office as the member(s)
    // is/are working in this region"). Hindi only; other languages fall back
    // to the Hindi reading (strictly better than the untranslated English).
    en: "In view of the revised Procedures prescribed in Procedure Office Order No-{1} dated {2} of CMPF Commissioner, Dhanbad, it is stated that the Ledger Cards of the following members along with Declaration in Form A, PS-3 & PS-4 and details of pension contribution may kindly be forwarded to this office as the member(s) is/are working in this region.",
    tr: {
      Hindi: "सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-{1} दिनांक-{2} में निर्धारित संशोधित प्रक्रिया के दृष्टिगत, यह कहा जाता है कि निम्नलिखित सदस्य/सदस्यों का लेजर कार्ड फॉर्म ए में घोषणा, पी.एस.-3 एवं पी.एस.-4 तथा पेंशन अंशदान के विवरण सहित, चूँकि सदस्य इस क्षेत्र में कार्यरत है/हैं, इस कार्यालय को अग्रेषित किए जाने की कृपा की जाए।",
    },
  },
  {
    // The same L.C.-REQ opening with the single-member clause
    // "…in respect of Shri {3}, CMPF A/C No- {4} working in this region".
    en: "In view of the revised Procedures prescribed in Procedure Office Order No-{1} dated {2} of CMPF Commissioner, Dhanbad, it is stated that the Ledger Cards of the following members along with Declaration in Form A, PS-3 & PS-4 and details of pension contribution may kindly be forwarded to this office in respect of Shri {3}, CMPF A/C No- {4} working in this region.",
    tr: {
      Hindi: "सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-{1} दिनांक-{2} में निर्धारित संशोधित प्रक्रिया के दृष्टिगत, यह कहा जाता है कि निम्नलिखित सदस्य/सदस्यों का लेजर कार्ड फॉर्म ए में घोषणा, पी.एस.-3 एवं पी.एस.-4 तथा पेंशन अंशदान के विवरण सहित, श्री {3}, सीएमपीएफ खाता संख्या- {4} के संबंध में, जो इस क्षेत्र में कार्यरत है, इस कार्यालय को अग्रेषित किए जाने की कृपा की जाए।",
    },
  },
  {
    // The L.C.-REQ single-member clause as the letters actually phrase it
    // ("Mr. Sanjay Kumar Singh" — the L.C.-REQ letters use Mr., not Shri).
    // {3} is transliterated by the refine pass (श्री संजय कुमार सिंह).
    en: "In view of the revised Procedures prescribed in Procedure Office Order No-{1} dated {2} of CMPF Commissioner, Dhanbad, it is stated that the Ledger Cards of the following members along with Declaration in Form A, PS-3 & PS-4 and details of pension contribution may kindly be forwarded to this office in respect of Mr. {3}, CMPF A/C No- {4} working in this region.",
    tr: {
      Hindi: "सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-{1} दिनांक-{2} में निर्धारित संशोधित प्रक्रिया के दृष्टिगत, यह कहा जाता है कि निम्नलिखित सदस्य/सदस्यों का लेजर कार्ड फॉर्म ए में घोषणा, पी.एस.-3 एवं पी.एस.-4 तथा पेंशन अंशदान के विवरण सहित, श्री {3}, सीएमपीएफ खाता संख्या- {4} के संबंध में, जो इस क्षेत्र में कार्यरत है, इस कार्यालय को अग्रेषित किए जाने की कृपा की जाए।",
    },
  },
  {
    // The L.C.-REQ second paragraph — the polite "may kindly be ensured"
    // form (the L.C.-out letters use the completed "It has been ensured").
    en: "It may kindly be ensured that the posting in the Ledger Cards have been made/updated for the periods the member was working in this Region.",
    tr: {
      Hindi: "यह सुनिश्चित किया जाए कि जिस अवधि के दौरान सदस्य इस क्षेत्र में कार्यरत था, उस अवधि के लिए लेजर कार्ड में प्रविष्टियाँ की/अद्यतन की जा चुकी हैं।",
    },
  },
  {
    // The L.C.-REQ third paragraph — what to do when the cards were already
    // transferred out of the Region.
    en: "In case, the Ledger Card(s) already transferred from your Region, the Region to whom transferred, indicating the details of transfer and your letter number and date be intimated.",
    tr: {
      Hindi: "यदि लेजर कार्ड आपके क्षेत्र से पहले ही स्थानांतरित कर दिए गए हों, तो जिस क्षेत्र को स्थानांतरित किए गए हैं, स्थानांतरण के विवरण तथा आपके पत्र की संख्या एवं दिनांक की सूचना दी जाए।",
    },
  },
  {
    en: "This issues with the approval of the Regional Director.",
    tr: {
      Hindi: "यह क्षेत्रीय निदेशक की स्वीकृति से जारी किया गया है।",
      Tamil: "இது பிராந்திய இயக்குநரின் ஒப்புதலுடன் வெளியிடப்படுகிறது.",
      Bengali: "এটি আঞ্চলিক পরিচালকের অনুমোদনক্রমে জারি করা হলো।",
      Telugu: "ఇది ప్రాంతీయ డైరెక్టర్ ఆమోదంతో జారీ చేయబడింది.",
      Kannada: "ಇದನ್ನು ಪ್ರಾದೇಶಿಕ ನಿರ್ದೇಶಕರ ಅನುಮೋದನೆಯೊಂದಿಗೆ ನೀಡಲಾಗಿದೆ.",
      Gujarati: "આ પ્રાદેશિક નિયામકની મંજૂરી સાથે જારી કરવામાં આવે છે.",
      Marathi: "हे प्रादेशिक संचालकांच्या मान्यतेने जारी करण्यात आले आहे.",
      Spanish: "El presente se emite con la aprobación del Director Regional.",
      French: "Le présent est émis avec l'approbation du Directeur Régional.",
      Arabic: "صدر هذا بموافقة المدير الإقليمي.",
    },
  },
  {
    en: "You are directed to:",
    tr: {
      Hindi: "आपको निर्देशित किया जाता है:",
      Tamil: "உங்களுக்கு பின்வருமாறு உத்தரவிடப்படுகிறது:",
      Bengali: "আপনাকে নির্দেশ দেওয়া হলো:",
      Telugu: "మీరు ఈ క్రింది విధంగా ఆదేశించబడుతున్నారు:",
      Kannada: "ನಿಮಗೆ ಈ ಕೆಳಗಿನಂತೆ ಆದೇಶಿಸಲಾಗಿದೆ:",
      Gujarati: "તમને નીચે મુજબ નિર્દેશ આપવામાં આવે છે:",
      Marathi: "तुम्हाला खालीलप्रमाणे निर्देश देण्यात येत आहे:",
      Spanish: "Se le instruye lo siguiente:",
      French: "Il vous est enjoint ce qui suit :",
      Arabic: "يُوجَّه إليكم ما يلي:",
    },
  },
  {
    en: "Hand over charge of all records, cash and stationery in your custody to {1}.",
    tr: {
      Hindi: "अपने पास मौजूद सभी अभिलेखों, नकदी और स्टेशनरी का प्रभार {1} को सौंप दें।",
      Tamil: "உங்கள் பொறுப்பில் உள்ள அனைத்து பதிவேடுகள், ரொக்கம் மற்றும் எழுதுபொருட்களின் பொறுப்பை {1} அவர்களிடம் ஒப்படைக்கவும்.",
      Bengali: "আপনার কাছে থাকা সমস্ত রেকর্ড, নগদ ও স্টেশনারির দায়িত্ব {1} কে হস্তান্তর করুন।",
      Telugu: "మీ వద్ద ఉన్న అన్ని రికార్డులు, నగదు మరియు స్టేషనరీ బాధ్యతను {1} వారికి అప్పగించండి.",
      Kannada: "ನಿಮ್ಮ ವಶದಲ್ಲಿರುವ ಎಲ್ಲಾ ದಾಖಲೆಗಳು, ನಗದು ಮತ್ತು ಸ್ಟೇಷನರಿಗಳ ಜವಾಬ್ದಾರಿಯನ್ನು {1} ರವರಿಗೆ ಹಸ್ತಾಂತರಿಸಿ.",
      Gujarati: "તમારી પાસે રહેલા તમામ રેકોર્ડ, રોકડ અને સ્ટેશનરીનો હવાલો {1} ને સોંપી દો.",
      Marathi: "तुमच्याकडील सर्व नोंदी, रोख आणि स्टेशनरीचा कार्यभार {1} यांच्याकडे सोपवा.",
      Spanish: "Entregue el cargo de todos los registros, efectivo y material de oficina bajo su custodia a {1}.",
      French: "Remettez la charge de tous les registres, espèces et fournitures dont vous avez la garde à {1}.",
      Arabic: "سلّموا عهدة جميع السجلات والنقدية والقرطاسية الموجودة لديكم إلى {1}.",
    },
  },
  {
    en: "Submit the charge report and stock verification statement (VV) to this office within {1} working days of relief.",
    tr: {
      Hindi: "अवमुक्ति के {1} कार्य दिवसों के भीतर प्रभार रिपोर्ट और स्टॉक सत्यापन विवरण (वी.वी.) इस कार्यालय को प्रस्तुत करें।",
      Tamil: "விடுப்புக்குப் பிறகு {1} வேலை நாட்களுக்குள் பொறுப்பு அறிக்கை மற்றும் பங்கு சரிபார்ப்பு அறிக்கையை (வி.வி.) இந்த அலுவலகத்திற்கு சமர்ப்பிக்கவும்.",
      Bengali: "মুক্তির {1} কার্যদিবসের মধ্যে চার্জ রিপোর্ট ও স্টক যাচাই বিবরণী (ভি.ভি.) এই কার্যালয়ে জমা দিন।",
      Telugu: "బాధ్యత నుండి విముక్తి పొందిన {1} పని దినాలలోపు ఛార్జ్ నివేదిక మరియు స్టాక్ ధృవీకరణ ప్రకటన (VV) ను ఈ కార్యాలయానికి సమర్పించండి.",
      Kannada: "ಬಿಡುಗಡೆಯಾದ {1} ಕೆಲಸದ ದಿನಗಳ ಒಳಗೆ ಚಾರ್ಜ್ ವರದಿ ಮತ್ತು ಸ್ಟಾಕ್ ಪರಿಶೀಲನೆ ಹೇಳಿಕೆಯನ್ನು (VV) ಈ ಕಚೇರಿಗೆ ಸಲ್ಲಿಸಿ.",
      Gujarati: "મુક્તિ પછીના {1} કાર્ય દિવસોમાં ચાર્જ રિપોર્ટ અને સ્ટોક ચકાસણી વિધાન (વી.વી.) આ કાર્યાલયને સુપરત કરો.",
      Marathi: "मुक्तीनंतर {1} कामकाजाच्या दिवसांत चार्ज रिपोर्ट आणि स्टॉक तपासणी विवरण (व्ही.व्ही.) या कार्यालयाकडे सादर करा.",
      Spanish: "Presente el informe de entrega de cargo y la declaración de verificación de existencias (VV) a esta oficina dentro de los {1} días hábiles siguientes a su relevo.",
      French: "Veuillez soumettre le rapport de passation de charge et l'état de vérification des stocks (VV) à ce bureau dans les {1} jours ouvrables suivant votre relève.",
      Arabic: "قدّموا تقرير العهدة وكشف التحقق من المخزون (VV) إلى هذا المكتب خلال {1} أيام عمل من تاريخ الإخلاء.",
    },
  },
  {
    en: "Report for joining at the {1} on or before {2}.",
    tr: {
      Hindi: "{2} से पूर्व या उसी दिन {1} में कार्यभार ग्रहण करने हेतु रिपोर्ट करें।",
      Tamil: "{2} அன்று அல்லது அதற்கு முன் {1} இல் பணியில் சேர்வதற்கு அறிக்கை அளிக்கவும்.",
      Bengali: "{2} তারিখের মধ্যে বা সেই দিন {1} এ যোগদানের জন্য রিপোর্ট করুন।",
      Telugu: "{2} నాటికి లేదా ఆ రోజు {1} లో చేరడానికి నివేదించండి.",
      Kannada: "{2} ರೊಳಗೆ ಅಥವಾ ಆ ದಿನದೊಳಗೆ {1} ರಲ್ಲಿ ಸೇರಲು ವರದಿ ಮಾಡಿ.",
      Gujarati: "{2} ના રોજ અથવા તે પહેલાં {1} માં જોડાવા માટે રિપોર્ટ કરો.",
      Marathi: "{2} रोजी किंवा त्यापूर्वी {1} येथे रुजू होण्यासाठी अहवाल द्या.",
      Spanish: "Preséntese a incorporarse en {1} a más tardar el {2}.",
      French: "Rendez-vous pour prise de fonction à {1} au plus tard le {2}.",
      Arabic: "قدموا للالتحاق بالعمل في {1} في موعد أقصاه {2}.",
    },
  },
  {
    en: "Your joining report should be submitted to the {1}.",
    tr: {
      Hindi: "आपकी ज्वाइनिंग रिपोर्ट {1} को प्रस्तुत की जानी चाहिए।",
      Tamil: "உங்கள் சேரும் அறிக்கை {1} அவர்களிடம் சமர்ப்பிக்கப்பட வேண்டும்.",
      Bengali: "আপনার যোগদান রিপোর্ট {1} কে জমা দিতে হবে।",
      Telugu: "మీ జాయినింగ్ నివేదిక {1} వారికి సమర్పించాలి.",
      Kannada: "ನಿಮ್ಮ ಸೇರ್ಪಡೆ ವರದಿಯನ್ನು {1} ರವರಿಗೆ ಸಲ್ಲಿಸಬೇಕು.",
      Gujarati: "તમારો જોડાણ અહેવાલ {1} ને સુપરત કરવો જોઈએ.",
      Marathi: "तुमचा रुजू अहवाल {1} यांच्याकडे सादर करावा.",
      Spanish: "Su informe de incorporación deberá presentarse a {1}.",
      French: "Votre rapport de prise de fonction doit être soumis à {1}.",
      Arabic: "يجب تقديم تقرير التحاقكم بالعمل إلى {1}.",
    },
  },
  {
    en: "Any dues recoverable from your salary shall be adjusted against the transfer grant as per the VV statement.",
    tr: {
      Hindi: "आपके वेतन से वसूली योग्य कोई भी बकाया विवरण (वी.वी.) के अनुसार स्थानांतरण अनुदान के विरुद्ध समायोजित किया जाएगा।",
      Tamil: "உங்கள் சம்பளத்திலிருந்து வசூலிக்கப்பட வேண்டிய எந்த நிலுவைத் தொகையும் வி.வி. அறிக்கையின்படி மாற்று மானியத்திற்கு எதிராக சரிசெய்யப்படும்.",
      Bengali: "আপনার বেতন থেকে আদায়যোগ্য যেকোনো বকেয়া ভি.ভি. বিবরণী অনুযায়ী বদলি অনুদানের বিপরীতে সমন্বয় করা হবে।",
      Telugu: "మీ జీతం నుండి వసూలు చేయదగిన ఏదైనా బకాయి VV ప్రకటన ప్రకారం బదిలీ గ్రాంటుకు వ్యతిరేకంగా సర్దుబాటు చేయబడుతుంది.",
      Kannada: "ನಿಮ್ಮ ವೇತನದಿಂದ ವಸೂಲಿ ಮಾಡಬಹುದಾದ ಯಾವುದೇ ಬಾಕಿ ಮೊತ್ತವನ್ನು VV ಹೇಳಿಕೆಯ ಪ್ರಕಾರ ವರ್ಗಾವಣೆ ಅನುದಾನಕ್ಕೆ ವಿರುದ್ಧವಾಗಿ ಸರಿಹೊಂದಿಸಲಾಗುತ್ತದೆ.",
      Gujarati: "તમારા પગારમાંથી વસૂલાતી કોઈપણ બાકી રકમ વી.વી. વિધાન મુજબ ટ્રાન્સફર ગ્રાન્ટ સામે સમાયોજિત કરવામાં આવશે.",
      Marathi: "तुमच्या पगारातून वसूल करता येणारी कोणतीही थकीत रक्कम व्ही.व्ही. विवरणानुसार बदली अनुदानाविरुद्ध समायोजित केली जाईल.",
      Spanish: "Cualquier cantidad pendiente recuperable de su salario se ajustará contra la subvención de traslado conforme a la declaración VV.",
      French: "Toute somme due recouvrable sur votre salaire sera ajustée contre l'indemnité de mutation conformément à l'état VV.",
      Arabic: "سيتم تسوية أي مبالغ مستحقة قابلة للتحصيل من راتبكم مقابل منحة النقل وفقاً لكشف VV.",
    },
  },
  {
    en: "This delay has caused severe hardship to me and my family.",
    tr: {
      Hindi: "इस विलंब से मुझे और मेरे परिवार को गंभीर कठिनाई हुई है।",
      Tamil: "இந்த தாமதம் எனக்கும் என் குடும்பத்திற்கும் கடுமையான சிரமத்தை ஏற்படுத்தியுள்ளது.",
      Bengali: "এই বিলম্বে আমার ও আমার পরিবারের মারাত্মক অসুবিধা হয়েছে।",
      Telugu: "ఈ ఆలస్యం నాకు మరియు నా కుటుంబానికి తీవ్ర ఇబ్బంది కలిగించింది.",
      Kannada: "ಈ ವಿಳಂಬವು ನನಗೆ ಮತ್ತು ನನ್ನ ಕುಟುಂಬಕ್ಕೆ ತೀವ್ರ ತೊಂದರೆ ಉಂಟುಮಾಡಿದೆ.",
      Gujarati: "આ વિલંબથી મને અને મારા પરિવારને ગંભીર તકલીફ થઈ છે.",
      Marathi: "या विलंबामुळे मला आणि माझ्या कुटुंबाला गंभीर त्रास झाला आहे.",
      Spanish: "Este retraso ha causado graves dificultades a mí y a mi familia.",
      French: "Ce retard a causé de graves difficultés à moi et à ma famille.",
      Arabic: "تسبب هذا التأخير في مشقة شديدة لي ولأسرتي.",
    },
  },
  {
    en: "I request that the matter be examined urgently and my pending pension be credited at the earliest, along with interest as per rules.",
    tr: {
      Hindi: "मेरा अनुरोध है कि मामले की तुरंत जाँच की जाए और मेरी लंबित पेंशन नियमों के अनुसार ब्याज सहित शीघ्र अतिशीघ्र जमा की जाए।",
      Tamil: "இந்த விஷயத்தை அவசரமாக பரிசீலித்து, எனது நிலுவையில் உள்ள ஓய்வூதியத்தை விதிகளின்படி வட்டியுடன் விரைவில் வழங்குமாறு கேட்டுக்கொள்கிறேன்.",
      Bengali: "আমার অনুরোধ যে বিষয়টি জরুরিভাবে পরীক্ষা করা হোক এবং আমার বকেয়া পেনশন নিয়ম অনুযায়ী সুদসহ দ্রুত জমা করা হোক।",
      Telugu: "విషయాన్ని అత్యవసరంగా పరిశీలించి, నా పెండింగ్ పెన్షన్ను నియమాల ప్రకారం వడ్డీతో సహా వీలైనంత త్వరగా జమ చేయాలని నేను అభ్యర్థిస్తున్నాను.",
      Kannada: "ವಿಷಯವನ್ನು ತುರ್ತಾಗಿ ಪರಿಶೀಲಿಸಿ, ನನ್ನ ಬಾಕಿ ಪಿಂಚಣಿಯನ್ನು ನಿಯಮಗಳ ಪ್ರಕಾರ ಬಡ್ಡಿ ಸಹಿತ ಶೀಘ್ರದಲ್ಲೇ ಜಮಾ ಮಾಡಬೇಕೆಂದು ನಾನು ವಿನಂತಿಸುತ್ತೇನೆ.",
      Gujarati: "મારી વિનંતી છે કે બાબતની તાત્કાલિક તપાસ કરવામાં આવે અને મારી બાકી પેન્શન નિયમો મુજબ વ્યાજ સહિત શક્ય તેટલી વહેલી જમા કરવામાં આવે.",
      Marathi: "माझी विनंती आहे की या प्रकरणाची तातडीने तपासणी करावी आणि माझी प्रलंबित पेन्शन नियमांनुसार व्याजासह शक्य तितक्या लवकर जमा करावी.",
      Spanish: "Solicito que el asunto sea examinado con urgencia y que mi pensión pendiente sea abonada a la mayor brevedad, con los intereses conforme a las normas.",
      French: "Je demande que l'affaire soit examinée en urgence et que ma pension en attente soit créditée au plus tôt, avec intérêts conformément aux règles.",
      Arabic: "أطلب فحص الموضوع على وجه الاستعجال وصرف معاشي المستحق في أقرب وقت مع الفوائد وفقاً للقواعد.",
    },
  },
  {
    en: "Despite submitting the life certificate through DigiLocker on {1} and receiving acknowledgement Ref. No. {2}, the payment has not been released.",
    tr: {
      Hindi: "{1} को डिजिलॉकर के माध्यम से जीवन प्रमाण पत्र प्रस्तुत करने और संदर्भ संख्या {2} की पावती प्राप्त करने के बावजूद, भुगतान जारी नहीं किया गया है।",
      Tamil: "{1} அன்று டிஜிலாக்கர் மூலம் வாழ்க்கை சான்றிதழை சமர்ப்பித்து, குறிப்பு எண் {2} பெறுப்புச் சீட்டைப் பெற்ற போதிலும், கட்டணம் வெளியிடப்படவில்லை.",
      Bengali: "{1} তারিখে ডিজিলকারের মাধ্যমে জীবন শংসাপত্র জমা দেওয়া এবং রেফারেন্স নং {2} এর প্রাপ্তি স্বীকার করা সত্ত্বেও, পেমেন্ট প্রকাশ করা হয়নি।",
      Telugu: "{1} న డిజిలాకర్ ద్వారా జీవిత ధృవీకరణ పత్రాన్ని సమర్పించి, రిఫరెన్స్ నం {2} రసీదును పొందినప్పటికీ, చెల్లింపు విడుదల చేయబడలేదు.",
      Kannada: "{1} ರಂದು ಡಿಜಿಲಾಕರ್ ಮೂಲಕ ಜೀವನ ಪ್ರಮಾಣಪತ್ರವನ್ನು ಸಲ್ಲಿಸಿ, ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ {2} ರಶೀದಿಯನ್ನು ಪಡೆದಿದ್ದರೂ, ಪಾವತಿಯನ್ನು ಬಿಡುಗಡೆ ಮಾಡಲಾಗಿಲ್ಲ.",
      Gujarati: "{1} ના રોજ ડિજિલોકર દ્વારા જીવન પ્રમાણપત્ર સુપરત કર્યા પછી અને સંદર્ભ નં {2} ની સ્વીકૃતિ મેળવ્યા પછી પણ, ચુકવણી બહાર પાડવામાં આવી નથી.",
      Marathi: "{1} रोजी डिजिलॉकरद्वारे जीवन प्रमाणपत्र सादर करून आणि संदर्भ क्र {2} ची पावती मिळूनही, पेमेंट जारी करण्यात आलेले नाही.",
      Spanish: "A pesar de haber presentado el certificado de vida a través de DigiLocker el {1} y de haber recibido el acuse de recibo Ref. N.º {2}, el pago no ha sido liberado.",
      French: "Malgré la soumission du certificat de vie via DigiLocker le {1} et la réception de l'accusé de réception Réf. n° {2}, le paiement n'a pas été libéré.",
      Arabic: "على الرغم من تقديم شهادة الحياة عبر DigiLocker في {1} واستلام إشعار الاستلام المرجع رقم {2}، لم يتم صرف الدفعة.",
    },
  },
  {
    en: "I have visited the pension disbursing office three times and called the helpline on each occasion; no resolution has been provided so far.",
    tr: {
      Hindi: "मैंने तीन बार पेंशन वितरण कार्यालय का दौरा किया है और हर बार हेल्पलाइन पर कॉल किया है; अब तक कोई समाधान नहीं मिला है।",
      Tamil: "நான் மூன்று முறை ஓய்வூதிய வழங்கும் அலுவலகத்திற்குச் சென்று ஒவ்வொரு முறையும் ஹெல்ப்லைனை அழைத்துள்ளேன்; இதுவரை எந்த தீர்வும் வழங்கப்படவில்லை.",
      Bengali: "আমি তিনবার পেনশন প্রদানকারী কার্যালয়ে গিয়েছি এবং প্রতিবার হেল্পলাইনে কল করেছি; এ পর্যন্ত কোনো সমাধান পাওয়া যায়নি।",
      Telugu: "నేను మూడుసార్లు పెన్షన్ పంపిణీ కార్యాలయాన్ని సందర్శించాను మరియు ప్రతిసారీ హెల్ప్లైన్కు కాల్ చేసాను; ఇప్పటివరకు పరిష్కారం అందించబడలేదు.",
      Kannada: "ನಾನು ಮೂರು ಬಾರಿ ಪಿಂಚಣಿ ವಿತರಣಾ ಕಚೇರಿಗೆ ಭೇಟಿ ನೀಡಿದ್ದೇನೆ ಮತ್ತು ಪ್ರತಿ ಬಾರಿಯೂ ಹೆಲ್ಪ್‌ಲೈನ್‌ಗೆ ಕರೆ ಮಾಡಿದ್ದೇನೆ; ಇಲ್ಲಿಯವರೆಗೆ ಯಾವುದೇ ಪರಿಹಾರವನ್ನು ನೀಡಲಾಗಿಲ್ಲ.",
      Gujarati: "મેં ત્રણ વખત પેન્શન વિતરણ કાર્યાલયની મુલાકાત લીધી છે અને દરેક વખતે હેલ્પલાઇન પર કૉલ કર્યો છે; અત્યાર સુધી કોઈ ઉકેલ આપવામાં આવ્યો નથી.",
      Marathi: "मी तीन वेळा पेन्शन वितरण कार्यालयाला भेट दिली आहे आणि प्रत्येक वेळी हेल्पलाइनवर कॉल केला आहे; आतापर्यंत कोणताही उपाय देण्यात आलेला नाही.",
      Spanish: "He visitado la oficina de pago de pensiones en tres ocasiones y he llamado a la línea de ayuda cada vez; hasta ahora no se ha proporcionado ninguna solución.",
      French: "Je me suis rendu trois fois au bureau de paiement des pensions et j'ai appelé la ligne d'assistance à chaque occasion ; aucune solution n'a été apportée jusqu'à présent.",
      Arabic: "لقد زرت مكتب صرف المعاشات ثلاث مرات واتصلت بخط المساعدة في كل مرة؛ ولم يتم تقديم أي حل حتى الآن.",
    },
  },
  {
    en: "I have enclosed a copy of the acknowledgement and my PPO for reference.",
    tr: {
      Hindi: "संदर्भ के लिए मैंने पावती की एक प्रति और अपना पी.पी.ओ. संलग्न किया है।",
      Tamil: "குறிப்புக்காக பெறுப்புச் சீட்டின் நகல் மற்றும் எனது பி.பி.ஓ.வை இணைத்துள்ளேன்.",
      Bengali: "রেফারেন্সের জন্য আমি প্রাপ্তি স্বীকারের একটি অনুলিপি এবং আমার পি.পি.ও. সংযুক্ত করেছি।",
      Telugu: "సూచన కోసం రసీదు కాపీని మరియు నా PPO ను జోడించాను.",
      Kannada: "ಉಲ್ಲೇಖಕ್ಕಾಗಿ ರಶೀದಿಯ ಪ್ರತಿ ಮತ್ತು ನನ್ನ PPO ಅನ್ನು ಲಗತ್ತಿಸಿದ್ದೇನೆ.",
      Gujarati: "સંદર્ભ માટે મેં સ્વીકૃતિની એક નકલ અને મારો પી.પી.ઓ. જોડ્યો છે.",
      Marathi: "संदर्भासाठी मी पावतीची एक प्रत आणि माझा पी.पी.ओ. जोडला आहे.",
      Spanish: "He adjuntado una copia del acuse de recibo y mi PPO para su referencia.",
      French: "J'ai joint une copie de l'accusé de réception et mon PPO pour référence.",
      Arabic: "أرفقت نسخة من إشعار الاستلام وشهادة المعاش الخاصة بي للاطلاع.",
    },
  },
  // -------------------------------------------------------------------
  // Non-CMPF Appointment Order (Department of Revenue Administration)
  // -------------------------------------------------------------------
  {
    // {1} = advertisement code (RA/19-2025), {2} = the posting designation
    // (translated by the refine pass's Latin-group pass), {3} = the effective
    // date (month names read in Devanagari via the capture rule).
    en: "In continuation of the selection process notified under Advertisement No. {1} and on the recommendation of the Departmental Promotion Committee, this department hereby appoints you as {2}, with effect from the forenoon of {3}, on the terms and conditions contained in the appointment proforma annexed hereto.",
    tr: {
      Hindi: "विज्ञापन संख्या {1} के अंतर्गत अधिसूचित चयन प्रक्रिया की निरंतरता में तथा विभागीय पदोन्नति समिति की सिफारिश पर, यह विभाग आपको {3} की पूर्वाह्न से प्रभावी रूप से {2} के रूप में नियुक्त करता है। नियुक्ति की शर्तें संलग्न नियुक्ति प्रपत्र में निहित हैं।",
    },
  },
  {
    en: "You are directed to report for joining to the Principal Secretary, Department of Revenue Administration, within fifteen days of the date of this order.",
    tr: {
      Hindi: "आपको इस आदेश की तिथि से पंद्रह दिनों के भीतर राजस्व प्रशासन विभाग के प्रधान सचिव के समक्ष कार्यभार ग्रहण हेतु रिपोर्ट करने का निर्देश दिया जाता है।",
    },
  },
  {
    en: "The terms of appointment, including pay band and allowances, shall be as prescribed in the annexed proforma.",
    tr: {
      Hindi: "वेतनमान एवं भत्तों सहित नियुक्ति की शर्तें संलग्न प्रपत्र में निर्धारित अनुसार होंगी।",
    },
  },
  {
    en: "This issues with the approval of the competent authority.",
    tr: {
      Hindi: "यह आदेश सक्षम प्राधिकारी के अनुमोदन से जारी किया गया है।",
    },
  },
  // -------------------------------------------------------------------
  // Second non-CMPF letter: University Notice (Kalinga University)
  // -------------------------------------------------------------------
  {
    // {1} = notification code (KU/EXAM/2026/88), {2} = academic session
    // (2025-26), {3} = start date (month names read in Devanagari via the
    // capture rule).
    en: "In continuation of the examination calendar notified under Notification No. {1}, all students of the first and second year are hereby informed that the annual examinations for the academic session {2} shall commence from {3} in the forenoon session.",
    tr: {
      Hindi: "अधिसूचना संख्या {1} के अंतर्गत अधिसूचित परीक्षा कैलेंडर की निरंतरता में, प्रथम एवं द्वितीय वर्ष के सभी छात्रों को सूचित किया जाता है कि शैक्षणिक सत्र {2} की वार्षिक परीक्षाएँ {3} को पूर्वाह्न सत्र में प्रारंभ होंगी।",
    },
  },
  {
    en: "The examination schedule, hall ticket distribution and the syllabus of the papers shall be communicated by the respective department heads in due course.",
    tr: {
      Hindi: "परीक्षा कार्यक्रम, प्रवेश पत्र वितरण तथा प्रश्नपत्रों का पाठ्यक्रम संबंधित विभागाध्यक्षों द्वारा समय पर सूचित किया जाएगा।",
    },
  },
  {
    // {1} = fee amount (1200), {2} = last date (month names read in
    // Devanagari via the capture rule).
    en: "Students are directed to deposit the examination fee of Rs. {1}/- with the examination section on or before {2}.",
    tr: {
      Hindi: "छात्रों को निर्देशित किया जाता है कि वे परीक्षा शुल्क रु. {1}/- परीक्षा अनुभाग में {2} को या उससे पूर्व जमा करें।",
    },
  },
  {
    en: "Those who fail to deposit the fee within the prescribed period shall not be permitted to appear in the examinations.",
    tr: {
      Hindi: "निर्धारित अवधि के भीतर शुल्क जमा न करने वाले छात्रों को परीक्षाओं में उपस्थित होने की अनुमति नहीं दी जाएगी।",
    },
  },
  {
    en: "Any discrepancy in the enrolment particulars of a student may be brought to the notice of the examination section immediately.",
    tr: {
      Hindi: "किसी छात्र के नामांकन विवरण में किसी भी विसंगति को तुरंत परीक्षा अनुभाग के संज्ञान में लाया जा सकता है।",
    },
  },
];

/** Lazy-cache compiled matchers. */
// ---------------------------------------------------------------------------
// Word-level token data (the term pass reads these; the algorithms live in
// translate.ts). New letters grow coverage by adding tokens/names here — no
// engine code changes.
// ---------------------------------------------------------------------------
export const HI_ABBR = new Set(["hq", "ahq", "coll", "dept", "sec", "no"]);

export const HI_PHRASES: Array<[RegExp, string]> = [
  [
    // "(From 20.04.2015 to 05.06.2025)" → "(20.04.2015 से 05.06.2025 तक)" —
    // the stint dates read in Devanagari with dot separators, exactly the
    // reference letters' table cells (01-08-2007 To 19-05-2023 →
    // 01.08.2007 से 19.05.2023 तक).
    /from\s+(\d{1,2})[-/.]?(\d{1,2})[-/.]?(\d{2,4})\s+to\s+(\d{1,2})[-/.]?(\d{1,2})[-/.]?(\d{2,4})/gi,
    "$1.$2.$3 से $4.$5.$6 तक",
  ],
  // "Open Cast Mine" → "ओपनकास्ट माइन" — the compound reads as one word.
  [/\bopen\s+cast\b/gi, "ओपनकास्ट"],
  // "Department of Revenue Administration" → "राजस्व प्रशासन विभाग" — the
  // adjective-before-noun department name (the plain token pass would yield
  // the unidiomatic "विभाग राजस्व प्रशासन").
  [/\bdepartment of revenue administration\b/gi, "राजस्व प्रशासन विभाग"],
  // "Under Secretary to Government" → "सरकार के उप सचिव" — the closing
  // designation of the appointment family.
  [/\bunder secretary to government\b/gi, "सरकार के उप सचिव"],
  // "State University of Technology" → "राज्य प्रौद्योगिकी विश्वविद्यालय" —
  // the university-noun order reads adjective-before-noun (the plain token
  // pass would yield "राज्य विश्वविद्यालय प्रौद्योगिकी").
  [/\bstate university of technology\b/gi, "राज्य प्रौद्योगिकी विश्वविद्यालय"],
  // "Controller of Examinations" → "परीक्षा नियंत्रक" — the university
  // closing designation (the plain token pass would keep word order
  // "नियंत्रक परीक्षा").
  [/\bcontroller of examinations\b/gi, "परीक्षा नियंत्रक"],
  // "pay band" → "वेतनमान" — the salary term reads as one word.
  [/\bpay band\b/gi, "वेतनमान"],
  // "Appointment Order" → "नियुक्ति आदेश".
  [/^appointment order$/i, "नियुक्ति आदेश"],
  // "PO-Jayant Dist-Singrauli" → "पो-जयंत, जिला-सिंगरौली" — the address
  // label pair reads with a comma, exactly as the reference letters set it.
  [/(पो|पिन)-([\u0900-\u097F]+)\s+जिला-/g, "$1-$2, जिला-"],
  [/region\s*[-:–—]\s*(iii|ii|iv|v|i|\d+)/gi, "क्षेत्र-$1"],
  // "District. Paschim Burdwan" → "जिला. पश्चिम बर्धमान" and
  // "Dist-Singrauli" → "जिला-सिंगरौली" — the separator (period or dash) is
  // preserved, exactly as the reference letters set each variant.
  [/^(district)([.\s-]+)/i, "जिला$2"],
  // "Coll iery" → "कोलियरी" — OCR splits "Colliery" mid-word in a table
  // cell (letter 212: "Khandra Coll iery ., Bankola Area"), leaving an
  // untranslatable "iery" token; the fused phrase restores the word so the
  // token pass renders the whole cell.
  [/\bcoll\s+iery\b/gi, "कोलियरी"],
  // "Ballar pur Colliery" → "बल्लारपुर कोलियरी" — OCR splits the mine name.
  [/\bballar\s+pur\b/gi, "बल्लारपुर"],
  // "Bhowra (s) Colliery" — the parenthesized s is the mine's South suffix.
  [/\(\s*s\s*\)\s*(?:colliery|colliary)/gi, "(दक्षिण) कोलियरी"],
  // "Sub P.O. SECL" → "उप डाकघर एसईसीएल" — the post-office abbreviation
  // reads डाकघर after उप, and पो on its own (PO-Jagruti → पो-जागृति). All
  // trailing dots are consumed ("Sub P.O." → "उप डाकघर", not "उप डाकघर.").
  [/\bsub\s+p\.?o\.{0,2}(?=\s|[.,;:])/gi, "उप डाकघर"],
  // "CCL HQ.Ranchi University" → "सीसीएल मुख्यालय, रांची विश्वविद्यालय" —
  // the HQ abbreviation glues its dot to the next word in the scanned
  // Ranchi letter; the comma makes the office term read as its own unit.
  [/\bhq\.(?=[A-Z])/gi, "मुख्यालय, "],
  // "जिला-सिंगरौली-486890" → "जिला-सिंगरौली- 486890" — the PIN rides on
  // its own space after the hyphen, exactly as the reference letters set it.
  // PIN spacing, exactly as the reference letters set it: the en-dash the
  // District lines carry glues to the word ("बर्धमान – 713303" →
  // "बर्धमान- 713303"), a hyphen fused to the word gets a space before the
  // PIN ("सिंगरौली-486890" → "सिंगरौली- 486890"), and a fully spaced
  // "छत्तीसगढ़ - 495006" glues the dash too. A bare पिन-826014 / पिन:- 759116
  // stays glued (the पिन label keeps its source shape), and "नागपुर -440014"
  // (dash already fused to the PIN) is left alone.
  [/([\u0900-\u097F]+)(?<!पिन)\s*[–—]\s*(\d{5,6})\b/g, "$1- $2"],
  [/([\u0900-\u097F]+)(?<!पिन)-(\d{5,6})\b/g, "$1- $2"],
  [/([\u0900-\u097F]+)(?<!पिन) - (\d{5,6})\b/g, "$1- $2"],
];

export const HI_TOKENS: Record<string, string> = {
  // honorifics
  shri: "श्री", smt: "श्रीमती", dr: "डॉ.", mr: "श्री", mrs: "श्रीमती",
  // mining / colliery terms
  coll: "कोलियरी", colliery: "कोलियरी", colliary: "कोलियरी", area: "क्षेत्र",
  office: "कार्यालय", hq: "मुख्यालय", ahq: "एएचक्यू", ecl: "ईसीएल",
  bccl: "बीसीसीएल", ccl: "सीसीएल", kuju: "कुजू", pundi: "पुंडी",
  lodna: "लोदना", bhowra: "बोरा", samdih: "समदीह", patherdih: "पथेरडीह",
  incline: "इनक्लाइन", amalgated: "समामेलित", amalgamated: "समामेलित",
  khandra: "खंडरा", bankola: "बांकोला", bahula: "बहुला", moira: "मोइरा",
  bina: "बीना", kenda: "केंदा", lower: "लोअर",
  ballarpur: "बल्लारपुर", ballar: "बल्लार", pur: "पुर", pits: "पिट्स",
  chora: "छोरा", block: "ब्लॉक", blk: "ब्लॉक",
  // organization
  coal: "कोयला", mines: "खान", provident: "भविष्य", fund: "निधि",
  organisation: "संगठन", organization: "संगठन",
  college: "कॉलेज", road: "रोड", asansol: "आसनसोल", "b.b": "बी.बी.",
  region: "क्षेत्र", district: "जिला", paschim: "पश्चिम", burdwan: "बर्धमान",
  bengal: "बंगाल", west: "पश्चिम",
  // generic government-correspondence vocabulary (Appointment Orders and
  // other non-CMPF department letters)
  revenue: "राजस्व", administration: "प्रशासन", civil: "सिविल",
  secretariat: "सचिवालय", gandhinagar: "गांधीनगर", grade: "ग्रेड",
  appointment: "नियुक्ति", order: "आदेश", posting: "पदस्थापन",
  central: "केंद्रीय", division: "प्रभाग", selection: "चयन",
  process: "प्रक्रिया", notified: "अधिसूचित", advertisement: "विज्ञापन",
  recommendation: "सिफारिश", promotion: "पदोन्नति", committee: "समिति",
  effect: "प्रभाव", forenoon: "पूर्वाह्न", terms: "शर्तें",
  conditions: "शर्तों", proforma: "प्रपत्र", annexed: "संलग्न",
  directed: "निर्देशित", report: "रिपोर्ट", joining: "कार्यभार",
  principal: "प्रधान", within: "भीतर", fifteen: "पंद्रह", days: "दिनों",
  allowances: "भत्ते", prescribed: "निर्धारित", issues: "जारी",
  approval: "अनुमोदन", competent: "सक्षम", under: "उप",
  // offices, places and codes recurring in CMPF / government correspondence
  cmpf: "सीएमपीएफ", "c.m.p.f": "सीएमपीएफ", police: "पुलिस",
  line: "लाइन", lines: "लाइन", dhanbad: "धनबाद",
  singrauli: "सिंगरौली", jayant: "जयंत", nagpur: "नागपुर",
  maharashtra: "महाराष्ट्र", madhya: "मध्य", pradesh: "प्रदेश",
  jharkhand: "झारखंड", odisha: "ओडिशा", talcher: "तालचेर",
  ranchi: "रांची", morabadi: "मोराबादी", darbhanga: "दरभंगा",
  house: "हाउस", university: "विश्वविद्यालय", r: "आर",
  // university-notice vocabulary (the Kalinga University letter) and the
  // general terms its address lines need
  kalinga: "कलिंगा", administrative: "प्रशासनिक", bhubaneswar: "भुवनेश्वर",
  cuttack: "कटक", technology: "प्रौद्योगिकी", controller: "नियंत्रक",
  examination: "परीक्षा", examinations: "परीक्षाएँ", students: "छात्रों",
  schedule: "कार्यक्रम", syllabus: "पाठ्यक्रम", deposit: "जमा", fee: "शुल्क",
  academic: "शैक्षणिक", session: "सत्र", annual: "वार्षिक", notice: "अधिसूचना",
  // the MCL regional-office address block (Susanta Kumar Nayak letter)
  mcl: "एमसीएल", complex: "कॉम्प्लेक्स", anandvihar: "आनंदविहार",
  jagruti: "जागृति", vihar: "विहार", sambalpur: "संबलपुर",
  bilaspur: "बिलासपुर", chhattisgarh: "छत्तीसगढ़",
  // OCR/travel variants of the same names (Bilaspur 135 spells the street
  // "Sreepat" and the state "Chhatisgarh" — single t).
  sreepat: "श्रीपत", shripat: "श्रीपत", chhatisgarh: "छत्तीसगढ़",
  po: "पो", "p.o": "पो", pin: "पिन",
  // Talcher / Nagpur / Dhanbad address blocks
  ro: "क्षे.का.", "r.o": "क्षे.का.", at: "एटी", "a.t": "एटी",
  colony: "कॉलोनी", jagannath: "जगन्नाथ", south: "साउथ", balanda: "बालंदा",
  "p.s": "पीएस", dist: "जिला", state: "राज्य", angul: "अंगुल",
  jaripatka: "जरीपटका", d: "डी", secl: "एसईसीएल", sub: "उप",
  // colliery / project terms used in member-table cells
  mic: "मिक", jhanjra: "झांझरा", project: "प्रोजेक्ट", gouri: "गौरी",
  opencast: "ओपनकास्ट", mine: "माइन", "no.1": "नं.1", number: "नं.",
  // designations
  assistant: "सहायक", deputy: "उप", joint: "संयुक्त", chief: "मुख्य",
  commissioner: "आयुक्त", director: "निदेशक", registrar: "रजिस्ट्रार",
  secretary: "सचिव", officer: "अधिकारी", manager: "प्रबंधक",
  regional: "क्षेत्रीय", authority: "प्राधिकरण",
  bank: "बैंक", india: "भारत", government: "सरकार",
  ministry: "मंत्रालय", department: "विभाग",
  // structural words — dropped so "Office of the Commissioner" reads
  // "कार्यालय आयुक्त" (of → dropped, the → dropped; "at" keeps its address
  // meaning "एटी" for "AT:- Jagannath colony")
  the: "", of: "", in: "", with: "", for: "", and: "",
  // roman numerals in office/region codes stay Latin
  i: "I", ii: "II", iii: "III", iv: "IV", v: "V",
};

export const NAME_TABLE: Record<string, string> = {
  "tonmoy bhattacharjee": "तन्मय भट्टाचार्य",
  "hirok sarkar": "हिरोक सरकार",
  "bhaskar kumar sinha": "भास्कर कुमार सिन्हा",
  "anand kumar dubey": "आनंद कुमार दुबे",
  "lakshmidhar das": "लक्ष्मीधर दास",
  "kishore ram ratan": "किशोर राम रतन",
  "ravindra yadav": "रविंद्र यादव",
  "surendra koiri": "सुरेंद्र कोइरी",
  "khadal jena": "खदल जेना",
  "susanta kumar nayak": "सुशांत कुमार नायक",
  "raja venkatesh bodiga": "राजा वेंकटेश बोडिगा",
  "late raja venkatesh bodiga": "स्वर्गीय राजा वेंकटेश बोडिगा",
  "ajay kumar singh": "अजय कुमार सिंह",
  "usha rani devi": "उषा रानी देवी",
  // The L.C.-REQ / L.C.-OUT letters beyond the original ten.
  "sanjay kumar singh": "संजय कुमार सिंह",
  "binay kumar pattanayak": "बिनय कुमार पट्टनायक",
  "saikat mondal": "सैकत मोंडल",
  "surjakanta nayak": "सुरजकांता नायक",
  "dharamraj kurmi": "धर्मराज कुर्मी",
  "anil rajbhar": "अनिल राजभर",
  // The non-CMPF Appointment Order letter (inbox fixture).
  "rajesh mehra": "राजेश मेहरा",
  "anita deshpande": "अनिता देशपांडे",
  // The second non-CMPF letter (inbox university notice). The org-name
  // lines sit ABOVE the To-block, where the whole-line name pass runs before
  // the term pass — a direct table hit keeps them from the generic
  // transliteration (कलिंगा उनिवेरसितय).
  "sujata mishra": "सुजाता मिश्रा",
  "kalinga university": "कलिंगा विश्वविद्यालय",
};
export const CODE_TOKEN_RE = /^[A-Z][A-Z0-9]*(?:[\/\-.][A-Z0-9]+)+$/;

// ---------------------------------------------------------------------------
// Reference / file-number / account-code transliteration (Hindi): the
// alphabetic components of official codes are rendered in Devanagari while
// digits, separators and roman numerals stay untouched — exactly as the CMPFO
// reference letters do (सीपीएफ/118/विविध/एल.सी.-आउट/आर-I/एएसएन/).
// ---------------------------------------------------------------------------
export const REF_TOKENS: Record<string, string> = {
  cpf: "सीपीएफ", misc: "विविध",
  original: "मूल", one: "एक", nos: "संख्या", number: "संख्या",
  "l.c": "एल.सी.",
  out: "आउट", in: "इन", req: "रिक्वेस्ट", request: "रिक्वेस्ट", incoming: "इनकमिंग",
  extract: "एक्सट्रैक्ट", ext: "एक्सट्रैक्ट",
  rnj: "आरएनजे", ngp: "एनजीपी", bkr: "बीकेआर", asn: "एएसएन", rmg: "आरएमजी",
  dhn: "डीएचएन", blp: "बीएलपी",  sbp: "एसबीपी", nag: "एनएजी", sing: "सिंग", tlhr: "टीएलएचआर",
  dgr: "डीजीआर", jbp: "जेबीपी", bbsr: "बीबीएसआर", cbi: "सीबीआई", ug: "यूजी",
  dept: "डीईपीटी",
  ecl: "ईसीएल", bccl: "बीसीसीएल", wcl: "डब्ल्यूसीएल", mcl: "एमसीएल",
  // place names in ref / code lines (full address blocks use HI_TOKENS)
  dhanbad: "धनबाद", asansol: "आसनसोल", talcher: "तालचेर", nagpur: "नागपुर",
  sambalpur: "संबलपुर", bilaspur: "बिलासपुर", singrauli: "सिंगरौली",
  angul: "अंगुल", jharkhand: "झारखंड", odisha: "ओडिशा", jayant: "जयंत",
  jaripatka: "जरीपटका",
  // single letters (roman numerals i/v/x stay Latin)
  a: "ए", b: "बी", c: "सी", d: "डी", e: "ई", f: "एफ", g: "जी", h: "एच",
  j: "जे", k: "के", l: "एल", m: "एम", n: "एन", o: "ओ", p: "पी", q: "क्यू",
  r: "आर", s: "एस", t: "टी", u: "यू", w: "डब्ल्यू", y: "वाई", z: "ज़ेड",
};

export const ROMAN_RE = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i;

/** Transliterate the alphabetic components of a file/reference/account code
 * into Hindi; digits, separators and roman numerals stay unchanged. An inline
 * "Date:" label (PDFs often carry the file number and date on one line, e.g.
 * "CPF/118/…/ASN/ Date: 09-07-2026") is localized to दिनांक: exactly like the
 * standalone date line, so the header reads in Devanagari either way. */

export const NAME_DIGRAPHS: Array<[string, string]> = [
  ["shri", "श्री"], ["singh", "सिंह"], ["chh", "छ"], ["sh", "श"],
  ["jh", "झ"], ["kh", "ख"], ["gh", "घ"], ["th", "थ"], ["ph", "फ"],
  ["bh", "भ"], ["dh", "ध"], ["ch", "च"], ["tr", "त्र"], ["pr", "प्र"],
  ["kr", "क्र"], ["gr", "ग्र"], ["dr", "द्र"], ["sr", "स्र"],
  ["tt", "ट्ट"], ["dd", "ड्ड"], ["pp", "प्प"], ["kk", "क्क"],
  ["ll", "ल्ल"], ["nn", "न्न"], ["mm", "म्म"], ["bb", "ब्ब"],
  ["ss", "स्स"], ["cc", "च्च"], ["rr", "र्र"],
];
export const NAME_CONS: Record<string, string> = {
  k: "क", g: "ग", c: "क", j: "ज", t: "त", d: "द", n: "न", p: "प",
  b: "ब", m: "म", y: "य", r: "र", l: "ल", v: "व", s: "स", h: "ह",
  f: "फ", z: "ज़", q: "क", x: "क्ष", w: "व",
};
export const NAME_VOWEL_START: Record<string, string> = {
  a: "अ", aa: "आ", i: "इ", ii: "ई", ee: "ई", u: "उ", uu: "ऊ", oo: "ऊ",
  e: "ए", ai: "ऐ", au: "औ", o: "ओ",
};
export const NAME_VOWEL_MID: Record<string, string> = {
  a: "", aa: "ा", i: "ि", ii: "ी", ee: "ी", u: "ु", uu: "ू", oo: "ू",
  e: "े", ai: "ै", au: "ौ", o: "ो",
};


// ---------------------------------------------------------------------------
// Reference-code and name-transliteration tables (the algorithms live in
// translate.ts). Coverage grows here — no engine code changes.
// ---------------------------------------------------------------------------

/** Lazy-cache compiled matchers — only the `hi` (post-pass) family. */
const compiled = GLOSSARY.filter((e): e is GlossaryEntry & { hi: string } => Boolean(e.hi))
  .map((e) => ({ entry: e, re: templateRegex(e.en) }));

/**
 * Translate a single English sentence through the domain translation memory.
 * Returns the Hindi template with slots filled (slot values translated via
 * the entry's slotMap where known, else kept verbatim), or null on a miss.
 * A leading list number ("1. Hand over…") is stripped before matching and
 * re-attached to the output.
 */
export function translateWithGlossary(sentence: string): string | null {
  const s = sentence.trim();
  const norm = normalize(s);
  if (norm.length < 4) return null;
  const list = s.match(/^(\d+[.)])\s*/);
  const body = list ? s.slice(list[0].length) : s;
  for (const { entry, re } of compiled) {
    if (normalize(entry.en) === norm) {
      return entry.hi; // exact template hit — no slots
    }
    const m = body.match(re);
    if (!m) continue;
    const slots = entry.en.match(/\{(\w+)\}/g) ?? [];
    let out = entry.hi;
    for (let i = 0; i < slots.length; i++) {
      const name = slots[i].slice(1, -1);
      const raw = (m[i + 1] ?? "").trim();
      out = out.replace(`{${name}}`, fillSlot(raw, entry.slotMap));
    }
    return list ? `${list[1]} ${out}` : out;
  }
  return null;
}
