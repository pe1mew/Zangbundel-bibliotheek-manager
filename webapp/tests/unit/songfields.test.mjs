// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/app/songfields.js, the song's fields in the left bar while editing
// (webappGUI GD-05; FDS EDT-34; implementationPlan M5.3c), with a stand-in document as in
// library-form.test.mjs; what the fields write is checked as the song's code (blocks.js fromBlocks).
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tag) {
    Object.assign(this, { tag, attrs: {}, children: [], listeners: {}, classes: new Set(), hidden: false, focused: false, value: '' });
    this.classList = { toggle: (c, on) => (on ? this.classes.add(c) : this.classes.delete(c)) };
  }
  setAttribute(n, v) {
    this.attrs[n] = v;
    if (n === 'value') this.value = v;
    if (n === 'class') v.split(' ').forEach((c) => this.classes.add(c));
  }
  removeAttribute(n) { delete this.attrs[n]; }
  append(...c) {
    this.children.push(...c);
    if (this.tag === 'select') {
      const chosen = c.find((o) => o && o.attrs && 'selected' in o.attrs);
      if (chosen) this.value = chosen.attrs.value;
    }
  }
  replaceChildren(...c) { this.children = c; }
  addEventListener(t, f) { this.listeners[t] = f; }
  focus() { this.focused = true; }
}
globalThis.document = { createElement: (t) => new FakeNode(t), createElementNS: (ns, t) => new FakeNode(t), createTextNode: (s) => ({ text: s }) };
const { createSongFields, fieldProblem, splitNames, splitTags } = await import('../../src/app/songfields.js');
const { fromBlocks, toBlocks } = await import('../../src/core/blocks.js');

function* walk(n) {
  yield n;
  for (const c of n.children || []) if (c && typeof c === 'object' && 'tag' in c) yield* walk(c);
}
const byId = (root, id) => [...walk(root)].find((n) => n.attrs.id === id);
const boxOf = (root, id) => [...walk(root)].find((n) => n.classes.has('field') && n.children.some((c) => c.attrs && (c.attrs.id === id || (c.children || []).some((d) => d.attrs && d.attrs.id === id))));

const SONG = '{title: Vader Jacob}\n{meta: id vader-jacob}\n{meta: language nl}\n{lyricist: Iemand}\n{lyricist: Ander}\n\nVader Jacob\n';

test('GD-05: several names are split at ;, tags at commas, each tag once', () => {
  assert.deepEqual(splitNames(' Iemand ; Ander;; '), ['Iemand', 'Ander']);
  assert.deepEqual(splitTags('kampvuur, welpen,,kampvuur '), ['kampvuur', 'welpen']);
});

test('SNG-02, SNG-11, SNG-15: the fields mark what the song rules will report', () => {
  assert.equal(fieldProblem('nl', 'title', []), 'Een lied heeft een titel.');
  assert.equal(fieldProblem('nl', 'language', []), 'Kies de taal van het eerste couplet');
  assert.equal(fieldProblem('nl', 'language', ['nederlands']), 'Geen geldige taalcode, zoals nl of en-GB.');
  assert.equal(fieldProblem('nl', 'language', ['nl-BE']), null);
  assert.equal(fieldProblem('nl', 'tag', ['kampvuur', 'Kamp Vuur']), 'Een tag bestaat uit kleine letters, cijfers en streepjes: Kamp Vuur');
  assert.equal(fieldProblem('nl', 'copyright', []), null);
});

test('EDT-34, GD-05: each field reads and writes its directive in the song; the song ID is only shown', () => {
  let form = toBlocks(SONG);
  const fields = createSongFields({ lang: 'nl', id: 'vader-jacob', getForm: () => form, setForm: (f) => { form = f; } });
  assert.equal(byId(fields.node, 'song-title').value, 'Vader Jacob');
  assert.equal(byId(fields.node, 'song-lyricist').value, 'Iemand; Ander');
  assert.equal(byId(fields.node, 'song-language').value, 'nl');
  assert.ok(!byId(fields.node, 'song-id'));                                   // not a field: shown as text
  const change = (id, value) => { const n = byId(fields.node, id); n.value = value; n.listeners.change(); };
  change('song-title', 'Vader Jacob (canon)');
  change('song-lyricist', 'traditioneel');
  change('song-copyright', 'Public domain');
  change('song-tag', 'canon, welpen');
  change('song-language', 'en');
  assert.equal(fromBlocks(form),
    '{title: Vader Jacob (canon)}\n{meta: id vader-jacob}\n{meta: language en}\n{lyricist: traditioneel}\n{copyright: Public domain}\n{meta: tag canon}\n{meta: tag welpen}\n\nVader Jacob\n');
  change('song-copyright', '');                                              // empty: the directive goes
  assert.ok(!fromBlocks(form).includes('copyright'));
});

test('GD-05: another language code, and marks that come and go', () => {
  let form = toBlocks('{title: Lorem}\n{meta: id lorem}\n{meta: language la}\n\nLorem ipsum\n');
  const fields = createSongFields({ lang: 'nl', id: 'lorem', getForm: () => form, setForm: (f) => { form = f; } });
  const select = byId(fields.node, 'song-language');
  assert.equal(select.value, 'la');                                           // a song's own language joins the list
  select.value = 'other';
  select.listeners.change();
  const code = byId(fields.node, 'song-language-code');
  assert.ok(code.focused && !code.hidden);
  code.value = 'it';
  code.listeners.change();
  assert.ok(fromBlocks(form).includes('{meta: language it}'));
  const tag = byId(fields.node, 'song-tag');
  tag.value = 'Kamp Vuur';
  tag.listeners.change();
  assert.ok(boxOf(fields.node, 'song-tag').classes.has('invalid'));
  tag.value = 'kampvuur';
  tag.listeners.change();
  assert.ok(!boxOf(fields.node, 'song-tag').classes.has('invalid'));
  const title = byId(fields.node, 'song-title');
  title.value = '{gevaarlijk}';
  title.listeners.input();
  assert.equal(title.value, 'gevaarlijk');                                    // braces never reach a directive
});
