// SPDX-License-Identifier: Apache-2.0
// Unit tests of adding and importing songs (implementationPlan M5.3d; FDS EDT-32, EDT-36, PF-14;
// song format 3.2): names.js proposeSongId, the worker's adoptSong and importSong, and session.addSong
// with the real handler. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { File } from 'node:buffer';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSongId, proposeSongId } from '../../src/core/names.js';
import { adoptSong, handleMessage, importSong } from '../../src/workers/library-handler.js';
import { createSession } from '../../src/app/session.js';
import { setMeta } from '../../src/core/blockmeta.js';
import { validateLibrary } from '../../src/core/validate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name) => new Uint8Array(readFileSync(join(HERE, '..', '..', '..', 'test-libraries', `${name}.zbl`)));
const client = { async request(op, payload) { const a = await handleMessage(structuredClone({ id: 1, op, payload })); if (!a.ok) throw new Error(a.error); return structuredClone(a.result); } };
const NOW = new Date('2026-11-07T12:00:00Z');
const enc = (s) => new TextEncoder().encode(s);

test('EDT-36, song format 3.2: the ID is proposed from the title, unique with a number, at most 64 characters', () => {
  assert.equal(proposeSongId('Zeg ken jij de mosselman?'), 'zeg-ken-jij-de-mosselman');   // the format's own example
  assert.equal(proposeSongId('Één, twee — drie!'), 'een-twee-drie');
  assert.equal(proposeSongId('  '), 'lied');
  assert.equal(proposeSongId('Ωμέγα'), 'lied');                                  // nothing of a-z0-9 to keep
  assert.equal(proposeSongId('Vader Jacob', ['vader-jacob']), 'vader-jacob-2');
  assert.equal(proposeSongId('Vader Jacob', ['vader-jacob', 'vader-jacob-2']), 'vader-jacob-3');
  assert.equal(proposeSongId(`${'a'.repeat(62)} bc`), `${'a'.repeat(62)}-b`);     // cut at 64
  assert.equal(proposeSongId(`${'a'.repeat(63)} bc`), 'a'.repeat(63));            // cut at 64 after a hyphen: no hyphen at the end
  const taken = proposeSongId(`${'a'.repeat(63)} bc`, ['a'.repeat(63)]);
  assert.ok(isSongId(taken) && taken.length <= 64 && taken.endsWith('-2'), taken);
});

test('EDT-36: a new song gets its ID and {meta: id}; a free valid ID of its own is kept, a taken one replaced', () => {
  const plain = adoptSong('{title: Kampvuurlied}\n{meta: language nl}\n\nla\n', ['vader-jacob']);
  assert.deepEqual(plain, { id: 'kampvuurlied', text: '{title: Kampvuurlied}\n{meta: language nl}\n{meta: id kampvuurlied}\n\nla\n' });
  const own = adoptSong('{title: X}\n{meta: id mijn-lied}\nla\n', []);
  assert.deepEqual(own, { id: 'mijn-lied', text: '{title: X}\n{meta: id mijn-lied}\nla\n' });
  const clash = adoptSong('{title: Vader Jacob}\n{meta: id vader-jacob}\nla\n', ['vader-jacob']);
  assert.deepEqual(clash, { id: 'vader-jacob-2', text: '{title: Vader Jacob}\n{meta: id vader-jacob-2}\nla\n' });
  const twice = adoptSong('{title: Y}\n{meta: id a}\n{meta: id b}\nla\n', []);
  assert.equal(twice.text, '{title: Y}\n{meta: id y}\nla\n');                    // two IDs: one, from the title
  assert.equal(adoptSong('{title: Z}  \r\nla\t\r\n\r\n', []).text, '{title: Z}\n{meta: id z}\nla\n');   // canonical
});

test('EDT-32: an imported .cho must be text of at most 64 KiB', () => {
  assert.equal(importSong(new Uint8Array(64 * 1024 + 1), [], 'groot.cho').problem.code, 'SNG-18');
  assert.deepEqual(importSong(Uint8Array.of(0xff, 0xfe), [], 'kapot.cho').problem, { code: 'SNG-01', severity: 'Error', params: { song: 'kapot' } });
  assert.equal(importSong(enc('{title: A}\nla\u0007\n'), [], 'a.cho').problem.code, 'SNG-01');
  assert.deepEqual(importSong(enc('﻿{title: Uit een bestand}\r\nla\r\n'), [], 'x.cho'),
    { id: 'uit-een-bestand', text: '{title: Uit een bestand}\n{meta: id uit-een-bestand}\nla\n' });
});

test('EDT-32: a new song from an empty verse to a saved library, with a unique ID and no song errors', async () => {
  const s = createSession({ client, now: () => NOW });
  await s.open(new File([corpus('valid-unsigned')], 'v.zbl'));
  let form = { blocks: [{ type: 'section', kind: 'verse', label: null, lines: ['[G]Vader Jacob, [D]nieuw'], implicit: false }] };
  form = setMeta(form, 'title', ['Vader Jacob']);                                // the title of a song already there
  form = setMeta(form, 'language', ['nl']);
  const { text } = await s.unblocks(form);
  const added = await s.adoptSong(text);
  assert.equal(added.id, 'vader-jacob-2');
  assert.equal(await s.addSong(added.id, added.text), true);
  assert.equal(await s.addSong(added.id, added.text), false);                    // the ID is taken now
  assert.equal(s.get().dirty, true);
  assert.ok(s.get().songs.some((x) => x.id === 'vader-jacob-2' && x.title === 'Vader Jacob'));
  const saved = await s.save({ changed: true });
  const v = await validateLibrary(saved.bytes);
  assert.deepEqual(v.findings.filter((f) => f.where === 'vader-jacob-2' && f.severity === 'Error'), []);
  const imported = await s.importSong(new File([enc('{title: Uit een bestand}\n{meta: language nl}\nla\n')], 'x.cho'));
  assert.equal(await s.addSong(imported.id, imported.text), true);
  assert.equal((await s.importSong({ name: 'groot.cho', size: 70000, arrayBuffer: () => { throw new Error('not read'); } })).problem.code, 'SNG-18');
});

test('EDT-23: a signed library without its key gets no new songs', async () => {
  const s = createSession({ client, now: () => NOW });
  await s.open(new File([corpus('valid-signed')], 's.zbl'));
  assert.equal(await s.addSong('nieuw', '{title: Nieuw}\n{meta: id nieuw}\nla\n'), false);
});
