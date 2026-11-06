// SPDX-License-Identifier: Apache-2.0
// A library as the Editor holds it in memory, and saving it (FDS 7.2, 7.3, 7.6, 7.8). Pure, apart
// from the platform's crypto.subtle (hashes) and crypto.randomUUID (new library IDs).
//
//   openLibrary(bytes)            → { findings, library | null, reason }
//   newLibrary({ title, … })      → library (EDT-10 to EDT-12)
//   copyLibrary(library, { now }) → library (EDT-71)
//   saveLibrary(library, { changed, now, changes, signer }) → { bytes | null, findings, refused, unchanged }
//
// The Editor never reads the view of a library it opens (PF-45): the model comes from the manifest
// and the song files. Saving builds the whole ZIP from the model and then runs the rules of section
// 6 on that output: an Error or Fatal finding refuses the save (EDT-50, M-63).

import { writeZip } from './zip.js';
import { validateLibrary } from './validate.js';
import { canonicalize } from './chordpro.js';
import { base64Bytes } from './manifest.js';
import { compareOrdinal, nameProblem } from './names.js';
import { viewFiles } from './view.js';

const KNOWN_FIELDS = new Set(['formatVersion', 'libraryId', 'version', 'title', 'description', 'created', 'modified',
  'changes', 'license', 'maintainer', 'author', 'sets', 'files']);
const enc = new TextEncoder();

/** The FDS 4.1 time format: UTC, whole seconds. */
export function isoSeconds(date) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function toBase64(bytes) {
  let s = '';
  for (const b of bytes) {
    s += String.fromCharCode(b);
  }
  return btoa(s);
}

