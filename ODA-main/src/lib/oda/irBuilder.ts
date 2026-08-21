// src/lib/oda/irBuilder.ts
//
// Builds the shared Intermediate Representation (PRD §5) from an export
// payload, so the Track B precision engine and the Track A generic renderer
// consume the same structure. The CMPF field extractors (PRD §7.5) are
// targeted and safe: they only run on content the template matcher already
// accepted, and every missing field degrades to a logged Track A fallback in
// the exporter — never a hard failure.
//
// The engine's instant translator emits CMPF tables in two shapes:
//   • pipe rows   "1 | श्री तन्मय भट्टाचार्य | आरएनजे/21/1964 | …" (DOCX
//     sources parsed structurally), and
//   • flattened    one cell per line in row-major order, multi-line cells
//     spanning several lines (PDF/OCR and mammoth-fallback sources).
// Both are handled; headers are recognized from the known CMPF column set in
// Hindi or English.

import type { DocBlock, DocumentIR, TableBlock, TableRowData } from "./ir";

/** Normalize a header/cell for matching: lowercase, no separators. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[\s.।\-_:/()]/g, "");
}

/** Known CMPF member-table headers → canonical row-field keys. Short tokens
 * match exactly; long phrases may also match as substrings of a header line. */
const HEADER_KEYS: Array<[string, string]> = [
  ["क्रसं", "slNo"],
  ["slno", "slNo"],
  ["सदस्यकानाम", "name"],
  ["nameofthemember", "name"],
  ["सीएमपीएफखातासंख्या", "accountNo"],
  ["cmpfacno", "accountNo"],
  ["कोलियरीकानामजहाँसदस्यपूर्वमेंकार्यरतथा", "prevColliery"],
  ["nameofthecollierywherethememberhadearlierworkedin", "prevColliery"],
  // The L.C.-REQ table's variants of the same two columns.
  ["nameofthecollierywherethememberworkedinyourregionandperiodofworkdone", "prevColliery"],
  ["nameofthecollierywherethememberiscurrentlyworkinginthisregion", "currColliery"],
  // The posting-history table (SL. No | Place of Posting | From | To |
  // Regional office) — the posting column maps to prevColliery so the table
  // is recognized and its rows parse with the right column count.
  ["पदस्थापनकास्थान", "prevColliery"],
  ["placeofposting", "prevColliery"],
  ["कोलियरीकानामजहाँसदस्यवर्तमानमेंकार्यरतहै", "currColliery"],
  ["nameofthecollierywherethememberiscurrentlyworkingin", "currColliery"],
  ["एलसीसंख्या", "lcNo"],
  ["nooflc", "lcNo"],
];

function headerKey(cell: string): string | null {
  const n = norm(cell);
  for (const [pattern, key] of HEADER_KEYS) {
    if (n === pattern) return key;
    if (pattern.length > 6 && n.includes(pattern)) return key;
  }
  return null;
}

/** Canonical row-field order for the CMPF member table. */
const ROW_KEY_ORDER = ["slNo", "name", "accountNo", "prevColliery", "currColliery", "lcNo"] as const;

/** A line that starts a new top-level section (table region end). */
const TABLE_END_START =
  /^(कृपया|भवदीय|यह|सीएमपीएफ|महोदय|विषय|संदर्भ|दिनांक|सेवा में|प्रति|sd\/|हस्ताक्षर)/;

function isBlank(s: string): boolean {
  return s.trim().length === 0;
}

/**
 * Locate the CMPF member table inside translated content. Returns the header
 * index, the parsed rows (with cellsByKey), and the index one past the last
 * row line — or null when no recognizable table is present.
 */
