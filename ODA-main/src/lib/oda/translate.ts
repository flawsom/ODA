// ODA Formal Document Translation — the free, keyless path.
//
// The neural forge (on-device Qwen2.5, or the cloud providers — including the
// zero-config Freebuff Cloud AI) is the primary translator and handles ANY
// document in full. This module is the honest instant fallback: it translates
// every label, salutation, valediction, table header, the standard address
// block (in Hindi), and the highest-frequency formal prose sentences in the
// selected language, keeps the letterhead (organization name, address, contact
// details) exactly as-is, keeps names, numbers, references, dates and amounts
// untouched — and clearly marks prose lines that still need the neural forge.
// Nothing is silently left half-done.

import { kitFor, type AdaptiveDoc, type AdaptiveOptions } from "./adaptive";
import {
  CODE_TOKEN_RE,
  GLOSSARY,
  HI_ABBR,
  HI_PHRASES,
  HI_TOKENS,
  MONTHS,
  NAME_CONS,
  NAME_DIGRAPHS,
  NAME_TABLE,
  NAME_VOWEL_MID,
  NAME_VOWEL_START,
  REF_TOKENS,
  ROMAN_RE,
  type GlossaryEntry,
} from "./glossary";
import type { GlossaryOverlay } from "./extraDict";
import { trackHit } from "./hitTracker";

export interface TranslateResult {
  content: string;
  strategy: "adaptive";
  complete: boolean;
}

const SALUTATION = [
  /^(respected|dear)\s+(sir|madam|sir\/madam|sir and madam)[,;:.]?$/i,
  /^sir[,;:.]?$/i,
  /^madam[,;:.]?$/i,
  /^(महोदय|महोदया|प्रिय महोदय)[,;:.]?$/,
  /^(அன்புடையீர்|மதிப்பிற்குரிய அவர்களே)[,;:.]?$/,
  /^(মহোদয়|মহোদয়া|প্রিয় মহোদয়)[,;:.]?$/,
  /^(estimado\/a señor\/a|estimado señor|estimada señora|muy señor mío)[,;:.]?$/i,
  /^(monsieur|madame|cher monsieur|chère madame)[,;:.]?$/i,
  /^(السيد المحترم|عزيزي السيد|عزيزتي السيدة)[,;:.]?$/,
];

const CLOSING = [
  /^(yours\s+(faithfully|sincerely|truly)|with\s+(kind\s+)?regards|regards|best\s+regards)[,.]?$/i,
  /^(भवदीय|आपका विश्वासी|आपका आज्ञाकारी)[,.]?$/,
  /^(அன்புடன்|உண்மையுள்ளவர்)[,.]?$/,
  /^(ভবদীয়|আপনার বিশ্বস্ত)[,.]?$/,
  /^(atentamente|le saluda atentamente)[,.]?$/i,
  /^(veuillez agréer mes salutations distinguées|cordialement)[,.]?$/i,
  /^(وتفضلوا بقبول فائق الاحترام|مع خالص التقدير)[,.]?$/,
];

/**
 * High-frequency official subjects that recur in government correspondence —
 * translated as a unit so the subject line reads fully in the target language
 * instead of mixing scripts. Values are normalized (lowercase, single spaces,
 * trailing punctuation stripped) before lookup.
 */
const SUBJECT_TRANSLATIONS: Record<string, string> = {
  "inter regional transfer of ledger card": "लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण।",
  "inter regional transfer": "अंतर-क्षेत्रीय स्थानांतरण।",
  // The Extract-out subject — "transfer of Extract" is its own family, NOT
  // the ledger-card transfer; the extract noun stays as उद्धरण (एक्सट्रैक्ट)
  // exactly as the CMPFO reference letters set it.
  "inter regional transfer of extract": "उद्धरण (एक्सट्रैक्ट) का अंतर-क्षेत्रीय स्थानांतरण।",
  "inter regional transfer of ledger card, d.a. and p.s.-3 and 4":
    "लेजर कार्ड, डी.ए. एवं पी.एस.-3 व 4 का अंतर-क्षेत्रीय स्थानांतरण।",
  "inter regional transfer of ledger card, d.a. and p.s.-3 & 4":
    "लेजर कार्ड, डी.ए. एवं पी.एस.-3 व 4 का अंतर-क्षेत्रीय स्थानांतरण।",
  "supply of extract (vv details)": '"वीवी" विवरण के उद्धरण (एक्सट्रैक्ट) की आपूर्ति।',
  "supply of extract of vv details": '"वीवी" विवरण के उद्धरण (एक्सट्रैक्ट) की आपूर्ति।',
  "l.c.-out transfer order — posting to nalanda regional office":
    "एल.सी.-आउट स्थानांतरण आदेश — नालंदा क्षेत्रीय कार्यालय में पदस्थापन",
  "l.c.-out transfer order": "एल.सी.-आउट स्थानांतरण आदेश",
  "complaint regarding non-delivery of pension for january–february 2026":
    "जनवरी–फरवरी 2026 हेतु पेंशन का भुगतान न होने संबंधी शिकायत।",
};

// Hindi translation labels follow the official-letter style (विषय:- / संदर्भ:-).
const HI_LABELS = { subject: "विषय:- ", ref: "संदर्भ:- " };

/**
 * Regex fallback for the recurring CMPF subjects — the exact-phrase table
 * above misses the letters' noisy variants ("DA, PS -3 & 4", "Transf er",
 * a stray period), so the family patterns below catch them.
 */
function translateHindiSubject(value: string, overlay?: GlossaryOverlay): string | null {
  const v = value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.।\s]+$/, "")
    .trim();
  if (/^inter regional transfer of ledger card$/.test(v)) {
    return "लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण।";
  }
  // "…of Ledger Card in respect of Mr. Sanjay Kumar Singh, CMPF a/c No.-
  // RMG/41/179." — the L.C.-REQ subject carries the member. The name and
  // account captures are transliterated by the refine pass (श्री संजय कुमार
  // सिंह, आरएमजी/41/179).
  const inRespect = v.match(
    /^inter regional transfer of ledger card in respect of (?:mr|shri|smt|dr|er)\.?\s+(.+?),\s*cmpf\s*a\/?c\s*no\.?\s*[-:.]?\s*(.+)$/,
  );
  if (inRespect) {
    return `श्री ${inRespect[1]}, सीएमपीएफ खाता संख्या- ${inRespect[2]} के संबंध में लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण।`;
  }
  if (/^inter regional transfer of ledger card,/.test(v)) {
    return "लेजर कार्ड, डी.ए. एवं पी.एस.-3 व 4 का अंतर-क्षेत्रीय स्थानांतरण।";
  }
  if (/^inter regional transfer of extract/.test(v)) {
    return "उद्धरण (एक्सट्रैक्ट) का अंतर-क्षेत्रीय स्थानांतरण।";
  }
  if (/^supply of extract/.test(v)) {
    return '"वीवी" विवरण के उद्धरण (एक्सट्रैक्ट) की आपूर्ति।';
  }
  // The University-Notice family: "Notice — Annual Examination Schedule for
  // the Academic Session 2025-26" → "अधिसूचना — शैक्षणिक सत्र 2025-26 हेतु
  // वार्षिक परीक्षा कार्यक्रम". The session year after "Session" is kept
  // verbatim so any session localizes.
  const notice = v.match(
    /^notice\s*[–—-]\s*annual examination schedule for the academic session\s+(.+)$/,
  );
  if (notice) {
    return `अधिसूचना — शैक्षणिक सत्र ${notice[1]} हेतु वार्षिक परीक्षा कार्यक्रम`;
  }
  // The Appointment-Order family: "Appointment Order — posting as Joint
  // Commissioner, Central Division" → "नियुक्ति आदेश — संयुक्त आयुक्त,
  // केंद्रीय प्रभाग के रूप में पदस्थापन". The designation after "posting as"
  // is translated by the term pass so unseen postings still localize.
  if (/^appointment order/.test(v)) {
    const rest = v
      .replace(/^appointment order\s*[–—-]?\s*/i, "")
      .replace(/^posting as\s+/i, "")
      .trim();
    if (rest.length > 0) {
      const t = hindiTranslateLine(rest, overlay);
      if (t !== null && /[\u0900-\u097F]/.test(t)) {
        return `नियुक्ति आदेश — ${t} के रूप में पदस्थापन`;
      }
    }
    return "नियुक्ति आदेश";
  }
  return null;
}

