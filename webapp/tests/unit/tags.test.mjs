// SPDX-License-Identifier: Apache-2.0
// Tag labels in the manifest (FDS draft 0.10, 4.1, D-44; song format 12.11, v0.26): checked by MAN-02,
// kept through open, save and Save as copy, left out of the 1.1 view, and carried over from
// zangbundel.json on conversion (EDT-26), leaving out and naming what the manifest does not allow.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyLibrary, openLibrary, saveLibrary } from '../../src/core/library.js';
import { readManifest, tagsProblem } from '../../src/core/manifest.js';
import { readCentralDirectory, readEntry, writeZip } from '../../src/core/zip.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name) => new Uint8Array(readFileSync(join(HERE, '..', '..', '..', 'test-libraries', `${name}.zbl`)));
const NOW = new Date('2026-11-07T12:00:00Z');
const enc = new TextEncoder();
const dec = new TextDecoder();
const file = (zip, suffix) => dec.decode(readEntry(zip, readCentralDirectory(zip).find((e) => e.name.endsWith(suffix))));
const LABELS = { kampvuur: { nl: 'Kampvuur', en: 'Campfire', de: 'Lagerfeuer' }, avond: { nl: 'Avond', en: 'Evening' }, winter: { nl: 'Winter' } };

test('FDS 4.1: what tags may hold', () => {
  assert.equal(tagsProblem(LABELS), null);
  assert.equal(tagsProblem({}), null);
  for (const bad of [[], 'x', { Kampvuur: { nl: 'K' } }, { a: {} }, { a: { nl: '' } }, { a: { nl: 'x'.repeat(61) } },
    { a: { NL_nl: 'K' } }, { a: { nl: 'twee\nregels' } }, { a: { nl: 'C1 \u0085' } }, { a: { nl: 'Café' } }, { a: { nl: 7 } },
    { a: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`x${'abcdefghijklmnopqrstu'[i]}`, 'L'])) },
    Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`t${i}`, { nl: 'L' }]))]) {
    assert.ok(tagsProblem(bad), JSON.stringify(bad).slice(0, 80));
  }
  assert.equal(tagsProblem({ a: { nl: 'x'.repeat(60), 'nl-BE': 'é' } }), null);
  const m = (tags) => readManifest(enc.encode(JSON.stringify({ tags }))).problems;
  assert.ok(m({ a: { nl: 'twee\nregels' } }).some((p) => /label/.test(p)));
});

test('the test library tag-labels opens with its labels, saves them in the manifest only, and reopens the same', async () => {
  const { library, findings } = await openLibrary(corpus('tag-labels'));
  assert.deepEqual(findings.filter((f) => f.severity === 'Error'), []);
  assert.deepEqual(library.tags, LABELS);
  assert.ok(!library.extra.some(([k]) => k === 'tags'));          // a known field, not an unknown one
  library.tags.demo = { nl: 'Demo' };
  const saved = await saveLibrary(library, { changed: true, now: NOW });
  assert.equal(saved.refused, false, JSON.stringify(saved.findings));
  assert.deepEqual(JSON.parse(file(saved.bytes, '/manifest.json')).tags, { ...LABELS, demo: { nl: 'Demo' } });
  assert.equal('tags' in JSON.parse(file(saved.bytes, '/zangbundel.json')), false);   // PF-41: the view has none
  const again = await openLibrary(saved.bytes);
  assert.deepEqual(again.library.tags, { ...LABELS, demo: { nl: 'Demo' } });
});

test('MAN-02 for the test library tag-label-invalid; a fixed label saves', async () => {
  const { library, findings } = await openLibrary(corpus('tag-label-invalid'));
  assert.ok(findings.some((f) => f.code === 'MAN-02'));
  const refused = await saveLibrary(library, { changed: true, now: NOW });
  assert.equal(refused.refused, true);
  library.tags.kampvuur.nl = 'Kampvuur';
  const saved = await saveLibrary(library, { changed: true, now: NOW });
  assert.equal(saved.refused, false, JSON.stringify(saved.findings));
});

test('Save as copy keeps the labels as its own; a library without labels writes no tags field', async () => {
  const { library } = await openLibrary(corpus('tag-labels'));
  const copy = copyLibrary(library, { now: NOW });
  copy.tags.kampvuur.en = 'Camp fire';
  assert.equal(library.tags.kampvuur.en, 'Campfire');
  const plain = await openLibrary(corpus('valid-unsigned'));
  assert.equal(plain.library.tags, null);
  plain.library.tags = {};
  const saved = await saveLibrary(plain.library, { changed: true, now: NOW });
  assert.equal('tags' in JSON.parse(file(saved.bytes, '/manifest.json')), false);
});

test('EDT-26: labels from zangbundel.json are carried over; entries the manifest does not allow are left out and named', async () => {
  const songs = { 'r/songs/nl/a.cho': '{title: A}\n{meta: id a}\n{meta: language nl}\n{meta: tag kampvuur}\nla\n' };
  const meta = { id: 'r', name: 'R', license: { id: 'CC0-1.0', summary: 'Vrij.' }, maintainer: { name: 'L', email: 'l@example.org' },
    tags: { kampvuur: { nl: 'Kampvuur', en: 'Campfire\n', de: 'Lagerfeuer' }, Avond: { nl: 'Avond' }, leeg: {}, kort: 'x' } };
  const zip = writeZip([{ name: 'r/zangbundel.json', data: enc.encode(JSON.stringify(meta)) },
    ...Object.entries(songs).map(([name, text]) => ({ name, data: enc.encode(text) }))], NOW);
  const { library, converted, findings } = await openLibrary(zip, { now: NOW });
  assert.deepEqual(library.tags, { kampvuur: { nl: 'Kampvuur', de: 'Lagerfeuer' } });
  assert.deepEqual(converted.tagsLeftOut, ['kampvuur.en', 'Avond', 'leeg', 'kort']);
  assert.equal(findings.some((f) => f.code === 'MAN-02'), false);
  const saved = await saveLibrary(library, { now: NOW });
  assert.equal(saved.refused, false, JSON.stringify(saved.findings));
});
