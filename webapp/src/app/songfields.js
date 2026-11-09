// SPDX-License-Identifier: Apache-2.0
// The song's fields in the left bar while it is edited in *Blokken* (webappGUI GD-05; FDS EDT-34;
// implementationPlan M5.3c): title and language (required), words, music, copyright, licence, source
// and tags, each reading and writing its directive in the song through the block form (blockmeta.js
// setMeta), so the fields and the song stay one. The song ID is shown, never edited (EDT-34, EDT-36).
// A field is applied on leaving it; while typing it only marks what the song rules will report
// (SNG-02, SNG-11, SNG-15), which Controle and the code mode then show by the engine's own rules.

import { el, icon, listen, toggleClass } from './dom.js';
import { t } from './i18n.js';
import { metaValues, setMeta, valueProblem } from '../core/blockmeta.js';
import { isLanguageTag, isSongId } from '../core/names.js';
import { languageName } from './songlist.js';
import { fieldHelp } from './fieldhelp.js';

/** The languages offered in the list (the mock's); a song's own other language is added to them. */
export const SONG_LANGUAGES = ['nl', 'en', 'de', 'fy', 'fr'];
const OTHER = 'other';
// a value goes into a directive: no braces, no control characters (5.3; blockmeta valueProblem)
const VALUE_FORBIDDEN = /[{}\u0000-\u001f\u007f-\u009f]/g;

/** Several names in one field, separated by ; (lyricist and composer may repeat, song format 6.1). */
export const splitNames = (text) => text.split(';').map((x) => x.trim()).filter(Boolean);
/** Tags, separated by commas, each once. */
export const splitTags = (text) => [...new Set(text.split(',').map((x) => x.trim()).filter(Boolean))];

/** The fields as they edit the form: name → { values from text, text from values }. */
const FIELDS = {
  title: { one: true }, language: { one: true }, copyright: { one: true }, license: { one: true }, source: { one: true },
  lyricist: { split: splitNames, join: (v) => v.join('; ') }, composer: { split: splitNames, join: (v) => v.join('; ') },
  tag: { split: splitTags, join: (v) => v.join(', ') },
};
const valuesOf = (name, text) => {
  const f = FIELDS[name];
  if (f.one) return text.trim() ? [text.trim()] : [];
  return f.split(text);
};

/** What a field would make the song rules report, as a message, or null. */
export function fieldProblem(lang, name, values) {
  if (name === 'title' && !values.length) return t(lang, 'errSongTitle');
  if (name === 'language' && (values.length !== 1 || !isLanguageTag(values[0]))) return t(lang, values.length ? 'errLanguage' : 'chooseLang');
  if (name === 'tag') {
    const bad = values.filter((x) => !isSongId(x));
    if (bad.length) return t(lang, 'errTags', { tags: bad.join(', ') });
  }
  return null;
}

// SNG-16's licence: an SPDX identifier, public-domain or proprietary (validate.js SONG_LICENSE)
const SONG_LICENSE = /^[A-Za-z0-9.+-]+$/;

/**
 * SNG-16 in the editor (the owner's look at dev.6): every recommended field that is empty, at once, so none has to be
 * found one by one through Controle. Words or music: both are marked while both are empty. They are advice
 * (Warnings) and never stop *Toepassen*. values(name) gives a field's values as the song holds them.
 */
export function fieldAdvice(lang, name, values) {
  if (name === 'lyricist' || name === 'composer') return values('lyricist').length || values('composer').length ? null : t(lang, 'recWho');
  if (name === 'license') {
    const v = values('license');
    if (!v.length) return t(lang, 'recEmpty');
    return v.every((x) => SONG_LICENSE.test(x)) ? null : t(lang, 'recLicense');
  }
  if (name === 'copyright' || name === 'source' || name === 'tag') return values(name).length ? null : t(lang, 'recEmpty');
  return null;
}

/**
 * createSongFields({ lang, id, getForm(), setForm(form) }) → { node }. The fields read the form when
 * built; each change writes its field with setMeta and hands the new form back.
 */
