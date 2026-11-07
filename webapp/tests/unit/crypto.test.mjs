// SPDX-License-Identifier: Apache-2.0
// Unit tests of keys and signing (FDS 5, 7.7; securityAssessment SR-15, SR-16, SR-40, SR-41;
// implementationPlan M3): key files, the self-test on both Ed25519 paths, the crypto worker's
// handler, its client, and a signed save across both workers over a MessagePort. The exit check of
// M3: the RFC 8032 test key signs the reference library's manifest with valid-signed.zbl's signature.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readKeyFile, writeKeyFile } from '../../src/core/keyfile.js';
import { RFC8032_TEST1, selfTest } from '../../src/core/ed25519.js';
import { createCryptoHandler } from '../../src/workers/crypto-handler.js';
import { handleMessage as libraryWorker } from '../../src/workers/library-handler.js';
import { createCryptoClient } from '../../src/app/crypto-client.js';
import { validateLibrary } from '../../src/core/validate.js';
import { readCentralDirectory, readEntry } from '../../src/core/zip.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIBS = join(HERE, '..', '..', '..', 'test-libraries');
const corpus = (name) => new Uint8Array(readFileSync(join(LIBS, `${name}.zbl`)));
const TEST_KEY = new Uint8Array(readFileSync(join(LIBS, 'test-key-rfc8032.zbkey')));
const NOW = new Date('2026-11-07T12:00:00Z');
const enc = new TextEncoder();
const dec = new TextDecoder();
const entry = (zip, suffix) => readEntry(zip, readCentralDirectory(zip).find((e) => e.name.endsWith(suffix)));
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const PATHS = [{ useWebCrypto: true, label: 'Web Crypto' }, { useWebCrypto: false, label: '@noble/ed25519' }];

/** Whether the bytes occur anywhere in a value: a Uint8Array, a string (as base64) or nested data (SR-40). */
function holds(value, bytes) {
  const needle = b64(bytes);
  const seen = new Set();
  const walk = (v) => {
    if (v instanceof Uint8Array) return b64(v).includes(needle) || dec.decode(v).includes(needle);
    if (typeof v === 'string') return v.includes(needle);
    if (v && typeof v === 'object' && !seen.has(v)) {
      seen.add(v);
      return Object.values(v).some(walk);
    }
    return false;
  };
  return walk(value);
}

test('FDS 5.3: the test key file reads; damaged and wrapped key files are M-31', () => {
  const r = readKeyFile(TEST_KEY);
  assert.equal(r.ok, true);
  assert.deepEqual(r.key.seed, RFC8032_TEST1.seed);
  assert.deepEqual(r.key.publicKey, RFC8032_TEST1.publicKey);
  const file = JSON.parse(dec.decode(TEST_KEY));
  const variant = (change) => readKeyFile(enc.encode(JSON.stringify({ ...file, ...change })));
  // PKCS #8 of the RFC test key, as openssl writes it: a 16-byte DER prefix before the seed
  const pkcs8 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20, ...RFC8032_TEST1.seed]);
  assert.match(variant({ privateKey: b64(pkcs8) }).reason, /wrapped/);
  for (const bad of [{ type: 'x' }, { formatVersion: 2 }, { algorithm: 'Ed448' }, { name: '' }, { privateKey: 'AAAA' }, { created: 'gisteren' }]) {
    const out = variant(bad);
    assert.equal(out.ok, false, JSON.stringify(bad));
    assert.equal(out.message, 'M-31');
  }
  assert.equal(readKeyFile(new Uint8Array(5000)).ok, false);
  assert.equal(readKeyFile(enc.encode('not json')).ok, false);
  const again = readKeyFile(writeKeyFile({ ...r.key }));
  assert.deepEqual(again.key, r.key);
});

for (const { useWebCrypto, label } of PATHS) {
  test(`SR-15 self-test passes (${label})`, async () => {
    const r = await selfTest({ useWebCrypto });
    assert.deepEqual(r.failures, []);
    assert.equal(r.webCrypto, useWebCrypto);               // Node has Ed25519 in Web Crypto
  });

  test(`M3 exit: the test key signs the reference manifest with valid-signed.zbl's signature (${label})`, async () => {
    const handle = createCryptoHandler({ useWebCrypto });
    const loaded = (await handle({ id: 1, op: 'load', payload: { bytes: TEST_KEY } })).result;
    assert.equal(loaded.accepted, true);
    assert.equal(loaded.fingerprint, '21FE-31DF-A154-A261');
    assert.equal(holds(loaded, RFC8032_TEST1.seed), false);   // SR-40: the private key never comes back
    const signed = corpus('valid-signed');
    const manifest = entry(signed, '/manifest.json');
    const expected = JSON.parse(dec.decode(entry(signed, '/manifest.sig'))).signature;
    const r = await handle({ id: 2, op: 'sign', payload: { bytes: manifest } });
    assert.equal(b64(r.result.signature), expected);
  });

  test(`EDT-61: a new key signs only after its key file was exported, once, with M-64 acknowledged (${label})`, async () => {
    const handle = createCryptoHandler({ useWebCrypto });
    const made = (await handle({ id: 1, op: 'make', payload: { name: 'Leiding', now: NOW } })).result;
    assert.equal(made.needsExport, true);
    assert.equal((await handle({ id: 2, op: 'sign', payload: { bytes: Uint8Array.of(1) } })).ok, false);
    assert.equal((await handle({ id: 3, op: 'exportKeyFile', payload: {} })).result.message, 'M-64');
    const exported = (await handle({ id: 4, op: 'exportKeyFile', payload: { acknowledged: true } })).result;
    assert.equal(exported.accepted, true);
    assert.equal(exported.fileName, 'Leiding.zbkey');
    assert.equal((await handle({ id: 5, op: 'exportKeyFile', payload: { acknowledged: true } })).result.accepted, false);
    const file = readKeyFile(exported.bytes);
    assert.deepEqual(file.key.publicKey, made.publicKey);
    assert.equal(file.key.created, '2026-11-07T12:00:00Z');
    const sig = (await handle({ id: 6, op: 'sign', payload: { bytes: Uint8Array.of(1) } })).result.signature;
    const other = createCryptoHandler({ useWebCrypto });   // the saved file signs alike elsewhere
    await other({ id: 1, op: 'load', payload: { bytes: exported.bytes } });
    assert.deepEqual((await other({ id: 2, op: 'sign', payload: { bytes: Uint8Array.of(1) } })).result.signature, sig);
    const info = (await handle({ id: 7, op: 'info' })).result;
    assert.equal(holds(info, file.key.seed), false);
  });
}

