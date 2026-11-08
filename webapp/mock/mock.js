// SPDX-License-Identifier: Apache-2.0
// Mock of design/webappGUI.md draft 0.7 (GD-03 to GD-35). Clickable, in memory only:
// no library or key is read, written or sent anywhere. Only the language and the side-bar
// widths are kept in the browser's local storage (GD-34). Texts: i18n.js (GD-17).
'use strict';

// ---- Icons: Google Material Icons path data (Apache License 2.0), 24 x 24 viewBox. ----
// about, library, list, chevrons: copied from the Zangbundel app (android/app/src/main/res/drawable).
const ICONS = {
  musicNote: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  arrowLeft: 'M14 7l-5 5 5 5V7z',
  arrowRight: 'M10 17l5-5-5-5v10z',
  about: 'M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10 10,-4.48 10,-10S17.52,2 12,2zM13,17h-2v-6h2v6zM13,9h-2L11,7h2v2z',
  library: 'M18,2H6c-1.1,0 -2,0.9 -2,2v16c0,1.1 0.9,2 2,2h12c1.1,0 2,-0.9 2,-2V4c0,-1.1 -0.9,-2 -2,-2zM6,4h5v8l-2.5,-1.5L6,12V4z',
  list: 'M3,13h2v-2H3v2zm0,4h2v-2H3v2zm0,-8h2V7H3v2zm4,4h14v-2H7v2zm0,4h14v-2H7v2zM7,7v2h14V7H7z',
  up: 'M12,8l-6,6 1.41,1.41L12,10.83l4.59,4.58L18,14z',
  down: 'M16.59,8.59L12,13.17 7.41,8.59 6,10l6,6 6,-6z',
  left: 'M15.41,7.41L14,6l-6,6 6,6 1.41,-1.41L10.83,12z',
  right: 'M10,6L8.59,7.41 13.17,12l-4.58,4.59L10,18l6,-6z',
  open: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  drag: 'M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  key: 'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
  upload: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z',
  android: 'M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  lang: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  error: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',                                   // filled triangle (GD-29)
  warning: 'M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z',      // outlined triangle
  info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
  playlist: 'M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z',
};
const icon = (n, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''}><path d="${ICONS[n]}"/></svg>`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const $ = (id) => document.getElementById(id);

// ---- Language (GD-17, GD-34) ----
const store = {                                        // local storage, never library content or keys (GD-34)
  get(k) { try { return localStorage.getItem('zbm.' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('zbm.' + k, v); } catch (e) { /* not available: defaults next time */ } },
};
const S = {};
S.lang = STR[store.get('lang')] ? store.get('lang') : browserLanguage();
const t = (key, vars = {}) => String((STR[S.lang] && STR[S.lang][key]) ?? STR.en[key] ?? key).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const LANG_LABEL = { nl: 'Nederlands', en: 'English', de: 'Deutsch' };

// Design-ID badges for reviewing the mock (toggle in the mock bar).
const gd = (id) => `<span class="gq" title="design/webappGUI.md">${id}</span>`;

const SONG_LANGS = [['nl', 'Nederlands'], ['en', 'English'], ['de', 'Deutsch'], ['fy', 'Frysk'], ['fr', 'Français']];
const langName = (c) => (SONG_LANGS.find((l) => l[0] === c) || [c, c || '—'])[1];
const LICENSES = {
  'CC-BY-NC-4.0': { nl: 'Vrij te delen en te bewerken, niet commercieel, met naamsvermelding.', en: 'Free to share and adapt, non-commercial, with credit.', de: 'Frei zu teilen und zu bearbeiten, nicht kommerziell, mit Namensnennung.' },
  'CC-BY-SA-4.0': { nl: 'Vrij te delen en te bewerken, met naamsvermelding, onder dezelfde licentie.', en: 'Free to share and adapt, with credit, under the same licence.', de: 'Frei zu teilen und zu bearbeiten, mit Namensnennung, unter gleicher Lizenz.' },
  'CC0-1.0': { nl: 'Vrij van rechten: alles mag.', en: 'No rights reserved: anything goes.', de: 'Rechtefrei: alles ist erlaubt.' },
  mixed: { nl: 'Elk lied heeft zijn eigen licentie.', en: 'Each song has its own licence.', de: 'Jedes Lied hat seine eigene Lizenz.' },
  proprietary: { nl: 'Alleen voor eigen gebruik; niet verder verspreiden.', en: 'For own use only; do not pass on.', de: 'Nur für den eigenen Gebrauch; nicht weitergeben.' },
};

// ---- Sample libraries: songs that are traditional (public domain) or written for this mock ----
const VUUR = [
  { kind: 'verse', label: '', text: 'De [G]zon gaat onder [D]achter het bos,\nde [C]tenten staan, de [G]dag is los.\nWe halen hout, we zoeken stenen,\nen rond het vuur zijn wij verschenen.' },
  { kind: 'chorus', label: '', text: 'Zing maar mee, zing maar mee,\nde vonken dansen, wij doen mee.' },
  { kind: 'verse', label: '', text: 'De sterren komen één voor één,\nniemand zit hier nog alleen.\nEen lied, een lach, een warme hand,\nde nacht valt zacht over het land.' },
  { kind: 'repeat', label: '', text: '' },
  { kind: 'locked', label: '', text: '{comment: langzamer, zachter}' },
  { kind: 'bridge', label: '', text: 'En als het vuur nog even gloeit,\nis het de dag die verder groeit.' },
  { kind: 'repeat', label: 'Refrein (2x)', text: '' },
];
function sampleLibrary() {
  return {
    id: '3f6c2a1e-8b4d-4c1a-9e2f-7d5b0a6c9e11', title: 'Troep 12 Kampvuurliedjes', description: 'Liedjes voor kampen en kampvuren.',
    version: 4, license: { id: 'CC-BY-NC-4.0', summary: LICENSES['CC-BY-NC-4.0'].nl }, maintainer: { name: 'Leiding Troep 12', contact: 'leiding@troep12.example.org' }, signed: null,
    songs: [
      { id: 'vader-jacob', title: 'Vader Jacob', language: 'nl', lyricist: 'traditioneel', composer: 'traditioneel', copyright: 'Public domain', license: 'public-domain', source: 'overgeleverd', tags: ['canon', 'welpen'],
        sections: [{ kind: 'locked', label: '', text: '# Canon in vier groepen' }, { kind: 'verse', label: '', text: 'Vader Jacob, Vader Jacob,\nslaapt gij nog, slaapt gij nog?\nAlle klokken luiden, alle klokken luiden,\nbim bam bom, bim bam bom.' }] },
      { id: 'vuur-in-de-kring', title: 'Vuur in de kring', language: 'nl', lyricist: 'Mock-team', composer: 'Mock-team', copyright: '2026 Zangbundel-project', license: 'CC0-1.0', source: 'geschreven voor de mock', tags: ['kampvuur'], sections: clone(VUUR) },
      { id: 'the-mock-song', title: 'The Mock Song', language: 'en', lyricist: 'Mock team', composer: '', copyright: '', license: '', source: 'written for the mock', tags: [],
        sections: [{ kind: 'verse', label: '', text: 'We pack the bags, we walk the trail,\nwe sing until the stars grow pale.' }, { kind: 'chorus', label: '', text: 'Hey ho, the fire glows,\nand everybody sings along.' }] },
      { id: 'lied-zonder-taal', title: 'Lied zonder taal', language: '', lyricist: 'Mock-team', composer: 'Mock-team', copyright: '2026 Zangbundel-project', license: 'CC0-1.0', source: 'geschreven voor de mock', tags: ['kampvuur'],
        sections: [{ kind: 'verse', label: '', text: 'Dit lied laat zien hoe een fout eruitziet:\nde taal ontbreekt nog.' }] },
    ],
    sets: [{ name: 'Kampvuur', songs: ['vuur-in-de-kring', 'vader-jacob'] }, { name: 'Zomerkamp 2026', songs: ['the-mock-song', 'vuur-in-de-kring'] }, { name: 'Bonte avond', songs: [] }],
  };
}
const AKELA = { name: 'Akela', fp: 'A1B2-C3D4-E5F6-0718' };
function signedLibrary() {
  const a = sampleLibrary();
  return { id: '9d2e4b10-6a7f-4c3e-8b1d-2f5a6c7d8e90', title: 'Welpen-liedjes', description: 'Liedjes voor de welpen.', version: 2,
    license: { id: 'CC-BY-SA-4.0', summary: LICENSES['CC-BY-SA-4.0'].nl }, maintainer: { name: 'Akela', contact: 'https://welpen.example.org' }, signed: clone(AKELA),
    songs: [a.songs[0], a.songs[1]], sets: [{ name: 'Opening', songs: ['vader-jacob'] }] };
}

// ---- State ----
Object.assign(S, {
  screen: 'splash', lib: null, sel: null, view: 'song', mode: 'view', draft: null, textMode: false, textDraft: '',
  dirty: false, tab: 'songs', openSet: null, key: null, splashTimer: null,
});
const selSong = () => (S.lib && S.sel ? S.lib.songs.find((s) => s.id === S.sel) : null);
const readOnly = () => !!(S.lib && S.lib.signed && !(S.key && S.key.fp === S.lib.signed.fp));   // EDT-23, GD-24

// ---- ChordPro: serialize and parse the song profile parts the section editor knows (GD-18, GD-19) ----
const ENV = { verse: 'verse', chorus: 'chorus', bridge: 'bridge' };
function toChordPro(s) {
  const L = [];
  const d = (name, v) => { if (v) L.push(`{${name}: ${v}}`); };
  d('title', s.title); if (s.id) L.push(`{meta: id ${s.id}}`); if (s.language) L.push(`{meta: language ${s.language}}`);
  d('lyricist', s.lyricist); d('composer', s.composer); d('copyright', s.copyright);
  if (s.license) L.push(`{meta: license ${s.license}}`); if (s.source) L.push(`{meta: source ${s.source}}`);
  normTags(s.tags).forEach((tag) => L.push(`{meta: tag ${tag}}`));
  s.sections.forEach((x) => {
    L.push('');
    if (ENV[x.kind]) { L.push(`{start_of_${x.kind}${x.label ? ': ' + x.label : ''}}`); L.push(x.text); L.push(`{end_of_${x.kind}}`); }
    else if (x.kind === 'repeat') L.push(`{chorus${x.label ? ': ' + x.label : ''}}`);
    else L.push(x.text);
  });
  return L.join('\n') + '\n';
}
function fromChordPro(text) {
  const song = { title: '', language: '', lyricist: '', composer: '', copyright: '', license: '', source: '', tags: [], id: '', sections: [] };
  const SHORT = { sov: 'start_of_verse', eov: 'end_of_verse', soc: 'start_of_chorus', eoc: 'end_of_chorus', sob: 'start_of_bridge', eob: 'end_of_bridge', t: 'title' };
  let env = null, buf = [], label = '', locked = [];
  const flushLocked = () => { if (locked.length) { song.sections.push({ kind: 'locked', label: '', text: locked.join('\n') }); locked = []; } };
  text.replace(/\r\n?/g, '\n').split('\n').forEach((line) => {
    const m = line.trim().match(/^\{\s*([A-Za-z_]+)\s*(?::\s*(.*?))?\s*\}$/);
    const name = m ? (SHORT[m[1].toLowerCase()] || m[1].toLowerCase()) : null, val = m ? (m[2] || '') : '';
    if (env) {
      if (name === 'end_of_' + env) { song.sections.push({ kind: env, label, text: buf.join('\n') }); env = null; buf = []; }
      else buf.push(line);
      return;
    }
    const start = name && name.match(/^start_of_(verse|chorus|bridge)$/);
    if (start) { flushLocked(); env = start[1]; label = val; buf = []; return; }
    if (name === 'chorus') { flushLocked(); song.sections.push({ kind: 'repeat', label: val, text: '' }); return; }
    if (['title', 'lyricist', 'composer', 'copyright'].includes(name)) { song[name] = val; return; }
    if (name === 'meta') {
      const [k, ...rest] = val.split(/\s+/); const v = rest.join(' ');
      if (k === 'tag') song.tags.push(v); else if (['id', 'language', 'license', 'source'].includes(k)) song[k] = v; else locked.push(line);
      return;
    }
    if (!line.trim()) { flushLocked(); return; }
    locked.push(line);                                   // anything else stays as it is: a locked block
  });
  if (env) song.sections.push({ kind: env, label, text: buf.join('\n') });
  flushLocked();
  return song;
}
const braceProblems = (text) => text.split('\n').map((l, i) => {
  const s = l.trim();
  return (s.startsWith('{') !== s.endsWith('}')) ? i + 1 : 0;
}).filter(Boolean);

// ---- Validation (GD-20, GD-29; FDS §6.6, M-nn) ----
const hasLyrics = (s) => s.sections.some((x) => ENV[x.kind] && x.text.trim());
function songIssues(s) {
  const out = [], at = (sev, msg, field) => out.push({ sev, msg, song: s.id, field });
  if (!s.title.trim()) at('error', t('M51'), 'title');
  if (!s.language) at('error', t('M49'), 'language');
  if (!hasLyrics(s)) at('error', t('M58'), 'sections');
  const missing = [];
  if (!s.lyricist && !s.composer) missing.push(t('fieldWho'));
  if (!s.copyright) missing.push(t('fieldCopyright'));
  if (!s.license) missing.push(t('fieldLicense'));
  if (!s.source) missing.push(t('fieldSource'));
  if (!normTags(s.tags).length) missing.push(t('fieldTag'));
  if (missing.length) at('warning', t('M44', { field: missing.join(', ') }), !s.lyricist && !s.composer ? 'lyricist' : !s.copyright ? 'copyright' : !s.license ? 'license' : !s.source ? 'source' : 'tags');
  if (s.sections.some((x) => x.kind === 'locked')) at('info', t('M56', { t: s.title }), 'sections');
  return out;
}
function libraryIssues() {
  if (!S.lib) return [];
  const L = S.lib, out = [];
  if (!L.license.id || !L.license.summary.trim()) out.push({ sev: 'error', msg: t('M29'), lib: 'license' });
  if (!L.maintainer.name.trim() || !L.maintainer.contact.trim()) out.push({ sev: 'error', msg: t('M39'), lib: 'maintainer' });   // MAN-08, GD-37
  if (!L.songs.length) out.push({ sev: 'warning', msg: t('M11'), lib: 'title' });
  L.songs.forEach((s) => out.push(...songIssues(s)));
  const seen = {};
  L.songs.forEach((s) => { const k = s.title.trim().toLowerCase(); if (k) (seen[k] = seen[k] || []).push(s); });
  Object.values(seen).filter((g) => g.length > 1).forEach((g) => out.push({ sev: 'warning', msg: t('M59', { t: g[0].title }), song: g[1].id, field: 'title' }));
  L.sets.forEach((st, i) => { if (!st.songs.length) out.push({ sev: 'warning', msg: t('M13', { set: st.name }), set: i }); });
  return out;
}
const SEV_ORDER = { error: 0, warning: 1, info: 2 };
const worst = (issues) => issues.slice().sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev])[0];
const sevIcon = (sev) => icon(sev, 'sev sev-' + sev);
const sevWord = (sev) => t(sev === 'error' ? 'sevError' : sev === 'warning' ? 'sevWarning' : 'sevInfo');

// ---- Render ----
function render() {
  document.documentElement.lang = S.lang;
  document.title = t('appName') + ' (mock)';
  document.querySelector('.app').classList.toggle('onsplash', S.screen === 'splash');
  renderLeft(); renderCentre(); renderRight(); renderBottom(); renderNarrow(); applyBars();
}

function renderBottom() {
  const hasLib = !!S.lib, ro = readOnly();
  const iss = libraryIssues(), ne = iss.filter((x) => x.sev === 'error').length, nw = iss.filter((x) => x.sev === 'warning').length;
  $('bottom').className = 'bottom' + (S.screen === 'splash' ? ' greyed' : '');
  $('bottom').innerHTML = `
    <button class="navbtn" data-act="open">${icon('open')}${t('open')}</button>
    <button class="navbtn" data-act="new">${icon('add')}${t('new')}</button>
    <button class="navbtn ${S.mode === 'edit' ? 'active' : ''}" data-act="edit" ${hasLib && selSong() && !ro ? '' : 'disabled'}>${icon('edit')}${t('edit')}</button>
    <button class="navbtn ${S.dirty ? 'dirty' : ''}" data-act="download" ${hasLib ? '' : 'disabled'}><span class="dot"></span>${icon('download')}${t('download')}</button>
    <button class="navbtn" data-act="close" ${hasLib ? '' : 'disabled'}>${icon('close')}${t('close')}</button>
    <span class="nav-sep"></span>
    <button class="navbtn" data-act="check" ${hasLib ? '' : 'disabled'}>
      <span class="ckcount">${hasLib && ne ? `<b class="e">${ne}</b>` : ''}${hasLib && nw ? `<b class="w">${nw}</b>` : ''}</span>${icon(ne ? 'error' : nw ? 'warning' : 'check')}${t('check')}</button>
    <span class="nav-sep"></span>
    <span class="navgroup" title="${S.key ? esc(S.key.name + ' · ' + S.key.fp) : esc(t('noKey'))}">
      <button class="navbtn" data-act="keymake">${icon('key')}${t('keyMake')}</button>
      <button class="navbtn" data-act="keyload">${icon('upload')}${t('keyLoad')}</button>
      <button class="navbtn ${S.key && !S.key.saved ? 'dirty' : ''}" data-act="keydl" ${S.key ? '' : 'disabled'}><span class="dot"></span>${icon('download')}${t('keyDownload')}</button>
      <button class="navbtn" data-act="keyforget" ${S.key ? '' : 'disabled'}>${icon('close')}${t('keyForget')} ${gd('GD-39')}</button>
      <span class="navgroup-label">${S.key ? esc(S.key.name) + ' · ' + S.key.fp : esc(t('noKey'))}</span>
    </span>
    <span class="nav-sep"></span>
    <button class="navbtn" data-act="android">${icon('android')}${t('android')}</button>
    <button class="navbtn langbtn" data-act="lang" aria-haspopup="true" title="${esc(t('language'))}">${icon('lang')}${S.lang.toUpperCase()}</button>
    <button class="navbtn" data-act="about">${icon('about')}${t('about')}</button>`;
}

function renderRight() {
  const r = $('right');
  if (!S.lib) {
    r.className = 'right greyed';
    r.innerHTML = `<div class="libhead"><h3>${t('songs')}</h3></div><div class="empty">${t('noLibrary')}</div>`;
    return;
  }
  r.className = 'right';
  const L = S.lib;
  r.innerHTML = `
    <div class="libhead">
      <button class="title linklike" data-act="libinfo" title="${esc(t('libInfo'))}">${L.signed ? icon('lock', 'inl') : ''}${esc(L.title)}</button>
      <div class="muted small">${L.version ? t('versionN', { v: L.version }) : t('newUnsaved')}${S.dirty ? ' · ' + t('changed') : ''} ·
        ${L.signed ? esc(t('signedBy', { name: L.signed.name })) + ' · <span class="songid">' + L.signed.fp + '</span>' : t('unsigned')}</div>
    </div>
    <div class="tabs" role="tablist">
      <button role="tab" class="tab ${S.tab === 'songs' ? 'on' : ''}" aria-selected="${S.tab === 'songs'}" data-tab="songs">${t('songs')} (${L.songs.length})</button>
      <button role="tab" class="tab ${S.tab === 'sets' ? 'on' : ''}" aria-selected="${S.tab === 'sets'}" data-tab="sets">${t('sets')} (${L.sets.length}) ${gd('GD-21')}</button>
    </div>
    ${S.tab === 'songs' ? songsTab() : setsTab()}`;
  if (S.tab === 'songs') renderSongList();
}

function songsTab() {
  const L = S.lib, f = S.filter;
  const langs = [...new Set(L.songs.map((s) => s.language).filter(Boolean))].sort();
  const tags = [...new Set(L.songs.flatMap((s) => s.tags))].sort((a, b) => a.localeCompare(b, S.lang));
  const chip = (kind, v, label) => {
    const on = f[kind].includes(v);
    return `<button class="fchip ${on ? 'on' : ''}" data-chip="${kind}:${esc(v)}" aria-pressed="${on}">${on ? icon('check') : ''}${esc(label)}</button>`;
  };
  return `${L.songs.length ? `
    <div class="sbtools">
      <input id="q" class="search" type="search" placeholder="${esc(t('search'))}" aria-label="${esc(t('search'))}" value="${esc(f.query)}" autocomplete="off">
      <div class="tbrow">
        <label class="switch"><input type="checkbox" id="intext" ${f.inText ? 'checked' : ''}><span class="track"></span><span>${t('inText')}</span></label>
        <button class="btn btn-text btn-small" data-sort="1" title="${esc(t('reverse'))}">${f.desc ? 'Z–A' : 'A–Z'}</button>
      </div>
      ${langs.length > 1 || tags.length ? `<div class="chipbar">${chipArrow(-1)}<div class="chiprow">${langs.length > 1 ? langs.map((l) => chip('langs', l, langName(l))).join('') : ''}${tags.map((x) => chip('tags', x, x)).join('')}</div>${chipArrow(1)}</div>` : ''}
      <div id="clearwrap"></div>
    </div>` : `<div class="empty">${t('libEmpty')}</div>`}
    <ul class="songlist" id="songlist"></ul>
    <div class="listfoot"><button class="btn btn-outline" data-act="newsong" ${readOnly() ? 'disabled' : ''}>${icon('add')}${t('newSong')}</button></div>`;
}

// GD-13 (2026-11-08, the owner's M5 review F1): a triangle at each end of the chip row while chips are hidden on that
// side; a click brings the next hidden chip into view. The row's scrollbar is hidden.
const chipArrow = (dir) => `<button class="chiparrow" data-chipstep="${dir}" hidden tabindex="-1" aria-label="${esc(t(dir < 0 ? 'chipsBack' : 'chipsMore'))}" title="${esc(t(dir < 0 ? 'chipsBack' : 'chipsMore'))}">${icon(dir < 0 ? 'arrowLeft' : 'arrowRight')}</button>`;
function chipArrows() {
  for (const bar of document.querySelectorAll('.chipbar')) {
    const row = bar.querySelector('.chiprow');
    const over = row.scrollWidth > row.clientWidth + 1;
    const [back, more] = bar.querySelectorAll('.chiparrow');
    back.hidden = more.hidden = !over;
    back.classList.toggle('off', row.scrollLeft <= 1);
    more.classList.toggle('off', row.scrollLeft + row.clientWidth >= row.scrollWidth - 1);
  }
}
function chipStep(btn, dir) {
  const row = btn.parentElement.querySelector('.chiprow');
  const r = row.getBoundingClientRect();
  const chips = [...row.children].map((c) => c.getBoundingClientRect());
  const next = dir > 0 ? chips.find((c) => c.right > r.right + 1) : chips.reverse().find((c) => c.left < r.left - 1);
  if (next) row.scrollBy({ left: dir > 0 ? next.right - r.right : next.left - r.left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
document.addEventListener('scroll', (e) => { if (e.target.classList && e.target.classList.contains('chiprow')) chipArrows(); }, true);
window.addEventListener('resize', chipArrows);
new MutationObserver(chipArrows).observe(document.body, { childList: true, subtree: true });

// ---- Song list: search, sort and filters as the app's songbook (GD-13) ----
const DEFAULT_FILTER = () => ({ query: '', inText: false, desc: false, langs: [], tags: [] });
S.filter = DEFAULT_FILTER();
const fold = (s) => String(s || '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();
const filterIsDefault = () => JSON.stringify(S.filter) === JSON.stringify(DEFAULT_FILTER());
function visibleSongs() {
  const f = S.filter, words = f.query.split(' ').map(fold).filter(Boolean);
  const coll = new Intl.Collator(S.lang, { sensitivity: 'base' });
  const shown = S.lib.songs.filter((s) => (!f.langs.length || f.langs.includes(s.language)) && (!f.tags.length || s.tags.some((x) => f.tags.includes(x))) &&
    (!words.length || words.every((w) => (f.inText ? fold(s.sections.map((x) => x.text).join('\n')) : fold(s.title)).includes(w))));
  shown.sort((a, b) => coll.compare(a.title, b.title));
  return f.desc ? shown.reverse() : shown;
}
function renderSongList() {
  const ul = $('songlist');
  if (!ul || !S.lib) return;
  const rows = visibleSongs(), ro = readOnly();
  const set = S.openSet !== null ? S.lib.sets[S.openSet] : null;
  ul.innerHTML = rows.length || !S.lib.songs.length ? rows.map((s) => {
    const w = worst(songIssues(s).filter((x) => x.sev !== 'info'));
    const inSet = set && set.songs.includes(s.id);
    return `
    <li class="song ${s.id === S.sel && S.view === 'song' ? 'selected' : ''}" data-song="${esc(s.id)}" tabindex="0" title="${esc(t('clickToView'))}">
      <span class="t">${w ? `<span title="${esc(sevWord(w.sev) + ': ' + w.msg)}">${sevIcon(w.sev)}</span>` : ''}${esc(s.title || t('noTitle'))}</span>
      <span class="actions">
        ${set ? `<button class="iconbtn setbtn ${inSet ? 'on' : ''}" data-addtoset="${esc(s.id)}" title="${esc(t(inSet ? 'inSet' : 'addToSet', { set: set.name }))}" ${inSet || ro ? 'disabled' : ''}>${icon(inSet ? 'check' : 'add')}</button>` : ''}
        <button class="btn btn-outline btn-small" data-edit="${esc(s.id)}" ${ro ? 'disabled' : ''}>${t('edit')}</button>
        <button class="iconbtn binbtn" data-delsong="${esc(s.id)}" title="${esc(t('deleteSong'))}" ${ro ? 'disabled' : ''}>${icon('delete')}</button>
      </span>
      <span class="s">${esc(langName(s.language))}${s.lyricist ? ' · ' + esc(s.lyricist) : ''}</span>
    </li>`;
  }).join('') : `<li class="empty">${t('noSongsFound')}</li>`;
  const cw = $('clearwrap');
  if (cw) cw.innerHTML = filterIsDefault() ? '' : `<button class="btn btn-text btn-small" data-clear="1">${t('clearFilters')}</button>`;
}

function setsTab() {
  const L = S.lib, ro = readOnly();
  return `<ul class="songlist">
    ${L.sets.length ? L.sets.map((st, i) => `
      <li class="song setrow ${S.view === 'set' && S.openSet === i ? 'selected' : ''}" data-setopen="${i}" tabindex="0">
        <span class="t">${!st.songs.length ? `<span title="${esc(t('M13', { set: st.name }))}">${sevIcon('warning')}</span>` : icon('playlist', 'inl')}${esc(st.name)}</span>
        <span class="actions">
          <button class="iconbtn" data-setmove="${i}:-1" title="${esc(t('up'))}" ${i === 0 || ro ? 'disabled' : ''}>${icon('up')}</button>
          <button class="iconbtn" data-setmove="${i}:1" title="${esc(t('down'))}" ${i === L.sets.length - 1 || ro ? 'disabled' : ''}>${icon('down')}</button>
          <button class="iconbtn" data-setrename="${i}" title="${esc(t('rename'))}" ${ro ? 'disabled' : ''}>${icon('edit')}</button>
          <button class="iconbtn binbtn" data-setdel="${i}" title="${esc(t('deleteSet'))}" ${ro ? 'disabled' : ''}>${icon('delete')}</button>
        </span>
        <span class="s">${t('setSongs', { n: st.songs.length })}</span>
      </li>`).join('') : `<li class="empty">${t('noSets')}</li>`}
  </ul>
  <div class="listfoot"><button class="btn btn-outline" data-act="newset" ${ro ? 'disabled' : ''}>${icon('add')}${t('newSet')}</button></div>`;
}

function renderLeft() {
  const l = $('left');
  if (!S.lib) {
    l.className = 'left greyed';
    l.innerHTML = `<div class="pad"><h3>${t('songData')}</h3><p class="muted">${t('chooseSong')}</p></div>`;
    return;
  }
  l.className = 'left';
  if (S.mode === 'edit' && S.draft) {
    l.innerHTML = S.textMode ? `<div class="pad"><h3>${t('songData')}</h3><p class="muted">${t('textModeLeft')}</p></div>` : leftEdit(S.draft);
    return;
  }
  const s = S.view === 'song' ? selSong() : null;
  if (!s) { l.innerHTML = leftLibrary(); return; }
  l.innerHTML = `<div class="pad"><h3>${t('songData')}</h3>
    ${roField(t('fTitle'), s.title)}${roField(t('fLanguage'), s.language && langName(s.language))}
    ${roField(t('fLyricist'), s.lyricist)}${roField(t('fComposer'), s.composer)}
    ${roField(t('fCopyright'), s.copyright)}${roField(t('fLicense'), s.license, t('libLicense'))}
    ${roField(t('fSource'), s.source)}
    <div class="field"><label>${t('fTags')}</label>${s.tags.length ? `<div class="chips">${s.tags.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>` : `<div class="value none">${t('none')}</div>`}</div>
    <div class="field"><label>${t('fSongId')}</label><div class="songid">${esc(s.id)}</div></div></div>`;
}
const roField = (label, v, none) => `<div class="field"><label>${esc(label)}</label><div class="value ${v ? '' : 'none'}">${v ? esc(v) : esc(none || t('notFilled'))}</div></div>`;

// GD-22: the library's own fields, editable, when no song is selected.
function leftLibrary() {
  const L = S.lib, dis = readOnly() ? 'disabled' : '';
  const licErr = !L.license.id || !L.license.summary.trim();
  return `<div class="pad"><h3>${t('library')} ${gd('GD-22')}</h3>
    <div class="field"><label for="lib-title">${t('fTitle')} <span class="req">*</span></label><input id="lib-title" data-libfield="title" value="${esc(L.title)}" maxlength="80" ${dis}></div>
    <div class="field"><label for="lib-description">${t('fDescription')}</label><textarea id="lib-description" data-libfield="description" maxlength="1000" ${dis}>${esc(L.description)}</textarea></div>
    <div class="field ${licErr ? 'invalid' : ''}"><label for="lib-license">${t('fLicense')} <span class="req">*</span></label>
      <select id="lib-license" data-libfield="license.id" ${dis}>
        <option value="">${t('chooseLicense')}</option>
        ${Object.keys(LICENSES).map((k) => `<option value="${k}" ${L.license.id === k ? 'selected' : ''}>${k}</option>`).join('')}
      </select><div class="err">${sevIcon('error')} ${t('M29')}</div></div>
    <div class="field"><label for="lib-summary">${t('fSummary')} <span class="req">*</span></label><textarea id="lib-summary" data-libfield="license.summary" maxlength="200" ${dis}>${esc(L.license.summary)}</textarea></div>
    <h3 style="margin-top:18px">${t('fMaintainer')} ${gd('GD-37')}</h3>
    <div class="field ${!L.maintainer.name.trim() ? 'invalid' : ''}"><label for="lib-mname">${t('fMaintName')} <span class="req">*</span></label><input id="lib-mname" data-libfield="maintainer.name" value="${esc(L.maintainer.name)}" maxlength="100" ${dis}><div class="err">${sevIcon('error')} ${t('M39')}</div></div>
    <div class="field ${!L.maintainer.contact.trim() ? 'invalid' : ''}"><label for="lib-mcontact">${t('fMaintContact')} <span class="req">*</span></label><input id="lib-mcontact" data-libfield="maintainer.contact" value="${esc(L.maintainer.contact)}" ${dis}><div class="err">${sevIcon('error')} ${t('M39')}</div></div>
    <p class="muted small">${t('maintNote')}</p></div>`;
}

function leftEdit(d) {
  const iss = songIssues(d);
  const err = (f) => iss.find((e) => e.field === f && e.sev === 'error');
  const inp = (f, label, req, ph = '') => `
    <div class="field ${err(f) ? 'invalid' : ''}" id="f-${f}">
      <label for="in-${f}">${esc(label)}${req ? ' <span class="req">*</span>' : ''}</label>
      <input id="in-${f}" data-field="${f}" value="${esc(d[f])}" placeholder="${esc(ph)}">
      <div class="err">${err(f) ? sevIcon('error') + ' ' + esc(err(f).msg) : ''}</div>
    </div>`;
  return `<div class="pad"><h3>${t('songData')}</h3>
    ${inp('title', t('fTitle'), true)}
    <div class="field ${err('language') ? 'invalid' : ''}" id="f-language">
      <label for="in-language">${t('fLanguage')} <span class="req">*</span></label>
      <select id="in-language" data-field="language"><option value="">${t('chooseLang')}</option>
        ${SONG_LANGS.map(([c, n]) => `<option value="${c}" ${d.language === c ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <div class="err">${err('language') ? sevIcon('error') + ' ' + esc(err('language').msg) : ''}</div>
    </div>
    ${inp('lyricist', t('fLyricist'), false, t('phTrad'))}${inp('composer', t('fComposer'), false, t('phTrad'))}
    ${inp('copyright', t('fCopyright'), false, t('phPd'))}${inp('license', t('fLicense'), false, t('phLicense'))}
    ${inp('source', t('fSource'), false, t('phSource'))}
    <div class="field"><label for="in-tags">${t('fTags')}</label><input id="in-tags" data-field="tags" value="${esc(Array.isArray(d.tags) ? d.tags.join(', ') : d.tags)}" placeholder="${esc(t('phTags'))}"></div>
    <div class="field"><label>${t('fSongId')}</label><div class="songid">${d.id ? esc(d.id) : esc(t('idProposed'))}</div></div>
    <p class="muted small"><span class="req">*</span> ${t('required')}</p></div>`;
}

function renderCentre() {
  const c = $('centre');
  if (S.screen === 'splash') {                           // GD-03, GD-27, GD-30
    c.innerHTML = `<div class="splash photo" data-act="skip" title="${esc(t('clickToContinue'))}">
      <img src="img/zangbundel-icon.svg" alt="">
      <h1>${t('appName')} ${gd('GD-26')}</h1>
      <div class="muted">${t('version', { v: '0.1.0' })} ${gd('GD-27')} ${gd('GD-30')}</div></div>`;
    return;
  }
  if (!S.lib) {
    c.innerHTML = `<div class="home"><h2>${t('homeTitle')}</h2><p class="muted">${t('homeLead')}</p>
      <div class="tiles">
        <button class="tile" data-act="open">${icon('open')}<div><b>${t('tileOpen')} ${gd('GD-28')}</b><span>${t('tileOpenSub')}</span></div></button>
        <button class="tile" data-act="new">${icon('add')}<div><b>${t('tileNew')}</b><span>${t('tileNewSub')}</span></div></button>
        <button class="tile" disabled>${icon('edit')}<div><b>${t('tileEdit')}</b><span>${t('tileNeedLib')}</span></div></button>
        <button class="tile" disabled>${icon('download')}<div><b>${t('tileDownload')}</b><span>${t('tileNeedLib')}</span></div></button>
      </div></div>`;
    return;
  }
  const bar = readOnly() ? `<div class="robar">${icon('lock')}<span>${esc(t('readOnly', { name: S.lib.signed.name, fp: S.lib.signed.fp }))} ${gd('GD-24')}</span>
    <button class="btn btn-outline btn-small" data-act="keyload">${icon('upload')}${t('keyLoad')}</button></div>` : '';
  if (S.mode === 'edit' && S.draft) { c.innerHTML = centreEdit(S.draft); wireEditor(); return; }
  if (S.view === 'set' && S.openSet !== null && S.lib.sets[S.openSet]) { c.innerHTML = bar + centreSet(); wireSet(); return; }
  const s = selSong();
  if (!s) {
    c.innerHTML = bar + `<div class="home"><h2>${esc(S.lib.title)}</h2>
      <p class="muted">${S.lib.songs.length ? t('libHomeLead') : t('libEmpty')}</p>
      <button class="btn btn-primary" data-act="newsong" ${readOnly() ? 'disabled' : ''}>${icon('add')}${t('addSong')}</button></div>`;
    return;
  }
  const ro = readOnly();
  c.innerHTML = bar + `<div class="view">
    <div class="viewhead">
      <div><h1>${esc(s.title || t('noTitle'))}</h1><div class="muted">${[s.lyricist && t('lyricsBy', { v: s.lyricist }), s.composer && t('musicBy', { v: s.composer })].filter(Boolean).map(esc).join(' · ')}</div></div>
      <div class="headbtns">
        <button class="btn btn-text" data-delsong="${esc(s.id)}" ${ro ? 'disabled' : ''}>${icon('delete')}${t('delete')}</button>
        <button class="btn btn-outline" data-edit="${esc(s.id)}" ${ro ? 'disabled' : ''}>${icon('edit')}${t('edit')}</button>
      </div>
    </div>
    <div class="lyrics">${lyricsHtml(s.sections)}</div></div>`;
}

// View mode: labels generated in the interface language; a repeated chorus shows its text again, as the app does.
const chords = (txt) => esc(txt).replace(/\[([^\]\s*][^\]]*)\]/g, '<span class="chord">$1</span>');
function lyricsHtml(sections) {
  let n = 0, lastChorus = null;
  return sections.map((x) => {
    if (x.kind === 'verse') { n++; return `<div class="sec"><div class="lbl">${esc(x.label || t('verseN', { n }))}</div><p>${chords(x.text.trim())}</p></div>`; }
    if (x.kind === 'chorus') { lastChorus = x; return `<div class="sec chorus"><div class="lbl">${esc(x.label || t('chorus'))}</div><p>${chords(x.text.trim())}</p></div>`; }
    if (x.kind === 'bridge') return `<div class="sec"><div class="lbl">${esc(x.label || t('bridge'))}</div><p>${chords(x.text.trim())}</p></div>`;
    if (x.kind === 'repeat') return lastChorus ? `<div class="sec chorus"><div class="lbl">${esc(x.label || lastChorus.label || t('chorus'))}</div><p>${chords(lastChorus.text.trim())}</p></div>` : '';
    const remark = x.text.split('\n').map((l) => l.trim().match(/^\{\s*(?:comment|c|comment_italic|ci|comment_box|cb)\s*:\s*(.*?)\s*\}$/)).filter(Boolean);
    return remark.map((m) => `<div class="remark">${esc(m[1])}</div>`).join('');   // other locked lines are not shown, as in the app
  }).join('');
}

