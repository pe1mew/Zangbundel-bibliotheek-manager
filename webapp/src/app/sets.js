// SPDX-License-Identifier: Apache-2.0
// Sets (webappGUI GD-21; FDS EDT-31, SET-01 to SET-05, D-22; implementationPlan M5.5): the *Sets* tab of
// the right bar and an open set in the centre. Sets are lists of song IDs in the manifest (§4.1): adding,
// renaming, reordering and deleting a set, and adding, removing and reordering its songs, change only
// that list; deleting a set or taking a song out of it never deletes the song (EDT-31). The operations
// are pure (new arrays, the old ones untouched); the session applies them (updateSets).

import { el, icon, listen } from './dom.js';
import { t } from './i18n.js';
import { severityIcon, messageFor } from './check.js';
import { languageName } from './songlist.js';
import { startDrag } from './drag.js';

export const SET_NAME_MAX = 60;                          // FDS 4.1: as a setlist title (song format §13)
const NAME_BAD = /[\u0000-\u001f\u007f-\u009f{}]/;       // MAN-02: no line break, brace or control character

/** A typed set name as it is stored: no outer spaces, NFC. */
export const cleanSetName = (name) => String(name).trim().normalize('NFC');

/** Why name cannot be the name of set `except` (or a new one): 'empty', 'long', 'chars', 'taken' (SET-02), or null. */
export function setNameProblem(name, sets, except = -1) {
  const n = cleanSetName(name);
  if (!n) return 'empty';
  if ([...n].length > SET_NAME_MAX) return 'long';
  if (NAME_BAD.test(n)) return 'chars';
  if (sets.some((s, i) => i !== except && s.name.toLowerCase() === n.toLowerCase())) return 'taken';
  return null;
}

const move = (list, from, to) => {
  const out = list.slice();
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
};
const withSet = (sets, i, change) => sets.map((s, k) => (k === i ? change(s) : s));

export const addSet = (sets, name) => [...sets, { name: cleanSetName(name), songs: [] }];
export const renameSet = (sets, i, name) => withSet(sets, i, (s) => ({ ...s, name: cleanSetName(name) }));
export const deleteSet = (sets, i) => sets.filter((s, k) => k !== i);
/** Move set or entry from place `from` to place `to` (both in the list as it is). */
export const moveSet = (sets, from, to) => move(sets, from, to);
/** SET-04: a song is in a set at most once. */
export const addEntry = (sets, i, id) => withSet(sets, i, (s) => (s.songs.includes(id) ? s : { ...s, songs: [...s.songs, id] }));
export const removeEntry = (sets, i, k) => withSet(sets, i, (s) => ({ ...s, songs: s.songs.filter((x, n) => n !== k) }));
export const moveEntry = (sets, i, from, to) => withSet(sets, i, (s) => ({ ...s, songs: move(s.songs, from, to) }));

const iconButton = (name, text, disabled, click) => el('button', { type: 'button', class: name === 'delete' ? 'iconbtn binbtn' : 'iconbtn',
  title: text, 'aria-label': text, disabled, on: disabled ? undefined : { click: (e) => { e.stopPropagation(); click(); } } }, [icon(name)]);

/**
 * GD-21: the *Sets* tab: the sets in order, each with its number of songs, *Omhoog*, *Omlaag*,
 * *Naam wijzigen* and *Set verwijderen*, and *Nieuwe set* below. createSetList({ lang, readOnly, onOpen(i),
 * onNew(), onRename(i), onDelete(i), onMove(i, dir) }) → { node, update(state, openSet) }.
 */
