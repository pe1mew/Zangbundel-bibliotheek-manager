// SPDX-License-Identifier: Apache-2.0
// Opening a ZIP that has no manifest.json as a new library (FDS EDT-21, EDT-25, EDT-26; plan M2.7):
//   - a release archive (zangbundel-archive.json) or a repository snapshot (zangbundel.json): the
//     songs keep their IDs; title, description, licence and maintainer come from zangbundel.json;
//     setlists whose entries are songs of this library become sets (EDT-26);
//   - any other ZIP of folders and song files: every .cho file becomes a song; the folder two levels
//     above a .cho file, inside the library folder, becomes a set (EDT-25).
// Song IDs are proposed from the title (EDT-36) and written into the song as {meta: id}. Files that
// are not songs are left out and named (M-42). The caller validates the result (FDS 6, EDT-25).
// Called only after validateLibrary found no Fatal rule (PKG-01 to PKG-04): the bytes are safe to read.

import { readCentralDirectory, readEntry } from './zip.js';
import { canonicalize, parseSong, trimBlank } from './chordpro.js';
import { compareOrdinal, isIgnored, isSongId } from './names.js';
import { LABELS_MAX, TAGS_MAX, tagLabelOk } from './manifest.js';

const dec = new TextDecoder('utf-8', { fatal: true });
const SONG_MAX = 64 * 1024;
const isoSeconds = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z');   // FDS 4.1 (as library.js)

/** EDT-36, song format 3.2: lower case, accents removed, other characters to hyphens, at most 64. */
export function proposeSongId(text) {
  let id = String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (id.length > 64) {
    id = id.slice(0, 64).replace(/-+$/, '');
  }
  return id || 'lied';
}