// ---- Edit mode (GD-06 to GD-08, GD-18, GD-19, GD-33) ----
const KINDS = ['verse', 'chorus', 'bridge', 'repeat'];
const kindLabel = (k) => t({ verse: 'kVerse', chorus: 'kChorus', bridge: 'kBridge', repeat: 'kRepeat', locked: 'kLocked' }[k]);
function repeatOf(d, i) {
  for (let k = i - 1; k >= 0; k--) if (d.sections[k].kind === 'chorus') return d.sections[k];
  return null;
}
function centreEdit(d) {
  const small = (n) => icon(n).replace('<svg', '<svg style="width:16px;height:16px;fill:currentColor;vertical-align:-3px"');
  const head = `<div class="edithead">
      <h2>${d.id ? t('editing', { t: esc(d.title || t('noTitle')) }) : t('newSongTitle')}</h2>
      <div class="modes"><span class="muted small">${t('modeLabel')}</span>
        <div class="segmented" role="radiogroup" aria-label="${esc(t('modeLabel'))}">
          <button role="radio" aria-checked="${!S.textMode}" class="${S.textMode ? '' : 'on'}" data-editmode="blocks">${icon('list')}${t('modeBlocks')}</button>
          <button role="radio" aria-checked="${S.textMode}" class="${S.textMode ? 'on' : ''}" data-editmode="code">${icon('edit')}${t('modeCode')}</button>
        </div> ${gd('GD-18')} ${gd('GD-38')}</div>
    </div>`;
  const foot = `<div class="editfoot">
      ${d.id ? `<button class="btn btn-text" data-delsong="${esc(d.id)}" style="margin-right:auto">${icon('delete')}${t('deleteSong')}</button>` : ''}
      <button class="btn btn-text" data-act="cancel">${t('cancel')}</button>
      <button class="btn btn-primary" data-act="apply">${icon('check')}${t('apply')}</button>
    </div>`;
  if (S.textMode) {
    const probs = braceProblems(S.textDraft);
    return `<div class="edit">${head}<p class="muted small">${t('textHelp')}</p>
      <textarea id="cptext" class="cptext" spellcheck="false">${esc(S.textDraft)}</textarea>
      <ul class="problems" id="cpprobs">${probs.map((n) => `<li>${sevIcon('error')} ${esc(t('lineBrace', { n }))}</li>`).join('')}</ul></div>${foot}`;
  }
  return `<div class="edit">${head}
    <p class="muted small">${t('editHelp', { drag: small('drag'), up: small('up'), down: small('down') })} ${gd('GD-19')} ${gd('GD-33')}</p>
    <div class="sections" id="sections">
      ${d.sections.map((x, i) => {
        const locked = x.kind === 'locked';
        const rep = x.kind === 'repeat' ? repeatOf(d, i) : null;
        return `
        <div class="section ${x.kind}" data-i="${i}">
          <div class="secbar">
            <span class="handle" title="${esc(t('dragTitle'))}" data-handle="${i}">${icon('drag')}</span>
            ${locked ? `<span class="lockedlbl">${icon('lock')}${t('kLocked')}</span>` : `
            <select data-kind="${i}" aria-label="${esc(t('blockKind'))}">${KINDS.map((k) => `<option value="${k}" ${x.kind === k ? 'selected' : ''}>${esc(kindLabel(k))}</option>`).join('')}</select>
            <input class="labelin" data-label="${i}" value="${esc(x.label)}" placeholder="${esc(t('labelPh'))}">`}
            <span class="grow"></span>
            <button class="iconbtn" data-up="${i}" title="${esc(t('up'))}" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
            <button class="iconbtn" data-down="${i}" title="${esc(t('down'))}" ${i === d.sections.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
            <button class="iconbtn" data-del="${i}" title="${esc(t('deleteBlock'))}">${icon('delete')}</button>
          </div>
          ${locked ? `<pre class="lockedtext">${esc(x.text)}</pre><div class="muted small">${t('lockedNote')}</div>`
            : x.kind === 'repeat' ? `<div class="repeatinfo">${rep ? esc(t('repeats', { t: rep.text.split('\n')[0] + ' …' })) : esc(t('repeatsNone'))}</div>`
            : `<div class="editor" contenteditable="plaintext-only" spellcheck="true" data-text="${i}" data-placeholder="${esc(t(x.kind === 'chorus' ? 'phChorus' : x.kind === 'bridge' ? 'phBridge' : 'phVerse'))}">${esc(x.text)}</div>`}
          <div class="hint" id="hint-${i}"></div>
        </div>`;
      }).join('')}
    </div>
    <div class="addrow">${KINDS.map((k) => `<button class="btn btn-outline" data-addsec="${k}">${icon('add')}${esc(kindLabel(k))}</button>`).join('')}</div>
  </div>${foot}`;
}

const FORBIDDEN = /[{}\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
function wireEditor() {
  const cp = $('cptext');
  if (cp) {
    cp.addEventListener('input', () => {
      S.textDraft = cp.value;
      $('cpprobs').innerHTML = braceProblems(cp.value).map((n) => `<li>${sevIcon('error')} ${esc(t('lineBrace', { n }))}</li>`).join('');
    });
    return;
  }
  document.querySelectorAll('.editor').forEach((ed) => {
    const i = +ed.dataset.text;
    ed.addEventListener('beforeinput', (e) => { if (e.data && FORBIDDEN.test(e.data)) { e.preventDefault(); hint(i, t('braces')); } });
    ed.addEventListener('paste', (e) => {
      e.preventDefault();
      const raw = (e.clipboardData || window.clipboardData).getData('text').replace(/\r\n?/g, '\n');
      const clean = raw.replace(new RegExp(FORBIDDEN.source, 'g'), '');
      if (clean !== raw) hint(i, t('pasted'));
      document.execCommand('insertText', false, clean);
    });
    ed.addEventListener('input', () => { S.draft.sections[i].text = ed.innerText.replace(/\n$/, ''); });
  });
  makeSortable($('sections'), '.section', '.handle', (from, to) => {
    const secs = S.draft.sections; const [m] = secs.splice(from, 1); secs.splice(to, 0, m);
  }, () => { renderCentre(); return document.querySelectorAll('.section'); });
}
// GD-18, GD-38: two editing modes for the same song; switching keeps every change.
function setEditMode(mode) {
  if (!S.draft || (mode === 'code') === S.textMode) return;
  if (mode === 'code') { syncLeft(); S.textDraft = toChordPro(S.draft); S.textMode = true; } else leaveTextMode();
  renderLeft(); renderCentre();
  const f = mode === 'code' ? $('cptext') : document.querySelector('.editor');
  if (f) f.focus();
}
function hint(i, msg) {
  const h = $('hint-' + i); if (!h) return;
  h.textContent = msg; clearTimeout(h._t); h._t = setTimeout(() => { h.textContent = ''; }, 3500);
}

// ---- F5, F7 (the owner's M5 review): the cards slide; the same for dragging and for up/down (GD-21, GD-33) ----
const STILL = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// where each card stands while card `from` lands at place `to`, and how far that card moves: the cards it passes
// make room by its height plus the gap
function shiftPlan(heights, gap, from, to) {
  const size = heights[from] + gap, shifts = heights.map(() => 0);
  let dy = 0;
  for (let i = from + 1; i <= to; i++) { shifts[i] = -size; dy += heights[i] + gap; }
  for (let i = to; i < from; i++) { shifts[i] = size; dy -= heights[i] + gap; }
  return { shifts, dy };
}
const cardGap = (cards) => (cards.length > 1 ? cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().bottom : 0);
function settle(list, card, dy, done) {
  const finish = () => { list.classList.remove('sorting', 'settling'); done(); };
  if (STILL()) { finish(); return; }
  list.classList.add('sorting', 'settling');
  card.classList.add('settle');
  card.style.transform = `translateY(${dy}px)`;
  setTimeout(finish, 170);
}
// up/down: the card and its neighbour change places by sliding, then the change is made
function slideMove(list, itemSel, from, to, done) {
  const cards = [...list.querySelectorAll(itemSel)];
  if (!cards[from] || !cards[to] || list.classList.contains('settling')) { if (!list.classList.contains('settling')) done(); return; }
  const plan = shiftPlan(cards.map((c) => c.offsetHeight), cardGap(cards), from, to);
  list.classList.add('sorting');
  cards.forEach((c, i) => { if (i !== from) c.style.transform = plan.shifts[i] ? `translateY(${plan.shifts[i]}px)` : ''; });
  settle(list, cards[from], plan.dy, done);
}

// ---- Drag to reorder, with auto-scroll (GD-08, GD-11), for sections and set entries ----
function makeSortable(list, itemSel, handleSel, onMove, rerender) {
  if (!list) return;
  const scroller = $('centre'), EDGE = 72, MAXSPEED = 18;
  list.querySelectorAll(handleSel).forEach((h, from) => {
    h.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const cards = [...list.querySelectorAll(itemSel)], card = cards[from];
      card.classList.add('dragging');
      try { h.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer in tests */ }
      const startY = e.clientY, startScroll = scroller.scrollTop, maxScroll = scroller.scrollHeight - scroller.clientHeight;
      const box = list.getBoundingClientRect(), cr = card.getBoundingClientRect();
      const minDy = box.top - cr.top, maxDy = box.bottom - cr.bottom;
      let to = from, y = e.clientY, raf = 0;
      // F5, F7: the others slide apart where the card will land; their middles are taken once, in content coordinates
      const others = cards.filter((c) => c !== card), gap = cardGap(cards), heights = cards.map((c) => c.offsetHeight);
      const mids = others.map((c) => { const b = c.getBoundingClientRect(); return b.top + b.height / 2 + scroller.scrollTop; });
      list.classList.add('sorting');
      const place = () => {
        card.style.transform = `translateY(${Math.max(minDy, Math.min(maxDy, y - startY + scroller.scrollTop - startScroll))}px)`;
        let k = mids.findIndex((m) => y + scroller.scrollTop < m);
        if (k === -1) k = others.length;
        to = k;                                             // the card's place in the new order
        const plan = shiftPlan(heights, gap, from, to);
        cards.forEach((c, i) => { if (c !== card) c.style.transform = plan.shifts[i] ? `translateY(${plan.shifts[i]}px)` : ''; });
      };
      const tick = () => {
        const r = scroller.getBoundingClientRect(), foot = document.querySelector('.editfoot');
        const bottom = r.bottom - (foot ? foot.offsetHeight : 0);
        let v = 0;
        if (y < r.top + EDGE) v = -MAXSPEED * Math.min(1, (r.top + EDGE - y) / EDGE);
        else if (y > bottom - EDGE) v = MAXSPEED * Math.min(1, (y - (bottom - EDGE)) / EDGE);
        const next = Math.max(0, Math.min(maxScroll, scroller.scrollTop + v));
        if (next !== scroller.scrollTop) { scroller.scrollTop = next; place(); }
        raf = requestAnimationFrame(tick);
      };
      const onMoveP = (ev) => { y = ev.clientY; place(); };
      const onUp = () => {
        cancelAnimationFrame(raf);
        h.removeEventListener('pointermove', onMoveP); h.removeEventListener('pointerup', onUp); h.removeEventListener('pointercancel', onUp);
        const target = to;
        // the card slides into its gap, then the list is drawn in its new order
        settle(list, card, shiftPlan(heights, gap, from, target).dy, () => {
          if (target !== from) onMove(from, target);
          const keep = scroller.scrollTop;
          const items = rerender();
          scroller.scrollTop = keep;
          if (items[target]) items[target].scrollIntoView({ block: 'nearest' });
        });
      };
      h.addEventListener('pointermove', onMoveP); h.addEventListener('pointerup', onUp); h.addEventListener('pointercancel', onUp);
      raf = requestAnimationFrame(tick);
    });
  });
}

