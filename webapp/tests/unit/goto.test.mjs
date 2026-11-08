// SPDX-License-Identifier: Apache-2.0
// Unit tests of *Ga naar* (webapp/src/app/goto.js; FDS EDT-41; webappGUI GD-20): where each finding
// leads, and over all findings of the test libraries, that a song line it points at is in that song.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.document = { createElement: () => ({}), createElementNS: () => ({}), createTextNode: (s) => ({ text: s }) };
const { LIBRARY_FIELD_ID, targetOf } = await import('../../src/app/goto.js');
const { validateLibrary } = await import('../../src/core/validate.js');
const { openLibrary } = await import('../../src/core/library.js');

test('EDT-41: a song finding leads to the field it is about, to its line, or to the song', () => {
  assert.deepEqual(targetOf({ code: 'SNG-02', where: 'a', params: { folder: 'a' } }), { kind: 'song', id: 'a', field: 'title' });
  assert.deepEqual(targetOf({ code: 'SNG-11', where: 'a', params: { song: 'A' } }), { kind: 'song', id: 'a', field: 'language' });
  assert.deepEqual(targetOf({ code: 'SNG-16', where: 'a', params: { song: 'A', field: 'fieldCopyright' } }), { kind: 'song', id: 'a', field: 'copyright' });
  assert.deepEqual(targetOf({ code: 'SNG-16', where: 'a', params: { song: 'A', field: 'fieldWho' } }), { kind: 'song', id: 'a', field: 'lyricist' });
  assert.deepEqual(targetOf({ code: 'SNG-15', where: 'a', params: { directive: 'tag', line: 4 } }), { kind: 'song', id: 'a', field: 'tag' });
  assert.deepEqual(targetOf({ code: 'SNG-15', where: 'a', params: { directive: 'year', line: 4 } }), { kind: 'song', id: 'a', line: 4 });
  assert.deepEqual(targetOf({ code: 'SNG-04', where: 'a', params: { song: 'A', line: 7 } }), { kind: 'song', id: 'a', line: 7 });
  assert.deepEqual(targetOf({ code: 'SNG-17', where: 'a', params: { song: 'A', what: ['size'] } }), { kind: 'song', id: 'a' });
  assert.deepEqual(targetOf({ code: 'SNG-01', where: 'a', params: { song: 'a' } }), { kind: 'song', id: 'a' });
});

test('EDT-41: SNG-10 leads to the list of its songs; a structure finding on a song folder to that song', () => {
  assert.deepEqual(targetOf({ code: 'SNG-10', where: 'a, b', params: { title: 'A', songs: ['a', 'b'] } }), { kind: 'songs', ids: ['a', 'b'], title: 'A' });
  assert.deepEqual(targetOf({ code: 'STR-05', where: 'songs/a' }), { kind: 'song', id: 'a' });
  assert.deepEqual(targetOf({ code: 'STR-08', where: 'songs/a/extra.txt' }), { kind: 'song', id: 'a' });
  assert.deepEqual(targetOf({ code: 'STR-01', where: 'README.txt' }), { kind: 'library', field: null });
});

test('EDT-41: a set finding leads to its set; a library finding to its field, or to the library', () => {
  assert.deepEqual(targetOf({ code: 'SET-03', severity: 'Warning', where: 'Demo' }), { kind: 'set', name: 'Demo' });
  assert.deepEqual(targetOf({ code: 'MAN-07', severity: 'Error' }), { kind: 'library', field: 'license' });
  assert.deepEqual(targetOf({ code: 'MAN-08', severity: 'Error' }), { kind: 'library', field: 'maintainer' });
  assert.deepEqual(targetOf({ code: 'MAN-02', detail: 'title is not 1–80 characters' }), { kind: 'library', field: 'title' });
  assert.deepEqual(targetOf({ code: 'STR-02', severity: 'Warning' }), { kind: 'library', field: null });
  assert.deepEqual(targetOf({ code: 'PKG-09', severity: 'Info' }), { kind: 'library', field: null });
  for (const field of ['title', 'description', 'license', 'summary', 'licenseText', 'maintainer']) assert.ok(LIBRARY_FIELD_ID[field], field);
});

test('EDT-41: every finding of the test libraries leads somewhere, and a song line it points at is in the song', async () => {
  const LIBS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'test-libraries');
  let findings = 0;
  let lines = 0;
  let same = 0;
  for (const name of readdirSync(LIBS).filter((n) => n.endsWith('.zbl')).sort()) {
    const bytes = new Uint8Array(readFileSync(join(LIBS, name)));
    const v = await validateLibrary(bytes);
    const r = await openLibrary(bytes).catch(() => ({}));
    for (const f of v.findings) {
      const target = targetOf(f);
      assert.ok(['song', 'songs', 'set', 'library'].includes(target.kind), `${name}: ${f.code}`);
      // a song it names is a song of the library, so *Ga naar* shows something (the owner's M5 review, F2)
      if (r.library && target.kind === 'songs') {
        assert.ok(target.ids.length > 1 && target.ids.every((id) => r.library.songs.has(id)), `${name}: ${f.code} ${target.ids}`);
        same += 1;
      }
      if (r.library && target.kind === 'song' && /^SNG-/.test(f.code)) assert.ok(r.library.songs.has(target.id), `${name}: ${f.code} ${target.id}`);
      findings += 1;
      if (target.line && r.library && typeof r.library.songs.get(target.id) === 'string') {
        const count = r.library.songs.get(target.id).split('\n').length - 1;
        assert.ok(target.line >= 1 && target.line <= count, `${name}: ${f.code} line ${target.line} of ${count}`);
        lines += 1;
      }
    }
  }
  assert.ok(findings > 50 && lines > 5 && same === 1, `${findings} findings, ${lines} with a line, ${same} SNG-10`);
});
