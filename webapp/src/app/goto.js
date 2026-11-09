// SPDX-License-Identifier: Apache-2.0
// *Ga naar* in Controle (FDS EDT-41; webappGUI GD-20; implementationPlan M5): where a finding takes the
// user, so the thing it is about can be fixed there. Pure: main.js goes there.
//
//   { kind: 'song', id, field }  the song in the editor's Blokken with that field focused (GD-05)
//   { kind: 'song', id, line }   the song in the code mode at that line (GD-38, EDT-33)
//   { kind: 'song', id }         the song itself
//   { kind: 'songs', ids, title } the song list filtered to these songs (SNG-10, GD-13)
//   { kind: 'set', name }        the set open in the centre (GD-21)
//   { kind: 'library', field }   the library's fields, that one focused (GD-22), or none
//   { kind: 'library', field: null, add: true }  STR-02, no songs: the library's home with *Lied toevoegen* focused

import { fieldsOf } from './library-form.js';

// SNG-16: the recommended field that is missing (validate.js), as a field of the left bar
const MISSING_FIELD = { fieldWho: 'lyricist', fieldCopyright: 'copyright', fieldLicense: 'license', fieldSource: 'source', fieldTag: 'tag' };

/** Where finding f leads. */
export function targetOf(f) {
  const p = f.params || {};
  // SNG-10 names several songs (validate.js): the list shows just those, so the user can tell them apart
  if (f.code === 'SNG-10' && Array.isArray(p.songs) && p.songs.length) return { kind: 'songs', ids: p.songs.map(String), title: p.title || '' };
  // a structure finding about a song's folder (STR-05 to STR-08, STR-10, STR-11) leads to that song
  const folder = /^STR-/.test(f.code) && typeof f.where === 'string' ? /^songs\/([^/]+)/.exec(f.where) : null;
  if (folder) return { kind: 'song', id: folder[1] };
  if (/^SNG-/.test(f.code) && f.where !== undefined) {
    const id = String(f.where);
    if (f.code === 'SNG-02') return { kind: 'song', id, field: 'title' };
    if (f.code === 'SNG-11') return { kind: 'song', id, field: 'language' };
    if (f.code === 'SNG-16' && MISSING_FIELD[p.field]) return { kind: 'song', id, field: MISSING_FIELD[p.field] };
    if (f.code === 'SNG-15' && p.directive === 'tag') return { kind: 'song', id, field: 'tag' };
    if (Number.isInteger(p.line) && p.line > 0) return { kind: 'song', id, line: p.line };
    return { kind: 'song', id };
  }
  if (/^SET-/.test(f.code) && f.where !== undefined) return { kind: 'set', name: String(f.where) };
  if (f.code === 'STR-02') return { kind: 'library', field: null, add: true };
  if (f.code === 'MAN-07' || f.code === 'MAN-08' || f.code === 'MAN-02') {
    const [field] = fieldsOf(f);
    return { kind: 'library', field: field || null };
  }
  return { kind: 'library', field: null };
}

/** The element ids of the library form's fields (library-form.js), by fieldsOf's names. */
export const LIBRARY_FIELD_ID = {
  title: 'lib-title', description: 'lib-description', license: 'lib-license', licenseId: 'lib-license-id',
  summary: 'lib-summary', licenseText: 'lib-license-text', maintainer: 'lib-mname', contact: 'lib-mcontact',
};
