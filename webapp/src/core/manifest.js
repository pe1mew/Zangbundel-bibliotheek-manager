// SPDX-License-Identifier: Apache-2.0
// manifest.json and manifest.sig (FDS 4.1, 5.2; rules MAN-02, MAN-03, MAN-07, MAN-08, SIG-02).
// Pure functions. Lengths count Unicode code points, as the FDS's "characters".

import { compareOrdinal, isLanguageTag, isSongId } from './names.js';

export const FORMAT_VERSION = 1;
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const HEX64 = /^[0-9a-f]{64}$/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LICENSE_ID = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;
// A set name is a setlist title (FDS 4.1, song format 13.2): a directive value on one line, so no
// control characters, no braces, no spaces at either end (a directive value is trimmed of spaces and
// tabs, song format 5.3 v0.24; a tab is a control character here), NFC.
const SET_NAME_BAD = /[\u0000-\u001f\u007f-\u009f{}]|^ | $/;
// Tag labels (FDS 4.1, D-44; song format 12.11 v0.26): one line, NFC, no control characters.
const LABEL_BAD = /[\u0000-\u001f\u007f-\u009f]/;
export const TAGS_MAX = 200;
export const LABELS_MAX = 20;

const len = (s) => [...s].length;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => Number.isInteger(v);
const str = (v, min, max) => typeof v === 'string' && len(v) >= min && len(v) <= max;

/** FDS 4.1: one label of `tags` — its language key and its text. */
export function tagLabelOk(lang, label) {
  return isLanguageTag(lang) && str(label, 1, 60) && !LABEL_BAD.test(label) && label === label.normalize('NFC');
}

/** FDS 4.1: why a `tags` value breaks the rules, or null. */
export function tagsProblem(tags) {
  if (!isObject(tags)) return 'tags is not an object';
  const entries = Object.entries(tags);
  if (entries.length > TAGS_MAX) return `tags has more than ${TAGS_MAX} tags`;
  for (const [tag, labels] of entries) {
    if (!isSongId(tag)) return `tag ${JSON.stringify(tag)} is not in song ID syntax`;
    const list = isObject(labels) ? Object.entries(labels) : null;
    if (list === null || list.length < 1 || list.length > LABELS_MAX) return `tag ${tag} does not have 1–${LABELS_MAX} labels`;
    const bad = list.find(([lang, label]) => !tagLabelOk(lang, label));
    if (bad) return `label ${JSON.stringify(bad[0])} of tag ${tag} is not a language with a 1–60 character label on one line, NFC`;
  }
  return null;
}

