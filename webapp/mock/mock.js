// SPDX-License-Identifier: Apache-2.0
// Mock of design/webappGUI.md draft 0.2. Clickable, in memory only: no file is read, written or sent anywhere.
'use strict';

// ---- Icons: Google Material Icons path data (Apache License 2.0), 24 x 24 viewBox. ----
// about, library, list, settings, chevrons: copied from the Zangbundel app (android/app/src/main/res/drawable).
const ICONS = {
  about: 'M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10 10,-4.48 10,-10S17.52,2 12,2zM13,17h-2v-6h2v6zM13,9h-2L11,7h2v2z',
  library: 'M18,2H6c-1.1,0 -2,0.9 -2,2v16c0,1.1 0.9,2 2,2h12c1.1,0 2,-0.9 2,-2V4c0,-1.1 -0.9,-2 -2,-2zM6,4h5v8l-2.5,-1.5L6,12V4z',
  list: 'M3,13h2v-2H3v2zm0,4h2v-2H3v2zm0,-8h2V7H3v2zm4,4h14v-2H7v2zm0,4h14v-2H7v2zM7,7v2h14V7H7z',
  up: 'M12,8l-6,6 1.41,1.41L12,10.83l4.59,4.58L18,14z',
  left: 'M15.41,7.41L14,6l-6,6 6,6 1.41,-1.41L10.83,12z',
  right: 'M10,6L8.59,7.41 13.17,12l-4.58,4.59L10,18l6,-6z',
  down: 'M16.59,8.59L12,13.17 7.41,8.59 6,10l6,6 6,-6z',
  open: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  drag: 'M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  view: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  key: 'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
  upload: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z',
  android: 'M16 1H8C6.34 1 5 2.34 5 4v16c0 1.66 1.34 3 3 3h8c1.66 0 3-1.34 3-3V4c0-1.66-1.34-3-3-3zm-2 20h-4v-1h4v1zm3.25-3H6.75V4h10.5v14z',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

// ---- Open questions shown as badges in the mock ----
const GQ = {
  'GQ-03': 'Logo: the app icon, or an own mark?',
  'GQ-05': 'Desktop width assumed; phone and tablet open.',
  'GQ-06': 'Product name: proposal "Zangbundel bibliotheek-manager".',
  'GQ-07': 'Splash time: 1.5 s or a click, as the app (notes said "a few seconds").',
  'GQ-08': '"Openen" instead of "uploaden": nothing is uploaded (TD-06).',
  'GQ-09': 'Where "Opslaan als kopie" and closing without saving go.',
  'GQ-10': 'Where the library\'s own fields, signing and language go. Mock: left bar when no song is selected.',
  'GQ-11': 'Where the sets go. Not in this mock.',
  'GQ-12': 'Where the validation panel goes; does "apply" refuse a song with an Error? Mock: it refuses.',
  'GQ-13': 'Bridge, {chorus} repeats, comments, chords: not in the section editor yet.',
  'GQ-14': 'Plain ChordPro text view (FDS EDT-33): not in this mock.',
  'GQ-15': 'Keyboard alternative to dragging. Mock: up and down buttons.',
  'GQ-18': 'Signing the library with this key, and asking a signed library for its key: not designed yet.',
  'GQ-19': 'Badges while the app is not yet public; where the manager\'s manual lives.',
};
const gq = (id) => `<span class="gq" title="${esc(GQ[id] || '')}">${id}</span>`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const $ = (id) => document.getElementById(id);

const LANGS = [['nl', 'Nederlands'], ['en', 'English'], ['de', 'Deutsch'], ['fy', 'Frysk'], ['fr', 'Français']];
const langName = (c) => (LANGS.find((l) => l[0] === c) || [c, c || '—'])[1];

// ---- Sample library: songs that are traditional (public domain) or written for this mock ----
function sampleLibrary() {
  return {
    title: 'Troep 12 Kampvuurliedjes',
    description: 'Liedjes voor kampen en kampvuren.',
    version: 4,
    license: 'CC-BY-NC-4.0',
    signed: false,
    songs: [
      {
        id: 'vader-jacob', title: 'Vader Jacob', language: 'nl', lyricist: 'traditioneel', composer: 'traditioneel',
        copyright: 'Public domain', license: 'public-domain', source: 'overgeleverd', tags: ['canon', 'welpen'],
        sections: [{ kind: 'verse', text: 'Vader Jacob, Vader Jacob,\nslaapt gij nog, slaapt gij nog?\nAlle klokken luiden, alle klokken luiden,\nbim bam bom, bim bam bom.' }],
      },
      {
        id: 'vuur-in-de-kring', title: 'Vuur in de kring', language: 'nl', lyricist: 'Mock-team', composer: 'Mock-team',
        copyright: '2026 Zangbundel-project', license: 'CC0-1.0', source: 'geschreven voor de mock', tags: ['kampvuur'],
        sections: [
          { kind: 'verse', text: 'De zon gaat onder achter het bos,\nde tenten staan, de dag is los.\nWe halen hout, we zoeken stenen,\nen rond het vuur zijn wij verschenen.' },
          { kind: 'chorus', text: 'Zing maar mee, zing maar mee,\nde vonken dansen, wij doen mee.' },
          { kind: 'verse', text: 'De sterren komen één voor één,\nniemand zit hier nog alleen.\nEen lied, een lach, een warme hand,\nde nacht valt zacht over het land.' },
          { kind: 'chorus', text: 'Zing maar mee, zing maar mee,\nde vonken dansen, wij doen mee.' },
        ],
      },
      {
        id: 'the-mock-song', title: 'The Mock Song', language: 'en', lyricist: 'Mock team', composer: '',
        copyright: '', license: '', source: 'written for the mock', tags: [],
        sections: [
          { kind: 'verse', text: 'We pack the bags, we walk the trail,\nwe sing until the stars grow pale.' },
          { kind: 'chorus', text: 'Hey ho, the fire glows,\nand everybody sings along.' },
        ],
      },
    ],
  };
}

// ---- State ----
const S = { screen: 'splash', lib: null, sel: null, mode: 'view', draft: null, dirty: false, errors: [], splashTimer: null };
const selSong = () => (S.lib && S.sel ? S.lib.songs.find((s) => s.id === S.sel) : null);

// ---- Render ----
function render() {
  document.querySelector('.app').classList.toggle('splash', S.screen === 'splash');   // GD-10: edges greyed with the bars
  renderLeft(); renderCentre(); renderRight(); renderBottom();
}

function renderBottom() {
  const hasLib = !!S.lib;
  const off = S.screen === 'splash';
  $('bottom').className = 'bottom' + (off ? ' greyed' : '');
  $('bottom').innerHTML = `
    <button class="navbtn" data-act="open">${icon('open')}Openen</button>
    <button class="navbtn" data-act="new">${icon('add')}Nieuw</button>
    <button class="navbtn ${S.mode === 'edit' ? 'active' : ''}" data-act="edit" ${hasLib && selSong() ? '' : 'disabled'}>${icon('edit')}Bewerken</button>
    <button class="navbtn ${S.dirty ? 'dirty' : ''}" data-act="download" ${hasLib ? '' : 'disabled'}><span class="dot"></span>${icon('download')}Sluiten en downloaden</button>
    <span class="nav-sep"></span>
    <span class="navgroup" title="${S.key ? esc('Sleutel in gebruik: ' + S.key.name + ' · ' + S.key.fp) : 'Geen sleutel geladen'}">
      <button class="navbtn" data-act="keymake">${icon('key')}Sleutel maken</button>
      <button class="navbtn" data-act="keyload">${icon('upload')}Sleutel laden</button>
      <button class="navbtn ${S.key && !S.key.saved ? 'dirty' : ''}" data-act="keydl" ${S.key ? '' : 'disabled'}><span class="dot"></span>${icon('download')}Sleutel downloaden</button>
      <span class="navgroup-label">${S.key ? esc(S.key.name) + ' · ' + S.key.fp : 'geen sleutel'} ${gq('GQ-18')}</span>
    </span>
    <span class="nav-sep"></span>
    <button class="navbtn" data-act="android">${icon('android')}Android-app</button>
    <button class="navbtn" data-act="about">${icon('about')}Over</button>`;
}

function renderRight() {
  const r = $('right');
  if (!S.lib) {
    r.className = 'right greyed';
    r.innerHTML = `<div class="libhead"><h3>Liedjes</h3></div><div class="empty">Nog geen bibliotheek geopend.</div>`;
    return;
  }
  r.className = 'right';
  const L = S.lib, f = S.filter;
  const langs = [...new Set(L.songs.map((s) => s.language).filter(Boolean))].sort();
  const tags = [...new Set(L.songs.flatMap((s) => s.tags))].sort((a, b) => a.localeCompare(b, 'nl'));
  const chip = (kind, v, label) => {
    const on = f[kind].includes(v);
    return `<button class="fchip ${on ? 'on' : ''}" data-chip="${kind}:${esc(v)}" aria-pressed="${on}">${on ? icon('check') : ''}${esc(label)}</button>`;
  };
  r.innerHTML = `
    <div class="libhead">
      <div class="title">${esc(L.title)}</div>
      <div class="muted small">${L.version ? 'versie ' + L.version : 'nieuw, nog niet opgeslagen'}${S.dirty ? ' · gewijzigd' : ''} · ${L.signed ? 'ondertekend' : 'niet ondertekend'}</div>
    </div>
    <div class="pad" style="padding-bottom:0"><h3>Liedjes (${L.songs.length}) ${gq('GQ-11')}</h3></div>
    ${L.songs.length ? `
    <div class="sbtools">
      <input id="q" class="search" type="search" placeholder="Zoeken" aria-label="Zoeken" value="${esc(f.query)}" autocomplete="off">
      <div class="tbrow">
        <label class="switch"><input type="checkbox" id="intext" ${f.inText ? 'checked' : ''}><span class="track"></span><span>Ook in de tekst</span></label>
        <button class="btn btn-text btn-small" data-sort="1" title="Volgorde omdraaien">${f.desc ? 'Z–A' : 'A–Z'}</button>
      </div>
      ${langs.length > 1 || tags.length ? `<div class="chiprow">
        ${langs.length > 1 ? langs.map((l) => chip('langs', l, langName(l))).join('') : ''}
        ${tags.map((t) => chip('tags', t, t)).join('')}
      </div>` : ''}
      <div id="clearwrap"></div>
    </div>` : '<div class="empty">Deze bibliotheek heeft nog geen liedjes.</div>'}
    <ul class="songlist" id="songlist"></ul>
    <div class="listfoot"><button class="btn btn-outline" data-act="newsong">${icon('add')}Nieuw lied</button></div>`;
  renderSongList();
}

// ---- Song list: search, sort and filters as the app's songbook (GD-13; app SongbookFilter.kt) ----
const DEFAULT_FILTER = () => ({ query: '', inText: false, desc: false, langs: [], tags: [] });
S.filter = DEFAULT_FILTER();
const fold = (s) => String(s || '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();
const filterIsDefault = () => JSON.stringify(S.filter) === JSON.stringify(DEFAULT_FILTER());

function visibleSongs() {
  const f = S.filter;
  const words = f.query.split(' ').map(fold).filter(Boolean);
  const coll = new Intl.Collator('nl', { sensitivity: 'base' });
  const shown = S.lib.songs.filter((s) =>
    (!f.langs.length || f.langs.includes(s.language)) &&
    (!f.tags.length || s.tags.some((t) => f.tags.includes(t))) &&
    (!words.length || (() => {
      const hay = f.inText ? fold(s.sections.map((x) => x.text).join('\n')) : fold(s.title);
      return words.every((w) => hay.includes(w));
    })()));
  shown.sort((a, b) => coll.compare(a.sorttitle || a.title, b.sorttitle || b.title));
  return f.desc ? shown.reverse() : shown;
}

function renderSongList() {
  const ul = $('songlist');
  if (!ul || !S.lib) return;
  const rows = visibleSongs();
  ul.innerHTML = rows.length || !S.lib.songs.length ? rows.map((s) => `
    <li class="song ${s.id === S.sel ? 'selected' : ''}" data-song="${esc(s.id)}" tabindex="0" title="Klik om te bekijken">
      <span class="t">${esc(s.title)}</span>
      <span class="actions"><button class="btn btn-outline btn-small" data-edit="${esc(s.id)}">Bewerken</button><button class="iconbtn binbtn" data-delsong="${esc(s.id)}" title="Lied verwijderen" aria-label="${esc(s.title)} verwijderen">${icon('delete')}</button></span>
      <span class="s">${esc(langName(s.language))}${s.lyricist ? ' · ' + esc(s.lyricist) : ''}</span>
    </li>`).join('') : '<li class="empty">Geen liederen gevonden.</li>';
  const cw = $('clearwrap');
  if (cw) cw.innerHTML = filterIsDefault() ? '' : '<button class="btn btn-text btn-small" data-clear="1">Wis filters</button>';
}

function renderLeft() {
  const l = $('left');
  if (!S.lib) {
    l.className = 'left greyed';
    l.innerHTML = `<div class="pad"><h3>Liedgegevens</h3><p class="muted">Kies een lied.</p></div>`;
    return;
  }
  l.className = 'left';
  if (S.mode === 'edit' && S.draft) { l.innerHTML = leftEdit(S.draft); return; }
  const s = selSong();
  if (!s) {
    // GQ-10: library fields shown when no song is selected (mock assumption).
    l.innerHTML = `<div class="pad"><h3>Bibliotheek ${gq('GQ-10')}</h3>
      ${roField('Titel', S.lib.title)}${roField('Beschrijving', S.lib.description)}${roField('Licentie', S.lib.license)}
      ${roField('Ondertekening', S.lib.signed ? 'ondertekend' : 'niet ondertekend')}</div>`;
    return;
  }
  l.innerHTML = `<div class="pad"><h3>Liedgegevens</h3>
    ${roField('Titel', s.title)}${roField('Taal', langName(s.language))}
    ${roField('Tekst', s.lyricist)}${roField('Muziek', s.composer)}
    ${roField('Copyright', s.copyright)}${roField('Licentie', s.license, 'licentie van de bibliotheek')}
    ${roField('Bron', s.source)}
    <div class="field"><label>Tags</label>${s.tags.length ? `<div class="chips">${s.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>` : '<div class="value none">geen</div>'}</div>
    <div class="field"><label>Lied-ID</label><div class="songid">${esc(s.id)}</div></div></div>`;
}

const roField = (label, v, none = 'niet ingevuld') =>
  `<div class="field"><label>${esc(label)}</label><div class="value ${v ? '' : 'none'}">${v ? esc(v) : esc(none)}</div></div>`;

function leftEdit(d) {
  const err = (f) => S.errors.find((e) => e.field === f);
  const inp = (f, label, req, ph = '') => `
    <div class="field ${err(f) ? 'invalid' : ''}" id="f-${f}">
      <label for="in-${f}">${esc(label)}${req ? ' <span class="req">*</span>' : ''}</label>
      <input id="in-${f}" data-field="${f}" value="${esc(d[f])}" placeholder="${esc(ph)}">
      <div class="err">${err(f) ? esc(err(f).msg) : ''}</div>
    </div>`;
  return `<div class="pad"><h3>Liedgegevens</h3>
    ${inp('title', 'Titel', true)}
    <div class="field ${err('language') ? 'invalid' : ''}" id="f-language">
      <label for="in-language">Taal <span class="req">*</span></label>
      <select id="in-language" data-field="language">
        <option value="">Kies de taal van het eerste couplet</option>
        ${LANGS.map(([c, n]) => `<option value="${c}" ${d.language === c ? 'selected' : ''}>${esc(n)}</option>`).join('')}
      </select>
      <div class="err">${err('language') ? esc(err('language').msg) : ''}</div>
    </div>
    ${inp('lyricist', 'Tekst', false, 'bijv. traditioneel')}
    ${inp('composer', 'Muziek', false, 'bijv. traditioneel')}
    ${inp('copyright', 'Copyright', false, 'bijv. Public domain')}
    ${inp('license', 'Licentie', false, 'leeg: licentie van de bibliotheek')}
    ${inp('source', 'Bron', false, 'waar de tekst vandaan komt')}
    <div class="field"><label for="in-tags">Tags</label><input id="in-tags" data-field="tags" value="${esc(d.tags.join(', '))}" placeholder="gescheiden door komma's"></div>
    <div class="field"><label>Lied-ID</label><div class="songid">${d.id ? esc(d.id) : 'wordt bij toepassen voorgesteld uit de titel'}</div></div>
    <p class="muted small"><span class="req">*</span> verplicht</p></div>`;
}

function renderCentre() {
  const c = $('centre');
  if (S.screen === 'splash') {
    c.innerHTML = `<div class="splash" data-act="skip" title="Klik om door te gaan">
      <img src="img/zangbundel-icon.svg" alt="">
      <h1>Zangbundel bibliotheek-manager ${gq('GQ-06')}</h1>
      <div class="muted">versie 0.1.0 (mock) ${gq('GQ-07')} ${gq('GQ-03')}</div></div>`;
    return;
  }
  if (!S.lib) {
    c.innerHTML = `<div class="home">
      <h2>Wat wil je doen?</h2>
      <p class="muted">Maak een liedbibliotheek voor de Zangbundel-app, of werk een bestaande bij.</p>
      <div class="tiles">
        <button class="tile" data-act="open">${icon('open')}<div><b>Bibliotheek openen ${gq('GQ-08')}</b><span>Kies een .zbl-bestand. Het wordt in je browser gelezen en blijft op deze computer.</span></div></button>
        <button class="tile" data-act="new">${icon('add')}<div><b>Nieuwe bibliotheek</b><span>Begin met een lege bibliotheek en voeg liedjes toe.</span></div></button>
        <button class="tile" disabled>${icon('edit')}<div><b>Bibliotheek bewerken</b><span>Open of maak eerst een bibliotheek.</span></div></button>
        <button class="tile" disabled>${icon('download')}<div><b>Sluiten en downloaden</b><span>Open of maak eerst een bibliotheek.</span></div></button>
      </div></div>`;
    return;
  }
  if (S.mode === 'edit' && S.draft) { c.innerHTML = centreEdit(S.draft); wireEditor(); return; }
  const s = selSong();
  if (!s) {
    c.innerHTML = `<div class="home"><h2>${esc(S.lib.title)}</h2>
      <p class="muted">${S.lib.songs.length ? 'Kies rechts een lied om het te bekijken of te bewerken.' : 'Deze bibliotheek heeft nog geen liedjes.'}</p>
      <button class="btn btn-primary" data-act="newsong">${icon('add')}Lied toevoegen</button></div>`;
    return;
  }
  c.innerHTML = `<div class="view">
    <div class="viewhead">
      <div><h1>${esc(s.title)}</h1><div class="muted">${[s.lyricist && 'tekst: ' + s.lyricist, s.composer && 'muziek: ' + s.composer].filter(Boolean).map(esc).join(' · ')}</div></div>
      <div class="headbtns">
        <button class="btn btn-text" data-delsong="${esc(s.id)}" title="Lied verwijderen">${icon('delete')}Verwijderen</button>
        <button class="btn btn-outline" data-edit="${esc(s.id)}">${icon('edit')}Bewerken</button>
      </div>
    </div>
    <div class="lyrics">${lyricsHtml(s.sections)}</div></div>`;
}

function lyricsHtml(sections) {
  let n = 0;
  return sections.filter((x) => x.text.trim()).map((x) => {
    const lbl = x.kind === 'chorus' ? 'Refrein' : 'Couplet ' + (++n);
    return `<div class="sec ${x.kind}"><div class="lbl">${lbl}</div><p>${esc(x.text.trim())}</p></div>`;
  }).join('');
}

function centreEdit(d) {
  const sectionErr = S.errors.find((e) => e.field === 'sections');
  return `<div class="edit">
    <h2>${d.id ? 'Bewerken: ' + esc(d.title || '(geen titel)') : 'Nieuw lied'} ${gq('GQ-14')}</h2>
    ${S.errors.length ? `<div class="checkbox" role="alert"><b>Nog niet toegepast: controleer deze punten ${gq('GQ-12')}</b><ul>
      ${S.errors.map((e) => `<li>⚠ ${esc(e.msg)} <a data-goto="${e.field}">Ga naar</a></li>`).join('')}</ul></div>` : ''}
    <p class="muted small">Het lied bestaat uit couplets en refreinen, in deze volgorde. Sleep een blok aan ${icon('drag').replace('<svg', '<svg style="width:16px;height:16px;fill:currentColor;vertical-align:-3px"')} om het te verplaatsen. ${gq('GQ-13')} ${gq('GQ-15')}</p>
    <div class="sections" id="sections" ${sectionErr ? 'style="outline:2px solid var(--fire-orange-light);outline-offset:6px;border-radius:12px"' : ''}>
      ${d.sections.map((x, i) => `
        <div class="section ${x.kind}" data-i="${i}">
          <div class="secbar">
            <span class="handle" title="Slepen om te verplaatsen" data-handle="${i}">${icon('drag')}</span>
            <select data-kind="${i}" aria-label="Soort blok">
              <option value="verse" ${x.kind === 'verse' ? 'selected' : ''}>Couplet</option>
              <option value="chorus" ${x.kind === 'chorus' ? 'selected' : ''}>Refrein</option>
            </select>
            <span class="grow"></span>
            <button class="iconbtn" data-up="${i}" title="Omhoog" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
            <button class="iconbtn" data-down="${i}" title="Omlaag" ${i === d.sections.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
            <button class="iconbtn" data-del="${i}" title="Blok verwijderen">${icon('delete')}</button>
          </div>
          <div class="editor" contenteditable="plaintext-only" spellcheck="true" data-text="${i}"
               data-placeholder="${x.kind === 'chorus' ? 'Tekst van het refrein' : 'Tekst van het couplet'}">${esc(x.text)}</div>
          <div class="hint" id="hint-${i}"></div>
        </div>`).join('')}
    </div>
    ${sectionErr ? `<div class="err" style="color:var(--fire-orange-light);margin:-4px 0 12px">${esc(sectionErr.msg)}</div>` : ''}
    <div class="addrow">
      <button class="btn btn-outline" data-addsec="verse">${icon('add')}Couplet</button>
      <button class="btn btn-outline" data-addsec="chorus">${icon('add')}Refrein</button>
    </div></div>
    <div class="editfoot">
      ${d.id ? `<button class="btn btn-text" data-delsong="${esc(d.id)}" style="margin-right:auto">${icon('delete')}Lied verwijderen</button>` : ''}
      <button class="btn btn-text" data-act="cancel">Annuleren</button>
      <button class="btn btn-primary" data-act="apply">${icon('check')}Toepassen</button>
    </div>`;
}

// ---- Section editor behaviour (GD-07, GD-08) ----
const FORBIDDEN = /[{}\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function wireEditor() {
  document.querySelectorAll('.editor').forEach((ed) => {
    const i = +ed.dataset.text;
    ed.addEventListener('beforeinput', (e) => {
      if (e.data && FORBIDDEN.test(e.data)) {
        FORBIDDEN.lastIndex = 0;
        e.preventDefault();
        hint(i, 'Accolades { } en stuurtekens kunnen niet in een liedtekst.');
      }
      FORBIDDEN.lastIndex = 0;
    });
    ed.addEventListener('paste', (e) => {
      e.preventDefault();
      const raw = (e.clipboardData || window.clipboardData).getData('text');
      const clean = raw.replace(/\r\n?/g, '\n').replace(FORBIDDEN, '');
      if (clean !== raw.replace(/\r\n?/g, '\n')) hint(i, 'Tekens die niet in een liedtekst mogen zijn weggelaten.');
      document.execCommand('insertText', false, clean);
    });
    ed.addEventListener('input', () => { S.draft.sections[i].text = ed.innerText.replace(/\n$/, ''); });
  });

  // Drag by the handle (GD-08), with pointer events so mouse, pen and touch all work.
  // The dragged block follows the pointer, and the song scrolls to keep it in view (GD-11).
  const scroller = $('centre');
  const EDGE = 72;          // px from the top or bottom of the centre area where scrolling starts
  const MAXSPEED = 18;      // px per frame at the very edge
  document.querySelectorAll('.handle').forEach((h) => {
    h.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const from = +h.dataset.handle;
      const cards = [...document.querySelectorAll('.section')];
      const card = cards[from];
      card.classList.add('dragging');
      h.setPointerCapture(e.pointerId);
      const startY = e.clientY, startScroll = scroller.scrollTop;
      // Limits measured before the block moves: its offset must not stretch the page, or the scroll would run on.
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      const box = $('sections').getBoundingClientRect(), cr = card.getBoundingClientRect();
      const minDy = box.top - cr.top, maxDy = box.bottom - cr.bottom;
      let to = from, y = e.clientY, raf = 0;

      const place = () => {
        const dy = Math.max(minDy, Math.min(maxDy, y - startY + scroller.scrollTop - startScroll));
        card.style.transform = `translateY(${dy}px)`;
        // Target position: before the first other card whose middle lies below the pointer.
        const others = cards.filter((c) => c !== card);
        let k = others.findIndex((c) => y < c.getBoundingClientRect().top + c.offsetHeight / 2);
        if (k === -1) k = others.length;
        to = k >= from ? k + 1 : k;            // index in the original order, before which to insert
        clearDrop();
        if (k < others.length) others[k].classList.add('dropbefore');
        else if (others.length) others[others.length - 1].style.boxShadow = '0 3px 0 var(--sky-blue)';
      };
      const tick = () => {                      // auto-scroll while the pointer is near an edge
        const r = scroller.getBoundingClientRect();
        const foot = document.querySelector('.editfoot');
        const bottom = r.bottom - (foot ? foot.offsetHeight : 0);   // the sticky Apply bar covers the lowest part
        let v = 0;
        if (y < r.top + EDGE) v = -MAXSPEED * Math.min(1, (r.top + EDGE - y) / EDGE);
        else if (y > bottom - EDGE) v = MAXSPEED * Math.min(1, (y - (bottom - EDGE)) / EDGE);
        const next = Math.max(0, Math.min(maxScroll, scroller.scrollTop + v));
        if (next !== scroller.scrollTop) { scroller.scrollTop = next; place(); }
        raf = requestAnimationFrame(tick);
      };
      const onMove = (ev) => { y = ev.clientY; place(); };
      const onUp = () => {
        cancelAnimationFrame(raf);
        h.removeEventListener('pointermove', onMove);
        h.removeEventListener('pointerup', onUp);
        h.removeEventListener('pointercancel', onUp);
        const secs = S.draft.sections;
        const target = to > from ? to - 1 : to;
        if (target !== from) { const [m] = secs.splice(from, 1); secs.splice(target, 0, m); }
        const keep = scroller.scrollTop;
        renderCentre();
        scroller.scrollTop = keep;
        const moved = document.querySelectorAll('.section')[target];
        if (moved) moved.scrollIntoView({ block: 'nearest' });
      };
      h.addEventListener('pointermove', onMove);
      h.addEventListener('pointerup', onUp);
      h.addEventListener('pointercancel', onUp);
      raf = requestAnimationFrame(tick);
    });
  });
}
const clearDrop = () => document.querySelectorAll('.section').forEach((x) => { x.classList.remove('dropbefore'); x.style.boxShadow = ''; });
function hint(i, msg) {
  const h = $('hint-' + i);
  if (!h) return;
  h.textContent = msg;
  clearTimeout(h._t);
  h._t = setTimeout(() => { h.textContent = ''; }, 3500);
}

// ---- Check on apply (GD-09). Messages after FDS M-51, M-49, M-58. ----
function check(d) {
  const e = [];
  if (!d.title.trim()) e.push({ field: 'title', msg: 'Het lied heeft geen titel. Vul een titel in.' });
  if (!d.language) e.push({ field: 'language', msg: 'Het lied heeft geen taal. Kies de taal van het eerste couplet.' });
  if (!d.sections.some((x) => x.text.trim())) e.push({ field: 'sections', msg: 'Het lied heeft nog geen tekst. Schrijf minstens één couplet of refrein.' });
  return e;
}

const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'lied';
function uniqueId(base) {
  let id = base, n = 2;
  while (S.lib.songs.some((s) => s.id === id)) id = `${base}-${n++}`;
  return id;
}

function apply() {
  const d = S.draft;
  d.tags = (Array.isArray(d.tags) ? d.tags : String(d.tags).split(',')).map((t) => t.trim()).filter(Boolean);
  S.errors = check(d);
  if (S.errors.length) { render(); return; }
  if (!d.id) { d.id = uniqueId(slug(d.title)); S.lib.songs.push(clone(d)); }      // EDT-36: proposed from the title
  else { const k = S.lib.songs.findIndex((s) => s.id === d.id); S.lib.songs[k] = clone(d); }
  S.sel = d.id; S.mode = 'view'; S.draft = null; S.dirty = true;
  if (!visibleSongs().some((x) => x.id === d.id)) S.filter = DEFAULT_FILTER();   // GQ-17: never hide the song just applied
  render();
  toast('Wijzigingen toegepast');
}

// ---- Dialogs ----
function dialog(html) {
  closeDialog();
  const s = document.createElement('div');
  s.className = 'scrim'; s.id = 'scrim';
  s.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">${html}</div>`;
  s.addEventListener('click', (e) => { if (e.target === s) closeDialog(); });
  document.body.appendChild(s);
  const f = s.querySelector('input, textarea, .btn-primary');
  if (f) f.focus();
}
const closeDialog = () => { const s = $('scrim'); if (s) s.remove(); };
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function confirmLeave(then) {
  if (!S.lib || !S.dirty) { then(); return; }
  dialog(`<h2>Niet opgeslagen</h2><p>Je hebt wijzigingen die niet zijn opgeslagen. Toch sluiten?</p>
    <p class="muted small">FDS M-60, EDT-03</p>
    <div class="buttons"><button class="btn btn-text" data-dlg="cancel">Annuleren</button><button class="btn btn-primary" data-dlg="leave">Toch sluiten</button></div>`);
  pendingLeave = then;
}
let pendingLeave = null;

function openDialog() {
  dialog(`<h2>Bibliotheek openen ${gq('GQ-08')}</h2>
    <p>Kies een bibliotheek (.zbl). Het bestand wordt in je browser gelezen en blijft op deze computer.</p>
    <p class="muted small">Mock: in de echte web-app opent hier de bestandskiezer van je computer.</p>
    <div class="file" data-dlg="loadsample">${icon('library')}<div><b>Troep-12-Kampvuurliedjes-v4.zbl</b><div class="muted small">voorbeeld · 3 liedjes · niet ondertekend</div></div></div>
    <div class="buttons"><button class="btn btn-text" data-dlg="cancel">Annuleren</button></div>`);
}

function newDialog() {
  dialog(`<h2>Nieuwe bibliotheek</h2>
    <div class="field"><label for="nl-title">Titel <span class="req">*</span></label><input id="nl-title" placeholder="bijv. Kampvuurliedjes van de Bevers"></div>
    <div class="field"><label for="nl-desc">Beschrijving</label><input id="nl-desc" placeholder="optioneel"></div>
    <p class="muted small">De licentie kies je voordat je voor het eerst opslaat (FDS EDT-13).</p>
    <div class="buttons"><button class="btn btn-text" data-dlg="cancel">Annuleren</button><button class="btn btn-primary" data-dlg="create">Maken</button></div>`);
}

function downloadDialog() {
  const v = S.dirty || !S.lib.version ? (S.lib.version || 0) + 1 : S.lib.version;
  const file = `${slug(S.lib.title)}-v${v}.zbl`;
  dialog(`<h2>Sluiten en downloaden ${gq('GQ-09')}</h2>
    <p>De bibliotheek wordt opgeslagen als <b>${esc(file)}</b>${S.dirty ? `, versie ${v}` : ', ongewijzigd'}.</p>
    ${S.dirty ? `<div class="field"><label for="dl-note">Wat is er veranderd? (optioneel, FDS EDT-58)</label><textarea id="dl-note" maxlength="500" placeholder="bijv. Drie liedjes toegevoegd voor het zomerkamp."></textarea></div>` : ''}
    <div class="buttons">
      <button class="btn btn-text" data-dlg="cancel">Annuleren</button>
      <button class="btn btn-outline" data-dlg="copy">Opslaan als kopie</button>
      <button class="btn btn-primary" data-dlg="download">${icon('download')}Downloaden en sluiten</button>
    </div>`);
  downloadName = file;
}
let downloadName = '';

function aboutDialog() {
  dialog(`<div style="display:flex;gap:16px;align-items:center"><img src="img/zangbundel-icon.svg" alt="" width="64" height="64" style="border-radius:14px">
    <div><h2 style="margin:0">Zangbundel bibliotheek-manager</h2><div class="muted">versie 0.1.0 (mock)</div></div></div>
    <p class="small muted">Pictogrammen: Google Material Icons, Apache License 2.0. Logo: het Zangbundel-app-icoon, CC BY-SA 4.0, Remko Welling, PE1MEW.</p>
    <div class="buttons"><button class="btn btn-primary" data-dlg="cancel">Sluiten</button></div>`);
}

// ---- Identity: the signing key (GD-14). In memory only, never stored (EDT-64, TD-06). ----
S.key = null;
const newFingerprint = () => {   // mock: random; the web app takes the first 8 bytes of SHA-256 over the public key (SG-20)
  const b = crypto.getRandomValues(new Uint8Array(8));
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  return hex.match(/.{4}/g).join('-');
};
const keyFile = () => `sleutel-${slug(S.key.name)}.zbkey`;
const M64 = 'Bewaar dit sleutelbestand goed. Het kan niet worden hersteld, en zonder dit bestand kun je deze bibliotheek niet meer wijzigen of ondertekenen. Wie dit bestand heeft, kan ondertekenen alsof hij jou is.';
const bigIcon = (n) => icon(n).replace('<svg', '<svg style="width:24px;height:24px;fill:var(--fire-orange);vertical-align:-4px"');

function keyMakeDialog(confirmed) {
  if (S.key && !confirmed) {
    dialog(`<h2>Nieuwe sleutel maken?</h2>
      <p>Er is al een sleutel in gebruik: <b>${esc(S.key.name)}</b> · <span class="songid">${S.key.fp}</span>.
      ${S.key.saved ? '' : '<br><b>Die is nog niet gedownload</b> en gaat verloren.'}</p>
      <div class="buttons"><button class="btn btn-text" data-dlg="cancel">Annuleren</button><button class="btn btn-primary" data-dlg="keyreplace">Nieuwe sleutel maken</button></div>`);
    return;
  }
  dialog(`<h2>${bigIcon('key')} Sleutel maken</h2>
    <p>Met je sleutel onderteken je een bibliotheek. De Zangbundel-app toont dan je naam en de vingerafdruk van je sleutel, en merkt het als iemand anders de bibliotheek later wijzigt.</p>
    <div class="field"><label for="key-name">Je naam als auteur <span class="req">*</span></label><input id="key-name" placeholder="bijv. Leiding Troep 12" maxlength="100"></div>
    <p class="muted small">De naam wordt niet gecontroleerd. De sleutel wordt in je browser gemaakt en blijft op deze computer (FDS EDT-61).</p>
    <div class="buttons"><button class="btn btn-text" data-dlg="cancel">Annuleren</button><button class="btn btn-primary" data-dlg="keymake">Maken</button></div>`);
}

function keySaveDialog(fresh) {
  dialog(`<h2>${fresh ? 'Je sleutel is gemaakt' : 'Sleutel downloaden'}</h2>
    <div class="keycard">${icon('key')}<div><b>${esc(S.key.name)}</b><div class="songid">${S.key.fp}</div></div></div>
    <div class="notice">${esc(M64)}</div>
    <label class="ack"><input type="checkbox" id="ack"> Ik heb dit gelezen</label>
    <div class="buttons">
      <button class="btn btn-text" data-dlg="cancel">${fresh ? 'Later' : 'Annuleren'}</button>
      <button class="btn btn-primary" data-dlg="keydl" id="keydl-btn" disabled>${icon('download')}Sleutelbestand downloaden</button>
    </div>
    ${fresh ? '<p class="muted small">Met <i>Later</i> blijft de sleutel alleen in deze pagina; sluit je de pagina zonder te downloaden, dan is hij weg.</p>' : ''}`);
}

function keyLoadDialog() {
  dialog(`<h2>${bigIcon('upload')} Sleutel laden</h2>
    <p>Kies je sleutelbestand (.zbkey). Het wordt in je browser gelezen, blijft op deze computer en wordt niet bewaard als je de pagina sluit.</p>
    <p class="muted small">Mock: in de echte web-app opent hier de bestandskiezer van je computer.</p>
    <div class="file" data-dlg="keyloadsample">${icon('key')}<div><b>sleutel-leiding-troep-12.zbkey</b><div class="muted small">voorbeeld</div></div></div>
    <div class="buttons"><button class="btn btn-text" data-dlg="cancel">Annuleren</button></div>`);
}

// ---- The Zangbundel app for Android (GD-15) ----
const LINKS = {
  play: 'https://play.google.com/store/apps/details?id=nl.pe1mew.zangbundel.app',
  fdroid: 'https://f-droid.org/packages/nl.pe1mew.zangbundel.app/',
  apk: 'https://github.com/pe1mew/Zangbundel/releases/latest',
  appRepo: 'https://github.com/pe1mew/Zangbundel',
  managerRepo: 'https://github.com/pe1mew/Zangbundel-bibliotheek-manager',
  manualNl: 'https://github.com/pe1mew/Zangbundel/wiki/Handleiding',
  manualEn: 'https://github.com/pe1mew/Zangbundel/wiki/Manual',
  managerManual: 'https://github.com/pe1mew/Zangbundel-bibliotheek-manager/wiki',
};
const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
function androidDialog() {
  dialog(`<div style="display:flex;gap:16px;align-items:center"><img src="img/zangbundel-icon.svg" alt="" width="56" height="56" style="border-radius:12px">
      <div><h2 style="margin:0">Zangbundel voor Android</h2><div class="muted small">De app waarin je bibliotheek wordt gezongen.</div></div></div>
    <div class="badges">
      <a href="${LINKS.play}" target="_blank" rel="noopener noreferrer"><img src="img/google-play-badge-nl.png" alt="Ontdek het op Google Play"></a>
      <a href="${LINKS.fdroid}" target="_blank" rel="noopener noreferrer"><img src="img/f-droid-badge-nl.png" alt="Verkrijg op F-Droid"></a>
    </div>
    <p class="small" style="margin-top:0">Of download de ondertekende APK van ${ext(LINKS.apk, 'GitHub')}. ${gq('GQ-19')}</p>
    <div class="linkgrid">
      <div><h3>Handleiding</h3>
        <div>App: ${ext(LINKS.manualNl, 'Nederlands')} · ${ext(LINKS.manualEn, 'English')}</div>
        <div>Bibliotheek-manager: ${ext(LINKS.managerManual, 'handleiding')}</div></div>
      <div><h3>Broncode</h3>
        <div>${ext(LINKS.appRepo, 'Zangbundel-app')}</div>
        <div>${ext(LINKS.managerRepo, 'Bibliotheek-manager')}</div></div>
    </div>
    <p class="muted small">Google Play en het Google Play-logo zijn handelsmerken van Google LLC.</p>
    <div class="buttons"><button class="btn btn-primary" data-dlg="cancel">Sluiten</button></div>`);
}

// ---- Actions ----
function startEdit(id) {
  const s = id ? S.lib.songs.find((x) => x.id === id) : null;
  S.sel = id || S.sel;
  S.draft = s ? clone(s) : { id: '', title: '', language: '', lyricist: '', composer: '', copyright: '', license: '', source: '', tags: [], sections: [{ kind: 'verse', text: '' }] };
  S.mode = 'edit'; S.errors = [];
  render();
  const first = s ? document.querySelector('.editor') : $('in-title');
  if (first) first.focus();
}

function goHome() { S.filter = DEFAULT_FILTER(); S.screen = 'home'; S.lib = null; S.sel = null; S.mode = 'view'; S.draft = null; S.dirty = false; S.errors = []; render(); }
function loadSample() { S.filter = DEFAULT_FILTER(); S.screen = 'library'; S.lib = sampleLibrary(); S.sel = 'vuur-in-de-kring'; S.mode = 'view'; S.draft = null; S.dirty = false; S.errors = []; render(); }

function showSplash() {
  clearTimeout(S.splashTimer);
  closeDialog();
  S.screen = 'splash'; S.lib = null; S.sel = null; S.mode = 'view'; S.draft = null; S.dirty = false; S.errors = [];
  render();
  S.splashTimer = setTimeout(() => { if (S.screen === 'splash') goHome(); }, 1500); // GQ-07
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act],[data-view],[data-edit],[data-song],[data-dlg],[data-up],[data-down],[data-del],[data-addsec],[data-goto],[data-jump],[data-sort],[data-chip],[data-clear],[data-delsong]');
  if (!t) return;
  const d = t.dataset;

  if (d.jump) { jump(d.jump); return; }
  if (d.sort) { S.filter.desc = !S.filter.desc; renderRight(); return; }
  if (d.clear) { S.filter = DEFAULT_FILTER(); renderRight(); return; }
  if (d.chip) {
    const [kind, v] = [d.chip.slice(0, d.chip.indexOf(':')), d.chip.slice(d.chip.indexOf(':') + 1)];
    const list = S.filter[kind];
    S.filter[kind] = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    renderRight(); return;
  }
  if (d.dlg) {
    if (d.dlg === 'cancel') closeDialog();
    if (d.dlg === 'loadsample') { closeDialog(); loadSample(); toast('Bibliotheek geopend: 3 liedjes, geen fouten'); }
    if (d.dlg === 'leave') { closeDialog(); const f = pendingLeave; pendingLeave = null; S.dirty = false; if (f) f(); }
    if (d.dlg === 'create') {
      const title = $('nl-title').value.trim();
      if (!title) { $('nl-title').focus(); $('nl-title').style.borderColor = 'var(--fire-orange-light)'; return; }
      closeDialog();
      S.filter = DEFAULT_FILTER(); S.screen = 'library'; S.lib = { title, description: $('nl-desc').value.trim(), version: 0, license: '', signed: false, songs: [] };
      S.sel = null; S.mode = 'view'; S.dirty = true; render();
    }
    if (d.dlg === 'download') { closeDialog(); toast(`Mock: ${downloadName} zou nu worden gedownload`); S.dirty = false; setTimeout(goHome, 900); }
    if (d.dlg === 'delsong') {
      const id = t.dataset.id, songs = S.lib.songs, k = songs.findIndex((x) => x.id === id);
      const title = songs[k].title;
      songs.splice(k, 1);
      (S.lib.sets || []).forEach((set) => { set.songs = set.songs.filter((x) => x !== id); });   // also from every set
      S.mode = 'view'; S.draft = null; S.errors = []; S.dirty = true;
      const vis = visibleSongs();
      S.sel = vis.length ? vis[Math.min(k, vis.length - 1)].id : null;   // select a neighbour, or nothing
      closeDialog(); render(); toast(`"${title}" verwijderd`);
      return;
    }
    if (d.dlg === 'keyreplace') { keyMakeDialog(true); return; }
    if (d.dlg === 'keymake') {
      const name = $('key-name').value.trim();
      if (!name) { $('key-name').focus(); $('key-name').style.borderColor = 'var(--fire-orange-light)'; return; }
      S.key = { name, fp: newFingerprint(), saved: false };
      renderBottom(); keySaveDialog(true); return;
    }
    if (d.dlg === 'keydl') {
      if (!$('ack').checked) return;
      closeDialog(); toast(`Mock: ${keyFile()} zou nu worden gedownload`); S.key.saved = true; renderBottom(); return;
    }
    if (d.dlg === 'keyloadsample') {
      closeDialog(); S.key = { name: 'Leiding Troep 12', fp: newFingerprint(), saved: true }; renderBottom();
      toast('Sleutel geladen: Leiding Troep 12'); return;
    }
    if (d.dlg === 'copy') { closeDialog(); toast('Mock: opslaan als kopie (FDS EDT-70 tot EDT-73) is nog niet ontworpen'); }
    return;
  }
  if (d.act === 'skip') { clearTimeout(S.splashTimer); goHome(); return; }
  if (S.mode === 'edit' && (d.view || d.song || (d.edit && d.edit !== S.draft?.id)) && !t.closest('.edit')) {
    toast('Pas eerst toe of annuleer'); return;
  }
  if (d.act === 'open') { confirmLeave(openDialog); return; }
  if (d.act === 'new') { confirmLeave(newDialog); return; }
  if (d.act === 'edit') { if (S.mode !== 'edit') startEdit(S.sel); return; }
  if (d.act === 'download') { if (S.mode === 'edit') { toast('Pas eerst toe of annuleer'); return; } downloadDialog(); return; }
  if (d.act === 'about') { aboutDialog(); return; }
  if (d.act === 'keymake') { keyMakeDialog(false); return; }
  if (d.act === 'keyload') { keyLoadDialog(); return; }
  if (d.act === 'keydl') { if (S.key) keySaveDialog(false); return; }
  if (d.act === 'android') { androidDialog(); return; }
  if (d.act === 'newsong') { if (S.mode === 'edit') { toast('Pas eerst toe of annuleer'); return; } startEdit(null); return; }
  if (d.delsong) {   // GD-16, FDS EDT-32: delete with confirmation M-62
    const s = S.lib.songs.find((x) => x.id === d.delsong);
    if (!s) return;
    dialog(`<h2>Lied verwijderen</h2>
      <p>"${esc(s.title)}" verwijderen? Dit kan in deze sessie niet ongedaan worden gemaakt.</p>
      <p class="muted small">Het lied verdwijnt ook uit alle sets. FDS M-62, EDT-32.</p>
      <div class="buttons"><button class="btn btn-text" data-dlg="cancel">Annuleren</button>
        <button class="btn btn-primary" data-dlg="delsong" data-id="${esc(s.id)}">${icon('delete')}Verwijderen</button></div>`);
    return;
  }
  if (d.act === 'cancel') { S.mode = 'view'; S.draft = null; S.errors = []; if (S.sel && !selSong()) S.sel = null; render(); return; }
  if (d.act === 'apply') { syncLeft(); apply(); return; }
  if (d.view) { S.sel = d.view; S.mode = 'view'; render(); return; }
  if (d.edit) { if (S.mode !== 'edit') startEdit(d.edit); return; }
  if (d.song) { S.sel = d.song; render(); return; }
  if (d.up !== undefined) { move(+d.up, -1); return; }
  if (d.down !== undefined) { move(+d.down, 1); return; }
  if (d.del !== undefined) { S.draft.sections.splice(+d.del, 1); renderCentre(); return; }
  if (d.addsec) { S.draft.sections.push({ kind: d.addsec, text: '' }); renderCentre(); const eds = document.querySelectorAll('.editor'); eds[eds.length - 1].focus(); return; }
  if (d.goto) {
    const el = d.goto === 'sections' ? document.querySelector('.editor') : $('in-' + d.goto);
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
  }
});

function move(i, dir) {
  const secs = S.draft.sections, j = i + dir;
  if (j < 0 || j >= secs.length) return;
  [secs[i], secs[j]] = [secs[j], secs[i]];
  renderCentre();
}

// Left-bar fields write into the draft (GD-05).
function syncLeft() {
  document.querySelectorAll('[data-field]').forEach((el) => { S.draft[el.dataset.field] = el.dataset.field === 'tags' ? el.value : el.value; });
}
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { S.filter.query = e.target.value; renderSongList(); return; }   // the list follows while typing
  if (e.target.dataset && e.target.dataset.field && S.draft) {
    S.draft[e.target.dataset.field] = e.target.value;
    const f = e.target.closest('.field');            // a fixed field loses its error mark at once
    if (f && f.classList.contains('invalid') && e.target.value.trim()) f.classList.remove('invalid');
  }
});
document.addEventListener('keydown', (e) => {          // a focused song row opens with Enter, as a click
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('song') && S.mode !== 'edit') { S.sel = e.target.dataset.song; render(); }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'ack') { $('keydl-btn').disabled = !e.target.checked; return; }   // M-64 must be acknowledged first
  if (e.target.id === 'intext') { S.filter.inText = e.target.checked; renderSongList(); return; }
  if (e.target.dataset && e.target.dataset.field && S.draft) S.draft[e.target.dataset.field] = e.target.value;
  if (e.target.dataset && e.target.dataset.kind !== undefined && S.draft) { S.draft.sections[+e.target.dataset.kind].kind = e.target.value; renderCentre(); }
});