/** A song ID that is not taken yet: id, id-2, id-3, … (PF-14: still at most 64 characters). */
function unique(id, taken) {
  if (!taken.has(id)) return id;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${id.slice(0, 64 - suffix.length).replace(/-+$/, '')}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Write {meta: id <id>} into the song: replace the one that is there, or add it after the title. */
export function withSongId(text, id) {
  const lines = text.replace(/\n$/, '').split('\n');
  const meta = lines.findIndex((l) => /^[ \t]*\{[ \t]*meta[ \t]*:[ \t]*id([ \t].*)?\}[ \t]*$/i.test(l));
  if (meta >= 0) {
    lines[meta] = `{meta: id ${id}}`;
  } else {
    const title = lines.findIndex((l) => /^[ \t]*\{[ \t]*(title|t)[ \t]*[:}]/i.test(l));
    lines.splice(title + 1, 0, `{meta: id ${id}}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * EDT-26, FDS 4.1 (D-44): the tag labels of zangbundel.json (song format 4.2), keeping what the manifest
 * allows. Returns { tags: object | null, leftOut: ['<tag>' | '<tag>.<lang>'] }.
 */
function readTags(value) {
  const leftOut = [];
  if (value === undefined) return { tags: null, leftOut };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { tags: null, leftOut: ['tags'] };
  const tags = {};
  let count = 0;
  for (const [tag, labels] of Object.entries(value)) {
    if (!isSongId(tag) || labels === null || typeof labels !== 'object' || Array.isArray(labels) || count >= TAGS_MAX) {
      leftOut.push(tag);
      continue;
    }
    const kept = [];
    for (const [lang, label] of Object.entries(labels)) {
      if (tagLabelOk(lang, label) && kept.length < LABELS_MAX) kept.push([lang, label]);
      else leftOut.push(`${tag}.${lang}`);
    }
    if (kept.length === 0) {
      leftOut.push(tag);
      continue;
    }
    Object.defineProperty(tags, tag, { value: Object.fromEntries(kept), enumerable: true, writable: true, configurable: true });
    count++;
  }
  return { tags: count ? tags : null, leftOut };
}

/** Song format 13: a setlist's title and its entries ({ library, song } or { unresolved }); lines are
 *  read as songs are (5.2): trimmed of spaces and tabs only (v0.24). */
function readSetlist(text) {
  let title = null;
  const entries = [];
  for (const raw of text.split('\n')) {
    const line = trimBlank(raw);
    if (line === '' || line.startsWith('#')) continue;
    const t = /^\{[ \t]*title[ \t]*:(.*)\}$/i.exec(line);
    if (t) {
      title = trimBlank(t[1]);
      continue;
    }
    if (line.startsWith('{')) continue;                 // other directives are ignored (13.2)
    if (line.startsWith('? ')) {
      entries.push({ unresolved: trimBlank(line.slice(2)) });
      continue;
    }
    const ref = trimBlank(line.split(/[ \t]+#/)[0]);
    const slash = ref.indexOf('/');
    entries.push(slash > 0 ? { library: ref.slice(0, slash), song: ref.slice(slash + 1) } : { unresolved: ref });
  }
  return { title, entries };
}

/**
 * Convert the bytes of a ZIP without manifest into a new, unsigned library. Returns
 * { library, report } where report = { kind, songs, sets, leftOut: [paths], duplicates: [paths],
 * unresolved: [{ set, entry }], tagsLeftOut: [tag or tag.lang] } for messages M-41 and M-42.
 */
export function convertZip(bytes, { now = new Date(), libraryId = crypto.randomUUID(), title } = {}) {
  const entries = readCentralDirectory(bytes).filter((e) => !e.dir && !isIgnored(e.name));
  const tops = new Set(entries.map((e) => e.name.split('/')[0]));
  const nested = entries.every((e) => e.name.includes('/'));
  // EDT-25: without a single top-level folder, the root of the ZIP is the library folder.
  const root = tops.size === 1 && nested ? `${[...tops][0]}/` : '';
  const files = new Map();
  for (const e of entries) {
    if (e.name.startsWith(root)) files.set(e.name.slice(root.length), e);
  }
  const read = (path) => readEntry(bytes, files.get(path));
  const readText = (path) => {
    try {
      return dec.decode(read(path));
    } catch {
      return null;
    }
  };

  const archive = files.has('zangbundel-archive.json');
  const meta = files.has('zangbundel.json') ? (() => {
    try {
      return JSON.parse(readText('zangbundel.json'));
    } catch {
      return null;
    }
  })() : null;
  const kind = archive ? 'release-archive' : meta ? 'snapshot' : 'files';
  const fromRepo = kind !== 'files';

  // ---- songs: songs/**/*.cho in an archive or snapshot (song format 3.1), every .cho otherwise
  const choPaths = [...files.keys()].filter((p) => p.endsWith('.cho') && (!fromRepo || p.startsWith('songs/'))).sort(compareOrdinal);
  const songs = new Map();
  const rawSongs = new Map();
  const byText = new Map();                              // canonical text -> id: identical songs are stored once
  const duplicates = [];
  const setMembers = new Map();                          // set folder -> [{ folder, id }]
  for (const path of choPaths) {
    const bytesOfSong = read(path);
    const c = canonicalize(bytesOfSong);
    const text = c.bytesOk && !c.controlChars && bytesOfSong.length <= SONG_MAX ? c.text : null;
    const parts = path.split('/');
    const stem = parts[parts.length - 1].slice(0, -'.cho'.length);
    let id;
    if (text !== null && byText.has(text)) {
      id = byText.get(text);                             // EDT-25: the same song in several sets, stored once
    } else {
      const parsed = text !== null ? parseSong(text) : null;
      const own = parsed && (parsed.meta.get('id') || [])[0];
      const wanted = own && isSongId(own) ? own                      // a valid {meta: id} is kept (EDT-36)
        : fromRepo && isSongId(stem) ? stem                           // a repository song's file name is its ID (3.2)
          : proposeSongId(parsed && (parsed.meta.get('title') || [])[0] ? parsed.meta.get('title')[0] : stem);
      id = unique(wanted, songs);
      if (id !== wanted) duplicates.push(path);
      if (text !== null) {
        songs.set(id, canonicalize(new TextEncoder().encode(withSongId(text, id))).text);
        byText.set(text, id);
      } else {
        songs.set(id, null);
        rawSongs.set(id, bytesOfSong);                   // saved as found, so the save names SNG-01 / SNG-18
      }
    }
    // EDT-25: <set>/<song folder>/<file>.cho — the folder two levels above, inside the library folder
    if (!fromRepo && parts.length >= 3) {
      const set = parts[parts.length - 3];
      setMembers.set(set, [...(setMembers.get(set) || []), { folder: parts[parts.length - 2], id }]);
    }
  }

  // ---- sets
  const sets = [];
  const unresolved = [];
  if (fromRepo) {
    const repoId = meta && typeof meta.id === 'string' ? meta.id : null;
    const zbs = [...files.keys()].filter((p) => p.startsWith('setlists/') && p.endsWith('.zbs')).sort(compareOrdinal);
    for (const path of zbs) {
      const text = readText(path);
      if (text === null) continue;
      const { title: setTitle, entries: list } = readSetlist(text);
      const name = setTitle || path.split('/').pop().slice(0, -'.zbs'.length);
      const ids = [];
      for (const e of list) {
        if (e.library === repoId && songs.has(e.song)) ids.push(e.song);
        else unresolved.push({ set: name, entry: e.unresolved ?? `${e.library}/${e.song}` });
      }
      sets.push({ name, songs: ids });
    }
  } else {
    for (const set of [...setMembers.keys()].sort(compareOrdinal)) {
      const members = setMembers.get(set).sort((a, b) => compareOrdinal(a.folder, b.folder));
      sets.push({ name: set, songs: [...new Set(members.map((m) => m.id))] });
    }
  }

  // ---- library fields
  const licenseText = meta && meta.license && typeof meta.license.file === 'string' && files.has(meta.license.file)
    ? readText(meta.license.file) : null;
  const license = meta && meta.license && typeof meta.license === 'object'
    ? { id: meta.license.id, summary: meta.license.summary, ...(licenseText ? { text: licenseText.replace(/\n+$/, '') } : {}) }
    : null;
  const maintainer = meta && meta.maintainer && typeof meta.maintainer === 'object'
    ? Object.fromEntries(['name', 'email', 'url'].filter((k) => typeof meta.maintainer[k] === 'string' && meta.maintainer[k]).map((k) => [k, meta.maintainer[k]]))
    : null;
  const used = new Set([...choPaths, 'zangbundel.json', 'zangbundel-archive.json',
    ...(meta && meta.license && typeof meta.license.file === 'string' ? [meta.license.file] : []),
    ...[...files.keys()].filter((p) => fromRepo && p.startsWith('setlists/') && p.endsWith('.zbs'))]);
  const leftOut = [...files.keys()].filter((p) => !used.has(p)).sort(compareOrdinal);
  const libTitle = title || (meta && typeof meta.name === 'string' && meta.name) || (root ? root.slice(0, -1) : 'Bibliotheek');
  const { tags, leftOut: tagsLeftOut } = readTags(meta ? meta.tags : undefined);

  const library = {
    libraryId,
    version: 1,
    title: [...libTitle].slice(0, 80).join(''),
    description: meta && typeof meta.description === 'string' && meta.description !== meta.name ? meta.description : undefined,
    created: isoSeconds(now),
    modified: isoSeconds(now),
    license,
    maintainer,
    tags,
    author: null,
    signed: false,
    sets,
    songs,
    rawSongs,
    extra: [],
    dropped: leftOut,
    isNew: true,
    opened: null,
  };
  return { library, report: { kind, songs: songs.size, sets: sets.length, leftOut, duplicates, unresolved, tagsLeftOut } };
}
