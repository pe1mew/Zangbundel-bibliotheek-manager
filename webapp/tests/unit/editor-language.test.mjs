// SPDX-License-Identifier: Apache-2.0
// Issue #3 (webappGUI GD-17): a language change reaches the open song editor at once, without losing work.
// The editor is drawn again in the new language from snapshot() of the old one (editor.js resume). Runs the
// editor on a small fake DOM; how it looks is checked in the browser. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tag) {
    Object.assign(this, { tag, attrs: {}, children: [], listeners: {}, hidden: false, value: '', style: {} });
    this.classList = { toggle() {}, add() {}, remove() {}, contains: () => false };
  }
  setAttribute(n, v) { this.attrs[n] = v; if (n === 'value') this.value = v; }
  removeAttribute(n) { delete this.attrs[n]; }
  append(...c) { this.children.push(...c); }
  replaceChildren(...c) { this.children = c; }
  addEventListener(t, f) { this.listeners[t] = f; }
  removeEventListener() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  focus() {}
  get textContent() { return this.children.map((c) => (c && (c.text !== undefined ? c.text : c.textContent)) || '').join(''); }
}
globalThis.document = { createElement: (t) => new FakeNode(t), createElementNS: (ns, t) => new FakeNode(t), createTextNode: (s) => ({ text: s }) };
const { createSongEditor } = await import('../../src/app/editor.js');

const FORM = { blocks: [{ type: 'meta', name: 'title', values: ['Proef'] }, { type: 'section', kind: 'verse', label: null, lines: ['la'], implicit: false }] };
const open = (lang, resume) => createSongEditor({ lang, id: 'proef', text: '{title: Proef}\nla\n', form: FORM, title: 'Proef', resume,
  onApply() {}, onCancel() {}, onDelete() {}, toText: async () => ({ text: '' }), toForm: async () => FORM, checkCode: async () => [] });
const heading = (ed) => {
  const find = (n) => (n && n.tag === 'h2' ? n : (n && n.children || []).map(find).find(Boolean));
  return find(ed.node).textContent;
};

test('#3: an editor drawn again in another language keeps every change, and speaks the new language', () => {
  const en = open('en');
  const form = en.state().form;
  form.blocks[1].lines = ['la', 'a line typed in English'];
  form.blocks[1].label = 'Couplet X';
  const snap = en.snapshot();
  assert.notEqual(snap.form, form);                            // a copy: the old editor cannot change it later
  const de = open('de', snap);
  assert.deepEqual(de.state(), { mode: 'blocks', form });
  assert.equal(de.changed(), true);                            // still a change to apply or throw away (GD-36)
  assert.match(heading(en), /Editing|Proef/);
  assert.match(heading(de), /bearbeiten|Proef/i);
  assert.notEqual(heading(de), heading(en));
});

test('#3: in the code mode the typed code is kept, and an unchanged song stays unchanged', () => {
  const code = { mode: 'code', form: FORM, code: '{title: Proef}\nla\nnog een regel\n', codeFrom: '{title: Proef}\nla\n', formAtCode: FORM };
  const nl = open('nl', code);
  assert.equal(nl.mode(), 'code');
  assert.deepEqual(nl.state(), { mode: 'code', text: code.code });
  assert.equal(nl.changed(), true);
  const same = open('de', open('en').snapshot());
  assert.equal(same.changed(), false);
});
