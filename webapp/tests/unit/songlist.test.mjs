// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/app/songlist.js (webappGUI GD-13, GD-16, GD-25; implementationPlan M5.1):
// the filter as the app's songbook (app SongbookFilter.kt), and the list with a stand-in document.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tag, ns) {
    Object.assign(this, { tag, ns, attrs: {}, children: [], listeners: {}, hidden: false, value: '', checked: false });
  }
  setAttribute(n, v) { this.attrs[n] = v; }
  append(...c) { this.children.push(...c); }
  replaceChildren(...c) { this.children = c; }
  addEventListener(t, f) { this.listeners[t] = f; }
}
globalThis.document = { createElement: (t) => new FakeNode(t), createElementNS: (ns, t) => new FakeNode(t, ns), createTextNode: (s) => ({ text: s }) };
const { chipsOf, createSongList, DEFAULT_FILTER, filterSongs, fold, isDefaultFilter, neighbourAfterDelete } = await import('../../src/app/songlist.js');

const S = (id, title, extra = {}) => ({ id, title, sortTitle: null, language: 'nl', lyricist: null, tags: [], words: '', ...extra });
const SONGS = [
  S('vader-jacob', 'Vader Jacob', { tags: ['canon', 'welpen'], words: 'Vader Jacob, slaapt gij nog' }),
  S('een-twee', 'Één, twee, drie', { tags: ['welpen'], words: 'tellen tot drie' }),
  S('the-song', 'The Mock Song', { sortTitle: 'Mock Song, The', language: 'en', words: 'one two three' }),
  S('vuur', 'Vuur in de kring', { tags: ['kampvuur'], words: 'het vuur brandt' }),
];
const f = (over) => ({ ...DEFAULT_FILTER, languages: [], tags: [], ...over });
const ids = (list) => list.map((s) => s.id);

test('GD-13: fold drops case and accents, as the app (Één finds een)', () => {
  assert.equal(fold(' Één '), 'een');
  assert.equal(fold('Ça Été'), 'ca ete');
});

test('GD-13: every typed word in the title; Ook in de tekst looks in the words instead', () => {
  assert.deepEqual(ids(filterSongs(SONGS, f({ query: 'een' }), 'nl')), ['een-twee']);
  assert.deepEqual(ids(filterSongs(SONGS, f({ query: 'vader   JACOB' }), 'nl')), ['vader-jacob']);
  assert.deepEqual(ids(filterSongs(SONGS, f({ query: 'vader kring' }), 'nl')), []);
  assert.deepEqual(ids(filterSongs(SONGS, f({ query: 'drie' }), 'nl')), ['een-twee']);            // in the title
  assert.deepEqual(ids(filterSongs(SONGS, f({ query: 'three', inText: true }), 'nl')), ['the-song']);
  assert.deepEqual(ids(filterSongs(SONGS, f({ query: 'vader', inText: true }), 'nl')), ['vader-jacob']);
  assert.deepEqual(ids(filterSongs(SONGS, f({ query: 'kring', inText: true }), 'nl')), []);   // instead of, not also
});

test('GD-13: sorted by sort title or title without case or accents; Z–A reverses', () => {
  assert.deepEqual(ids(filterSongs(SONGS, f(), 'nl')), ['een-twee', 'the-song', 'vader-jacob', 'vuur']);   // "Mock Song, The"
  assert.deepEqual(ids(filterSongs(SONGS, f({ descending: true }), 'nl')), ['vuur', 'vader-jacob', 'the-song', 'een-twee']);
  const same = [S('b', 'Lied'), S('a', 'lied')];
  assert.deepEqual(ids(filterSongs(same, f(), 'nl')), ['a', 'b']);                                  // stable by ID
});

test('GD-13: chips: any chosen value within a group, all groups together; languages only when more than one', () => {
  assert.deepEqual(chipsOf(SONGS, 'nl'), { languages: ['en', 'nl'], tags: ['canon', 'kampvuur', 'welpen'] });
  assert.deepEqual(chipsOf(SONGS.filter((s) => s.language === 'nl'), 'nl').languages, []);
  assert.deepEqual(ids(filterSongs(SONGS, f({ tags: ['canon', 'kampvuur'] }), 'nl')), ['vader-jacob', 'vuur']);
  assert.deepEqual(ids(filterSongs(SONGS, f({ tags: ['welpen'], languages: ['nl'] }), 'nl')), ['een-twee', 'vader-jacob']);
  assert.deepEqual(ids(filterSongs(SONGS, f({ tags: ['welpen'], languages: ['en'] }), 'nl')), []);
});