function extractTable(
  lines: string[],
): { headerIndex: number; rows: TableRowData[]; endIndex: number } | null {
  // --- pipe-delimited table (DOCX structural sources) ---------------------
  const firstPipe = lines.findIndex((l) => l.includes("|"));
  if (firstPipe !== -1) {
    const headerCells = lines[firstPipe].split("|").map((c) => c.trim());
    const keys = headerCells.map((c) => headerKey(c) ?? "");
    const expected = keys.filter(Boolean).length;
    // Require at least 4 recognizable columns incl. a serial column. The lc
    // column is optional — the real Khadal Jena L.C.-out letter has a
    // 5-column table (no एल.सी. संख्या).
    if (expected >= 4 && keys.includes("slNo")) {
      const rows: TableRowData[] = [];
      let acc: string[] = [];
      let i = firstPipe + 1;
      for (; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t.includes("|")) {
          // A pipe line starts or continues a row. Multi-line cells (e.g. a
          // stinted colliery history) span several physical lines, so a row
          // is only complete once its pipe-split cell count reaches the
          // column count — continuation lines join the current row.
          acc.push(lines[i]);
          if (acc.join("\n").split("|").length >= expected) {
            rows.push(toRow(acc.join("\n"), keys));
            acc = [];
          }
        } else if (acc.length > 0 && !isBlank(t) && !TABLE_END_START.test(t)) {
          // continuation of the previous row's last cell
          acc.push(lines[i]);
        } else if (acc.length > 0) {
          // Blank line or section boundary with an unfinished row: keep it
          // only if it already carries every column, then stop at a boundary.
          if (acc.join("\n").split("|").length >= expected) {
            rows.push(toRow(acc.join("\n"), keys));
          }
          acc = [];
          if (TABLE_END_START.test(t)) break;
        }
      }
      if (acc.length > 0) {
        if (acc.join("\n").split("|").length >= expected) {
          rows.push(toRow(acc.join("\n"), keys));
        }
      }
      if (rows.length > 0) return { headerIndex: firstPipe, rows, endIndex: i };
    }
  }

  // --- flattened table (one cell per line, row-major) ----------------------
  for (let h = 0; h < lines.length; h++) {
    const first = headerKey(lines[h]);
    if (first !== "slNo") continue;
    const rest = lines.slice(h + 1, h + 6).map((l) => headerKey(l));
    // name/accountNo/prev/curr are required; the lcNo column is optional
    // (the real Jena letter's table has 5 columns, no एल.सी. संख्या).
    const required = ["name", "accountNo", "prevColliery", "currColliery"];
    const ok =
      required.every((k, idx) => rest[idx] === k) &&
      (rest[4] === "lcNo" || rest[4] == null);
    if (!ok) continue;

    const rows: TableRowData[] = [];
    let i = h + 5 + (rest[4] === "lcNo" ? 1 : 0);
    while (i < lines.length) {
      const slNo = lines[i].trim();
      if (!/^\d{1,3}$/.test(slNo)) break;
      const name = (lines[i + 1] ?? "").trim();
      const accountNo = (lines[i + 2] ?? "").trim();
      if (!name || !accountNo) break;
      // Scan for the bare-digit lcNo that closes a 6-column row; everything
      // between the account number and it is the (possibly multi-line)
      // previous colliery history, and the line right before it is the
      // current one. With no lcNo column (5-column rows), the row ends at the
      // next section boundary (कृपया/भवदीय/…) and the last line before it is
      // the current colliery.
      let j = i + 3;
      while (
        j < lines.length &&
        !/^\d{1,3}$/.test(lines[j].trim()) &&
        !TABLE_END_START.test(lines[j].trim())
      )
        j++;
      if (j >= lines.length) break;
      const atDigit = /^\d{1,3}$/.test(lines[j].trim());
      const lcNo = atDigit ? lines[j].trim() : "";
      const currColliery = lines[j - 1].trim();
      const prevColliery = lines
        .slice(i + 3, j - 1)
        .map((l) => l.trim())
        .filter(Boolean)
        .join("\n");
      rows.push(
        toRow(
          [slNo, name, accountNo, prevColliery, currColliery, lcNo].join("|"),
          ROW_KEY_ORDER as unknown as string[],
        ),
      );
      i = atDigit ? j + 1 : j;
    }
    if (rows.length > 0) return { headerIndex: h, rows, endIndex: i };
  }

  return null;
}

