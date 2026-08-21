// ODA legacy Word 97-2003 (.doc) parser — pure TypeScript, zero dependencies.
//
// Word 97-2003 .doc files are OLE2 Compound File Binary (CFB) containers. The
// document text lives in the "WordDocument" stream as a run of UTF-16LE (or
// 8-bit ANSI) text; a piece table (PlcPcd, inside the CLX in the "0Table" or
// "1Table" stream) maps logical character positions to byte offsets in that
// stream and records each piece's encoding. This module:
//
//   1. parses the OLE2 header/FAT/DIFAT/directory to read streams by name,
//   2. reads the FIB (File Information Block) from WordDocument to find
//      fcMin/fcMac and the CLX,
//   3. walks the piece table and decodes each piece (UTF-16LE or CP1252),
//      mapping paragraph marks (CR) to newlines.
//
// No dependencies, no server, free forever — the same guarantees as the rest
// of the ingestion pipeline. Files it cannot parse (or that are not OLE2)
// report `supported: false` so callers keep the honest "not readable" flag.

export interface DocParseResult {
  supported: boolean;
  text: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// OLE2 Compound File Binary reader
// ---------------------------------------------------------------------------

const CFB_SIG = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

function u16(view: DataView, off: number): number {
  return view.getUint16(off, true);
}
function u32(view: DataView, off: number): number {
  return view.getUint32(off, true);
}
function u64(view: DataView, off: number): bigint {
  return view.getBigUint64(off, true);
}

interface CfbFile {
  sectorSize: number;
  miniSectorSize: number;
  fat: Uint32Array;
  miniFat: Uint32Array;
  directory: Map<string, { start: number; size: number; isMini: boolean }>;
  miniStream: Uint8Array;
  bytes: Uint8Array;
  view: DataView;
}

/** Read one (possibly multi-sector) chain into a single byte array. */
function readChain(cfb: CfbFile, start: number, size: number, fat: Uint32Array, sectorSize: number): Uint8Array {
  const out = new Uint8Array(size);
  let sid = start;
  let written = 0;
  let guard = 0;
  while (sid !== ENDOFCHAIN && sid !== FREESECT && sid >= 0 && guard++ < 1_000_000) {
    const off = 512 + sid * sectorSize;
    const n = Math.min(sectorSize, size - written);
    out.set(cfb.bytes.subarray(off, off + n), written);
    written += n;
    sid = fat[sid];
  }
  return out.subarray(0, written);
}

function isEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function parseCfb(bytes: Uint8Array): CfbFile | null {
  if (bytes.length < 512 || !isEqualBytes(bytes.subarray(0, 8), CFB_SIG)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sectorShift = u16(view, 0x1e); // 0x1c is the byte-order marker (0xFFFE)
  const miniShift = u16(view, 0x20);
  const sectorSize = 1 << sectorShift;
  const miniSectorSize = 1 << miniShift;
  if (sectorSize < 512 || sectorSize > 4096 || miniSectorSize < 2) return null;
  const miniCutoff = u32(view, 0x38);
  const firstDirSector = u32(view, 0x30);
  const firstMiniFatSector = u32(view, 0x3c);
  const numMiniFatSectors = u32(view, 0x40);
  const firstDifatSector = u32(view, 0x44);
  const numDifatSectors = u32(view, 0x48);

  const sectorIds: number[] = [];
  for (let i = 0; i < 109; i++) {
    const s = u32(view, 0x4c + i * 4);
    if (s !== FREESECT) sectorIds.push(s);
  }
  // DIFAT chains for files with more than 109 FAT sectors.
  let difatSid = firstDifatSector;
  for (let d = 0; d < numDifatSectors && difatSid !== ENDOFCHAIN && difatSid !== FREESECT; d++) {
    const off = 512 + difatSid * sectorSize;
    const per = sectorSize / 4 - 1;
    for (let i = 0; i < per; i++) {
      const s = u32(view, off + i * 4);
      if (s !== FREESECT) sectorIds.push(s);
    }
    difatSid = u32(view, off + per * 4);
  }

  const numFatSectors = sectorIds.length;
  const fat = new Uint32Array(numFatSectors * (sectorSize / 4));
  for (let i = 0; i < sectorIds.length; i++) {
    const off = 512 + sectorIds[i] * sectorSize;
    for (let j = 0; j < sectorSize / 4; j++) {
      fat[i * (sectorSize / 4) + j] = u32(view, off + j * 4);
    }
  }

  // Directory stream (root entry chain).
  const dirChain = readChain(
    { ...({} as CfbFile), bytes, view } as CfbFile,
    firstDirSector,
    sectorSize * 32,
    fat,
    sectorSize,
  );
  const dirView = new DataView(dirChain.buffer, dirChain.byteOffset, dirChain.byteLength);

  const directory = new Map<string, { start: number; size: number; isMini: boolean }>();
  let rootStart = -1;
  let rootSize = 0;
  const nEntries = Math.floor(dirChain.length / 128);
  for (let i = 0; i < nEntries; i++) {
    const base = i * 128;
    const type = dirChain[base + 0x42];
    if (type !== 1 && type !== 2 && type !== 5) continue;
    const nameLen = u16(dirView, base + 0x40);
    if (nameLen < 2 || nameLen > 64) continue;
    let name = "";
    try {
      name = new TextDecoder("utf-16le").decode(dirChain.subarray(base, base + nameLen - 2));
    } catch {
      continue;
    }
    const start = u32(dirView, base + 0x74);
    const size = Number(u64(dirView, base + 0x78));
    if (type === 5) {
      rootStart = start;
      rootSize = size;
      continue;
    }
    if (type === 2) {
      directory.set(name, { start, size, isMini: size < miniCutoff });
    }
  }

  if (rootStart < 0) return null;
  const miniStream = readChain({ bytes, view } as CfbFile, rootStart, rootSize, fat, sectorSize);

  // Mini FAT.
  const miniFat = new Uint32Array(numMiniFatSectors * (sectorSize / 4));
  {
    let sid = firstMiniFatSector;
    for (let i = 0; i < numMiniFatSectors && sid !== ENDOFCHAIN && sid !== FREESECT; i++) {
      const off = 512 + sid * sectorSize;
      for (let j = 0; j < sectorSize / 4; j++) {
        miniFat[i * (sectorSize / 4) + j] = u32(view, off + j * 4);
      }
      sid = fat[sid];
    }
  }

  return { sectorSize, miniSectorSize, fat, miniFat, directory, miniStream, bytes, view };
}

/** Read a named stream from the CFB, following FAT (or mini-FAT) chains. */
function readStream(cfb: CfbFile, name: string): Uint8Array | null {
  const entry = cfb.directory.get(name);
  if (!entry) return null;
  if (entry.size === 0) return new Uint8Array(0);
  if (entry.isMini) {
    const out = new Uint8Array(entry.size);
    let sid = entry.start;
    let written = 0;
    let guard = 0;
    while (sid !== ENDOFCHAIN && sid !== FREESECT && sid >= 0 && guard++ < 1_000_000) {
      const off = sid * cfb.miniSectorSize;
      const n = Math.min(cfb.miniSectorSize, entry.size - written);
      out.set(cfb.miniStream.subarray(off, off + n), written);
      written += n;
      sid = cfb.miniFat[sid];
    }
    return out.subarray(0, written);
  }
  return readChain(cfb, entry.start, entry.size, cfb.fat, cfb.sectorSize);
}

// ---------------------------------------------------------------------------
// MS-DOC text extraction
// ---------------------------------------------------------------------------

/** CP1252 decoder — the ANSI codepage Word uses for 8-bit text pieces. */
const CP1252_HIGH: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};

function decodeCp1252(bytes: Uint8Array, start: number, end: number): string {
  let out = "";
  for (let i = start; i < end; i++) {
    const b = bytes[i];
    out += b >= 0x80 && CP1252_HIGH[b] ? String.fromCharCode(CP1252_HIGH[b]) : String.fromCharCode(b);
  }
  return out;
}

/** True when the file looks like a Word 97+ binary document (wIdent 0xA5EC). */
function looksLikeWordDoc(fib: Uint8Array): boolean {
  if (fib.length < 32) return false;
  const v = new DataView(fib.buffer, fib.byteOffset, fib.byteLength);
  return v.getUint16(0, true) === 0xa5ec;
}

/** Map CR (0x0D) / cell marks (0x07) / line breaks (0x0B) to newlines. */
function normalizeWordText(s: string): string {
  return s
    .replace(/[\r\x07\x0b]/g, "\n")
    .replace(/\f/g, "\n\n")
    .replace(/\u0000+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Main extraction
// ---------------------------------------------------------------------------

/**
 * Find and parse the PlcPcd (piece table) inside a CLX. Real-world Word
 * binary files (Word 6/95, 97, 2000-2003, and third-party writers) put the
 * piece table in a Pcdt (clxt = 0x02); Prc structures (clxt = 0x01, extra
 * formatting runs) may precede it and are skipped. Returns the PlcPcd bytes
 * (the (n+1) CPs + n PCDs) or null.
 */
function extractPlcPcd(clx: Uint8Array): Uint8Array | null {
  let i = 0;
  while (i + 5 <= clx.length) {
    const clxt = clx[i];
    if (clxt === 0x01) {
      // Prc: lcb (4) + cbGrpprl (2) + grpprl (lcb-2) — skip.
      const lcb = u32(new DataView(clx.buffer, clx.byteOffset + i + 1, 4), 0);
      i += 5 + lcb;
      continue;
    }
    if (clxt === 0x02) {
      // Pcdt: lcb (4) + PlcPcd (lcb bytes).
      const lcb = u32(new DataView(clx.buffer, clx.byteOffset + i + 1, 4), 0);
      if (lcb >= 4 && i + 5 + lcb <= clx.length) return clx.subarray(i + 5, i + 5 + lcb);
    }
    i++;
  }
  return null;
}

/**
 * Decode the main document text from a parsed piece table. The PlcPcd maps
 * logical character positions (CPs) to byte offsets in the WordDocument
 * stream; each piece is UTF-16LE (2 bytes/char) or 8-bit ANSI/CP1252
 * (1 byte/char) when the PCD's fc carries the 0x40000000 compression flag.
 * Returns text covering CPs [0, capChars).
 */
function decodePieces(
  plc: Uint8Array,
  wordDoc: Uint8Array,
  capChars: number,
): string {
  const plcView = new DataView(plc.buffer, plc.byteOffset, plc.byteLength);
  const nPieces = Math.max(0, Math.floor((plc.length - 4) / 12));
  if (nPieces === 0) return "";
  const cps: number[] = [];
  for (let k = 0; k <= nPieces; k++) cps.push(u32(plcView, k * 4));
  const cap = capChars > 0 ? capChars : cps[nPieces] ?? 0;

  let text = "";
  let emitted = 0;
  for (let k = 0; k < nPieces && emitted < cap; k++) {
    const startCp = cps[k];
    const endCp = Math.min(cps[k + 1], cap);
    const count = endCp - startCp;
    if (count <= 0) continue;
    const pcdOff = 4 * (nPieces + 1) + k * 8;
    const fcRaw = u32(plcView, pcdOff + 2);
    const compressed = (fcRaw & 0x40000000) !== 0;
    const fc = compressed ? (fcRaw & 0x3fffffff) / 2 : fcRaw;
    const startByte = Math.max(0, Math.min(fc, wordDoc.length));
    if (compressed) {
      // 8-bit ANSI (CP1252) — one byte per character.
      const endByte = Math.min(startByte + count, wordDoc.length);
      text += decodeCp1252(wordDoc, startByte, endByte);
      emitted += endByte - startByte;
    } else {
      // UTF-16LE — two bytes per character.
      const endByte = Math.min(startByte + count * 2, wordDoc.length);
      try {
        text += new TextDecoder("utf-16le").decode(wordDoc.subarray(startByte, endByte));
      } catch {
        /* keep whatever decoded so far */
      }
      emitted += Math.floor((endByte - startByte) / 2);
    }
  }
  return text;
}

/**
 * Extract the main document text from a Word 97-2003 binary .doc file.
 * Returns `supported: false` when the file is not a CFB Word document or the
 * piece table cannot be read.
 */
export function parseDoc(buf: ArrayBuffer): DocParseResult {
  try {
    const bytes = new Uint8Array(buf);
    const cfb = parseCfb(bytes);
    if (!cfb) {
      return { supported: false, text: "", note: "Not an OLE2 Compound File (Word 97-2003 binary) document." };
    }
    const wordDoc = readStream(cfb, "WordDocument");
    if (!wordDoc || !looksLikeWordDoc(wordDoc)) {
      return { supported: false, text: "", note: "WordDocument stream not found — not a Word binary document." };
    }
    const wv = new DataView(wordDoc.buffer, wordDoc.byteOffset, wordDoc.byteLength);
    const csw = u16(wv, 0x20);
    const fibRgWEnd = 0x22 + csw * 2;
    const cslw = u16(wv, fibRgWEnd);
    const fibRgLwEnd = fibRgWEnd + 2 + cslw * 4;
    const cbRgFcLcb = u16(wv, fibRgLwEnd);
    const fibRgFcLcb = fibRgLwEnd + 2;
    const dynamicBaseOk = fibRgFcLcb + cbRgFcLcb * 8 <= wordDoc.length;

    // The piece table lives in the CLX inside the table stream (0Table or
    // 1Table — Word 97+ writes 0Table; Word 6/95 and several third-party
    // writers use 1Table).
    const tableStream = readStream(cfb, "0Table") ?? readStream(cfb, "1Table");
    if (!tableStream) {
      return { supported: false, text: "", note: "Table stream (0Table/1Table) not found in the Word document." };
    }

    // fcClx / main-text length candidates. Word 97+ stores fcClx at the
    // dynamic FibRgFcLcb index 33 and ccpText at fibRgLw[6]; many real files
    // (Word 6/95 heritage and non-Microsoft writers — e.g. the CMPFO .doc
    // letters) place fcMin at FIB 0x18 and ccpText at 0x4C instead. Try the
    // dynamic layout first, then the fixed offsets, and keep whichever parse
    // yields a valid piece table with readable text.
    const attempts: Array<{ fcClx: number; lcbClx: number; capChars: number }> = [];
    if (dynamicBaseOk) {
      attempts.push({
        fcClx: u32(wv, fibRgFcLcb + 33 * 8),
        lcbClx: u32(wv, fibRgFcLcb + 33 * 8 + 4),
        capChars: u32(wv, 0x40 + 6 * 4), // fibRgLw[6] ccpText
      });
    }
    attempts.push({
      fcClx: u32(wv, 0x1a2),
      lcbClx: u32(wv, 0x1a6),
      capChars: u32(wv, 0x4c), // Word 6/95 / third-party layout
    });

    let best: string | null = null;
    for (const attempt of attempts) {
      const { fcClx, lcbClx, capChars } = attempt;
      if (fcClx >= tableStream.length || lcbClx === 0) continue;
      const clx = tableStream.subarray(fcClx, Math.min(fcClx + lcbClx, tableStream.length));
      const plc = extractPlcPcd(clx);
      if (!plc) continue;
      const raw = decodePieces(plc, wordDoc, capChars);
      const normalized = normalizeWordText(raw);
      if (normalized.length > (best?.length ?? 0)) best = normalized;
    }

    if (best === null) {
      return { supported: false, text: "", note: "Piece table (CLX) not found in the Word document." };
    }
    if (best.length === 0) {
      return { supported: false, text: "", note: "No readable text was found in the Word document." };
    }
    return {
      supported: true,
      text: best,
      note: "DOC · legacy Word 97-2003 binary (text layer only — no tables or letterhead images in this format)",
    };
  } catch {
    return { supported: false, text: "", note: "Extraction failed — the .doc file could not be parsed." };
  }
}
