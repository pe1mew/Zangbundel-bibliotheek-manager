// SPDX-License-Identifier: Apache-2.0
// The block form of a song (webappGUI GD-06, GD-18, GD-19, GD-38; implementationPlan M2.3): the song
// as the section editor sees it, and back to text without loss. Pure functions; no DOM.
//
//   toBlocks(text)  → { blocks }      fromBlocks({ blocks }) → text (canonical, FDS EDT-57)
//
// A block is one of
//   { type: 'section', kind: 'verse' | 'chorus' | 'bridge', label, lines, implicit }   editable (GD-19);
//       lines are lyric lines (strings, '' a blank line) and locked lines in their place ({ locked: line })
//   { type: 'repeat', label }                                                         {chorus} (7.2)
//   { type: 'meta', name, value }                                                     a metadata line (6.1; the left bar, GD-05)
//   { type: 'locked', lines }                                                         everything else, kept byte-exact (GD-19)
// and carries blank (the blank lines before it) and, when it came from the text, orig: how it was read.
// A block that still equals orig is written back as its original lines, so a song that is only
// switched between the modes comes back byte for byte (GD-38); a changed block is written canonically.
// Inside a verse, chorus or bridge, a {comment}, a # note, an unknown directive or any other line that
// is not lyric or blank is a locked line in its place: the section stays editable around it, and the
// line is written back as it was (the owner, 2026-11-07). Only a broken structure (an environment not
// closed by its own end) and tab, grid, ABC and unknown environments are locked as a whole; the
// ChordPro code mode (GD-38) edits those.

import { METADATA_DIRECTIVES, readLine } from './chordpro.js';
// the metadata helpers live in blockmeta.js, without the parser, so the page can use them (SR-30)
import { valueProblem } from './blockmeta.js';

const SECTION_KINDS = new Set(['verse', 'chorus', 'bridge']);
const LINE_MAX = 1000;

/** Why a typed lyric line would not stay a lyric line of its section, or null (GD-07; song format 5.2 to 5.4). */
export function lyricLineProblem(line) {
  if (typeof line !== 'string') return 'not text';
  if (/[\u0000-\u0008\u000a-\u001f\u007f-\u009f]/.test(line)) return 'control character';   // SNG-01; a line has no line end
  if ([...line].length > LINE_MAX) return 'too long';
  const r = readLine(line);
  if (r.type === 'comment') return 'starts with #';
  if (r.type === 'malformed' || r.type === 'directive') return 'is a directive';
  return null;
}


const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Spaces and tabs off the end, in linear time (SR-33: a regex such as /[ \t]+$/ is quadratic on a long run). */
function trimEnd(s) {
  let i = s.length;
  while (i > 0 && (s[i - 1] === ' ' || s[i - 1] === '\t')) i--;
  return s.slice(0, i);
}
const sectionOf = (b) => ({ kind: b.kind, label: b.label, lines: b.lines, implicit: b.implicit });

/** The song's text as blocks, in file order. text is canonical (song format 8.1): it ends with one LF. */
export function toBlocks(text) {
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const info = lines.map(readLine);
  const blocks = [];
  let blank = 0;
  const push = (b, raw) => {
    b.blank = blank;
    b.raw = raw;
    blank = 0;
    if (b.type === 'locked' && blocks.length && blocks[blocks.length - 1].type === 'locked' && b.blank === 0) {
      const prev = blocks[blocks.length - 1];             // one locked block per run of lines
      prev.lines.push(...b.lines);
      prev.raw = prev.lines.slice();
      prev.orig = { lines: prev.lines.slice() };
      return;
    }
    blocks.push(b);
  };
  const locked = (from, to) => {
    const ls = lines.slice(from, to);
    push({ type: 'locked', lines: ls, orig: { lines: ls.slice() } }, ls.slice());
  };
  let i = 0;
  while (i < lines.length) {
    const r = info[i];
    if (r.type === 'blank') {
      blank += 1;
      i += 1;
      continue;
    }
    if (r.type === 'content') {                           // 7.3: an implicit verse runs to a blank line
      let j = i;
      while (j < lines.length && info[j].type === 'content') j += 1;
      const ls = lines.slice(i, j);
      const b = { type: 'section', kind: 'verse', label: null, lines: ls, implicit: true };
      b.orig = sectionOf({ ...b, lines: ls.slice() });
      push(b, ls.slice());
      i = j;
      continue;
    }
    if (r.type !== 'directive') {
      locked(i, i + 1);
      i += 1;
      continue;
    }
    if (r.name.startsWith('start_of_')) {
      const kind = r.name.slice('start_of_'.length);
      let j = i + 1;
      while (j < lines.length && !(info[j].type === 'directive' && /^(start|end)_of_/.test(info[j].name))) j += 1;
      const closes = j < lines.length && info[j].name === `end_of_${kind}`;
      if (closes && SECTION_KINDS.has(kind)) {
        // between start and end there is no other start or end (the scan stopped at the first)
        const ls = lines.slice(i + 1, j).map((x, k) => (['content', 'blank'].includes(info[i + 1 + k].type) ? x : { locked: x }));
        const b = { type: 'section', kind, label: r.value || null, lines: ls, implicit: false };
        b.orig = sectionOf({ ...b, lines: ls.slice() });
        push(b, lines.slice(i, j + 1));
        i = j + 1;
      } else {
        // locked as a whole: to its end directive, or up to the next start, or to the end of the song
        const to = j >= lines.length ? lines.length : info[j].name.startsWith('end_of_') ? j + 1 : j;
        locked(i, to);
        i = to;
      }
      continue;
    }
    if (r.name === 'chorus') {
      const b = { type: 'repeat', label: r.value || null };
      b.orig = { label: b.label };
      push(b, [lines[i]]);
    } else if (r.name === 'meta' || METADATA_DIRECTIVES.has(r.name)) {
      const name = r.name === 'meta' ? r.meta : r.name;
      const b = { type: 'meta', name, value: r.value };
      b.orig = { name, value: r.value };
      push(b, [lines[i]]);
    } else {
      locked(i, i + 1);                                   // comments, layout, unknown directives, a stray end
    }
    i += 1;
  }
  return { blocks };
}

