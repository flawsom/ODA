// ODA Adaptive Engine — improved composition (v2).
//
// v1 (adaptive.ts) assumed `Subject:` / `Ref:` with a colon and fell back to
// fragile heuristics, which produced garbage for real-world letters — e.g. the
// Indian government standard `Sub:-` / `Ref:-` was never parsed, so the subject
// became a random line, the reference regex captured "Reg**ion**" out of
// "Region-III", and the body was generic boilerplate that never quoted the
// actual subject.
//
// v2 fixes that: it parses hyphen-style labels, extracts the recipient from the
// "To," block, only accepts reference values that look like references, and
// makes every response quote THIS document's real subject — inline in the body
// for English, and via a localized subject-acknowledgment sentence for the
// other nine kit languages.
//
// v2.1 (this file) goes further — every document is unique, so every response
// must be too. It now:
//   - extracts the members named in the document's tables (with their account
//     numbers, e.g. ledger-card forwarding orders) and names them explicitly in
//     the response, localized per language;
//   - extracts the sender from the signature block and addresses the reply to
//     them (the person/office you reply to is whoever sent the document), with
//     the "To," block as fallback.
// No two documents therefore produce the same response: subject, reference,
// date, recipient, and — where present — members and accounts all come from the
// document itself.
//
// The kits themselves stay in adaptive.ts (shared with the server action);
// this module is the smarter composition on top of them.

import {
  kitFor,
  type AdaptiveDoc,
  type AdaptiveOptions,
  type AdaptiveResult,
} from "./adaptive";
import { localizeTableHeader } from "./translate";
import { normalizeFragmentedCodes } from "./recover";

// Document-type classification (frequency-weighted, ≥2 keyword hits) so a
// single incidental word like "receipt" in "Please acknowledge the receipt"
// never misroutes a letter to the Invoice template.
const TYPE_KEYWORDS: Array<{ type: string; keywords: string[] }> = [
  { type: "Complaint", keywords: ["complaint", "grievance", "dissatisfied", "unacceptable", "failed to", "negligence", "deficiency", "unhappy with"] },
  { type: "Legal Notice", keywords: ["legal notice", "advocate", "counsel", "hereby notified", "cause of action", "legal action", "suit", "compensation for", "statutory"] },
  { type: "Invoice / Statement", keywords: ["invoice", "statement of account", "amount due", "payment of", "outstanding", "bill no", "gst", "debit", "receipt"] },
  { type: "Transfer / Order", keywords: ["transfer", "relieving", "l.c.-out", "lc out", "joining report", "posting order", "appointment order", "promotion order", "deputation"] },
  { type: "Circular / Notification", keywords: ["circular", "notification", "office order", "in continuation", "all offices", "all departments", "guidelines", "instructions", "government order"] },
  { type: "Memo", keywords: ["memo", "memorandum", "reminder", "internal note", "minutes of"] },
  { type: "Request / Application", keywords: ["request", "application", "kindly", "please grant", "seeking", "submitted for", "approval", "permission", "sanction"] },
  { type: "Report", keywords: ["report", "findings", "summary of", "submitted herewith", "enclosed", "analysis", "review of"] },
  { type: "Contract / Agreement", keywords: ["agreement", "contract", "terms and conditions", "party of the first part", "hereby agree", "clause"] },
];

export function classifyType(text: string, name: string): string {
  const haystack = `${name}\n${text}`.toLowerCase();
  let best = "Letter";
  let bestHits = 0;
  for (const { type, keywords } of TYPE_KEYWORDS) {
    let hits = 0;
    for (const k of keywords) {
      let idx = 0;
      while ((idx = haystack.indexOf(k, idx)) !== -1) {
        hits++;
        idx += k.length;
      }
    }
    if (hits >= 2 && hits > bestHits) {
      best = type;
      bestHits = hits;
    }
  }
  return best;
}

/**
 * Opening sentence (per language) that quotes the document's actual subject
 * ("%s"). English needs none — its body templates already weave the subject in
 * ("…on the subject \"…\"").
 */
