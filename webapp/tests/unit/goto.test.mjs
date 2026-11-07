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
  for (const name of readdirSync(LIBS).filter((n) => n.endsWith('.zbl')).sort()) {
    const bytes = new Uint8Array(readFileSync(join(LIBS, name)));
    const v = await validateLibrary(bytes);
    const r = await openLibrary(bytes).catch(() => ({}));
    for (const f of v.findings) {
      const target = targetOf(f);
      assert.ok(['song', 'set', 'library'].includes(target.kind), `${name}: ${f.code}`);
      findings += 1;
      if (target.line && r.library && typeof r.library.songs.get(target.id) === 'string') {
        const count = r.library.songs.get(target.id).split('\n').length - 1;
        assert.ok(target.line >= 1 && target.line <= count, `${name}: ${f.code} line ${target.line} of ${count}`);
        lines += 1;
      }
    }
  }
  assert.ok(findings > 50 && lines > 5, `${findings} findings, ${lines} with a line`);
});
