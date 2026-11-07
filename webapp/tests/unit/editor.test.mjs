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
