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
const { createSongFields, fieldAdvice, fieldProblem, splitNames, splitTags } = await import('../../src/app/songfields.js');
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

test('GD-44 (F8): every field in the editor has its explanation, closed until its button is used', () => {
  let form = toBlocks(SONG);
  const fields = createSongFields({ lang: 'en', id: 'vader-jacob', getForm: () => form, setForm: (f) => { form = f; } });
  const buttons = [...walk(fields.node)].filter((n) => n.attrs.class === 'helpbtn');
  assert.deepEqual(buttons.map((b) => b.attrs['aria-controls']),
    ['help-title', 'help-language', 'help-lyricist', 'help-composer', 'help-copyright', 'help-license', 'help-source', 'help-tag', 'help-id']);
  const panel = byId(fields.node, 'help-language');
  assert.equal(panel.attrs.hidden, '');
  assert.match(panel.children[0].text, /Other language code/);       // names the list's own choice
  buttons[1].listeners.click();
  assert.equal(panel.hidden, false);
  buttons[1].listeners.click();
  assert.equal(panel.hidden, true);
});

test('GD-44 (M7.3): each field refers to its explanation, so a screen reader reads it when the field gets the focus', () => {
  let form = toBlocks(SONG);
  const fields = createSongFields({ lang: 'en', id: 'vader-jacob', getForm: () => form, setForm: (f) => { form = f; } });
  const refs = Object.fromEntries([...walk(fields.node)].filter((n) => ['input', 'select'].includes(n.tag) && n.attrs.id)
    .map((n) => [n.attrs.id, n.attrs['aria-describedby']]));
  assert.deepEqual(refs, { 'song-title': 'help-title', 'song-language': 'help-language', 'song-language-code': 'help-language',
    'song-lyricist': 'help-lyricist', 'song-composer': 'help-composer', 'song-copyright': 'help-copyright', 'song-license': 'help-license',
    'song-source': 'help-source', 'song-tag': 'help-tag' });
});

test('SNG-16 (the owner\u2019s look at dev.6): every empty recommended field is advised at once; words or music together', () => {
  const values = (m) => (name) => m[name] || [];
  assert.equal(fieldAdvice('nl', 'lyricist', values({})), fieldAdvice('nl', 'composer', values({})));
  assert.match(fieldAdvice('nl', 'composer', values({})), /tekst of muziek/);
  assert.equal(fieldAdvice('nl', 'composer', values({ lyricist: ['onbekend'] })), null);      // one of the two is enough
  assert.match(fieldAdvice('nl', 'license', values({ license: ['CC BY'] })), /SPDX/);
  assert.equal(fieldAdvice('nl', 'license', values({ license: ['CC0-1.0'] })), null);
  for (const name of ['copyright', 'source', 'tag']) assert.match(fieldAdvice('nl', name, values({})), /Aanbevolen/);
  assert.equal(fieldAdvice('nl', 'title', values({})), null);                                // a required field has its error instead
});

test('SNG-16 in the fields: a new song shows its empty recommended fields as warnings, not errors; filling one takes it away', () => {
  let form = toBlocks('{title: Nieuw}\n{meta: language en}\n\nverse\n');
  const fields = createSongFields({ lang: 'nl', id: null, getForm: () => form, setForm: (f) => { form = f; } });
  const box = (id) => boxOf(fields.node, id);
  for (const id of ['song-lyricist', 'song-composer', 'song-copyright', 'song-license', 'song-source', 'song-tag']) {
    assert.ok(box(id).classes.has('warn') && !box(id).classes.has('invalid'), id);
  }
  assert.ok(!box('song-title').classes.has('warn') && !box('song-title').classes.has('invalid'));
  const words = byId(fields.node, 'song-lyricist');
  words.value = 'unknown';
  words.listeners.change();
  assert.ok(!box('song-lyricist').classes.has('warn') && !box('song-composer').classes.has('warn'), 'words or music: both satisfied');
  assert.ok(box('song-copyright').classes.has('warn'));
});
