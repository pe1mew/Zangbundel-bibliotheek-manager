// SPDX-License-Identifier: Apache-2.0
// Unit tests of the song editor's logic (webapp/src/app/editor.js; webappGUI GD-07, GD-19, GD-33;
// implementationPlan M5.3a) and of applying a song in the session (session.js updateSong, with the real
// worker handler). The editor's screen is checked in the browser. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.document = { createElement: () => ({}), createElementNS: () => ({}), createTextNode: (s) => ({ text: s }) };
const { cleanTyped, linesOf, moveBlock, notLyricLines, partsOf, shownIndexes } = await import('../../src/app/editor.js');
const { createSession } = await import('../../src/app/session.js');
const { handleMessage } = await import('../../src/workers/library-handler.js');
const { File } = await import('node:buffer');

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name) => new Uint8Array(readFileSync(join(HERE, '..', '..', '..', 'test-libraries', `${name}.zbl`)));
const client = { async request(op, payload) { const a = await handleMessage(structuredClone({ id: 1, op, payload })); if (!a.ok) throw new Error(a.error); return structuredClone(a.result); } };
const NOW = new Date('2026-11-07T12:00:00Z');

test('GD-07: typed and pasted text keeps no braces or control characters; CR LF becomes LF', () => {
  assert.equal(cleanTyped('[G]la {c: x}\r\nli\u0007\tlo\u0085'), '[G]la c: x\nli\tlo');
  assert.deepEqual(notLyricLines('la\n#noot\n #ingesprongen\n#'), [2, 4]);   // only # in the first column (5.2)
});

test('GD-19: a section as editable runs of text around its locked lines, and back', () => {
  const lines = ['la', 'li', { locked: '{c: zachter}' }, '', 'lo', { locked: '# noot' }];
  const parts = partsOf(lines);
  assert.deepEqual(parts, [{ text: 'la\nli' }, { locked: '{c: zachter}' }, { text: '\nlo' }, { locked: '# noot' }]);
  assert.deepEqual(linesOf(parts), lines);
  assert.deepEqual(partsOf([{ locked: '{c: x}' }]), [{ locked: '{c: x}' }, { text: '' }]);   // always somewhere to type
  assert.deepEqual(partsOf([]), [{ text: '' }]);
});

test('GD-33: up and down move a block past the next shown block; metadata lines keep their place', () => {
  const form = { blocks: [{ type: 'meta', name: 'title' }, { type: 'section', kind: 'verse' }, { type: 'meta', name: 'tag' }, { type: 'repeat' }, { type: 'locked' }] };
  assert.deepEqual(shownIndexes(form), [1, 3, 4]);
  const down = moveBlock(form, 1, 1);
  assert.deepEqual(down.blocks.map((b) => b.type), ['meta', 'repeat', 'meta', 'section', 'locked']);
  assert.equal(moveBlock(form, 1, -1), form);                   // the first shown block cannot go up
  assert.equal(moveBlock(form, 4, 1), form);                    // nor the last down
});

test('GD-09, GD-20: an edited song is applied in the library, with its findings, and shows as it is now', async () => {
  const s = createSession({ client, now: () => NOW });
  await s.open(new File([corpus('valid-unsigned')], 'v.zbl'));
  const form = await s.songBlocks('vader-jacob');
  const section = form.blocks.find((b) => b.type === 'section');
  section.lines = [...section.lines, 'Een nieuwe regel'];
  const r = await s.unblocks(form);
  assert.equal(r.problem, undefined);
  assert.equal(await s.updateSong('vader-jacob', r.text), true);
  const st = s.get();
  assert.equal(st.dirty, true);
  assert.ok(st.library.songs.get('vader-jacob').includes('Een nieuwe regel'));
  const details = await s.songDetails('vader-jacob');
  assert.ok(details.sections.some((x) => x.lines.some((l) => l.segments && l.segments.map((g) => g.text).join('') === 'Een nieuwe regel')));
  section.lines = ['{c: nee}'];
  assert.match((await s.unblocks(form)).problem, /is a directive/);   // never half a song
  assert.equal(await s.updateSong('niet-er', 'x\n'), false);
});

test('EDT-23: a signed library without its key gives no blocks to apply', async () => {
  const s = createSession({ client, now: () => NOW });
  await s.open(new File([corpus('valid-signed')], 's.zbl'));
  const text = s.get().library.songs.get('vader-jacob');
  assert.equal(await s.updateSong('vader-jacob', `${text}la\n`), false);
  assert.equal(s.get().library.songs.get('vader-jacob'), text);
});

const { cleanCode, sameCode } = await import('../../src/app/editor.js');
const { validateLibrary } = await import('../../src/core/validate.js');
const { openLibrary } = await import('../../src/core/library.js');
const { readdirSync } = await import('node:fs');

