// SPDX-License-Identifier: Apache-2.0
// The library worker's work, as a plain module so it can be tested without a browser
// (securityAssessment SR-30; implementationPlan M2.8). library-worker.js wires it to messages.
//
// Request  { id, op, payload }            op: 'validate' | 'open' | 'check' | 'save' | 'copy' | 'new' | 'song'
// Response { id, ok: true, result }  or  { id, ok: false, error }
//
// Every library byte is read here, never on the main thread. Results are structured data only
// (plain objects, arrays, Maps, strings, Uint8Array): never HTML (SR-30, SR-32). Signing is not done
// here: the private key lives in the crypto worker (SR-40). A signed save brings payload.signer =
// { name, publicKey, port }, the port from app/crypto-client.js signerPort(): the manifest bytes go
// to the crypto worker over it and the signature comes back (FDS SG-02, EDT-60, EDT-62).

import { validateLibrary } from '../core/validate.js';
import { copyLibrary, newLibrary, openLibrary, saveLibrary } from '../core/library.js';
import { parseSong, songView } from '../core/chordpro.js';

/** The songs as the screens list them: { id, title }, read here so the main thread never parses a song (SR-30). */
export function songSummary(library) {
  return [...library.songs].map(([id, text]) => {
    if (text === null) return { id, title: null, sortTitle: null, language: null, lyricist: null, tags: [], words: '' };
    const song = parseSong(text);
    const first = (name) => (song.meta.get(name) || [null])[0] || null;
    // GD-13: what the song list searches, sorts and filters on; words are the lyrics as shown, without chords
    return { id, title: first('title'), sortTitle: first('sorttitle'), language: first('language'), lyricist: first('lyricist'),
      tags: [...new Set(song.meta.get('tag') || [])], words: song.lines.join('\n') };
  });
}

/**
 * GD-05, GD-19 (M5.2): one song for the song view and the left bar: its sections (chordpro.js songView)
 * and its metadata (song format 6.1). A song that is not text (SNG-01, SNG-18) has neither.
 */
export function songDetails(text) {
  if (typeof text !== 'string') return { sections: null, meta: null };
  const song = parseSong(text);
  const one = (name) => (song.meta.get(name) || [null])[0] || null;
  const all = (name) => song.meta.get(name) || [];
  return {
    sections: songView(text),
    meta: { id: one('id'), title: one('title'), subtitle: one('subtitle'), language: one('language'), lyricists: all('lyricist'),
      composers: all('composer'), copyright: one('copyright'), license: one('license'), source: one('source'),
      tags: [...new Set(all('tag'))] },
  };
}

const SIGN_TIMEOUT_MS = 10000;

/** The signer saveLibrary expects, answered by the crypto worker over a MessagePort. */
export function portSigner({ name, publicKey, port }) {
  let seq = 0;
  const waiting = new Map();
  port.onmessage = (event) => {
    const { id, signature, error } = event.data || {};
    const w = waiting.get(id);
    if (!w) return;
    waiting.delete(id);
    clearTimeout(w.timer);
    if (signature instanceof Uint8Array && signature.length === 64) w.resolve(signature);
    else w.reject(new Error(error || 'the crypto worker gave no signature'));
  };
  return {
    name,
    publicKey,
    sign(bytes) {
      const id = ++seq;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(id);
          reject(new Error('the crypto worker did not answer'));
        }, SIGN_TIMEOUT_MS);
        waiting.set(id, { resolve, reject, timer });
        port.postMessage({ id, bytes });
      });
    },
  };
}

/** Plain data of a validation: findings and what was read, without the bytes of every file. */
function validation(r) {
  return { findings: r.findings, fatal: r.fatal, songs: r.songs ?? [], signed: Boolean(r.signed) };
}

export async function handleMessage(message) {
  const { id, op, payload } = message || {};
  try {
    switch (op) {
      case 'validate':
        return { id, ok: true, result: validation(await validateLibrary(payload.bytes)) };
      case 'open':
      {
        const r = await openLibrary(payload.bytes);
        return { id, ok: true, result: r.library ? { ...r, songs: songSummary(r.library) } : r };
      }
      case 'check': {
        // EDT-42: the findings of the library as it would be saved now, without the file. A signed
        // library without its key keeps the findings of its opening (it is read-only, EDT-23). With its
        // key (keyed), its content is checked as it would be saved; the signature is made and checked on
        // saving (M6.3), so here the library is built without one.
        const songs = songSummary(payload.library);
        if (payload.library.author && !payload.keyed) return { id, ok: true, result: { findings: null, songs } };
        const library = payload.library.author ? { ...payload.library, author: null } : payload.library;
        const r = await saveLibrary(library, { changed: true, now: payload.now });
        // The VIEW rules are about the view inside a stored file; the Editor writes a new view on every save, so for
        // the library being edited they would only repeat MAN-07 or MAN-08 (a view cannot be written without them).
        const findings = r.findings.filter((f) => !f.code.startsWith('VIEW-'));
        return { id, ok: true, result: { findings, reason: findings.length ? null : r.reason, songs } };
      }
      case 'save':
        return { id, ok: true, result: await saveLibrary(payload.library, { changed: payload.changed, now: payload.now, changes: payload.changes,
          signer: payload.signer ? portSigner(payload.signer) : undefined }) };
      case 'song':
        return { id, ok: true, result: songDetails(payload.text) };
      case 'copy':
        return { id, ok: true, result: copyLibrary(payload.library, { now: payload.now, title: payload.title }) };
      case 'new':
        return { id, ok: true, result: newLibrary({ title: payload.title, description: payload.description, now: payload.now }) };
      default:
        return { id, ok: false, error: `unknown operation: ${String(op)}` };
    }
  } catch (e) {
    return { id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
