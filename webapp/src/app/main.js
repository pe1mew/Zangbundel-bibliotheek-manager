// SPDX-License-Identifier: Apache-2.0
// Entry point of the main thread (webappTDS TD-22: bundled with everything it imports).
// M4.3: the main screen's four areas (webappGUI GD-03, GD-04, GD-10), the splash in the centre with
// the bars greyed (GD-03, GD-27, GD-30), then the home screen's primary actions; a page of its own
// in a window narrower than 980 px (GD-32). The language switches at once (GD-17, M4.2).
// M4.4: the bottom bar's groups, the *Android-app* panel and *Over* (panels.js).
// M6.1: a library is opened, started and closed (session.js, library-ui.js); the right bar shows it
// and *Controle* its findings. M6.2: *Downloaden*. M6.3: a key loaded into the crypto worker signs;
// a signed library is read-only without its key; *Opslaan als kopie*. M6.4: the key group (make,
// download, forget) and forgetting the key after 30 minutes without input. M5.4: the library's fields
// in the left bar (library-form.js). The rest of editing comes with M5.

import { el, extLink, icon, replace } from './dom.js';
import { toast } from './dialog.js';
import { createIdleWatch } from './idle.js';
import { createLibraryForm } from './library-form.js';
import { createLeaveGuard } from './leave-guard.js';
import { createLanguage, t } from './i18n.js';
import { createLayout } from './layout.js';
import { aboutDialog, androidContent, androidDialog, bottomBar, privacyUrl } from './panels.js';
import { checkDialog } from './check.js';
import { createLibraryClient } from './library-client.js';
import { createCryptoClient } from './crypto-client.js';
import { createSession } from './session.js';
import { createSongList, neighbourAfterDelete } from './songlist.js';
import { closeConfirm, convertedDialog, copyDialog, deleteSongConfirm, downloadDialog, idleDialog, keyFailedDialog, keyForgetConfirm, keyMakeDialog,
  keyReplaceConfirm, keySaveDialog, manifestConfirm, newLibraryDialog, openFailedDialog, pickFile, saveFailedDialog,
  savedDialog } from './library-ui.js';
import { KEY_MIME, LIBRARY_MIME, offerDownload } from './download.js';
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

/** A primary action (GD-03); one that waits for a later step says why. */
function tile(name, title, sub, { onClick, why } = {}) {
  return el('button', { type: 'button', class: 'tile', disabled: !onClick, title: why || title, on: onClick ? { click: onClick } : undefined }, [
    icon(name),
    el('span', { class: 'tiletext' }, [el('b', {}, [title]), el('span', {}, [sub]), why ? el('span', { class: 'why' }, [why]) : null]),
  ]);
}

/** GD-03: the home screen's primary actions in the centre. */
function home(lang, { onOpen, onNew, onDownload, hasLibrary, busy }) {
  const soon = t(lang, 'tileSoon');
  return el('div', { class: 'home' }, [
    el('h1', {}, [t(lang, 'homeTitle')]),
    el('p', { class: 'muted' }, [t(lang, 'homeLead')]),
    el('div', { class: 'tiles' }, [
      tile('open', t(lang, 'tileOpen'), busy ? t(lang, 'opening') : t(lang, 'tileOpenSub'), { onClick: busy ? null : onOpen }),
      tile('add', t(lang, 'tileNew'), t(lang, 'tileNewSub'), { onClick: busy ? null : onNew }),
      tile('edit', t(lang, 'tileEdit'), t(lang, 'tileNeedLib'), { why: soon }),
      tile('download', t(lang, 'tileDownload'), t(lang, hasLibrary ? 'dlTitle' : 'tileNeedLib'), { onClick: hasLibrary && !busy ? onDownload : null }),
    ]),
    el('p', { class: 'note' }, [t(lang, 'privacy')]),
  ]);
}