function sectionLines(b) {
  // a locked line can only be one the section had when it was read: kept or left out, never made up
  const available = (b.orig ? b.orig.lines : []).filter((x) => typeof x !== 'string').map((x) => x.locked);
  const lines = b.lines.map((line, n) => {
    if (typeof line !== 'string') {
      const k = line && typeof line.locked === 'string' ? available.indexOf(line.locked) : -1;
      if (k < 0) throw new Error(`fromBlocks: line ${n + 1} of a ${b.kind}: a locked line that was not in the song`);
      available.splice(k, 1);
      return line.locked;                                 // GD-19: as it was
    }
    const p = lyricLineProblem(line);
    if (p) throw new Error(`fromBlocks: line ${n + 1} of a ${b.kind}: ${p}`);
    return trimEnd(line);
  });
  if (b.label !== null && b.label !== undefined && valueProblem(b.label)) throw new Error(`fromBlocks: label: ${valueProblem(b.label)}`);
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  // 7.3: an implicit verse stays implicit only as it was: a verse without label, blank or locked lines
  if (b.implicit && b.kind === 'verse' && !b.label && lines.length && b.lines.every((x) => typeof x === 'string' && x.trim() !== '')) return lines;
  return [`{start_of_${b.kind}${b.label ? `: ${b.label}` : ''}}`, ...lines, `{end_of_${b.kind}}`];
}

function metaLine(b) {
  const p = valueProblem(b.value) || (/^[a-z][a-z0-9-]*$/.test(b.name) ? null : 'name');
  if (p) throw new Error(`fromBlocks: ${b.name}: ${p}`);
  return METADATA_DIRECTIVES.has(b.name) ? `{${b.name}: ${b.value}}` : `{meta: ${b.name} ${b.value}}`;
}

function written(b) {
  const unchanged = b.raw && b.orig && (b.type === 'section' ? same(sectionOf(b), b.orig)
    : b.type === 'repeat' ? same({ label: b.label }, b.orig)
      : b.type === 'meta' ? same({ name: b.name, value: b.value }, b.orig)
        : b.type === 'locked');
  if (unchanged) return b.raw;
  if (b.type === 'section') return SECTION_KINDS.has(b.kind) ? sectionLines(b) : [];
  if (b.type === 'repeat') {
    if (b.label && valueProblem(b.label)) throw new Error(`fromBlocks: repeat label: ${valueProblem(b.label)}`);
    return [b.label ? `{chorus: ${b.label}}` : '{chorus}'];
  }
  if (b.type === 'meta') return [metaLine(b)];
  if (b.type === 'locked') {
    if (!b.raw) throw new Error('fromBlocks: a locked block can only come from the text');
    return b.raw;                                          // GD-19: never rewritten
  }
  throw new Error(`fromBlocks: unknown block type: ${b.type}`);
}

/**
 * The text of a song in block form, canonical (song format 8.1; FDS EDT-57). A block without blank
 * gets one blank line before it, a metadata line none. Throws on a line or value that would change
 * meaning in ChordPro (lyricLineProblem, valueProblem): the editor checks them while typing.
 */
export function fromBlocks({ blocks }) {
  const out = [];
  for (const b of blocks) {
    const lines = written(b);
    if (!lines.length) continue;
    let blank = b.blank ?? (b.type === 'meta' || !out.length ? 0 : 1);
    // 7.3: lyric lines straight after lyric lines would join one implicit verse; a moved block keeps apart
    // (text read by toBlocks never has this: its runs of lyric lines are one block)
    if (blank === 0 && out.length && readLine(out[out.length - 1]).type === 'content' && readLine(lines[0]).type === 'content') blank = 1;
    for (let k = 0; k < blank; k++) out.push('');
    out.push(...lines);
  }
  while (out.length && out[out.length - 1] === '') out.pop();   // canonical text has no blank lines at its end
  return `${out.map(trimEnd).join('\n')}\n`.normalize('NFC');
}
