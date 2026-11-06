// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/app/i18n.js (FDS EDT-80, EDT-81; webappGUI GD-17). Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, pickLanguage, t } from '../../src/app/i18n.js';

test('the manager offers Dutch, English and German', () => {
  assert.deepEqual([...LANGUAGES].sort(), ['de', 'en', 'nl']);
});

test('the first preferred language the manager offers wins (EDT-80)', () => {
  assert.equal(pickLanguage(['fr-FR', 'de-AT', 'nl']), 'de');
  assert.equal(pickLanguage(['NL-be']), 'nl');
  assert.equal(pickLanguage(['en-GB', 'nl']), 'en');
});

test('otherwise English (EDT-81)', () => {
  assert.equal(pickLanguage(['fr', 'es']), 'en');
  assert.equal(pickLanguage([]), 'en');
  assert.equal(pickLanguage(undefined), 'en');
});

test('every key exists in every language, with the same placeholders', () => {
  for (const key of ['appName', 'tagline', 'version', 'clickToContinue', 'buildingTitle', 'buildingText', 'privacy']) {
    const holes = (lang) => (t(lang, key).match(/\{\w+\}/g) || []).sort().join();
    for (const lang of LANGUAGES) {
      assert.ok(t(lang, key).length > 0, `${lang}.${key}`);
    }
    // placeholders are filled, so compare the raw texts' holes through an empty fill
    assert.equal(holes('nl'), holes('en'));
    assert.equal(holes('nl'), holes('de'));
  }
});

test('placeholders are filled in, and an unknown key throws', () => {
  assert.equal(t('nl', 'version', { v: '0.2.0' }), 'versie 0.2.0');
  assert.equal(t('de', 'version', { v: '1' }), 'Version 1');
  assert.throws(() => t('nl', 'noSuchKey'), /no text for noSuchKey/);
});
