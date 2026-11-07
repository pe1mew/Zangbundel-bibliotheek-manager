// SPDX-License-Identifier: Apache-2.0
// Reading a library ZIP as untrusted input (FDS 3.1, 3.5, 6.2; securityAssessment SR-31).
// The central directory is read and every limit checked before any entry is decompressed. Each local
// header must agree with its directory entry, and no two entries may share data. An entry is then
// inflated in small steps and stopped as soon as it passes its declared size, so a ZIP bomb costs
// neither memory nor time beyond the limits (implementationPlan M2.1, securityAssessment SR-31).
// Pure functions: no DOM, no workers; runs in the library worker and in node --test.

import { deflateSync, Inflate } from '../../vendor/fflate-0.8.3.js';

export const LIMITS = Object.freeze({
  zipSize: 64 * 1024 * 1024,          // FDS 3.5
  totalSize: 256 * 1024 * 1024,
  ratio: 20,                           // total uncompressed ≤ 20 × the ZIP file size (O-11 reading)
  entries: 10000,
});

/** A rule of FDS 6.2 that the ZIP breaks: code PKG-01 … PKG-04, all Fatal. */
export class ZipError extends Error {
  constructor(code, where, detail) {
    super(`${code}${where ? ` (${where})` : ''}: ${detail}`);
    this.code = code;
    this.where = where;
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 as ZIP uses it. */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Code page 437, bytes 0x80–0xFF: ZIP names without the UTF-8 flag (APPNOTE appendix D).
const CP437 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
const utf8 = new TextDecoder('utf-8', { fatal: true });

function decodeName(raw, utf8Flag) {
  if (utf8Flag) {
    try {
      return utf8.decode(raw);
    } catch {
      throw new ZipError('PKG-01', null, 'an entry name is not valid UTF-8');
    }
  }
  let s = '';
  for (const b of raw) {
    s += b < 0x80 ? String.fromCharCode(b) : CP437[b - 0x80];
  }
  return s;
}

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/**
 * Read the central directory and check PKG-01 to PKG-04 (all Fatal: the first problem found is
 * thrown as a ZipError). Returns the entries in central-directory order:
 * { name (NFC), rawName, dir, size, compressedSize, method, crc, flags, localOffset }.
 */
export function readCentralDirectory(bytes) {
  const n = bytes.length;
  if (n > LIMITS.zipSize) {
    throw new ZipError('PKG-02', null, `the ZIP is ${n} bytes, more than ${LIMITS.zipSize}`);
  }
  // End of central directory: the last 22 bytes, or up to 64 KiB earlier if there is a comment.
  let eocd = -1;
  for (let i = n - 22; i >= Math.max(0, n - 22 - 0xffff); i--) {
    if (u32(bytes, i) === 0x06054b50 && i + 22 + u16(bytes, i + 20) === n) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new ZipError('PKG-01', null, 'no end of central directory');
  }
  const count = u16(bytes, eocd + 10);
  const cdSize = u32(bytes, eocd + 12);
  const cdOffset = u32(bytes, eocd + 16);
  if (u16(bytes, eocd + 4) !== 0 || u16(bytes, eocd + 6) !== 0 || u16(bytes, eocd + 8) !== count) {
    throw new ZipError('PKG-01', null, 'a multi-disk ZIP');
  }
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new ZipError('PKG-01', null, 'a ZIP64 archive');      // never needed within the limits
  }
  if (count > LIMITS.entries) {
    throw new ZipError('PKG-02', null, `${count} entries, more than ${LIMITS.entries}`);
  }
  if (cdOffset + cdSize > eocd) {
    throw new ZipError('PKG-01', null, 'the central directory lies outside the file');
  }

  const entries = [];
  let total = 0;
  let p = cdOffset;
  for (let k = 0; k < count; k++) {
    if (p + 46 > eocd || u32(bytes, p) !== 0x02014b50) {
      throw new ZipError('PKG-01', null, 'a broken central directory');
    }
    const madeBy = u16(bytes, p + 4) >> 8;
    const flags = u16(bytes, p + 8);
    const method = u16(bytes, p + 10);
    const crc = u32(bytes, p + 16);
    const compressedSize = u32(bytes, p + 20);
    const size = u32(bytes, p + 24);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const external = u32(bytes, p + 38);
    const localOffset = u32(bytes, p + 42);
    if (p + 46 + nameLen + extraLen + commentLen > eocd) {
      throw new ZipError('PKG-01', null, 'a broken central directory');
    }
    const rawName = decodeName(bytes.subarray(p + 46, p + 46 + nameLen), (flags & 0x800) !== 0);
    p += 46 + nameLen + extraLen + commentLen;

    // PKG-03: absolute path, drive letter, '..' segment, backslash, symbolic link; also empty and '.'
    // segments ('a//b', './a'), which an unpacker resolves to another place than the name says
    const segments = (rawName.endsWith('/') ? rawName.slice(0, -1) : rawName).split('/');
    if (rawName.startsWith('/') || /^[A-Za-z]:/.test(rawName) || rawName.includes('\\') || segments.includes('..')
        || segments.some((x) => x === '' || x === '.')) {
      throw new ZipError('PKG-03', rawName, 'a path that leaves the library folder or hides its place');
    }
    if (madeBy === 3 && ((external >>> 16) & 0o170000) === 0o120000) {
      throw new ZipError('PKG-03', rawName, 'a symbolic link');
    }
    // PKG-04: the encryption flag (general-purpose bit 0)
    if (flags & 0x1) {
      throw new ZipError('PKG-04', rawName, 'an encrypted entry');
    }
    const dir = rawName.endsWith('/');
    if (!dir && method !== 0 && method !== 8) {
      throw new ZipError('PKG-01', rawName, `compression method ${method}`);
    }
    // The local header must agree with this entry: a streaming unpacker reads the local one.
    if (localOffset + 30 > cdOffset || u32(bytes, localOffset) !== 0x04034b50) {
      throw new ZipError('PKG-01', rawName, 'no local header where the directory says');
    }
    const lFlags = u16(bytes, localOffset + 6);
    const lNameLen = u16(bytes, localOffset + 26);
    const dataStart = localOffset + 30 + lNameLen + u16(bytes, localOffset + 28);
    if (u16(bytes, localOffset + 8) !== method || (lFlags & ~0x8) !== (flags & ~0x8) || lNameLen !== nameLen
        || !bytes.subarray(localOffset + 30, localOffset + 30 + nameLen).every((b, i) => b === bytes[p - nameLen - extraLen - commentLen + i])) {
      throw new ZipError('PKG-01', rawName, 'a local header that differs from the directory');
    }
    if (dataStart + compressedSize > cdOffset) {
      throw new ZipError('PKG-01', rawName, 'entry data beyond the start of the directory');
    }
    total += size;
    entries.push({ name: rawName.normalize('NFC'), rawName, dir, size, compressedSize, method, crc, flags, localOffset,
      dataStart });
  }
  // No two entries may share bytes: overlapping entries would count the same compressed data many
  // times while the size checks above saw it once.
  const ranges = entries.map((e) => [e.localOffset, e.dataStart + e.compressedSize, e.rawName]).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i][0] < ranges[i - 1][1]) {
      throw new ZipError('PKG-01', ranges[i][2], 'two entries that overlap');
    }
  }
  // PKG-02: total uncompressed size and ratio, from the directory, before any inflation
  if (total > LIMITS.totalSize) {
    throw new ZipError('PKG-02', null, `uncompressed ${total} bytes, more than ${LIMITS.totalSize}`);
  }
  if (total > LIMITS.ratio * n) {
    throw new ZipError('PKG-02', null, `uncompressed ${total} bytes, more than ${LIMITS.ratio} times the ZIP's ${n}`);
  }
  return entries;
}

