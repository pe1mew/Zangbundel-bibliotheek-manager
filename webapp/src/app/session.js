// SPDX-License-Identifier: Apache-2.0
// The editing session (FDS 7.1 to 7.8; implementationPlan M6.1 to M6.3): the open library, its
// findings, whether it has changes not yet downloaded, and the signing key loaded in the crypto
// worker. No DOM, so it can be tested; the screens draw it. Library bytes go to the library worker
// and keys to the crypto worker (SR-30, SR-40); only data comes back, never a private key. Nothing is
// kept after the page closes (EDT-02, EDT-64).

import { libraryFileName } from '../core/names.js';
import { fingerprint } from '../core/fingerprint.js';
import { KEY_FILE_MAX } from '../core/keyfile.js';

export const ZIP_MAX = 64 * 1024 * 1024;              // FDS 3.5: refused before the file is read (PKG-02)
const MANIFEST_DIFFERS = new Set(['MAN-04', 'MAN-05', 'MAN-06']);   // EDT-22: a save records the current content (M-61)
const blocking = (findings) => findings.some((f) => f.severity === 'Error' || f.severity === 'Fatal');
const fatalIn = (findings) => (findings || []).filter((f) => f.severity === 'Fatal');
const sameKey = (a, b) => a instanceof Uint8Array && b instanceof Uint8Array && a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * client: the library worker's client; crypto: the crypto worker's client (crypto-client.js), or
 * stand-ins in tests. State: { library, songs, findings, converted, dirty, busy, key, authorFingerprint }
 * where key is { name, fingerprint, publicKey, needsExport } of the key in memory, or null;
 * needsExport: a key made in this session whose key file has not been downloaded yet.
 */