/** Localize the frame of a single document line; null means "keep as-is". */
function localizeLine(line: string, kit: ReturnType<typeof kitFor>, overlay?: GlossaryOverlay): string | null {
  const trimmed = line.trim();
  const lang = kitName(kit);

  // Translation register: an original letter says "Sir," — the faithful Hindi
  // rendering is "महोदय," (not the response salutation "प्रिय महोदय/महोदया,").
  // The exact "Sir," / "Yours faithfully," sentence-dictionary entries fire
  // here (the frame regexes, not the phrase pass, handle these lines) — so
  // they get a hit attributed to the dictionary row the user sees.
  if (lang === "Hindi") {
    if (/^(respected\s+)?sir[,.]?$/i.test(trimmed)) {
      trackHit("sentence", "Sir,");
      return "महोदय,";
    }
    if (/^(respected\s+)?madam[,.]?$/i.test(trimmed)) return "महोदया,";
  }
  if (SALUTATION.some((re) => re.test(trimmed))) {
    if (/^sir[,.]?$/i.test(trimmed)) trackHit("sentence", "Sir,");
    return kit.greet[0];
  }
  if (CLOSING.some((re) => re.test(trimmed))) {
    if (/^yours\s+faithfully[,.]?$/i.test(trimmed)) trackHit("sentence", "Yours faithfully,");
    return kit.close[0];
  }

  // Date: 09-07-2026 → दिनांक:09-07-2026 (the official Hindi style runs the
  // label straight into the value with the source's colon — exactly as the
  // reference letters set it: Date:09-07-2026 → दिनांक:09-07-2026).
  const date = trimmed.match(/^(?:date|दिनांक|தேதி|তারিখ|fecha)\s*[:：-]+\s*(.+)$/i);
  if (date) {
    if (lang === "Hindi") {
      // "12 February 2026" → "12 फ़रवरी 2026" — the date value reads in
      // Devanagari too, not just the दिनांक: label.
      const value = date[1].trim().replace(
        new RegExp(`\\b(${Object.keys(MONTHS).join("|")})\\b`, "gi"),
        (mm) => MONTHS[mm.toLowerCase()] ?? mm,
      );
      return `दिनांक:${value}`;
    }
    return `${kit.dateLabel} ${date[1].trim()}`;
  }

  // "No. RNJ/31-1512/2026" — the official file-number opener reads
  // "संख्या …" in Hindi (the code itself is transliterated by the refine
  // pass). Guarded against table headers ("No. of LC") and bare numbers.
  const num = trimmed.match(/^no\.?\s*[:：-]?\s+(?!of\b)([A-Z0-9][A-Z0-9\/.\- ]{1,})$/i);
  if (num) {
    if (lang === "Hindi") return `संख्या ${num[1].trim()}`;
    return null;
  }

  // To, / To: / प्रति, — in translations the standard government opener is
  // "सेवा में," (Hindi) / the localized To-label elsewhere.
  if (/^to\s*[,:]?$/i.test(trimmed)) return lang === "Hindi" ? "सेवा में," : kit.toLabel;

  // Subject: ... / विषय: ... / Sub:- ... (with subject-value translation)
  const subject = trimmed.match(/^(sub(?:ject)?|subject|विषय|பொருள்|বিষয়|asunto|objet|الموضوع)\s*[:：-]+\s*(.+)$/i);
  if (subject) {
    const value = subject[2].trim();
    const key = value.toLowerCase().replace(/\s+/g, " ").replace(/[.।]+$/, "");
    if (lang === "Hindi") {
      const translated = SUBJECT_TRANSLATIONS[key] ?? translateHindiSubject(value, overlay);
      return `${HI_LABELS.subject}${translated ?? value}`;
    }
    return `${kit.subjectLabel} ${SUBJECT_TRANSLATIONS[key] ?? value}`;
  }

  // Ref: ... / संदर्भ: ... / Ref:- ... — a pure code reference (CPF/59/…
  // dated …) is transliterated component by component for Hindi; a prose
  // reference ("your office letter … dated …") gets its standard frame words
  // translated and emails/numbers kept verbatim.
  const ref = trimmed.match(/^(ref|ref\.?|reference|संदर्भ|மேற்கோள்|সূত্র|المرجع)\s*[:：-]+\s*(.+)$/i);
  if (ref) {
    const value = ref[2].trim();
    if (lang === "Hindi") {
      const core = value.replace(/\s+dated\s+.*$/i, "");
      const prose = /\s[a-z]{2,}/i.test(core) || /^[a-z]{2,}\s/i.test(core);
      return prose
        ? `${HI_LABELS.ref}${transliterateProseRef(value, overlay)}`
        : `${HI_LABELS.ref}${transliterateRef(value, overlay)}`;
    }
    return `${kit.refLabel} ${value}`;
  }

  // "(Signature)" / "(हस्ताक्षर)" / sd/-
  if (/^\(?(signature|हस्ताक्षर|கையொப்பம்|স্বাক্ষর|firma|التوقيع)\)?$/i.test(trimmed) || /^sd\/-/.test(trimmed)) {
    return kit.signatureLabel;
  }

  // Enclosure line: Encl:- … / Enclosure … → संलग्न- …
  const encl = trimmed.match(/^(encl(?:osure)?|संलग्न)\s*[:：-]+\s*(.+)$/i);
  if (encl) {
    const value = encl[2].trim();
    if (lang === "Hindi") {
      // "Encl- Original L.C. (One Nos)  Regional Commissioner - I" — the
      // enclosure and the signatory's designation share one source line
      // (left/right of the same baseline). The enclosure value translates as
      // संलग्न- …; the trailing designation becomes its own line BEFORE it,
      // matching the reference sign-off order (भवदीय / (नाम) / पदनाम /
      // संलग्न-).
      const { core, tail } = stripDesignationTail(value);
      // "Encl-  Regional Commissioner - I" — the bare Encl marker and the
      // signatory's designation on one line (core is empty): translate the
      // designation and drop the empty marker (the reference letters have no
      // संलग्न line for a marker with no enclosure).
      if (core === "") return hindiTranslateLine(tail, overlay) ?? tail;
      const low = core.toLowerCase();
      // "Encl- Original L.C. is above …" → "संलग्न- मूल एल.सी. उपरोक्तानुसार"
      // — the exact closing line of the CMPFO reference letters.
      const known =
        low === "as above"
          ? "उपरोक्तानुसार"
          : /^original\s*l\.?c\.?\s*(?:is\s+)?above/.test(low)
            ? "मूल एल.सी. उपरोक्तानुसार"
            : null;
      const enclLine = `संलग्न- ${known ?? transliterateRef(core, overlay)}`;
      if (tail) {
        const t = hindiTranslateLine(tail, overlay);
        return t !== null ? `${t}\n${enclLine}` : enclLine;
      }
      return enclLine;
    }
    return `Encl- ${value}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Table headers — the six columns of the standard ledger-card / service table
// (and their common variants), localized per language. Data cells (names,
// account numbers, colliery names, dates) are always kept as-is.
// ---------------------------------------------------------------------------
export const TABLE_HEADERS: Record<string, Record<string, string>> = {
  "sl. no": {
    Hindi: "क्र.सं.", Tamil: "வ.எண்", Bengali: "ক্রমিক নং", Telugu: "క్ర.సం",
    Kannada: "ಕ್ರ.ಸಂ", Gujarati: "ક્ર.નં", Marathi: "अ.क्र.",
    Spanish: "N.º", French: "N.°", Arabic: "م.ر",
  },
  "name of the member": {
    Hindi: "सदस्य का नाम", Tamil: "உறுப்பினரின் பெயர்", Bengali: "সদস্যের নাম",
    Telugu: "సభ్యుని పేరు", Kannada: "ಸದಸ್ಯರ ಹೆಸರು", Gujarati: "સભ્યનું નામ",
    Marathi: "सदस्याचे नाव", Spanish: "Nombre del miembro", French: "Nom du membre",
    Arabic: "اسم العضو",
  },
  "cmpf a/c no": {
    Hindi: "सीएमपीएफ खाता संख्या", Tamil: "CMPF கணக்கு எண்", Bengali: "সিএমপিএফ হিসাব নং",
    Telugu: "CMPF ఖాతా నం", Kannada: "CMPF ಖಾತೆ ಸಂ", Gujarati: "CMPF ખાતું નં",
    Marathi: "CMPF खाते क्र.", Spanish: "N.º de cuenta CMPF", French: "N° de compte CMPF",
    Arabic: "رقم حساب CMPF",
  },
  // The L.C.-REQ table's longer variants of the two colliery columns.
  "name of the colliery where the member worked in your region and period of work done": {
    Hindi: "कोलियरी का नाम जहाँ सदस्य आपके क्षेत्र में कार्यरत था तथा कार्य की अवधि",
  },
  "name of the colliery where the member is currently working in this region": {
    Hindi: "कोलियरी का नाम जहाँ सदस्य वर्तमान में इस क्षेत्र में कार्यरत है",
  },
  "name of the colliery where the member had earlier worked in": {
    Hindi: "कोलियरी का नाम जहाँ सदस्य पूर्व में कार्यरत था",
    Tamil: "உறுப்பினர் முன்னர் பணியாற்றிய சுரங்கத்தின் பெயர்",
    Bengali: "সদস্য পূর্বে কর্মরত ছিলেন এমন কোলিয়ারির নাম",
    Telugu: "సభ్యుడు గతంలో పనిచేసిన కోలియరీ పేరు",
    Kannada: "ಸದಸ್ಯರು ಹಿಂದೆ ಕೆಲಸ ಮಾಡಿದ ಕಾಲಿಯರಿ ಹೆಸರು",
    Gujarati: "સભ્ય અગાઉ કાર્યરત હતા તે કોલિયરીનું નામ",
    Marathi: "सदस्य पूर्वी कार्यरत असलेल्या कोलियरीचे नाव",
    Spanish: "Nombre de la mina donde el miembro trabajó anteriormente",
    French: "Nom de la mine où le membre a précédemment travaillé",
    Arabic: "اسم المنجم الذي كان العضو يعمل فيه سابقاً",
  },
  "name of the colliery where the member is currently working in": {
    Hindi: "कोलियरी का नाम जहाँ सदस्य वर्तमान में कार्यरत है",
    Tamil: "உறுப்பினர் தற்போது பணியாற்றும் சுரங்கத்தின் பெயர்",
    Bengali: "সদস্য বর্তমানে কর্মরত কোলিয়ারির নাম",
    Telugu: "సభ్యుడు ప్రస్తుతం పనిచేస్తున్న కోలియరీ పేరు",
    Kannada: "ಸದಸ್ಯರು ಪ್ರಸ್ತುತ ಕೆಲಸ ಮಾಡುತ್ತಿರುವ ಕಾಲಿಯರಿ ಹೆಸರು",
    Gujarati: "સભ્ય હાલમાં કાર્યરત હોય તે કોલિયરીનું નામ",
    Marathi: "सदस्य सध्या कार्यरत असलेल्या कोलियरीचे नाव",
    Spanish: "Nombre de la mina donde el miembro trabaja actualmente",
    French: "Nom de la mine où le membre travaille actuellement",
    Arabic: "اسم المنجم الذي يعمل فيه العضو حالياً",
  },
  "no. of lc": {
    Hindi: "एल.सी. संख्या", Tamil: "எல்.சி எண்ணிக்கை", Bengali: "এল.সি. সংখ্যা",
    Telugu: "ఎల్.సి సంఖ్య", Kannada: "ಎಲ್.ಸಿ ಸಂಖ್ಯೆ", Gujarati: "એલ.સી. સંખ્યા",
    Marathi: "एल.सी. संख्या", Spanish: "N.º de LC", French: "N° de LC",
    Arabic: "عدد بطاقات الحساب",
  },
  // The L.C.-REQ posting-history table (SL. No | Place of Posting | From | To |
  // Regional office) — the header words read से / तक for the date columns.
  "place of posting": {
    Hindi: "पदस्थापन का स्थान", Tamil: "பணியிடம்", Bengali: "পদস্থানের স্থান",
    Telugu: "పోస్టింగ్ స్థలం", Kannada: "ನಿಯೋಜನಾ ಸ್ಥಳ", Gujarati: "પોસ્ટિંગ સ્થળ",
    Marathi: "पदस्थापनेचे ठिकाण", Spanish: "Lugar de destino", French: "Lieu d'affectation",
    Arabic: "مكان التعيين",
  },
  from: {
    Hindi: "से", Tamil: "இருந்து", Bengali: "থেকে", Telugu: "నుండి",
    Kannada: "ಇಂದ", Gujarati: "થી", Marathi: "पासून", Spanish: "Desde",
    French: "De", Arabic: "من",
  },
  to: {
    Hindi: "तक", Tamil: "வரை", Bengali: "পর্যন্ত", Telugu: "వరకు",
    Kannada: "ವರೆಗೆ", Gujarati: "સુધી", Marathi: "पर्यंत", Spanish: "Hasta",
    French: "À", Arabic: "إلى",
  },
};

/** The kits don't carry their language name; infer it from the first greeting. */
export function kitName(kit: ReturnType<typeof kitFor>): string {
  const g = kit.greet[0];
  if (/[\u0900-\u097F]/.test(g)) return "Hindi";
  if (/[\u0B80-\u0BFF]/.test(g)) return "Tamil";
  if (/[\u0980-\u09FF]/.test(g)) return "Bengali";
  if (/[\u0C00-\u0C7F]/.test(g)) return "Telugu";
  if (/[\u0C80-\u0CFF]/.test(g)) return "Kannada";
  if (/[\u0A80-\u0AFF]/.test(g)) return "Gujarati";
  if (/[áéíóúñü¿¡]/i.test(g)) return "Spanish";
  if (/[àâçéèêëîïôûùüœ]/i.test(g)) return "French";
  if (/[\u0600-\u06FF]/.test(g)) return "Arabic";
  return "Hindi"; // Marathi shares the Devanagari script — treat as Hindi-style
}

/**
 * Localize a table header cell for a language name ("Hindi", "Tamil", …).
 * Data cells are never matched — they are handled by the cell term pass.
 */
export function localizeTableHeader(cell: string, lang: string, overlay?: GlossaryOverlay): string {
  const key = cell.toLowerCase().replace(/\s+/g, " ").trim();
  // Allow the bare header words (e.g. "No of LC", "CMPF A/C No.", "No.of LC")
  // to match their canonical entry by stripping trailing periods and extra
  // spaces — and compare dot/space-insensitively so OCR-spaced variants of
  // the same header ("No.of LC" vs "No. of LC") still match.
  const canonical = key.replace(/\.$/, "").replace(/\s{2,}/g, " ");
  const bare = canonical.replace(/[.\s]/g, "");
  // Custom (overlay) header rows win over the seed table.
  if (overlay) {
    for (const [pattern, langs] of Object.entries(overlay.TABLE_HEADERS)) {
      if (
        canonical === pattern ||
        canonical === pattern.replace(/\./g, "") ||
        bare === pattern.replace(/[.\s]/g, "")
      ) {
        trackHit("TABLE_HEADERS", pattern);
        return langs[lang] ?? langs.Hindi ?? cell;
      }
    }
  }
  for (const [pattern, langs] of Object.entries(TABLE_HEADERS)) {
    if (
      canonical === pattern ||
      canonical === pattern.replace(/\./g, "") ||
      bare === pattern.replace(/[.\s]/g, "")
    ) {
      trackHit("TABLE_HEADERS", pattern);
      return langs[lang] ?? langs.English ?? cell;
    }
  }
  return cell;
}

function translateTableCell(cell: string, kit: ReturnType<typeof kitFor>): string {
  return localizeTableHeader(cell, kitName(kit));
}

// ---------------------------------------------------------------------------
// Hindi word-level coverage for the recurring official address block,
// designation lines and table cells. Applied all-or-nothing per line: a line
// where every Latin token is known (or is a number/punctuation) is translated
// cleanly; any unknown token (a personal name, an organization we don't know)
// keeps the whole line in the source language — never a half-mangled mix.
// Phrase rules run first so date ranges and Region codes keep their shape.
// ---------------------------------------------------------------------------
export function transliterateRef(value: string, overlay?: GlossaryOverlay): string {
  // "…dated 07/07/2026" → "…दिनांक 07/07/2026": the source's own spaces
  // survive, so a replacement that adds its own padding would double them
  // ("दिनांक  07/07/2026"). Same for an inline "Date:" label. Stray double
  // spaces from OCR runs are collapsed so the code reads tight
  // ("(एक  संख्या)" → "(एक संख्या)").
  const refTokens = (core: string) => {
    const v = overlay?.REF_TOKENS[core] ?? REF_TOKENS[core];
    if (v !== undefined) trackHit("REF_TOKENS", core);
    return v;
  };
  const s = value
    .replace(/\s{2,}/g, " ")
    // OCR-fragment spaces inside a code ("Misc/ L.C.", "SBP/ Extract",
    // "एल.सी. - आउट") — spaces around a slash/hyphen are never meaningful in
    // a code. The label gap before दिनांक ("…ASN/  Date-…") is preserved:
    // spaces after a separator are only squeezed when the next token is NOT
    // the date label.
    .replace(/[ \t]+([/\-])/g, "$1")
    .replace(/([/\-])[ \t]+(?![Dd]ate|[Dd]ated|दिनांक)/g, "$1")
    // "… dated 07/07/2026" → "… दिनांक 07/07/2026". The lookarounds treat
    // digits as non-boundaries so OCR-fused forms ("…/332dated 29/06/2026",
    // "dated25/02/2026") still localize; "updated" never matches (a letter
    // precedes "dated").
    .replace(/(?<![A-Za-z])dated(?![A-Za-z])/gi, "दिनांक")
    .replace(/\bdate\s*[:：]\s*/gi, "दिनांक:")
    // "…/ASN/ Date-09-07-2026" — PDFs carry the file number and the date on
    // one line with a hyphen separator; the label localizes to दिनांक- exactly
    // like the colon form (दिनांक:09-07-2026).
    .replace(/\bdate\s*-\s*/gi, "दिनांक-")
    // "…/ASN/ Date17/03/2026" — a date glued straight to the label (no
    // separator at all) gets the dash too, so the header reads दिनांक-17/03/2026.
    .replace(/\bdate\s*(?=\d{1,2}[-/.]\d)/gi, "दिनांक-")
    .replace(/\s*&\s*/g, " एवं ")
    // Canonical spacing for the fused forms: "…41दिनांक 09-07" → "…41 दिनांक
    // 09-07" (space before when glued to a code character, space after when
    // glued to a digit). "दिनांक:" / "दिनांक-" keep their separators.
    .replace(/(?<=[^ \t/])दिनांक/g, " दिनांक")
    .replace(/दिनांक(?=\d)/g, "दिनांक ");
  const parts = s.split(/([^A-Za-z0-9.]+)/);
  const out: string[] = [];
  for (const part of parts) {
    if (part.length === 0) continue;
    const lc = part.toLowerCase();
    const core = lc.replace(/\.+$/, "");
    if (core.length === 0) {
      out.push(part);
      continue;
    }
    if (/^[A-Za-z]+$/.test(core)) {
      if (ROMAN_RE.test(core)) {
        out.push(part); // roman numerals stay Latin
        continue;
      }
      out.push(refTokens(core) ?? part);
      continue;
    }
    if (/^[A-Za-z.]+$/.test(core)) {
      out.push(refTokens(core) ?? part); // e.g. "L.C." → "एल.सी."
      continue;
    }
    const lm = core.match(/^([A-Za-z.]+)(\d+)$/);
    if (lm) {
      const p = refTokens(lm[1]);
      out.push(p !== undefined ? p + lm[2] : part);
      continue;
    }
    out.push(part);
  }
  return out
    .join("")
    // "विविध ./एल.सी." → "विविध/एल.सी." — the OCR space-dot before a code
    // slash ("Misc . /L.C.-out") is a fragment of the abbreviation marker;
    // the reference letters drop the dot entirely (सीपीएफ/118/विविध/…).
    .replace(/([\u0900-\u097F])\s*\.\s*(?=\/)/g, "$1");
}

// ---------------------------------------------------------------------------
// Prose references (Hindi) — "your office letter No. CPF/16/DHN-40/D-I/281/1220
// dated 20/02/2026" reads "आपके कार्यालय का पत्र संख्या सीपीएफ/16/डीएचएन-40/डी-I/281/1220
// दिनांक 20/02/2026" in the reference standard: the frame words are translated,
// code-like tokens are transliterated, and emails/times/numbers stay verbatim.
// ---------------------------------------------------------------------------
const PROSE_REF_TOKENS: Record<string, string> = {
  your: "आपके",
  office: "कार्यालय",
  letter: "पत्र",
  no: "संख्या",
  "no.": "संख्या",
  number: "संख्या",
  dated: "दिनांक",
  this: "इस",
  of: "का",
  time: "समय",
};

export function transliterateProseRef(value: string, overlay?: GlossaryOverlay): string {
  const parts = value.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    const w = parts[i];
    const lw = w.toLowerCase().replace(/[.,;]+$/, "");
    // "your office letter [No.]" → "आपके कार्यालय का पत्र [संख्या]"
    if (lw === "your" && parts[i + 1]?.toLowerCase().replace(/[.,;]+$/, "") === "office") {
      let j = i + 2;
      let frame = "आपके कार्यालय का";
      while (j < parts.length && /^(letter|no\.?|number)$/i.test(parts[j].replace(/[.,;]+$/, ""))) {
        frame += ` ${PROSE_REF_TOKENS[parts[j].toLowerCase().replace(/[.,;]+$/, "")]}`;
        j += 1;
      }
      out.push(frame);
      i = j;
      continue;
    }
    // "dated …" — everything after stays verbatim (dates, emails, times).
    // OCR-fused forms split the same way: "dated25/02/2026." (date glued to
    // the label) and "…/13/25dated 26/03/2026" (code glued to the label)
    // both read "… दिनांक <date>" — never a Latin "dated" remnant.
    const di = w.toLowerCase().indexOf("dated");
    if (di !== -1) {
      const pre = w.slice(0, di);
      const post = w.slice(di + "dated".length);
      if (pre) out.push(transliterateRef(pre, overlay));
      out.push("दिनांक");
      if (post) out.push(post);
      out.push(...parts.slice(i + 1));
      break;
    }
    // "no.singrauli@cmpfo.gov.in" — the OCR glue pass fused "no." onto an
    // email (letter no. <address>); the reference standard drops the bare
    // number marker in front of an email and reads straight into it.
    const email = w.match(/^no\.(\S+@\S+)$/i);
    if (email) {
      out.push(email[1]);
      i += 1;
      continue;
    }
    // A bare leading "No." ("Ref:-No. CPF/NAG/…") is dropped — the
    // reference standard reads straight into the code (सीपीएफ/एनएजी/…).
    if (i === 0 && lw === "no") {
      i += 1;
      continue;
    }
    const known = PROSE_REF_TOKENS[lw];
    if (known) {
      out.push(known);
      i += 1;
      continue;
    }
    // A standalone word the code transliterator knows ("Incoming",
    // "Extract", "Dhanbad") is a ref/code vocabulary word, not prose —
    // localize it too. Words of one/two letters are skipped so "in" never
    // becomes the code fragment "इन" in a prose ref.
    const refKnown = lw.length >= 3 ? (overlay?.REF_TOKENS[lw] ?? REF_TOKENS[lw]) : undefined;
    if (refKnown) {
      out.push(refKnown);
      i += 1;
      continue;
    }
    // A parenthesized abbreviation ("(UG)", "(WCL)") — a code fragment, not
    // prose: transliterate the letters inside the parens.
    if (/^\([A-Za-z.]+(?:[\/\-][A-Za-z0-9.]+)*\)$/.test(w)) {
      out.push(transliterateRef(w, overlay));
      i += 1;
      continue;
    }
    // Code-like token — transliterate the alphabetic components. This covers
    // pure code tokens ("CPF/BLP/4/Extract/4117") AND mixed tokens that start
    // in Devanagari ("इनकमिंग/TLHR-10/Talcher/25-26/41"): transliterateRef
    // passes Devanagari through untouched and localizes the Latin parts.
    // Emails ("singrauli@cmpfo.gov.in") stay verbatim.
    if (!w.includes("@") && /[A-Za-z]/.test(w) && /[/\-.]/.test(w)) {
      out.push(transliterateRef(w, overlay));
    } else {
      out.push(w);
    }
    i += 1;
  }
  // The same OCR-space squeeze transliterateRef applies to codes: a space
  // beside a slash/hyphen inside a reference is never meaningful
  // ("Incoming /TLHR-10", "CPF/ SBP"), except the label gap before दिनांक
  // ("…/ASN/ दिनांक-…"). Digit-fragment spaces collapse too ("202 6" →
  // "2026", "1 7/03" → "17/03", "0 4/2026" → "04/2026").
  return out
    .join(" ")
    .replace(/[ \t]+([/\-])/g, "$1")
    .replace(/([/\-])[ \t]+(?![Dd]ate|[Dd]ated|दिनांक)/g, "$1")
    .replace(/(\d)[ \t]+(?=\d)/g, "$1")
    // "singrauli@cmpfo.gov.in 4:16:18 PM +0530 दिनांक 13/03/2026" reads
    // "singrauli@cmpfo.gov.in, समय 4:16:18 PM +0530, दिनांक 13/03/2026" in
    // the reference standard — the time gets its समय label and both sides
    // their commas.
    .replace(/(\S+@\S+)\s+(\d{1,2}:\d{2}(?::\d{2})?\s+[AP]M\s+[+-]?\d+)\s+दिनांक/g, "$1, समय $2, दिनांक")
    // A trailing " ." after the date ("…/2026 ." → "…/2026") — the ref
    // standard never closes the reference line with a period.
    .replace(/(\d{2}\/\d{2}\/\d{4})\s*\.\s*$/, "$1")
    // "एल.सी.-रिक्वेस्ट ./417" → "एल.सी.-रिक्वेस्ट/417" — the abbreviation
    // dot before a code slash ("Req. /417") drops, exactly as transliterateRef
    // cleans its own output.
    .replace(/([\u0900-\u097F])\s*\.\s*(?=\/)/g, "$1");
}

// ---------------------------------------------------------------------------
// Name transliteration (Hindi) — the curated transliterations used in CMPF
// correspondence (see the reference-standard table). Any name not listed
// stays in the source script; the cloud forge transliterates arbitrary names.
// ---------------------------------------------------------------------------
const HONORIFICS: Record<string, string> = {
  shri: "श्री", smt: "श्रीमती", "smt.": "श्रीमती",
  mr: "श्री", "mr.": "श्री", mrs: "श्रीमती", "mrs.": "श्रीमती",
  dr: "डॉ.", "dr.": "डॉ.", er: "इं.", "er.": "इं.",
};

function transliterateLatinWord(word: string): string | null {
  const w = word.toLowerCase();
  if (!/^[a-z]+$/.test(w) || w.length < 2) return null;
  if (w === "singh") return "सिंह";
  if (w === "kumar") return "कुमार";
  let i = 0;
  let out = "";
  let prevCons = false;
  while (i < w.length) {
    // digraphs first
    let dg: string | null = null;
    for (const [d, dv] of NAME_DIGRAPHS) {
      if (w.startsWith(d, i) && (d.length > 1 || i + d.length < w.length)) {
        dg = dv;
        i += d.length;
        break;
      }
    }
    if (dg !== null) {
      out += dg;
      prevCons = true;
      continue;
    }
    // vowel at start of word
    if (i === 0) {
      const two = w.slice(0, 2);
      const vv = NAME_VOWEL_START[two] ?? NAME_VOWEL_START[w[0]];
      if (vv !== undefined) {
        out += vv;
        i += two in NAME_VOWEL_START && NAME_VOWEL_START[two] !== undefined ? 2 : 1;
        prevCons = false;
        continue;
      }
    }
    const c = w[i];
    // 'n' before a consonant → anusvara (Sanjay → संजय, Kanta → कांता)
    if (c === "n" && i + 1 < w.length && /[a-z]/.test(w[i + 1]) && !/^[aeiouy]/.test(w[i + 1])) {
      out += "ं";
      prevCons = false;
      i += 1;
      continue;
    }
    const cons = NAME_CONS[c];
    if (cons !== undefined) {
      out += cons;
      prevCons = true;
      i += 1;
      continue;
    }
    const vv = NAME_VOWEL_MID[c];
    if (vv !== undefined) {
      // An explicit 'a' after a consonant is a schwa — dropped mid-word
      // (Pattanayak → पट्टनायक); word-final 'a' keeps the full form the way
      // Indian names render it (Sharma → शर्मा, Bina → बीना, Kanta → कांता).
      out += prevCons ? (c === "a" && i === w.length - 1 ? "ा" : vv) : "";
      prevCons = false;
      i += 1;
      continue;
    }
    // unknown letter — bail
    return null;
  }
  return out.length >= 2 ? out : null;
}

/** Transliterate a name cell (or signature name) into Hindi; falls back to
 * the generic rule-based transliterator when the curated table misses. Custom
 * (overlay) name rows win over the seed table. */
export function transliterateName(cell: string, overlay?: GlossaryOverlay): string | null {
  const norm = cell.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;:]+$/, "");
  const nameTable = (key: string) => {
    const v = overlay?.NAME_TABLE[key] ?? NAME_TABLE[key];
    if (v !== undefined) trackHit("NAME_TABLE", key);
    return v;
  };
  const direct = nameTable(norm);
  if (direct) return direct;
  const m = norm.match(/^(shri|smt\.?|mr\.?|mrs\.?|dr\.?|er\.?)\s+(.+)$/);
  if (m) {
    // "Shri Mr. Sanjay Kumar Singh" — a phrase capture may carry its own
    // honorific; peel it before the table/generic lookup.
    const rest = m[2].replace(/^(shri|smt\.?|mr\.?|mrs\.?|dr\.?|er\.?)\s+/i, "");
    const named = nameTable(rest);
    if (named) return `${HONORIFICS[m[1]]} ${named}`;
    const generic = genericName(rest);
    if (generic !== null) return `${HONORIFICS[m[1]]} ${generic}`;
    return null;
  }
  return genericName(norm);
}

/**
 * English function/domain words that mark a string as prose or a table
 * header — never a person name. Keeps the generic fallback from garbling
 * "Name of the colliery where …" into Devanagari word soup.
 */
const NAME_STOP_WORDS =
  /^(of|the|in|on|at|and|or|is|are|was|were|for|to|from|by|with|where|this|that|your|its|his|her|their|name|colliery|colliary|area|project|mine|region|office|period|work|done|currently|member|no|lc|sl|posting|place|date|dated|working|have|been|had|earlier)$/i;

/** Transliterate a multi-word name via the generic rule (null when any word
 * is untransliterable or the string is clearly prose/a header, so unknown
 * scripts/words never get half-mangled). */
function genericName(name: string): string | null {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return null;
  if (words.some((w) => NAME_STOP_WORDS.test(w.replace(/[.,;:]+$/, "")))) return null;
  const parts: string[] = [];
  for (const w of words) {
    const t = transliterateLatinWord(w);
    if (t === null) return null;
    parts.push(t);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Translate one whitespace token. Leading/trailing punctuation (brackets,
 * commas, periods) is peeled off, the core is looked up, and the punctuation
 * is reattached — so "(From…)" style cells and "HQ." abbreviations work.
 */
function translateHindiToken(tok: string, overlay?: GlossaryOverlay): string | null {
  const lead = (tok.match(/^[^A-Za-z0-9\u0900-\u097F]+/) ?? [""])[0];
  const core = tok.slice(lead.length);
  const trail = (core.match(/[^A-Za-z0-9\u0900-\u097F]+$/) ?? [""])[0];
  const stem = core.slice(0, core.length - trail.length).toLowerCase();
  if (stem.length === 0) return null;
  // Custom (overlay) word rows win over the seed tokens.
  const tokenOf = (key: string) => {
    const v = overlay?.HI_TOKENS[key] ?? HI_TOKENS[key];
    if (v !== undefined) trackHit("HI_TOKENS", key);
    return v;
  };
  let mapped = tokenOf(stem);
  // Hyphenated tokens (PO-Jayant, District-Singrauli, D-II…) translate when
  // every hyphen part is known — unknown words keep the whole token as-is.
  // Digit-only parts (Dist-Singrauli-486890 → जिला-सिंगरौली-486890) are
  // always known — the PIN rides along with the translated place name.
  if (mapped === undefined && stem.includes("-")) {
    const parts = stem.split("-").filter(Boolean);
    if (parts.length > 1 && parts.every((p) => tokenOf(p) !== undefined || /^\d+$/.test(p))) {
      mapped = parts.map((p) => tokenOf(p) ?? p).join("-");
    }
  }
  if (mapped === undefined) return null;
  // Dotted abbreviations keep their trailing punctuation ("B.B." → "बी.बी.",
  // "R.O-" → "क्षे.का.-" — the hyphen of "R.O- Talcher" must not vanish).
  // When the mapped value ALREADY ends in a dot ("बी.बी.") the peeled
  // trailing dot must not double up ("बी.बी.." → "बी.बी.").
  if (mapped.endsWith(".")) return lead + mapped + trail.replace(/^\.+/, "");
  // Abbreviations: "HQ." → "मुख्यालय,", "Coll.," → "कोलियरी," — the period
  // is dropped and a comma kept.
  let suffix = trail;
  if (overlay?.HI_ABBR.has(stem) || HI_ABBR.has(stem)) {
    trackHit("HI_ABBR", stem);
    const cleaned = trail.replace(/\./g, "");
    suffix = cleaned === "" ? "," : cleaned;
  }
  return lead + mapped + suffix;
}

/**
 * Translate a line that should read fully in Hindi — address blocks,
 * designation lines and table cells. All-or-nothing: returns null when any
 * Latin token is unknown, so names and unfamiliar organizations are preserved
 * verbatim instead of being half-translated.
 */
export function hindiTranslateLine(line: string, overlay?: GlossaryOverlay): string | null {
  let s = line.trim();
  // "P.O &P.S:- …" → "P.O एवं P.S:- …" — the ampersand reads एवं in Hindi
  // (Form A & P.S.-3 → फॉर्म ए एवं पी.एस.-3).
  s = s.replace(/\s*&\s*/g, " एवं ");
  // Custom phrase rows run before the seed phrases — user rules win.
  for (const [re, rep] of overlay?.HI_PHRASES ?? []) {
    if (new RegExp(re, "gi").test(s)) trackHit("HI_PHRASES", re);
    s = s.replace(new RegExp(re, "gi"), rep);
  }
  for (const [re, rep] of HI_PHRASES) {
    // The seed regexes are global (gi) — reset lastIndex so the probe test
    // never inherits a stale position from an earlier line/document.
    re.lastIndex = 0;
    const fired = re.test(s);
    re.lastIndex = 0;
    if (fired) trackHit("HI_PHRASES", re.source);
    s = s.replace(re, rep);
  }
  const tokens = s.split(/\s+/);
  const out: string[] = [];
  for (const tok of tokens) {
    if (tok.length === 0) continue;
    const lead = (tok.match(/^[^A-Za-z0-9\u0900-\u097F]+/) ?? [""])[0];
    const core = tok.slice(lead.length);
    const trail = (core.match(/[^A-Za-z0-9\u0900-\u097F]+$/) ?? [""])[0];
    const bare = core.slice(0, core.length - trail.length);
    if (bare.length === 0) {
      // Pure punctuation ("-", "(", ")") — keep as-is.
      out.push(tok);
      continue;
    }
    if (/[\u0900-\u097F]/.test(bare)) {
      // A token mixing Devanagari and Latin ("जिला-Paschim", "क्षेत्र-III"
      // minus the roman numeral) — the Devanagari half is already translated,
      // the Latin half still needs the term pass, or the line leaks half-
      // Latin (जिला-Paschim). Split on hyphens and translate each Latin part.
      if (/[A-Za-z]/.test(bare) && bare.includes("-")) {
        const parts = bare.split("-");
        let ok = true;
        const mapped = parts.map((p) => {
          if (!/[A-Za-z]/.test(p)) return p;
          const t = translateHindiToken(p);
          if (t === null) ok = false;
          return t ?? p;
        });
        if (ok) {
          out.push(lead + mapped.join("-") + trail);
          continue;
        }
      }
      // Already translated (phrase output) — keep.
      out.push(tok);
      continue;
    }
    if (/^[.,;:()&'"\-/]+$/.test(bare)) {
      out.push(tok);
      continue;
    }
    if (/^[\d.,/:-]+$/.test(bare)) {
      out.push(tok);
      continue;
    }
    const t = translateHindiToken(tok, overlay);
    if (t !== null) {
      if (t.length > 0) out.push(t);
      continue;
    }
    // Code-like token ("NGP/59", "RNJ/31", "(WCL)") — transliterate it so
    // mixed colliery-name + code cells still read fully in Devanagari.
    if (CODE_TOKEN_RE.test(bare)) {
      out.push(lead + transliterateRef(bare, overlay) + trail);
      continue;
    }
    return null;
  }
  return (
    out
      .join(" ")
      // "क्षेत्रीय आयुक्त – I" → "क्षेत्रीय आयुक्त - I" — the designation
      // dash reads as a hyphen in the reference letters (the PIN phrases have
      // already converted their en/em-dashes by this point).
      .replace(/[–—]/g, "-")
      .trim() || null
  );
}

/** A designation/title line ("Regional Commissioner - I", "Assistant
 * Commissioner", …) — these get the Hindi word pass, unlike prose. */
export function isDesignationLine(line: string): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length > 80) return false;
  if (/^\([^)]+\)$/.test(t) || /^sd\//.test(t)) return false;
  return /^(the\s+)?(regional|deputy|joint|assistant|chief|director|commissioner|registrar|secretary|officer|general\s+manager|chairman|president|inspector|superintendent|pensioner|member|under\s+secretary)\b/i.test(
    t,
  );
}

/**
 * Whether one recipient-address line takes the reference trailing comma.
 * Non-last Devanagari lines get one unless the line already carries its own
 * punctuation/commas/labels — the shape the reference letters set:
 * क्षेत्रीय आयुक्त, … संबलपुर, ओडिशा 768020 but धनबाद, डी-II,
 * धनबाद (झारखंड), सीएमपीएफ, सिंगरौली, एटी:- जगन्नाथ कॉलोनी and
 * क्षे.का.- तालचेर all stay bare. Shared by the text pass (refine.ts) and
 * the DOCX renderer (registry.ts) so both produce identical addresses.
 */
export function addressLineNeedsComma(t: string): boolean {
  const s = t.trim();
  if (s.length === 0 || s.length > 80) return false;
  if (!/[\u0900-\u097F]/.test(s)) return false;
  if (/[.,;:।()\-–—0-9]$/.test(s)) return false;
  if (s.includes(",")) return false; // already carries its own comma
  if (s.includes(":-")) return false; // labelled continuation line
  if (s.includes(".-")) return false; // "क्षे.का.- तालचेर" — abbreviation + dash
  return true;
}

/**
 * Tidy one recipient-address line to the reference standard: fully-covered
 * Latin lines read in Hindi (135's "Sreepat Road, Sub P.O. SECL"), the stray
 * OCR spaces around commas/parens collapse (धनबाद , डी-II → धनबाद, डी-II,
 * धनबाद ( झारखंड ) → धनबाद (झारखंड)), label colons get their canonical
 * spacing (जिला :-अंगुल → जिला:- अंगुल), and the PIN rides on its own space
 * after the dash (सिंगरौली-486890 → सिंगरौली- 486890; पिन-826014 stays
 * glued). Runs on every address line — before the comma rule — in both the
 * text pass and the DOCX renderer.
 */
export function refineAddressLine(raw: string): string {
  let s = raw.trim();
  // Fully-covered Latin lines (and mixed lines like "Bilaspur , Chhatisgarh
  // - 495006") translate via the term pass; unknown lines stay verbatim.
  if (!/[\u0900-\u097F]/.test(s)) {
    const t = hindiTranslateLine(s);
    if (t !== null) s = t;
  }
  return s
    .replace(/(\S)\s+,/g, "$1,")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/(पो|एटी)-\s+/g, "$1-")
    // "पो-जयंत जिला-सिंगरौली" → "पो-जयंत, जिला-सिंगरौली" — the address
    // label pair reads with a comma, exactly as the reference letters set it.
    .replace(/(पो|पिन)-([\u0900-\u097F]+)\s+जिला-/g, "$1-$2, जिला-")
    // "जिला :-अंगुल" → "जिला:- अंगुल" — the label colon glues to its word
    // and the value rides on its own space.
    .replace(/([\u0900-\u097F]{1,8})\s*:+-?\s*/g, (m: string, w: string) =>
      /^[\u0900-\u097F]+$/.test(w) ? `${w}:- ` : m,
    )
    // PIN spacing (same rules as the term pass): "सिंगरौली-486890" →
    // "सिंगरौली- 486890", "बर्धमान – 713303" → "बर्धमान- 713303";
    // "पिन-826014" stays glued and "नागपुर -440014" is left alone.
    .replace(/([\u0900-\u097F]+)(?<!पिन)\s*[–—]\s*(\d{5,6})\b/g, "$1- $2")
    .replace(/([\u0900-\u097F]+)(?<!पिन)-(\d{5,6})\b/g, "$1- $2")
    .replace(/([\u0900-\u097F]+)(?<!पिन) - (\d{5,6})\b/g, "$1- $2")
    .trim();
}

/**
 * Split an enclosure value that shares its line with the signatory's
 * designation ("Encl- … <designation>"). The tail is the LONGEST suffix that
 * reads as a designation (a four-word "Regional Commissioner - I" must win
 * over its own "Commissioner - I" suffix, or "Regional" leaks into the
 * enclosure core) — this handles both the double-space baseline split
 * ("As above  Regional Commissioner - I") and OCR-fused single-space forms
 * ("As above Regional Commissioner-I"). Returns the designation untouched
 * when the whole value is one.
 */
export function stripDesignationTail(value: string): { core: string; tail: string } {
  const words = value.split(/\s+/);
  for (let n = words.length; n >= 1; n--) {
    const tail = words.slice(-n).join(" ");
    if (isDesignationLine(tail)) {
      // A trailing comma/period on the core ("As above,") must not break the
      // "as above" → उपरोक्तानुसार mapping.
      const core = words.slice(0, -n).join(" ").replace(/[.,]+$/, "").trim();
      return { core, tail };
    }
  }
  return { core: value, tail: "" };
}

// ---------------------------------------------------------------------------
// High-frequency formal prose — sentence-level translations with {n}
// placeholders for the values captured from the source line. Longest patterns
// match first. This is deliberately a curated set of the phrases that recur in
// official/government correspondence; anything unmatched is honestly flagged
// for the neural forge.
// ---------------------------------------------------------------------------
// The sentence dictionary lives in the glossary TM (GLOSSARY rows carrying
// the per-language `tr` map). New letters grow coverage by adding an entry
// there — no engine code changes (or through the Glossary page, which injects
// an overlay of custom sentences matched BEFORE the seed pack).
type Phrase = GlossaryEntry & { tr: Record<string, string> };

interface PhraseSet {
  sorted: Phrase[];
  re: Map<Phrase, RegExp>;
  flex: Map<Phrase, RegExp>;
}

function compilePhrases(entries: Phrase[]): PhraseSet {
  const sorted = [...entries].sort((a, b) => b.en.length - a.en.length);
  const re = new Map<Phrase, RegExp>();
  const flex = new Map<Phrase, RegExp>();
  for (const p of sorted) {
    const escaped = p.en.replace(/[.*+?^$()|[\]\\]/g, "\\$&"); // escape regex specials (not { })
    // {1}…{n} placeholders → captures.
    re.set(p, new RegExp("^" + escaped.replace(/\{(\d+)\}/g, "(.{1,120}?)") + "$", "i"));
    // Whitespace-flexible variant: every space run becomes \s* so PDF/OCR
    // text with merged words ("dated12.02.1975", "Commissioner,Dhanbad")
    // still matches. Strict patterns are tried first; this fallback only
    // fires when the exact pattern misses.
    flex.set(p, new RegExp("^" + escaped.replace(/\{(\d+)\}/g, "(.{1,120}?)").replace(/\s+/g, "\\s*") + "$", "i"));
  }
  return { sorted, re, flex };
}

const SEED_PHRASES: PhraseSet = compilePhrases(GLOSSARY.filter((e): e is Phrase => Boolean(e.tr)));

/** Try a compiled phrase set against one normalized sentence/line. */
function matchPhraseSet(set: PhraseSet, normalized: string, lang: string): string | null {
  for (const p of set.sorted) {
    const m = normalized.match(set.re.get(p)!) ?? normalized.match(set.flex.get(p)!);
    if (m) {
      trackHit("sentence", p.en);
      const tr = p.tr[lang] ?? p.tr.Hindi;
      let out = tr;
      for (let i = 1; i < m.length; i++) {
        // Strip a leading separator the FLEX capture swallowed from a glued
        // label ("Dated-12.02.1975" → {2} = "-12.02.1975") so the phrase's
        // own dash renders once (दिनांक-12.02.1975, never दिनांक--12.02.1975).
        // A trailing comma/period the OCR text left inside a code capture
        // ("No-35, Dated …" → {1} = "35,") is peeled too, so the order
        // number renders clean (संख्या-35 दिनांक-12.02.1975). English month
        // names in a capture ("01 July 2026") read in Devanagari (01 जुलाई
        // 2026) — the same rule the glossary slots apply.
        const v = (m[i] ?? "")
          .trim()
          .replace(/^[-/]+/, "")
          .replace(/[,;:]+$/, "")
          .replace(
            new RegExp(`\\b(${Object.keys(MONTHS).join("|")})\\b`, "gi"),
            (mm) => MONTHS[mm.toLowerCase()] ?? mm,
          );
        out = out.replace(`{${i}}`, v);
      }
      return out;
    }
  }
  return null;
}

/** Try to translate one sentence/line with the phrase dictionary. Custom
 * (overlay) sentences match first, so a user entry overrides a seed row. */
function phraseTranslateSingle(line: string, lang: string, extra?: PhraseSet): string | null {
  // Drop the space BEFORE commas/colons/semicolons — OCR/text layers write
  // "Dhanbad , I" and "Ref:- CPF/ , 332", which would otherwise break the
  // literal punctuation in the phrase patterns. Spaces after are preserved.
  // "CMPF a/c No.- RMG/41/179" → "…No- RMG/41/179" — the account-number
  // separator is dot-dash in the letters, dash in the phrase patterns; a
  // "No." followed by a dash is always an account/code separator, never a
  // list number.
  const normalized = line
    .replace(/\s+([,;:])/g, "$1")
    .replace(/No\.[\s-]*-/gi, "No-")
    .replace(/\s+/g, " ")
    .trim();
  if (extra) {
    const hit = matchPhraseSet(extra, normalized, lang);
    if (hit !== null) return hit;
  }
  return matchPhraseSet(SEED_PHRASES, normalized, lang);
}

/**
 * Try to translate a prose line with the phrase dictionary. When the whole
 * line misses, sentences fused on one line ("…Regional Office. Further, it
 * is informed…") are tried individually — the L.C.-out opening plus its
 * "Further, it is informed…" tail hit as two phrase matches joined with a
 * space, exactly the reference standard's merged paragraph.
 */
function phraseTranslate(line: string, lang: string, extra?: PhraseSet): string | null {
  const whole = phraseTranslateSingle(line, lang, extra);
  if (whole !== null) return whole;
  const normalized = line.replace(/\s+/g, " ").trim();
  const sentences = normalized.split(/(?<=[.!?])\s+(?=[A-Z])/);
  if (sentences.length > 1) {
    const parts = sentences.map((s) => phraseTranslateSingle(s, lang, extra));
    if (parts.every((p) => p !== null)) return parts.join(" ");
  }
  return null;
}

/** Lines that are reference/file numbers — kept as-is, never counted as prose. */
function isReferenceLine(line: string): boolean {
  return (
    /^(?:ref|no\.?|file\s*no\.?|letter\s*no\.?)\s*[:#-]?\s*[A-Za-z0-9][A-Za-z0-9\/\-. ]{2,}/i.test(line) ||
    /^[A-Z]{2,}\/\d/.test(line) ||
    /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(line)
  );
}

/**
 * The first structural line (Date:/Ref:/No./To,/Subject:/Sir,/… ) marks the end
 * of the letterhead. Everything above it — organization names, office
 * addresses, phone/email/website lines — is kept exactly as-is, because that
 * is the letterhead the user wants untouched.
 */
const STRUCTURAL_START =
  /^(date|dated|ref|reference|file\s*no|no\.?|sub|subject|to\s*[,:]?|dear|respected|sir[,:]?|madam[,:]?|mahoday|the\s+(?:regional|deputy|joint|assistant|commissioner|director|registrar)|विषय|संदर्भ|दिनांक|प्रति|सेवा में)/i;

export function translateAdaptive(
  doc: AdaptiveDoc,
  opts: AdaptiveOptions,
  overlay?: GlossaryOverlay,
): TranslateResult {
  const text = (doc.text ?? "").trim();
  const kit = kitFor(opts.language);
  const lang = kitName(kit);
  // Custom sentence-dictionary rows (Glossary page) are compiled once per
  // document and matched before the seed pack.
  const extraPhrases = overlay && overlay.sentences.length > 0 ? compilePhrases(overlay.sentences as Phrase[]) : undefined;
  // Prose lines the deterministic pass cannot translate.
  let proseUntranslated = 0;
  let letterhead = true;
  // Inside the "To," recipient block — address lines get the Hindi term pass.
  let inAddress = false;

  const blocks = text.split(/\n{2,}/);
  const outBlocks = blocks.map((block) => {
    const lines = block.split(/\r?\n/);
    const outLines = lines.map((line) => {
      const trimmed = line.trim();

      if (letterhead) {
        // Still inside the letterhead: keep everything until a structural line.
        if (STRUCTURAL_START.test(trimmed) || trimmed.includes("|")) {
          letterhead = false;
        } else {
          return line; // letterhead — untouched
        }
      }

      // Labels (date, subject, ref, salutation, closing, To) — and the
      // recipient block starts right after "To,".
      const localized = localizeLine(line, kit, overlay);
      if (localized !== null) {
        if (/^to\s*[,:]?$/i.test(trimmed)) inAddress = true;
        if (/^(sub|ref|date|dear|respected|sir|madam|mahoday)/i.test(trimmed)) inAddress = false;
        return localized;
      }

      // Table row: localize known headers, then translate fully-covered Hindi
      // cells (colliery names, areas, office terms); unknown cells — names,
      // account numbers — stay verbatim.
      if (trimmed.includes("|")) {
        return trimmed
          .split("|")
          .map((cell) => {
            const c = cell.trim();
            if (c.length === 0) return c;
            const header = localizeTableHeader(c, lang, overlay);
            if (header !== c) return header;
            if (lang === "Hindi") {
              const t = hindiTranslateLine(c, overlay);
              if (t !== null) return t;
              // Space-less Latin code cells ("(BCCL)", "RNJ/31/1512") →
              // Devanagari via the code transliterator; whitespace-bearing
              // cells (names, multi-word colliery history) are refined by
              // the dedicated cell pass and stay untouched here.
              if (/[A-Za-z]/.test(c) && !/\s/.test(c)) {
                const tr = transliterateRef(c, overlay);
                if (tr !== c) return tr;
              }
            }
            return c;
          })
          .join(" | ");
      }

      // Reference / file-number lines, parenthesized names, sd/- — kept.
      if (isReferenceLine(trimmed) || /^\([^)]+\)$/.test(trimmed) || /^sd\//.test(trimmed)) {
        return line;
      }

      // Designation lines ("Regional Commissioner - I") → Hindi term pass.
      if (isDesignationLine(trimmed)) {
        if (lang === "Hindi") {
          const t = hindiTranslateLine(trimmed, overlay);
          if (t !== null) return t;
        }
        return line;
      }

      // Address block lines (after "To,") → Hindi term pass; genuinely
      // unknown lines are kept and honestly flagged.
      if (inAddress) {
        if (lang === "Hindi") {
          const t = hindiTranslateLine(trimmed, overlay);
          if (t !== null) return t;
        }
        if (trimmed.length > 0) proseUntranslated += 1;
        return line;
      }

      const phrase = phraseTranslate(line, lang, extraPhrases);
      if (phrase !== null) return phrase;

      if (trimmed.length > 0) proseUntranslated += 1;
      return line;
    });
    return outLines.join("\n");
  });

  // Only flag what is actually untranslated — when the phrase dictionary
  // covered everything, no caveat is needed.
  const note =
    proseUntranslated > 0
      ? `— ${kit.noteNeural} (${proseUntranslated} line${proseUntranslated === 1 ? "" : "s"} kept in the source language)`
      : null;

  // The translation IS the document — no title line, no footer, so the output
  // mirrors the source's structure exactly (the engine/format metadata is
  // shown in the app UI and the export header). Source blocks are re-joined
  // with their blank-line separator so the DOCX renderer groups each section
  // (header, recipient block, subject, body, closing) into its own paragraph
  // instead of collapsing the whole letter into one run-on block.
  const content = [...(note ? [note, ""] : []), ...outBlocks].join("\n\n");

  return {
    content,
    strategy: "adaptive",
    complete: proseUntranslated === 0,
  };
}