/** Build a TableRowData from a pipe-joined row string and column keys. */
function toRow(rowText: string, keys: string[]): TableRowData {
  const cells = rowText.split("|").map((c) => c.trim());
  const byKey: Record<string, string> = {};
  keys.forEach((key, idx) => {
    if (key) byKey[key] = cells[idx] ?? "";
  });
  // Missing canonical keys (e.g. lcNo on a 5-column table) default to "" so
  // the row contract stays total for the renderer's rowFieldMap.
  for (const k of ROW_KEY_ORDER) {
    if (byKey[k] === undefined) byKey[k] = "";
  }
  return { cells, cellsByKey: byKey };
}

const DATE_RE = /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/;

/**
 * Build the DocumentIR for an export payload. Field extraction is
 * CMPF-specific and deliberately strict: any hole (missing refCode, address
 * block, procedure line, signatory, table) is simply absent from `fields`,
 * which makes the precision engine throw and the exporter fall back to
 * Track A with a logged reason.
 */
export function buildDocumentIR(exp: {
  content: string;
  language: string;
  documentName: string;
}): DocumentIR {
  const content = exp.content.trim();
  const lines = content.split("\n");
  const fields: Record<string, string> = {};
  const blocks: DocBlock[] = [];

  // --- refCode + date ------------------------------------------------------
  const refLineIdx = lines.findIndex((l) => l.trim().startsWith("सीपीएफ/"));
  let refCode = "";
  let date = "";
  if (refLineIdx !== -1) {
    const refLine = lines[refLineIdx].trim();
    // Real letters write "दिनांक 24/04/2026" (space), "दिनांक:09-07-2026"
    // (colon) and "दिनांक-09/07/2026" (hyphen, mirroring the English source's
    // "Date-09/07/2026") — the separator is optional.
    const dm = refLine.match(/दिनांक\s*[:：-]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/);
    if (dm) date = dm[1];
    refCode = refLine
      .replace(/^सीपीएफ\//, "")
      .replace(/दिनांक\s*[:：-]?\s*\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}.*$/, "")
      .trim();
  }
  if (!date) {
    const dm = content.match(/दिनांक\s*[:：-]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/);
    if (dm) date = dm[1];
  }
  if (refCode) fields.refCode = refCode;
  if (date) fields.date = date;

  // --- structural anchors (line indices for document-order assembly) --------
  const metaIdx = lines.findIndex((l) => /^सीपीएफ\//.test(l.trim()));
  const sevaIdx = lines.findIndex((l) =>
    /^(सेवा में|प्रति|to\s+the\s+regional\s+commissioner)[.,:]?$/i.test(l.trim()),
  );
  const subjectIdx = lines.findIndex((l) => /^विषय\s*[:：-]+\s*\S/.test(l.trim()));
  const referenceIdx = lines.findIndex((l) => /^संदर्भ\s*[:：-]+\s*\S/.test(l.trim()));
  const mahodayIdx = lines.findIndex((l) => /^महोदय[.,:]?$/.test(l.trim()));
  const enclIdx = lines.findIndex((l) => /^संलग्न[\s:：-]/.test(l.trim()));

  // --- address block (सेवा में, … up to विषय/संदर्भ/महोदय) ------------------
  // Real CMPFO letters open the address either Hindi ("सेवा में,") or English
  // ("To The Regional Commissioner") — both start the same address block.
  let addressLines: string[] = [];
  if (sevaIdx !== -1) {
    // Hindi "सेवा में," is a pure label; English "To The Regional
    // Commissioner" is itself the designation line, so it leads the block.
    const sevaLine = lines[sevaIdx].trim();
    const addr: string[] = /^to\s+the\s+regional\s+commissioner[.,:]?$/i.test(sevaLine)
      ? [sevaLine.replace(/[.,:]$/, "").trim()]
      : [];
    let i = sevaIdx + 1;
    for (; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.length === 0 || /^(विषय|संदर्भ|महोदय)/.test(t)) break;
      addr.push(t);
    }
    // Trailing commas are preserved (not stripped): the DOCX renderer's
    // comma rule keeps a source comma it finds (the Bilaspur letter's
    // "Sreepat Road, Sub P.O. SECL,") and adds the reference comma to the
    // lines that need one.
    addressLines = addr.map((l) => l.trim()).filter(Boolean);
    if (addressLines.length >= 2) {
      const districtIdx = addressLines.findIndex((l) => /^(जिला|dist)[.\s:-]/i.test(l));
      let district = "";
      let state = "";
      if (districtIdx !== -1) {
        // English form "Dist:- Angul, State:- Odisha" carries its own state;
        // Hindi form "जिला. X" has the state on the following line.
        const dm = addressLines[districtIdx].match(
          /^(?:जिला|dist)[.\s:-]*([^,]+?)\s*,\s*state[.\s:-]+(.+)$/i,
        );
        if (dm) {
          district = dm[1].trim();
          state = dm[2].trim();
        } else {
          district = addressLines[districtIdx].replace(/^(जिला|dist)[.\s:-]*/i, "").trim();
          state = addressLines[districtIdx + 1] ?? addressLines[addressLines.length - 1] ?? "";
        }
      } else {
        state = addressLines[addressLines.length - 1] ?? "";
      }
      // The block keeps its source commas (renderer fidelity) but the
      // structured fields read clean: "सहायक आयुक्त," → "सहायक आयुक्त".
      const stripLine = (l: string) => l.replace(/[.,;:]$/, "").trim();
      fields.recipientDesignation = stripLine(addressLines[0]);
      fields.recipientOrg = stripLine(addressLines[1]);
      fields.recipientLine1 = stripLine(addressLines[2] ?? "");
      fields.recipientLine2 = stripLine(addressLines[3] ?? "");
      if (district) fields.recipientDistrict = district;
      if (state) fields.recipientState = state;
    }
  }

  // The address BLOCK leads with the Hindi opener (सेवा में, / प्रति) exactly
  // as the reference letters set it; the English "To The Regional
  // Commissioner" form is designation-led (the opener IS the designation).
  let addressBlockLines = addressLines;
  if (sevaIdx !== -1 && addressLines.length >= 2) {
    const opener = lines[sevaIdx].trim();
    if (/^(सेवा में|प्रति)[.,:]?$/i.test(opener)) {
      addressBlockLines = [opener.replace(/[.,:]$/, "").trim(), ...addressLines];
    }
  }

  // --- subject -------------------------------------------------------------
  let subjectText = "";
  if (subjectIdx !== -1) {
    const s = lines[subjectIdx].trim().replace(/^विषय\s*[:：-]+\s*/, "").replace(/[।\s]+$/, "").trim();
    if (s) {
      subjectText = s;
      fields.subject = s;
    }
  }

  // --- reference line ------------------------------------------------------
  let referenceLine = "";
  if (referenceIdx !== -1) {
    const r = lines[referenceIdx].trim().replace(/^संदर्भ\s*[:：-]+\s*/, "").trim();
    if (r) {
      referenceLine = r;
      fields.referenceLine = r;
    }
  }

  // --- procedure office order (body paragraph) -----------------------------
  // Hindi gold form: "सीएमपीएफ आयुक्त, धनबाद के प्रक्रिया कार्यालय आदेश संख्या-35
  // दिनांक-12.02.1975". Real letters also phrase it in English:
  // "Procedure Office Order No-35 Dated-12.02.1975 of CMPF Commissioner,
  // Dhanbad" — both populate the same three template fields.
  const proc = content.match(
    /सीएमपीएफ आयुक्त,\s*([^,।]+?)\s*के प्रक्रिया कार्यालय आदेश\s*संख्या\s*[-:：]?\s*([\w./-]+?)\s*दिनांक\s*[-:：]?\s*([\d./-]+)/,
  );
  if (proc) {
    fields.procedureOfficeLocation = proc[1].trim();
    fields.procedureOrderNo = proc[2].trim();
    fields.procedureOrderDate = proc[3].trim();
  } else {
    const procEn = content.match(
      /Procedure\s+Office\s+Order\s+No\s*[-:：]?\s*([\w./-]+?)\s+Dated\s*[-:：]?\s*([\d./-]+)[\s\S]{0,240}?of\s+CMPF\s+Commissioner,\s*([^.,\n]+)/i,
    );
    if (procEn) {
      fields.procedureOrderNo = procEn[1].trim();
      fields.procedureOrderDate = procEn[2].trim();
      fields.procedureOfficeLocation = procEn[3].trim();
    }
  }

  // --- signatory -----------------------------------------------------------
  // A parenthesized name that is really an org code ("(डब्ल्यूसीएल)", "(ECL)")
  // must never be taken for the signature — the L.C.-REQ tables split their
  // colliery cells and such codes can end up on their own line.
  function looksLikeOrgCode(inner: string): boolean {
    const t = inner.trim();
    return (
      /^[A-Z][A-Z.\s]{1,9}$/.test(t) ||
      /^(डब्ल्यूसीएल|ईसीएल|बीसीसीएल|एमसीएल|एसईसीएल|सीसीएल|सीएमपीएफ|आरएनजे|एनजीपी|बीकेआर|आरएमजी)$/.test(t)
    );
  }
  let signIdx = -1;
  let signInlineDesignation = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (/हस्ताक्षर|signature/i.test(t) || t.length >= 60) continue;
    // Bare "(Name)" — but skip org codes.
    const bare = t.match(/^\(([^()]+)\)$/);
    if (bare && !looksLikeOrgCode(bare[1])) {
      signIdx = i;
      break;
    }
    // "(Name)  Designation" on one baseline (the L.C.-REQ letters set it so).
    const inline = t.match(/^\(([^()]+)\)\s+([^()]{2,60})$/);
    if (inline && !looksLikeOrgCode(inline[1])) {
      signIdx = i;
      signInlineDesignation = inline[2];
      break;
    }
  }
  let signatoryName = "";
  let signatoryDesignation = "";
  if (signIdx !== -1) {
    signatoryName = lines[signIdx].trim().slice(1, -1).trim();
    const after = signInlineDesignation
      ? signInlineDesignation
      : lines
          .slice(signIdx + 1)
          .map((l) => l.trim())
          .find((l) => l.length > 0 && !/[।!?]$/.test(l) && l.length < 60) ?? "";
    if (signatoryName) {
      fields.signatoryName = signatoryName;
      // "Encl-  Regional Commissioner - I" — the source puts the bare Encl
      // marker and the designation on one line; the marker is not part of
      // the designation.
      signatoryDesignation = after.replace(
        /^(?:encl(?:osure)?|संलग्न)\s*[:：-]+\s*/i,
        "",
      );
      if (signatoryDesignation) fields.signatoryDesignation = signatoryDesignation;
    }
  }

  // --- member table --------------------------------------------------------
  const table = extractTable(lines);

  // --- assemble blocks in DOCUMENT ORDER ------------------------------------
  // The blocks feed both Track B's field placeholders and Track A's generic
  // renderer, which walks them top-to-bottom — a letter must read in source
  // order: file-no/date → सेवा में + address → विषय → संदर्भ → महोदय → body
  // paragraphs → table → कृपया → भवदीय + signature → संलग्न.
  const lineToBlock: Array<{ at: number; make: () => DocBlock }> = [];
  if (metaIdx !== -1) {
    lineToBlock.push({ at: metaIdx, make: () => ({ type: "meta-line", value: lines[metaIdx].trim() }) });
  }
  if (sevaIdx !== -1 && addressLines.length >= 2) {
    lineToBlock.push({
      at: sevaIdx,
      make: () => ({ type: "address-block", lines: addressBlockLines, align: "left" }),
    });
  }
  if (subjectText) {
    lineToBlock.push({ at: subjectIdx, make: () => ({ type: "subject-line", text: subjectText, bold: true }) });
  }
  if (referenceLine) {
    lineToBlock.push({ at: referenceIdx, make: () => ({ type: "reference-line", refCode: referenceLine }) });
  }
  if (mahodayIdx !== -1) {
    lineToBlock.push({ at: mahodayIdx, make: () => ({ type: "salutation", text: lines[mahodayIdx].trim() }) });
  }
  if (signIdx !== -1 && signatoryName) {
    lineToBlock.push({
      at: signIdx,
      make: () => ({ type: "signature-block", name: signatoryName, designation: signatoryDesignation, align: "right" }),
    });
  }
  if (table && table.rows.length > 0) {
    lineToBlock.push({
      at: table.headerIndex,
      make: () =>
        ({
          type: "table",
          headers: lines[table.headerIndex].split("|").map((c) => c.trim()).filter(Boolean),
          rows: table.rows,
        }) as TableBlock,
    });
  }
  if (enclIdx !== -1) {
    lineToBlock.push({ at: enclIdx, make: () => ({ type: "paragraph", runs: [{ text: lines[enclIdx].trim() }] }) });
  }
  lineToBlock.sort((a, b) => a.at - b.at);

  // Lines consumed by a block above (address lines, table rows, the sign-off
  // block, the file-no/date meta line) never also become body paragraphs.
  const consumed = new Set<number>();
  for (const piece of lineToBlock) {
    const at = piece.at;
    const b = piece.make();
    consumed.add(at);
    if (b.type === "address-block") {
      for (let i = sevaIdx + 1; i < lines.length && lines[i].trim().length > 0 && !/^(विषय|संदर्भ|महोदय)/.test(lines[i].trim()); i++) {
        consumed.add(i);
      }
    } else if (b.type === "table") {
      for (let i = at; i < table!.endIndex; i++) consumed.add(i);
    } else if (b.type === "signature-block") {
      // भवदीय, (the line right above the parenthesized name) and the
      // designation line under it belong to the closing block.
      if (at > 0 && /^भवदीय/.test(lines[at - 1].trim())) consumed.add(at - 1);
      let j = at + 1;
      while (j < lines.length && lines[j].trim().length > 0) {
        if (/^[\u0900-\u097F]+(?:\s*[-–]\s*[IVX\d]+)?$/.test(lines[j].trim())) {
          consumed.add(j);
          j++;
        } else break;
      }
    } else if (b.type === "meta-line") {
      // The merged file-number + दिनांक line (code left, date right) is one
      // content line, but a date on its OWN following line is also consumed.
      if (/^दिनांक[:：-]?\s*\d/.test(lines[at + 1]?.trim() ?? "")) consumed.add(at + 1);
    }
  }

  // --- body paragraphs (document order, minus consumed lines) ----------------
  // These are added to lineToBlock WITH their line index so they interleave
  // correctly with the structural blocks (a letter's body paragraph sits
  // between महोदय and भवदीय — never after the signature).
  let paraCount = 0;
  for (let i = 0; i < lines.length && paraCount < 12; i++) {
    const t = lines[i].trim();
    if (
      t.length === 0 ||
      consumed.has(i) ||
      t.includes("|") ||
      /^(सेवा में|प्रति|भवदीय|महोदय|क्र\.?\s*सं|sl\.?\s*no)/i.test(t) ||
      /^विषय\s*[:：-]/.test(t) ||
      /^संदर्भ\s*[:：-]/.test(t) ||
      /^संलग्न[\s:：-]/.test(t) ||
      /^सीपीएफ\//.test(t) ||
      /^दिनांक[:：-]?\s*\d/.test(t) ||
      /^\d{1,3}$/.test(t) ||
      /^\([^()]+\)$/.test(t)
    ) {
      continue;
    }
    // A bare designation tail under the signature (क्षेत्रीय आयुक्त - I on
    // its own line) is consumed via the signature walk above; a designation
    // that WASN'T consumed (e.g. no parenthesized name) still renders as a
    // closing line, not body prose.
    if (/^क्षेत्रीय आयुक्त/.test(t) && signIdx !== -1 && i > signIdx) continue;
    lineToBlock.push({ at: i, make: () => ({ type: "paragraph", runs: [{ text: t }] }) });
    paraCount++;
  }
  lineToBlock.sort((a, b) => a.at - b.at);
  for (const piece of lineToBlock) blocks.push(piece.make());

  // Detect the template family so the IR carries it (PRD §5: set only when
  // Track B applies — the exporter overrides it with the matched template).
  const raw = content;
  const isCmpf =
    raw.includes("कोयला खान भविष्य निधि संगठन") &&
    raw.includes("लेजर कार्ड का अंतर-क्षेत्रीय स्थानांतरण");

  return {
    sourceLanguage: "unknown",
    outputLanguage: exp.language,
    docType: isCmpf ? "cmpf-transfer-letter" : "letter",
    blocks,
    fields,
    rawText: content,
  };
}
