// ODA client-side analysis: script detection, language inference, document
// type classification and entity extraction. Runs entirely in the browser so
// ingestion feels instant.

export interface ScriptInfo {
  script: string;
  language: string;
  direction: "ltr" | "rtl";
}

const SCRIPTS: Array<{ script: string; language: string; re: RegExp; direction: "ltr" | "rtl" }> = [
  { script: "Devanagari", language: "Hindi", re: /[\u0900-\u097F]/, direction: "ltr" },
  { script: "Bengali", language: "Bengali", re: /[\u0980-\u09FF]/, direction: "ltr" },
  { script: "Gurmukhi", language: "Punjabi", re: /[\u0A00-\u0A7F]/, direction: "ltr" },
  { script: "Gujarati", language: "Gujarati", re: /[\u0A80-\u0AFF]/, direction: "ltr" },
  { script: "Oriya", language: "Odia", re: /[\u0B00-\u0B7F]/, direction: "ltr" },
  { script: "Tamil", language: "Tamil", re: /[\u0B80-\u0BFF]/, direction: "ltr" },
  { script: "Telugu", language: "Telugu", re: /[\u0C00-\u0C7F]/, direction: "ltr" },
  { script: "Kannada", language: "Kannada", re: /[\u0C80-\u0CFF]/, direction: "ltr" },
  { script: "Malayalam", language: "Malayalam", re: /[\u0D00-\u0D7F]/, direction: "ltr" },
  { script: "Arabic", language: "Arabic", re: /[\u0600-\u06FF\u0750-\u077F]/, direction: "rtl" },
  { script: "Hebrew", language: "Hebrew", re: /[\u0590-\u05FF]/, direction: "rtl" },
  { script: "Cyrillic", language: "Russian", re: /[\u0400-\u04FF]/, direction: "ltr" },
  { script: "Greek", language: "Greek", re: /[\u0370-\u03FF]/, direction: "ltr" },
  { script: "Thai", language: "Thai", re: /[\u0E00-\u0E7F]/, direction: "ltr" },
  { script: "Han", language: "Chinese", re: /[\u4E00-\u9FFF\u3400-\u4DBF]/, direction: "ltr" },
  { script: "Kana", language: "Japanese", re: /[\u3040-\u30FF]/, direction: "ltr" },
  { script: "Hangul", language: "Korean", re: /[\uAC00-\uD7AF]/, direction: "ltr" },
];

/** Detect the dominant script of a text sample. Defaults to Latin/English. */
export function detectScript(text: string): ScriptInfo {
  const sample = text.slice(0, 4000);
  let best: ScriptInfo = { script: "Latin", language: "English", direction: "ltr" };
  let bestCount = 0;
  for (const s of SCRIPTS) {
    const matches = sample.match(s.re);
    const count = matches ? matches.length : 0;
    if (count > bestCount) {
      bestCount = count;
      best = { script: s.script, language: s.language, direction: s.direction };
    }
  }
  return best;
}

export type Formality = "Formal" | "Semi-formal" | "Informal";

const FORMAL_MARKERS = [
  "respected",
  "regards",
  "whereas",
  "hereby",
  "hereinafter",
  "submitted for",
  "kindly",
  "yours faithfully",
  "yours sincerely",
  "hon'ble",
  "honourable",
  "deemed",
  "undersigned",
  "perusal",
  "acknowledgement",
  "in accordance with",
  "duly",
  "aforesaid",
];
const INFORMAL_MARKERS = [
  "hey",
  "hi ",
  "thanks!",
  "cheers",
  "btw",
  "gonna",
  "wanna",
  "lmk",
  "u r",
  "lol",
  "pls",
  "thx",
];

export function detectFormality(text: string): Formality {
  const lower = text.toLowerCase();
  let formal = 0;
  let informal = 0;
  for (const m of FORMAL_MARKERS) if (lower.includes(m)) formal++;
  for (const m of INFORMAL_MARKERS) if (lower.includes(m)) informal++;
  if (informal > formal) return "Informal";
  if (formal >= 3 || lower.length > 600) return "Formal";
  return formal >= 1 ? "Semi-formal" : "Formal";
}

