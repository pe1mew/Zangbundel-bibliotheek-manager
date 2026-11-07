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

/** Spaces and tabs off the end of a line, in linear time (a regex like /[ \t]+$/ is quadratic, SR-33). */
function trimEndBlank(s) {
  let i = s.length;
  while (i > 0 && (s[i - 1] === ' ' || s[i - 1] === '\t')) i--;
  return s.slice(0, i);
}

/** Spaces and tabs off both ends, never other whitespace such as NBSP or U+FEFF (5.2, 5.3; song format v0.24):
 *  blank and directive lines are judged after this, and directive names, values and the meta split use it. */
export function trimBlank(s) {
  let i = 0;
  while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
  return trimEndBlank(s.slice(i));
}

/** Whether the character at index i is escaped by an odd number of backslashes before it (5.4). */
function escaped(s, i) {
  let n = 0;
  while (i - 1 - n >= 0 && s[i - 1 - n] === '\\') n++;
  return n % 2 === 1;
}

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
  // SNG-01: control characters other than LF, CR and tab; C1 (U+0080–U+009F) are control characters too
  const controlChars = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(text);
  text = text.replace(/^﻿/, '').normalize('NFC').replace(/\r\n?/g, '\n');
  const lines = text.split('\n').map(trimEndBlank);
  while (lines.length && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return { text: `${lines.join('\n')}\n`, bytesOk: true, controlChars };
}

/** The display text of a content line (9.1): chords and annotations removed, escapes resolved. */
function displayText(line, problems, mark = () => {}) {
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
        mark('bracket');
        out += ch;
        continue;
      }
      const token = line.slice(i + 1, j);
      if (!token.startsWith('*') && !CHORD.test(token)) {
        problems.chordName = true;                        // SNG-08
        mark('chordName', { chord: token });
      }
      i = j;
    } else {
      if (ch === ']') {
        problems.bracket = true;
        mark('bracket');
      }
      out += ch;
    }
  }
  return trimEndSpace(out.replace(/\t/g, ' '));
}

/** 9.1 (song format v0.25): the display text loses trailing spaces and characters of the Unicode categories
 *  Zs, Zl and Zp, so a no-break space too (unlike the trimming of 5 and 6). Linear in the line (SR-33). */
const TRAILING_SPACE = /[\p{Zs}\p{Zl}\p{Zp}]/u;
function trimEndSpace(s) {
  let i = s.length;
  while (i > 0 && TRAILING_SPACE.test(s[i - 1])) i--;    // every Z character is in the BMP: one code unit
  return s.slice(0, i);
}

/**
 * Parse the canonical text of a song. Returns
 * { meta: Map<name, string[]>, unknown: Set, lines: [canonical line list], problems, metaLines, unknownAt }:
 * problems has the flags malformed, envError, chorusEarly, newSong, bracket, chordName, and in
 * problems.at the first place of each, { line, ... } (FDS EDT-40: the location of a message);
 * metaLines gives the line of every value of meta, unknownAt the first line of each unknown directive.
 * Line numbers count the lines of the canonical text from 1; they are the lines of the file.
 */
