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

import { el, extLink, icon, replace, setAttrs } from './dom.js';
import { toast } from './dialog.js';
import { focusHeading, markFocus, restoreFocus, trackFocus } from './focus.js';
import { installHelpKey } from './fieldhelp.js';
import { createIdleWatch } from './idle.js';
import { createLibraryForm } from './library-form.js';
import { createLeaveGuard } from './leave-guard.js';
import { createLanguage, t } from './i18n.js';
import { createLayout } from './layout.js';
import { aboutDialog, androidContent, androidDialog, bottomBar, privacyUrl } from './panels.js';
import { checkDialog, messageFor } from './check.js';
import { createLibraryClient } from './library-client.js';
import { createCryptoClient } from './crypto-client.js';
import { createSession } from './session.js';
import { createSongList, neighbourAfterDelete } from './songlist.js';
import { libraryHomeNode, songDataNode, songViewNode } from './songview.js';
import { createSongEditor } from './editor.js';
import { LIBRARY_FIELD_ID, targetOf } from './goto.js';
import { toggleLanguageMenu } from './langmenu.js';
import { addEntry, addSet, createSetList, deleteSet, moveEntry, removeEntry, renameSet, setNameProblem, setViewNode } from './sets.js';
import { closeConfirm, convertedDialog, copyDialog, deleteSetConfirm, deleteSongConfirm, downloadDialog, importFailedDialog, leaveEditorDialog, setNameDialog, idleDialog, keyFailedDialog, keyForgetConfirm, keyMakeDialog,
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

/** GD-03: the home screen's primary actions in the centre, shown while no library is open. */
function home(lang, { onOpen, onNew, onDownload, hasLibrary, busy }) {
  return el('div', { class: 'home' }, [
    el('h1', {}, [t(lang, 'homeTitle')]),
    el('p', { class: 'muted' }, [t(lang, 'homeLead')]),
    el('div', { class: 'tiles' }, [
      tile('open', t(lang, 'tileOpen'), busy ? t(lang, 'opening') : t(lang, 'tileOpenSub'), { onClick: busy ? null : onOpen }),
      tile('add', t(lang, 'tileNew'), t(lang, 'tileNewSub'), { onClick: busy ? null : onNew }),
      tile('edit', t(lang, 'tileEdit'), t(lang, 'tileNeedLib')),   // editing needs a library: the reason is the subtitle
      tile('download', t(lang, 'tileDownload'), t(lang, hasLibrary ? 'dlTitle' : 'tileNeedLib'), { onClick: hasLibrary && !busy ? onDownload : null }),
    ]),
    el('p', { class: 'note' }, [t(lang, 'privacy')]),
  ]);
}

/**
 * The right bar's head (GD-22, GD-24): the library's title, which shows its fields, and its state. The lock shows only
 * while the library is read-only (its key not loaded); signed with the key loaded, the state line says it is signed.
 */
function libHead(lang, state, onLibrary, readOnly) {
  const lib = state.library;
  if (!lib) return [el('h3', {}, [t(lang, 'songs')])];
  const status = [
    lib.isNew ? t(lang, 'newUnsaved') : t(lang, 'versionN', { v: lib.version }),
    state.dirty ? t(lang, 'changed') : null,
    lib.author ? t(lang, 'signedBy', { name: lib.author.name }) : t(lang, 'unsigned'),
  ].filter(Boolean).join(' · ');
  return [
    el('button', { type: 'button', class: 'title linklike', title: t(lang, 'libInfo'), on: { click: onLibrary } },
      [readOnly ? icon('lock', 'inl') : null, lib.title]),
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
  // EDT-41, GD-20: a message's *Ga naar* goes to its place (goToFinding, below)
  const onCheck = () => checkDialog(language.get(), session.get().findings || [], (f) => goToFinding(f));
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
      onCheck: () => checkDialog(lang, preview.findings, (f) => goToFinding(f)),
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
  let openSet = null;                                     // GD-21: the set open in the centre, by its place in sets
  let rightTab = 'songs';                                 // GD-21: *Liedjes* or *Sets*
  let setList = null;
  let tabs = null;
  let pane = null;
  // GD-22 (F12): the left bar's tabs *Liedgegevens* and *Bibliotheek*; another song goes back to its data
  let leftTab = 'song';
  let leftTabs = null;
  let leftPane = null;
  let leftShellKey;
  let lastSongKey = null;
  const showLeft = (name) => { leftTab = name; render(); };
  const select = (id) => { selected = id; openSet = null; render(); };
  // GD-16, EDT-32: the bin asks M-62; afterwards the neighbouring song is selected, or none
  const onDeleteSong = (id, title) => deleteSongConfirm(language.get(), title, async () => {
    const next = neighbourAfterDelete(songList ? songList.visibleIds() : [], id);
    if (editing && editing.id === id) editing = null;     // deleted from its own editor
    if (await session.deleteSong(id)) select(next);
  });

  // ---- M5.3a: the song editor in Blokken mode (GD-06, GD-07, GD-09, GD-19, GD-20, GD-33, GD-36)
  let editing = null;                                     // { id, title, token, editor }
  let editTokens = 0;
  const stopEditing = () => { editing = null; render(); };
  // GD-09, GD-20: Toepassen writes the blocks back in the worker and always applies; the song then shows
  const applyEdit = async () => {
    if (!editing) return true;
    const { editor } = editing;
    const lang = language.get();
    // GD-38: the song is applied in the mode that is open; code is stored canonically (EDT-57)
    const st = editor.state();
    const r = st.mode === 'code' ? await session.canonicalSong(st.text) : await session.unblocks(st.form);
    if (r.problem) {
      editor.showProblem(t(lang, 'applyProblem'));       // a form the worker cannot write: nothing applied
      return false;
    }
    // GD-20 as amended (the owner's look at dev.6): a song with an Error (no title, no language, …) is not applied;
    // the editor says why and goes to the field or line. Warnings (recommended fields) do not stop it.
    // a new song has no ID yet: its messages name it as the editor's heading does (*Nieuw lied*)
    const errors = ((await session.songCheck(editing.id || t(lang, 'newSongTitle'), r.text)).findings || [])
      .filter((f) => f.severity === 'Error' || f.severity === 'Fatal');
    if (errors.length) {
      editor.showProblem(t(lang, 'applyRefused', { n: errors.length, message: messageFor(lang, errors[0]) }));
      const to = targetOf(errors[0]);
      if (to.field) editor.focusField(to.field);
      else if (to.line) await editor.showLine(to.line);
      return false;
    }
    const isNew = editing.isNew;
    let id = editing.id;
    if (isNew) {
      // EDT-32, EDT-36: a new song is taken in by the worker, which proposes its ID from its title
      const added = await session.adoptSong(r.text);
      if (!(await session.addSong(added.id, added.text))) {
        editor.showProblem(t(lang, 'applyProblem'));
        return false;
      }
      id = added.id;
    } else {
      await session.updateSong(id, r.text);
    }
    editing = null;
    selected = id;
    render();
    // GD-25: a new song is never hidden by the filter; it has no Error, as it was refused otherwise
    toast(isNew && songList && songList.reveal(id) ? t(lang, 'filtersCleared') : t(lang, 'applied'));
    return true;
  };
  const makeEditor = ({ id, isNew = false, text, form, title }) => {
    const lang = language.get();
    return { id, isNew, title, token: ++editTokens, editor: createSongEditor({ lang, id, isNew, text, form, title,
      onApply: () => applyEdit(), onCancel: stopEditing, onDelete: () => onDeleteSong(id, title), onMode: () => render(),
      // GD-38, EDT-33: the worker turns blocks into code and code into blocks, and checks the code as it is typed
      toText: (f) => session.unblocks(f),
      toForm: async (code) => session.blocksOf((await session.canonicalSong(code)).text),
      checkCode: async (code) => (await session.songCheck(id, code)).findings,
    }) };
  };
  const startEdit = async (id) => {
    if (session.isReadOnly() || (editing && editing.id === id)) return;
    const [form, details] = await Promise.all([session.songBlocks(id), session.songDetails(id)]);
    if (!form) return;                                    // not text (SNG-01, SNG-18): nothing to show or edit
    const title = (details && details.meta && details.meta.title) || t(language.get(), 'noTitle');
    selected = id;
    editing = makeEditor({ id, text: session.get().library.songs.get(id), form, title });
    render();
    focusHeading(layout.centre);                          // M7.3: also when opened from the list's pen
  };
  // EDT-32: *Lied toevoegen* opens the editor on an empty verse; the song joins the library on Toepassen
  const NEW_SONG = { blocks: [{ type: 'section', kind: 'verse', label: null, lines: [''], implicit: false }] };
  const startNew = () => {
    if (session.isReadOnly() || !session.get().library) return;
    selected = null;
    editing = makeEditor({ id: null, isNew: true, text: '', form: NEW_SONG, title: t(language.get(), 'newSongTitle') });
    render();
    focusHeading(layout.centre);                          // M7.3: also when opened from the right bar
  };
  // EDT-32: a .cho file joins the library at once and shows; its problems are in Controle (GD-20)
  const importFile = () => pickFile(async (file) => {
    const lang = language.get();
    const r = await session.importSong(file);
    if (r.problem) {
      importFailedDialog(lang, file.name, r.problem);
      return;
    }
    if (!(await session.addSong(r.id, r.text))) return;
    selected = r.id;
    render();
    toast(songList && songList.reveal(r.id) ? t(lang, 'filtersCleared') : t(lang, 'songImported', { file: file.name }));
  }, '.cho,text/plain');
  // GD-36: an action that leaves the editor asks first when there is something to apply or throw away
  const leaving = (next) => (...args) => {
    if (!editing) return next(...args);
    if (!editing.editor.changed()) {
      editing = null;
      return next(...args);
    }
    // GD-36: a new song is named by its typed title, or *Nieuw lied*
    const title = editing.isNew ? editing.editor.currentTitle() || t(language.get(), 'newSongTitle') : editing.title;
    return leaveEditorDialog(language.get(), title, {
      onApply: async () => { if (await applyEdit()) next(...args); },
      onDiscard: () => {
        editing = null;
        toast(t(language.get(), 'discarded', { t: title }));
        render();
        next(...args);
      },
    });
  };
  const choose = leaving(select);
  const chooseEdit = leaving(startEdit);
  const onAddSong = leaving(startNew);
  const onImportSong = leaving(importFile);

  // ---- M5.5: sets (GD-21; EDT-31): the operations are pure (sets.js), the session applies them
  const sets = () => session.get().library.sets;
  const applySets = (next) => session.updateSets(next);
  const openSetAt = (i) => { selected = null; openSet = i; render(); };
  const chooseSet = leaving(openSetAt);
  const uniqueSetName = () => {
    const base = t(language.get(), 'setDefault');
    let name = base;
    for (let n = 2; setNameProblem(name, sets()) === 'taken'; n++) name = `${base} ${n}`;
    return name;
  };
  const onNewSet = () => setNameDialog(language.get(), { name: uniqueSetName(), problem: (n) => setNameProblem(n, sets()),
    onOk: async (n) => { if (await applySets(addSet(sets(), n))) chooseSet(sets().length - 1); } });
  const onRenameSet = (i) => setNameDialog(language.get(), { name: sets()[i].name, problem: (n) => setNameProblem(n, sets(), i),
    onOk: (n) => applySets(renameSet(sets(), i, n)) });
  const onDeleteSet = (i) => deleteSetConfirm(language.get(), sets()[i].name, async () => {
    if (!(await applySets(deleteSet(sets(), i)))) return;
    if (openSet === i) openSet = null;
    else if (openSet !== null && openSet > i) openSet -= 1;
    render();
  });
  const onAddToSet = (id) => (openSet === null ? null : applySets(addEntry(sets(), openSet, id)));
  const showTab = (tab) => { rightTab = tab; render(); };

  // ---- EDT-41, GD-20: *Ga naar*: from a finding to where it can be fixed (goto.js); it leaves the editor (GD-36)
  const goToFinding = leaving(async (f) => {
    const st = session.get();
    if (!st.library) return;
    const target = targetOf(f);
    if (target.kind === 'songs') {                        // SNG-10: the list shows just the songs that share the title
      rightTab = 'songs';
      layout.unfold('right');
      select(null);
      if (songList) songList.showOnly(target.ids, target.title);
      return;
    }
    if (target.kind === 'song' && st.library.songs.has(target.id)) {
      rightTab = 'songs';
      const summary = st.songs.find((x) => x.id === target.id);
      const editable = !session.isReadOnly() && summary && summary.editable !== false;
      if (!editable || (!target.field && !target.line)) {
        select(target.id);                                // read-only, not text, or nothing to point at: the song itself
        return;
      }
      await startEdit(target.id);
      if (!editing || editing.id !== target.id) return;
      if (target.line) await editing.editor.showLine(target.line);
      else {
        // the field is in the left bar: open it on the song's tab first, so the cursor is seen (the owner's look at dev.6)
        layout.unfold('left');
        showLeft('song');
        editing.editor.focusField(target.field);
      }
      return;
    }
    if (target.kind === 'set') {
      rightTab = 'sets';
      const i = st.library.sets.findIndex((x) => x.name === target.name);
      if (i >= 0) openSetAt(i);
      else render();
      return;
    }
    select(null);                                         // the library's home and its fields
    if (target.field) {
      layout.unfold('left');
      showLeft('library');
    }
    if (target.add) {                                     // STR-02, no songs: to *Lied toevoegen* on the library's home
      const add = layout.centre.querySelector('.home .addrow button:not([disabled])');
      if (add) add.focus();
      return;
    }
    let field = target.field ? document.getElementById(LIBRARY_FIELD_ID[target.field]) : null;
    if (field && field.closest('[hidden]')) field = document.getElementById('lib-license');   // the SPDX field shows with Andere licentie
    if (field && !field.disabled) {
      field.focus();
      field.scrollIntoView?.({ block: 'center' });
    }
  });
  let form = null;
  let shown = { id: null, text: undefined, details: null };   // the selected song's view, from the worker
  let lastCentre;
  let lastView = null;
  let guard = null;
  const draw = () => {
    const lang = language.get();
    const state = session.get();
    document.documentElement.lang = lang;
    document.title = state.library ? `${state.library.title} · ${t(lang, 'appName')}` : t(lang, 'appName');
    layout.setSplash(screen === 'splash');
    const readOnly = session.isReadOnly();
    // the selection goes with another library, or with its song
    const libraryId = state.library ? state.library.libraryId : null;
    if (libraryId !== selectedLibrary || (selected && !state.songs.some((s) => s.id === selected))) selected = null;
    if (libraryId !== selectedLibrary || !state.library || openSet === null || openSet >= state.library.sets.length) openSet = null;
    selectedLibrary = libraryId;
    const theSet = openSet !== null ? state.library.sets[openSet] : null;
    // GD-13, GD-19: the selected song, parsed by the worker once per text; a late answer for another song is dropped
    const text = selected ? state.library.songs.get(selected) : undefined;
    if (!selected) shown = { id: null, text: undefined, details: null };
    else if (shown.id !== selected || shown.text !== text) {
      const want = { id: selected, text, details: null };
      shown = want;
      const done = (details) => { if (shown === want) { want.details = details || { sections: null, meta: null }; render(); } };
      session.songDetails(selected).then(done, () => done(null));
    }
    // the centre is redrawn only when what it shows changes, so the reader keeps their place in a song
    if (editing && (!state.library || (!editing.isNew && !state.library.songs.has(editing.id)) || readOnly)) editing = null;   // gone, or the key forgotten
    const centreKey = JSON.stringify([screen, lang, readOnly, state.authorFingerprint, Boolean(state.library), state.busy,
      state.library ? [state.library.title, state.songs.length] : null, selected, shown.details ? shown.text : null, editing ? editing.token : 0,
      theSet && !selected && !editing ? [openSet, theSet, state.songs.map((x) => [x.id, x.title, x.language])] : null]);
    if (centreKey !== lastCentre) {
      lastCentre = centreKey;
      // a set that changes is drawn again where the reader was in it
      const view = editing ? 'edit' : selected ? `song:${selected}` : theSet ? `set:${openSet}` : 'home';
      const keep = view === lastView && view.startsWith('set:') ? layout.centre.scrollTop : null;
      lastView = view;
      const content = !state.library ? home(lang, { onOpen, onNew, onDownload: () => onDownload(), hasLibrary: false, busy: state.busy })
        : editing ? editing.editor.node                    // the same editor node: typing is never lost to a redraw
          : !selected && theSet ? setViewNode(lang, { set: theSet, songs: state.songs, readOnly, onRename: () => onRenameSet(openSet),
            onRemove: (k) => applySets(removeEntry(sets(), openSet, k)), onMoveEntry: (from, to) => applySets(moveEntry(sets(), openSet, from, to)) })
          : !selected ? libraryHomeNode(lang, state, { readOnly, onAdd: onAddSong, onImport: onImportSong })
            : shown.details ? songViewNode(lang, selected, shown.details, { readOnly, onDelete: leaving(onDeleteSong), onEdit: chooseEdit })
              : el('p', { class: 'empty' }, ['…']);
      replace(layout.centre, screen === 'splash' ? splash(lang, () => { screen = 'home'; render(); })
        : el('div', { class: 'centrewrap' }, [readOnlyBar(lang, state), content]));   // F10: the content sits on a box
      if (keep !== null) layout.centre.scrollTop = keep;
    }
    // GD-13: the song list, built once per library, language and read-only state; its node stays in place
    // so the search field keeps its focus while the list follows the typing
    const listKey = state.library ? `${state.generation}|${lang}|${readOnly}` : null;
    if (listKey !== rightKey) {
      rightKey = listKey;
      songList = state.library ? createSongList({ lang, readOnly, onSelect: choose, onEdit: chooseEdit, onDelete: leaving(onDeleteSong),
        onAdd: onAddSong, onImport: onImportSong, onAddToSet }) : null;
      // GD-21: two tabs, *Liedjes* and *Sets*; both lists stay built, so switching keeps the search
      setList = state.library ? createSetList({ lang, readOnly, onOpen: chooseSet, onNew: onNewSet, onRename: onRenameSet,
        onDelete: onDeleteSet }) : null;
      const tab = (name) => el('button', { type: 'button', role: 'tab', class: 'tab', id: `rtab-${name}`, 'aria-controls': 'rpane', 'data-tab': name,
        on: { click: () => showTab(name) } }, []);
      tabs = state.library ? el('div', { class: 'tabs', role: 'tablist', 'aria-label': t(lang, 'rightTabs') }, [tab('songs'), tab('sets')]) : null;
      pane = el('div', { class: 'tabpane', role: 'tabpanel', id: 'rpane' }, []);
      replace(layout.right, head, ...(state.library ? [tabs, pane] : [el('p', { class: 'empty' }, [t(lang, 'noLibrary')])]));
    }
    replace(head, ...libHead(lang, state, () => choose(null), readOnly));
    if (tabs) {
      for (const b of tabs.children) {
        const name = b.getAttribute('data-tab');
        const count = name === 'songs' ? state.songs.length : state.library.sets.length;
        b.replaceChildren(`${t(lang, name)} (${count})`);
        setAttrs(b, { 'aria-selected': name === rightTab ? 'true' : 'false', class: name === rightTab ? 'tab on' : 'tab' });
      }
      setAttrs(pane, { 'aria-labelledby': `rtab-${rightTab === 'sets' ? 'sets' : 'songs'}` });
      const want = rightTab === 'sets' ? setList.node : songList.node;
      if (pane.firstChild !== want) pane.replaceChildren(want);
    }
    const showsSet = theSet && !selected && !editing;
    if (songList) songList.update(state, selected, showsSet ? theSet : null);
    if (setList) setList.update(state, showsSet ? openSet : null);
    // GD-05: a selected song's data, read-only until the song editor (M5.3); GD-22: otherwise the library's
    // fields, built once per library and language, then only updated (library-form.js)
    // F12: two tabs while a library is open; the song's only while a song is selected or edited
    const songKey = editing ? `edit|${editing.token}` : selected ? `song|${selected}` : null;
    if (songKey !== lastSongKey) {
      lastSongKey = songKey;
      if (songKey) leftTab = 'song';
    }
    const showSong = Boolean(songKey) && leftTab === 'song';
    const shellKey = state.library ? `${state.generation}|${lang}` : null;
    if (shellKey !== leftShellKey) {
      leftShellKey = shellKey;
      const ltab = (name, label) => el('button', { type: 'button', role: 'tab', class: 'tab', id: `ltab-${name}`, 'aria-controls': 'lpane', 'data-tab': name,
        on: { click: () => showLeft(name) } }, [label]);
      leftTabs = state.library ? el('div', { class: 'tabs', role: 'tablist', 'aria-label': t(lang, 'leftTabs') },
        [ltab('song', t(lang, 'songData')), ltab('library', t(lang, 'library'))]) : null;
      leftPane = el('div', { class: 'tabpane', role: state.library ? 'tabpanel' : null, id: 'lpane' }, []);
      replace(layout.left, leftTabs, leftPane);
      leftKey = undefined;                                // the pane is new: draw its content again
    }
    if (leftTabs) {
      for (const b of leftTabs.children) {
        const name = b.getAttribute('data-tab');
        const on = name === (showSong ? 'song' : 'library');
        if (on) setAttrs(leftPane, { 'aria-labelledby': `ltab-${name}` });
        setAttrs(b, { 'aria-selected': String(on), class: on ? 'tab on' : 'tab', disabled: name === 'song' && !songKey,
          title: name === 'song' && !songKey ? t(lang, 'chooseSong') : null });
      }
    }
    if (showSong) {
      leftKey = `song|${selected}`;
      form = null;
      if (editing && editing.editor.mode() === 'blocks') {
        // GD-05, EDT-34: the song's fields while editing in Blokken; the same node stays, so typing keeps its focus
        const fieldsNode = editing.editor.fieldsNode();
        if (leftPane.firstChild !== fieldsNode) replace(leftPane, fieldsNode);
      } else {
        replace(leftPane, editing
          ? el('div', { class: 'libform' }, [el('h3', {}, [t(lang, 'songData')]), el('p', { class: 'muted' }, [t(lang, 'textModeLeft')])])
          : shown.details ? songDataNode(lang, selected, shown.details) : el('p', { class: 'empty' }, ['…']));
      }
    }
    const formKey = state.library ? `${state.generation}|${lang}|${readOnly}` : null;
    if (!showSong && formKey !== leftKey) {
      leftKey = formKey;
      form = state.library ? createLibraryForm({ lang, library: state.library, readOnly, onChange: (patch) => session.updateLibrary(patch) }) : null;
      replace(leftPane, form ? form.node : el('p', { class: 'empty' }, [t(lang, 'tileNeedLib')]));
    }
    if (form) form.update(state);
    // F6, F12: the strips of folded bars: left the song's data (while there is a song) and the library's fields
    layout.setStrip('left', [
      ...(songKey ? [{ icon: 'musicNote', label: t(lang, 'songData'), onClick: () => showLeft('song') }] : []),
      { icon: 'library', label: t(lang, 'library'), onClick: state.library ? () => showLeft('library') : null }]);
    layout.setStrip('right', [{ icon: 'list', label: t(lang, 'songs'), onClick: state.library ? () => showTab('songs') : null },
      ...(state.library ? [{ icon: 'playlist', label: t(lang, 'sets'), onClick: () => showTab('sets') }] : [])]);
    replace(layout.bottom, ...bottomBar({ lang, onLanguage: (event) => toggleLanguageMenu(lang, event.currentTarget, (l) => language.set(l)),
      onAndroid: () => androidDialog(language.get()), onAbout: () => aboutDialog(language.get()),
      onOpen: leaving(onOpen), onNew: leaving(onNew), onClose: leaving(onClose), onCheck, onDownload: leaving(() => onDownload()),
      onEdit: () => { if (selected) chooseEdit(selected); },
      canEdit: Boolean(selected && !editing && !readOnly && state.songs.some((s) => s.id === selected && s.editable !== false)),
      onLoadKey, onMakeKey, onDownloadKey, onForgetKey,
      key: state.key, hasLibrary: Boolean(state.library), busy: state.busy,
      findings: state.library ? state.findings || [] : null }));
    replace(narrow, narrowPage(lang));
    if (guard) guard.sync();
  };
  // M7.3, WCAG 2.4.3: a redraw that removes the focused control keeps the keyboard's place (focus.js)
  const regions = [layout.left, layout.centre, layout.right, layout.bottom];
  trackFocus(regions);
  installHelpKey();                                       // GD-44: F1 in a field opens its explanation
  const render = () => {
    const mark = markFocus(regions);
    draw();
    restoreFocus(mark);
  };
  replace(root, banner, layout.app, narrow);
  language.onChange(render);                              // GD-17: at once, without losing work
  session.onChange(render);
  // GD-42: leaving the page with changes not yet downloaded, or a new key not yet downloaded, asks first
  // and so does an open song editor with changes not yet applied (GD-36): it is listened for while the editor is open
  guard = createLeaveGuard({
    atRisk: () => { const st = session.get(); return st.dirty || Boolean(st.key && st.key.needsExport) || Boolean(editing && editing.editor.changed()); },
    listenWhen: () => { const st = session.get(); return st.dirty || Boolean(st.key && st.key.needsExport) || Boolean(editing); },
  });
  session.onChange(() => guard.sync());
  render();
}

start();