// ---- A set in the centre area (GD-21) ----
function centreSet() {
  const st = S.lib.sets[S.openSet], ro = readOnly();
  const byId = (id) => S.lib.songs.find((s) => s.id === id);
  return `<div class="edit">
    <div class="edithead"><h2>${icon('playlist', 'inl')}${esc(st.name)}</h2>
      <button class="btn btn-text" data-setrename="${S.openSet}" ${ro ? 'disabled' : ''}>${icon('edit')}${t('rename')}</button></div>
    <p class="muted small">${t('addToSet', { set: esc(st.name) })}: ${icon('add', 'inl')} ${t('songs').toLowerCase()} →</p>
    ${st.songs.length ? '' : `<p>${sevIcon('warning')} ${esc(t('M13', { set: st.name }))}</p>`}
    <div class="sections" id="setentries">
      ${st.songs.map((id, i) => { const s = byId(id); return `
        <div class="section setentry" data-i="${i}">
          <div class="secbar">
            <span class="handle" title="${esc(t('dragTitle'))}">${icon('drag')}</span>
            <span class="setno">${i + 1}</span>
            <span class="grow"><b>${esc(s ? s.title : id)}</b> <span class="muted small">${s ? esc(langName(s.language)) : ''}</span></span>
            <button class="iconbtn" data-entrymove="${i}:-1" title="${esc(t('up'))}" ${i === 0 || ro ? 'disabled' : ''}>${icon('up')}</button>
            <button class="iconbtn" data-entrymove="${i}:1" title="${esc(t('down'))}" ${i === st.songs.length - 1 || ro ? 'disabled' : ''}>${icon('down')}</button>
            <button class="iconbtn binbtn" data-entrydel="${i}" title="${esc(t('delete'))}" ${ro ? 'disabled' : ''}>${icon('delete')}</button>
          </div></div>`; }).join('')}
    </div></div>`;
}
function wireSet() {
  if (readOnly()) return;
  makeSortable($('setentries'), '.setentry', '.handle', (from, to) => {
    const a = S.lib.sets[S.openSet].songs; const [m] = a.splice(from, 1); a.splice(to, 0, m); S.dirty = true;
  }, () => { render(); return document.querySelectorAll('.setentry'); });
}