const INFLATE_STEP = 4096;   // compressed bytes per step: at most about 4 MiB of output per step

/**
 * The bytes of one file entry. Inflation runs in steps of INFLATE_STEP compressed bytes and stops as
 * soon as the output passes the declared size, so a stream that claims few bytes but inflates to
 * many is refused after little work (SR-31). The CRC-32 is checked at the end.
 */
export function readEntry(bytes, entry) {
  const raw = bytes.subarray(entry.dataStart, entry.dataStart + entry.compressedSize);
  let data;
  if (entry.method === 0) {
    if (entry.compressedSize !== entry.size) {
      throw new ZipError('PKG-01', entry.rawName, 'a stored entry whose sizes differ');
    }
    data = raw.slice();
  } else {
    if (raw.length === 0) {
      throw new ZipError('PKG-01', entry.rawName, 'a deflated entry without data');
    }
    data = new Uint8Array(entry.size);
    let n = 0;
    const tooLarge = new ZipError('PKG-01', entry.rawName, 'data that inflates to more than its declared size');
    const inflater = new Inflate((chunk) => {
      if (n + chunk.length > data.length) {
        throw tooLarge;
      }
      data.set(chunk, n);
      n += chunk.length;
    });
    try {
      for (let i = 0; i < raw.length; i += INFLATE_STEP) {
        inflater.push(raw.subarray(i, i + INFLATE_STEP), i + INFLATE_STEP >= raw.length);
      }
    } catch (e) {
      throw e === tooLarge ? e : new ZipError('PKG-01', entry.rawName, 'data that does not inflate');
    }
    if (n !== entry.size) {
      throw new ZipError('PKG-01', entry.rawName, 'inflated size differs from the directory');
    }
  }
  if (crc32(data) !== entry.crc) {
    throw new ZipError('PKG-01', entry.rawName, 'CRC-32 mismatch');
  }
  return data;
}