// ---- Side bars: resize and fold (GD-10). Kept for this page only (GQ-16). ----
const BARS = {
  left:  { min: 220, max: 480, w: 300, folded: false, varName: '--lw', cls: 'lfold', label: 'Liedgegevens' },
  right: { min: 240, max: 520, w: 320, folded: false, varName: '--rw', cls: 'rfold', label: 'Liedjeslijst' },
};
const appEl = document.querySelector('.app');

function applyBar(side) {
  const b = BARS[side];
  appEl.style.setProperty(b.varName, (b.folded ? 0 : b.w) + 'px');
  appEl.classList.toggle(b.cls, b.folded);
  const tab = $('tab-' + side), edge = $('edge-' + side), pane = $(side);
  // The chevron points the way the bar will move.
  const dir = (side === 'left') !== b.folded ? 'left' : 'right';
  tab.innerHTML = icon(dir);
  tab.setAttribute('aria-expanded', String(!b.folded));
  tab.title = `${b.label} ${b.folded ? 'uitklappen' : 'inklappen'}`;
  edge.setAttribute('aria-valuenow', String(b.folded ? 0 : b.w));
  edge.setAttribute('aria-valuemin', String(b.min));
  edge.setAttribute('aria-valuemax', String(b.max));
  pane.inert = b.folded;                      // folded content is not reachable by keyboard
}
function setWidth(side, w) {
  const b = BARS[side];
  b.w = Math.max(b.min, Math.min(b.max, Math.round(w)));
  b.folded = false;
  applyBar(side);
}

