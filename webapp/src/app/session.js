// SPDX-License-Identifier: Apache-2.0
// The editing session (FDS 7.1 to 7.3: EDT-01 to EDT-03, EDT-10 to EDT-12, EDT-20 to EDT-26;
// implementationPlan M6.1): the open library, its findings and whether it has changes not yet
// downloaded. No DOM, so it can be tested; the screens draw it. Library bytes go to the library
// worker (SR-30) and the model comes back as data. Nothing is kept after the page closes (EDT-02).

import { libraryFileName } from '../core/names.js';

export const ZIP_MAX = 64 * 1024 * 1024;              // FDS 3.5: refused before the file is read (PKG-02)
const MANIFEST_DIFFERS = new Set(['MAN-04', 'MAN-05', 'MAN-06']);   // EDT-22: a save records the current content (M-61)
const blocking = (findings) => findings.some((f) => f.severity === 'Error' || f.severity === 'Fatal');

const fatalIn = (findings) => (findings || []).filter((f) => f.severity === 'Fatal');

/**
 * client: the library worker's client (library-client.js), or a stand-in in tests.
 * Returns { get(), onChange(fn), open(file), create(title, description), recheck(), preview(), save(), close() }.
 */
export function createSession({ client, now = () => new Date() }) {
  let state = { library: null, songs: [], findings: null, converted: null, dirty: false, busy: false };
  const listeners = new Set();
  const set = (next) => {
    state = { ...state, ...next };
    for (const fn of listeners) fn(state);
  };

  /** EDT-42: the findings of the library as it would be saved now. */
  async function recheck() {
    if (!state.library) return;
    const r = await client.request('check', { library: state.library, now: now() });
    set(r.findings ? { findings: r.findings, songs: r.songs } : { songs: r.songs });
  }

  return {
    get: () => state,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

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
        set({ library: r.library, songs: r.songs || [], findings: r.findings, converted: r.converted || null, dirty: false });
        return { ok: true, converted: r.converted || null };
      } finally {
        set({ busy: false });
      }
    },

    /** EDT-10 to EDT-12: a new, empty library; its licence and maintainer come before the first save. */
    async create(title, description) {
      const library = await client.request('new', { title, description: description || undefined, now: now() });
      set({ library, songs: [], findings: [], converted: null, dirty: false });
      await recheck();
      return library;
    },

    recheck,

    /**
     * What *Downloaden* would do (FDS 7.6): { changed, version, fileName, needsConfirm, findings, blocked }.
     * An unchanged library is saved as it was opened (EDT-51); one whose files differ from its manifest
     * is saved anew after M-61 (EDT-22). blocked follows the findings of the library as it would be
     * saved (EDT-50, M-63).
     */
    async preview() {
      const lib = state.library;
      const unchanged = !state.dirty && !lib.isNew;
      const needsConfirm = unchanged && (state.findings || []).some((f) => MANIFEST_DIFFERS.has(f.code));
      const changed = !unchanged || needsConfirm;
      let findings = state.findings || [];
      if (changed) {
        const r = await client.request('check', { library: lib, now: now() });
        if (r.findings) findings = r.findings;
      }
      const version = lib.isNew ? 1 : changed ? lib.version + 1 : lib.version;
      return { changed, version, fileName: libraryFileName(lib.title, version), needsConfirm, findings, blocked: blocking(findings) };
    },

    /**
     * EDT-50 to EDT-58: save. Returns { ok: true, bytes, fileName, version, findings } or { ok: false,
     * findings, reason }. The saved file then is the open library: its version, its manifest, its bytes.
     */
    async save({ changed, changes } = {}) {
      const r = await client.request('save', { library: state.library, changed: Boolean(changed), now: now(), changes: changes || undefined });
      if (r.refused || !r.bytes) return { ok: false, findings: r.findings || [], reason: r.reason };
      const copy = r.bytes.slice();
      const o = await client.request('open', { bytes: copy }, [copy.buffer]);
      if (o.library) set({ library: o.library, songs: o.songs || state.songs, findings: o.findings, converted: null, dirty: false });
      return { ok: true, bytes: r.bytes, fileName: r.fileName, version: r.version, findings: r.findings };
    },

    /** EDT-01, EDT-03: close the session. With changes not yet downloaded, the caller asks M-60 first. */
    close() {
      set({ library: null, songs: [], findings: null, converted: null, dirty: false });
    },
  };
}
