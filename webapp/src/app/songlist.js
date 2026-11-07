// SPDX-License-Identifier: Apache-2.0
// The song list in the right bar (webappGUI GD-13, GD-16, GD-25; implementationPlan M5.1): search,
// *Ook in de tekst*, A–Z / Z–A, language and tag chips and *Wis filters*, as the app's songbook
// (app SongbookFilter.kt); a click selects a song, *Bewerken* opens it (M5.3), the bin deletes it.
// The songs come from the worker's summary (SR-30). The filter belongs to the screen, not the library:
// the list is built once per library and language and keeps it until another library is opened.

import { el, icon, listen } from './dom.js';
import { t } from './i18n.js';
import { severityGroup, severityIcon, messageFor } from './check.js';

/** Lower case without accents: "Één" and "een" are the same word (as the app's fold). */
export const fold = (s) => String(s || '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().trim();

export const DEFAULT_FILTER = Object.freeze({ query: '', inText: false, descending: false, languages: [], tags: [] });

export const isDefaultFilter = (f) => !f.query.trim() && !f.inText && !f.descending && !f.languages.length && !f.tags.length;

/**
 * GD-13: the songs to show, in order. Every typed word in the title (or, with inText, in the words);
 * within a chip group any chosen value matches, and the groups all apply. Sorted by sort title or
 * title, without case or accents, then by ID so the order is stable.
 */
export function filterSongs(songs, filter, lang) {
  const words = filter.query.split(/\s+/).map(fold).filter(Boolean);
  const shown = songs.filter((s) => (!filter.languages.length || filter.languages.includes(s.language || ''))
    && (!filter.tags.length || (s.tags || []).some((x) => filter.tags.includes(x)))
    && (!words.length || ((hay) => words.every((w) => hay.includes(w)))(fold(filter.inText ? s.words : s.title))));
  const coll = new Intl.Collator(lang, { sensitivity: 'base' });
  const key = (s) => s.sortTitle || s.title || s.id;
  shown.sort((a, b) => coll.compare(key(a), key(b)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return filter.descending ? shown.reverse() : shown;
}

/** GD-13: the chips: the languages (only when there is more than one) and the tags of the songs. */
export function chipsOf(songs, lang) {
  const coll = new Intl.Collator(lang, { sensitivity: 'base' });
  const languages = [...new Set(songs.map((s) => s.language || ''))].sort();
  const tags = [...new Set(songs.flatMap((s) => s.tags || []))].sort(coll.compare);
  return { languages: languages.length > 1 ? languages : [], tags };
}

/** GD-16: the song selected after deleting id: the next one in the list, else the one before, else none. */
export function neighbourAfterDelete(visibleIds, id) {
  const i = visibleIds.indexOf(id);
  if (i < 0) return null;
  return visibleIds[i + 1] ?? visibleIds[i - 1] ?? null;
}

/** A language's name in the interface language, or the code when the browser does not know it. */
export function languageName(lang, code) {
  if (!code) return t(lang, 'langUnknown');
  try {
    return new Intl.DisplayNames([lang], { type: 'language' }).of(code) || code;
  } catch {
    return code;
  }
}

/** The worst Error or Warning of each song, for the mark on its row (Controle has them all). */
function worstBySong(findings) {
  const rank = { error: 2, warning: 1 };
  const out = new Map();
  for (const f of findings || []) {
    if (!/^SNG-/.test(f.code) || f.where === undefined) continue;
    const g = severityGroup(f.severity);
    if (!rank[g]) continue;
    const cur = out.get(f.where);
    if (!cur || rank[g] > rank[cur.group]) out.set(f.where, { group: g, finding: f });
  }
  return out;
}

/**
 * createSongList({ lang, readOnly, onSelect(id), onDelete(id) }) → { node, update(state, selectedId),
 * filter(), visibleIds(), reveal(id) }. *Bewerken* waits for the song editor (M5.3).
 */
export function createSongList({ lang, readOnly, onSelect, onDelete }) {
  let filter = { ...DEFAULT_FILTER, languages: [], tags: [] };
  let songs = [];
  let findings = [];
  let selected = null;
  let visible = [];

  const search = el('input', { type: 'search', class: 'search', id: 'song-search', placeholder: t(lang, 'search'),
    'aria-label': t(lang, 'search'), autocomplete: 'off', spellcheck: 'false' }, []);
  const inText = el('input', { type: 'checkbox', id: 'song-intext' }, []);
  const sort = el('button', { type: 'button', class: 'btn btn-text btn-small', title: t(lang, 'reverse'), 'aria-label': t(lang, 'reverse') }, ['A–Z']);
  const chips = el('div', { class: 'chiprow', role: 'group', 'aria-label': t(lang, 'filters') }, []);
  const clear = el('div', { class: 'clearwrap' }, []);
  const tools = el('div', { class: 'sbtools' }, [
    search,
    el('div', { class: 'tbrow' }, [
      el('label', { class: 'switch', for: 'song-intext' }, [inText, el('span', { class: 'track', 'aria-hidden': 'true' }, []), el('span', {}, [t(lang, 'inText')])]),
      sort,
    ]),
    chips,
    clear,
  ]);
  const heading = el('h3', { class: 'listhead' }, []);
  const list = el('ul', { class: 'songlist', 'aria-label': t(lang, 'songs') }, []);
  const empty = el('p', { class: 'empty' }, [t(lang, 'libEmpty')]);
  const node = el('div', { class: 'songpane' }, [heading, tools, list, empty]);

  const setFilter = (next) => {
    filter = next;
    draw();
  };
  listen(search, 'input', () => setFilter({ ...filter, query: search.value }));
  listen(inText, 'change', () => setFilter({ ...filter, inText: inText.checked }));
  listen(sort, 'click', () => setFilter({ ...filter, descending: !filter.descending }));

  function chip(group, value, label) {
    const on = filter[group].includes(value);
    return el('button', { type: 'button', class: on ? 'fchip on' : 'fchip', 'aria-pressed': on ? 'true' : 'false', on: { click: () => {
      const values = on ? filter[group].filter((x) => x !== value) : [...filter[group], value];
      setFilter({ ...filter, [group]: values });
    } } }, [on ? icon('check') : null, label]);
  }

  function row(song, worst) {
    const title = song.title || t(lang, 'noTitle');
    const sub = [languageName(lang, song.language), song.lyricist].filter(Boolean).join(' · ');
    const edit = el('button', { type: 'button', class: 'btn btn-outline btn-small', disabled: true,
      title: `${t(lang, 'edit')}: ${t(lang, 'tileSoon')}` }, [t(lang, 'edit')]);
    const bin = el('button', { type: 'button', class: 'iconbtn binbtn', disabled: readOnly, title: t(lang, 'deleteSong'),
      'aria-label': `${t(lang, 'deleteSong')}: ${title}` }, [icon('delete')]);
    if (!readOnly) listen(bin, 'click', (event) => { event.stopPropagation(); onDelete(song.id, title); });
    const li = el('li', { class: song.id === selected ? 'song selected' : 'song', tabindex: 0, 'data-song': song.id,
      'aria-current': song.id === selected ? 'true' : null, title: t(lang, 'clickToView') }, [
      el('span', { class: 't' }, [worst ? el('span', { title: messageFor(lang, worst.finding) }, [severityIcon(worst.group)]) : null, title]),
      el('span', { class: 'actions' }, [edit, bin]),
      el('span', { class: 's' }, [sub]),
    ]);
    listen(li, 'click', () => onSelect(song.id));
    listen(li, 'keydown', (event) => {
      if (event.target === li && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onSelect(song.id);
      }
    });
    return li;
  }

  function draw() {
    const c = chipsOf(songs, lang);
    // a chosen chip whose songs are gone no longer filters
    filter = { ...filter, languages: filter.languages.filter((x) => c.languages.includes(x)), tags: filter.tags.filter((x) => c.tags.includes(x)) };
    heading.replaceChildren(`${t(lang, 'songs')} (${songs.length})`);
    tools.hidden = songs.length === 0;
    empty.hidden = songs.length !== 0;
    sort.replaceChildren(filter.descending ? 'Z–A' : 'A–Z');
    inText.checked = filter.inText;
    if (search.value !== filter.query) search.value = filter.query;
    chips.hidden = !c.languages.length && !c.tags.length;
    chips.replaceChildren(...c.languages.map((x) => chip('languages', x, languageName(lang, x))), ...c.tags.map((x) => chip('tags', x, x)));
    clear.replaceChildren(...(isDefaultFilter(filter) ? [] : [el('button', { type: 'button', class: 'btn btn-text btn-small',
      on: { click: () => setFilter({ ...DEFAULT_FILTER, languages: [], tags: [] }) } }, [t(lang, 'clearFilters')])]));
    const worst = worstBySong(findings);
    const shown = filterSongs(songs, filter, lang);
    visible = shown.map((s) => s.id);
    list.hidden = songs.length === 0;
    list.replaceChildren(...(shown.length ? shown.map((s) => row(s, worst.get(s.id)))
      : [el('li', { class: 'empty' }, [t(lang, 'noSongsFound')])]));
  }

  return {
    node,
    update(state, selectedId) {
      songs = state.songs || [];
      findings = state.findings || [];
      selected = selectedId ?? null;
      draw();
    },
    filter: () => filter,
    visibleIds: () => visible,
    /** GD-25: a song the filter hides is shown by clearing the filter; returns true when it was hidden. */
    reveal(id) {
      if (visible.includes(id) || !songs.some((s) => s.id === id)) return false;
      setFilter({ ...DEFAULT_FILTER, languages: [], tags: [] });
      return true;
    },
  };
}