/** The right bar's head (GD-22, GD-24): the library's title, which shows its fields, and its state. */
function libHead(lang, state, onLibrary) {
  const lib = state.library;
  if (!lib) return [el('h3', {}, [t(lang, 'songs')])];
  const status = [
    lib.isNew ? t(lang, 'newUnsaved') : t(lang, 'versionN', { v: lib.version }),
    state.dirty ? t(lang, 'changed') : null,
    lib.author ? t(lang, 'signedBy', { name: lib.author.name }) : t(lang, 'unsigned'),
  ].filter(Boolean).join(' · ');
  return [
    el('button', { type: 'button', class: 'title linklike', title: t(lang, 'libInfo'), on: { click: onLibrary } },
      [lib.author ? icon('lock', 'inl') : null, lib.title]),
    el('div', { class: 'muted small' }, [status]),
  ];
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
  const session = createSession({ client: createLibraryClient(), crypto: createCryptoClient() });
  const narrow = el('div', { class: 'narrow' }, []);
  const banner = isTestInstance(location.hostname)
    ? el('div', { class: 'testbanner', role: 'note', lang: 'nl' }, [TEST_BANNER])
    : null;
  let screen = 'splash';

  // ---- the session's actions (FDS 7.1 to 7.3)
  // EDT-03, M-60: opening or starting another library ends this one, so changes not yet downloaded are asked about first
  const afterClose = (next) => () => (session.get().dirty ? closeConfirm(language.get(), next) : next());
  const onOpen = afterClose(() => pickFile(async (file) => {
    let r;
    try {
      r = await session.open(file);
    } catch {
      r = { ok: false, findings: [] };
    }
    if (!r.ok) openFailedDialog(language.get(), file.name, r.findings);
    else if (r.converted) convertedDialog(language.get(), r.converted);
  }));
  const onNew = afterClose(() => newLibraryDialog(language.get(), (title, description) => session.create(title, description)));
  const onClose = () => (session.get().dirty ? closeConfirm(language.get(), () => session.close()) : session.close());
  const onCheck = () => checkDialog(language.get(), session.get().findings || [], () => {});   // Ga naar: the targets come with M5
  // GD-14, EDT-60, EDT-62: a key file goes to the crypto worker; the page never holds the private key
  const onLoadKey = () => pickFile(async (file) => {
    const r = await session.loadKey(file);
    if (!r.ok) keyFailedDialog(language.get(), r);
    else toast(r.unlocked ? t(language.get(), 'keyUnlocked') : t(language.get(), 'keyLoaded', { name: r.key.name }));
  }, '.zbkey,application/json');
  // GD-14, EDT-61, M-64: the key file of a new key, once, after the tick; the worker then seals the key
  const saveKeyFile = async () => {
    const r = await session.exportKey();
    if (!r.ok) {
      keyFailedDialog(language.get(), r);
      return;
    }
    offerDownload(r.bytes, r.fileName, KEY_MIME);
    r.bytes.fill(0);                                      // the Blob holds its own copy until the link is revoked
    toast(t(language.get(), 'keySaved', { file: r.fileName }));
  };
  const onDownloadKey = () => {
    const key = session.get().key;
    if (key && key.needsExport) keySaveDialog(language.get(), key, false, saveKeyFile);
  };
  const makeKey = () => keyMakeDialog(language.get(), async (name) => {
    const r = await session.makeKey(name);
    if (!r.ok) keyFailedDialog(language.get(), r);
    else keySaveDialog(language.get(), r.key, true, saveKeyFile);
  });
  const onMakeKey = () => {
    const key = session.get().key;
    if (key) keyReplaceConfirm(language.get(), key, makeKey);
    else makeKey();
  };
  // GD-39: the key goes, the library stays; a key not yet downloaded is asked about first
  const forget = async () => {
    idle.keep();
    await session.forgetKey();
    toast(t(language.get(), 'keyForgotten'));
  };
  const onForgetKey = () => {
    const key = session.get().key;
    if (!key) return;
    if (key.needsExport) keyForgetConfirm(language.get(), { onDownload: onDownloadKey, onForget: forget });
    else forget();
  };
  // GD-40, SR-46: 30 minutes without input, then 60 seconds of warning
  let warning = null;
  const idle = createIdleWatch({
    keyState: () => { const key = session.get().key; return key ? (key.needsExport ? 'unsaved' : 'saved') : null; },
    onWarn: ({ unsaved, seconds }) => {
      warning = idleDialog(language.get(), { unsaved, seconds, onForget: forget, onDownload: onDownloadKey,
        onClosed: () => { warning = null; idle.keep(); } });
    },
    onTick: (seconds) => { if (warning) warning.setSeconds(seconds); },
    onExpire: () => {
      if (warning) warning.close();
      forget();
    },
  });
  // GD-23, GD-24, FDS 7.6 to 7.8: Downloaden keeps the library open; signing is a tick box
  const onDownload = async (sign = false, confirmed = false) => {
    const lang = language.get();
    const preview = await session.preview({ sign });
    const show = () => downloadDialog(lang, preview, session.get().key, {
      onCheck: () => checkDialog(lang, preview.findings, () => {}),
      onSign: (on) => onDownload(on, true),
      onCopy: () => copyDialog(lang, session.get().library.title, async (title) => {
        await session.copy(title);
        onDownload(false, true);                          // EDT-73: the copy is saved by the rules of 7.6
      }),
      onDownload: async (note) => {
        const saved = await session.save({ changed: preview.changed, changes: note, sign: preview.sign });
        if (!saved.ok) {
          saveFailedDialog(lang, saved);
          return;
        }
        offerDownload(saved.bytes, saved.fileName, LIBRARY_MIME);
        savedDialog(lang, saved);
      },
    });
    if (preview.needsConfirm && !confirmed) manifestConfirm(lang, show);
    else show();
  };
  /** EDT-23, GD-24: above the centre while a signed library lacks its key. */
  const readOnlyBar = (lang, state) => (session.isReadOnly() ? el('div', { class: 'robar', role: 'status' }, [
    icon('lock', 'inl'),
    el('span', {}, [t(lang, 'readOnly', { name: state.library.author.name, fp: state.authorFingerprint || '' })]),
    el('button', { type: 'button', class: 'btn btn-outline btn-small', on: { click: onLoadKey } }, [t(lang, 'keyLoad')]),
  ]) : null);

  let leftKey;
  let rightKey;
  let songList = null;
  let selected = null;                                    // the selected song's ID (GD-13); the centre shows it from M5.2
  let selectedLibrary = null;
  const head = el('div', { class: 'libhead' }, []);
  const select = (id) => { selected = id; render(); };
  // GD-16, EDT-32: the bin asks M-62; afterwards the neighbouring song is selected, or none
  const onDeleteSong = (id, title) => deleteSongConfirm(language.get(), title, async () => {
    const next = neighbourAfterDelete(songList ? songList.visibleIds() : [], id);
    if (await session.deleteSong(id)) select(next);
  });
  let form = null;
  const render = () => {
    const lang = language.get();
    const state = session.get();
    document.documentElement.lang = lang;
    document.title = state.library ? `${state.library.title} · ${t(lang, 'appName')}` : t(lang, 'appName');
    layout.setSplash(screen === 'splash');
    replace(layout.centre, screen === 'splash' ? splash(lang, () => { screen = 'home'; render(); })
      : el('div', {}, [readOnlyBar(lang, state), home(lang, { onOpen, onNew, onDownload: () => onDownload(), hasLibrary: Boolean(state.library), busy: state.busy })]));
    const readOnly = session.isReadOnly();
    // the selection goes with another library, or with its song
    const libraryId = state.library ? state.library.libraryId : null;
    if (libraryId !== selectedLibrary || (selected && !state.songs.some((s) => s.id === selected))) selected = null;
    selectedLibrary = libraryId;
    // GD-13: the song list, built once per library, language and read-only state; its node stays in place
    // so the search field keeps its focus while the list follows the typing
    const listKey = state.library ? `${state.generation}|${lang}|${readOnly}` : null;
    if (listKey !== rightKey) {
      rightKey = listKey;
      songList = state.library ? createSongList({ lang, readOnly, onSelect: select, onDelete: onDeleteSong }) : null;
      replace(layout.right, head, songList ? songList.node : el('p', { class: 'empty' }, [t(lang, 'noLibrary')]));
    }
    replace(head, ...libHead(lang, state, () => select(null)));
    if (songList) songList.update(state, selected);
    // GD-22: the library's fields, built once per library and language, then only updated (library-form.js)
    const formKey = state.library ? `${state.generation}|${lang}|${readOnly}` : null;
    if (formKey !== leftKey) {
      leftKey = formKey;
      form = state.library ? createLibraryForm({ lang, library: state.library, readOnly, onChange: (patch) => session.updateLibrary(patch) }) : null;
      replace(layout.left, form ? form.node : el('p', { class: 'empty' }, [t(lang, 'tileNeedLib')]));
    }
    if (form) form.update(state);
    replace(layout.bottom, ...bottomBar({ lang, onLanguage: () => language.next(),
      onAndroid: () => androidDialog(language.get()), onAbout: () => aboutDialog(language.get()),
      onOpen, onNew, onClose, onCheck, onDownload: () => onDownload(), onLoadKey, onMakeKey, onDownloadKey, onForgetKey,
      key: state.key, hasLibrary: Boolean(state.library), busy: state.busy,
      findings: state.library ? state.findings || [] : null }));
    replace(narrow, narrowPage(lang));
  };
  replace(root, banner, layout.app, narrow);
  language.onChange(render);                              // GD-17: at once, without losing work
  session.onChange(render);
  // GD-42: leaving the page with changes not yet downloaded, or a new key not yet downloaded, asks first
  const guard = createLeaveGuard({ atRisk: () => { const st = session.get(); return st.dirty || (st.key && st.key.needsExport); } });
  session.onChange(() => guard.sync());
  render();
}

start();
