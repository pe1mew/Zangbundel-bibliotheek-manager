// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/app/session.js (FDS 7.1 to 7.3; implementationPlan M6.1) with the real
// library handler behind a stand-in client, as the browser's worker would run it: open, convert,
// refuse, start new, recheck, close. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSession, ZIP_MAX } from '../../src/app/session.js';
import { handleMessage, songSummary } from '../../src/workers/library-handler.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name) => new Uint8Array(readFileSync(join(HERE, '..', '..', '..', 'test-libraries', `${name}.zbl`)));
const NOW = new Date('2026-11-07T12:00:00Z');

/** A stand-in for library-client.js: structured-clones each request, runs the real handler. */
const client = {
  async request(op, payload, transfer = []) {
    const answer = await handleMessage(structuredClone({ id: 1, op, payload }, { transfer }));
    if (!answer.ok) throw new Error(answer.error);
    return structuredClone(answer.result);
  },
};
/** A File as the picker gives it: size, name and arrayBuffer(). */
const file = (bytes, name = 'x.zbl') => ({ name, size: bytes.length, arrayBuffer: async () => bytes.slice().buffer });

test('EDT-20: a valid library opens with its findings and its songs by title; the worker reads them (SR-30)', async () => {
  const s = createSession({ client, now: () => NOW });
  const seen = [];
  s.onChange((st) => seen.push(st.busy));
  const r = await s.open(file(corpus('valid-unsigned')));
  assert.equal(r.ok, true);
  const st = s.get();
  assert.equal(st.library.title, 'Zangbundel testbibliotheek');
  assert.deepEqual(st.songs.map((x) => x.title).sort(), ['Fire in the Night', 'Lorem Ipsum!', 'Vader Jacob', 'Vuur in de nacht']);
  assert.deepEqual(st.findings.map((f) => f.code).sort(), ['SNG-07', 'SNG-16']);
  assert.equal(st.dirty, false);
  assert.deepEqual(seen.slice(0, 1), [true]);                      // busy while reading
  assert.equal(seen.at(-1), false);
});

test('EDT-20: a Fatal rule keeps the library closed and says why; a file above 64 MiB is not even read', async () => {
  const s = createSession({ client });
  const bad = await s.open(file(corpus('zip-truncated')));
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.findings.map((f) => [f.code, f.severity]), [['PKG-01', 'Fatal']]);
  assert.equal(s.get().library, null);
  let read = false;
  const big = await s.open({ name: 'big.zbl', size: ZIP_MAX + 1, arrayBuffer: async () => { read = true; return new ArrayBuffer(0); } });
  assert.deepEqual(big.findings.map((f) => f.code), ['PKG-02']);
  assert.equal(read, false);
});

test('EDT-21, EDT-26: a ZIP without manifest opens as a new library with its conversion report', async () => {
  const s = createSession({ client });
  const r = await s.open(file(corpus('manifest-missing')));
  assert.equal(r.ok, true);
  assert.equal(r.converted.kind, 'snapshot');
  assert.deepEqual([r.converted.songs, r.converted.sets], [4, 2]);
  assert.equal(s.get().library.isNew, true);
  assert.equal(s.get().songs.length, 4);
});

test('EDT-10 to EDT-12, EDT-42: a new library is empty, and its findings ask for licence and maintainer', async () => {
  const s = createSession({ client, now: () => NOW });
  await s.create('Kampvuurliedjes', 'Voor de Bevers');
  const st = s.get();
  assert.equal(st.library.title, 'Kampvuurliedjes');
  assert.equal(st.library.isNew, true);
  assert.deepEqual(st.songs, []);
  assert.deepEqual(st.findings.map((f) => f.code).sort(), ['MAN-07', 'MAN-08', 'STR-02']);
  s.close();
  assert.equal(s.get().library, null);
  assert.equal(s.get().findings, null);
});

test('songSummary reads titles in the worker; a song that is not text has no title', () => {
  const lib = { songs: new Map([['a', '{title: Alpha}\n{meta: id a}\nla\n'], ['b', null], ['c', 'la\n']]) };
  assert.deepEqual(songSummary(lib), [{ id: 'a', title: 'Alpha' }, { id: 'b', title: null }, { id: 'c', title: null }]);
});

test('EDT-51: an unchanged library downloads byte for byte as opened, under its own version and name', async () => {
  const s = createSession({ client, now: () => NOW });
  const bytes = corpus('valid-unsigned');
  await s.open(file(bytes));
  const p = await s.preview();
  assert.deepEqual([p.changed, p.version, p.needsConfirm, p.blocked], [false, 1, false, false]);
  assert.equal(p.fileName, 'Zangbundel testbibliotheek-v1.zbl');
  const saved = await s.save({ changed: p.changed });
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.bytes, bytes);
});

test('EDT-50, M-63: a new library without licence and maintainer is blocked; with them it saves as version 1', async () => {
  const s = createSession({ client, now: () => NOW });
  await s.create('Kampvuur');
  const p = await s.preview();
  assert.deepEqual([p.changed, p.version, p.blocked], [true, 1, true]);
  assert.deepEqual(p.findings.filter((f) => f.severity === 'Error').map((f) => f.code).sort(), ['MAN-07', 'MAN-08']);
  const lib = s.get().library;                                   // what the library fields will set (M5.4)
  lib.license = { id: 'CC0-1.0', summary: 'Vrij te gebruiken.' };
  lib.maintainer = { name: 'Leiding', email: 'leiding@example.org' };
  const q = await s.preview();
  assert.equal(q.blocked, false);
  const saved = await s.save({ changed: true, changes: 'Eerste versie.' });
  assert.equal(saved.ok, true);
  assert.equal(saved.fileName, 'Kampvuur-v1.zbl');
  assert.equal(s.get().library.isNew, false);                    // the saved file is now the open library
  assert.equal(s.get().library.version, 1);
  assert.equal((await s.preview()).changed, false);              // downloading again: unchanged
});

test('EDT-22, M-61: files that differ from the manifest ask first, then save anew as the next version', async () => {
  const s = createSession({ client, now: () => NOW });
  await s.open(file(corpus('file-changed')));
  const p = await s.preview();
  assert.deepEqual([p.needsConfirm, p.changed, p.version, p.blocked], [true, true, 2, false]);
  const saved = await s.save({ changed: true });
  assert.equal(saved.ok, true);
  assert.equal(s.get().library.version, 2);
  assert.deepEqual(s.get().findings.filter((f) => f.code.startsWith('MAN')), []);   // the new manifest matches
});