/** Strict standard base64 with padding; the decoded bytes, or null. */
export function base64Bytes(s) {
  if (typeof s !== 'string' || s.length % 4 !== 0 || !BASE64.test(s)) {
    return null;
  }
  try {
    return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function validDate(s) {
  if (!UTC.test(s)) {
    return false;
  }
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().replace('.000Z', 'Z') === s;
}

/**
 * Read manifest.json as stored. Returns { manifest, publicKey, findings } where findings are
 * { code, severity } for MAN-02, MAN-03 (Fatal), MAN-07 and MAN-08; manifest is null when the
 * bytes are not a JSON object; publicKey is the raw 32 bytes when author.publicKey is valid.
 */
export function readManifest(bytes) {
  const findings = [];
  const problems = [];                                   // the reasons behind one MAN-02
  const out = { manifest: null, publicKey: null, findings, problems };
  const man02 = (why) => problems.push(why);

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    man02('starts with a byte order mark');
  }
  let m;
  try {
    m = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (e) {
    findings.push({ code: 'MAN-02', severity: 'Error' });
    problems.push(`not valid UTF-8 JSON: ${e.message}`);
    return out;
  }
  if (!isObject(m)) {
    findings.push({ code: 'MAN-02', severity: 'Error' });
    problems.push('not a JSON object');
    return out;
  }
  out.manifest = m;

  // MAN-03 first: a format this application does not know is not checked further.
  if (!isInt(m.formatVersion) || m.formatVersion < 1) {
    man02('formatVersion is not a positive integer');
  } else if (m.formatVersion !== FORMAT_VERSION) {
    findings.push({ code: 'MAN-03', severity: 'Fatal' });
    return out;
  }
  if (typeof m.libraryId !== 'string' || !UUID4.test(m.libraryId)) man02('libraryId is not a lowercase UUID version 4');
  if (!isInt(m.version) || m.version < 1) man02('version is not an integer ≥ 1');
  if (!str(m.title, 1, 80)) man02('title is not 1–80 characters');
  if ('description' in m && !str(m.description, 0, 1000)) man02('description is not a string of at most 1,000 characters');
  if (typeof m.created !== 'string' || !validDate(m.created)) man02('created is not YYYY-MM-DDThh:mm:ssZ');
  if (typeof m.modified !== 'string' || !validDate(m.modified)) man02('modified is not YYYY-MM-DDThh:mm:ssZ');
  if ('changes' in m && !str(m.changes, 0, 500)) man02('changes is not a string of at most 500 characters');

  // MAN-07: the licence is present (its own rule in the Editor, not also MAN-02; FDS O-11)
  const lic = m.license;
  if (!isObject(lic) || typeof lic.id !== 'string' || lic.id === '' || typeof lic.summary !== 'string' || lic.summary === '') {
    findings.push({ code: 'MAN-07', severity: 'Error' });
  } else {
    if (!LICENSE_ID.test(lic.id)) man02('license.id is not an SPDX identifier, proprietary or mixed');
    if (!str(lic.summary, 1, 200)) man02('license.summary is not 1–200 characters');
    if ('text' in lic && !str(lic.text, 0, 32000)) man02('license.text is not a string of at most 32,000 characters');
  }

  // MAN-08: a maintainer with a name and an e-mail address or an https: URL
  const mt = m.maintainer;
  const email = isObject(mt) && typeof mt.email === 'string' && EMAIL.test(mt.email);
  const url = isObject(mt) && typeof mt.url === 'string' && /^https:\/\/[^\s/]+/.test(mt.url);
  if (!isObject(mt) || !str(mt.name, 1, 100) || !(email || url)) {
    findings.push({ code: 'MAN-08', severity: 'Error' });
  }

  if (!Array.isArray(m.sets)) {
    man02('sets is not an array');
  } else {
    for (const s of m.sets) {
      if (!isObject(s) || !str(s.name, 1, 60) || !Array.isArray(s.songs) || !s.songs.every((x) => typeof x === 'string')) {
        man02('a set is not { name: 1–60 characters, songs: [song IDs] }');
        break;
      }
      if (SET_NAME_BAD.test(s.name) || s.name !== s.name.normalize('NFC')) {
        man02(`set name ${JSON.stringify(s.name)} cannot be a setlist title (line break, brace, outer space or not NFC)`);
        break;
      }
    }
  }

  if ('tags' in m) {
    const why = tagsProblem(m.tags);
    if (why) man02(why);
  }

  if ('author' in m) {
    const a = m.author;
    if (!isObject(a) || !str(a.name, 1, 100)) {
      man02('author.name is not 1–100 characters');
    }
    const key = isObject(a) && typeof a.publicKey === 'string' && a.publicKey.length === 44 ? base64Bytes(a.publicKey) : null;
    if (key === null || key.length !== 32) {
      man02('author.publicKey is not the base64 of a raw 32-byte Ed25519 key (SG-05)');
    } else {
      out.publicKey = key;
    }
  }

  if (!Array.isArray(m.files)) {
    man02('files is not an array');
  } else {
    let prev = null;
    for (const f of m.files) {
      if (!isObject(f) || typeof f.path !== 'string' || f.path === '' || !isInt(f.size) || f.size < 0
          || typeof f.sha256 !== 'string' || !HEX64.test(f.sha256)) {
        man02('a files entry is not { path, size, sha256 }');
        break;
      }
      if (f.path === 'manifest.json' || f.path === 'manifest.sig') {
        man02(`files lists ${f.path}`);
      }
      if (prev !== null && compareOrdinal(prev, f.path) >= 0) {
        man02('files is not sorted by path, or lists a path twice');
      }
      prev = f.path;
    }
  }

  if (problems.length) {
    findings.push({ code: 'MAN-02', severity: 'Error' });
  }
  return out;
}

/** Read manifest.sig (FDS 5.2): the 64-byte signature, or null when it breaks SIG-02. */
export function readSignature(bytes) {
  let s;
  try {
    s = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
  if (!isObject(s) || s.algorithm !== 'Ed25519') {
    return null;
  }
  const sig = base64Bytes(s.signature);
  return sig !== null && sig.length === 64 ? sig : null;
}