['left', 'right'].forEach((side) => {
  const b = BARS[side], edge = $('edge-' + side), tab = $('tab-' + side);
  tab.addEventListener('click', (e) => { e.stopPropagation(); b.folded = !b.folded; applyBar(side); });
  tab.addEventListener('pointerdown', (e) => e.stopPropagation());
  edge.addEventListener('pointerdown', (e) => {
    if (b.folded || e.target.closest('.foldtab')) return;
    e.preventDefault();
    edge.setPointerCapture(e.pointerId);
    appEl.classList.add('resizing'); edge.classList.add('active');
    const r = appEl.getBoundingClientRect();
    const onMove = (ev) => setWidth(side, side === 'left' ? ev.clientX - r.left : r.right - ev.clientX);
    const onUp = () => {
      appEl.classList.remove('resizing'); edge.classList.remove('active');
      edge.removeEventListener('pointermove', onMove); edge.removeEventListener('pointerup', onUp); edge.removeEventListener('pointercancel', onUp);
    };
    edge.addEventListener('pointermove', onMove); edge.addEventListener('pointerup', onUp); edge.addEventListener('pointercancel', onUp);
  });
  edge.addEventListener('keydown', (e) => {
    if (e.target !== edge || b.folded) return;
    const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft', shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    if (e.key === grow) { setWidth(side, b.w + 16); e.preventDefault(); }
    if (e.key === shrink) { setWidth(side, b.w - 16); e.preventDefault(); }
  });
  applyBar(side);
});

// ---- Mock bar ----
function jump(where) {
  closeDialog(); clearTimeout(S.splashTimer);
  if (where === 'splash') { showSplash(); return; }
  if (where === 'home') { goHome(); return; }
  loadSample();
  if (where === 'edit') startEdit('vuur-in-de-kring');
  if (where === 'check') { startEdit('the-mock-song'); S.draft.title = ''; S.draft.language = ''; apply(); }
}
$('badges').addEventListener('change', (e) => document.body.classList.toggle('nobadges', !e.target.checked));

showSplash();