// ---- Apply (GD-09, GD-20, GD-25) ----
const slug = (x) => String(x).normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'lied';
function uniqueId(base) { let id = base, n = 2; while (S.lib.songs.some((s) => s.id === id)) id = `${base}-${n++}`; return id; }
const normTags = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => x.trim()).filter(Boolean);
function syncLeft() {
  document.querySelectorAll('[data-field]').forEach((el) => { S.draft[el.dataset.field] = el.dataset.field === 'tags' ? normTags(el.value) : el.value; });
}
function leaveTextMode() {
  const p = fromChordPro(S.textDraft);
  Object.assign(S.draft, { title: p.title, language: p.language, lyricist: p.lyricist, composer: p.composer, copyright: p.copyright, license: p.license, source: p.source, tags: p.tags, sections: p.sections });
  S.textMode = false;
}
function apply() {
  if (S.textMode) leaveTextMode(); else syncLeft();
  const d = S.draft;
  d.tags = normTags(d.tags);
  const isNew = !d.id;
  if (isNew) { d.id = uniqueId(slug(d.title || 'lied')); S.lib.songs.push(clone(d)); }
  else { const k = S.lib.songs.findIndex((s) => s.id === d.id); S.lib.songs[k] = clone(d); }
  S.sel = d.id; S.view = 'song'; S.mode = 'view'; S.draft = null; S.dirty = true;
  let cleared = false;
  if (!visibleSongs().some((x) => x.id === d.id)) { S.filter = DEFAULT_FILTER(); cleared = true; }   // GD-25
  S.tab = 'songs';
  render();
  const ne = songIssues(d).filter((x) => x.sev === 'error').length;
  toast(cleared ? t('filtersCleared') : ne ? t('appliedWithErrors', { n: ne }) : t('applied'));
}

