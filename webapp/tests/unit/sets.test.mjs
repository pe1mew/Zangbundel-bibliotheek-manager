// SPDX-License-Identifier: Apache-2.0
// Unit tests of sets (webapp/src/app/sets.js and session.updateSets; webappGUI GD-21; FDS EDT-31,
// SET-01 to SET-05, PF-40; implementationPlan M5.5), with the real worker handler for the session.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { File } from 'node:buffer';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.document = { createElement: () => ({}), createElementNS: () => ({}), createTextNode: (s) => ({ text: s }) };
const { addEntry, addSet, cleanSetName, deleteSet, moveEntry, moveSet, removeEntry, renameSet, setNameProblem } = await import('../../src/app/sets.js');
const { createSession } = await import('../../src/app/session.js');
const { handleMessage } = await import('../../src/workers/library-handler.js');
const { validateLibrary } = await import('../../src/core/validate.js');
const { readCentralDirectory } = await import('../../src/core/zip.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name) => new Uint8Array(readFileSync(join(HERE, '..', '..', '..', 'test-libraries', `${name}.zbl`)));
const client = { async request(op, payload) { const a = await handleMessage(structuredClone({ id: 1, op, payload })); if (!a.ok) throw new Error(a.error); return structuredClone(a.result); } };
const NOW = new Date('2026-11-07T12:00:00Z');

const SETS = Object.freeze([{ name: 'Kampvuur', songs: ['a', 'b'] }, { name: 'Ochtend', songs: [] }]);

test('FDS 4.1, SET-02: a set name is 1 to 60 characters, fits a setlist title, and is unique without regard to case', () => {
  assert.equal(setNameProblem('  ', SETS), 'empty');
  assert.equal(setNameProblem('x'.repeat(61), SETS), 'long');
  assert.equal(setNameProblem('x'.repeat(60), SETS), null);
  assert.equal(setNameProblem('a { b', SETS), 'chars');
  assert.equal(setNameProblem('a\nb', SETS), 'chars');
  assert.equal(setNameProblem(' KAMPVUUR ', SETS), 'taken');
  assert.equal(setNameProblem('Kampvuur', SETS, 0), null);              // its own name, when renaming it
  assert.equal(cleanSetName('  Zomérkamp '), 'Zomérkamp');   // trimmed, NFC: e and a combining acute become é
});

test('EDT-31: adding, renaming, moving and deleting sets and their songs leaves the original lists untouched', () => {
  const before = JSON.stringify(SETS);
  assert.deepEqual(addSet(SETS, ' Avond ').map((s) => s.name), ['Kampvuur', 'Ochtend', 'Avond']);
  assert.deepEqual(renameSet(SETS, 1, 'Morgen')[1], { name: 'Morgen', songs: [] });
  assert.deepEqual(deleteSet(SETS, 0).map((s) => s.name), ['Ochtend']);
  assert.deepEqual(moveSet(SETS, 1, 0).map((s) => s.name), ['Ochtend', 'Kampvuur']);
  assert.deepEqual(addEntry(SETS, 1, 'a')[1].songs, ['a']);
  assert.equal(addEntry(SETS, 0, 'a')[0], SETS[0]);                     // SET-04: at most once
  assert.deepEqual(removeEntry(SETS, 0, 0)[0].songs, ['b']);
  assert.deepEqual(moveEntry(SETS, 0, 0, 1)[0].songs, ['b', 'a']);
  assert.equal(JSON.stringify(SETS), before);
});

test('EDT-31, PF-40: sets made in the session are saved in the manifest and as setlists of the view, without set errors', async () => {
  const s = createSession({ client, now: () => NOW });
  await s.open(new File([corpus('valid-unsigned')], 'v.zbl'));
  const songs = [...s.get().library.songs.keys()];
  let sets = addSet(s.get().library.sets, 'Zomerkamp');
  const i = sets.length - 1;
  sets = addEntry(addEntry(sets, i, songs[1]), i, songs[0]);
  assert.equal(await s.updateSets(sets), true);
  assert.equal(s.get().dirty, true);
  assert.deepEqual(s.get().library.sets[i], { name: 'Zomerkamp', songs: [songs[1], songs[0]] });
  assert.deepEqual(s.get().findings.filter((f) => /^SET-/.test(f.code)), []);
  await s.updateSets(addSet(s.get().library.sets, 'Leeg'));
  assert.ok(s.get().findings.some((f) => f.code === 'SET-03'));          // an empty set is a Warning (M-13)
  const saved = await s.save({ changed: true });
  const v = await validateLibrary(saved.bytes);
  assert.deepEqual(v.findings.filter((f) => /^(SET|VIEW|MAN-02)/.test(f.code)).map((f) => [f.code, f.where]), [['SET-03', 'Leeg']]);   // only the empty set's Warning
  const names = readCentralDirectory(saved.bytes).map((e) => e.name);
  assert.ok(names.some((n) => n.endsWith(`setlists/set-${i + 1}.zbs`)), names.join(', '));
  const reopened = createSession({ client, now: () => NOW });
  await reopened.open(new File([saved.bytes], 'v2.zbl'));
  assert.deepEqual(reopened.get().library.sets.map((x) => x.name).slice(-2), ['Zomerkamp', 'Leeg']);
});

test('EDT-23: a signed library without its key keeps its sets; a malformed list is refused', async () => {
  const s = createSession({ client, now: () => NOW });
  await s.open(new File([corpus('valid-signed')], 's.zbl'));
  assert.equal(await s.updateSets([]), false);
  const t = createSession({ client, now: () => NOW });
  await t.open(new File([corpus('valid-unsigned')], 'v.zbl'));
  assert.equal(await t.updateSets([{ name: 'x', songs: [1] }]), false);
  assert.equal(await t.updateSets('x'), false);
  assert.equal(t.get().dirty, false);
});
