// SPDX-License-Identifier: Apache-2.0
// Entry point of the main thread (webappTDS TD-22: bundled with everything it imports).
// M4.3: the main screen's four areas (webappGUI GD-03, GD-04, GD-10), the splash in the centre with
// the bars greyed (GD-03, GD-27, GD-30), then the home screen's primary actions; a page of its own
// in a window narrower than 980 px (GD-32). The language switches at once (GD-17, M4.2).
// M4.4: the bottom bar's groups, the *Android-app* panel and *Over* (panels.js).

import { el, extLink, icon, replace } from './dom.js';
import { createLanguage, t } from './i18n.js';
import { createLayout } from './layout.js';
import { aboutDialog, androidContent, androidDialog, bottomBar, privacyUrl } from './panels.js';
import { VERSION } from './version.js';

const SPLASH_MS = 3000;   // GD-27
// SR-81: the test instance's banner is fixed and Dutch, in every interface language.
const TEST_BANNER = 'TESTVERSIE — niet voor echte bibliotheken of sleutels';

function isTestInstance(hostname) {
  return hostname.startsWith('test.') || hostname === 'localhost' || hostname === '127.0.0.1';
}

/** GD-03, GD-27, GD-30: the photograph, icon, name and version; 3 s or until a click or a key. */
function splash(lang, onDone) {
  let done = false;
  const finish = () => {
    if (!done) {
      done = true;
      onDone();
    }
  };
  const node = el('div', { class: 'splash', role: 'button', tabindex: 0, 'aria-label': t(lang, 'clickToContinue'), on: {
    click: finish,
    keydown: (event) => { if (event.key === 'Enter' || event.key === ' ') finish(); },
  } }, [
    el('div', { class: 'logo', 'aria-hidden': 'true' }),   // the icon is a CSS background: the build renames it
    el('h1', {}, [t(lang, 'appName')]),
    el('p', {}, [t(lang, 'tagline')]),
    el('p', {}, [t(lang, 'version', { v: VERSION })]),
    el('p', { class: 'hint' }, [t(lang, 'clickToContinue')]),
  ]);
  setTimeout(finish, SPLASH_MS);
  return node;
}

/** A primary action (GD-03). Until the library screens exist (M5, M6), each says why it waits. */
function tile(name, title, sub, why) {
  return el('button', { type: 'button', class: 'tile', disabled: true, title: why }, [
    icon(name),
    el('span', { class: 'tiletext' }, [el('b', {}, [title]), el('span', {}, [sub]), el('span', { class: 'why' }, [why])]),
  ]);
}

/** GD-03: the home screen's primary actions in the centre. */
function home(lang) {
  return el('div', { class: 'home' }, [
    el('h1', {}, [t(lang, 'homeTitle')]),
    el('p', { class: 'muted' }, [t(lang, 'homeLead')]),
    el('div', { class: 'tiles' }, [
      tile('open', t(lang, 'tileOpen'), t(lang, 'tileOpenSub'), t(lang, 'tileSoon')),
      tile('add', t(lang, 'tileNew'), t(lang, 'tileNewSub'), t(lang, 'tileSoon')),
      tile('edit', t(lang, 'tileEdit'), t(lang, 'tileNeedLib'), t(lang, 'tileSoon')),
      tile('download', t(lang, 'tileDownload'), t(lang, 'tileNeedLib'), t(lang, 'tileSoon')),
    ]),
    el('p', { class: 'note' }, [t(lang, 'privacy')]),
  ]);
}

/** GD-32: shown instead of the main screen in a window narrower than 980 px (CSS decides), with the
 *  Android links of GD-15 and the privacy statement (SR-52). */
function narrowPage(lang) {
  return el('div', { class: 'narrowbox' }, [
    el('div', { class: 'logo', 'aria-hidden': 'true' }),
    el('h2', {}, [t(lang, 'appName')]),
    el('p', {}, [t(lang, 'narrow')]),
    el('h3', {}, [t(lang, 'androidTitle')]),
    ...androidContent(lang),
    el('p', {}, [extLink(privacyUrl(lang), t(lang, 'privacyLink'), t(lang, 'newTab'))]),
  ]);
}

function start() {
  const root = document.getElementById('app');
  const language = createLanguage({ preferred: navigator.languages });
  const layout = createLayout({ getLang: language.get });
  const narrow = el('div', { class: 'narrow' }, []);
  const banner = isTestInstance(location.hostname)
    ? el('div', { class: 'testbanner', role: 'note', lang: 'nl' }, [TEST_BANNER])
    : null;
  let screen = 'splash';

  const render = () => {
    const lang = language.get();
    document.documentElement.lang = lang;
    document.title = t(lang, 'appName');
    layout.setSplash(screen === 'splash');
    replace(layout.centre, screen === 'splash' ? splash(lang, () => { screen = 'home'; render(); }) : home(lang));
    replace(layout.right, el('div', { class: 'libhead' }, [el('h3', {}, [t(lang, 'songs')])]),
      el('p', { class: 'empty' }, [t(lang, 'noLibrary')]));
    replace(layout.left, el('p', { class: 'empty' }, [t(lang, 'tileNeedLib')]));
    replace(layout.bottom, ...bottomBar({ lang, onLanguage: () => language.next(),
      onAndroid: () => androidDialog(language.get()), onAbout: () => aboutDialog(language.get()) }));
    replace(narrow, narrowPage(lang));
  };
  replace(root, banner, layout.app, narrow);
  language.onChange(render);                              // GD-17: at once, without losing work
  render();
}

start();
