// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/core/library.js: opening, saving unchanged (EDT-51), saving changed
// (EDT-51 to EDT-58), signing (EDT-53, EDT-60, EDT-62), Save as copy (EDT-71), names (EDT-54,
// EDT-55), and the save refused on an Error (EDT-50). Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyLibrary, fileName, folderName, newLibrary, openLibrary, saveLibrary } from '../../src/core/library.js';
import { validateLibrary } from '../../src/core/validate.js';
import { readCentralDirectory, readEntry } from '../../src/core/zip.js';
import { etc, getPublicKeyAsync, signAsync } from '../../vendor/noble-ed25519-3.2.0.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name) => new Uint8Array(readFileSync(join(HERE, '..', '..', '..', 'test-libraries', `${name}.zbl`)));
const NOW = new Date('2026-11-07T10:00:00Z');
const TEST_SEED = etc.hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');   // RFC 8032 test 1
const errors = (findings) => findings.filter((f) => f.severity === 'Error' || f.severity === 'Fatal');
const SHARED = ['SNG-07', 'SNG-16'];                     // every corpus library has these two findings

async function testSigner(name = 'Test') {
  return { name, publicKey: await getPublicKeyAsync(TEST_SEED), sign: (bytes) => signAsync(bytes, TEST_SEED) };
}

function file(bytes, suffix) {
  const e = readCentralDirectory(bytes).find((x) => x.name.endsWith(suffix));
  return e ? new TextDecoder().decode(readEntry(bytes, e)) : null;
}

test('opening the reference library gives the model of its manifest and songs', async () => {
  const { library, findings } = await openLibrary(corpus('valid-signed'));
  assert.deepEqual(errors(findings), []);
  assert.equal(library.signed, true);
  assert.equal(library.songs.size, 4);
  assert.deepEqual(library.sets.map((s) => s.name), ['Kampvuur', 'Demo']);
  assert.equal(library.author.publicKey.length, 32);
});

test('EDT-51: an unchanged library is saved byte for byte as opened, signature included', async () => {
  for (const name of ['valid-signed', 'valid-unsigned']) {
    const bytes = corpus(name);
    const { library } = await openLibrary(bytes);
    const saved = await saveLibrary(library, { changed: false });
    assert.equal(saved.unchanged, true);
    assert.deepEqual(saved.bytes, bytes, name);
  }
});

test('a changed library: version + 1, modified, changes note, new view; it reopens to the same model', async () => {
  const { library } = await openLibrary(corpus('valid-unsigned'));
  library.title = 'Kampvuurliederen';
  const saved = await saveLibrary(library, { changed: true, now: NOW, changes: 'Titel aangepast.' });
  assert.equal(saved.refused, false, JSON.stringify(errors(saved.findings)));
  assert.deepEqual([...new Set(saved.findings.map((f) => f.code))].sort(), SHARED);
  assert.equal(saved.version, library.version + 1);
  assert.equal(saved.fileName, `Kampvuurliederen-v${library.version + 1}.zbl`);
  const manifest = JSON.parse(file(saved.bytes, '/manifest.json'));
  assert.equal(manifest.modified, '2026-11-07T10:00:00Z');
  assert.equal(manifest.changes, 'Titel aangepast.');
  assert.equal(JSON.parse(file(saved.bytes, '/zangbundel.json')).name, 'Kampvuurliederen');
  assert.ok(readCentralDirectory(saved.bytes).every((e) => e.name.startsWith('Kampvuurliederen/')));   // EDT-55
  const again = (await openLibrary(saved.bytes)).library;
  assert.equal(again.title, 'Kampvuurliederen');
  assert.deepEqual([...again.songs], [...library.songs]);
  assert.deepEqual(again.sets, library.sets);
  // EDT-58: the note belongs to one version
  again.description = 'Anders.';
  const next = await saveLibrary(again, { changed: true, now: NOW });
  assert.equal(JSON.parse(file(next.bytes, '/manifest.json')).changes, undefined);
});

test('building is deterministic: the same model and time give the same bytes', async () => {
  const { library } = await openLibrary(corpus('valid-unsigned'));
  const a = await saveLibrary(library, { changed: true, now: NOW });
  const b = await saveLibrary(library, { changed: true, now: NOW });
  assert.deepEqual(a.bytes, b.bytes);
});