// ---- Dialogs ----
function dialog(html, wide) {
  closeDialog();
  const s = document.createElement('div');
  s.className = 'scrim'; s.id = 'scrim';
  s.innerHTML = `<div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  s.addEventListener('click', (e) => { if (e.target === s && !IDLE.open) closeDialog(); });
  document.body.appendChild(s);
  const f = s.querySelector('input:not([type=checkbox]), textarea, .btn-primary:not([disabled])');
  if (f) f.focus();
}
const closeDialog = () => { const s = $('scrim'); if (s) s.remove(); const m = $('langmenu'); if (m) m.remove(); };
function toast(msg) {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}
const btns = (...b) => `<div class="buttons">${b.join('')}</div>`;
const cancelBtn = () => `<button class="btn btn-text" data-dlg="cancel">${t('cancel')}</button>`;

let pendingLeave = null;
function confirmLeave(then) {
  if (!S.lib || !S.dirty) { then(); return; }
  pendingLeave = then;
  dialog(`<h2>${t('closeTitle')}</h2><p>${t('closeText')}</p><p class="muted small">FDS M-60, EDT-03</p>
    ${btns(cancelBtn(), `<button class="btn btn-primary" data-dlg="leave">${t('closeAnyway')}</button>`)}`);
}

function openDialog() {
  const a = sampleLibrary(), b = signedLibrary();
  dialog(`<h2>${t('openTitle')}</h2><p>${t('openText')}</p><p class="muted small">${t('mockPicker')}</p>
    <div class="file" data-dlg="loadsample">${icon('library')}<div><b>troep-12-kampvuurliedjes-v4.zbl</b><div class="muted small">${t('sampleUnsigned', { n: a.songs.length })}</div></div></div>
    <div class="file" data-dlg="loadsigned">${icon('lock')}<div><b>welpen-liedjes-v2.zbl</b><div class="muted small">${t('sampleSigned', { n: b.songs.length, name: AKELA.name })}</div></div></div>
    ${btns(cancelBtn())}`);
}
function newDialog() {
  dialog(`<h2>${t('newLibTitle')}</h2>
    <div class="field"><label for="nl-title">${t('fTitle')} <span class="req">*</span></label><input id="nl-title" placeholder="${esc(t('phLibTitle'))}" maxlength="80"></div>
    <div class="field"><label for="nl-desc">${t('fDescription')}</label><input id="nl-desc" placeholder="${esc(t('optional'))}"></div>
    <p class="muted small">${t('licenseLater')}</p>
    ${btns(cancelBtn(), `<button class="btn btn-primary" data-dlg="create">${t('create')}</button>`)}`);
}

// GD-23, GD-24: download keeps the library open; signing is a tick box.
function downloadDialog() {
  const L = S.lib, ro = readOnly();
  const errs = libraryIssues().filter((x) => x.sev === 'error');
  const v = S.dirty || !L.version ? (L.version || 0) + 1 : L.version;
  const file = `${slug(L.title)}-v${v}.zbl`;
  const keyMatches = S.key && L.signed && S.key.fp === L.signed.fp;
  const sign = S.key && !ro ? `<label class="ack"><input type="checkbox" id="dl-sign" ${keyMatches ? 'checked disabled' : ''}> ${icon('key', 'inl')}${esc(t('dlSign', { name: S.key.name, fp: S.key.fp }))} ${gd('GD-24')}</label>
    ${keyMatches ? `<p class="muted small">${t('dlSignedKeep')}</p>` : ''}` : '';
  dialog(`<h2>${t('dlTitle')} ${gd('GD-23')}</h2>
    ${ro ? `<p>${icon('lock', 'inl')}${t('dlReadOnly')}</p>` : `<p>${t('dlFile', { file: '<b>' + esc(file) + '</b>' })} ${S.dirty || !L.version ? t('dlVersion', { v }) : t('dlUnchanged', { v })}</p>
    ${S.dirty ? `<div class="field"><label for="dl-note">${t('dlNote')}</label><textarea id="dl-note" maxlength="500" placeholder="${esc(t('dlNotePh'))}"></textarea></div>` : ''}
    ${sign}
    ${errs.length ? `<div class="checkbox">${sevIcon('error')} ${t('dlErrors')} <a data-act="check">${t('openCheck')}</a></div>` : ''}`}
    ${btns(cancelBtn(), `<button class="btn btn-outline" data-dlg="copy">${t('saveCopy')}</button>`,
      ro ? '' : `<button class="btn btn-primary" data-dlg="download" data-file="${esc(file)}" data-v="${v}" ${errs.length ? 'disabled' : ''}>${icon('download')}${t('download')}</button>`)}`);
}
function copyDialog() {
  dialog(`<h2>${t('copyTitle')}</h2><p>${t('copyText')}</p>
    <div class="field"><label for="cp-title">${t('fTitle')} <span class="req">*</span></label><input id="cp-title" value="${esc(S.lib.title + ' ' + t('copySuffix'))}"></div>
    ${btns(cancelBtn(), `<button class="btn btn-primary" data-dlg="docopy">${icon('download')}${t('saveCopy')}</button>`)}`);
}

// GD-20: the validation panel.
function checkDialog() {
  const iss = libraryIssues();
  const where = (x) => (x.song ? esc((S.lib.songs.find((s) => s.id === x.song) || {}).title || x.song) : x.set !== undefined ? esc(S.lib.sets[x.set].name) : t('libraryLevel'));
  const goto = (x) => (x.song ? `song:${x.song}:${x.field || ''}` : x.set !== undefined ? `set:${x.set}` : `lib:${x.lib || ''}`);
  const group = (sev, title) => {
    const g = iss.filter((x) => x.sev === sev);
    return g.length ? `<div class="vgroup"><h3>${sevIcon(sev)} ${title} (${g.length})</h3>
      ${g.map((x) => `<button class="vitem" data-goto="${esc(goto(x))}"><span class="vwhere">${where(x)}</span><span>${esc(x.msg)}</span><span class="vgo">${t('goTo')} ›</span></button>`).join('')}</div>` : '';
  };
  dialog(`<h2>${t('checkTitle')} ${gd('GD-20')} ${gd('GD-29')}</h2>
    ${iss.length ? group('error', t('errors')) + group('warning', t('warnings')) + group('info', t('infos')) : `<p>${icon('check', 'inl')}${t('checkNone')}</p>`}
    ${btns(`<button class="btn btn-primary" data-dlg="cancel">${t('close')}</button>`)}`, true);
}
function gotoIssue(target) {
  closeDialog();
  const [kind, a, field] = target.split(':');
  if (kind === 'song') {
    S.tab = 'songs'; S.view = 'song'; S.sel = a;
    if (!readOnly()) { startEdit(a); const el = field && field !== 'sections' ? $('in-' + field) : document.querySelector('.editor'); if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); } }
    else render();
  } else if (kind === 'set') { S.tab = 'sets'; S.view = 'set'; S.openSet = +a; S.mode = 'view'; render(); }
  else { S.sel = null; S.view = 'song'; S.mode = 'view'; render(); const el = $(a === 'license' ? 'lib-license' : a === 'maintainer' ? 'lib-mname' : 'lib-title'); if (el) el.focus(); }
}

function aboutDialog() {
  dialog(`<div style="display:flex;gap:16px;align-items:center"><img src="img/zangbundel-icon.svg" alt="" width="64" height="64" style="border-radius:14px">
    <div><h2 style="margin:0">${t('appName')}</h2><div class="muted">${t('version', { v: '0.1.0' })}</div></div></div>
    <p class="small muted">${t('aboutIcons')}</p>${btns(`<button class="btn btn-primary" data-dlg="cancel">${t('close')}</button>`)}`);
}
function langMenu(btn) {                                  // GD-17
  closeDialog();
  const r = btn.getBoundingClientRect(), m = document.createElement('div');
  m.id = 'langmenu'; m.className = 'langmenu'; m.setAttribute('role', 'menu');
  m.innerHTML = `<div class="muted small" style="padding:4px 12px">${t('language')} ${gd('GD-17')}</div>` + Object.keys(STR).map((l) =>
    `<button role="menuitemradio" aria-checked="${l === S.lang}" data-setlang="${l}">${l === S.lang ? icon('check') : '<span class="sp"></span>'}${LANG_LABEL[l]}</button>`).join('');
  document.body.appendChild(m);
  m.style.left = Math.min(window.innerWidth - m.offsetWidth - 8, r.left) + 'px';
  m.style.top = (r.top - m.offsetHeight - 6) + 'px';
  m.querySelector('[aria-checked="true"]').focus();
}

// ---- Identity (GD-14, GD-24) ----
const newFingerprint = () => [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase().match(/.{4}/g).join('-');
const bigIcon = (n) => icon(n).replace('<svg', '<svg style="width:24px;height:24px;fill:var(--fire-orange);vertical-align:-4px"');
function keyMakeDialog(confirmed) {
  if (S.key && !confirmed) {
    dialog(`<h2>${t('keyReplaceTitle')}</h2><p>${t('keyInUse')} <b>${esc(S.key.name)}</b> · <span class="songid">${S.key.fp}</span>.
      ${S.key.saved ? '' : '<br><b>' + t('keyNotSaved') + '</b>'}</p>
      ${btns(cancelBtn(), `<button class="btn btn-primary" data-dlg="keyreplace">${t('keyMake')}</button>`)}`);
    return;
  }
  dialog(`<h2>${bigIcon('key')} ${t('keyMake')}</h2><p>${t('keyMakeText')}</p>
    <div class="field"><label for="key-name">${t('keyName')} <span class="req">*</span></label><input id="key-name" placeholder="${esc(t('keyNamePh'))}" maxlength="100"></div>
    <p class="muted small">${t('keyMakeNote')}</p>
    ${btns(cancelBtn(), `<button class="btn btn-primary" data-dlg="keymake">${t('create')}</button>`)}`);
}
function keySaveDialog(fresh) {
  dialog(`<h2>${fresh ? t('keyMade') : t('keyDownload')}</h2>
    <div class="keycard">${icon('key')}<div><b>${esc(S.key.name)}</b><div class="songid">${S.key.fp}</div></div></div>
    <div class="notice">${esc(t('M64'))}</div>
    <label class="ack"><input type="checkbox" id="ack"> ${t('keyRead')}</label>
    ${btns(`<button class="btn btn-text" data-dlg="cancel">${fresh ? t('later') : t('cancel')}</button>`,
      `<button class="btn btn-primary" data-dlg="keydl" id="keydl-btn" disabled>${icon('download')}${t('keyFileDl')}</button>`)}
    ${fresh ? `<p class="muted small">${t('keyLaterNote')}</p>` : ''}`);
}
function keyLoadDialog() {
  dialog(`<h2>${bigIcon('upload')} ${t('keyLoad')}</h2><p>${t('keyLoadText')}</p><p class="muted small">${t('mockPicker')}</p>
    <div class="file" data-dlg="keyakela">${icon('key')}<div><b>sleutel-akela.zbkey</b><div class="muted small">Akela · ${AKELA.fp}</div></div></div>
    <div class="file" data-dlg="keytroep">${icon('key')}<div><b>sleutel-leiding-troep-12.zbkey</b><div class="muted small">Leiding Troep 12</div></div></div>
    <div id="keymsg"></div>
    ${btns(cancelBtn())}`);
}
// GD-39: forget the key now. A key not yet downloaded is only forgotten after a question.
function forgetKey(confirmed) {
  if (!S.key) return;
  if (!S.key.saved && !confirmed) {
    dialog(`<h2>${t('keyForgetUnsavedTitle')}</h2><p>${t('keyForgetUnsavedText')}</p>
      ${btns(cancelBtn(), `<button class="btn btn-outline" data-act="keydl">${icon('download')}${t('keyFileDl')}</button>`,
        `<button class="btn btn-primary" data-dlg="forgetanyway">${t('keyForgetAnyway')}</button>`)}`);
    return;
  }
  S.key = null;                                  // the implementation zeroes the bytes in the crypto worker (SR-41)
  closeDialog(); render(); toast(t('keyForgotten'));
}

// GD-40: after 30 minutes without input, warn for 60 seconds, then forget a downloaded key.
const IDLE = { ms: 30 * 60 * 1000, warn: 60, last: Date.now(), open: false, left: 0 };
['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach((ev) =>
  document.addEventListener(ev, () => { if (!IDLE.open) IDLE.last = Date.now(); }, { passive: true, capture: true }));
function idleOpen() {
  IDLE.open = true; IDLE.left = IDLE.warn;
  const unsaved = !S.key.saved;
  dialog(`<h2>${icon('key', 'inl')}${t('idleTitle')} ${gd('GD-40')}</h2>
    <p id="idletext">${unsaved ? t('idleUnsaved') : t('idleText', { s: `<b id="idlecount">${IDLE.left}</b>` })}</p>
    ${btns(`<button class="btn btn-text" data-dlg="idleforget">${t('forgetNow')}</button>`,
      unsaved ? `<button class="btn btn-outline" data-act="keydl">${icon('download')}${t('keyFileDl')}</button>` : '',
      `<button class="btn btn-primary" data-dlg="idlekeep">${t('keepKey')}</button>`)}`);
}
function idleClose() { IDLE.open = false; IDLE.last = Date.now(); closeDialog(); }
setInterval(() => {
  if (!S.key) { IDLE.open = false; IDLE.last = Date.now(); return; }
  if (!IDLE.open && Date.now() - IDLE.last >= IDLE.ms) { idleOpen(); return; }
  if (IDLE.open && S.key.saved) {
    IDLE.left -= 1;
    const c = $('idlecount'); if (c) c.textContent = IDLE.left;
    if (IDLE.left <= 0) { IDLE.open = false; forgetKey(true); }
  }
}, 1000);

function loadKey(k) {
  if (S.lib && S.lib.signed && S.lib.signed.fp !== k.fp) {          // EDT-62, M-30
    $('keymsg').innerHTML = `<div class="checkbox">${sevIcon('error')} ${esc(t('M30'))}</div>`;
    return;
  }
  const unlocked = readOnly();
  S.key = k; closeDialog(); render();
  toast(unlocked ? t('keyUnlocked') : t('keyLoaded', { name: k.name }));
}

// ---- Android (GD-15, GD-35) ----
const LINKS = {
  apk: 'https://github.com/pe1mew/Zangbundel/releases/latest', appRepo: 'https://github.com/pe1mew/Zangbundel',
  managerRepo: 'https://github.com/pe1mew/Zangbundel-bibliotheek-manager',
  manualNl: 'https://github.com/pe1mew/Zangbundel/wiki/Handleiding', manualEn: 'https://github.com/pe1mew/Zangbundel/wiki/Manual',
  managerManual: 'https://github.com/pe1mew/Zangbundel-bibliotheek-manager/wiki',
};
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
function androidHtml() {
  return `<div class="badges">
      <span class="soonbadge"><img src="img/google-play-badge-nl.png" alt="Ontdek het op Google Play"><span>${t('soon')}</span></span>
      <span class="soonbadge"><img src="img/f-droid-badge-nl.png" alt="Verkrijg op F-Droid"><span>${t('soon')}</span></span>
    </div>
    <p class="small" style="margin-top:0">${t('apkLine', { link: ext(LINKS.apk, 'GitHub') })} ${gd('GD-35')}</p>
    <div class="linkgrid">
      <div><h3>${t('manual')}</h3><div>${t('manualApp')}: ${ext(LINKS.manualNl, 'Nederlands')} · ${ext(LINKS.manualEn, 'English')}</div>
        <div>${t('manualManager')}: ${ext(LINKS.managerManual, t('manualWord'))}</div></div>
      <div><h3>${t('sources')}</h3><div>${ext(LINKS.appRepo, t('appWord'))}</div><div>${ext(LINKS.managerRepo, t('managerWord'))}</div></div>
    </div><p class="muted small">${t('playTm')}</p>`;
}
function androidDialog() {
  dialog(`<div style="display:flex;gap:16px;align-items:center"><img src="img/zangbundel-icon.svg" alt="" width="56" height="56" style="border-radius:12px">
    <div><h2 style="margin:0">${t('androidTitle')}</h2><div class="muted small">${t('androidSub')}</div></div></div>
    ${androidHtml()}${btns(`<button class="btn btn-primary" data-dlg="cancel">${t('close')}</button>`)}`);
}
function renderNarrow() {                                 // GD-32
  $('narrow').innerHTML = `<div class="narrowbox"><img src="img/zangbundel-icon.svg" alt="" width="72" height="72" style="border-radius:16px">
    <h2>${t('appName')}</h2><p>${t('narrow')} ${gd('GD-32')}</p><h3>${t('androidTitle')}</h3>${androidHtml()}</div>`;
}

// ---- Actions ----
function startEdit(id) {
  if (readOnly()) return;
  const s = id ? S.lib.songs.find((x) => x.id === id) : null;
  if (id) S.sel = id;
  S.view = 'song';
  S.draft = s ? clone(s) : { id: '', title: '', language: '', lyricist: '', composer: '', copyright: '', license: '', source: '', tags: [], sections: [{ kind: 'verse', label: '', text: '' }] };
  S.mode = 'edit'; S.textMode = false;
  render();
  const first = s ? document.querySelector('.editor') : $('in-title');
  if (first) first.focus();
}
function resetSession(lib) {
  Object.assign(S, { lib, sel: null, view: 'song', mode: 'view', draft: null, textMode: false, dirty: false, tab: 'songs', openSet: null, filter: DEFAULT_FILTER() });
}
function goHome() { S.screen = 'home'; resetSession(null); render(); }
function loadSample(signed) {
  S.screen = 'library'; resetSession(signed ? signedLibrary() : sampleLibrary());
  S.sel = signed ? 'vader-jacob' : 'vuur-in-de-kring'; render();
}
function showSplash() {
  clearTimeout(S.splashTimer); closeDialog();
  S.screen = 'splash'; resetSession(null); render();
  S.splashTimer = setTimeout(() => { if (S.screen === 'splash') goHome(); }, 3000);   // GD-27
}

const EDIT_SAFE = ['lang', 'about', 'android', 'check', 'keymake', 'keyload', 'keydl', 'apply', 'cancel', 'skip'];
document.addEventListener('click', (e) => {
  const tgt = e.target.closest('[data-act],[data-edit],[data-song],[data-dlg],[data-up],[data-down],[data-del],[data-addsec],[data-goto],[data-jump],[data-sort],[data-chip],[data-clear],[data-delsong],[data-tab],[data-setopen],[data-setmove],[data-setrename],[data-setdel],[data-addtoset],[data-entrymove],[data-entrydel],[data-setlang],[data-editmode],[data-chipstep],[data-strip]');
  if (!tgt) { if (!e.target.closest('#langmenu')) { const m = $('langmenu'); if (m) m.remove(); } return; }
  const d = tgt.dataset;
  if (d.jump) { jump(d.jump); return; }
  if (d.chipstep) { chipStep(tgt, Number(d.chipstep)); return; }
  if (d.strip !== undefined) { const [side, tab] = d.strip.split(':'); BARS[side].folded = false; if (tab) S.tab = tab; saveBars(); render(); return; }
  if (d.setlang) { S.lang = d.setlang; store.set('lang', S.lang); closeDialog(); render(); return; }
  if (d.dlg) { dialogAction(d, tgt); return; }
  if (d.editmode) { setEditMode(d.editmode); return; }
  if (d.goto) { gotoIssue(d.goto); return; }
  if (d.act === 'skip') { clearTimeout(S.splashTimer); goHome(); return; }
  if (d.act === 'lang') { if ($('langmenu')) closeDialog(); else langMenu(tgt); return; }

  // While a song is being edited, the rest of the library waits (GD-09).
  if (S.mode === 'edit' && !tgt.closest('#centre') && !tgt.closest('#left') && !EDIT_SAFE.includes(d.act) && !d.sort && !d.chip && !d.clear && !d.tab) { editGuard(tgt); return; }

  if (d.sort) { S.filter.desc = !S.filter.desc; renderRight(); return; }
  if (d.clear) { S.filter = DEFAULT_FILTER(); renderRight(); return; }
  if (d.chip) {
    const i = d.chip.indexOf(':'), kind = d.chip.slice(0, i), v = d.chip.slice(i + 1), list = S.filter[kind];
    S.filter[kind] = list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; renderRight(); return;
  }
  if (d.tab) { S.tab = d.tab; renderRight(); return; }

  switch (d.act) {
    case 'open': confirmLeave(openDialog); return;
    case 'new': confirmLeave(newDialog); return;
    case 'close': confirmLeave(goHome); return;
    case 'edit': if (S.mode !== 'edit') startEdit(S.sel); return;
    case 'download': if (S.mode === 'edit') { editGuard(tgt); return; } downloadDialog(); return;
    case 'check': checkDialog(); return;
    case 'about': aboutDialog(); return;
    case 'keymake': keyMakeDialog(false); return;
    case 'keyload': keyLoadDialog(); return;
    case 'keydl': IDLE.open = false; IDLE.last = Date.now(); if (S.key) keySaveDialog(false); return;
    case 'keyforget': forgetKey(false); return;
    case 'android': androidDialog(); return;
    case 'newsong': if (!readOnly()) startEdit(null); return;
    case 'libinfo': S.sel = null; S.view = 'song'; S.mode = 'view'; render(); return;
    case 'newset': setNameDialog(null); return;
    case 'cancel': S.mode = 'view'; S.draft = null; S.textMode = false; if (S.sel && !selSong()) S.sel = null; render(); return;
    case 'apply': apply(); return;
    default: break;
  }
  if (d.delsong) {                                      // GD-16, M-62
    const s = S.lib.songs.find((x) => x.id === d.delsong); if (!s) return;
    dialog(`<h2>${t('delTitle')}</h2><p>${esc(t('delText', { name: s.title }))}</p><p class="muted small">${t('delNote')} FDS M-62, EDT-32.</p>
      ${btns(cancelBtn(), `<button class="btn btn-primary" data-dlg="delsong" data-id="${esc(s.id)}">${icon('delete')}${t('delete')}</button>`)}`);
    return;
  }
  if (d.edit) { if (S.mode !== 'edit') startEdit(d.edit); return; }
  if (d.song) { S.sel = d.song; S.view = 'song'; render(); return; }
  if (d.setopen !== undefined) { S.openSet = +d.setopen; S.view = 'set'; render(); return; }
  if (d.setmove) { const [i, dir] = d.setmove.split(':').map(Number); const a = S.lib.sets, j = i + dir; [a[i], a[j]] = [a[j], a[i]];
    if (S.openSet === i) S.openSet = j; else if (S.openSet === j) S.openSet = i; S.dirty = true; render(); return; }
  if (d.setrename !== undefined) { setNameDialog(+d.setrename); return; }
  if (d.setdel !== undefined) { const st = S.lib.sets[+d.setdel];
    dialog(`<h2>${t('delSetTitle')}</h2><p>${esc(t('delText', { name: st.name }))}</p><p class="muted small">${t('delSetNote')} FDS M-62.</p>
      ${btns(cancelBtn(), `<button class="btn btn-primary" data-dlg="delset" data-id="${d.setdel}">${icon('delete')}${t('delete')}</button>`)}`); return; }
  if (d.addtoset) { S.lib.sets[S.openSet].songs.push(d.addtoset); S.dirty = true; S.view = 'set'; render(); return; }
  if (d.entrymove) { const [i, dir] = d.entrymove.split(':').map(Number); slideMove($('setentries'), '.setentry', i, i + dir, () => { const a = S.lib.sets[S.openSet].songs, j = i + dir; [a[i], a[j]] = [a[j], a[i]]; S.dirty = true; render(); }); return; }
  if (d.entrydel !== undefined) { S.lib.sets[S.openSet].songs.splice(+d.entrydel, 1); S.dirty = true; render(); return; }
  if (d.up !== undefined) { move(+d.up, -1); return; }
  if (d.down !== undefined) { move(+d.down, 1); return; }
  if (d.del !== undefined) { S.draft.sections.splice(+d.del, 1); renderCentre(); return; }
  if (d.addsec) { S.draft.sections.push({ kind: d.addsec, label: '', text: '' }); renderCentre(); const eds = document.querySelectorAll('.editor'); if (eds.length && d.addsec !== 'repeat') eds[eds.length - 1].focus(); }
});

// GD-36: while a song is being edited, an action elsewhere first asks what to do with the changes, naming the song.
let guarded = null;
const draftTitle = () => {   // the name the song had before editing, so the user recognises it; a new song by its typed title
  const saved = S.draft && S.draft.id && S.lib.songs.find((s) => s.id === S.draft.id);
  return (saved && saved.title) || (S.draft && S.draft.title.trim()) || t('newSongTitle');
};
function editGuard(tgt) {
  // Remember what was clicked, by its data attributes, so it can be clicked again after apply or discard.
  guarded = Object.entries(tgt.dataset).map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}="${CSS.escape(v)}"]`).join('');
  const name = esc(draftTitle());
  dialog(`<h2>${icon('edit', 'inl')}${t('guardTitle')} ${gd('GD-36')}</h2><p>${t('guardText', { t: name })}</p><p class="muted small">${t('guardThen')}</p>
    <div class="guardbtns">
      <button class="btn btn-primary" data-dlg="guardapply">${icon('check')}${t('guardApply', { t: name })}</button>
      <button class="btn btn-outline" data-dlg="guarddiscard">${icon('delete')}${t('guardDiscard', { t: name })}</button>
      <button class="btn btn-text" data-dlg="cancel">${t('guardKeep')}</button>
    </div>`);
}
function replayGuarded() {
  const sel = guarded; guarded = null;
  if (!sel) return;
  const el = document.querySelector('#right ' + sel + ', #bottom ' + sel);
  if (el && !el.disabled) el.click();
}