test('GD-38: code compares without line-end spaces or blank lines at the end; typed code keeps braces, not control characters', () => {
  assert.ok(sameCode('{title: X}\nla  \n\n', '{title: X}\nla\n'));
  assert.ok(sameCode('a\r\nb', 'a\nb\n'));
  assert.ok(!sameCode('a\nb\n', 'a\n b\n'));
  assert.equal(cleanCode('{c: x}\r\n\tla\u0000\u001b'), '{c: x}\n\tla');
  assert.ok(sameCode(`${' '.repeat(60000)}x\n`, `${' '.repeat(60000)}x`));   // linear on a long run (SR-33)
});

test('EDT-33: the code mode checks a song by the rules Controle uses: the same findings for every song of the test libraries', async () => {
  const LIBS = join(HERE, '..', '..', '..', 'test-libraries');
  let songs = 0;
  for (const name of readdirSync(LIBS).filter((n) => n.endsWith('.zbl')).sort()) {
    const bytes = new Uint8Array(readFileSync(join(LIBS, name)));
    const r = await openLibrary(bytes);
    if (!r.library) continue;
    const all = (await validateLibrary(bytes)).findings;
    for (const [id, text] of r.library.songs) {
      if (text === null) continue;
      const fromCode = (await handleMessage({ id: 1, op: 'songCheck', payload: { id, text } })).result.findings;
      const fromLibrary = all.filter((f) => /^SNG-/.test(f.code) && f.where === id);
      assert.deepEqual(fromCode, fromLibrary, `${name}: ${id}`);
      songs += 1;
    }
  }
  assert.ok(songs >= 400, `only ${songs} songs`);
});

test('EDT-33, EDT-57: typed code is checked with its lines, and stored canonically', async () => {
  const typed = '{title: X}\r\n{meta: id x}\r\n{meta: language nl}\r\n{c: open\r\nla  \r\n\r\n\r\n';
  const { findings } = (await handleMessage({ id: 1, op: 'songCheck', payload: { id: 'x', text: typed } })).result;
  assert.deepEqual(findings.find((f) => f.code === 'SNG-04').params.line, 4);
  const { text } = (await handleMessage({ id: 2, op: 'canonical', payload: { text: typed } })).result;
  assert.equal(text, '{title: X}\n{meta: id x}\n{meta: language nl}\n{c: open\nla\n');
});

test('EDT-51: applying a song that did not change is no change to download', async () => {
  const s = createSession({ client, now: () => NOW });
  await s.open(new File([corpus('valid-unsigned')], 'v.zbl'));
  const text = s.get().library.songs.get('vader-jacob');
  const r = await s.unblocks(await s.songBlocks('vader-jacob'));
  assert.equal(r.text, text);
  assert.equal(await s.updateSong('vader-jacob', r.text), true);
  assert.equal(s.get().dirty, false);
  assert.equal((await s.preview()).changed, false);
});

const { moveToPosition } = await import('../../src/app/editor.js');

test('GD-08: a dragged block lands at its place among the shown blocks; metadata lines keep theirs', () => {
  const m1 = { type: 'meta', name: 'title' };
  const a = { type: 'section', kind: 'verse' };
  const m2 = { type: 'meta', name: 'tag' };
  const b = { type: 'section', kind: 'chorus' };
  const c = { type: 'repeat' };
  const form = { blocks: [m1, a, m2, b, c] };
  const order = (f) => f.blocks.map((x) => (x.type === 'meta' ? x.name : x.kind || x.type));
  assert.deepEqual(order(moveToPosition(form, c, 0)), ['title', 'repeat', 'verse', 'tag', 'chorus']);
  assert.deepEqual(order(moveToPosition(form, a, 2)), ['title', 'tag', 'chorus', 'repeat', 'verse']);   // after the last
  assert.deepEqual(order(moveToPosition(form, a, 1)), ['title', 'tag', 'chorus', 'verse', 'repeat']);
  assert.deepEqual(order(moveToPosition(form, b, 0)), ['title', 'chorus', 'verse', 'tag', 'repeat']);
  assert.equal(moveToPosition(form, a, 5), form);                                  // no such place
  assert.equal(moveToPosition(form, { type: 'section' }, 0), form);                // not in the song
  const one = { blocks: [m1, a] };
  assert.deepEqual(order(moveToPosition(one, a, 0)), ['title', 'verse']);
});

const { edgeSpeed } = await import('../../src/app/drag.js');

test('GD-11: within 72 px of an edge the song scrolls towards it, faster the closer; elsewhere it stands still', () => {
  const [top, bottom] = [100, 700];                                  // bottom: above the Toepassen bar
  assert.equal(edgeSpeed(400, top, bottom), 0);
  assert.equal(edgeSpeed(top + 72, top, bottom), 0);
  assert.equal(edgeSpeed(bottom - 72, top, bottom), 0);
  assert.equal(edgeSpeed(top + 36, top, bottom), -9);                 // half way: half speed
  assert.equal(edgeSpeed(top, top, bottom), -18);
  assert.equal(edgeSpeed(top - 50, top, bottom), -18);                // beyond the edge: no faster than the most
  assert.equal(edgeSpeed(bottom - 36, top, bottom), 9);
  assert.equal(edgeSpeed(bottom + 30, top, bottom), 18);
  assert.ok(edgeSpeed(bottom - 10, top, bottom) > edgeSpeed(bottom - 60, top, bottom));
});
