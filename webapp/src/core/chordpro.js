// SPDX-License-Identifier: Apache-2.0
// The ChordPro profile of the Zangbundel song format (app repository design/song-format.md,
// sections 5 to 9), as facts about one song file: its canonical form (8.1), its metadata (6),
// environments (7.1), chorus repeats (7.2) and canonical line list (9.1). The rules of FDS 6.6
// are applied to these facts in validate.js. Pure functions.

// Directives the profile knows (5.3, 6.1, 7.1, 7.2, 7.4, 7.5). Phase 2 and 3 directives such as
// x_zb_time are not known to a phase 1 profile: they are ignored and listed (I001, FDS SNG-07).
const ALIASES = {
  t: 'title', st: 'subtitle', c: 'comment', ci: 'comment_italic', cb: 'comment_box',
  sov: 'start_of_verse', eov: 'end_of_verse', soc: 'start_of_chorus', eoc: 'end_of_chorus',
  sob: 'start_of_bridge', eob: 'end_of_bridge', sot: 'start_of_tab', eot: 'end_of_tab',
  sog: 'start_of_grid', eog: 'end_of_grid', ns: 'new_song', np: 'new_page',
};
/** Metadata that is also a directive of its own ({title: …} equals {meta: title …}). */
export const METADATA_DIRECTIVES = new Set(['title', 'subtitle', 'sorttitle', 'lyricist', 'composer', 'artist', 'album',
  'year', 'copyright', 'key', 'capo', 'tempo', 'time', 'duration']);
const LAYOUT = new Set(['new_page', 'column_break', 'columns', 'textfont', 'textsize', 'textcolour', 'chordfont',
  'chordsize', 'chordcolour', 'titles', 'image']);
const OTHER = new Set(['meta', 'comment', 'comment_italic', 'comment_box', 'chorus', 'new_song']);
/** Meta names the profile knows (6.1, 10.3). */
export const META_NAMES = new Set([...METADATA_DIRECTIVES, 'id', 'language', 'license', 'source', 'tag', 'melody',
  'variant-group', 'redistribute', 'notation']);
/** Single-valued fields (6.2). */
export const SINGLE = new Set(['id', 'title', 'language', 'subtitle', 'sorttitle', 'copyright', 'license', 'source',
  'melody', 'variant-group', 'redistribute', 'key', 'capo', 'tempo', 'time', 'duration', 'year']);
const SHOWN_ENVS = new Set(['verse', 'chorus', 'bridge']);
const CHORD = /^[A-G](#|b)?[^/\s[\]]*(\/[A-G](#|b)?)?$/;

const utf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * Song format 8.1: decode, drop a BOM, NFC, LF line ends, no trailing spaces or tabs, one final LF.
 * Returns { text, bytesOk, controlChars } — text is null when the bytes are not UTF-8.
 */
export function canonicalize(bytes) {
  let text;
  try {
    text = utf8.decode(bytes);
  } catch {
    return { text: null, bytesOk: false, controlChars: false };
  }
  const controlChars = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
  text = text.replace(/^﻿/, '').normalize('NFC').replace(/\r\n?/g, '\n');
  const lines = text.split('\n').map((l) => l.replace(/[ \t]+$/, ''));
  while (lines.length && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return { text: `${lines.join('\n')}\n`, bytesOk: true, controlChars };
}

/** The display text of a content line (9.1): chords and annotations removed, escapes resolved. */
function displayText(line, problems) {
  let out = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && i + 1 < line.length) {
      const next = line[i + 1];
      out += '[]{}\\'.includes(next) ? next : ch + next;   // 5.4: other characters keep the backslash
      i++;
    } else if (ch === '[') {
      const j = line.indexOf(']', i + 1);
      if (j < 0 || line.slice(i + 1, j).includes('[')) {
        problems.bracket = true;                          // SNG-05
        out += ch;
        continue;
      }
      const token = line.slice(i + 1, j);
      if (!token.startsWith('*') && !CHORD.test(token)) {
        problems.chordName = true;                        // SNG-08
      }
      i = j;
    } else {
      if (ch === ']') {
        problems.bracket = true;
      }
      out += ch;
    }
  }
  return out.replace(/\t/g, ' ').replace(/\s+$/, '');
}

/**
 * Parse the canonical text of a song. Returns
 * { meta: Map<name, string[]>, unknown: Set, lines: [canonical line list], problems } where
 * problems has the flags malformed, envError, chorusEarly, newSong, bracket, chordName.
 */
export function parseSong(text) {
  const meta = new Map();
  const unknown = new Set();
  const problems = { malformed: false, envError: false, chorusEarly: false, newSong: false, bracket: false, chordName: false };
  const lines = [];
  const choruses = [];                                    // [{ label, lines }] in file order
  let env = null;
  let chorus = null;                                      // the chorus being collected
  const put = (name, value) => meta.set(name, [...(meta.get(name) || []), value]);

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const starts = line.startsWith('{');
    const ends = line.endsWith('}');
    if (starts !== ends) {
      problems.malformed = true;                          // SNG-04, never shown as lyrics
      continue;
    }
    if (starts) {
      const body = line.slice(1, -1);
      const colon = body.indexOf(':');
      let name = (colon < 0 ? body : body.slice(0, colon)).trim().toLowerCase();
      const value = colon < 0 ? '' : body.slice(colon + 1).trim();
      name = ALIASES[name] || name;
      if (name === 'meta') {
        const m = /^(\S+)\s*(.*)$/.exec(value);
        const mname = m ? m[1].toLowerCase() : '';
        if (!META_NAMES.has(mname)) {
          unknown.add(`meta ${mname}`);
        }
        put(mname, m ? m[2].trim() : '');
      } else if (METADATA_DIRECTIVES.has(name)) {
        put(name, value);
      } else if (name.startsWith('start_of_')) {
        if (env !== null) {
          problems.envError = true;                       // nested
        }
        env = name.slice('start_of_'.length);
        chorus = env === 'chorus' ? { label: value, lines: [] } : null;
      } else if (name.startsWith('end_of_')) {
        if (env !== name.slice('end_of_'.length)) {
          problems.envError = true;                       // closed without being open, or another one
        }
        if (env === 'chorus' && chorus) {
          choruses.push(chorus);
        }
        env = null;
        chorus = null;
      } else if (name === 'chorus') {
        if (choruses.length === 0) {
          problems.chorusEarly = true;                    // SNG-13
        } else {
          const picked = (value && choruses.find((c) => c.label === value)) || choruses[choruses.length - 1];
          lines.push(...picked.lines);                    // 7.2: one repetition per {chorus}
        }
      } else if (name === 'new_song') {
        problems.newSong = true;
      } else if (!OTHER.has(name) && !LAYOUT.has(name)) {
        unknown.add(name);
      }
      continue;
    }
    if (env !== null && !SHOWN_ENVS.has(env)) {
      continue;                                           // tab, grid, abc, unknown: skipped (10.1)
    }
    const shown = displayText(raw, problems);
    if (shown !== '') {
      lines.push(shown);
      if (chorus) {
        chorus.lines.push(shown);
      }
    }
  }
  if (env !== null) {
    problems.envError = true;                             // still open at the end
  }
  return { meta, unknown, lines, problems };
}
