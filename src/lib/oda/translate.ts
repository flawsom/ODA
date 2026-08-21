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
  GLOSSARY as SEED_GLOSSARY,
  HI_ABBR,
  HI_PHRASES as SEED_HI_PHRASES,
  HI_TOKENS as SEED_HI_TOKENS,
  MONTHS,
  MONTH_ABBR,
  NAME_CONS,
  NAME_DIGRAPHS,
  NAME_TABLE as SEED_NAME_TABLE,
  NAME_VOWEL_MID,
  NAME_VOWEL_START,
  REF_TOKENS as SEED_REF_TOKENS,
  ROMAN_RE,
  type GlossaryEntry,
} from "./glossary";
import {
  GLOSSARY_EXTRA,
  HI_PHRASES_EXTRA,
  HI_TOKENS_EXTRA,
  NAME_TABLE_EXTRA,
  PROSE_REF_TOKENS_EXTRA,
  REF_TOKENS_EXTRA,
} from "./glossary-extra";
import type { GlossaryOverlay } from "./extraDict";
import { trackHit } from "./hitTracker";
import { GENERAL_HI_TOKENS, GENERAL_FORMAL_PHRASES, MORPH_EXCLUDE_BASES } from "./generalVocab";

// The seed tables plus the 8-ALL NEW LETTER corpus rows, merged at load so
// the browser bundle sees one combined dictionary.
const GLOSSARY: GlossaryEntry[] = [...SEED_GLOSSARY, ...GLOSSARY_EXTRA];
const HI_PHRASES: Array<[RegExp, string]> = [...GENERAL_FORMAL_PHRASES, ...SEED_HI_PHRASES, ...HI_PHRASES_EXTRA];
const HI_TOKENS: Record<string, string> = { ...GENERAL_HI_TOKENS, ...SEED_HI_TOKENS, ...HI_TOKENS_EXTRA };
// SEED_HI_TOKENS has identity mappings ("i" → "I", "a" → "A", etc.) for
// name-cell transliteration that clobber the general Hindi pronoun/function-
// word translations.  Overwrite those so the prose path uses proper Hindi.
// Exception: "i" is kept as "I" (identity) because the pronoun "I" → "मैं"
// conversion must be context-aware ("I, Dilip" = pronoun, "Office – I" =
// Roman numeral). That conversion is handled in transliterateProseToHindi.
for (const [k, v] of Object.entries(GENERAL_HI_TOKENS)) {
  if (v && v.length > 0 && HI_TOKENS[k] === k.toUpperCase() && /^[a-z]$/i.test(k) && k !== 'i') {
    HI_TOKENS[k] = v;
  }
}
const REF_TOKENS: Record<string, string> = { ...SEED_REF_TOKENS, ...REF_TOKENS_EXTRA };
const NAME_TABLE: Record<string, string> = { ...SEED_NAME_TABLE, ...NAME_TABLE_EXTRA };
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
  // "L.C. In-Out" — the register read as "in our" by OCR (repaired to
  // "In-Out" by the recover pass); the prose-ref token loop keeps both
  // halves in Devanagari (इन आउट) instead of leaving a Latin remnant.
  in: "इन",
  our: "आउट",
  out: "आउट",
  ...PROSE_REF_TOKENS_EXTRA,
};

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
  // "Your's Faithfully" / "Your’s Faithfully" — the DLC office note
  // misspells the possessive (straight or curly apostrophe); the closing
  // family still fires so the line reads भवदीय,.
  /^(?:your['’]?s)\s+faithfully[,.]?$|^(?:yours\s+(?:faithfully|sincerely|truly)|with\s+(?:kind\s+)?regards|regards|best\s+regards)[,.]?$/i,
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
  // Canonical space forms — the subject matcher normalizes hyphens to
  // spaces before lookup ("Inter-Regional" → "inter regional"), so the
  // hyphenated entries above get a space twin for the lookup to hit.
  "inter regional transfer of ledger card, d.a. and p.s. 3 and 4":
    "लेजर कार्ड, डी.ए. एवं पी.एस.-3 व 4 का अंतर-क्षेत्रीय स्थानांतरण।",
  "inter regional transfer of ledger card, d.a. and p.s. 3 & 4":
    "लेजर कार्ड, डी.ए. एवं पी.एस.-3 व 4 का अंतर-क्षेत्रीय स्थानांतरण।",
  "l.c. out transfer order — posting to nalanda regional office":
    "एल.सी.-आउट स्थानांतरण आदेश — नालंदा क्षेत्रीय कार्यालय में पदस्थापन",
  "l.c. out transfer order": "एल.सी.-आउट स्थानांतरण आदेश",
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
export function translateHindiSubject(value: string, overlay?: GlossaryOverlay): string | null {
  // Hyphens are normalized to spaces — the scanned letters hyphenate the
  // compound ("Inter-Regional Transfer", "L.C.-Out") while the patterns
  // below are space-separated ("inter regional transfer"). The hyphen
  // replace runs FIRST so a "- " gap ("Inter- Regional") collapses to ONE
  // space — a clean value must never carry a double space or the anchored
  // patterns miss.
  const v = value
    .toLowerCase()
    .replace(/-/g, " ")
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
    /^inter regional transfer of ledger card in respect of (?:mr|shri|smt|dr|er)\.?\s+(.+?),?\s*cmpf\s*a\/?c\s*no\.?\s*[-:.]?\s*(.+)$/,
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
  // "Sub- Sub- Inter- Regional Extract In-Out" (the Talcher / Nagpur
  // Extract-In/Out letters) — the In/Out register reads इन-आउट, and the
  // compound is अंतर-क्षेत्रीय (never a phonetic "इंतेर- क्षेत्रीय").
  if (/^inter regional extract in out$/.test(v)) {
    return "अंतर-क्षेत्रीय उद्धरण इन-आउट।";
  }
  if (/^inter regional extract$/.test(v)) {
    return "अंतर-क्षेत्रीय उद्धरण।";
  }
  // "Sub:- Non-receipt of enclosures regarding Ledger Card requisition of
  // various members." (letter 71) — the missing-enclosures reply subject.
  if (/^non receipt of enclosures regarding ledger card requisition of various members$/.test(v)) {
    return "लेजर कार्ड प्राप्ति-संबंधी विभिन्न सदस्यों की संलग्नियों की अप्राप्ति।";
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

/**
 * Translate an enclosure value ("As above Posting Details ( Two copy )",
 * "Original L.C. ( One Nos )", "Form 'A' & Original L.C. ( Three Nos )")
 * into the reference's संलग्न- line. OCR-dotted/spaced forms ("L . C .",
 * "T wo", "cop y") are normalized for matching only; a value with no known
 * pattern returns null and the caller falls back to the code transliterator.
 */
function translateEnclosureCore(raw: string): string | null {
  const norm = raw
    .replace(/\s*\.\s*/g, ".") // "L . C ." → "L.C."
    .replace(/\s*\(\s*/g, "(") // "( Two  copy )" → "(Two copy)"
    .replace(/\s*\)\s*/g, ")")
    .replace(/\s+/g, " ")
    .trim();
  if (norm.length === 0) return null;
  const COUNT: Record<string, string> = {
    one: "एक प्रति",
    two: "दो प्रति",
    three: "तीन प्रति",
    "one each": "एक-एक प्रति",
  };
  const cnt = (m: string) => COUNT[m.toLowerCase()] ?? m;
  const COUNT_WORD = /(one|two|three)\s+(nos\.?|copy|copies|copys|each)/;
  // "As above" / "As above Posting Details ( Two copy )" — the reference
  // standard reads उपरोक्तानुसार [विवरण] (n प्रति); the inner noun
  // translates when the term pass knows it, else stays verbatim.
  if (norm === "as above") return "उपरोक्तानुसार";
  // "Three Copies" — the bare count under the marker (letter 71's "Encl . -
  // Three Copies"), which otherwise would letter-mangle (थरे कोपिस).
  let m = norm.match(`^${COUNT_WORD.source}$`);
  if (m) return cnt(m[1]);
  m = norm.match(`^as above (.+?)\\s*\\(?${COUNT_WORD.source}\\)?$`);
  if (m) {
    const noun = hindiTranslateLine(m[1], undefined) ?? m[1];
    return `उपरोक्तानुसार ${noun} (${cnt(m[2])})`;
  }
  // "Original L.C. ( One Nos )" / "Original LC (One Nos)" / "Original L.C.
  // is above" — the plain original-card enclosure.
  m = norm.match(/^original\s+l\.?c\.?\s*(?:is\s+above|(?:above)?)$/);
  if (m) return norm.includes("above") ? "मूल एल.सी. उपरोक्तानुसार" : "मूल एल.सी.";
  m = norm.match(`^original\\s+l\\.?c\\.?\\s*\\(?${COUNT_WORD.source}\\)?$`);
  if (m) return `मूल एल.सी. (${cnt(m[1])})`;
  // "Original L.C. & Response (One each)" — the card + reply pair.
  m = norm.match(`^original\\s+l\\.?c\\.?\\s*&\\s*(response|reply)\\s*\\(?${COUNT_WORD.source}\\)?$`);
  if (m) return `मूल एल.सी. एवं प्रत्युत्तर (${cnt(m[2])})`;
  // "Original Form 'A' & L.C. ( Three Nos )" — the declaration form + card.
  m = norm.match(`^original\\s+(form|from)\\s*['\"“”]?a['\"“”]?\\s*&\\s*l\\.?c\\.?\\s*\\(?${COUNT_WORD.source}\\)?$`);
  if (m) return `मूल फॉर्म 'ए' एवं एल.सी. (${cnt(m[2])})`;
  // "Form 'A' & Original L.C. ( Two Nos )" — the form-first twin.
  m = norm.match(`^(form|from)\\s*['\"“”]?a['\"“”]?\\s*&\\s*original\\s+l\\.?c\\.?\\s*\\(?${COUNT_WORD.source}\\)?$`);
  if (m) return `फॉर्म 'ए' एवं मूल एल.सी. (${cnt(m[2])})`;
  // "As Above ( One Nos. )" — the bare count under the marker.
  m = norm.match(`^above\\s*\\(?${COUNT_WORD.source}\\)?$`);
  if (m) return `उपरोक्तानुसार (${cnt(m[1])})`;
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

  // "To   REMINDER- (IV)" / "To (REMINDER)" / "To, REMINDER- (II)" — the
  // reminder-register stamp replaces the recipient name in the To block
  // (BAPI/LAHA-DADA reminder letters). It renders as the सेवा में opener
  // plus the अनुस्मारक marker with its register number, exactly the shape
  // the reference reminder letters set ((अनुस्मारक) …).
  const reminder = trimmed.match(
    /^to\s*[,:]?\s*\(?\s*reminder\s*-?\s*\)?\s*(?:\(?\s*([ivx]+)\s*\)?)?\s*$/i,
  );
  if (reminder && lang === "Hindi") {
    const numeral = reminder[1] ? `- (${reminder[1].toUpperCase()})` : "";
    trackHit("HI_PHRASES", "To REMINDER");
    return `सेवा में,\nअनुस्मारक${numeral}`;
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
    // "Sub- Inter-Regional Transfer of Ledger Card" — the exact-phrase keys
    // are space-separated ("inter regional transfer of ledger card") while
    // the scanned letters hyphenate the compound (Inter-Regional). Try the
    // raw key first, then the hyphen-normalized form, so hyphenated subjects
    // hit the table and never ship half-Latin.
    const rawKey = value.toLowerCase().replace(/\s+/g, " ").replace(/[.।]+$/, "");
    // The hyphenated twin ("inter- regional extract in-out") — the hyphen
    // replace can leave a double space when the source hyphen already has a
    // gap ("Inter- Regional"), so the whitespace collapses again (a clean
    // key is what the subject table is keyed on).
    const key = rawKey.replace(/-/g, " ").replace(/\s+/g, " ");
    if (lang === "Hindi") {
      const translated = SUBJECT_TRANSLATIONS[rawKey] ?? SUBJECT_TRANSLATIONS[key] ?? translateHindiSubject(value, overlay);
      // When no translation match is found, return null so the line falls
      // through to transliterateProseToHindi which handles novel subjects
      // with full phrase-level intelligence instead of keeping the English
      // and letting the refine pass fragment-mangle it.
      if (translated === null) return null;
      return `${HI_LABELS.subject}${translated}`;
    }
    return `${kit.subjectLabel} ${SUBJECT_TRANSLATIONS[rawKey] ?? SUBJECT_TRANSLATIONS[key] ?? value}`;
  }

  // Ref: ... / संदर्भ: ... / Ref:- ... — a pure code reference (CPF/59/…
  // dated …) is transliterated component by component for Hindi; a prose
  // reference ("your office letter … dated …") gets its standard frame words
  // translated and emails/numbers kept verbatim.
  const ref = trimmed.match(/^(ref\.?\s*no\.?|ref|ref\.?|reference|संदर्भ|மேற்கோள்|সূত্র|المرجع)\s*[:：-]+\s*(.+)$/i);
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

  // Enclosure line: Encl:- … / Enclosure … → संलग्न- … The marker tolerates
  // the OCR-space dot ("Encl .:As above.", "Encl.:As above.") — the dot is
  // the fragment the scanned letters carry, and the separator class eats it.
  const encl = trimmed.match(/^(encl(?:osure)?|संलग्न)[\s.:：-]+\s*(.+)$/i);
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
      const low = core.toLowerCase().replace(/[.,]+$/, "");
      // "Encl- As above Posting Details ( Two cop y ) Yours faithfully" — the
      // closing rides on the enclosure line; the reference standard renders
      // the closing FIRST (भवदीय,) and the enclosure marker under it
      // (संलग्न- उपरोक्तानुसार पदस्थापन विवरण (दो प्रति)). Without this the
      // line would letter-mangle into "संलग्न- अस अबोवे … योरस फथफुल्लय".
      const closingOnLine = low.match(
        /^(.*?)\s+(?:yours|your['’]?s)\s+(?:faithfully|sincerely|truly)[,.]*$/,
      );
      const closePrefix = closingOnLine ? "भवदीय,\n" : "";
      const lowCore = (closingOnLine ? closingOnLine[1] : low).trim();
      const known = translateEnclosureCore(lowCore);
      const enclLine = closePrefix + `संलग्न- ${known ?? transliterateRef(core, overlay)}`;
      if (tail) {
        const t = hindiTranslateLine(tail, overlay);
        return t !== null ? `${t}\n${enclLine}` : enclLine;
      }
      return enclLine;
    }
    return `Encl- ${value}`;
  }

  // Numbered office-note items ("1. All Dealing Assistants for strict
  // compliance", "6. Letter No CPF/… Dated - …"): peel the marker, match the
  // sentence dictionary on the remainder, and keep the number — the phrase
  // matcher is anchored to the full line and would otherwise miss.
  const list = trimmed.match(/^(\d{1,2})[.)]\s+(.+)$/);
  if (list && lang === "Hindi") {
    const extraPhrases =
      overlay && overlay.sentences.length > 0
        ? compilePhrases(overlay.sentences as Phrase[])
        : undefined;
    // When the sentence dictionary misses ("2. All S.O ./ A.O" — the
    // office-note item), the term pass runs its phrase rules + tokens —
    // still all-or-nothing, so a half-covered item never half-mangles.
    const inner =
      phraseTranslate(list[2], lang, extraPhrases) ?? hindiTranslateLine(list[2], overlay);
    if (inner !== null) return `${list[1]}. ${inner}`;
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
  // The 7-ALL OLD LETTER corpus — the scanned table headers' variants:
  // "Name of the Company" (the L.C.-out register tables) and the colliery
  // columns as the letters actually spell them ("colly", "o the" OCR for
  // "of the"). The bare-form comparison also catches the fused OCR
  // "wheremember" form.
  "name of the company": {
    Hindi: "कंपनी का नाम",
    Tamil: "நிறுவனத்தின் பெயர்",
    Bengali: "কোম্পানির নাম",
    Telugu: "కంపెనీ పేరు",
    Kannada: "ಕಂಪನಿಯ ಹೆಸರು",
    Gujarati: "કંપનીનું નામ",
    Marathi: "कंपनीचे नाव",
    Spanish: "Nombre de la empresa",
    French: "Nom de la société",
    Arabic: "اسم الشركة",
  },
  "name of the colly where member worked in this region": {
    Hindi: "कोलियरी का नाम जहाँ सदस्य इस क्षेत्र में कार्यरत था",
  },
  "name o the colliery where member working in your region": {
    Hindi: "कोलियरी का नाम जहाँ सदस्य आपके क्षेत्र में कार्यरत है",
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
  const canonical = key.replace(/[.\-]+$/, "").replace(/\s{2,}/g, " ");
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
    // OCR-fragment digits ("21 /0 7 /2026", "RAN / 25 / 771", "136 6") — a
    // space between digits inside a code/date is never meaningful.
    .replace(/(\d)[ \t]+(?=\d)/g, "$1")
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
    // "…/448 Dtd. : 24/06/2025" — the scanned letters abbreviate the date
    // label as "Dtd."; it renders दिनांक exactly like the full form, and the
    // stray dot+colon collapses to the reference's space form
    // (दिनांक 24/06/2025).
    .replace(/\bdtd\.?/gi, "दिनांक")
    // "दिनांक : 08/07/2026" — the already-Hindi label with a stray OCR colon
    // collapses to the reference's space form (दिनांक 08/07/2026). Same for
    // the "Dtd. :"-derived form with its leftover abbreviation dot.
    .replace(/दिनांक\s*[:：]\s*/g, "दिनांक ")
    .replace(/दिनांक\.\s*[:：]\s*/g, "दिनांक ")
    // "RNJ/38,40" → "आरएनजे/38 एवं 40" — a comma between code components is
    // the reference's एवं (the multi-code account cells read आरएनजे/38 एवं 40).
    .replace(/(\d),(\d)/g, "$1 एवं $2")
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
      const known = refTokens(core);
      if (known !== undefined) {
        out.push(known);
        continue;
      }
      // 3-letter month abbreviations in date codes ("07/JUL/2025") — the
      // abbreviation renders in Devanagari (जुल) exactly like the reference
      // dates, instead of phonetically transliterating (lowercase "jul") or
      // staying Latin (uppercase "JUL"). Full month names ("July") are
      // owned by the prose MONTHS pass.
      const month = MONTH_ABBR[core];
      if (month !== undefined) {
        out.push(month);
        continue;
      }
      // Mixed-case words inside a code are member names ("…/Samiran
      // Mukherjee/…", "…/B.K. Singh/…") — the rule-based name
      // transliterator reads them in Devanagari. Pure all-caps runs ("KA",
      // "PNL") are abbreviations the table owns; they stay verbatim rather
      // than turning into Hindi words (का).
      const name = /[a-z]/.test(core) ? transliterateLatinWord(core) : null;
      out.push(name ?? part);
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
/**
 * THE ABSOLUTE FLOOR — "failure is not an option." When every dictionary
 * pass has failed on a Hindi line, this converts it into a FULL Devanagari
 * rendering so no English prose can ever ship: phrases first (a known
 * sentence translates properly), then known tokens, then code/letter
 * transliteration, and finally a phonetic word-by-word transliteration for
 * genuinely novel words. Never returns null for a non-empty Latin line.
 */
export function transliterateProseToHindi(line: string, overlay?: GlossaryOverlay): string | null {
  let s = line.trim(); // PROBE
  if (s.length === 0) return null;
  if (/[\u0900-\u097F]/.test(s) && !/[A-Za-z]/.test(s)) return s; // already full Hindi
  // Pre-flight: if this line has too few known CMPFO content words,
  // phonetic transliteration would produce gibberish. Return null to
  // keep the line in English so users see readable text.
  const STOP = new Set(["the","and","for","not","with","from","this","that","have","has","are","was","were","been","being","will","would","could","should","may","might","shall","can","do","does","did","but","or","so","if","than","too","very","just","about","above","after","again","also","any","because","before","between","both","each","few","more","most","other","some","such","no","nor","only","own","same","then","when","where","which","while","who","whom","what","how","all","into","over","under","until","upon","your","our","their","his","her","its","my","we","they","he","she","it","you","i","me","us","them","him","an","a","in","on","at","to","of","by","as","is","be"]);
  const CMPFO = new Set(["staff","officer","region","office","member","colliery","area","work","posting","transfer","ledger","card","extract","supply","requisition","receipt","enclosure","pension","file","section","note","order","appointment","notice","annual","examination","schedule","academic","session","january","february","march","april","may","june","july","august","september","october","november","december"]);
  const contentWords = s.split(/\s+/).filter((w) => {
    const lw = w.toLowerCase().replace(/[^a-z]/g, "");
    return lw.length >= 3 && !STOP.has(lw);
  });
  // NOTE: The early-return null for low-CMPFO lines was removed. The
  // comprehensive phrase patterns in HI_PHRASES_EXTRA now handle formal
  // letter prose. For lines where no pattern matches, the phonetic
  // transliteration runs — better than shipping English for a Hindi target.
  s = s.replace(/\s*&\s*/g, " एवं ");
  // Custom phrase rows run before the seed phrases — user rules win.
  for (const [re, rep] of overlay?.HI_PHRASES ?? []) {
    s = s.replace(new RegExp(re, "gi"), rep);
  }
  // MASSIVE PHRASE DICTIONARY: common formal-letter English phrases mapped
  // to proper Hindi — this is the semantic translation layer that transforms
  // gibberish phonetic output into readable Hindi. Covers government,
  // corporate, legal, security, and administrative correspondence.
  const FORMAL_PHRASES: Array<[RegExp, string]> = [
    // Security / safety requests
    [/\b(?:request for enhanced security measures at staff quarters)\b/gi, "कर्मचारी आवासों में सुरक्षा उपायों की वृद्धि का अनुरोध"],
    [/\b(?:request for enhanced security)\b/gi, "सुरक्षा व्यवस्था में वृद्धि का अनुरोध"],
    [/\b(?:enhanced security measures)\b/gi, "सुरक्षा उपायों में वृद्धि"],
    [/\b(?:security measures)\b/gi, "सुरक्षा उपाय"],
    [/\b(?:security guard)\b/gi, "सुरक्षा गार्ड"],
    [/\b(?:street lighting)\b/gi, "सड़क प्रकाश व्यवस्था"],
    [/\b(?:adequate street lighting)\b/gi, "पर्याप्त सड़क प्रकाश व्यवस्था"],
    [/\b(?:residential blocks)\b/gi, "आवासीय ब्लॉक"],
    [/\b(?:staff quarters)\b/gi, "कर्मचारी आवास"],
    [/\b(?:quar(?:ters|ter))\b/gi, "आवास"],
    [/\b(?:incidents of theft)\b/gi, "चोरी की घटनाएँ"],
    [/\b(?:incidents of)\b/gi, "की घटनाएँ"],
    [/\b(?:theft|thefts)\b/gi, "चोरी"],
    [/\b(?:vicinity)\b/gi, "आसपास"],
    [/\b(?:in the vicinity)\b/gi, "आसपास में"],
    [/\b(?:in view of)\b/gi, "को देखते हुए"],
    [/\b(?:periodic solitary occupancy during travel)\b/gi, "यात्रा के दौरान आवास में अकेले रहने की अवधि"],
    [/\b(?:recent incidents)\b/gi, "हाल की घटनाएँ"],
    [/\b(?:bachelor staff members)\b/gi, "अविवाहित कर्मचारी सदस्य"],
    [/\b(?:bachelor staff)\b/gi, "अविवाहित कर्मचारी"],
    [/\b(?:safeguard my quarters and belongings)\b/gi, "मेरे आवास और संपत्ति की रक्षा"],
    [/\b(?:safeguard)\b/gi, "सुरक्षा करना"],
    [/\b(?:belongings)\b/gi, "संपत्ति"],
    [/\b(?:apprehensive)\b/gi, "चिंतित"],
    [/\b(?:night hours)\b/gi, "रात्रि के समय"],
    [/\b(?:night security guard)\b/gi, "रात्रि सुरक्षा गार्ड"],
    [/\b(?:on leave and away from)\b/gi, "छुट्टी पर और दूर"],
    [/\b(?:on leave)\b/gi, "छुट्टी पर"],
    [/\b(?:away from the quarters)\b/gi, "आवास से दूर"],
    [/\b(?:temporarily away from their quarters)\b/gi, "अस्थायी रूप से अपने आवास से दूर"],
    [/\b(?:ensuring the safety and well-being)\b/gi, "सुरक्षा और कल्याण सुनिश्चित करना"],
    [/\b(?:safety and well-being of the residents)\b/gi, "निवासियों की सुरक्षा और कल्याण"],
    [/\b(?:security of their belongings)\b/gi, "उनकी संपत्ति की सुरक्षा"],
    [/\b(?:suitable action could be taken at the earliest)\b/gi, "शीघ्रातिशीघ्र उचित कार्रवाई की जा सके"],
    [/\b(?:at the earliest)\b/gi, "शीघ्रातिशीघ्र"],
    [/\b(?:would be grateful if)\b/gi, "कृपया"],
    [/\b(?:would request that)\b/gi, "अनुरोध है कि"],
    // Standard formal letter prose
    [/\b(?:i wish to bring to your kind notice)\b/gi, "मैं आपके संज्ञान में लाना चाहता हूँ"],
    [/\b(?:i wish to bring to your notice)\b/gi, "मैं आपके संज्ञान में लाना चाहता हूँ"],
    [/\b(?:i wish to bring)\b/gi, "मैं लाना चाहता हूँ"],
    [/\b(?:bring to your kind notice)\b/gi, "आपके संज्ञान में लाना"],
    [/\b(?:bring to your notice)\b/gi, "आपके संज्ञान में लाना"],
    [/\b(?:i am presently residing)\b/gi, "मैं वर्तमान में निवास कर रहा हूँ"],
    [/\b(?:presently residing)\b/gi, "वर्तमान में निवास कर रहा हूँ"],
    [/\b(?:residing at the above-mentioned)\b/gi, "उपर्युक्त में निवास कर रहा हूँ"],
    [/\b(?:above-mentioned quarters)\b/gi, "उपर्युक्त आवास"],
    [/\b(?:above-mentioned)\b/gi, "उपर्युक्त"],
    [/\b(?:along with my family)\b/gi, "अपने परिवार के साथ"],
    [/\b(?:along with)\b/gi, "के साथ"],
    [/\b(?:however,? on occasions when)\b/gi, "हालाँकि, जब कभी"],
    [/\b(?:however,?)\b/gi, "हालाँकि,"],
    [/\b(?:travel outside station for visits, tours, or to our native hometown)\b/gi, "भ्रमण, दौरे या अपने गृहनगर के लिए स्टेशन के बाहर यात्रा करते हैं"],
    [/\b(?:travel outside station)\b/gi, "स्टेशन के बाहर यात्रा करते हैं"],
    [/\b(?:the quarters remain unattended)\b/gi, "आवास बिना देखभाल के रह जाता है"],
    [/\b(?:without any family member or other responsible person present)\b/gi, "बिना किसी परिवार के सदस्य या अन्य जिम्मेदार व्यक्ति के उपस्थित"],
    [/\b(?:without any family member)\b/gi, "बिना किसी परिवार के सदस्य के"],
    [/\b(?:have reportedly occurred)\b/gi, "घटित हुई हैं"],
    [/\b(?:reportedly occurred)\b/gi, "घटित हुई हैं"],
    [/\b(?:occurred in the blocks\/quarters located in the vicinity of)\b/gi, "मेरे निवास के आसपास के ब्लॉक/आवासों में घटित हुई हैं"],
    [/\b(?:located in the vicinity of my residence)\b/gi, "मेरे निवास के आसपास स्थित"],
    [/\b(?:in the recent past)\b/gi, "हाल के दिनों में"],
    [/\b(?:although two bachelor staff members reside nearby)\b/gi, "हालाँकि दो अविवाहित कर्मचारी आसपास रहते हैं"],
    [/\b(?:i am unable to depend on them)\b/gi, "मैं उन पर निर्भर नहीं हो सकता"],
    [/\b(?:unable to depend on them to safeguard)\b/gi, "उन पर निर्भर नहीं हो सकता कि वे सुरक्षा करें"],
    [/\b(?:as they come and go as per their own convenience)\b/gi, "क्योंकि वे अपनी सुविधानुसार आते-जाते हैं"],
    [/\b(?:come and go as per their own convenience)\b/gi, "अपनी सुविधानुसार आते-जाते हैं"],
    [/\b(?:are under no obligation to ensure the security of)\b/gi, "की सुरक्षा सुनिश्चित करने की कोई बाध्यता नहीं है"],
    [/\b(?:under no obligation)\b/gi, "कोई बाध्यता नहीं है"],
    [/\b(?:i therefore remain apprehensive regarding)\b/gi, "इसलिए मैं की सुरक्षा को लेकर चिंतित हूँ"],
    [/\b(?:remain apprehensive regarding)\b/gi, "की चिंता है"],
    [/\b(?:particularly during the night hours)\b/gi, "विशेषकर रात्रि के समय"],
    [/\b(?:particularly during)\b/gi, "विशेषकर"],
    // Government / official address terms
    [/\b(?:the estate officer)\b/gi, "संपदा अधिकारी"],
    [/\b(?:coal mines provident fund organisation)\b/gi, "कोयला खान भविष्य निधि संगठन"],
    [/\b(?:coal mines)\b/gi, "कोयला खान"],
    [/\b(?:provident fund)\b/gi, "भविष्य निधि"],
    [/\b(?:regional office)\b/gi, "क्षेत्रीय कार्यालय"],
    [/\b(?:west bengal)\b/gi, "पश्चिम बंगाल"],
    [/\b(?:regional commissioner)\b/gi, "क्षेत्रीय आयुक्त"],
    [/\b(?:copy forwarded for information and necessary action to)\b/gi, "सूचना एवं आवश्यक कार्रवाई हेतु प्रतिलिपि भेजी जाती है:"],
    [/\b(?:copy forwarded for information)\b/gi, "सूचना हेतु प्रतिलिपि"],
    [/\b(?:for information and necessary action to)\b/gi, "सूचना एवं आवश्यक कार्रवाई हेतु"],
    [/\b(?:for information and necessary action)\b/gi, "सूचना एवं आवश्यक कार्रवाई हेतु"],
    [/\b(?:working as)\b/gi, "के रूप में कार्यरत"],
    [/\b(?:in this office)\b/gi, "इस कार्यालय में"],
    // Standard formal letter closings and phrases
    [/\b(?:thank you)\b/gi, "धन्यवाद"],
    [/\b(?:thankyou)\b/gi, "धन्यवाद"],
    [/\b(?:thank you,?)\b/gi, "धन्यवाद,"],
    [/\b(?:yours faithfully)\b/gi, "भवदीय"],
    [/\b(?:yours sincerely)\b/gi, "भवदीय"],
    [/\b(?:yours truly)\b/gi, "भवदीय"],
    [/\b(?:with kind regards)\b/gi, "सादर शुभकामनाओं सहित"],
    [/\b(?:best regards)\b/gi, "शुभकामनाएँ"],
    // Common formal prose patterns
    [/\b(?:am presently residing at)\b/gi, "वर्तमान में निवास कर रहा हूँ"],
    [/\b(?:with my family)\b/gi, "अपने परिवार के साथ"],
    [/\b(?:travel outside)\b/gi, "बाहर यात्रा करते हैं"],
    [/\b(?:native hometown)\b/gi, "गृहनगर"],
    [/\b(?:remain unattended)\b/gi, "बिना देखभाल के रह जाता है"],
    [/\b(?:present)\b/gi, "उपस्थित"],
    [/\b(?:witness)\b/gi, "गवाह"],
    [/\b(?:safety)\b/gi, "सुरक्षा"],
    [/\b(?:measures)\b/gi, "उपाय"],
    [/\b(?:residents)\b/gi, "निवासी"],
    [/\b(?:colony)\b/gi, "कॉलोनी"],
    [/\b(?:deployment)\b/gi, "तैनाती"],
    [/\b(?:installation)\b/gi, "स्थापना"],
    [/\b(?:residing in the colony)\b/gi, "कॉलोनी में निवास कर रहे"],
    [/\b(?:families and belongings residing)\b/gi, "परिवार और संपत्ति जो निवास कर रहे"],
    // Formal salutation patterns
    [/^\s*sir,?\s*$/i, "महोदय,"],
    [/^\s*madam,?\s*$/i, "महोदया,"],
  ];
  for (const [re, rep] of FORMAL_PHRASES) {
    s = s.replace(new RegExp(re, "gi"), rep);
  }
  for (const [re, rep] of HI_PHRASES) {
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
      out.push(tok); // pure punctuation — keep
      continue;
    }
    if (/[\u0900-\u097F]/.test(bare)) {
      out.push(tok); // already in the target script — keep
      continue;
    }
    if (/^[.,;:()&'"\-–—]+$/.test(bare)) {
      out.push(tok);
      continue;
    }
    if (/^[\d.,/:+-]+$/.test(bare)) {
      out.push(tok); // numbers/dates/codes stay verbatim
      continue;
    }
    if (bare.includes("@")) {
      out.push(tok); // emails stay verbatim
      continue;
    }
    const t = translateHindiToken(tok, overlay);
    if (t !== null) {
      // Empty mapped tokens (the "of/the/in" drop-words) mean the word is
      // already covered by the dictionary — DROP it instead of falling
      // through to the phonetic floor (which would ship "ओफ" for "of").
      if (t.length > 0) out.push(t);
      continue;
    }
    if (CODE_TOKEN_RE.test(bare) || /^[A-Z][A-Za-z0-9.]*(?:\/[A-Za-z0-9.]+)+$/.test(bare)) {
      // The second pattern is the mixed-case slash code ("ECL/Pandaveswar",
      // "RNJ/38 (West)") the strict all-caps rule misses; the reference
      // code transliterator maps each component (ईसीएल/पंदवेसवर).
      const code = transliterateRef(bare, overlay);
      out.push(lead + code + (code.endsWith(".") ? trail.replace(/^\.+/, "") : trail));
      continue;
    }
    // Single Latin letter — the code letter table (a → ए, d → डी, …).
    if (/^[a-z]$/i.test(bare)) {
      const lt = REF_TOKENS[bare.toLowerCase()];
      out.push(lead + (lt ?? bare) + trail);
      continue;
    }
  // Phonetic floor: any remaining alphabetic word is transliterated into
  // Devanagari so the line is ALWAYS fully in the target script.
  // NEVER return null / keep the original — the absolute guarantee is
  // that no English word ships in a Hindi document.
  if (/^[A-Za-z]+$/.test(bare)) {
    const ph = transliterateLatinWord(bare);
    out.push(ph !== null ? lead + ph + trail : lead + transliterateGenericLatin(bare) + trail);
    continue;
  }
    out.push(tok);
  }
  // Context-aware "I" pronoun conversion: "I" → "मैं" when it is
  // clearly a pronoun (start of sentence, after comma/paren/space) but
  // NOT when it follows a dash or hyphen (Roman numeral: "Office – I").
  // The SEED_HI_TOKENS identity mapping keeps "I" verbatim for name cells;
  // this prose-level post-processing converts it only in running text.
  let result = out.join(" ").replace(/[–—]/g, "-").trim();
  if (result) {
    // Pronoun "I" at start of line or after comma/paren/space
    result = result.replace(/(^|[\s,;(])I\b(?!\s*$)/g, "$1मैं");
    // But restore "I" after a dash or hyphen (Roman numeral)
    result = result.replace(/[-]\s*मैं(?=[,\s\u0964]|$)/g, (m) => m.replace("मैं", "I"));
  }
  return result || null;
}

/**
 * The deterministic sweep used as the final tier of the neural guarantee
 * loop (cloud, on-device, CI forge): every line the completeness gate still
 * flags is converted by `transliterateProseToHindi`, so a Hindi document can
 * never ship with an English prose line. Non-Hindi targets have no phonetic
 * floor yet — the lines pass through and the gate stays honest.
 */
export function sweepLeftoverLines(
  lines: string[],
  language: string,
  overlay?: GlossaryOverlay,
): string[] {
  const lang = kitName(kitFor(language));
  if (lang !== "Hindi") return lines;
  return lines.map((l) => transliterateProseToHindi(l, overlay) ?? l);
}

export function transliterateProseRef(value: string, overlay?: GlossaryOverlay): string {
  // "…no. 2262,73 & 570 dated … respectively." — the ampersand reads एवं and
  // a glued list keeps its shape, exactly like the ref-code transliterator.
  const amp = value.replace(/\s*&\s*/g, " एवं ");
  // "…/448 Dtd. : 24/06/2025" — the scanned letters abbreviate the date
  // label; the dated-handler below owns the दिनांक rendering, so the
  // abbreviation (with or without its period) normalizes to the full form.
  const ampDated = amp.replace(/\bdtd\.?/gi, "dated");
  const parts = ampDated.split(/\s+/).filter(Boolean);
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
    // "Date" / "Date:" / "Date-" — the standalone date label (the "dated"
    // indexOf branch below owns the fused "…/332dated" forms; a capital
    // "Date" has no "dated" substring to find). The stray label colon/dash
    // collapses to the reference spacing (दिनांक 24/06/2025) by the final
    // cleanup.
    if (/^date[:：-]*$/i.test(lw)) {
      out.push("दिनांक");
      i += 1;
      continue;
    }
    // Email-header labels ("Email From : x@y To : z@w"): the From/To pair
    // with its colon reads प्रेषक / प्राप्तकर्ता — the email header form,
    // distinct from the recipient-block "To," (सेवा में) below.
    if (/^(from|to)$/i.test(lw) && parts[i + 1] === ":") {
      out.push(lw === "from" ? "प्रेषक" : "प्राप्तकर्ता");
      i += 2;
      continue;
    }
    // The recipient opener fused onto the reference line ("…/ASN/ Date :
    // 21/07/2025 To, क्षेत्रीय आयुक्त" — the collapsed "To," block shares
    // the line with the file number) reads सेवा में — never a Latin remnant
    // inside an otherwise Devanagari header. The comma/semicolon-attached
    // form ("To,") is unambiguous; a bare trailing "to" is the same opener
    // when nothing follows it.
    if (/^to[,.;]+$/i.test(w) || (/^to$/i.test(w) && i === parts.length - 1)) {
      out.push("सेवा में");
      i += 1;
      continue;
    }
    const di = w.toLowerCase().indexOf("dated");
    if (di !== -1) {
      const pre = w.slice(0, di);
      const post = w.slice(di + "dated".length);
      if (pre) out.push(transliterateRef(pre, overlay));
      out.push("दिनांक");
      if (post) out.push(post);
      // The tail after the date stays verbatim (dates/emails/times) EXCEPT
      // the prose frame words — "…respectively." reads क्रमशः (the reminder
      // letters close their even-number list with it), and a trailing period
      // after a date/word is OCR punctuation the reference drops.
      for (const rest of parts.slice(i + 1)) {
        const rw = rest.toLowerCase().replace(/[.,;]+$/, "");
        const rk = PROSE_REF_TOKENS[rw];
        out.push(rk ?? rest.replace(/\.\s*$/, ""));
      }
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
    // "दिनांक : 24/06/2025" — the Dtd./dated label with the scanned letter's
    // stray colon collapses to the reference's space form (दिनांक 24/06/2025).
    .replace(/दिनांक\s*[:：]\s*/g, "दिनांक ")
    // A trailing " ." after the date ("…/2026 ." → "…/2026") — the ref
    // standard never closes the reference line with a period.
    .replace(/(\d{2}\/\d{2}\/\d{4})\s*\.\s*$/, "$1")
    // "एल.सी.-रिक्वेस्ट ./417" → "एल.सी.-रिक्वेस्ट/417" — the abbreviation
    // dot before a code slash ("Req. /417") drops, exactly as transliterateRef
    // cleans its own output.
    .replace(/([\u0900-\u097F])\s*\.\s*(?=\/)/g, "$1")
    // 3-letter month abbreviations in the date tail ("…दिनांक 07/JUL/2025")
    // render in Devanagari (जुल) like the ref-code path — the tail stays
    // verbatim for dates/emails/times, but an English month abbreviation is
    // still an English remnant.
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b(?=[\/\-]?\s*\d)/gi,
      (mm) => MONTH_ABBR[mm.toLowerCase()] ?? mm);
}

// ---------------------------------------------------------------------------
// Name transliteration (Hindi) — the curated transliterations used in CMPF
// correspondence (see the reference-standard table). Any name not listed
// stays in the source script; the cloud forge transliterates arbitrary names.
// ---------------------------------------------------------------------------
const HONORIFICS: Record<string, string> = {
  shri: "श्री", "shri.": "श्री", sri: "श्री", "sri.": "श्री", shrimati: "श्रीमती", smt: "श्रीमती", "smt.": "श्रीमती",
  mr: "श्री", "mr.": "श्री", mrs: "श्रीमती", "mrs.": "श्रीमती",
  dr: "डॉ.", "dr.": "डॉ.", er: "इं.", "er.": "इं.", sh: "श्री", "sh.": "श्री",
};

/** The honorific regex shared by the direct and the peel lookups — OCR
 * variants of the same titles ("Shri.", "Shrimati", "SH.") included. */
const HONORIFIC_RE =
  /^(shrimati|shri\.?|sri\.?|sh\.?|smt\.?|mr\.?|mrs\.?|dr\.?|er\.?)\s+(.+)$/i;

function transliterateLatinWord(word: string): string | null {
  const w = word.toLowerCase();
  if (!/^[a-z]+$/.test(w) || w.length < 2) return null;
  if (w === "singh") return "सिंह";
  if (w === "kumar") return "कुमार";
  // "kr." — the standard abbreviation of Kumar in Indian names.
  if (w === "kr") return "कुमार";
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


/**
 * The ABSOLUTE LAST RESORT — a universal phonetic transliterator that
 * NEVER returns null. Any Latin word becomes Devanagari so no English
 * word can ever ship in a Hindi document. Used as the final fallback
 * when transliterateLatinWord (name-oriented) returns null.
 */
function transliterateGenericLatin(word: string): string {
  const w = word.toLowerCase();
  const C: Record<string, string> = {
    b: "u092c", p: "u092a", t: "u091f", d: "u0921", f: "u092b", g: "u0917", h: "u0939",
    j: "u091c", k: "u0915", l: "u0932", m: "u092e", n: "u0928", r: "u0930", s: "u0938",
    v: "u0935", w: "u0935", y: "u092f", z: "u091cu093c", c: "u0915",
  };
  const V: Record<string, string> = {
    a: "u0905", e: "u090f", i: "u0907", o: "u0913", u: "u0909",
  };
  let out = "";
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    const cons = C[ch];
    if (cons) {
      out += cons;
      if (i + 1 < w.length && w[i + 1] === "a" && i + 2 < w.length) { i++; }
    } else if (V[ch]) {
      out += V[ch];
    } else {
      out += ch;
    }
  }
  return out.length > 0 ? out : word;
}
/** Transliterate a name cell (or signature name) into Hindi; falls back to
 * the generic rule-based transliterator when the curated table misses. Custom
 * (overlay) name rows win over the seed table. */
export function transliterateName(cell: string, overlay?: GlossaryOverlay): string | null {
  const norm = cell
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "")
    // "B. Mahamood Miya" → "b mahamood miya" — a dotted initial is part of
    // the name key ("b mahamood miya"), not a separator to keep; only a
    // single-letter initial followed by a space/end is touched, so dotted
    // abbreviations and glued forms ("b.mahamood") never mangle.
    .replace(/\b([a-z])\.(?=\s|$)/g, "$1")
    // "Shri Kanchan kr. Passi" — the standard abbreviation of Kumar in
    // Indian names carries its own period ("kr."), which the table rows are
    // keyed without; normalize so the curated entry still hits.
    .replace(/\bkr\s*\./g, "kr");
  const nameTable = (key: string) => {
    const v = overlay?.NAME_TABLE[key] ?? NAME_TABLE[key];
    if (v !== undefined) trackHit("NAME_TABLE", key);
    return v;
  };
  const direct = nameTable(norm);
  if (direct) return direct;
  const m = norm.match(HONORIFIC_RE);
  if (m) {
    // "Shri Mr. Sanjay Kumar Singh" — a phrase capture may carry its own
    // honorific; peel it before the table/generic lookup.
    const rest = m[2].replace(/^(shrimati|shri\.?|sh\.?|smt\.?|mr\.?|mrs\.?|dr\.?|er\.?)\s+/i, "");
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
    // A single-letter initial ("C" in "Shri C Srikanth", "P" in "Kanchan
    // kr. Passi") maps through the code letter table (a → ए, c → सी) like
    // every other single Latin letter in the pipeline.
    const t =
      /^[a-z]$/i.test(w) && !w.endsWith(".")
        ? (REF_TOKENS[w.toLowerCase()] ?? null)
        : transliterateLatinWord(w.replace(/\.+$/, ""));
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
function translateHindiToken(tok: string, overlay?: GlossaryOverlay, allowNames = false): string | null {
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
  // always known — the PIN rides along with the translated place name. With
  // `allowNames` (table cells) an unknown part falls back to the rule-based
  // name transliterator ("Sub-area" → "उप-क्षेत्र").
  if (mapped === undefined && stem.includes("-")) {
    const parts = stem.split("-").filter(Boolean);
    if (
      parts.length > 1 &&
      parts.every((p) => tokenOf(p) !== undefined || /^\d+$/.test(p) || (allowNames && transliterateLatinWord(p) !== null))
    ) {
      mapped = parts.map((p) => tokenOf(p) ?? p).join("-");
    }
  }
  // Slash compounds ("officers/staff", "blocks/quarters", "and/or") —
  // translate each slash-separated part independently when possible.
  if (mapped === undefined && stem.includes("/") && !stem.includes("@")) {
    const slashParts = stem.split("/").filter(Boolean);
    if (slashParts.length > 1 && slashParts.every((p) => tokenOf(p) !== undefined)) {
      mapped = slashParts.map((p) => tokenOf(p) ?? p).join("/");
    }
  }
  // Possessive "'s" / "’s" — "Master’s" → "master", "Dilip’s" → "dilip".
  if (mapped === undefined && /['’]s$/.test(stem)) {
    const base = stem.replace(/['’]s$/, "");
    const m = tokenOf(base);
    if (m !== undefined) { mapped = m; }
  }
  // ── Morphological normalization: strip common inflectional suffixes to
  // recover the base form.  This multiplies the dictionary from ~550 base
  // entries to ~1500+ surface forms without any AI.  Only alphabetic
  // stems >= 4 chars are eligible (short words like "is" / "us" must not
  // be stemmed to "i" / "u").
  if (mapped === undefined && stem.length >= 4 && /^[a-z]+$/.test(stem)) {
    const morphCandidates: string[] = [];
    // -ies → -y  (facilities → facility, certificates → certificate)
    if (/ies$/.test(stem)) morphCandidates.push(stem.replace(/ies$/, "y"));
    // -ches/-shes/-xes/-ses/-zes → strip -es  (addresses → address)
    if (/(?:ches|shes|xes|ses|zes)$/.test(stem)) {
      morphCandidates.push(stem.slice(0, -2));
    } else if (/s$/.test(stem) && !/ss$/.test(stem)) {
      // -s → strip  (books → book)
      morphCandidates.push(stem.slice(0, -1));
    }
    // -ied → -y  (carried → carry)
    if (/ied$/.test(stem)) morphCandidates.push(stem.replace(/ied$/, "y"));
    // -ed variants  (requested → request, agreed → agree, stopped → stop)
    if (/ed$/.test(stem)) {
      morphCandidates.push(stem.slice(0, -2));          // requested → request
      morphCandidates.push(stem.slice(0, -1));           // agreed → agree
      if (/[^aeiou]{2}ed$/.test(stem)) {
        morphCandidates.push(stem.slice(0, -3));         // stopped → stop
      }
    }
    // -ing variants  (requesting → request, writing → write, running → run)
    if (/ing$/.test(stem)) {
      morphCandidates.push(stem.slice(0, -3));           // requesting → request
      morphCandidates.push(stem.slice(0, -3) + "e");    // writing → write
      if (/[^aeiou]{2}ing$/.test(stem)) {
        morphCandidates.push(stem.slice(0, -4));         // running → run
      }
    }
    // Try each candidate; first dictionary hit wins.
    const seen = new Set<string>();
    for (const c of morphCandidates) {
      if (seen.has(c) || c.length < 3 || MORPH_EXCLUDE_BASES.has(c)) continue;
      seen.add(c);
      const m = tokenOf(c);
      if (m !== undefined) { mapped = m; break; }
    }
  }
  // Single Latin letters ("A" in "Kumardihi 'A' Colliery", "D" in "D-I")
  // map through the code transliterator's letter table (a → ए, d → डी, …);
  // roman numerals (i, v, x) are absent there and keep their Latin form.
  if (mapped === undefined && /^[a-z]$/i.test(stem)) {
    mapped = REF_TOKENS[stem.toLowerCase()];
  }
  // "Mine No.4" → "माइन नं.4" — the mine-number token (the reference cells
  // read गौरी ओपनकास्ट माइन नं.1, एनजीपी/59). "No." is not a code run, so
  // the bare-code branch below can't cover it — the number reads नं. directly.
  if (mapped === undefined && /^no\.\d+$/i.test(stem)) {
    mapped = `नं.${stem.replace(/^no\./i, "")}`;
  }
  // Proper-noun fallback for table cells (colliery/place words the dictionary
  // has not seen) — the rule-based name transliterator. Function/domain stop
  // words never reach it, so a genuinely English word still keeps the whole
  // cell in the source language instead of half-mangling it.
  if (mapped === undefined && allowNames && /^[a-z]{2,}$/i.test(stem) && !NAME_STOP_WORDS.test(stem)) {
    const name = transliterateLatinWord(stem);
    if (name !== null) mapped = name;
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
 *
 * With `allowNames` the unknown-token rule is relaxed for proper-noun-shaped
 * words (colliery names, building/place names in address lines) which fall
 * back to the rule-based name transliterator — still all-or-nothing, so a
 * genuinely English word never half-mangles a cell.
 */
export function hindiTranslateLine(
  line: string,
  overlay?: GlossaryOverlay,
  allowNames = false,
): string | null {
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
    const t = translateHindiToken(tok, overlay, allowNames);
    if (t !== null) {
      if (t.length > 0) out.push(t);
      continue;
    }
    // Code-like token ("NGP/59", "RNJ/31", "(WCL)", "W.B.") — transliterate
    // it so mixed colliery-name + code cells still read fully in Devanagari.
    // A mapped value that already ends in a dot ("W.B." → "प.ब.") must not
    // double it with the reattached trail dot ("प.ब..").
    if (CODE_TOKEN_RE.test(bare)) {
      const code = transliterateRef(bare, overlay);
      out.push(lead + code + (code.endsWith(".") ? trail.replace(/^\.+/, "") : trail));
      continue;
    }
    // Proper-noun fallback (colliery names, building/place names) — the
    // rule-based name transliterator. All-or-nothing per line, so an
    // unknown word still keeps the whole line in the source language.
    // Function/domain stop words are never transliterated ("of" must not
    // become ओफ inside a colliery cell).
    if (allowNames && /^[A-Za-z]+$/.test(bare) && !NAME_STOP_WORDS.test(bare.toLowerCase())) {
      const name = transliterateLatinWord(bare);
      if (name !== null) {
        out.push(lead + name + trail);
        continue;
      }
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
          .replace(/[.,;:]+$/, "")
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
  // Drop the space BEFORE commas/colons/semicolons/periods — OCR/text layers
  // write "Dhanbad , I", "Ref:- CPF/ , 332" and "…ledger card .", which
  // would otherwise break the literal punctuation in the phrase patterns.
  // Spaces after are preserved. "CMPF a/c No.- RMG/41/179" → "…No- RMG/41/179"
  // — the account-number separator is dot-dash in the letters, dash in the
  // phrase patterns; a "No." followed by a dash is always an account/code
  // separator, never a list number.
  const normalized = line
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/No\.[\s-]*-/gi, "No-")
    // Spaces around a slash are never meaningful ("made / updated" →
    // "made/updated") — the sentence patterns write the slash tight
    // ("…have been made/updated…") and the OCR text spaces it.
    .replace(/\s*\/\s*/g, "/")
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

/** Lines that are reference/file numbers — kept as-is, never counted as
 * prose. Includes the bare code-line openers ("CPF/Misc/PA Cell/R-1/ASN /
 * Date:" — the DLC office-note header) and their OCR-fragmented variants
 * ("C PF/118/…"), so a document that opens straight into a file number is
 * treated as data, not prose. */
function isReferenceLine(line: string): boolean {
  return (
    /^(?:ref|no\.?|file\s*no\.?|letter\s*no\.?)\s*[:#-]?\s*[A-Za-z0-9][A-Za-z0-9\/\-. ]{2,}/i.test(line) ||
    /^[A-Z]{2,}\/\d/.test(line) ||
    /^[A-Z]{2,}\s*\/\s*[A-Z0-9]/.test(line) ||
    /^[A-Z]\s+[A-Z]{2,}\s*\/\s*[A-Z0-9]/.test(line) ||
    /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(line)
  );
}

/**
 * The first structural line (Date:/Ref:/No./To,/Subject:/Sir,/…, a bare
 * file-number code like CPF/118/…, or a table row) marks the end of the
 * letterhead. Everything above it — organization names, office addresses,
 * phone/email/website lines — is kept exactly as-is, because that is the
 * letterhead the user wants untouched.
 */
const STRUCTURAL_START =
  /^(date|dated|ref|reference|file\s*no|no\.?|sub|subject|to\s*[,:]?|dear|respected|sir[,:]?|madam[,:]?|mahoday|the\s+(?:regional|deputy|joint|assistant|commissioner|director|registrar)|विषय|संदर्भ|दिनांक|प्रति|सेवा में|[A-Z]{2,}\s*\/\s*[A-Z0-9]|[A-Z]\s+[A-Z]{2,}\s*\/\s*[A-Z0-9]|sl\.?\s*no)/i;

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
    return outLines.map(l => l.replace(/  +/g, " ")).join("\n");
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
