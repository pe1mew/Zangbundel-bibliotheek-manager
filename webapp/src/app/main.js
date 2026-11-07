// SPDX-License-Identifier: Apache-2.0
// Entry point of the main thread (webappTDS TD-22: bundled with everything it imports).
// M1.4: the splash only (webappGUI GD-27, GD-30), then a card saying what this build is.
// M4.2: the interface language (GD-17, GD-34): remembered, switched at once, every screen redrawn.

import { el, replace } from './dom.js';
import { createLanguage, t } from './i18n.js';
import { VERSION } from './version.js';

const SPLASH_MS = 3000;   // GD-27
// SR-81: the test instance's banner is fixed and Dutch, in every interface language.
const TEST_BANNER = 'TESTVERSIE — niet voor echte bibliotheken of sleutels';

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

/** GD-17: the language button, NL, EN, DE and round again. Until the bottom bar (M4.4) it sits on the card. */
function languageButton(language) {
  const lang = language.get();
  return el('button', { type: 'button', class: 'langbtn', title: t(lang, 'languageSwitch', { name: t(lang, 'languageName') }),
    'aria-label': t(lang, 'languageSwitch', { name: t(lang, 'languageName') }), on: { click: () => language.next() } },
  [t(lang, 'languageCode')]);
}

function home(language) {
  const lang = language.get();
  return el('main', { class: 'home' }, [
    el('div', { class: 'card' }, [
      el('h2', {}, [t(lang, 'buildingTitle')]),
      el('p', {}, [t(lang, 'buildingText')]),
      el('p', { class: 'note' }, [t(lang, 'privacy')]),
      el('p', { class: 'langrow' }, [languageButton(language)]),
    ]),
  ]);
}

function start() {
  const root = document.getElementById('app');
  const language = createLanguage({ preferred: navigator.languages });
  const banner = () => (isTestInstance(location.hostname)
    ? el('div', { class: 'testbanner', role: 'note', lang: 'nl' }, [TEST_BANNER])
    : null);
  let screen = 'splash';
  const render = () => {
    const lang = language.get();
    document.documentElement.lang = lang;
    document.title = t(lang, 'appName');
    replace(root, banner(), screen === 'splash' ? splash(lang, () => { screen = 'home'; render(); }) : home(language));
  };
  language.onChange(render);                              // GD-17: at once, without losing work
  render();
}

start();
