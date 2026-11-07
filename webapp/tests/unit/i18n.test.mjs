// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/app/i18n.js, texts.js and storage.js (FDS EDT-80 to EDT-82; webappGUI
// GD-17, GD-34; securityAssessment SR-42; implementationPlan M4.2). Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLanguage, LANGUAGES, pickLanguage, t } from '../../src/app/i18n.js';
import { TEXTS } from '../../src/app/texts.js';
import { load, save } from '../../src/app/storage.js';

/** A stand-in for localStorage; broken: true makes every call throw, as a blocked store does. */
function fakeStore({ broken = false } = {}) {
  const m = new Map();
  const guard = () => { if (broken) throw new Error('SecurityError'); };
  return { getItem: (k) => (guard(), m.has(k) ? m.get(k) : null), setItem: (k, v) => (guard(), m.set(k, String(v))), map: m };
}

test('the manager offers Dutch, English and German', () => {
  assert.deepEqual([...LANGUAGES].sort(), ['de', 'en', 'nl']);
});

test('the first preferred language the manager offers wins (EDT-80); otherwise English (EDT-81)', () => {
  assert.equal(pickLanguage(['fr-FR', 'de-AT', 'nl']), 'de');
  assert.equal(pickLanguage(['NL-be']), 'nl');
  assert.equal(pickLanguage(['en-GB', 'nl']), 'en');
  assert.equal(pickLanguage(['fr', 'es']), 'en');
  assert.equal(pickLanguage([]), 'en');
  assert.equal(pickLanguage(undefined), 'en');
});

test('every text exists in every language, non-empty, with the same placeholders', () => {
  const holes = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  const keys = Object.keys(TEXTS.nl);
  assert.ok(keys.length > 200, `${keys.length} texts`);
  for (const lang of LANGUAGES) {
    assert.deepEqual(Object.keys(TEXTS[lang]).sort(), [...keys].sort(), `keys of ${lang}`);
    for (const k of keys) {
      assert.ok(typeof TEXTS[lang][k] === 'string' && TEXTS[lang][k].trim(), `${lang}.${k}`);
      assert.equal(holes(TEXTS[lang][k]), holes(TEXTS.nl[k]), `placeholders of ${lang}.${k}`);
      assert.doesNotMatch(TEXTS[lang][k], /<[a-z/!]/i, `no markup in ${lang}.${k}`);      // plain text only (SR-32)
      assert.doesNotMatch(TEXTS[lang][k], /\b(FDS|EDT-\d|GD-\d|SR-\d|M-\d)/, `no design reference in ${lang}.${k}`);
    }
  }
  for (const k of ['mockPicker', 'downloaded', 'playTm']) assert.equal(TEXTS.nl[k], undefined, `${k} is mock-only`);
});

test('placeholders are filled in, and an unknown key throws', () => {
  assert.equal(t('nl', 'version', { v: '0.2.0' }), 'versie 0.2.0');
  assert.equal(t('de', 'version', { v: '1' }), 'Version 1');
  assert.throws(() => t('nl', 'noSuchKey'), /no text for noSuchKey/);
});

test('GD-17, GD-34: the remembered language wins over the browser; switching goes round, tells, and is remembered', () => {
  const store = fakeStore();
  const a = createLanguage({ preferred: ['de-DE'], store });
  assert.equal(a.get(), 'de');                                      // nothing stored: the browser's
  const seen = [];
  a.onChange((l) => seen.push(l));
  a.next();
  a.next();
  assert.deepEqual(seen, ['nl', 'en']);                             // LANGUAGES order: nl, en, de
  assert.equal(store.map.get('zbm.lang'), 'en');
  assert.equal(createLanguage({ preferred: ['de-DE'], store }).get(), 'en');   // next visit
  store.map.set('zbm.lang', 'fr');                                  // a value it does not offer is ignored
  assert.equal(createLanguage({ preferred: ['nl'], store }).get(), 'nl');
  assert.throws(() => a.set('fr'), /no language/);
});

test('SR-42: storage holds only zbm.lang and zbm.bars; a blocked store gives defaults, never an error', () => {
  const store = fakeStore();
  assert.throws(() => save('zbm.library', 'x', store), /not allowed/);
  assert.throws(() => load('key', store), /not allowed/);
  save('zbm.bars', '{"left":280}', store);
  assert.equal(load('zbm.bars', store), '{"left":280}');
  const blocked = fakeStore({ broken: true });
  assert.equal(load('zbm.lang', blocked), null);
  save('zbm.lang', 'nl', blocked);                                   // dropped silently
  assert.equal(createLanguage({ preferred: ['nl'], store: blocked }).get(), 'nl');
  assert.equal(createLanguage({ preferred: ['nl'], store: null }).get(), 'nl');
});