export function parseSong(text) {
  const meta = new Map();
  const unknown = new Set();
  const problems = { malformed: false, envError: false, chorusEarly: false, newSong: false, bracket: false, chordName: false, at: {} };
  const metaLines = new Map();                            // name -> [line of each value]
  const unknownAt = new Map();                            // unknown directive -> its first line
  let n = 0;                                              // the current line, from 1
  let envLine = 0;                                        // where the open environment started
  const mark = (key, info) => { if (!problems.at[key]) problems.at[key] = { line: n, ...info }; };
  const lines = [];
  const choruses = [];                                    // [{ label, lines }] in file order
  let env = null;
  let chorus = null;                                      // the chorus being collected
  const put = (name, value) => {
    meta.set(name, [...(meta.get(name) || []), value]);
    metaLines.set(name, [...(metaLines.get(name) || []), n]);
  };
  const unknownName = (name) => {
    unknown.add(name);
    if (!unknownAt.has(name)) unknownAt.set(name, n);
  };

  for (const raw of text.split('\n')) {
    n += 1;
    const line = trimBlank(raw);
    // 5.2 (v0.25): a file comment's first character is '#', with no trimming; '  # x' is a lyric line
    if (line === '' || raw.startsWith('#')) {
      continue;
    }
    const starts = line.startsWith('{');
    const ends = line.endsWith('}') && !escaped(line, line.length - 1);
    // 5.2: a directive has no other { or } unless escaped; '{c: a} {new_song}' is not one directive
    const inner = starts && ends ? line.slice(1, -1) : '';
    const strayBrace = [...inner].some((ch, i) => (ch === '{' || ch === '}') && !escaped(inner, i));
    if (starts !== ends || strayBrace) {
      problems.malformed = true;                          // SNG-04, never shown as lyrics
      mark('malformed');
      continue;
    }
    if (starts) {
      const body = line.slice(1, -1);
      const colon = body.indexOf(':');
      let name = trimBlank(colon < 0 ? body : body.slice(0, colon)).toLowerCase();
      const value = colon < 0 ? '' : trimBlank(body.slice(colon + 1));
      name = ALIASES[name] || name;
      if (name === 'meta') {
        const m = /^([^ \t]+)[ \t]*(.*)$/.exec(value);              // 5.3: split at the first run of spaces or tabs
        const mname = m ? m[1].toLowerCase() : '';
        if (!META_NAMES.has(mname)) {
          unknownName(`meta ${mname}`);
        }
        put(mname, m ? trimBlank(m[2]) : '');
      } else if (METADATA_DIRECTIVES.has(name)) {
        put(name, value);
      } else if (name.startsWith('start_of_')) {
        if (env !== null) {
          problems.envError = true;                       // nested
          mark('envError', { start: envLine });
        }
        env = name.slice('start_of_'.length);
        envLine = n;
        chorus = env === 'chorus' ? { label: value, lines: [] } : null;
      } else if (name.startsWith('end_of_')) {
        if (env !== name.slice('end_of_'.length)) {
          problems.envError = true;                       // closed without being open, or another one
          mark('envError', { start: env !== null ? envLine : n });
        }
        if (env === 'chorus' && chorus) {
          choruses.push(chorus);
        }
        env = null;
        chorus = null;
      } else if (name === 'chorus') {
        if (choruses.length === 0) {
          problems.chorusEarly = true;                    // SNG-13
          mark('chorusEarly');
        } else {
          // 7.2: the chorus that carried exactly this label (the most recent such, as a plain {chorus}
          // takes the most recent chorus), otherwise the most recent chorus
          const labelled = value ? choruses.filter((c) => c.label === value) : [];
          const picked = labelled.length ? labelled[labelled.length - 1] : choruses[choruses.length - 1];
          lines.push(...picked.lines);                    // 7.2: one repetition per {chorus}
        }
      } else if (name === 'new_song') {
        problems.newSong = true;
        mark('newSong');
      } else if (!OTHER.has(name) && !LAYOUT.has(name)) {
        unknownName(name);
      }
      continue;
    }
    if (env !== null && !SHOWN_ENVS.has(env)) {
      continue;                                           // tab, grid, abc, unknown: skipped (10.1)
    }
    const shown = displayText(raw, problems, mark);
    if (shown !== '') {
      lines.push(shown);
      if (chorus) {
        chorus.lines.push(shown);
      }
    }
  }
  if (env !== null) {
    problems.envError = true;                             // still open at the end
    if (!problems.at.envError) problems.at.envError = { line: envLine, start: envLine };
  }
  return { meta, unknown, lines, problems, metaLines, unknownAt };
}

/**
 * What one line of a song is, by the same rules as parseSong (5.2, 5.3): 'blank', 'comment' (a file
 * comment, # in the first column), 'malformed' (SNG-04), 'directive' with its name (aliases resolved,
 * lower case; for {meta: x …} the name is 'meta' and meta holds x) and value, or 'content'.
 */
export function readLine(raw) {
  const line = trimBlank(raw);
  if (raw.startsWith('#')) return { type: 'comment' };
  if (line === '') return { type: 'blank' };
  const starts = line.startsWith('{');
  const ends = line.endsWith('}') && !escaped(line, line.length - 1);
  const inner = starts && ends ? line.slice(1, -1) : '';
  if (starts !== ends || [...inner].some((c, i) => (c === '{' || c === '}') && !escaped(inner, i))) return { type: 'malformed' };
  if (!starts) return { type: 'content' };
  const colon = inner.indexOf(':');
  let name = trimBlank(colon < 0 ? inner : inner.slice(0, colon)).toLowerCase();
  const value = colon < 0 ? '' : trimBlank(inner.slice(colon + 1));
  name = ALIASES[name] || name;
  if (name === 'meta') {
    const m = /^([^ \t]+)[ \t]*(.*)$/.exec(value);
    return { type: 'directive', name, meta: m ? m[1].toLowerCase() : '', value: m ? trimBlank(m[2]) : '' };
  }
  return { type: 'directive', name, value };
}

/**
 * A content line as segments for the song view (5.4; webappGUI GD-19): [{ chord, annotation, text }],
 * each segment a chord or annotation with the text that follows it, the first possibly without either.
 * The texts together are exactly the display text of 9.1 (displayText), so the view shows what the
 * rules check; a bracket that is not a chord stays text, as there.
 */
