// SPDX-License-Identifier: Apache-2.0
// Entry point of the main thread (webappTDS TD-22: bundled with everything it imports).
// M1.4: the splash only (webappGUI GD-27, GD-30), then a card saying what this build is.

import { el, replace } from './dom.js';
import { pickLanguage, t } from './i18n.js';
import { VERSION } from './version.js';

const SPLASH_MS = 3000;   // GD-27

function isTestInstance(hostname) {
  return hostname.startsWith('test.') || hostname === 'localhost' || hostname === '127.0.0.1';
}

function splash(lang, onDone) {
  const node = el('div', { class: 'splash', role: 'button', tabindex: 0, 'aria-label': t(lang, 'clickToContinue') }, [
    el('div', { class: 'logo', 'aria-hidden': 'true' }),   // the icon is a CSS background: the build renames it
    el('h1', {}, [t(lang, 'appName')]),
    el('p', {}, [t(lang, 'tagline')]),
    el('p', {}, [t(lang, 'version', { v: VERSION })]),
    el('p', { class: 'hint' }, [t(lang, 'clickToContinue')]),
  ]);
  let done = false;
  const finish = () => {
    if (!done) {
      done = true;
      onDone();
    }
  };
  node.addEventListener('click', finish);
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      finish();
    }
  });
  setTimeout(finish, SPLASH_MS);
  return node;
}

function home(lang) {
  return el('main', { class: 'home' }, [
    el('div', { class: 'card' }, [
      el('h2', {}, [t(lang, 'buildingTitle')]),
      el('p', {}, [t(lang, 'buildingText')]),
      el('p', {}, [t(lang, 'privacy')]),
    ]),
  ]);
}

function start() {
  const root = document.getElementById('app');
  const lang = pickLanguage(navigator.languages);
  document.documentElement.lang = lang;
  document.title = t(lang, 'appName');
  const banner = isTestInstance(location.hostname)
    ? [el('div', { class: 'testbanner', role: 'note' }, [t(lang, 'testBanner')])]
    : [];
  replace(root, ...banner, splash(lang, () => replace(root, ...banner, home(lang))));
}

start();
