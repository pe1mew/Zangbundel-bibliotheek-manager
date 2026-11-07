// SPDX-License-Identifier: Apache-2.0
// Ed25519 for signing (FDS 5.1; securityAssessment SR-15, SR-16; webappTDS TD-17; plan M3.2, M3.3).
// Hybrid: the browser's Web Crypto Ed25519 where it exists, with the private key imported as
// non-extractable; the vendored @noble/ed25519 elsewhere. Ed25519 is deterministic (RFC 8032), so
// both give the same signature, which the self-test checks. Used only inside the crypto worker (SR-40).

import { getPublicKeyAsync, signAsync, verifyAsync } from '../../vendor/noble-ed25519-3.2.0.js';

const hex = (s) => Uint8Array.from(s.match(/../g), (h) => parseInt(h, 16));
const equal = (a, b) => a instanceof Uint8Array && b instanceof Uint8Array && a.length === b.length && a.every((x, i) => x === b[i]);

// RFC 8032 section 7.1, test 1, and the SHA-256 test vector "abc" (FIPS 180-2)
export const RFC8032_TEST1 = {
  seed: hex('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60'),
  publicKey: hex('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a'),
  message: new Uint8Array(0),
  signature: hex('e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b'),
};
const SHA256_ABC = hex('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');

function base64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** SG-11: the public key of a 32-byte seed (RFC 8032 5.1.5), with @noble/ed25519. */
export function derivePublicKey(seed) {
  return getPublicKeyAsync(seed);
}

/**
 * SR-16: the private key as a non-extractable Web Crypto key, or null where the browser has no
 * Ed25519 in Web Crypto. Web Crypto takes a raw Ed25519 private key only as JWK (d = seed, x = public).
 */
export async function importNonExtractable(seed, publicKey) {
  try {
    return await crypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', d: base64url(seed), x: base64url(publicKey) },
      { name: 'Ed25519' }, false, ['sign']);
  } catch {
    return null;
  }
}

/** Sign with a key { cryptoKey } (Web Crypto) or { seed } (@noble/ed25519). */
export async function sign(key, bytes) {
  if (key.cryptoKey) {
    return new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key.cryptoKey, bytes));
  }
  return signAsync(bytes, key.seed);
}

/**
 * SR-15: the known-answer self-test, run before the first use of a key. RFC 8032 test 1 (key
 * derivation, signature, verification) and SHA-256 "abc"; where Web Crypto Ed25519 exists, also its
 * signature of test 1 against the vector and against @noble/ed25519 (the cross-check).
 * Returns { ok, webCrypto, failures: [text] }. useWebCrypto: false tests the @noble/ed25519 path alone.
 */
export async function selfTest({ useWebCrypto = true } = {}) {
  const failures = [];
  const t = RFC8032_TEST1;
  const check = async (what, fn) => {
    try {
      if (!(await fn())) failures.push(what);
    } catch (e) {
      failures.push(`${what}: ${e && e.message ? e.message : e}`);
    }
  };
  await check('SHA-256 "abc"', async () => equal(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'))), SHA256_ABC));
  let nobleSignature = null;
  await check('@noble/ed25519 public key of RFC 8032 test 1', async () => equal(await getPublicKeyAsync(t.seed), t.publicKey));
  await check('@noble/ed25519 signature of RFC 8032 test 1', async () => equal(nobleSignature = await signAsync(t.message, t.seed), t.signature));
  await check('@noble/ed25519 verifies RFC 8032 test 1', () => verifyAsync(t.signature, t.message, t.publicKey, { zip215: false }));
  await check('@noble/ed25519 refuses a changed message', async () => !(await verifyAsync(t.signature, Uint8Array.of(1), t.publicKey, { zip215: false })));

  let webCrypto = false;
  if (useWebCrypto) {
    const cryptoKey = await importNonExtractable(t.seed, t.publicKey);
    if (cryptoKey) {
      webCrypto = true;
      await check('Web Crypto key is non-extractable', () => cryptoKey.extractable === false);
      let webSignature = null;
      await check('Web Crypto signature of RFC 8032 test 1', async () => equal(webSignature = await sign({ cryptoKey }, t.message), t.signature));
      await check('Web Crypto and @noble/ed25519 give the same signature', () => equal(webSignature, nobleSignature));
      await check('Web Crypto verifies RFC 8032 test 1', async () => {
        const pub = await crypto.subtle.importKey('raw', t.publicKey, { name: 'Ed25519' }, false, ['verify']);
        return crypto.subtle.verify({ name: 'Ed25519' }, pub, t.signature, t.message);
      });
    }
  }
  return { ok: failures.length === 0, webCrypto, failures };
}
