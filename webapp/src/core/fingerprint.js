// SPDX-License-Identifier: Apache-2.0
// Key fingerprint (FDS SG-20): the first 8 bytes of SHA-256 over the raw 32-byte public key, as
// 16 uppercase hex characters in four groups of four. Uses the platform's SHA-256 (crypto.subtle).

export async function fingerprint(publicKey) {
  if (!(publicKey instanceof Uint8Array) || publicKey.length !== 32) {
    throw new TypeError('fingerprint: a raw 32-byte Ed25519 public key is needed (SG-05)');
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', publicKey));
  const hex = [...digest.subarray(0, 8)].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
  return hex.match(/.{4}/g).join('-');
}
