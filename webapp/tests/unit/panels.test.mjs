// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/app/panels.js and i18n.js tParts (webappGUI GD-14, GD-15, GD-35;
// securityAssessment SR-52; implementationPlan M4.4), with a stand-in document as in dom.test.mjs.
// The dialogs themselves (<dialog>, showModal) are checked in the browser. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tag, ns) { Object.assign(this, { tag, ns, attrs: {}, children: [], listeners: {} }); }
  setAttribute(n, v) { this.attrs[n] = v; }
  append(...c) { this.children.push(...c); }
  addEventListener(t, f) { this.listeners[t] = f; }
}
globalThis.document = {
  createElement: (t) => new FakeNode(t),
  createElementNS: (ns, t) => new FakeNode(t, ns),
  createTextNode: (s) => ({ text: s }),
};
const { androidContent, bottomBar, LINKS, privacyUrl } = await import('../../src/app/panels.js');
const { extLink } = await import('../../src/app/dom.js');
const { tParts, LANGUAGES } = await import('../../src/app/i18n.js');

/** Every node of a tree, depth first. */
function* walk(node) {
  if (!node || typeof node !== 'object') return;
  yield node;
  for (const c of node.children || []) yield* walk(c);
}
const textOf = (node) => [...walk(node)].map((n) => n.text || '').join('');

test('tParts puts elements in place of placeholders, and keeps the rest as text', () => {
  const a = { tag: 'a' };
  assert.deepEqual(tParts('nl', 'apkLine', { link: a }), ['Download de ondertekende APK van ', a, '.']);
  assert.deepEqual(tParts('en', 'appName'), ['Zangbundel library manager']);
  assert.throws(() => tParts('nl', 'noSuchKey'), /no text/);
});

test('GD-15, GD-35: every link of the Android panel is https, opens a new tab and sends no referrer; no Google Play', () => {
  for (const lang of LANGUAGES) {
    const nodes = androidContent(lang).flatMap((n) => [...walk(n)]);
    const links = nodes.filter((n) => n.tag === 'a');
    assert.deepEqual(links.map((a) => a.attrs.href).sort(), Object.values(LINKS).sort(), lang);
    for (const a of links) {
      assert.match(a.attrs.href, /^https:\/\//);
      assert.equal(a.attrs.target, '_blank');
      assert.equal(a.attrs.rel, 'noopener noreferrer');
    }
    assert.ok(nodes.some((n) => n.attrs && n.attrs.class === 'fdroid' && n.attrs.role === 'img' && n.attrs['aria-label']));
    assert.doesNotMatch(androidContent(lang).map(textOf).join(' '), /google/i);
  }
});

test('SR-52: the privacy statement in the interface language; extLink refuses anything but https', () => {
  assert.equal(privacyUrl('de'), 'https://zangbundel.nl/de/privacy.html');
  assert.throws(() => extLink('http://example.org/', 'x'), /https/);
  assert.throws(() => extLink('javascript:alert(1)', 'x'), /https/);
});

test('GD-04, GD-14: the bottom bar draws every group; buttons that wait for M5/M6 or a library are disabled and say why', () => {
  const calls = [];
  const items = bottomBar({ lang: 'nl', onLanguage: () => calls.push('lang'), onAndroid: () => calls.push('android'), onAbout: () => calls.push('about'),
    onOpen: () => calls.push('open'), onNew: () => calls.push('new'), onClose: () => calls.push('close') });
  const buttons = items.flatMap((n) => [...walk(n)]).filter((n) => n.tag === 'button');
  assert.equal(buttons.length, 13);                  // 5 library, Controle, 4 key, Android, language, Over
  const waiting = buttons.filter((b) => 'disabled' in b.attrs);
  assert.equal(waiting.length, 8);                  // edit, download and close (no library), Controle, 4 key buttons
  for (const b of waiting) assert.ok(b.attrs.title && b.attrs.title.includes(':'), b.attrs.title);
  const working = buttons.filter((b) => !('disabled' in b.attrs));
  working.forEach((b) => b.listeners.click());
  assert.deepEqual(calls, ['open', 'new', 'android', 'lang', 'about']);
  assert.match(working[3].attrs['aria-label'], /^Taal: Nederlands/);
  const open = bottomBar({ lang: 'nl', hasLibrary: true, findings: [], onClose: () => {}, onCheck: () => {} }).flatMap((n) => [...walk(n)]).filter((n) => n.tag === 'button');
  assert.equal(open.filter((b) => 'disabled' in b.attrs).length, 5);   // with a library: Downloaden, Sluiten and Controle work
  assert.ok(items.flatMap((n) => [...walk(n)]).some((n) => n.text === 'geen sleutel'));   // GD-14: no key yet
  // M6.3: Sleutel laden works once wired; the loaded key's name and fingerprint replace "geen sleutel"
  const loaded = [];
  const withKey = bottomBar({ lang: 'nl', onLoadKey: () => loaded.push('key'), key: { name: 'Leiding', fingerprint: '21FE-31DF-A154-A261' } })
    .flatMap((n) => [...walk(n)]);
  const load = withKey.filter((n) => n.tag === 'button').find((b) => b.attrs.title === 'Sleutel laden');
  assert.ok(load && !('disabled' in load.attrs));
  load.listeners.click();
  assert.deepEqual(loaded, ['key']);
  assert.ok(withKey.some((n) => n.text === 'Leiding · 21FE-31DF-A154-A261'));
});
