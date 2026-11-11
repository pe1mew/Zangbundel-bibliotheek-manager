// SPDX-License-Identifier: Apache-2.0
// Help for the fields of the left bar, the song's and the library's (webappGUI GD-44; the owner's M5 review, F8,
// F11): an ⓘ beside a field's label opens a short explanation under the field, and a second click closes it. Which explanations are open lasts while the
// page is open, so a redrawn left bar keeps them; nothing is stored (EDT-02). Used by the song's data in view mode
// (songview.js), its fields in the editor (songfields.js) and the library's fields (library-form.js).
// From the keyboard (GD-44, amended 2026-11-10, M7.3): the field refers to its explanation (aria-describedby),
// so a screen reader reads it when the field gets the focus, and F1 in the field opens or closes it.

import { el, icon, listen, pageLink, setAttrs } from './dom.js';
import { t } from './i18n.js';

/** The text of each field's explanation (texts.js), by the field's name. */
export const HELP = Object.freeze({
  title: 'helpTitle', language: 'helpLanguage', lyricist: 'helpLyricist', composer: 'helpComposer', copyright: 'helpCopyright',
  license: 'helpLicense', source: 'helpSource', tag: 'helpTags', id: 'helpSongId',
  // F11: the library's fields (library-form.js)
  libTitle: 'helpLibTitle', libDescription: 'helpLibDescription', libLicense: 'helpLibLicense', libLicenseId: 'helpLibLicenseId',
  libSummary: 'helpLibSummary', libLicenseText: 'helpLibLicenseText', libMaintainer: 'helpLibMaintainer', libContact: 'helpLibContact',
});

/**
 * M7.6 (C9): each explanation's page and anchor in the wiki, /wiki/<lang>/<page>/#<anchor>. wiki.py check
 * refuses a link whose page or anchor is missing in any language.
 */
export const WIKI = Object.freeze({
  title: ['song-data', 'title'], language: ['song-data', 'language'], lyricist: ['song-data', 'lyricist'],
  composer: ['song-data', 'composer'], copyright: ['song-data', 'copyright'], license: ['song-data', 'license'],
  source: ['song-data', 'source'], tag: ['song-data', 'tags'], id: ['song-data', 'song-id'],
  libTitle: ['library-data', 'title'], libDescription: ['library-data', 'description'], libLicense: ['library-data', 'license'],
  libLicenseId: ['library-data', 'license-id'], libSummary: ['library-data', 'summary'], libLicenseText: ['library-data', 'license-text'],
  libMaintainer: ['library-data', 'maintainer-name'], libContact: ['library-data', 'maintainer-contact'],
});

/** The wiki page of an explanation, in the interface language. */
export const wikiPath = (lang, name) => (WIKI[name] ? `/wiki/${lang}/${WIKI[name][0]}/#${WIKI[name][1]}` : null);

const open = new Set();                                  // the explanations open on this page
const toggles = new Map();                               // explanation id -> its toggle, the latest drawn
const HELP_KEY = 'F1';
const FIELD_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
/** The inputs, selects and textareas in a node, the node itself included. */
const fieldsIn = (n) => (FIELD_TAGS.has(String(n.tagName || n.tag || '').toUpperCase()) ? [n] : [...(n.children || [])].flatMap(fieldsIn));

/** Whether a field's explanation is open (tests). */
export const helpOpen = (name) => open.has(name);

/**
 * GD-44: { row, panel, describe } for field name: row is labelNode with the ⓘ beside it, panel the explanation, to
 * go under the field's value; describe(control) makes each input, select or textarea in control refer to it.
 * label names the field for the button's accessible name.
 */
export function fieldHelp(lang, name, label, labelNode) {
  const id = `help-${name}`;
  const more = wikiPath(lang, name);                    // M7.6: the field's page in the wiki
  const panel = el('div', { class: 'fieldhelp', id, hidden: !open.has(name) }, [t(lang, HELP[name], { other: t(lang, 'otherLanguage') }),
    more ? ' ' : null, more ? pageLink(more, t(lang, 'helpMore'), t(lang, 'newTab')) : null]);
  const text = t(lang, 'helpFor', { field: label });
  // not in the tab order (the owner's look at dev.6): Tab goes from input to input; the mouse opens the help
  const button = el('button', { type: 'button', class: 'helpbtn', tabindex: -1, title: `${text} (${HELP_KEY})`, 'aria-label': text,
    'aria-controls': id, 'aria-expanded': String(open.has(name)) }, [icon('about')]);
  const toggle = () => {
    if (open.has(name)) open.delete(name);
    else open.add(name);
    setAttrs(button, { 'aria-expanded': String(open.has(name)) });
    panel.hidden = !open.has(name);
  };
  listen(button, 'click', toggle);
  toggles.set(id, toggle);
  const describe = (control) => {
    for (const c of fieldsIn(control)) {
      const had = ((c.getAttribute && c.getAttribute('aria-describedby')) || '').split(/\s+/).filter((x) => x && x !== id);
      setAttrs(c, { 'aria-describedby': [...had, id].join(' ') });
    }
    return control;
  };
  return { row: el('div', { class: 'flabelrow' }, [labelNode, button]), panel, describe };
}

/** GD-44 from the keyboard: F1 in a field opens or closes that field's explanation (once, at start). */
export function installHelpKey(doc = document) {
  listen(doc, 'keydown', (event) => {
    if (event.key !== HELP_KEY) return;
    const field = doc.activeElement;
    const id = field && (field.getAttribute('aria-describedby') || '').split(/\s+/).find((x) => toggles.has(x));
    if (!id || !doc.getElementById(id)) return;
    event.preventDefault();                               // not the browser's own help
    toggles.get(id)();
  });
}
