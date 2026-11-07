// SPDX-License-Identifier: Apache-2.0
// The library worker's work, as a plain module so it can be tested without a browser
// (securityAssessment SR-30; implementationPlan M2.8). library-worker.js wires it to messages.
//
// Request  { id, op, payload }            op: 'validate' | 'open' | 'save' | 'copy' | 'new'
// Response { id, ok: true, result }  or  { id, ok: false, error }
//
// Every library byte is read here, never on the main thread. Results are structured data only
// (plain objects, arrays, Maps, strings, Uint8Array): never HTML (SR-30, SR-32). Signing is not done
// here: the private key lives in the crypto worker (SR-40); the save of a signed library comes with M3.

import { validateLibrary } from '../core/validate.js';
import { copyLibrary, newLibrary, openLibrary, saveLibrary } from '../core/library.js';

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
        return { id, ok: true, result: await saveLibrary(payload.library, { changed: payload.changed, now: payload.now, changes: payload.changes }) };
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
