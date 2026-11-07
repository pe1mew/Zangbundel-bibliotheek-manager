// SPDX-License-Identifier: Apache-2.0
// The key file (FDS 5.3; SG-05, SG-10 to SG-12; implementationPlan M3.4). Pure functions: reading
// checks the form only; that the public key belongs to the private key (SG-11) is checked by the
// crypto worker, which derives it. Used only inside the crypto worker (securityAssessment SR-40).

import { base64Bytes } from './manifest.js';

export const KEY_FILE_MAX = 4096;                       // a key file is about 300 bytes
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const enc = new TextEncoder();

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const len = (s) => [...s].length;

function toBase64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Why a base64 key is not SG-05's raw 32 bytes; 'wrapped' for the DER forms openssl writes. */
function keyProblem(value, what) {
  const bytes = typeof value === 'string' ? base64Bytes(value) : null;
  if (bytes === null) return `${what} is not base64`;
  if (bytes.length === 32) return null;
  // PKCS #8 (48 bytes) and SubjectPublicKeyInfo (44 bytes) of an Ed25519 key start with a DER SEQUENCE
  if ((bytes.length === 48 || bytes.length === 44) && bytes[0] === 0x30) return `${what} is wrapped in DER (PKCS #8 or X.509); unwrap it to the raw 32 bytes (SG-05)`;
  return `${what} is ${bytes.length} bytes, not the raw 32 bytes of SG-05`;
}

/**
 * Read the bytes of a key file. Returns { ok: true, key: { name, seed, publicKey, created } } with
 * seed and publicKey as Uint8Array(32), or { ok: false, message: 'M-31', reason }.
 */
export function readKeyFile(bytes) {
  const bad = (reason) => ({ ok: false, message: 'M-31', reason });
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || bytes.length > KEY_FILE_MAX) {
    return bad(`not a key file: ${bytes && bytes.length ? `${bytes.length} bytes` : 'empty'}`);
  }
  let k;
  try {
    k = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return bad('not UTF-8 JSON');
  }
  if (!isObject(k)) return bad('not a JSON object');
  if (k.type !== 'songbook-signing-key') return bad('type is not "songbook-signing-key"');
  if (k.formatVersion !== 1) return bad('formatVersion is not 1');
  if (k.algorithm !== 'Ed25519') return bad('algorithm is not "Ed25519"');
  if (typeof k.name !== 'string' || len(k.name) < 1 || len(k.name) > 100) return bad('name is not 1–100 characters');
  const problem = keyProblem(k.privateKey, 'privateKey') || keyProblem(k.publicKey, 'publicKey');
  if (problem) return bad(problem);
  if (k.created !== undefined && (typeof k.created !== 'string' || !UTC.test(k.created))) return bad('created is not YYYY-MM-DDThh:mm:ssZ');
  return { ok: true, key: { name: k.name, seed: base64Bytes(k.privateKey), publicKey: base64Bytes(k.publicKey), created: k.created } };
}

/**
 * The bytes of a key file (FDS 5.3), for an explicit download only (SR-40). The private key exists as
 * a string only inside this function's result; the caller hands the bytes to the download and drops them.
 */
export function writeKeyFile({ name, seed, publicKey, created }) {
  if (!(seed instanceof Uint8Array) || seed.length !== 32 || !(publicKey instanceof Uint8Array) || publicKey.length !== 32) {
    throw new TypeError('writeKeyFile: raw 32-byte keys are needed (SG-05)');
  }
  const file = { type: 'songbook-signing-key', formatVersion: 1, algorithm: 'Ed25519', name,
    privateKey: toBase64(seed), publicKey: toBase64(publicKey), created };
  return enc.encode(`${JSON.stringify(file, null, 2)}\n`);
}
