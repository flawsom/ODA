// Script → Font Typography Registry (fidelity PRD §4.4).
//
// Every non-Latin run in an exported DOCX must declare a script-appropriate
// font on all four rFonts axes (ascii/hAnsi/cs/eastAsia) plus w:lang, or Word
// silently falls back to the template default — which is never designed for
// Devanagari shaping (the "no font is ever declared" defect). Latin keeps
// Times New Roman, matching the reference CMPFO letters.
//
// Fonts are chosen per run by the Unicode block of the run's text, so a
// single line that mixes scripts ("CPF/118/…  दिनांक:09-07-2026") gives each
// fragment its own correct font.

export interface FontSpec {
  ascii: string;
  hAnsi: string;
  cs: string;
  eastAsia: string;
  /** BCP-47 language tag for w:lang (proofing language). */
  lang: string;
}

const LATIN: FontSpec = {
  ascii: "Times New Roman",
  hAnsi: "Times New Roman",
  cs: "Times New Roman",
  eastAsia: "Times New Roman",
  lang: "en-IN",
};

/** Script fonts shipped with Windows — the same families the CMPFO reference
 * letter declares (Mangal on every Devanagari run). */
const SCRIPT_FONTS: Array<{ name: string; ranges: Array<[number, number]>; font: FontSpec }> = [
  {
    name: "Devanagari",
    ranges: [[0x0900, 0x097f]],
    font: { ascii: "Mangal", hAnsi: "Mangal", cs: "Mangal", eastAsia: "Mangal", lang: "hi-IN" },
  },
  {
    name: "Bengali",
    ranges: [[0x0980, 0x09ff]],
    font: { ascii: "Vrinda", hAnsi: "Vrinda", cs: "Vrinda", eastAsia: "Vrinda", lang: "bn-IN" },
  },
  {
    name: "Gurmukhi",
    ranges: [[0x0a00, 0x0a7f]],
    font: { ascii: "Raavi", hAnsi: "Raavi", cs: "Raavi", eastAsia: "Raavi", lang: "pa-IN" },
  },
  {
    name: "Gujarati",
    ranges: [[0x0a80, 0x0aff]],
    font: { ascii: "Shruti", hAnsi: "Shruti", cs: "Shruti", eastAsia: "Shruti", lang: "gu-IN" },
  },
  {
    name: "Oriya",
    ranges: [[0x0b00, 0x0b7f]],
    font: { ascii: "Kalinga", hAnsi: "Kalinga", cs: "Kalinga", eastAsia: "Kalinga", lang: "or-IN" },
  },
  {
    name: "Tamil",
    ranges: [[0x0b80, 0x0bff]],
    font: { ascii: "Latha", hAnsi: "Latha", cs: "Latha", eastAsia: "Latha", lang: "ta-IN" },
  },
  {
    name: "Telugu",
    ranges: [[0x0c00, 0x0c7f]],
    font: { ascii: "Gautami", hAnsi: "Gautami", cs: "Gautami", eastAsia: "Gautami", lang: "te-IN" },
  },
  {
    name: "Kannada",
    ranges: [[0x0c80, 0x0cff]],
    font: { ascii: "Tunga", hAnsi: "Tunga", cs: "Tunga", eastAsia: "Tunga", lang: "kn-IN" },
  },
  {
    name: "Malayalam",
    ranges: [[0x0d00, 0x0d7f]],
    font: { ascii: "Karthika", hAnsi: "Karthika", cs: "Karthika", eastAsia: "Karthika", lang: "ml-IN" },
  },
  {
    name: "Arabic",
    ranges: [[0x0600, 0x06ff], [0x0750, 0x077f], [0x08a0, 0x08ff]],
    font: { ascii: "Traditional Arabic", hAnsi: "Traditional Arabic", cs: "Traditional Arabic", eastAsia: "Traditional Arabic", lang: "ar-SA" },
  },
  {
    name: "Hebrew",
    ranges: [[0x0590, 0x05ff]],
    font: { ascii: "Frank Ruehl", hAnsi: "Frank Ruehl", cs: "Frank Ruehl", eastAsia: "Frank Ruehl", lang: "he-IL" },
  },
  {
    name: "Cyrillic",
    ranges: [[0x0400, 0x04ff]],
    font: { ascii: "Times New Roman", hAnsi: "Times New Roman", cs: "Times New Roman", eastAsia: "Times New Roman", lang: "ru-RU" },
  },
  {
    name: "Greek",
    ranges: [[0x0370, 0x03ff]],
    font: { ascii: "Times New Roman", hAnsi: "Times New Roman", cs: "Times New Roman", eastAsia: "Times New Roman", lang: "el-GR" },
  },
  {
    name: "HiraganaKatakana",
    ranges: [[0x3040, 0x30ff]],
    font: { ascii: "MS Gothic", hAnsi: "MS Gothic", cs: "MS Gothic", eastAsia: "MS Gothic", lang: "ja-JP" },
  },
  {
    name: "Hangul",
    ranges: [[0xac00, 0xd7af]],
    font: { ascii: "Malgun Gothic", hAnsi: "Malgun Gothic", cs: "Malgun Gothic", eastAsia: "Malgun Gothic", lang: "ko-KR" },
  },
  {
    name: "CJK",
    ranges: [[0x4e00, 0x9fff], [0x3400, 0x4dbf]],
    font: { ascii: "SimSun", hAnsi: "SimSun", cs: "SimSun", eastAsia: "SimSun", lang: "zh-CN" },
  },
];

function scriptForChar(code: number): FontSpec | null {
  for (const s of SCRIPT_FONTS) {
    for (const [lo, hi] of s.ranges) {
      if (code >= lo && code <= hi) return s.font;
    }
  }
  return null;
}

/**
 * The dominant script font for a piece of text: the font of the first
 * non-Latin script char encountered (a line rarely mixes two Indic scripts),
 * else the Latin default. CJK falls back to Japanese/Korean only when those
 * scripts are actually present — checked per char below.
 */
export function fontSpecForText(text: string): FontSpec {
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i) ?? 0;
    const spec = scriptForChar(code);
    if (spec) {
      // Japanese kana outranks shared CJK ideographs; Hangul is unambiguous.
      if (spec === SCRIPT_FONTS[13].font && (code >= 0x3040 && code <= 0x30ff)) return spec;
      if (spec === SCRIPT_FONTS[14].font && code >= 0xac00) return spec;
      return spec;
    }
    if (code > 0xffff) i++; // surrogate pair already consumed by codePointAt
  }
  return LATIN;
}

/** True when the text needs a non-Latin font (any script char present). */
export function hasNonLatin(text: string): boolean {
  return fontSpecForText(text) !== LATIN;
}