export function createSetList({ lang, readOnly, onOpen, onNew, onRename, onDelete, onMove }) {
  const list = el('ul', { class: 'songlist setlist', 'aria-label': t(lang, 'sets') }, []);
  const empty = el('p', { class: 'empty' }, [t(lang, 'noSets')]);
  const foot = el('div', { class: 'listfoot' }, [el('button', { type: 'button', class: 'btn btn-outline btn-small', disabled: readOnly,
    on: readOnly ? undefined : { click: () => onNew() } }, [icon('add'), t(lang, 'newSet')])]);
  const node = el('div', { class: 'setpane' }, [list, empty, foot]);
  return {
    node,
    update(state, openSet) {
      const sets = (state.library && state.library.sets) || [];
      empty.hidden = sets.length > 0;
      list.hidden = sets.length === 0;
      list.replaceChildren(...sets.map((s, i) => {
        const li = el('li', { class: i === openSet ? 'song setrow selected' : 'song setrow', tabindex: 0,
          'aria-current': i === openSet ? 'true' : null }, [
          el('span', { class: 't' }, [s.songs.length ? icon('playlist', 'inl') : severityIcon('warning'), s.name]),
          el('span', { class: 'actions' }, [
            iconButton('up', t(lang, 'up'), readOnly || i === 0, () => onMove(i, -1)),
            iconButton('down', t(lang, 'down'), readOnly || i === sets.length - 1, () => onMove(i, 1)),
            iconButton('edit', t(lang, 'rename'), readOnly, () => onRename(i)),
            iconButton('delete', t(lang, 'deleteSet'), readOnly, () => onDelete(i)),
          ]),
          el('span', { class: 's' }, [s.songs.length === 1 ? t(lang, 'setSongsOne') : t(lang, 'setSongs', { n: s.songs.length })]),
        ]);
        listen(li, 'click', () => onOpen(i));
        listen(li, 'keydown', (e) => { if (e.target === li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(i); } });
        return li;
      }));
    },
  };
}

/**
 * GD-21: an open set in the centre: its name, *Naam wijzigen*, the hint that songs are added from the
 * song list, and its songs in order, each with a handle, *Omhoog*, *Omlaag* and a bin that takes the song
 * out of the set only. A song the library does not have is marked with M-32 (SET-01).
 * setViewNode(lang, { set, index, songs, readOnly, onRename, onRemove(k), onMoveEntry(from, to) }).
 */
export function setViewNode(lang, { set, songs, readOnly, onRename, onRemove, onMoveEntry }) {
  const byId = new Map(songs.map((s) => [s.id, s]));
  const entries = el('div', { class: 'sections setentries' }, []);
  const rows = set.songs.map((id, k) => {
    const song = byId.get(id);
    const handle = el('span', { class: 'handle', title: t(lang, 'dragTitle'), 'aria-hidden': 'true' }, [icon('drag')]);
    const card = el('div', { class: 'section setentry' }, [el('div', { class: 'secbar' }, [
      readOnly ? null : handle,
      el('span', { class: 'setno' }, [String(k + 1)]),
      el('span', { class: 'grow' }, song
        ? [el('b', {}, [song.title || t(lang, 'noTitle')]), ' ', el('span', { class: 'muted small' }, [languageName(lang, song.language)])]
        : [severityIcon('error'), ' ', messageFor(lang, { code: 'SET-01', severity: 'Error', params: { set: set.name, song: id } })]),
      iconButton('up', t(lang, 'up'), readOnly || k === 0, () => onMoveEntry(k, k - 1)),
      iconButton('down', t(lang, 'down'), readOnly || k === set.songs.length - 1, () => onMoveEntry(k, k + 1)),
      iconButton('delete', t(lang, 'removeFromSet'), readOnly, () => onRemove(k)),
    ])]);
    if (!readOnly && set.songs.length > 1) {
      listen(handle, 'pointerdown', (e) => startDrag(e, { handle, card, list: entries, scroller: card.closest('.centre') || entries,
        onDrop: (from, to) => onMoveEntry(from, to) }));
    }
    return card;
  });
  entries.replaceChildren(...rows);
  return el('div', { class: 'edit setview' }, [
    el('div', { class: 'edithead' }, [
      el('h2', {}, [icon('playlist', 'inl'), set.name]),
      el('button', { type: 'button', class: 'btn btn-text', disabled: readOnly, on: readOnly ? undefined : { click: onRename } }, [icon('edit'), t(lang, 'rename')]),
    ]),
    el('p', { class: 'muted small' }, [t(lang, 'setHint')]),
    set.songs.length ? null : el('p', { class: 'hint' }, [severityIcon('warning'), messageFor(lang, { code: 'SET-03', severity: 'Warning', params: { set: set.name } })]),
    entries,
  ]);
}