export function createSongFields({ lang, id, getForm, setForm }) {
  const form = getForm();
  const boxes = {};
  const errors = {};
  // a field's own error, else its advice (a recommended field still empty), else nothing
  const mark = (name, message) => {
    const advice = message ? null : fieldAdvice(lang, name, (n) => metaValues(getForm(), n));
    toggleClass(boxes[name], 'invalid', Boolean(message));
    toggleClass(boxes[name], 'warn', Boolean(advice));
    errors[name].replaceChildren(...(message ? [icon('error', 'sev sev-error'), message]
      : advice ? [icon('warning', 'sev sev-warning'), advice] : []));
  };
  const ALL = ['title', 'language', 'lyricist', 'composer', 'copyright', 'license', 'source', 'tag'];
  const markAll = () => { for (const name of ALL) mark(name, fieldProblem(lang, name, metaValues(getForm(), name))); };
  const write = (name, values) => {
    if (values.some((v) => valueProblem(v))) return;     // cannot be: typing keeps braces and controls out
    setForm(setMeta(getForm(), name, values));
    markAll();                                           // words and music are advised together
  };
  const clean = (input) => {
    const v = input.value.replace(VALUE_FORBIDDEN, '');
    if (v !== input.value) input.value = v;
  };
  const box = (name, label, control, required, note) => {
    errors[name] = el('div', { class: 'err', role: 'alert' }, []);
    // GD-44 (F8): an ⓘ beside the label opens the field's explanation under it
    const help = fieldHelp(lang, name, label,
      el('label', { for: `song-${name}` }, [label, required ? el('span', { class: 'req', 'aria-hidden': 'true' }, [' *']) : null]));
    boxes[name] = el('div', { class: 'field' }, [
      help.row, control, note ? el('div', { class: 'muted small' }, [note]) : null, help.panel, errors[name]]);
    return boxes[name];
  };
  const input = (name, placeholder) => {
    const f = FIELDS[name];
    const values = metaValues(form, name);
    const i = el('input', { id: `song-${name}`, type: 'text', autocomplete: 'off', maxlength: name === 'title' ? 200 : 500,
      value: f.one ? (values[0] || '') : f.join(values), placeholder: placeholder || null,
      'aria-required': name === 'title' ? 'true' : null }, []);
    listen(i, 'input', () => clean(i));
    listen(i, 'change', () => write(name, valuesOf(name, i.value)));
    return i;
  };

  // GD-05: the language from a list, or another code (SNG-11: one BCP 47 tag)
  const current = metaValues(form, 'language');
  const known = [...SONG_LANGUAGES, ...current.filter((x) => isLanguageTag(x) && !SONG_LANGUAGES.includes(x))];
  const select = el('select', { id: 'song-language', 'aria-required': 'true' }, [
    el('option', { value: '', selected: !current.length }, [t(lang, 'chooseLang')]),
    ...known.map((code) => el('option', { value: code, selected: current.length === 1 && current[0] === code }, [languageName(lang, code)])),
    el('option', { value: OTHER, selected: current.length > 1 || (current.length === 1 && !known.includes(current[0])) }, [t(lang, 'otherLanguage')]),
  ]);
  const code = el('input', { id: 'song-language-code', type: 'text', autocomplete: 'off', spellcheck: 'false', maxlength: 35,
    'aria-label': t(lang, 'fLanguageCode'), placeholder: t(lang, 'fLanguageCode'),
    value: select.value === OTHER ? current.join(' ') : '' }, []);
  code.hidden = select.value !== OTHER;
  listen(select, 'change', () => {
    code.hidden = select.value !== OTHER;
    if (select.value === OTHER) {
      code.focus();
      return;
    }
    write('language', select.value ? [select.value] : []);
  });
  listen(code, 'input', () => clean(code));
  listen(code, 'change', () => write('language', code.value.trim() ? [code.value.trim()] : []));

  const node = el('div', { class: 'libform songfields' }, [
    el('h3', {}, [t(lang, 'songData')]),
    box('title', t(lang, 'fTitle'), input('title'), true),
    box('language', t(lang, 'fLanguage'), el('div', {}, [select, code]), true),
    box('lyricist', t(lang, 'fLyricist'), input('lyricist', t(lang, 'phTrad')), false, t(lang, 'severalNames')),
    box('composer', t(lang, 'fComposer'), input('composer', t(lang, 'phTrad'))),
    box('copyright', t(lang, 'fCopyright'), input('copyright', t(lang, 'phPd'))),
    box('license', t(lang, 'fLicense'), input('license', t(lang, 'phLicense'))),
    box('source', t(lang, 'fSource'), input('source', t(lang, 'phSource'))),
    box('tag', t(lang, 'fTags'), input('tag', t(lang, 'phTags'))),
    // EDT-36: a new song's ID is proposed from its title when it is applied
    ((help) => el('div', { class: 'field' }, [help.row,
      id ? el('div', { class: 'value fp' }, [id]) : el('div', { class: 'value none' }, [t(lang, 'idProposed')]), help.panel]))(
      fieldHelp(lang, 'id', t(lang, 'fSongId'), el('div', { class: 'flabel' }, [t(lang, 'fSongId')]))),
    el('p', { class: 'muted small' }, [el('span', { class: 'req' }, ['*']), ' ', t(lang, 'required')]),
  ]);
  markAll();
  return { node };
}
