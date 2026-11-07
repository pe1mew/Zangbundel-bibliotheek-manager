// SPDX-License-Identifier: Apache-2.0
// The crypto worker's work, as a plain module so it can be tested without a browser
// (securityAssessment SR-15, SR-16, SR-40, SR-41; FDS 5, 7.7; implementationPlan M3.1).
//
// Request  { id, op, payload }   op: 'selftest' | 'make' | 'exportKeyFile' | 'load' | 'info' | 'sign' | 'serve' | 'forget'
// Response { id, ok: true, result }  or  { id, ok: false, error }
//
// The private key lives here only (SR-40): a new key's seed until its key file has been exported,
// then a non-extractable Web Crypto key where the browser has one; a loaded key is sealed at once.
// The seed leaves the worker only inside the bytes of a key file, on an explicit export after the
// M-64 notice (EDT-61). Every key is overwritten with zeros when it is replaced or forgotten (SR-41).
// A key the user refuses is answered with { accepted: false, message, reason }, never an error.

import { derivePublicKey, importNonExtractable, selfTest, sign } from '../core/ed25519.js';
import { readKeyFile, writeKeyFile } from '../core/keyfile.js';
import { fingerprint } from '../core/fingerprint.js';
import { safeFileName } from '../core/names.js';

const isoSeconds = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z');   // FDS 4.1, as library.js

const equal = (a, b) => a instanceof Uint8Array && b instanceof Uint8Array && a.length === b.length && a.every((x, i) => x === b[i]);
const refuse = (message, reason) => ({ accepted: false, message, reason });

/** A handler with its own key state; useWebCrypto: false runs the @noble/ed25519 path (tests). */
export function createCryptoHandler({ useWebCrypto = true } = {}) {
  let test = null;                                       // the self-test's promise: once per worker (SR-15)
  let key = null;                                        // { name, created, publicKey, seed, cryptoKey, needsExport }

  const tested = () => (test ??= selfTest({ useWebCrypto }));

  function wipe() {
    if (key && key.seed) key.seed.fill(0);
    key = null;
  }

  /** SR-16: once the key file is safe (exported or loaded), keep only a non-extractable key. */
  async function seal(k) {
    const webCrypto = (await tested()).webCrypto;
    const cryptoKey = webCrypto ? await importNonExtractable(k.seed, k.publicKey) : null;
    if (cryptoKey) {
      k.seed.fill(0);
      k.seed = null;
      k.cryptoKey = cryptoKey;
    }
    k.needsExport = false;
  }

  const describe = async (k) => ({ accepted: true, name: k.name, created: k.created, publicKey: k.publicKey.slice(),
    fingerprint: await fingerprint(k.publicKey), needsExport: k.needsExport });

  async function signBytes(bytes) {
    if (!key) throw new Error('no key loaded');
    if (key.needsExport) throw new Error('the new key file has not been saved yet (EDT-61)');
    if (!(bytes instanceof Uint8Array)) throw new TypeError('sign: bytes are needed');
    return sign(key, bytes);
  }

  const ops = {
    async selftest() {
      return tested();
    },

    /** EDT-61: a new key pair; its key file must be exported before it can sign. */
    async make({ name, now = new Date() } = {}) {
      const t = await tested();
      if (!t.ok) return refuse('selftest', t.failures.join('; '));
      if (typeof name !== 'string' || [...name].length < 1 || [...name].length > 100) return refuse('name', 'the name is 1–100 characters');
      const seed = crypto.getRandomValues(new Uint8Array(32));
      const publicKey = await derivePublicKey(seed);
      wipe();
      key = { name, created: isoSeconds(now), publicKey, seed, cryptoKey: null, needsExport: true };
      return describe(key);
    },

    /** EDT-61, SR-40: the key file of a new key, once, after the user acknowledged M-64. */
    async exportKeyFile({ acknowledged } = {}) {
      if (!key || !key.needsExport) return refuse('export', 'only a new key that has not been saved yet can be exported');
      if (acknowledged !== true) return refuse('M-64', 'the notice M-64 must be acknowledged first');
      const bytes = writeKeyFile(key);
      const fileName = `${safeFileName(key.name, 90)}.zbkey`;
      await seal(key);
      return { accepted: true, bytes, fileName };
    },

    /** SG-11, EDT-62: load a key file; with expect (a library's author key) it must be that key. */
    async load({ bytes, expect } = {}) {
      const t = await tested();
      if (!t.ok) return refuse('selftest', t.failures.join('; '));
      const r = readKeyFile(bytes);
      if (!r.ok) return refuse(r.message, r.reason);
      const k = { ...r.key, cryptoKey: null, needsExport: false };
      if (!equal(await derivePublicKey(k.seed), k.publicKey)) {
        k.seed.fill(0);
        return refuse('M-31', 'publicKey does not belong to privateKey (SG-11)');
      }
      if (expect !== undefined && expect !== null && !equal(expect, k.publicKey)) {
        k.seed.fill(0);
        return refuse('M-30', 'this key is not the author key of the library (EDT-62)');
      }
      wipe();
      key = k;
      await seal(key);
      return describe(key);
    },

    async info() {
      return key ? { loaded: true, ...(await describe(key)) } : { loaded: false };
    },

    async sign({ bytes } = {}) {
      return { signature: await signBytes(bytes) };
    },

    /**
     * A MessagePort on which the library worker asks for signatures while it saves, so the manifest
     * bytes and the signature need not pass the main thread: { id, bytes } -> { id, signature } or { id, error }.
     */
    async serve({ port } = {}) {
      if (!port || typeof port.postMessage !== 'function') throw new TypeError('serve: a MessagePort is needed');
      port.onmessage = async (event) => {
        const { id, bytes } = event.data || {};
        try {
          port.postMessage({ id, signature: await signBytes(bytes) });
        } catch (e) {
          port.postMessage({ id, error: e instanceof Error ? e.message : String(e) });
        }
      };
      return { serving: true };
    },

    /** SR-41, SR-46: overwrite the key and drop it. */
    async forget() {
      wipe();
      return { forgotten: true };
    },
  };

  return async function handleMessage(message) {
    const { id, op, payload } = message || {};
    if (!Object.hasOwn(ops, op)) return { id, ok: false, error: `unknown operation: ${String(op)}` };
    try {
      return { id, ok: true, result: await ops[op](payload || {}) };
    } catch (e) {
      return { id, ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };
}