/**
 * Write a ZIP deterministically (implementationPlan M2.1): the same files and date always give the
 * same bytes. Files are { name, data } with names already inside the one top-level folder; they
 * are written in the order given, deflated (level 6) unless that would not make them smaller,
 * with the UTF-8 flag, Unix mode 0644, no extra fields, and the DOS time of `date` (UTC).
 */
export function writeZip(files, date) {
  const d = date instanceof Date ? date : new Date(date);
  const dosTime = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2);
  const dosDate = ((Math.max(1980, d.getUTCFullYear()) - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const deflated = deflateSync(f.data, { level: 6 });
    const stored = deflated.length >= f.data.length;
    const body = stored ? f.data : deflated;
    const crc = crc32(f.data);
    const head = new Uint8Array(30 + name.length);
    const h = new DataView(head.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x800, true);
    h.setUint16(8, stored ? 0 : 8, true);
    h.setUint16(10, dosTime, true);
    h.setUint16(12, dosDate, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, body.length, true);
    h.setUint32(22, f.data.length, true);
    h.setUint16(26, name.length, true);
    head.set(name, 30);
    const cd = new Uint8Array(46 + name.length);
    const c = new DataView(cd.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, (3 << 8) | 20, true);               // made by Unix, ZIP 2.0
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(10, stored ? 0 : 8, true);
    c.setUint16(12, dosTime, true);
    c.setUint16(14, dosDate, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, body.length, true);
    c.setUint32(24, f.data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(38, (0o100644 << 16) >>> 0, true);
    c.setUint32(42, offset, true);
    cd.set(name, 46);
    parts.push(head, body);
    central.push(cd);
    offset += head.length + body.length;
  }
  const cdSize = central.reduce((n, x) => n + x.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true);
  e.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + 22);
  let p = 0;
  for (const x of [...parts, ...central, end]) {
    out.set(x, p);
    p += x.length;
  }
  return out;
}
