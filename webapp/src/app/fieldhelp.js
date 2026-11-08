// SPDX-License-Identifier: Apache-2.0
// Help for the song's fields (webappGUI GD-44; the owner's M5 review, F8): an ⓘ beside a field's label opens a
// short explanation under the field, and a second click closes it. Which explanations are open lasts while the
// page is open, so a redrawn left bar keeps them; nothing is stored (EDT-02). Used by the song's data in view mode
// (songview.js) and by its fields in the editor (songfields.js).

import { el, icon, listen, setAttrs } from './dom.js';
import { t } from './i18n.js';

/** The text of each field's explanation (texts.js), by the field's name. */
export const HELP = Object.freeze({
  title: 'helpTitle', language: 'helpLanguage', lyricist: 'helpLyricist', composer: 'helpComposer', copyright: 'helpCopyright',
  license: 'helpLicense', source: 'helpSource', tag: 'helpTags', id: 'helpSongId',
});

const open = new Set();                                  // the explanations open on this page

/** Whether a field's explanation is open (tests). */
export const helpOpen = (name) => open.has(name);

/**
 * GD-44: { row, panel } for field name: row is labelNode with the ⓘ beside it, panel the explanation, to go under
 * the field's value. label names the field for the button's accessible name.
 */
export function fieldHelp(lang, name, label, labelNode) {
  const id = `help-${name}`;
  const panel = el('div', { class: 'fieldhelp', id, hidden: !open.has(name) }, [t(lang, HELP[name], { other: t(lang, 'otherLanguage') })]);
  const text = t(lang, 'helpFor', { field: label });
  const button = el('button', { type: 'button', class: 'helpbtn', title: text, 'aria-label': text, 'aria-controls': id,
    'aria-expanded': String(open.has(name)) }, [icon('about')]);
  listen(button, 'click', () => {
    if (open.has(name)) open.delete(name);
    else open.add(name);
    setAttrs(button, { 'aria-expanded': String(open.has(name)) });
    panel.hidden = !open.has(name);
  });
  return { row: el('div', { class: 'flabelrow' }, [labelNode, button]), panel };
}