test('SG-11, EDT-62: a key file whose halves differ is M-31; another library\'s key is M-30; forget drops the key', async () => {
  const handle = createCryptoHandler();
  const file = JSON.parse(dec.decode(TEST_KEY));
  const wrongPublic = enc.encode(JSON.stringify({ ...file, publicKey: b64(new Uint8Array(32).fill(7)) }));
  assert.equal((await handle({ id: 1, op: 'load', payload: { bytes: wrongPublic } })).result.message, 'M-31');
  const foreign = new Uint8Array(32).fill(9);
  assert.equal((await handle({ id: 2, op: 'load', payload: { bytes: TEST_KEY, expect: foreign } })).result.message, 'M-30');
  assert.equal((await handle({ id: 3, op: 'info' })).result.loaded, false);   // a refused key leaves nothing loaded
  assert.equal((await handle({ id: 4, op: 'load', payload: { bytes: TEST_KEY, expect: RFC8032_TEST1.publicKey } })).result.accepted, true);
  assert.equal((await handle({ id: 5, op: 'forget' })).result.forgotten, true);
  assert.equal((await handle({ id: 6, op: 'info' })).result.loaded, false);
  assert.equal((await handle({ id: 7, op: 'sign', payload: { bytes: Uint8Array.of(1) } })).ok, false);
  assert.equal((await handle({ id: 8, op: 'nonsense' })).ok, false);
});

test('EDT-60: an unsigned library saved with the loaded key is signed; the signature passes SIG-03', async () => {
  const crypto = createCryptoHandler();
  const key = (await crypto({ id: 1, op: 'load', payload: { bytes: TEST_KEY } })).result;
  const { port1, port2 } = new MessageChannel();
  await crypto({ id: 2, op: 'serve', payload: { port: port2 } });
  try {
    const opened = (await libraryWorker({ id: 1, op: 'open', payload: { bytes: corpus('valid-unsigned') } })).result;
    const saved = (await libraryWorker({ id: 2, op: 'save', payload: { library: opened.library, changed: true, now: NOW,
      signer: { name: key.name, publicKey: key.publicKey, port: port1 } } })).result;
    assert.equal(saved.refused, false, JSON.stringify(saved));
    const v = await validateLibrary(saved.bytes);
    assert.equal(v.signed, true);
    assert.deepEqual(v.findings.filter((f) => /^SIG/.test(f.code)), []);
    assert.equal(JSON.parse(dec.decode(entry(saved.bytes, '/manifest.json'))).author.name, 'RFC 8032 test key (not for real use)');   // SG-12
  } finally {
    port1.close();
    port2.close();
  }
});

test('a new key that was not exported cannot sign a save: the save is refused with the reason', async () => {
  const crypto = createCryptoHandler();
  const key = (await crypto({ id: 1, op: 'make', payload: { name: 'Leiding', now: NOW } })).result;
  const { port1, port2 } = new MessageChannel();
  await crypto({ id: 2, op: 'serve', payload: { port: port2 } });
  try {
    const opened = (await libraryWorker({ id: 1, op: 'open', payload: { bytes: corpus('valid-unsigned') } })).result;
    const saved = (await libraryWorker({ id: 2, op: 'save', payload: { library: opened.library, changed: true, now: NOW,
      signer: { name: key.name, publicKey: key.publicKey, port: port1 } } })).result;
    assert.equal(saved.refused, true);
    assert.match(saved.reason, /EDT-61/);
  } finally {
    port1.close();
    port2.close();
  }
});

test('the client: requests through a worker, forget ends it, pagehide ends it at once', async () => {
  const log = [];
  const page = new EventTarget();
  const fake = () => {
    const handle = createCryptoHandler();
    const w = {
      onmessage: null, onerror: null, terminated: false,
      postMessage(data, transfer = []) {
        const copy = structuredClone(data, { transfer });
        setTimeout(async () => {
          const answer = await handle(copy);
          if (!w.terminated) w.onmessage({ data: structuredClone(answer) });
        }, 0);
      },
      terminate() { w.terminated = true; log.push('terminate'); },
    };
    log.push('start');
    return w;
  };
  const client = createCryptoClient({ createWorker: fake, pageEvents: page });
  const loaded = await client.request('load', { bytes: TEST_KEY });
  assert.equal(loaded.fingerprint, '21FE-31DF-A154-A261');
  await client.forget();
  assert.deepEqual(log, ['start', 'terminate']);
  assert.equal((await client.request('info')).loaded, false);   // a new worker, with no key
  page.dispatchEvent(new Event('pagehide'));
  assert.deepEqual(log, ['start', 'terminate', 'start', 'terminate']);
});