function setNameDialog(i) {
  const cur = i === null ? t('setDefault') : S.lib.sets[i].name;
  dialog(`<h2>${t('renameTitle')}</h2><div class="field"><input id="set-name" value="${esc(cur)}" placeholder="${esc(t('setNamePh'))}" maxlength="60"></div>
    ${btns(cancelBtn(), `<button class="btn btn-primary" data-dlg="setname" data-id="${i === null ? '' : i}">${t('apply')}</button>`)}`);
  $('set-name').select();
}

function dialogAction(d, tgt) {
  switch (d.dlg) {
    case 'cancel': closeDialog(); return;
    case 'loadsample': closeDialog(); loadSample(false); return;
    case 'loadsigned': closeDialog(); loadSample(true); return;
    case 'leave': { closeDialog(); const f = pendingLeave; pendingLeave = null; S.dirty = false; if (f) f(); return; }
    case 'create': {
      const title = $('nl-title').value.trim();
      if (!title) { $('nl-title').focus(); $('nl-title').style.borderColor = 'var(--fire-orange-light)'; return; }
      closeDialog(); S.screen = 'library';
      resetSession({ id: crypto.randomUUID ? crypto.randomUUID() : 'new', title, description: $('nl-desc').value.trim(), version: 0, license: { id: '', summary: '' }, maintainer: { name: '', contact: '' }, signed: null, songs: [], sets: [] });
      S.dirty = true; render(); return;
    }
    case 'download': {
      const sign = $('dl-sign');
      if (sign && sign.checked && S.key) S.lib.signed = { name: S.key.name, fp: S.key.fp };
      S.lib.version = +tgt.dataset.v; S.dirty = false; closeDialog(); render();
      toast(t('downloaded', { file: tgt.dataset.file })); return;
    }
    case 'copy': copyDialog(); return;
    case 'docopy': {
      const title = $('cp-title').value.trim() || S.lib.title;
      Object.assign(S.lib, { id: crypto.randomUUID ? crypto.randomUUID() : 'copy', title, version: 1, signed: null });
      S.dirty = false; closeDialog(); render();
      toast(t('copyDone', { t: title }) + ' · ' + t('downloaded', { file: `${slug(title)}-v1.zbl` })); return;
    }
    case 'delsong': {
      const id = tgt.dataset.id, k = S.lib.songs.findIndex((x) => x.id === id), title = S.lib.songs[k].title;
      S.lib.songs.splice(k, 1);
      S.lib.sets.forEach((st) => { st.songs = st.songs.filter((x) => x !== id); });
      Object.assign(S, { mode: 'view', draft: null, textMode: false, dirty: true, view: 'song' });
      const vis = visibleSongs(); S.sel = vis.length ? vis[Math.min(k, vis.length - 1)].id : null;
      closeDialog(); render(); toast(t('deleted', { t: title })); return;
    }
    case 'delset': { const i = +tgt.dataset.id; S.lib.sets.splice(i, 1); if (S.openSet === i) { S.openSet = null; S.view = 'song'; } else if (S.openSet > i) S.openSet--; S.dirty = true; closeDialog(); render(); return; }
    case 'setname': {
      const name = $('set-name').value.trim(); if (!name) return;
      if (tgt.dataset.id === '') { S.lib.sets.push({ name, songs: [] }); S.openSet = S.lib.sets.length - 1; S.view = 'set'; S.tab = 'sets'; }
      else S.lib.sets[+tgt.dataset.id].name = name;
      S.dirty = true; closeDialog(); render(); return;
    }
    case 'guardapply': { const tab = S.tab; closeDialog(); apply(); S.tab = tab; renderRight(); replayGuarded(); return; }
    case 'guarddiscard': { const title = draftTitle(); closeDialog(); S.mode = 'view'; S.draft = null; S.textMode = false; if (S.sel && !selSong()) S.sel = null; render(); toast(t('discarded', { t: title })); replayGuarded(); return; }
    case 'keyreplace': keyMakeDialog(true); return;
    case 'forgetanyway': forgetKey(true); return;
    case 'idlekeep': idleClose(); return;
    case 'idleforget': idleClose(); forgetKey(true); return;
    case 'keymake': {
      const name = $('key-name').value.trim();
      if (!name) { $('key-name').focus(); $('key-name').style.borderColor = 'var(--fire-orange-light)'; return; }
      S.key = { name, fp: newFingerprint(), saved: false }; render(); keySaveDialog(true); return;
    }
    case 'keydl': if (!$('ack').checked) return; closeDialog(); S.key.saved = true; render(); toast(t('downloaded', { file: `sleutel-${slug(S.key.name)}.zbkey` })); return;
    case 'keyakela': loadKey({ ...AKELA, saved: true }); return;
    case 'keytroep': loadKey({ name: 'Leiding Troep 12', fp: '7F3C-19AA-0B42-D6E1', saved: true }); return;
    default:
  }
}