test('EDT-57: songs are written in canonical form', async () => {
  const { library } = await openLibrary(corpus('valid-unsigned'));
  library.songs.set('lorem-ipsum', `${library.songs.get('lorem-ipsum')}`);
  const saved = await saveLibrary(library, { changed: true, now: NOW });
  const text = file(saved.bytes, '/songs/lorem-ipsum/lorem-ipsum.cho');
  assert.ok(text.endsWith('\n') && !text.endsWith('\n\n') && !text.includes('\r') && !/[ \t]\n/.test(text));
});

test('EDT-53, EDT-60: signing an unsigned library; the signature verifies and author.name comes from the key file', async () => {
  const { library } = await openLibrary(corpus('valid-unsigned'));
  const saved = await saveLibrary(library, { changed: true, now: NOW, signer: await testSigner('Remko') });
  assert.equal(saved.refused, false);
  assert.ok(!saved.findings.some((f) => f.code.startsWith('SIG-')));
  const manifest = JSON.parse(file(saved.bytes, '/manifest.json'));
  assert.equal(manifest.author.publicKey, '11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=');
  assert.equal(manifest.author.name, 'Remko');
  const reopened = (await openLibrary(saved.bytes)).library;
  assert.equal(reopened.signed, true);
});

test('EDT-23, EDT-62: a signed library saves only with its own key', async () => {
  const { library } = await openLibrary(corpus('valid-signed'));
  await assert.rejects(saveLibrary(library, { changed: true, now: NOW }), /only with its key loaded/);
  const other = { name: 'X', publicKey: new Uint8Array(32).fill(7), sign: async () => new Uint8Array(64) };
  await assert.rejects(saveLibrary(library, { changed: true, now: NOW, signer: other }), /not the key of this library/);
  const saved = await saveLibrary(library, { changed: true, now: NOW, signer: await testSigner() });
  assert.equal(saved.refused, false);
  assert.equal(JSON.parse(file(saved.bytes, '/manifest.json')).author.name, library.author.name);   // name kept
});

test('EDT-71: Save as copy of a signed library, without its key', async () => {
  const { library } = await openLibrary(corpus('valid-signed'));
  const copy = copyLibrary(library, { now: NOW });
  assert.notEqual(copy.libraryId, library.libraryId);
  assert.match(copy.libraryId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(copy.title, `${library.title} (copy)`);
  const saved = await saveLibrary(copy, { now: NOW });
  assert.equal(saved.refused, false, JSON.stringify(errors(saved.findings)));
  assert.equal(saved.version, 1);
  const manifest = JSON.parse(file(saved.bytes, '/manifest.json'));
  assert.equal(manifest.author, undefined);
  assert.equal(file(saved.bytes, '/manifest.sig'), null);
  assert.equal(manifest.created, '2026-11-07T10:00:00Z');
});

test('EDT-50: a save with an Error is refused, and EDT-13/14: a new library needs licence and maintainer', async () => {
  const { library } = await openLibrary(corpus('valid-unsigned'));
  library.sets[0].songs.push('no-such-song');
  const saved = await saveLibrary(library, { changed: true, now: NOW });
  assert.equal(saved.refused, true);
  assert.equal(saved.bytes, null);
  assert.ok(saved.findings.some((f) => f.code === 'SET-01'));
  const fresh = newLibrary({ title: 'Nieuw', now: NOW });
  const r = await saveLibrary(fresh, { now: NOW });
  assert.equal(r.refused, true);
  assert.deepEqual(errors(r.findings).map((f) => f.code).sort(), ['MAN-07', 'MAN-08']);
  fresh.license = { id: 'CC0-1.0', summary: 'Free for any use.' };
  fresh.maintainer = { name: 'Leiding', email: 'leiding@example.org' };
  const ok = await saveLibrary(fresh, { now: NOW });
  assert.equal(ok.refused, false, JSON.stringify(errors(ok.findings)));
  assert.deepEqual(ok.findings.map((f) => f.code), ['STR-02']);                   // no songs yet: a Warning
  assert.deepEqual(errors((await validateLibrary(ok.bytes)).findings), []);
});

test('EDT-54, EDT-55: names comply with FDS 3.3', () => {
  assert.equal(fileName('Kampvuur', 4), 'Kampvuur-v4.zbl');
  assert.equal(folderName('Kamp: vuur? / nacht'), 'Kamp- vuur- - nacht');
  assert.equal(folderName('AUX'), 'AUX-bibliotheek');
  assert.equal(folderName('Liedjes...'), 'Liedjes');
  assert.equal(folderName('  '), 'bibliotheek');
  assert.ok([...folderName('x'.repeat(150))].length <= 100);
});
