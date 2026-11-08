// SPDX-License-Identifier: Apache-2.0
// Unit tests of the language menu (webapp/src/app/langmenu.js; webappGUI GD-17, the owner's M5 review F4):
// every language in its own name with the current one checked, a choice applies it and closes the menu,
// Escape and a second click close it unchanged, the arrow keys move round.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tag) {
    Object.assign(this, { tag, attrs: {}, children: [], listeners: {}, parent: null, offsetWidth: 180, offsetHeight: 150, vars: {} });
    this.style = { setProperty: (n, v) => { this.vars[n] = v; } };
  }
  setAttribute(n, v) { this.attrs[n] = v; }
  append(...c) { for (const x of c) { if (x && typeof x === 'object') x.parent = this; this.children.push(x); } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((g) => g !== f); }
  fire(t, event = {}) { for (const f of [...(this.listeners[t] || [])]) f({ preventDefault() {}, target: this, currentTarget: this, ...event }); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; }
  contains(n) { for (let x = n; x; x = x.parent) if (x === this) return true; return false; }
  get isConnected() { let x = this; while (x.parent) x = x.parent; return x === body; }
  focus() { doc.activeElement = this; }
  getBoundingClientRect() { return { left: 900, top: 700, right: 960, bottom: 760 }; }
  text() { return this.children.map((c) => (c && typeof c === 'object' ? (c.text !== undefined && !c.tag ? c.text : c.text?.() ?? '') : String(c))).join(''); }
}
const body = new FakeNode('body');
const doc = {
  body, activeElement: null, listeners: {},
  createElement: (t) => new FakeNode(t), createElementNS: (ns, t) => new FakeNode(t), createTextNode: (s) => ({ text: s }),
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); },
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((g) => g !== f); },
  querySelector: (sel) => (sel === '.langbtn' ? langbtn : null),
};
globalThis.document = doc;
globalThis.innerWidth = 1000;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
let langbtn = null;

const { nextIndex, toggleLanguageMenu, languageMenuOpen } = await import('../../src/app/langmenu.js');

function newButton() {
  langbtn = new FakeNode('button');
  body.append(langbtn);
  return langbtn;
}
const menu = () => body.children.find((c) => c.attrs.role === 'menu');

test('GD-17 (F4): the arrow keys go round; Home and End go to the ends', () => {
  assert.equal(nextIndex(0, 3, 'ArrowDown'), 1);
  assert.equal(nextIndex(2, 3, 'ArrowDown'), 0);
  assert.equal(nextIndex(0, 3, 'ArrowUp'), 2);
  assert.equal(nextIndex(1, 3, 'Home'), 0);
  assert.equal(nextIndex(1, 3, 'End'), 2);
  assert.equal(nextIndex(1, 3, 'a'), 1);
});

test('GD-17 (F4): the menu lists each language in its own name, the current one checked and focused', () => {
  const button = newButton();
  toggleLanguageMenu('en', button, () => assert.fail('nothing chosen'));
  const m = menu();
  assert.ok(m && languageMenuOpen());
  const items = m.children;
  assert.deepEqual(items.map((i) => i.attrs.lang), ['nl', 'en', 'de']);
  assert.deepEqual(items.map((i) => i.text()), ['Nederlands', 'English', 'Deutsch']);
  assert.deepEqual(items.map((i) => i.attrs['aria-checked']), ['false', 'true', 'false']);
  assert.equal(doc.activeElement, items[1]);
  assert.equal(button.attrs['aria-expanded'], 'true');
  assert.equal(m.vars['--mx'], '812px');                            // kept inside the window: 1000 - 180 - 8
  assert.equal(m.vars['--my'], '544px');                            // above the button: 700 - 150 - 6
  m.fire('keydown', { key: 'ArrowDown' });
  assert.equal(doc.activeElement, items[2]);
  m.fire('keydown', { key: 'Escape' });
  assert.ok(!menu() && !languageMenuOpen());
  assert.equal(button.attrs['aria-expanded'], 'false');
  assert.equal(doc.activeElement, button);
});

test('GD-17 (F4): a choice applies the language at once and closes the menu; the same language changes nothing', () => {
  const picked = [];
  const button = newButton();
  toggleLanguageMenu('nl', button, (l) => picked.push(l));
  menu().children[2].fire('click');
  assert.deepEqual(picked, ['de']);
  assert.ok(!menu() && !languageMenuOpen());
  assert.equal(doc.activeElement, langbtn);
  toggleLanguageMenu('nl', button, (l) => picked.push(l));
  menu().children[0].fire('click');
  assert.deepEqual(picked, ['de']);
  assert.ok(!languageMenuOpen());
});

test('GD-17 (F4): a second click on the button or a click outside closes it unchanged', () => {
  const button = newButton();
  toggleLanguageMenu('nl', button, () => assert.fail('nothing chosen'));
  toggleLanguageMenu('nl', button, () => assert.fail('nothing chosen'));
  assert.ok(!menu() && !languageMenuOpen());
  toggleLanguageMenu('nl', button, () => assert.fail('nothing chosen'));
  const outside = new FakeNode('div');
  body.append(outside);
  for (const f of doc.listeners.pointerdown || []) f({ target: button });   // the button itself: left to its click
  assert.ok(languageMenuOpen());
  for (const f of [...(doc.listeners.pointerdown || [])]) f({ target: outside });
  assert.ok(!menu() && !languageMenuOpen());
  assert.equal((doc.listeners.pointerdown || []).length, 0, 'its listeners are gone');
});
