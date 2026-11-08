// SPDX-License-Identifier: Apache-2.0
// Unit tests of the frame's strips (webapp/src/app/layout.js; webappGUI GD-10, GD-34; the owner's M5 review F6):
// a folded bar keeps a strip of icons; a click opens the bar, which stays open and is remembered.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tag) {
    Object.assign(this, { tag, attrs: {}, children: [], listeners: {}, hidden: false, inert: false, vars: {}, classes: new Set(), clientWidth: 1400 });
    this.style = { setProperty: (n, v) => { this.vars[n] = v; } };
    this.classList = { toggle: (c, on) => (on ? this.classes.add(c) : this.classes.delete(c)), contains: (c) => this.classes.has(c) };
  }
  setAttribute(n, v) { this.attrs[n] = v; if (n === 'hidden') this.hidden = true; }
  removeAttribute(n) { delete this.attrs[n]; }
  append(...c) { this.children.push(...c); }
  replaceChildren(...c) { this.children = c; }
  addEventListener(t, f) { this.listeners[t] = f; }
  removeEventListener() {}
}
globalThis.document = { createElement: (t) => new FakeNode(t), createElementNS: (ns, t) => new FakeNode(t), createTextNode: (s) => ({ text: s }) };
globalThis.addEventListener = () => {};
const store = { map: new Map(), getItem(k) { return this.map.get(k) ?? null; }, setItem(k, v) { this.map.set(k, v); } };

const { createLayout, STRIP } = await import('../../src/app/layout.js');

const strip = (layout, side) => layout.app.children.find((c) => c.attrs.class === `strip strip-${side}`);
const tab = (layout, side) => layout.app.children.find((c) => c.attrs.class === `edge edge-${side}`).children[0];
const click = (node) => node.listeners.click({ stopPropagation() {} });

test('F6: a folded bar keeps a strip of STRIP px with its icons; an open bar shows none', () => {
  const layout = createLayout({ getLang: () => 'nl', store });
  layout.setStrip('right', [{ icon: 'list', label: 'Liedjes' }, { icon: 'playlist', label: 'Sets' }]);
  assert.equal(strip(layout, 'right').hidden, true);
  click(tab(layout, 'right'));                                       // fold it
  assert.equal(strip(layout, 'right').hidden, false);
  assert.equal(layout.app.vars['--rw'], `${STRIP}px`);
  assert.deepEqual(strip(layout, 'right').children.map((b) => b.attrs['aria-label']), ['Liedjes', 'Sets']);
  assert.equal(strip(layout, 'right').attrs['aria-label'], 'Rechterbalk uitklappen');
});

test('F6: an icon opens the bar, shows its part, and the bar stays open (remembered)', () => {
  store.map.clear();
  const layout = createLayout({ getLang: () => 'nl', store });
  const shown = [];
  click(tab(layout, 'right'));
  layout.setStrip('right', [{ icon: 'list', label: 'Liedjes', onClick: () => shown.push('songs') },
    { icon: 'playlist', label: 'Sets', onClick: () => shown.push('sets') }]);
  click(strip(layout, 'right').children[1]);
  assert.deepEqual(shown, ['sets']);
  assert.equal(strip(layout, 'right').hidden, true);
  assert.notEqual(layout.app.vars['--rw'], `${STRIP}px`);
  assert.equal(JSON.parse(store.map.get('zbm.bars')).right.folded, false);
  click(tab(layout, 'left'));                                        // the left bar: one icon, no part to choose
  layout.setStrip('left', [{ icon: 'musicNote', label: 'Liedgegevens' }]);
  click(strip(layout, 'left').children[0]);
  assert.equal(JSON.parse(store.map.get('zbm.bars')).left.folded, false);
});