const TYPE_RULES: Array<{ type: string; keywords: string[] }> = [
  {
    type: "Complaint",
    keywords: [
      "complaint",
      "grievance",
      "dissatisfied",
      "unacceptable",
      "failed to",
      "negligence",
      "deficiency",
      "unhappy with",
      "inconvenience caused",
    ],
  },
  {
    type: "Legal Notice",
    keywords: [
      "legal notice",
      "advocate",
      "counsel",
      "hereby notified",
      "cause of action",
      "legal action",
      "compensation for",
      "statutory",
      "shall be liable",
    ],
  },
  {
    type: "Invoice / Statement",
    keywords: [
      "invoice",
      "statement of account",
      "amount due",
      "payment of",
      "outstanding",
      "bill no",
      "gst",
      "debit",
      "credit note",
      "receipt",
      "balance payable",
    ],
  },
  {
    type: "Transfer / Order",
    keywords: [
      "transfer",
      "relieving",
      "l.c.-out",
      "lc out",
      "joining report",
      "posting order",
      "appointment order",
      "promotion order",
      "deputation",
      "order of transfer",
    ],
  },
  {
    type: "Circular / Notification",
    keywords: [
      "circular",
      "notification",
      "office order",
      "in continuation",
      "all offices",
      "all departments",
      "guidelines",
      "government order",
      "general public",
      "hereby notified",
      "wide publicity",
    ],
  },
  {
    type: "Memo",
    keywords: ["memo", "memorandum", "reminder", "internal note", "minutes of"],
  },
  {
    type: "Request / Application",
    keywords: [
      "request",
      "application",
      "kindly",
      "please grant",
      "seeking",
      "submitted for",
      "approval",
      "permission",
      "sanction",
      "humble request",
      "dear sir/madam",
    ],
  },
  {
    type: "Report",
    keywords: [
      "report",
      "findings",
      "summary of",
      "submitted herewith",
      "enclosed",
      "analysis",
      "review of",
      "inspection",
    ],
  },
  {
    type: "Contract / Agreement",
    keywords: [
      "agreement",
      "contract",
      "terms and conditions",
      "party of the first part",
      "hereby agree",
      "clause",
      "witnesseth",
    ],
  },
];

const DOMAIN_RULES: Array<{ domain: string; keywords: string[] }> = [
  {
    domain: "Government",
    keywords: [
      "government",
      "office of the",
      "department of",
      "commissioner",
      "secretariat",
      "collector",
      "district magistrate",
      "tehsil",
      "municipal",
      "public works",
      "sarkar",
      "shasan",
      "notified",
      "gazette",
    ],
  },
  {
    domain: "Legal",
    keywords: [
      "advocate",
      "counsel",
      "legal notice",
      "court",
      "tribunal",
      "litigation",
      "judgment",
      "plaintiff",
      "defendant",
      "caveat",
      "affidavit",
      "clause",
      "hereby agree",
    ],
  },
  {
    domain: "Academic",
    keywords: [
      "university",
      "college",
      "faculty",
      "department of",
      "principal",
      "registrar",
      "admission",
      "scholarship",
      "thesis",
      "examination",
      "academic",
      "curriculum",
    ],
  },
  {
    domain: "Corporate",
    keywords: [
      "company",
      "ltd",
      "private limited",
      "corporation",
      "board of directors",
      "shareholder",
      "vendor",
      "procurement",
      "invoice",
      "purchase order",
      "supplier",
      "compliance",
    ],
  },
];

export function classifyDocument(text: string, name: string): {
  type: string;
  domain: string;
} {
  const haystack = `${name}\n${text}`.toLowerCase();
  for (const { type, keywords } of TYPE_RULES) {
    let hits = 0;
    for (const k of keywords) if (haystack.includes(k)) hits++;
    if (hits >= 2) return { type, domain: classifyDomain(haystack) };
  }
  return { type: "Letter", domain: classifyDomain(haystack) };
}

function classifyDomain(haystack: string): string {
  let best = "General";
  let bestHits = 0;
  for (const { domain, keywords } of DOMAIN_RULES) {
    let hits = 0;
    for (const k of keywords) if (haystack.includes(k)) hits++;
    if (hits > bestHits) {
      bestHits = hits;
      best = domain;
    }
  }
  return best;
}

export interface Entities {
  emails: string[];
  phones: string[];
  dates: string[];
  amounts: string[];
  references: string[];
  names: string[];
}

export function extractEntities(text: string): Entities {
  const emails = unique(text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []);
  const phones = unique(
    text.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s-]?\d{3}[\s-]?\d{3,4}/g) ?? [],
  ).filter((p) => p.replace(/\D/g, "").length >= 7);
  const dates = unique(
    text.match(
      /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}-\d{2}-\d{2}|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi,
    ) ?? [],
  );
  const amounts = unique(
    text.match(/(?:Rs\.?|₹|INR|USD|\$|€|£)\s?\d[\d,]*(?:\.\d{1,2})?/g) ?? [],
  );
  const references = unique(
    text.match(/(?:no\.?|ref\.?|reg\.?|file no\.?|letter no\.?)\s*[:#]?\s*[A-Za-z0-9][A-Za-z0-9\/\-\._ ]{2,30}/gi) ?? [],
  );
  const names = unique(
    text.match(/(?:Shri|Smt|Mr|Mrs|Ms|Dr|Er|Prof)\.?\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,2}/g) ?? [],
  );

  return {
    emails: emails.slice(0, 12),
    phones: phones.slice(0, 8),
    dates: dates.slice(0, 12),
    amounts: amounts.slice(0, 8),
    references: references.slice(0, 8),
    names: names.slice(0, 12),
  };
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}

/** Estimate a display language for the UI from script + hints. */
export function detectLanguage(text: string): string {
  return detectScript(text).language;
}
