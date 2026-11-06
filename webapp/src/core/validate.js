// SPDX-License-Identifier: Apache-2.0
// The rules of FDS section 6, as the Editor applies them: every finding with its Editor severity
// and its place (where). Pure: no DOM, no workers; runs in the library worker and in node --test.
//
// Implemented so far (implementationPlan M2): PKG (6.2), STR (6.3), MAN (6.4), SIG (6.5).
// To come: SNG (6.6, with chordpro.js), SET (6.7), VIEW (6.8). The conformance runner compares
// only the families listed in IMPLEMENTED and keeps the rest as to-dos.
//
// Readings where section 6 leaves room follow test-libraries/README.md (FDS O-11): a Fatal finding
// stops everything else; ignored system files are set aside before any other rule; the library
// folder is the top-level folder that holds manifest.json; a second .cho file is STR-06 only;
// MAN-07 and MAN-08 are their own findings, not also MAN-02; SIG-03 is not checked when
// author.publicKey already fails MAN-02.

import { readCentralDirectory, readEntry, ZipError } from './zip.js';
import { caseClashes, compareOrdinal, isIgnored, isSongId, nameProblem, pathTooLong } from './names.js';
import { readManifest, readSignature } from './manifest.js';
import { verifyAsync } from '../../vendor/noble-ed25519-3.2.0.js';

export const IMPLEMENTED = Object.freeze(['PKG', 'STR', 'MAN', 'SIG']);

const LIBRARY_TOP = new Set(['manifest.json', 'manifest.sig', 'zangbundel.json', 'LICENSE', 'setlists', 'songs']);

async function sha256hex(bytes) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate a library ZIP. Returns { findings, fatal } where findings are
 * { code, severity, where? }. Asynchronous because hashing and signature checks use the platform's
 * crypto.subtle.
 */
