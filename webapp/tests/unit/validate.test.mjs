// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/core/validate.js beyond the shared test libraries: forged signatures
// under small-order keys, input that must not make the engine throw, a file and a folder of one
// name. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLibrary } from '../../src/core/validate.js';
import { readCentralDirectory, readEntry, writeZip } from '../../src/core/zip.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name) => new Uint8Array(readFileSync(join(HERE, '..', '..', '..', 'test-libraries', `${name}.zbl`)));
const enc = new TextEncoder();
const dec = new TextDecoder();

/** valid-unsigned with its manifest changed by fn and extra files, rebuilt (hashes of other files kept). */
function variant(fn, extra = {}, replace = null) {
  const src = corpus('valid-unsigned');
  const files = readCentralDirectory(src).filter((e) => !e.dir).map((e) => ({ name: e.name, data: readEntry(src, e) }));
  const man = files.find((f) => f.name.endsWith('/manifest.json'));
  const m = JSON.parse(dec.decode(man.data));
  fn(m);
  let text = `${JSON.stringify(m, null, 2)}\n`;
  if (replace) text = text.replace(replace[0], replace[1]);      // JSON too deep for JSON.stringify to build
  man.data = enc.encode(text);
  const folder = man.name.split('/')[0];
  for (const [p, data] of Object.entries(extra)) files.push({ name: `${folder}/${p}`, data });
  return writeZip(files, '2026-11-07T00:00:00Z');
}

test('SIG-03: a signature under the identity key (small order) is rejected, as Web Crypto rejects it', async () => {
  const sig = new Uint8Array(64);
  sig[0] = 1;                                                       // R = identity, S = 0
  const zip = variant((m) => { m.author = { name: 'x', publicKey: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }; },
    { 'manifest.sig': enc.encode(JSON.stringify({ algorithm: 'Ed25519', signature: btoa(String.fromCharCode(...sig)) })) });
  const { findings } = await validateLibrary(zip);
  assert.ok(findings.some((f) => f.code === 'SIG-03'), JSON.stringify(findings));
});

test('a manifest nested deeply, or with an object for a set name, gives findings and does not throw', async () => {
  const deep = `${'{"next": '.repeat(20000)}{}${', "name": "x", "email": "a@b.org"}'.repeat(20000)}`;
  const r1 = await validateLibrary(variant((m) => { m.maintainer = 'DEEP'; }, {}, ['"DEEP"', deep]));
  assert.ok(Array.isArray(r1.findings));
  const r2 = await validateLibrary(variant((m) => { m.sets[0].name = { toString: 1 }; }));
  assert.ok(r2.findings.some((f) => f.code === 'MAN-02'));
});

test('PKG-01: a file and a folder of the same name', async () => {
  const src = corpus('valid-unsigned');
  const files = readCentralDirectory(src).filter((e) => !e.dir).map((e) => ({ name: e.name, data: readEntry(src, e) }));
  const folder = files[0].name.split('/')[0];
  files.push({ name: `${folder}/songs`, data: enc.encode('x') });
  const { findings, fatal } = await validateLibrary(writeZip(files, '2026-11-07T00:00:00Z'));
  assert.equal(fatal, true);
  assert.deepEqual(findings.map((f) => f.code), ['PKG-01']);
});