async function sha256hex(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A name that complies with FDS 3.3 (PF-20 to PF-22), for the folder and the file name. */
export function safeName(text, maxLength = 100) {
  let s = [...String(text).normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-')].slice(0, maxLength).join('');
  s = s.replace(/[ .]+$/, '');
  if (s === '') {
    s = 'bibliotheek';
  }
  if (nameProblem(s)) {                                 // a reserved name such as AUX
    s = `${s}-bibliotheek`;
  }
  return s;
}

/** EDT-55: the top-level folder, named after the title. */
export function folderName(title) {
  return safeName(title);
}

/** EDT-54: <title>-v<version>.zbl, complying with FDS 3.3. */
export function fileName(title, version) {
  return `${safeName(`${title}-v${version}`, 96)}.zbl`;
}

/** Open a library ZIP (FDS 7.3). A Fatal finding, or no manifest (conversion, M2.7), gives no model. */
export async function openLibrary(bytes, options = {}) {
  const r = await validateLibrary(bytes, options);
  if (r.fatal) {
    return { findings: r.findings, library: null, reason: 'fatal' };
  }
  const m = r.manifest;
  if (m === null || m === undefined) {
    return { findings: r.findings, library: null, reason: r.files && !r.manifestBytes ? 'no-manifest' : 'manifest-unreadable' };
  }
  const songs = new Map();
  for (const { id, path } of r.songs) {
    const c = canonicalize(r.files.get(path));
    songs.set(id, c.bytesOk && !c.controlChars ? c.text : null);   // null: SNG-01, saving is refused
  }
  const extra = {};
  for (const [k, v] of Object.entries(m)) {
    if (!KNOWN_FIELDS.has(k)) {
      extra[k] = v;                                      // unknown fields are kept (FDS 4.1)
    }
  }
  const author = m.author && typeof m.author === 'object' && typeof m.author.publicKey === 'string'
    ? { name: m.author.name, publicKey: base64Bytes(m.author.publicKey) } : null;
  const library = {
    libraryId: m.libraryId,
    version: m.version,
    title: m.title,
    description: m.description,
    created: m.created,
    modified: m.modified,
    license: m.license && typeof m.license === 'object' ? { ...m.license } : null,
    maintainer: m.maintainer && typeof m.maintainer === 'object' ? { ...m.maintainer } : null,
    author,
    signed: Boolean(r.signed),
    sets: Array.isArray(m.sets) ? m.sets.filter((s) => s && Array.isArray(s.songs)).map((s) => ({ name: s.name, songs: [...s.songs] })) : [],
    songs,
    extra,
    isNew: false,
    opened: bytes,
  };
  return { findings: r.findings, library, reason: null };
}

/** EDT-10 to EDT-12: a new, unsigned library without songs or sets. */
export function newLibrary({ title, description, now = new Date(), libraryId = crypto.randomUUID() }) {
  return {
    libraryId, version: 1, title, description, created: isoSeconds(now), modified: isoSeconds(now),
    license: null, maintainer: null, author: null, signed: false, sets: [], songs: new Map(), extra: {},
    isNew: true, opened: null,
  };
}

/** EDT-71: a copy with a new libraryId, version 1, new dates, no author and no signature. */
export function copyLibrary(library, { now = new Date(), libraryId = crypto.randomUUID(), title } = {}) {
  return {
    ...library,
    libraryId,
    version: 1,
    title: title ?? `${library.title} (copy)`,
    created: isoSeconds(now),
    modified: isoSeconds(now),
    author: null,
    signed: false,
    sets: library.sets.map((s) => ({ name: s.name, songs: [...s.songs] })),
    songs: new Map(library.songs),
    extra: { ...library.extra },
    isNew: true,
    opened: null,
  };
}

const sameKey = (a, b) => a instanceof Uint8Array && b instanceof Uint8Array && a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Build the library ZIP from the model (EDT-52, EDT-53, EDT-55, EDT-57, EDT-58).
 * signer: { name, publicKey: Uint8Array(32), sign: async (bytes) => Uint8Array(64) }, needed for a
 * signed library (its own key, EDT-62, EDT-63) and to sign an unsigned one (EDT-60).
 */
export async function buildLibrary(library, { now = new Date(), changes, signer } = {}) {
  if (library.author && !signer) {
    throw new Error('a signed library is saved only with its key loaded (EDT-23, EDT-24)');
  }
  if (library.author && signer && !sameKey(signer.publicKey, library.author.publicKey)) {
    throw new Error('the loaded key is not the key of this library (EDT-62, EDT-63; M-30)');
  }
  const version = library.isNew ? 1 : library.version + 1;
  const modified = isoSeconds(now);
  const author = signer ? { name: library.author ? library.author.name : signer.name, publicKey: toBase64(signer.publicKey) } : null;

  const manifestLike = { libraryId: library.libraryId, title: library.title, description: library.description,
    license: library.license, maintainer: library.maintainer, sets: library.sets };
  const files = new Map(viewFiles(manifestLike).filter(([, b]) => b !== null));
  for (const [id, text] of library.songs) {
    files.set(`songs/${id}/${id}.cho`, text === null ? new Uint8Array(0) : enc.encode(text));
  }
  const paths = [...files.keys()].sort(compareOrdinal);
  const list = [];
  for (const path of paths) {
    const data = files.get(path);
    list.push({ path, size: data.length, sha256: await sha256hex(data) });
  }

  const m = { formatVersion: 1, libraryId: library.libraryId, version, title: library.title };
  if (library.description !== undefined && library.description !== '') m.description = library.description;
  m.created = library.created;
  m.modified = modified;
  if (changes) m.changes = changes;                      // EDT-58: one version only, never carried over
  m.license = library.license;
  m.maintainer = library.maintainer;
  if (author) m.author = author;
  m.sets = library.sets;
  Object.assign(m, library.extra);
  m.files = list;
  const manifestBytes = enc.encode(`${JSON.stringify(m, null, 2)}\n`);

  const folder = folderName(library.title);
  const zipFiles = [{ name: `${folder}/manifest.json`, data: manifestBytes }];
  if (signer) {
    const signature = await signer.sign(manifestBytes);   // over the exact bytes stored (SG-02)
    zipFiles.push({ name: `${folder}/manifest.sig`,
      data: enc.encode(`${JSON.stringify({ algorithm: 'Ed25519', signature: toBase64(signature) }, null, 2)}\n`) });
  }
  for (const path of paths) {
    zipFiles.push({ name: `${folder}/${path}`, data: files.get(path) });
  }
  return { bytes: writeZip(zipFiles, modified), version, modified, fileName: fileName(library.title, version) };
}

/**
 * Save (FDS 7.6): an unchanged opened library is saved as it was opened, signature included
 * (EDT-51); otherwise the ZIP is built and the rules of section 6 run on it. Any Error or Fatal
 * refuses the save (EDT-50).
 */
export async function saveLibrary(library, { changed = false, now, changes, signer, verify } = {}) {
  if (!changed && !library.isNew && library.opened) {
    const r = await validateLibrary(library.opened, { verify });
    return { bytes: library.opened, findings: r.findings, refused: false, unchanged: true,
      fileName: fileName(library.title, library.version), version: library.version };
  }
  const built = await buildLibrary(library, { now, changes, signer });
  const r = await validateLibrary(built.bytes, { verify });
  const refused = r.findings.some((f) => f.severity === 'Error' || f.severity === 'Fatal');
  return { bytes: refused ? null : built.bytes, findings: r.findings, refused, unchanged: false,
    fileName: built.fileName, version: built.version };
}