function move(i, dir) {
  const secs = S.draft.sections, j = i + dir;
  if (j < 0 || j >= secs.length) return;
  slideMove($('sections'), '.section', i, j, () => { [secs[i], secs[j]] = [secs[j], secs[i]]; renderCentre(); });
}

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.id === 'q') { S.filter.query = el.value; renderSongList(); return; }
  if (el.dataset.libfield && S.lib && !readOnly()) {          // GD-22
    const [a, b] = el.dataset.libfield.split('.');
    if (b) S.lib[a][b] = el.value; else S.lib[a] = el.value;
    S.dirty = true; renderRight(); renderBottom(); return;
  }
  if (el.dataset.label !== undefined && S.draft) { S.draft.sections[+el.dataset.label].label = el.value; return; }
  if (el.dataset.field && S.draft) {
    S.draft[el.dataset.field] = el.value;
    const f = el.closest('.field'); if (f && f.classList.contains('invalid') && el.value.trim()) f.classList.remove('invalid');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (IDLE.open) idleClose(); else closeDialog(); return; }   // Escape keeps the key (GD-40)
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('song') && S.mode !== 'edit') e.target.click();
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'ack') { $('keydl-btn').disabled = !el.checked; return; }
  if (el.id === 'intext') { S.filter.inText = el.checked; renderSongList(); return; }
  if (el.id === 'lib-license' && S.lib && !S.lib.license.summary.trim() && LICENSES[el.value]) {
    S.lib.license.summary = LICENSES[el.value][S.lang]; renderLeft(); renderBottom(); return;
  }
  if (el.dataset.libfield) { renderLeft(); return; }
  if (el.dataset.field && S.draft) S.draft[el.dataset.field] = el.value;
  if (el.dataset.kind !== undefined && S.draft) { S.draft.sections[+el.dataset.kind].kind = el.value; renderCentre(); }
});

