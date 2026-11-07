// SPDX-License-Identifier: Apache-2.0
// Unit tests of signing and copying in webapp/src/app/session.js (FDS 7.7, 7.8: EDT-23, EDT-24,
// EDT-60 to EDT-73; webappGUI GD-24; implementationPlan M6.3), with the real library and crypto
// handlers behind stand-in clients and a real MessageChannel between them, as in the browser.
// Run: node --test webapp/tests/
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSession } from '../../src/app/session.js';
import { handleMessage } from '../../src/workers/library-handler.js';
import { createCryptoHandler } from '../../src/workers/crypto-handler.js';
import { validateLibrary } from '../../src/core/validate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIBS = join(HERE, '..', '..', '..', 'test-libraries');
const corpus = (name) => new Uint8Array(readFileSync(join(LIBS, `${name}.zbl`)));
const TEST_KEY = new Uint8Array(readFileSync(join(LIBS, 'test-key-rfc8032.zbkey')));
const NOW = new Date('2026-11-07T12:00:00Z');
const file = (bytes, name = 'x.zbl') => new File([bytes], name);

const ports = [];
after(() => ports.forEach((p) => p.close()));
// The messages are passed as they are (a MessagePort is not cloned here); the handlers are the real ones.
const client = { async request(op, payload) { const a = await handleMessage({ id: 1, op, payload }); if (!a.ok) throw new Error(a.error); return a.result; } };
function cryptoClient() {
  const handle = createCryptoHandler();
  return {
    async request(op, payload) { const a = await handle({ id: 1, op, payload }); if (!a.ok) throw new Error(a.error); return a.result; },
    async signerPort() {
      const { port1, port2 } = new MessageChannel();
      ports.push(port1, port2);
      await this.request('serve', { port: port2 });
      return port1;
    },
    handle,
  };
}
const session = () => createSession({ client, crypto: cryptoClient(), now: () => NOW });

test('EDT-23: a signed library without its key is read-only, saves only unchanged, and shows its author', async () => {
  const s = session();
  const bytes = corpus('valid-signed');
  await s.open(file(bytes));
  assert.equal(s.isReadOnly(), true);
  assert.equal(s.get().authorFingerprint, '21FE-31DF-A154-A261');
  const p = await s.preview();
  assert.deepEqual([p.changed, p.blocked, p.canSign, p.readOnly], [false, false, false, false]);
  const saved = await s.save({ changed: false });
  assert.deepEqual(saved.bytes, bytes);                          // EDT-51: signature included
});

test('EDT-24, EDT-62: its own key unlocks it and signing is then required; another key is refused with M-30', async () => {
  const s = session();
  await s.open(file(corpus('valid-signed')));
  const other = cryptoClient();                                  // a key of someone else, made and exported elsewhere
  await other.request('make', { name: 'Iemand anders', now: NOW });
  const otherFile = (await other.request('exportKeyFile', { acknowledged: true })).bytes;
  const refused = await s.loadKey(file(otherFile, 'anders.zbkey'));
  assert.deepEqual([refused.ok, refused.message], [false, 'M-30']);
  assert.equal(s.isReadOnly(), true);
  const r = await s.loadKey(file(TEST_KEY, 'test.zbkey'));
  assert.equal(r.ok, true);
  assert.equal(r.key.fingerprint, '21FE-31DF-A154-A261');
  assert.equal(s.isReadOnly(), false);
  const p = await s.preview();
  assert.deepEqual([p.mustSign, p.sign, p.changed], [true, true, false]);
  assert.equal((await s.loadKey(file(new Uint8Array(5000), 'big.zbkey'))).message, 'M-31');
});

test('SR-40: the page hands the key File to the crypto worker unread; only the worker reads its bytes', async () => {
  const s = session();
  const key = file(TEST_KEY, 'test.zbkey');
  let readBy = null;
  const original = key.arrayBuffer.bind(key);
  key.arrayBuffer = () => { readBy = new Error().stack; return original(); };
  const r = await s.loadKey(key);
  assert.equal(r.ok, true);
  const caller = readBy.split('\n')[2];                          // the frame that called arrayBuffer()
  assert.match(caller, /workers[\\/]crypto-handler\.js/);        // the worker's handler, not the page
  const seed = Buffer.from('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60', 'hex');   // RFC 8032 test 1
  assert.equal(Object.values(r.key).some((v) => v instanceof Uint8Array && Buffer.from(v).equals(seed)), false);
});

test('EDT-60, SG-12: an unsigned library signed on saving: version + 1, the key\'s name as author, a valid signature', async () => {
  const s = session();
  await s.open(file(corpus('valid-unsigned')));
  await s.loadKey(file(TEST_KEY, 'test.zbkey'));
  const plain = await s.preview({ sign: false });
  assert.deepEqual([plain.changed, plain.canSign, plain.mustSign], [false, true, false]);
  const p = await s.preview({ sign: true });
  assert.deepEqual([p.changed, p.version, p.sign, p.blocked], [true, 2, true, false]);
  const saved = await s.save({ changed: p.changed, sign: p.sign, changes: 'Ondertekend.' });
  assert.equal(saved.ok, true, JSON.stringify(saved));
  const v = await validateLibrary(saved.bytes);
  assert.equal(v.signed, true);
  assert.deepEqual(v.findings.filter((f) => /^(SIG|MAN)/.test(f.code)), []);
  assert.equal(s.get().library.author.name, 'RFC 8032 test key (not for real use)');
  assert.equal(s.get().authorFingerprint, '21FE-31DF-A154-A261');
  assert.equal(s.isReadOnly(), false);                           // its key is loaded
});

test('EDT-70 to EDT-73: a copy of a signed library has a new ID, no author, version 1, and saves under the rules of 7.6', async () => {
  const s = session();
  await s.open(file(corpus('valid-signed')));
  const before = s.get().library.libraryId;
  await s.copy('Zangbundel testbibliotheek (kopie)');
  const lib = s.get().library;
  assert.notEqual(lib.libraryId, before);
  assert.deepEqual([lib.author, lib.isNew, lib.title], [null, true, 'Zangbundel testbibliotheek (kopie)']);
  assert.equal(s.isReadOnly(), false);
  const p = await s.preview();
  assert.deepEqual([p.changed, p.version, p.blocked], [true, 1, false]);
  const saved = await s.save({ changed: true });
  assert.equal(saved.ok, true);
  assert.equal((await validateLibrary(saved.bytes)).signed, false);
  assert.equal(saved.fileName, 'Zangbundel testbibliotheek (kopie)-v1.zbl');
});

test('EDT-50, EDT-70: a library with a wrong signature (SIG-03) is blocked as it is; its copy is not', async () => {
  const s = session();
  await s.open(file(corpus('signature-invalid')));
  const p = await s.preview();
  assert.deepEqual([p.changed, p.canSign, p.blocked], [false, false, true]);
  assert.ok(p.findings.some((f) => f.code === 'SIG-03'));
  await s.copy('Kopie');
  const q = await s.preview();
  assert.deepEqual([q.changed, q.version, q.blocked], [true, 1, false]);
});
