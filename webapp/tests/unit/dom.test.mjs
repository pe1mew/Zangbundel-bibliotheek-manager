// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/app/dom.js (securityAssessment SR-24, SR-32; implementationPlan M4.1), with a
// minimal stand-in for the browser's document: enough to see which attributes, texts and listeners
// the builder sets. The browser check (SC-03) covers the real DOM. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { el, icon, replace, setVar } from '../../src/app/dom.js';

class FakeNode {
  constructor(tag, ns) { Object.assign(this, { tag, ns, attrs: {}, children: [], listeners: {}, props: {} }); }
  setAttribute(n, v) { this.attrs[n] = v; }
  append(...c) { this.children.push(...c); }
  replaceChildren(...c) { this.children = c; }
  addEventListener(t, f) { this.listeners[t] = f; }
  get style() { const props = this.props; return { setProperty: (k, v) => { props[k] = v; } }; }
}
globalThis.document = {
  createElement: (t) => new FakeNode(t),
  createElementNS: (ns, t) => new FakeNode(t, ns),
  createTextNode: (s) => ({ text: s }),
};

test('el: attributes, text children as text nodes, handlers through on, conditional children skipped', () => {
  const click = () => {};
  const n = el('button', { class: 'btn', 'aria-label': 'Nieuw', 'data-id': 'x', disabled: false, hidden: true, on: { click } },
    ['<b>not html</b>', 3, null, false, undefined]);
  assert.deepEqual(n.attrs, { class: 'btn', 'aria-label': 'Nieuw', 'data-id': 'x', hidden: '' });
  assert.deepEqual(n.children, [{ text: '<b>not html</b>' }, { text: '3' }]);   // markup stays text
  assert.equal(n.listeners.click, click);
});

test('el refuses script-carrying attributes, elements and URLs (SR-32)', () => {
  for (const attrs of [{ style: 'color:red' }, { onclick: 'x()' }, { srcdoc: '<p>' }, { href: 'javascript:alert(1)' },
    { href: ' JavaScript:alert(1)' }, { href: 'java\tscript:alert(1)' }, { src: 'data:text/html,<script>' }, { 'ARIA-x': '1' }]) {
    assert.throws(() => el('a', attrs, []), /not allowed|unsafe/, JSON.stringify(attrs));
  }
  for (const tag of ['script', 'iframe', 'object', 'embed', 'img onerror=x']) assert.throws(() => el(tag, {}, []));
  assert.throws(() => el('button', { on: { click: 'x()' } }, []), /not a function/);
  for (const href of ['https://zangbundel.nl/', 'privacy.html', '../nl/', '#top', 'mailto:a@example.org', 'blob:https://x/1', 'nl/index.html?x=1']) {
    assert.equal(el('a', { href }, []).attrs.href, href);
  }
});

test('icon: SVG in the SVG namespace, hidden from screen readers; unknown names refused', () => {
  const s = icon('add', 'small');
  assert.equal(s.ns, 'http://www.w3.org/2000/svg');
  assert.deepEqual(s.attrs, { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', class: 'small' });
  assert.equal(s.children[0].tag, 'path');
  assert.match(s.children[0].attrs.d, /^M19 13h-6/);
  assert.throws(() => icon('nope'), /no icon/);
});

test('replace skips empty children; setVar takes custom properties only (GD-10)', () => {
  const n = el('div', {}, ['a']);
  replace(n, el('p', {}, []), null, false);
  assert.equal(n.children.length, 1);
  setVar(n, '--left-width', '280px');
  assert.equal(n.props['--left-width'], '280px');
  assert.throws(() => setVar(n, 'width', '1px'), /custom property/);
});