export function lineSegments(line) {
  const segs = [];
  let cur = { chord: null, annotation: null, text: '' };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && i + 1 < line.length) {
      const next = line[i + 1];
      cur.text += '[]{}\\'.includes(next) ? next : ch + next;
      i++;
    } else if (ch === '[') {
      const j = line.indexOf(']', i + 1);
      if (j < 0 || line.slice(i + 1, j).includes('[')) {
        cur.text += ch;
        continue;
      }
      const token = line.slice(i + 1, j);
      if (cur.chord !== null || cur.annotation !== null || cur.text !== '') segs.push(cur);
      cur = token.startsWith('*') ? { chord: null, annotation: token.slice(1), text: '' } : { chord: token, annotation: null, text: '' };
      i = j;
    } else {
      cur.text += ch;
    }
  }
  segs.push(cur);
  for (const s of segs) s.text = s.text.replace(/\t/g, ' ');
  // 9.1: trailing spaces go from the end of the line, across segments; the chords stay
  for (let k = segs.length - 1; k >= 0; k--) {
    const kept = trimEndSpace(segs[k].text);
    const whole = kept.length === 0;
    segs[k].text = kept;
    if (!whole) break;
  }
  return segs.filter((s, k) => k === 0 || s.chord !== null || s.annotation !== null || s.text !== '');
}

const REMARKS = { comment: 'plain', comment_italic: 'italic', comment_box: 'box' };

/**
 * The song as the song view shows it (7.1 to 7.4; webappGUI GD-19), in file order:
 *   { kind: 'verse' | 'chorus' | 'bridge', label, number, implicit, repeat, lines }  and  { kind: 'remark', text, style }
 * where a line is { segments } (lineSegments), { remark, style } or { gap: true } (a blank line inside an
 * environment). label is the environment's own label or null (the app then generates one); number counts
 * verses, implicit ones included (7.1); a {chorus} repeat carries the chorus's lines again (7.2). Tab, grid,
 * ABC and unknown environments, file comments and other directives are not shown, as in the app.
 */
export function songView(text) {
  const sections = [];
  const choruses = [];
  let env = null;
  let section = null;                                     // the open environment's section
  let implicit = null;                                    // the implicit verse being collected (7.3)
  let verses = 0;
  const open = (s) => {
    if (s.kind === 'verse') s.number = ++verses;
    sections.push(s);
    return s;
  };
  const dropTrailingGap = (s) => {
    while (s && s.lines.length && s.lines[s.lines.length - 1].gap) s.lines.pop();
  };
  for (const raw of text.split('\n')) {
    const line = trimBlank(raw);
    if (raw.startsWith('#')) continue;                    // a file comment is never shown (7.4)
    if (line === '') {
      if (section && section.lines.length && !section.lines[section.lines.length - 1].gap) section.lines.push({ gap: true });
      if (env === null) implicit = null;                  // 7.3: a blank line ends an implicit verse
      continue;
    }
    const starts = line.startsWith('{');
    const ends = line.endsWith('}') && !escaped(line, line.length - 1);
    const inner = starts && ends ? line.slice(1, -1) : '';
    if (starts !== ends || [...inner].some((c, i) => (c === '{' || c === '}') && !escaped(inner, i))) continue;   // SNG-04
    if (starts) {
      const colon = inner.indexOf(':');
      let name = trimBlank(colon < 0 ? inner : inner.slice(0, colon)).toLowerCase();
      const value = colon < 0 ? '' : trimBlank(inner.slice(colon + 1));
      name = ALIASES[name] || name;
      if (name.startsWith('start_of_')) {
        dropTrailingGap(section);
        implicit = null;
        env = name.slice('start_of_'.length);
        section = SHOWN_ENVS.has(env) ? open({ kind: env, label: value || null, number: null, implicit: false, repeat: false, lines: [] }) : null;
      } else if (name.startsWith('end_of_')) {
        dropTrailingGap(section);
        if (env === 'chorus' && section) choruses.push(section);
        env = null;
        section = null;
      } else if (name === 'chorus') {
        implicit = null;
        if (choruses.length) {
          const labelled = value ? choruses.filter((c) => c.label === value) : [];
          const picked = labelled.length ? labelled[labelled.length - 1] : choruses[choruses.length - 1];
          sections.push({ kind: 'chorus', label: value || picked.label, number: null, implicit: false, repeat: true, lines: picked.lines });
        }
      } else if (REMARKS[name]) {
        const remark = { remark: value, style: REMARKS[name] };
        if (section) section.lines.push(remark);
        else if (env === null) {
          implicit = null;
          sections.push({ kind: 'remark', text: value, style: REMARKS[name] });
        }
      }
      continue;
    }
    if (env !== null && !section) continue;               // tab, grid, abc, unknown: not shown (7.1, 10.1)
    const segments = lineSegments(raw);
    if (!segments.some((s) => s.text !== '' || s.chord !== null || s.annotation !== null)) continue;
    if (section) {
      section.lines.push({ segments });
    } else {
      if (!implicit) implicit = open({ kind: 'verse', label: null, number: null, implicit: true, repeat: false, lines: [] });
      implicit.lines.push({ segments });
    }
  }
  dropTrailingGap(section);
  return sections;
}
