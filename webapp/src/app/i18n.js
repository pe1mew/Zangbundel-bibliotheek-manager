// SPDX-License-Identifier: Apache-2.0
// Languages of the interface (FDS 7.9, EDT-80 to EDT-82; webappGUI GD-17, GD-34; implementationPlan
// M4.2). The texts are in texts.js. The language on opening is the one remembered on this computer,
// else the first of the browser's languages the manager offers, else English; the bottom bar
// switches it at once, without losing work, and the choice is remembered (storage.js, zbm.lang).

import { TEXTS } from './texts.js';
import { load, save } from './storage.js';

export const LANGUAGES = Object.freeze(Object.keys(TEXTS));

/** The first of the browser's languages that the manager offers, else English (EDT-80, EDT-81). */
export function pickLanguage(preferred) {
  for (const tag of preferred || []) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (LANGUAGES.includes(base)) {
      return base;
    }
  }
  return 'en';
}

/** The text for a key in a language, with {name} placeholders filled in. */
export function t(lang, key, params) {
  const text = (TEXTS[lang] || TEXTS.en)[key];
  if (text === undefined) {
    throw new Error(`i18n: no text for ${key}`);
  }
  return text.replace(/\{(\w+)\}/g, (_, name) => String((params || {})[name] ?? ''));
}

/**
 * A text with elements in place of its placeholders, as a list for dom.js el(): tParts('nl',
 * 'apkLine', { link: anchor }) gives ['Download de ondertekende APK van ', anchor, '.']. Never HTML.
 */
export function tParts(lang, key, nodes) {
  const text = (TEXTS[lang] || TEXTS.en)[key];
  if (text === undefined) {
    throw new Error(`i18n: no text for ${key}`);
  }
  return text.split(/(\{\w+\})/).filter((part) => part !== '').map((part) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return m && nodes && nodes[m[1]] !== undefined ? nodes[m[1]] : part;
  });
}

/**
 * The interface language of this page: { get(), set(lang), next(), onChange(fn) }. preferred is
 * navigator.languages; store is local storage (tests pass their own). A stored value that is not
 * one of LANGUAGES is ignored.
 */
export function createLanguage({ preferred, store } = {}) {
  const stored = load('zbm.lang', store);
  let current = LANGUAGES.includes(stored) ? stored : pickLanguage(preferred);
  const listeners = new Set();
  return {
    get: () => current,
    set(lang) {
      if (!LANGUAGES.includes(lang)) throw new Error(`i18n: no language ${lang}`);
      if (lang === current) return;
      current = lang;
      save('zbm.lang', lang, store);                    // GD-34: remembered on this computer
      for (const fn of listeners) fn(lang);
    },
    /** GD-17: the bottom bar's button goes NL, EN, DE and round again. */
    next() {
      this.set(LANGUAGES[(LANGUAGES.indexOf(current) + 1) % LANGUAGES.length]);
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