const ACK_SUBJECT: Record<string, string> = {
  Hindi: 'आपका पत्र, विषय "%s", प्राप्त हुआ है और उसकी पावती स्वीकार की जाती है।',
  Tamil: '"%s" என்ற தலைப்பில் உங்கள் கடிதம் பெறப்பட்டு ஒப்புக்கொள்ளப்படுகிறது.',
  Bengali: '"%s" বিষয়ে আপনার পত্র প্রাপ্ত হয়েছে এবং গৃহীত হয়েছে।',
  Telugu: '"%s" అనే విషయంపై మీ లేఖ అందినట్లు ధృవీకరిస్తున్నాము.',
  Kannada: '"%s" ವಿಷಯದ ಕುರಿತು ನಿಮ್ಮ ಪತ್ರವನ್ನು ಪಡೆದುಕೊಂಡಿದ್ದೇವೆ.',
  Gujarati: '"%s" વિષય પર તમારો પત્ર મળ્યો હોવાનું સ્વીકારીએ છીએ.',
  Marathi: '"%s" या विषयावरील तुमचे पत्र प्राप्त झाले असून त्याची पावती दिली जाते.',
  Spanish: 'Acusamos recibo de su comunicación con el asunto "%s".',
  French: 'Nous accusons réception de votre communication sur l\'objet "%s".',
  Arabic: 'نؤكد استلام خطابكم المتعلق بالموضوع "%s".',
};

/**
 * Document-specific details sentence — names the actual members (and their
 * account numbers) carried in the source document's table, so the response is
 * about THIS document, never a generic template. "%s" is the member list.
 */
const DETAILS_MEMBERS: Record<string, string> = {
  English:
    "The Ledger Cards of the under-mentioned members forwarded with the above letter have been received: %s. The postings have been noted and will be updated accordingly.",
  Hindi:
    "उपर्युक्त पत्र के साथ अग्रेषित निम्नलिखित सदस्यों के लेजर कार्ड प्राप्त हो गए हैं: %s। प्रविष्टियों का संज्ञान ले लिया गया है और तदनुसार अद्यतन किया जाएगा।",
  Tamil:
    "மேற்கண்ட கடிதத்துடன் அனுப்பப்பட்ட பின்வரும் உறுப்பினர்களின் லெட்ஜர் அட்டைகள் பெறப்பட்டுள்ளன: %s. பதிவுகள் கவனத்தில் கொள்ளப்பட்டு அதற்கேற்ப புதுப்பிக்கப்படும்.",
  Bengali:
    "উপরোক্ত পত্রের সাথে প্রেরিত নিম্নলিখিত সদস্যদের লেজার কার্ড প্রাপ্ত হয়েছে: %s। এন্ট্রিগুলি গৃহীত হয়েছে এবং তদনুযায়ী আপডেট করা হবে।",
  Telugu:
    "పై లేఖతో పంపిన క్రింది సభ్యుల లెడ్జర్ కార్డులు అందినాయి: %s. నమోదులు గమనించి తదనుగుణంగా నవీకరించబడతాయి.",
  Kannada:
    "ಮೇಲಿನ ಪತ್ರದೊಂದಿಗೆ ಕಳುಹಿಸಿದ ಕೆಳಗಿನ ಸದಸ್ಯರ ಲೆಡ್ಜರ್ ಕಾರ್ಡ್‌ಗಳು ಸ್ವೀಕೃತವಾಗಿವೆ: %s. ನಮೂದುಗಳನ್ನು ಗಮನಿಸಿ ಅದರಂತೆ ನವೀಕರಿಸಲಾಗುವುದು.",
  Gujarati:
    "ઉપરોક્ત પત્ર સાથે મોકલેલ નીચેના સભ્યોના લેજર કાર્ડ પ્રાપ્ત થયા છે: %s. નોંધણીઓ ધ્યાનમાં લેવામાં આવી છે અને તદનુસાર અપડેટ કરવામાં આવશે.",
  Marathi:
    "वरील पत्रासह पाठविलेल्या खालील सदस्यांचे लेजर कार्ड प्राप्त झाले आहेत: %s. नोंदी ग्राह्य धरून तदनुसार अद्यतनित केल्या जातील.",
  Spanish:
    "Se han recibido las tarjetas de contabilidad de los miembros que se mencionan a continuación, remitidas con la carta antes citada: %s. Se han tomado nota de los registros y se actualizarán en consecuencia.",
  French:
    "Les cartes de comptes des membres suivants, transmises avec la lettre susmentionnée, ont été reçues : %s. Les écritures ont été relevées et seront mises à jour en conséquence.",
  Arabic:
    "تم استلام بطاقات الحسابات الخاصة بالأعضاء التالية أسماؤهم، المرسلة مع الخطاب أعلاه: %s. وتم الاطلاع على القيود وسيتم تحديثها وفقاً لذلك.",
};