test('GD-13: Wis filters shows only when something differs from the default', () => {
  assert.equal(isDefaultFilter(f()), true);
  assert.equal(isDefaultFilter(f({ query: '  ' })), true);
  for (const over of [{ query: 'x' }, { inText: true }, { descending: true }, { tags: ['a'] }, { languages: ['nl'] }]) {
    assert.equal(isDefaultFilter(f(over)), false, JSON.stringify(over));
  }
});

test('GD-16: after deleting, the next song in the list is selected, else the one before, else none', () => {
  assert.equal(neighbourAfterDelete(['a', 'b', 'c'], 'b'), 'c');
  assert.equal(neighbourAfterDelete(['a', 'b', 'c'], 'c'), 'b');
  assert.equal(neighbourAfterDelete(['a'], 'a'), null);
  assert.equal(neighbourAfterDelete(['a'], 'x'), null);
});

function* walk(n) {
  yield n;
  for (const c of n.children || []) if (c && typeof c === 'object' && 'tag' in c) yield* walk(c);
}
const rows = (list) => [...walk(list.node)].filter((n) => n.tag === 'li' && n.attrs['data-song']);
const text = (n) => [...walk(n)].flatMap((x) => x.children).map((c) => (typeof c === 'string' ? c : c && c.text) || '').join('');

test('GD-13, GD-16: the list follows the typing, marks the selected song and a song\'s worst finding, and deletes by the bin', () => {
  const events = [];
  const list = createSongList({ lang: 'nl', readOnly: false, onSelect: (id) => events.push(['select', id]), onDelete: (id, title) => events.push(['delete', id, title]) });
  const findings = [{ code: 'SNG-07', severity: 'Info', where: 'vuur' }, { code: 'SNG-16', severity: 'Warning', where: 'vuur' }];
  list.update({ songs: SONGS, findings }, 'vader-jacob');
  assert.deepEqual(rows(list).map((r) => r.attrs['data-song']), ['een-twee', 'the-song', 'vader-jacob', 'vuur']);
  const selected = rows(list).find((r) => r.attrs['aria-current'] === 'true');
  assert.equal(selected.attrs['data-song'], 'vader-jacob');
  const vuur = rows(list).find((r) => r.attrs['data-song'] === 'vuur');
  assert.ok([...walk(vuur)].some((n) => n.attrs.class === 'sev sev-warning'));     // the worst: the Warning, not the Info
  vuur.listeners.click();
  const [edit, bin] = [...walk(vuur)].filter((n) => n.tag === 'button');
  assert.ok('disabled' in edit.attrs && /Komt in een volgende testversie/.test(edit.attrs.title));   // M5.3
  let stopped = false;
  bin.listeners.click({ stopPropagation: () => { stopped = true; } });
  assert.ok(stopped);
  assert.deepEqual(events, [['select', 'vuur'], ['delete', 'vuur', 'Vuur in de kring']]);
  const search = [...walk(list.node)].find((n) => n.attrs.type === 'search');
  search.value = 'vader';
  search.listeners.input();
  assert.deepEqual(list.visibleIds(), ['vader-jacob']);
  assert.match(text(list.node), /Wis filters/);
  search.value = 'zzz';
  search.listeners.input();
  assert.match(text(list.node), /Geen liederen gevonden\./);
});

test('GD-25: reveal clears a filter that hides a song; a visible song needs nothing', () => {
  const list = createSongList({ lang: 'nl', readOnly: false, onSelect() {}, onDelete() {} });
  list.update({ songs: SONGS, findings: [] }, null);
  assert.equal(list.reveal('vuur'), false);
  const search = [...walk(list.node)].find((n) => n.attrs.type === 'search');
  search.value = 'vader';
  search.listeners.input();
  assert.equal(list.reveal('vuur'), true);
  assert.equal(isDefaultFilter(list.filter()), true);
  assert.equal(search.value, '');
  assert.ok(list.visibleIds().includes('vuur'));
});

test('EDT-23: a read-only list deletes nothing; an empty library says so instead of a list', () => {
  const list = createSongList({ lang: 'nl', readOnly: true, onSelect() {}, onDelete() { throw new Error('no delete'); } });
  list.update({ songs: SONGS, findings: [] }, null);
  const bins = [...walk(list.node)].filter((n) => n.attrs.class === 'iconbtn binbtn');
  assert.equal(bins.length, 4);
  assert.ok(bins.every((b) => 'disabled' in b.attrs && !b.listeners.click));
  const empty = createSongList({ lang: 'nl', readOnly: false, onSelect() {}, onDelete() {} });
  empty.update({ songs: [], findings: [] }, null);
  const tools = [...walk(empty.node)].find((n) => n.attrs.class === 'sbtools');
  assert.equal(tools.hidden, true);
  assert.match(text(empty.node), /Deze bibliotheek heeft nog geen liedjes\./);
});
