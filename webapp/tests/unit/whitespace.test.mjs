// SPDX-License-Identifier: Apache-2.0
// Whitespace as song format v0.24 defines it (5.2, 5.3; app proposal 2026-11-07-fds-0.8-readings, 3.4,
// approved by the owner): blank and directive lines, directive names and values, the meta split and
// setlist lines are trimmed of spaces and tabs only. A no-break space (U+00A0) or U+FEFF is content,
// never trimmed: JavaScript's trim() and \s would remove them, Kotlin's trim(' ', '\t') does not.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize, parseSong } from '../../src/core/chordpro.js';
import { openLibrary, saveLibrary } from '../../src/core/library.js';
import { writeZip } from '../../src/core/zip.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name) => new Uint8Array(readFileSync(join(HERE, '..', '..', '..', 'test-libraries', `${name}.zbl`)));
const NOW = new Date('2026-11-07T12:00:00Z');
const enc = new TextEncoder();
const song = (text) => parseSong(canonicalize(enc.encode(text)).text);
const NBSP = ' ';

// The app's conformance vectors comment-indented and nbsp-display (song format v0.25), with their
// expected canonical line lists and canonical SHA-256.
const VECTORS = [
  { name: 'comment-indented', text: '{title: Test}\n{meta: id comment-indented}\n{meta: language nl}\n# Een opmerking.\n  # tweede stem\nEen regel.\n',
    lines: ['  # tweede stem', 'Een regel.'], sha256: 'c2c3a052a3c4100c0fcc3ba16a76e26873fade87a0c57ea69e50757d2a11779c' },
  { name: 'nbsp-display', text: `{title: Test}\n{meta: id nbsp-display}\n{meta: language nl}\nEen regel.${NBSP}\n${NBSP}\nNog een regel.\n`,
    lines: ['Een regel.', 'Nog een regel.'], sha256: '3efed083b03ceee3aac4b87729abf02f03ff72e3222da53176beef7d4faa835e' },
];

for (const v of VECTORS) {
  test(`song format v0.25 vector ${v.name}: the app's line list and canonical hash`, () => {
    const c = canonicalize(enc.encode(v.text));
    assert.equal(c.text, v.text);                                // canonical_equals_input
    assert.equal(createHash('sha256').update(c.text, 'utf8').digest('hex'), v.sha256);
    assert.deepEqual(parseSong(c.text).lines, v.lines);
  });
}

test('9.1 (v0.25): the display text drops trailing Zs, Zl and Zp characters, keeps leading ones and tabs become spaces', () => {
  assert.deepEqual(song(`{title: A}\n${NBSP}la  \nb\t[G]　\n \n`).lines, [`${NBSP}la`, 'b']);
  assert.deepEqual(song('{title: A}\n\t# x\n#y\n').lines, [' # x']);      // an indented # is a lyric line (5.2); tab → space
});

test('5.3: directive names and values are trimmed of spaces and tabs, not of NBSP or U+FEFF', () => {
  const s = song(`{title: \t${NBSP}Vuur${NBSP} \t}\n{subtitle:﻿Nacht}\n{ key :G}\nla\n`);
  assert.deepEqual(s.meta.get('title'), [`${NBSP}Vuur${NBSP}`]);
  assert.deepEqual(s.meta.get('subtitle'), ['﻿Nacht']);
  assert.deepEqual(s.meta.get('key'), ['G']);
});

test('5.3: the meta split is at the first run of spaces or tabs, not at an NBSP', () => {
  const s = song(`{title: A}\n{meta: id \t vuur}\n{meta: tag${NBSP}kamp}\nla\n`);
  assert.deepEqual(s.meta.get('id'), ['vuur']);
  assert.equal(s.meta.has('tag'), false);                      // "tag kamp" is one (unknown) meta name
  assert.ok([...s.unknown].includes(`meta tag${NBSP}kamp`), JSON.stringify([...s.unknown]));
});

test('MAN-02: a set name with an NBSP at its end is a valid setlist title; one with a space is not', async () => {
  const { library } = await openLibrary(corpus('valid-unsigned'));
  library.sets[1].name = `Demo${NBSP}`;
  const saved = await saveLibrary(library, { changed: true, now: NOW });
  assert.equal(saved.refused, false, JSON.stringify(saved.findings));
  const again = await openLibrary(saved.bytes);
  assert.equal(again.library.sets[1].name, `Demo${NBSP}`);   // round trip through the view's setlist (PF-43)
  library.sets[1].name = 'Demo ';
  const refused = await saveLibrary(library, { changed: true, now: NOW });
  assert.equal(refused.refused, true);
  assert.ok(refused.findings.some((f) => f.code === 'MAN-02'));
});

test('EDT-26: setlist lines in a converted snapshot are trimmed of spaces and tabs only', async () => {
  const s = '{title: A}\n{meta: id a}\nla\n';
  const bytes = writeZip([
    { name: 'r/zangbundel.json', data: enc.encode(JSON.stringify({ id: 'r', name: 'R', license: { id: 'CC0-1.0', summary: 'Vrij.' } })) },
    { name: 'r/songs/nl/a.cho', data: enc.encode(s) },
    { name: 'r/setlists/k.zbs', data: enc.encode(`{title:\t${NBSP}Kamp }\n\t r/a \t# A\n?  ${NBSP}Iets\n`) },
  ], NOW);
  const { library, converted } = await openLibrary(bytes, { now: NOW });
  assert.deepEqual(library.sets, [{ name: `${NBSP}Kamp`, songs: ['a'] }]);
  assert.deepEqual(converted.unresolved.map((u) => u.entry), [`${NBSP}Iets`]);
});