function firstLineMatching(lines: string[], re: RegExp): string | null {
  for (const line of lines) {
    const m = line.match(re);
    if (m) return line;
  }
  return null;
}

/** Subject from "Sub:- …" / "Sub: …" / "Subject: …" / "Regarding …" / "Re: …". */
function findSubject(lines: string[]): string | null {
  // Indian govt. standard: "Sub:-", "Sub:", "Subject:-", "Subject:" …
  // Ref lines never count as subjects — they belong to the reference slot.
  const sub = firstLineMatching(
    lines,
    /^(?:sub(?:ject)?|regarding|re)\s*[:#-]+\s*(.+)$/i,
  );
  if (sub) {
    return sub.replace(/^(?:sub(?:ject)?|regarding|re)\s*[:#-]+\s*/i, "").trim();
  }
  const candidate = lines.find(
    (l) =>
      l.length > 8 &&
      l.length < 90 &&
      !/[.!?]$/.test(l) &&
      !l.includes("|") && // table cells / extraction artifacts
      !/^[A-Z0-9]+\/\d/.test(l) && // file/ledger references, not subjects
      /^[A-Z0-9\u0900-\u097F\u0B80-\u0BFF\u0B00-\u0B7F]/.test(l),
  );
  return candidate ?? null;
}

/** Reference from "Ref:- …" / "Ref: …" / "Reference: …", else inline "No. …". */
function findReference(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^(?:ref|reference)\s*[:#-]+\s*(.+)$/i);
    if (m) {
      return m[1].trim().replace(/\s+dated\s+.*$/i, "").trim();
    }
  }
  // Inline fallback ("No. RNJ/31-1512/2026" …) — only accept values that look
  // like a real reference (digit or slash) so "Region" in "Region-III" can
  // never be captured as a reference.
  const m = text.match(
    /\b(?:ref\.?|reg\.?|no\.?)\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9\/\-. _]{2,40})/i,
  );
  return m && /[0-9\/]/.test(m[1]) ? m[0].trim() : null;
}

const MONTH_NAME =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const DATE_PATTERNS = new RegExp(
  `\\d{1,2}[-\\/]\\d{1,2}[-\\/]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\b(?:${MONTH_NAME})\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`,
  "i",
);

/** Date from "Date: …" / "dated …", so ref numbers are never mistaken for dates. */
function findDate(text: string): string | null {
  const labeled = text.match(
    new RegExp(`(?:date|dated)\\s*[:#]?\\s*(${DATE_PATTERNS.source})`, "i"),
  );
  if (labeled) return labeled[1];
  const month = text.match(
    new RegExp(`\\b(?:${MONTH_NAME})\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, "i"),
  );
  if (month) return month[0];
  const plain = text.match(DATE_PATTERNS);
  return plain ? plain[0] : null;
}

/** Recipient from the standard "To,\n<name>\n<designation>\n…" block. */
function findRecipient(lines: string[]): string {
  const toIdx = lines.findIndex((l) => /^to\s*[,:]?$/i.test(l));
  if (toIdx !== -1) {
    const block: string[] = [];
    for (const l of lines.slice(toIdx + 1)) {
      if (
        /^(sub|ref|date|subject|reference|dear|respected|sir|madam|mahoday)/i.test(l) ||
        block.length >= 4 ||
        l.includes("|")
      ) {
        break;
      }
      block.push(l);
    }
    if (block.length > 0) return block[0];
  }
  return (
    firstLineMatching(lines, /^(the|dr|mr|mrs|ms|shri|smt)\.?\s/i) ??
    "The Concerned Authority"
  );
}

interface Member {
  name: string;
  account: string | null;
}

/**
 * Members named in the document's tables (e.g. ledger-card forwarding orders):
 * parses pipe-delimited rows and pairs each honorific name with an
 * account-looking cell (RNJ/21/1964 …). Table-gated on purpose — a member list
 * is only quoted when the document actually carries a member table, so a plain
 * letter can never be polluted with a fabricated roster.
 */
function extractMembers(text: string): Member[] {
  const out: Member[] = [];
  const seen = new Set<string>();
  const nameRe =
    /^(?:shri|smt|dr|er|mr|mrs|ms|miss)\.?\s+[A-Za-z][A-Za-z.\s'-]{3,}$/i;
  const acctRe = /^[A-Z]{2,}\/?\d{2,}[A-Za-z0-9\/.-]*$/;

  for (const line of text.split(/\r?\n/)) {
    if (!line.includes("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 3) continue;
    const nameCell = cells.find(
      (c) =>
        nameRe.test(c) &&
        !/^(sl\.?\s*no|no\.?|name of|member|a\/?c(?:c)?\s*no|colliery)/i.test(c),
    );
    if (!nameCell) continue;
    const accountCell = cells.find(
      (c) => c !== nameCell && acctRe.test(c) && c.length < 40,
    );
    const key = nameCell.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ name: nameCell, account: accountCell ?? null });
      if (out.length >= 8) break;
    }
  }
  return out;
}

interface TableBlock {
  header: string[];
  rows: string[][];
}

/**
 * The document's own table (pipe-delimited rows), for PRD Rule #1: a response
 * to a document that carries a table mirrors that table — full columns, full
 * rows — with localized headers, instead of a prose summary.
 */
function extractTable(text: string): TableBlock | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.includes("|"));
  if (lines.length === 0) return null;
  const rows = lines.map((l) => l.split("|").map((c) => c.trim()));
  const headerish = (cells: string[]) =>
    cells.filter((c) =>
      /(sl\.?\s*no|name of|member|a\/?c(?:c)?\s*no|cmpf|colliery|\blc\b|account|no\.?\s*of)/i.test(c),
    ).length;
  let header = rows[0];
  let dataStart = 1;
  for (let i = 0; i < rows.length; i++) {
    if (headerish(rows[i]) >= 2) {
      header = rows[i];
      dataStart = i + 1;
      break;
    }
  }
  return { header, rows: rows.slice(dataStart) };
}

interface SenderInfo {
  name: string | null;
  designation: string | null;
}

/**
 * Sender from the signature block ("Yours faithfully,\nsd/-\n(Name)\nDesignation").
 * The reply goes back to whoever sent the document, so this is the response's
 * recipient — with the "To," block as fallback when there is no signature.
 */
function extractSender(text: string): SenderInfo | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const idx = lines.findIndex((l) =>
    /^(yours\s+(faithfully|sincerely|truly)|with\s+(kind\s+)?regards|regards|भवदीय|অনুগত|sd\/-)/i.test(l),
  );
  if (idx === -1) return null;

  let name: string | null = null;
  let designation: string | null = null;
  for (const l of lines.slice(idx + 1)) {
    if (/^sd\/-/i.test(l)) continue;
    const paren = l.match(/^\(([^)]+)\)$/);
    if (paren) {
      name = paren[1].trim();
      continue;
    }
    if (/^(encl|cc|copy|attach|email|e-mail|phone|ph\.?|mob|date|दिनांक|website|www\.)/i.test(l)) {
      break;
    }
    if (designation === null && l.length > 0 && l.length < 80) {
      designation = l;
    }
    break;
  }
  if (!name && !designation) return null;
  return { name, designation };
}

/** An office-style designation, e.g. "Regional Commissioner - I". */
const OFFICE_RE =
  /(registrar|commissioner|manager|director|officer|secretary|authority|superintendent|inspector|chairman|president|department|office|cell|section|division|board|corporation|organisation|organization|ministry|bank|chief|general manager|deputy|joint|assistant)/i;

/**
 * A reply is addressed to whoever sent the document: an office designation
 * becomes "The <designation>", a person falls back to their name, and a
 * document without a signature block falls back to its "To," block.
 */
function recipientFor(sender: SenderInfo | null, lines: string[]): string {
  if (sender?.designation && OFFICE_RE.test(sender.designation)) {
    const d = sender.designation.replace(/^the\s+/i, "").trim();
    return /^[a-z]/i.test(d) ? `The ${d}` : d;
  }
  if (sender?.name) return sender.name;
  return findRecipient(lines);
}

export function adaptiveGenerate(
  doc: AdaptiveDoc,
  opts: AdaptiveOptions,
): AdaptiveResult {
  // Run the same OCR-fragment recovery the translation path uses, so the
  // echoed ref/subject/recipient lines read clean ("CPF/ NAG/ 3 /", "d ated",
  // "06 / 11 /2025" → CPF/NAG/3/… dated 06/11/2025).
  const text = normalizeFragmentedCodes((doc.text ?? "").trim());
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const type = doc.type ?? classifyType(text, doc.name);
  const kit = kitFor(opts.language);
  const formal = opts.formality !== "Informal";
  const greet = kit.greet[formal ? 0 : 1];
  const close = kit.close[formal ? 0 : 1];
  const subject = findSubject(lines) ?? "your communication";
  const reference = findReference(text);
  const date = findDate(text);
  const sender = extractSender(text);
  const recipient = recipientFor(sender, lines);
  const members = extractMembers(text);
  const table = extractTable(text);
  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const bodyPair: string[] = [...(kit.body[type] ?? kit.body.Letter)];
  const quote =
    subject && subject !== "your communication" ? subject.replace(/\s*\.$/, "") : "";
  const body: string[] = [];
  if (quote) {
    if (bodyPair[0]?.includes("%s")) {
      // English-style kits weave the subject into the first template sentence.
      body.push(bodyPair[0].split("%s").join(quote));
      body.push(...bodyPair.slice(1));
    } else {
      // Other kits: lead with a localized subject-acknowledgment sentence.
      const ack = ACK_SUBJECT[opts.language];
      if (ack) body.push(ack.split("%s").join(quote));
      body.push(...bodyPair);
    }
  } else {
    // No quotable subject — drop the placeholder (and its lead-in phrase).
    body.push(
      ...bodyPair.map((p) =>
        p
          .replace(/\s+(?:regarding|concerning|on the subject|titled|on)\s+"%s"/g, "")
          .split("%s")
          .join("")
          .trim(),
      ),
    );
  }

  // Document-specific details — this document's own members and accounts are
  // named (localized frame, source-script names, exactly as a formal reply
  // would), so no two responses are ever the same.
  if (type === "Transfer / Order" && members.length > 0) {
    const memberList = members
      .map((m) => (m.account ? `${m.name} (${m.account})` : m.name))
      .join(", ");
    const details =
      (DETAILS_MEMBERS[opts.language] ?? DETAILS_MEMBERS.English).split("%s").join(memberList);
    body.splice(1, 0, details);
  }

  const out: string[] = [];
  out.push(`${kit.dateLabel} ${today}`);
  out.push("");
  out.push(kit.toLabel);
  out.push(recipient);
  out.push("");
  out.push(`${kit.subjectLabel} ${subject}`);
  if (reference) out.push(`${kit.refLabel} ${reference}`);
  if (date) out.push(`${kit.commDated} ${date}`);
  out.push("");
  out.push(greet);
  out.push("");
  out.push(...body);

  // PRD Rule #1: a source document with a table gets a table in the response
  // — headers localized to the response language, all rows kept intact.
  if (table && table.rows.length > 0) {
    const headCells = table.header.map((c) => localizeTableHeader(c, opts.language));
    out.push("");
    out.push(headCells.join(" | "));
    for (const row of table.rows) out.push(row.join(" | "));
  }

  out.push("");
  out.push(close);
  out.push("");
  out.push(kit.signatureLabel);
  out.push("");
  out.push(kit.footer);

  return {
    content: out.join("\n"),
    strategy: "adaptive",
  };
}
