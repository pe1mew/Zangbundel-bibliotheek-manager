// SPDX-License-Identifier: Apache-2.0
// The song view in the centre and the song's data in the left bar (webappGUI GD-05, GD-13, GD-16,
// GD-19; implementationPlan M5.2). The worker parses the song (library-handler songDetails, SR-30);
// this module only draws what it returns, with text nodes (SR-32). Labels the song does not carry are
// generated in the interface language, as the app does (song format 7.1); a repeated chorus shows its
// text again (7.2); remarks show in place (7.4); chords are highlighted inline.

import { el, icon } from './dom.js';
import { t } from './i18n.js';
import { languageName } from './songlist.js';

/** 7.1: the section's own label, or the one the app generates. */
export function sectionLabel(lang, section) {
  if (section.label) return section.label;
  if (section.kind === 'verse') return t(lang, 'verseN', { n: section.number });
  return t(lang, section.kind === 'chorus' ? 'chorus' : 'bridge');
}

function lineNode(line) {
  if (line.gap) return el('div', { class: 'gap', 'aria-hidden': 'true' }, []);
  if (line.remark !== undefined) return el('div', { class: `remark ${line.style}` }, [line.remark]);
  return el('div', { class: 'line' }, line.segments.flatMap((s) => [
    s.chord !== null ? el('span', { class: 'chord' }, [s.chord]) : null,
    s.annotation !== null ? el('span', { class: 'annot' }, [s.annotation]) : null,
    s.text,
  ]));
}

/** GD-19: the lyrics, section by section. */
export function lyricsNode(lang, sections) {
  return el('div', { class: 'lyrics' }, sections.map((s) => (s.kind === 'remark'
    ? el('div', { class: `remark ${s.style}` }, [s.text])
    : el('section', { class: s.kind === 'chorus' ? 'sec chorus' : 'sec', 'aria-label': sectionLabel(lang, s) }, [
      el('div', { class: 'lbl' }, [sectionLabel(lang, s)]),
      ...s.lines.map(lineNode),
    ]))));
}

/**
 * GD-13, GD-16: the selected song in view mode: its title, who wrote it, *Verwijderen* and *Bewerken*
 * (the song editor, M5.3), then its lyrics. details: { sections, meta } from the worker, sections null when the song is
 * not text.
 */
export function songViewNode(lang, id, details, { readOnly, onDelete, onEdit }) {
  const meta = details.meta || {};
  const title = meta.title || t(lang, 'noTitle');
  const by = [
    meta.lyricists && meta.lyricists.length ? t(lang, 'lyricsBy', { v: meta.lyricists.join(', ') }) : null,
    meta.composers && meta.composers.length ? t(lang, 'musicBy', { v: meta.composers.join(', ') }) : null,
  ].filter(Boolean).join(' · ');
  const del = el('button', { type: 'button', class: 'btn btn-text', disabled: readOnly, on: readOnly ? undefined : { click: () => onDelete(id, title) } },
    [icon('delete'), t(lang, 'delete')]);
  const canEdit = !readOnly && onEdit && details.sections !== null;
  const edit = el('button', { type: 'button', class: 'btn btn-outline', disabled: !canEdit,
    title: canEdit || readOnly ? t(lang, 'edit') : `${t(lang, 'edit')}: ${t(lang, 'tileSoon')}`, on: canEdit ? { click: () => onEdit(id) } : undefined },
  [icon('edit'), t(lang, 'edit')]);
  return el('div', { class: 'view' }, [
    el('div', { class: 'viewhead' }, [
      el('div', {}, [el('h1', {}, [title]), meta.subtitle ? el('div', { class: 'muted' }, [meta.subtitle]) : null,
        by ? el('div', { class: 'muted' }, [by]) : null]),
      el('div', { class: 'headbtns' }, [del, edit]),
    ]),
    details.sections ? lyricsNode(lang, details.sections) : el('p', { class: 'blocked' }, [t(lang, 'songNotText')]),
  ]);
}

const field = (label, value, none) => el('div', { class: 'field' }, [
  el('div', { class: 'flabel' }, [label]),
  el('div', { class: value ? 'value' : 'value none' }, [value || none]),
]);

/** GD-05 (view mode): the song's data in the left bar, read-only; editing them is M5.3. */
export function songDataNode(lang, id, details) {
  const m = details.meta || {};
  const notFilled = t(lang, 'notFilled');
  return el('div', { class: 'libform songdata' }, [
    el('h3', {}, [t(lang, 'songData')]),
    field(t(lang, 'fTitle'), m.title, notFilled),
    field(t(lang, 'fLanguage'), m.language ? languageName(lang, m.language) : null, notFilled),
    field(t(lang, 'fLyricist'), (m.lyricists || []).join(', '), notFilled),
    field(t(lang, 'fComposer'), (m.composers || []).join(', '), notFilled),
    field(t(lang, 'fCopyright'), m.copyright, notFilled),
    field(t(lang, 'fLicense'), m.license, t(lang, 'libLicense')),
    field(t(lang, 'fSource'), m.source, notFilled),
    el('div', { class: 'field' }, [
      el('div', { class: 'flabel' }, [t(lang, 'fTags')]),
      m.tags && m.tags.length ? el('div', { class: 'chips' }, m.tags.map((x) => el('span', { class: 'chip' }, [x])))
        : el('div', { class: 'value none' }, [t(lang, 'none')]),
    ]),
    el('div', { class: 'field' }, [el('div', { class: 'flabel' }, [t(lang, 'fSongId')]), el('div', { class: 'value fp' }, [id])]),
  ]);
}

/** GD-03 with a library open and no song selected: its title, a lead, *Lied toevoegen* and *Lied importeren* (EDT-32). */
export function libraryHomeNode(lang, state, { readOnly = false, onAdd, onImport } = {}) {
  const empty = !state.songs.length;
  const can = !readOnly;
  return el('div', { class: 'home' }, [
    el('h1', {}, [state.library.title]),
    el('p', { class: 'muted' }, [t(lang, empty ? 'libEmpty' : 'libHomeLead')]),
    el('div', { class: 'addrow' }, [
      el('button', { type: 'button', class: 'btn btn-primary', disabled: !can || !onAdd, on: can && onAdd ? { click: onAdd } : undefined },
        [icon('add'), t(lang, 'addSong')]),
      el('button', { type: 'button', class: 'btn btn-outline', disabled: !can || !onImport, on: can && onImport ? { click: onImport } : undefined },
        [icon('upload'), t(lang, 'importSong')]),
    ]),
  ]);
}
