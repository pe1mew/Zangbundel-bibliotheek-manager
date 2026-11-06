// SPDX-License-Identifier: Apache-2.0
// Reading a library ZIP as untrusted input (FDS 3.1, 3.5, 6.2; securityAssessment SR-31).
// The central directory is read and every limit checked before any entry is decompressed; an entry
// is then inflated into a buffer of exactly its declared size and its CRC-32 checked, so a ZIP bomb
// cannot make it allocate more than the limits allow (implementationPlan M2.1).
// Pure functions: no DOM, no workers; runs in the library worker and in node --test.

import { inflateSync } from '../../vendor/fflate-0.8.3.js';

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

    // PKG-03: absolute path, drive letter, '..' segment, backslash, symbolic link
    const segments = rawName.split('/');
    if (rawName.startsWith('/') || /^[A-Za-z]:/.test(rawName) || rawName.includes('\\') || segments.includes('..')) {
      throw new ZipError('PKG-03', rawName, 'a path that leaves the library folder');
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
    if (localOffset + 30 > cdOffset) {
      throw new ZipError('PKG-01', rawName, 'a local header outside the file');
    }
    total += size;
    entries.push({ name: rawName.normalize('NFC'), rawName, dir, size, compressedSize, method, crc, flags, localOffset });
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

/** The bytes of one file entry, inflated into exactly its declared size and CRC-checked. */
export function readEntry(bytes, entry) {
  const p = entry.localOffset;
  if (u32(bytes, p) !== 0x04034b50) {
    throw new ZipError('PKG-01', entry.rawName, 'no local header');
  }
  if (u16(bytes, p + 6) & 0x1) {
    throw new ZipError('PKG-04', entry.rawName, 'an encrypted entry');
  }
  const start = p + 30 + u16(bytes, p + 26) + u16(bytes, p + 28);
  const end = start + entry.compressedSize;
  if (end > bytes.length) {
    throw new ZipError('PKG-01', entry.rawName, 'entry data beyond the end of the file');
  }
  const raw = bytes.subarray(start, end);
  let data;
  if (entry.method === 0) {
    if (entry.compressedSize !== entry.size) {
      throw new ZipError('PKG-01', entry.rawName, 'a stored entry whose sizes differ');
    }
    data = raw.slice();
  } else {
    const out = new Uint8Array(entry.size);
    try {
      data = inflateSync(raw, { out });   // never grows past entry.size (fflate keeps a given buffer)
    } catch {
      throw new ZipError('PKG-01', entry.rawName, 'data that does not inflate');
    }
    if (data.length !== entry.size) {
      throw new ZipError('PKG-01', entry.rawName, 'inflated size differs from the directory');
    }
  }
  if (crc32(data) !== entry.crc) {
    throw new ZipError('PKG-01', entry.rawName, 'CRC-32 mismatch');
  }
  return data;
}
