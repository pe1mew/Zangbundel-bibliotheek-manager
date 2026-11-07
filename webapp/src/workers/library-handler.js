// SPDX-License-Identifier: Apache-2.0
// The library worker's work, as a plain module so it can be tested without a browser
// (securityAssessment SR-30; implementationPlan M2.8). library-worker.js wires it to messages.
//
// Request  { id, op, payload }            op: 'validate' | 'open' | 'save' | 'copy' | 'new'
// Response { id, ok: true, result }  or  { id, ok: false, error }
//
// Every library byte is read here, never on the main thread. Results are structured data only
// (plain objects, arrays, Maps, strings, Uint8Array): never HTML (SR-30, SR-32). Signing is not done
// here: the private key lives in the crypto worker (SR-40). A signed save brings payload.signer =
// { name, publicKey, port }, the port from app/crypto-client.js signerPort(): the manifest bytes go
// to the crypto worker over it and the signature comes back (FDS SG-02, EDT-60, EDT-62).

import { validateLibrary } from '../core/validate.js';
import { copyLibrary, newLibrary, openLibrary, saveLibrary } from '../core/library.js';

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
        return { id, ok: true, result: await openLibrary(payload.bytes) };
      case 'save':
        return { id, ok: true, result: await saveLibrary(payload.library, { changed: payload.changed, now: payload.now, changes: payload.changes,
          signer: payload.signer ? portSigner(payload.signer) : undefined }) };
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
