// SPDX-License-Identifier: Apache-2.0
// GitHub issue #5 (webappGUI GD-47; FDS EDT-36, D-48): until the library is first saved with a song, an ID the
// Editor proposed can be made again from the title (*Maak uit titel*); sets that name the song follow. Tests the
// worker's setSongId, the session's updateSong with a new ID, and the button in the song fields on a small
// fake DOM. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { File } from 'node:buffer';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleMessage, setSongId } from '../../src/workers/library-handler.js';
import { createSession } from '../../src/app/session.js';
import { proposeSongId } from '../../src/core/names.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name) => new Uint8Array(readFileSync(join(HERE, '..', '..', '..', 'test-libraries', `${name}.zbl`)));
const client = { async request(op, payload) { const a = await handleMessage(structuredClone({ id: 1, op, payload })); if (!a.ok) throw new Error(a.error); return structuredClone(a.result); } };
const NOW = new Date('2026-11-16T12:00:00Z');

test('D-48: setSongId rewrites the song\'s one {meta: id}; a name that is no song ID is refused', () => {
  assert.deepEqual(setSongId('{title: Kampvuurlied}\n{meta: id lied}\nla\n', 'kampvuurlied'),
    { text: '{title: Kampvuurlied}\n{meta: id kampvuurlied}\nla\n' });
  assert.ok(setSongId('{title: X}\nla\n', 'Geen ID').problem);
});

async function withImported() {
  const s = createSession({ client, now: () => NOW });
  await s.open(new File([corpus('valid-unsigned')], 'v.zbl'));
  const saved = [...s.get().library.songs.keys()];
  assert.ok(saved.every((id) => !s.canRemakeId(id)));             // in a saved library: fixed (EDT-36)
  // EDT-32: a .cho without a title is imported as "lied", the reviewer's case of issue #5
  const r = await s.importSong(new File([new TextEncoder().encode('{meta: language nl}\nla la la\n')], 'zonder-titel.cho'));
  assert.deepEqual([r.id, r.proposed], ['lied', true]);
  assert.ok(await s.addSong(r.id, r.text, r.proposed));
  assert.ok(s.canRemakeId('lied'));
  const sets = s.get().library.sets;
  assert.ok(sets.length > 0, 'the test library has a set');
  assert.ok(await s.updateSets([{ ...sets[0], songs: [...sets[0].songs, 'lied'] }, ...sets.slice(1)]));
  return { s, saved };
}

test('GD-47: Toepassen with a new ID renames the song in place, in its {meta: id} and in its sets', async () => {
  const { s } = await withImported();
  const order = [...s.get().library.songs.keys()];
  const text = '{title: Kampvuurlied}\n{meta: language nl}\n{meta: id lied}\nla la la\n';
  const id = proposeSongId('Kampvuurlied', order.filter((k) => k !== 'lied'));
  assert.ok(await s.updateSong('lied', text, id));
  const lib = s.get().library;
  assert.deepEqual([...lib.songs.keys()], order.map((k) => (k === 'lied' ? 'kampvuurlied' : k)));
  assert.match(lib.songs.get('kampvuurlied'), /^\{meta: id kampvuurlied\}$/m);
  assert.ok(lib.sets[0].songs.includes('kampvuurlied') && !lib.sets.some((x) => x.songs.includes('lied')));
  assert.deepEqual(s.get().proposed, ['kampvuurlied']);
  assert.equal(s.get().dirty, true);
  assert.ok(!(s.get().findings || []).some((f) => f.code === 'SNG-12' || f.code.startsWith('SET-')), JSON.stringify(s.get().findings));
});

test('GD-47: no new ID for a saved song, to a taken ID or to one that is not an ID; a save fixes them all', async () => {
  const { s, saved } = await withImported();
  const before = s.get().library;
  const old = saved[0];
  assert.equal(await s.updateSong(old, before.songs.get(old), 'iets-anders'), false);        // EDT-36: saved with the library
  assert.equal(await s.updateSong('lied', before.songs.get('lied'), old), false);              // taken
  assert.equal(await s.updateSong('lied', before.songs.get('lied'), 'Geen ID'), false);
  assert.equal(s.get().library, before);
  assert.ok(await s.updateSong('lied', '{title: Lied}\n{meta: language nl}\n{meta: id lied}\nla la la\n'));   // SNG-02: a title before saving
  const r = await s.save({ changed: true });
  assert.ok(r.ok, JSON.stringify(r.findings));
  assert.deepEqual(s.get().proposed, []);
  assert.equal(s.canRemakeId('lied'), false);
});

// ---- the button in the song fields (songfields.js), on a fake DOM
class FakeNode {
  constructor(tag) {
    Object.assign(this, { tag, attrs: {}, children: [], listeners: {}, hidden: false, value: '', focused: false });
    this.classList = { toggle() {}, add() {}, remove() {}, contains: () => false };
  }
  setAttribute(n, v) { this.attrs[n] = v; if (n === 'value') this.value = v; }
  removeAttribute(n) { delete this.attrs[n]; }
  append(...c) { this.children.push(...c); }
  replaceChildren(...c) { this.children = c; }
  addEventListener(t, f) { this.listeners[t] = f; }
  focus() { this.focused = true; }
  get textContent() { return this.children.map((c) => (typeof c === 'string' ? c : (c && (c.text !== undefined ? c.text : c.textContent)) || '')).join(''); }
}

test('GD-47: Maak uit titel makes the ID from the title, says when it is the same, and asks for a title first', async () => {
  globalThis.document = { createElement: (t) => new FakeNode(t), createElementNS: (ns, t) => new FakeNode(t), createTextNode: (s) => ({ text: s }) };
  const { createSongFields } = await import('../../src/app/songfields.js');
  const { setMeta } = await import('../../src/core/blockmeta.js');
  function* walk(n) { yield n; for (const c of n.children || []) if (c && typeof c === 'object' && 'tag' in c) yield* walk(c); }
  let form = { blocks: [{ type: 'section', kind: 'verse', label: null, lines: ['la'], implicit: false }] };
  let pending = null;
  const open = (remake) => createSongFields({ lang: 'nl', id: 'lied', getForm: () => form, setForm: (f) => { form = f; },
    idRemake: remake ? { pending: () => pending, set: (v) => { pending = v; }, propose: (title) => proposeSongId(title, ['vader-jacob']) } : null });
  const button = (node) => [...walk(node)].find((n) => n.tag === 'button' && n.attrs.class === 'btn btn-text idbtn');
  const idText = (node) => [...walk(node)].find((n) => n.attrs.class === 'value fp').textContent;
  const note = (node) => [...walk(node)].find((n) => n.attrs.role === 'status').textContent;

  assert.equal(button(open(false)), undefined);                    // not offered: the ID is fixed
  const node = open(true).node;
  const title = [...walk(node)].find((n) => n.attrs.id === 'song-title');
  button(node).listeners.click();                                   // no title yet
  assert.equal(note(node), 'Vul eerst een titel in.');
  assert.equal(title.focused, true);
  assert.equal(pending, null);
  form = setMeta(form, 'title', ['Vader Jacob']);
  button(node).listeners.click();
  assert.equal(pending, 'vader-jacob-2');                           // unique against the other songs
  assert.equal(idText(node), 'vader-jacob-2');
  assert.match(note(node), /nu nog lied/);
  button(node).listeners.click();
  assert.equal(note(node), 'De lied-ID past al bij de titel.');
  form = setMeta(form, 'title', ['Lied']);
  button(node).listeners.click();                                   // back to its own ID: nothing to apply
  assert.equal(pending, null);
  assert.equal(idText(node), 'lied');
});