// ---- Side bars: resize and fold (GD-10), remembered on this computer (GD-34) ----
const STRIP = 48;                                        // F6: a folded bar's strip of icons
const BARS = {
  left: { min: 220, max: 480, w: 300, folded: false, varName: '--lw', cls: 'lfold' },
  right: { min: 240, max: 520, w: 340, folded: false, varName: '--rw', cls: 'rfold' },
};
try { const saved = JSON.parse(store.get('bars') || 'null'); if (saved) ['left', 'right'].forEach((s) => Object.assign(BARS[s], saved[s] || {})); } catch (e) { /* defaults */ }
const appEl = document.querySelector('.app');
const saveBars = () => store.set('bars', JSON.stringify({ left: { w: BARS.left.w, folded: BARS.left.folded }, right: { w: BARS.right.w, folded: BARS.right.folded } }));
function applyBar(side) {
  const b = BARS[side];
  appEl.style.setProperty(b.varName, (b.folded ? STRIP : b.w) + 'px');
  $('strip-' + side).hidden = !b.folded;
  appEl.classList.toggle(b.cls, b.folded);
  const tab = $('tab-' + side), edge = $('edge-' + side);
  tab.innerHTML = icon((side === 'left') !== b.folded ? 'left' : 'right');
  tab.setAttribute('aria-expanded', String(!b.folded));
  edge.setAttribute('aria-valuenow', String(b.folded ? 0 : b.w));
  $(side).inert = b.folded;
}
const applyBars = () => { applyBar('left'); applyBar('right'); renderStrips(); };
// F6: the icons of a folded bar's strip: left the song's data or the library's fields, right Liedjes and Sets
function renderStrips() {
  const songShown = S.lib && (S.mode === 'edit' || (S.view === 'song' && selSong()));
  const left = [songShown || !S.lib ? ['left:', 'musicNote', t('songData')] : ['left:', 'library', t('library')]];
  const right = [['right:songs', 'list', t('songs')], ...(S.lib ? [['right:sets', 'playlist', t('sets')]] : [])];
  const btn = ([key, ic, label]) => `<button class="iconbtn" data-strip="${key}" title="${esc(label)}" aria-label="${esc(label)}">${icon(ic)}</button>`;
  $('strip-left').innerHTML = left.map(btn).join('');
  $('strip-right').innerHTML = right.map(btn).join('');
  $('strip-left').setAttribute('aria-label', t('unfoldLeft')); $('strip-right').setAttribute('aria-label', t('unfoldRight'));
}
function setWidth(side, w) { const b = BARS[side]; b.w = Math.max(b.min, Math.min(b.max, Math.round(w))); b.folded = false; applyBar(side); saveBars(); }
['left', 'right'].forEach((side) => {
  const b = BARS[side], edge = $('edge-' + side), tab = $('tab-' + side);
  tab.addEventListener('click', (e) => { e.stopPropagation(); b.folded = !b.folded; applyBar(side); saveBars(); });
  tab.addEventListener('pointerdown', (e) => e.stopPropagation());
  edge.addEventListener('pointerdown', (e) => {
    if (b.folded || e.target.closest('.foldtab')) return;
    e.preventDefault();
    try { edge.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
    appEl.classList.add('resizing'); edge.classList.add('active');
    const r = appEl.getBoundingClientRect();
    const onMove = (ev) => setWidth(side, side === 'left' ? ev.clientX - r.left : r.right - ev.clientX);
    const onUp = () => { appEl.classList.remove('resizing'); edge.classList.remove('active'); edge.removeEventListener('pointermove', onMove); edge.removeEventListener('pointerup', onUp); edge.removeEventListener('pointercancel', onUp); };
    edge.addEventListener('pointermove', onMove); edge.addEventListener('pointerup', onUp); edge.addEventListener('pointercancel', onUp);
  });
  edge.addEventListener('keydown', (e) => {
    if (e.target !== edge || b.folded) return;
    const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft', shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    if (e.key === grow) { setWidth(side, b.w + 16); e.preventDefault(); }
    if (e.key === shrink) { setWidth(side, b.w - 16); e.preventDefault(); }
  });
});

// ---- Mock bar ----
function jump(where) {
  closeDialog(); clearTimeout(S.splashTimer);
  if (where === 'splash') { showSplash(); return; }
  if (where === 'home') { goHome(); return; }
  loadSample(where === 'signed');
  if (where === 'edit') startEdit('vuur-in-de-kring');
  if (where === 'text') { startEdit('vuur-in-de-kring'); syncLeft(); S.textDraft = toChordPro(S.draft); S.textMode = true; renderLeft(); renderCentre(); }
  if (where === 'check') checkDialog();
  if (where === 'sets') { S.tab = 'sets'; S.openSet = 1; S.view = 'set'; render(); }
  if (where === 'library') { S.sel = null; render(); }
}
$('badges').addEventListener('change', (e) => document.body.classList.toggle('nobadges', !e.target.checked));

showSplash();