export function createSession({ client, crypto = null, now = () => new Date() }) {
  let state = { library: null, songs: [], findings: null, converted: null, dirty: false, busy: false, key: null, authorFingerprint: null,
    generation: 0 };                                   // + 1 whenever another library, or a fresh copy of it, takes the screen
  const listeners = new Set();
  const set = (next) => {
    state = { ...state, ...next };
    for (const fn of listeners) fn(state);
  };
  const authorOf = async (library) => (library && library.author ? fingerprint(library.author.publicKey) : null);

  /** EDT-23, EDT-24: a signed library is read-only until its own key is loaded. */
  const isReadOnly = () => Boolean(state.library && state.library.author
    && !(state.key && sameKey(state.key.publicKey, state.library.author.publicKey)));

  /** EDT-42: the findings of the library as it would be saved now (a signed one with its key: keyed). */
  const check = (library) => client.request('check', { library, now: now(), keyed: Boolean(library.author) && !isReadOnly() });
  let checking = 0;
  async function recheck() {
    if (!state.library) return;
    const mine = ++checking;
    const library = state.library;
    const r = await check(library);
    if (mine !== checking || state.library !== library) return;   // a newer edit's check is on its way
    set(r.findings ? { findings: r.findings, songs: r.songs } : { songs: r.songs });
  }

  /** EDT-30: the library fields that may change; the rest of the library is not touched here. */
  const LIBRARY_FIELDS = new Set(['title', 'description', 'license', 'maintainer']);

  /** SG-12, EDT-60: the key's name becomes the author's on first signing; a signed library keeps its author. */
  async function signer() {
    const port = await crypto.signerPort();
    const name = state.library.author ? state.library.author.name : state.key.name;
    return { signer: { name, publicKey: state.key.publicKey, port }, transfer: [port] };
  }

  return {
    get: () => state,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    isReadOnly,

    /**
     * EDT-20 to EDT-26: open a file. Returns { ok: true, converted } or { ok: false, findings } with
     * the findings that stopped it (a Fatal rule, or a manifest that cannot be read at all).
     */
    async open(file) {
      if (file.size > ZIP_MAX) {
        return { ok: false, findings: [{ code: 'PKG-02', severity: 'Fatal' }] };
      }
      set({ busy: true });
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const r = await client.request('open', { bytes }, [bytes.buffer]);
        const fatal = fatalIn(r.findings);
        if (fatal.length || !r.library) {
          return { ok: false, findings: fatal.length ? fatal : (r.findings || []).filter((f) => f.severity === 'Error') };
        }
        set({ generation: state.generation + 1, library: r.library, songs: r.songs || [], findings: r.findings, converted: r.converted || null, dirty: false,
          authorFingerprint: await authorOf(r.library) });
        return { ok: true, converted: r.converted || null };
      } finally {
        set({ busy: false });
      }
    },

    /** EDT-10 to EDT-12: a new, empty library; its licence and maintainer come before the first save. */
    async create(title, description) {
      const library = await client.request('new', { title, description: description || undefined, now: now() });
      set({ generation: state.generation + 1, library, songs: [], findings: [], converted: null, dirty: false, authorFingerprint: null });
      await recheck();
      return library;
    },

    recheck,

    /**
     * EDT-13, EDT-14, EDT-30: change library fields (title, description, license, maintainer); a value
     * of undefined removes the field. The library then has changes not yet downloaded (EDT-03), and its
     * findings follow (EDT-42). A read-only library is not changed (EDT-23). Returns true when applied.
     */
    async updateLibrary(patch) {
      if (!state.library || isReadOnly()) return false;
      const library = { ...state.library };
      for (const [name, value] of Object.entries(patch)) {
        if (!LIBRARY_FIELDS.has(name)) throw new Error(`updateLibrary: not a library field: ${name}`);
        if (value === undefined) delete library[name];
        else library[name] = value;
      }
      set({ library, dirty: true });
      await recheck();
      return true;
    },

    /**
     * EDT-32, GD-16: delete a song (the caller asked M-62 first); it leaves every set as well. A
     * read-only library is not changed (EDT-23). Returns true when the song was deleted.
     */
    async deleteSong(id) {
      const lib = state.library;
      if (!lib || isReadOnly() || !lib.songs.has(id)) return false;
      const library = { ...lib, songs: new Map(lib.songs), rawSongs: new Map(lib.rawSongs || []),
        sets: lib.sets.map((s) => ({ ...s, songs: s.songs.filter((x) => x !== id) })) };
      library.songs.delete(id);
      library.rawSongs.delete(id);
      set({ library, songs: state.songs.filter((s) => s.id !== id), dirty: true });
      await recheck();
      return true;
    },

    /**
     * EDT-60, EDT-62, SG-11: load a key file into the crypto worker. With a signed library open, the key
     * must be its author's (M-30). The File goes to the worker unread: the page never holds the key
     * file's bytes (SR-40). Returns { ok: true, key } or { ok: false, message, reason }.
     */
    async loadKey(file) {
      if (!crypto) return { ok: false, message: 'selftest', reason: 'no crypto worker' };
      if (file.size > KEY_FILE_MAX) return { ok: false, message: 'M-31', reason: 'too large for a key file' };
      const expect = state.library && state.library.author ? state.library.author.publicKey : undefined;
      const r = await crypto.request('load', { file, expect });
      if (!r.accepted) return { ok: false, message: r.message, reason: r.reason };
      const unlocked = isReadOnly();
      const key = { name: r.name, fingerprint: r.fingerprint, publicKey: r.publicKey, needsExport: false };
      set({ key });
      return { ok: true, key, unlocked: unlocked && !isReadOnly() };
    },

    /**
     * EDT-61, GD-14: make a new key pair in the crypto worker, replacing any key in memory. It cannot
     * sign until its key file has been downloaded (exportKey). Returns { ok: true, key } or { ok: false, message, reason }.
     */
    async makeKey(name) {
      if (!crypto) return { ok: false, message: 'selftest', reason: 'no crypto worker' };
      const r = await crypto.request('make', { name, now: now() });
      if (!r.accepted) return { ok: false, message: r.message, reason: r.reason };
      const key = { name: r.name, fingerprint: r.fingerprint, publicKey: r.publicKey, needsExport: true };
      set({ key });
      return { ok: true, key };
    },

    /**
     * EDT-61, M-64, SR-16: the key file of a new key, once, after the user acknowledged M-64; the worker
     * then keeps the key non-extractable. Returns { ok: true, bytes, fileName } or { ok: false, message, reason }.
     */
    async exportKey() {
      if (!crypto || !state.key || !state.key.needsExport) return { ok: false, message: 'export', reason: 'no new key to download' };
      const r = await crypto.request('exportKeyFile', { acknowledged: true });
      if (!r.accepted) return { ok: false, message: r.message, reason: r.reason };
      set({ key: { ...state.key, needsExport: false } });
      return { ok: true, bytes: r.bytes, fileName: r.fileName };
    },

    /** SR-41, SR-46, GD-39: the key is overwritten and the crypto worker ended; the library stays as it is. */
    async forgetKey() {
      if (crypto) await crypto.forget();
      set({ key: null });
    },

    /**
     * What *Downloaden* would do (FDS 7.6, 7.7): { changed, version, fileName, needsConfirm, findings,
     * blocked, sign, mustSign, canSign }. sign: the user ticked signing. An unchanged library is saved as
     * opened (EDT-51); signing an unsigned one is a change (EDT-60); a signed one is signed again with its
     * own key (EDT-63). blocked follows the library as it would be saved (EDT-50, M-63).
     */
    async preview({ sign = false } = {}) {
      const lib = state.library;
      // EDT-61: a new key signs only once its key file is downloaded
      const keyNeedsExport = Boolean(state.key && state.key.needsExport);
      const canSign = Boolean(state.key) && !keyNeedsExport && !isReadOnly();
      const mustSign = Boolean(lib.author) && canSign;
      const signing = mustSign || (canSign && sign);
      const unchanged = !state.dirty && !lib.isNew && !(signing && !lib.author);
      const needsConfirm = unchanged && (state.findings || []).some((f) => MANIFEST_DIFFERS.has(f.code));
      const changed = !unchanged || needsConfirm;
      let findings = state.findings || [];
      if (changed && !isReadOnly()) {
        const r = await check(lib);
        if (r.findings) findings = r.findings;
      }
      const version = lib.isNew ? 1 : changed ? lib.version + 1 : lib.version;
      // EDT-23: without its key a signed library is saved only unchanged; anything else is a copy (EDT-70)
      const readOnly = isReadOnly() && changed;
      return { changed, version, fileName: libraryFileName(lib.title, version), needsConfirm, findings,
        blocked: readOnly || blocking(findings), readOnly, sign: signing, mustSign, canSign,
        signWaitsForFile: keyNeedsExport && !lib.author };
    },

    /**
     * EDT-50 to EDT-63: save, signed when sign is true (over a MessagePort between the two workers).
     * Returns { ok: true, bytes, fileName, version, findings } or { ok: false, findings, reason }. The
     * saved file then is the open library: its version, its manifest, its signature, its bytes.
     */
    async save({ changed, changes, sign = false } = {}) {
      const { signer: s, transfer } = sign && changed ? await signer() : { signer: undefined, transfer: [] };
      const r = await client.request('save', { library: state.library, changed: Boolean(changed), now: now(),
        changes: changes || undefined, signer: s }, transfer);
      if (r.refused || !r.bytes) return { ok: false, findings: r.findings || [], reason: r.reason };
      const copy = r.bytes.slice();
      const o = await client.request('open', { bytes: copy }, [copy.buffer]);
      if (o.library) {
        set({ generation: state.generation + 1, library: o.library, songs: o.songs || state.songs, findings: o.findings, converted: null, dirty: false,
          authorFingerprint: await authorOf(o.library) });
      }
      return { ok: true, bytes: r.bytes, fileName: r.fileName, version: r.version, findings: r.findings };
    },

    /** EDT-70, EDT-71: the open library becomes a copy: new ID, version 1, no author, the given title. */
    async copy(title) {
      const library = await client.request('copy', { library: state.library, now: now(), title });
      set({ generation: state.generation + 1, library, converted: null, dirty: false, authorFingerprint: null });
      await recheck();
      return library;
    },

    /** EDT-01, EDT-03: close the session. With changes not yet downloaded, the caller asks M-60 first. */
    close() {
      set({ generation: state.generation + 1, library: null, songs: [], findings: null, converted: null, dirty: false, authorFingerprint: null });
    },
  };
}
