// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/core/chordpro.js against the song format (app repository
// design/song-format.md sections 5 to 9), including its worked example of section 9.3.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize, parseSong } from '../../src/core/chordpro.js';
import { readCentralDirectory, readEntry } from '../../src/core/zip.js';

const enc = new TextEncoder();
const song = (text) => parseSong(canonicalize(enc.encode(text)).text);

test('canonical form (8.1): BOM, CRLF and lone CR, trailing whitespace, NFD, final newlines', () => {
  const raw = '\ufeff{title: Cafe\u0301}  \r\nline one\t \rline two\n\n\n';
  assert.equal(canonicalize(enc.encode(raw)).text, '{title: Caf\u00e9}\nline one\nline two\n');
  assert.equal(canonicalize(enc.encode('')).text, '\n');
  assert.equal(canonicalize(new Uint8Array([0x66, 0xe8, 0x72, 0x65])).bytesOk, false);       // Latin-1, not UTF-8
  assert.equal(canonicalize(enc.encode('a\u0007b\n')).controlChars, true);
  assert.equal(canonicalize(enc.encode('a\tb\r\n')).controlChars, false);                    // tab, CR, LF allowed
});

test('the worked example of 9.3: vuur-in-de-nacht has 18 canonical lines, the chorus repeated', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const zbl = new Uint8Array(readFileSync(join(here, '..', '..', '..', 'test-libraries', 'valid-unsigned.zbl')));
  const entry = readCentralDirectory(zbl).find((e) => e.name.endsWith('/vuur-in-de-nacht.cho'));
  const { lines } = parseSong(canonicalize(readEntry(zbl, entry)).text);
  assert.equal(lines.length, 18);
  assert.equal(lines[0], 'De zon is weg, de lucht wordt grijs,');
  assert.deepEqual(lines.slice(14, 18), lines.slice(4, 8));                                  // 15–18 repeat 5–8
  assert.equal(lines[17], 'en de nacht zingt met ons mee.');
});

test('display text (9.1): chords and annotations removed, escapes resolved, chord-only lines dropped', () => {
  const { lines, problems } = song('{title: T}\n[G]De [D/F#]zon [*zachter]is weg\n[G] [C]\nshow \\[this\\] and \\x\n');
  assert.deepEqual(lines, ['De zon is weg', 'show [this] and \\x']);
  assert.equal(problems.bracket, false);
  assert.equal(problems.chordName, false);
});

test('SNG-05 and SNG-08 facts: unmatched bracket, unknown chord name', () => {
  assert.equal(song('[F]amet consec[Ctetur,\n').problems.bracket, true);
  assert.equal(song('a ] b\n').problems.bracket, true);
  assert.equal(song('[H]la\n').problems.chordName, true);
  assert.equal(song('[Bbmaj7/F]la\n').problems.chordName, false);
});

test('environments (7.1): unknown ones skipped; nesting, stray ends and open ends are errors', () => {
  assert.deepEqual(song('{start_of_tab}\ne|--0--|\n{end_of_tab}\n{start_of_foo}\nhidden\n{end_of_foo}\nshown\n').lines, ['shown']);
  assert.equal(song('{sov}\n{soc}\nx\n{eoc}\n{eov}\n').problems.envError, true);
  assert.equal(song('x\n{end_of_verse}\n').problems.envError, true);
  assert.equal(song('{start_of_verse}\nx\n').problems.envError, true);
  assert.equal(song('{sov}\nx\n{eov}\n{soc}\ny\n{eoc}\n').problems.envError, false);
});

test('chorus repeats (7.2): {chorus} before any chorus, and {chorus: label} picks that chorus', () => {
  assert.equal(song('{chorus}\nx\n').problems.chorusEarly, true);
  const s = song('{soc: A}\na\n{eoc}\n{soc: B}\nb\n{eoc}\n{chorus: A}\n{chorus}\n{chorus: none}\n');
  assert.deepEqual(s.lines, ['a', 'b', 'a', 'b', 'b']);
});

test('metadata (5.3, 6): meta split, aliases, case-insensitive names, unknown directives and meta names', () => {
  const s = song('{T: Titel}\n{meta: tag kamp vuur}\n{META: language nl}\n{x_zb_time: 1 0.0}\n{meta: mood happy}\n{new_page}\nx\n');
  assert.deepEqual(s.meta.get('title'), ['Titel']);
  assert.deepEqual(s.meta.get('tag'), ['kamp vuur']);
  assert.deepEqual(s.meta.get('language'), ['nl']);
  assert.deepEqual([...s.unknown].sort(), ['meta mood', 'x_zb_time']);                      // layout {new_page} is known
});

test('malformed directives (5.2) and {new_song}', () => {
  assert.equal(song('{comment: zachter\nx\n').problems.malformed, true);
  assert.equal(song('x}\n').problems.malformed, true);
  assert.equal(song('{ns}\nx\n').problems.newSong, true);
});