export async function validateLibrary(bytes, options = {}) {
  const verify = options.verify || verifyAsync;
  const findings = [];
  const add = (code, severity, where) => findings.push(where == null ? { code, severity } : { code, severity, where });
  const fatal = (e) => {
    if (e instanceof ZipError) {
      return { findings: [{ code: e.code, severity: 'Fatal', ...(e.where ? { where: e.where } : {}) }], fatal: true };
    }
    throw e;
  };

  // ---- PKG-01 to PKG-04 (Fatal): directory, limits, paths, encryption; then every entry's bytes
  let entries;
  const data = new Map();
  try {
    entries = readCentralDirectory(bytes);
    const seen = new Set();
    for (const e of entries) {
      if (seen.has(e.name)) {
        throw new ZipError('PKG-01', e.rawName, 'two entries with the same name');
      }
      seen.add(e.name);
      if (!e.dir) {
        data.set(e.name, readEntry(bytes, e));
      }
    }
  } catch (e) {
    return fatal(e);
  }

  // ---- PKG-08: ignored system files, set aside before any other rule
  const kept = entries.filter((e) => !isIgnored(e.name));
  if (kept.length < entries.length) {
    add('PKG-08', 'Info');
  }

  // All paths, with the folders they imply.
  const filePaths = kept.filter((e) => !e.dir).map((e) => e.name);
  const folders = new Set(kept.filter((e) => e.dir).map((e) => e.name.slice(0, -1)));
  for (const p of filePaths) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join('/'));
    }
  }
  const allNames = [...filePaths, ...folders];

  // ---- PKG-05: exactly one top-level folder; the library folder holds manifest.json
  const tops = [...new Set(allNames.map((p) => p.split('/')[0]))].sort(compareOrdinal);
  const topFolders = tops.filter((t) => folders.has(t));
  const lib = topFolders.find((t) => data.has(`${t}/manifest.json`)) ?? (topFolders.length ? topFolders[0] : null);
  for (const t of tops) {
    if (t !== lib) {
      add('PKG-05', 'Error', t);
    }
  }
  if (lib === null) {
    add('PKG-05', 'Error');
    return { findings, fatal: false };
  }

  // ---- PKG-06 (PF-20 to PF-22) and PKG-07 (PF-23), over every name in the ZIP
  const badNames = new Set();
  for (const p of allNames) {
    for (const seg of p.split('/')) {
      if (nameProblem(seg) && !badNames.has(seg)) {
        badNames.add(seg);
        add('PKG-06', 'Error', seg);
      }
    }
    if (pathTooLong(p) && !badNames.has(p)) {
      badNames.add(p);
      add('PKG-06', 'Error', p);
    }
  }
  const children = new Map();
  for (const p of allNames) {
    const i = p.lastIndexOf('/');
    const parent = i < 0 ? '' : p.slice(0, i);
    children.set(parent, [...(children.get(parent) || []), p.slice(i + 1)]);
  }
  for (const names of children.values()) {
    for (const group of caseClashes(names)) {
      add('PKG-07', 'Error', group.join(', '));
    }
  }

  // ---- the library folder, relative paths from here on
  const prefix = `${lib}/`;
  const rel = new Map();                              // relative path -> bytes, files only
  for (const [p, b] of data) {
    if (p.startsWith(prefix) && !isIgnored(p)) {
      rel.set(p.slice(prefix.length), b);
    }
  }
  const relFolders = new Set([...folders].filter((f) => f.startsWith(prefix)).map((f) => f.slice(prefix.length)));
  const childrenOf = (folder) => {
    const pre = folder ? `${folder}/` : '';
    const files = [...rel.keys()].filter((p) => p.startsWith(pre) && !p.slice(pre.length).includes('/')).map((p) => p.slice(pre.length));
    const dirs = [...relFolders].filter((p) => p.startsWith(pre) && p.length > pre.length && !p.slice(pre.length).includes('/')).map((p) => p.slice(pre.length));
    return { files: files.sort(compareOrdinal), dirs: dirs.sort(compareOrdinal) };
  };

  // ---- STR-01: only the manifest, its signature, the view and songs/ (PF-10)
  const top = childrenOf('');
  for (const name of [...top.files, ...top.dirs]) {
    const isDir = top.dirs.includes(name);
    const allowed = LIBRARY_TOP.has(name) && (isDir === (name === 'setlists' || name === 'songs'));
    if (!allowed) {
      add('STR-01', 'Error', name);
    }
  }

  // ---- songs/: song folders (STR-05 to STR-08, STR-10, STR-11), STR-02
  const songs = [];                                   // { id, path } of songs/<id>/<id>.cho
  const songsDir = childrenOf('songs');
  for (const f of songsDir.files) {
    add('STR-11', 'Error', `songs/${f}`);
  }
  for (const id of songsDir.dirs) {
    const where = `songs/${id}`;
    if (!isSongId(id)) {
      add('STR-10', 'Error', where);
    }
    const c = childrenOf(where);
    const own = `${id}.cho`;
    const chos = c.files.filter((f) => f.endsWith('.cho'));
    if (c.dirs.length) add('STR-07', 'Error', where);
    if (!c.files.includes(own)) add('STR-05', 'Error', where);
    if (chos.length > 1) add('STR-06', 'Error', where);      // a second .cho is STR-06 only (O-11)
    if (c.files.some((f) => !f.endsWith('.cho'))) add('STR-08', 'Error', where);
    if (c.files.includes(own)) {
      songs.push({ id, path: `${where}/${own}` });
    }
  }
  if (songsDir.dirs.length === 0) {
    add('STR-02', 'Warning');
  }

  // ---- MAN: the manifest
  const manBytes = rel.get('manifest.json');
  if (manBytes === undefined) {
    add('MAN-01', 'Info');                             // converted to a new library (EDT-25)
    return { findings, fatal: false, songs };
  }
  const man = readManifest(manBytes);
  if (man.findings.some((f) => f.code === 'MAN-03')) {
    return { findings: [{ code: 'MAN-03', severity: 'Fatal' }], fatal: true };
  }
  for (const f of man.findings) {
    add(f.code, f.severity);
  }
  const m = man.manifest;

  // MAN-04 to MAN-06 (MF-01, MF-02)
  if (m && Array.isArray(m.files)) {
    const listed = new Set();
    for (const f of m.files) {
      if (f === null || typeof f !== 'object' || typeof f.path !== 'string') continue;
      listed.add(f.path);
      const b = rel.get(f.path);
      if (b === undefined || f.path === 'manifest.json' || f.path === 'manifest.sig') {
        add('MAN-04', 'Error', f.path);
      } else if (b.length !== f.size || (await sha256hex(b)) !== f.sha256) {
        add('MAN-06', 'Error', f.path);
      }
    }
    for (const p of [...rel.keys()].sort(compareOrdinal)) {
      if (p !== 'manifest.json' && p !== 'manifest.sig' && !listed.has(p)) {
        add('MAN-05', 'Error', p);
      }
    }
  }

  // ---- SIG: signed when author.publicKey and manifest.sig are both present (SG-04)
  const hasKey = m !== null && m.author !== null && typeof m.author === 'object' && 'publicKey' in m.author;
  const sigBytes = rel.get('manifest.sig');
  if (hasKey !== (sigBytes !== undefined)) {
    add('SIG-01', 'Error', 'manifest.sig');
  } else if (hasKey) {
    const sig = readSignature(sigBytes);
    if (sig === null) {
      add('SIG-02', 'Error', 'manifest.sig');
    } else if (man.publicKey !== null) {               // a key that fails MAN-02 is not tried (O-11)
      let ok = false;
      try {
        ok = await verify(sig, manBytes, man.publicKey);
      } catch {
        ok = false;
      }
      if (!ok) {
        add('SIG-03', 'Error');
      }
    }
  }

  return { findings, fatal: false, songs, manifest: m };
}
