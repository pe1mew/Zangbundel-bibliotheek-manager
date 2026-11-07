// SPDX-License-Identifier: Apache-2.0
// Names in a library (FDS 3.3, 3.6, PF-14, PF-20 to PF-23). Pure functions.

const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]/;          // PF-20: C0 and C1 control characters too
const RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
const SONG_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

const LANGUAGE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{1,8})*$/;              // song format 6.2: BCP 47 well-formed

/** SNG-11 and the language keys of `tags` (FDS 4.1): a well-formed BCP 47 language tag. */
export function isLanguageTag(s) {
  return typeof s === 'string' && LANGUAGE.test(s);
}

/** PF-14: the song ID syntax of the ChordPro profile, at most 64 characters. */
export function isSongId(s) {
  return typeof s === 'string' && s.length <= 64 && SONG_ID.test(s);
}

/**
 * PF-20 to PF-22 for one name (a single path segment): a reason it breaks them, or null.
 * The full-path limit is checked separately (pathTooLong).
 */
export function nameProblem(name) {
  if (FORBIDDEN.test(name)) {
    return 'contains a forbidden character';
  }
  if (/[ .]$/.test(name)) {
    return 'ends with a space or a dot';
  }
  if (RESERVED.test(name)) {
    return 'is a reserved name';
  }
  if ([...name].length > 100) {
    return 'is longer than 100 characters';
  }
  return null;
}

/** PF-22: a full path of more than 255 characters. */
export function pathTooLong(path) {
  return [...path].length > 255;
}

/**
 * FDS 3.6: ignored system files. Matched case-sensitively, as the test libraries read it
 * (FDS O-11): `__MACOSX/` anywhere as the first segment, or the names above as the last segment.
 */
export function isIgnored(path) {
  const parts = path.replace(/\/$/, '').split('/');
  return parts[0] === '__MACOSX' || IGNORED_NAMES.has(parts[parts.length - 1]);
}

/** PF-23: groups of names in one folder that differ only in case, each sorted. */
export function caseClashes(names) {
  const groups = new Map();
  for (const n of new Set(names)) {
    const k = n.toLowerCase();
    groups.set(k, [...(groups.get(k) || []), n]);
  }
  return [...groups.values()].filter((g) => g.length > 1).map((g) => g.sort(compareOrdinal));
}

const enc = new TextEncoder();

/** Ordinal byte order of the UTF-8 encodings (FDS 4.1, files sorted by path). */
export function compareOrdinal(a, b) {
  const x = enc.encode(a);
  const y = enc.encode(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    if (x[i] !== y[i]) {
      return x[i] - y[i];
    }
  }
  return x.length - y.length;
}

/** EDT-54: <title>-v<version>.zbl, complying with FDS 3.3; also shown before saving (SR-36). */
export function libraryFileName(title, version) {
  return `${safeFileName(`${title}-v${version}`, 96)}.zbl`;
}

/** A name that complies with FDS 3.3 (PF-20 to PF-22), for the folder and the file name. */
export function safeFileName(text, maxLength = 100) {
  // forbidden and control characters become '-'; bidirectional controls, which can disguise a file
  // name's extension (SR-36), are removed
  let s = String(text).normalize('NFC').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '');
  s = [...s.replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]/g, '-')].slice(0, maxLength).join('');
  s = s.replace(/[ .]+$/, '');
  if (s === '') {
    s = 'bibliotheek';
  }
  if (nameProblem(s)) {                                 // a reserved name such as AUX
    s = `${s}-bibliotheek`;
  }
  return s;
}
