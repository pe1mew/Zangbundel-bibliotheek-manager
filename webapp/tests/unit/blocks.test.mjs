// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/core/blocks.js, the block form of a song (implementationPlan M2.3;
// webappGUI GD-06, GD-18, GD-19, GD-38; FDS EDT-57): text to blocks and back without loss, locked
// blocks byte-exact, and edits written canonically. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromBlocks, lyricLineProblem, toBlocks } from '../../src/core/blocks.js';
import { metaValues, setMeta, valueProblem } from '../../src/core/blockmeta.js';
import { canonicalize, parseSong, songView } from '../../src/core/chordpro.js';
import { openLibrary } from '../../src/core/library.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIBS = join(HERE, '..', '..', '..', 'test-libraries');
const canonical = (text) => canonicalize(new TextEncoder().encode(text)).text;

const SONG = [
  '{title: Vader Jacob}',
  '{meta: id vader-jacob}',
  '{meta: language nl}',
  '{meta: tag canon}',
  '',
  '# een notitie voor de beheerder',
  'Vader Jacob, Vader Jacob,',
  'slaapt gij nog?',
  '',
  '{sov}',
  '[G]Alle klokken luiden,',
  '',
  '[D]bim bam bom',
  '{eov}',
  '',
  '{start_of_chorus:Refrein}',
  'la la',
  '{c: zachter}',
  'li li',
  '{end_of_chorus}',
  '{chorus}',
  '{sot}',
  'e|--0--|',
  '{eot}',
  '',
].join('\n');

test('M2.3: a song as blocks: metadata, implicit verse, sections, a chorus with a remark inside, repeat, locked tab', () => {
  const { blocks } = toBlocks(SONG);
  assert.deepEqual(blocks.map((b) => [b.type, b.kind || b.name || '', b.label ?? '', b.blank]), [
    ['meta', 'title', '', 0], ['meta', 'id', '', 0], ['meta', 'language', '', 0], ['meta', 'tag', '', 0],
    ['locked', '', '', 1],                                 // the # note
    ['section', 'verse', '', 0],                           // implicit, straight after the note
    ['section', 'verse', '', 1],
    ['section', 'chorus', 'Refrein', 1],                   // editable, with its remark locked in place
    ['repeat', '', '', 0],
    ['locked', '', '', 0]]);
  assert.deepEqual(blocks[5].lines, ['Vader Jacob, Vader Jacob,', 'slaapt gij nog?']);
  assert.equal(blocks[5].implicit, true);
  assert.deepEqual(blocks[6].lines, ['[G]Alle klokken luiden,', '', '[D]bim bam bom']);
  assert.deepEqual(blocks[7].lines, ['la la', { locked: '{c: zachter}' }, 'li li']);
  assert.deepEqual(blocks[9].lines, ['{sot}', 'e|--0--|', '{eot}']);
  assert.equal(fromBlocks({ blocks }), SONG);
});

test('GD-19 (the owner, 2026-11-07): a section stays editable around a remark, which keeps its place and its bytes', () => {
  const form = toBlocks(SONG);
  const chorus = form.blocks[7];
  chorus.lines = ['la la la', chorus.lines[1], 'li li', 'lo lo'];
  const out = fromBlocks(form);
  assert.ok(out.includes('{start_of_chorus: Refrein}\nla la la\n{c: zachter}\nli li\nlo lo\n{end_of_chorus}'));
  assert.equal(out, canonical(out));
  const view = songView(out).find((s) => s.kind === 'chorus' && !s.repeat);
  assert.deepEqual(view.lines.map((l) => (l.remark ?? l.segments.map((x) => x.text).join(''))), ['la la la', 'zachter', 'li li', 'lo lo']);
  chorus.lines = ['la la', 'li li'];                       // the remark may be left out
  assert.ok(fromBlocks(form).includes('{start_of_chorus: Refrein}\nla la\nli li\n{end_of_chorus}'));
  chorus.lines = ['la la', { locked: '{end_of_chorus}' }, 'li li'];   // but never made up
  assert.throws(() => fromBlocks(form), /a locked line that was not in the song/);
  chorus.lines = ['la la', { locked: '{c: zachter}' }, { locked: '{c: zachter}' }];   // nor doubled
  assert.throws(() => fromBlocks(form), /a locked line that was not in the song/);
  const notes = toBlocks('{sov}\nla\n# noot\n{x_onbekend: 1}\n{oops\nli\n{eov}\n');
  assert.deepEqual(notes.blocks[0].lines, ['la', { locked: '# noot' }, { locked: '{x_onbekend: 1}' }, { locked: '{oops' }, 'li']);
  const broken = toBlocks('{sov}\nla\n{soc}\nli\n{eoc}\n');   // a verse not closed by its own end stays locked
  assert.deepEqual(broken.blocks.map((b) => b.type), ['locked', 'section']);
});

test('GD-38, EDT-57: every song of the test libraries comes back byte for byte, also after crossing to another thread', async () => {
  let songs = 0;
  for (const name of readdirSync(LIBS).filter((n) => n.endsWith('.zbl')).sort()) {
    const r = await openLibrary(new Uint8Array(readFileSync(join(LIBS, name))));
    if (!r.library) continue;
    for (const [id, text] of r.library.songs) {
      if (text === null) continue;
      const form = structuredClone(toBlocks(text));        // as it travels between the worker and the page
      assert.equal(fromBlocks(form), text, `${name}: ${id}`);
      songs += 1;
    }
  }
  assert.ok(songs >= 400, `only ${songs} songs`);
});

test('GD-19: an edited section is written canonically; every other block, the locked ones above all, stays byte-exact', () => {
  const form = toBlocks(SONG);
  form.blocks[6].lines = ['[G]Alle klokken luiden,   ', '[D]bim bam bom', '[A7]bom'];
  const out = fromBlocks(form);
  assert.equal(out, SONG.replace('{sov}\n[G]Alle klokken luiden,\n\n[D]bim bam bom\n{eov}',
    '{start_of_verse}\n[G]Alle klokken luiden,\n[D]bim bam bom\n[A7]bom\n{end_of_verse}'));
  assert.equal(out, canonical(out));
  for (const b of form.blocks.filter((x) => x.type === 'locked')) assert.ok(out.includes(b.lines.join('\n')));
  const p = parseSong(out).problems;
  assert.ok(!p.malformed && !p.envError && !p.chorusEarly);
  form.blocks[6].lines = ['[G]Alle klokken luiden,', '', '[D]bim bam bom'];    // edited back: the original again
  assert.equal(fromBlocks(form), SONG);
});

test('GD-06: kinds and labels change; an implicit verse stays implicit only without label or blank line', () => {
  const form = toBlocks('{title: X}\n\nla\nli\n');
  const verse = form.blocks[1];
  assert.equal(fromBlocks({ blocks: [form.blocks[0], { ...verse, lines: ['la', 'lo'] }] }), '{title: X}\n\nla\nlo\n');
  assert.equal(fromBlocks({ blocks: [form.blocks[0], { ...verse, lines: ['la', '', 'lo'] }] }), '{title: X}\n\n{start_of_verse}\nla\n\nlo\n{end_of_verse}\n');
  assert.equal(fromBlocks({ blocks: [form.blocks[0], { ...verse, label: 'Couplet 1' }] }), '{title: X}\n\n{start_of_verse: Couplet 1}\nla\nli\n{end_of_verse}\n');
  assert.equal(fromBlocks({ blocks: [form.blocks[0], { ...verse, kind: 'chorus' }] }), '{title: X}\n\n{start_of_chorus}\nla\nli\n{end_of_chorus}\n');
  const v = songView(fromBlocks({ blocks: [form.blocks[0], { ...verse, kind: 'chorus' }, { type: 'repeat', label: 'Refrein (2x)' }] }));
  assert.deepEqual(v.map((s) => [s.kind, s.repeat, s.label]), [['chorus', false, null], ['chorus', true, 'Refrein (2x)']]);
});

test('GD-06, GD-08: new blocks get one blank line before them; reordered blocks keep their own spelling', () => {
  const form = toBlocks('{title: X}\n\n{sov}\nEen\n{eov}\n\n{soc: Refrein}\nTwee\n{eoc}\n');
  const [title, verse, chorus] = form.blocks;
  const added = { type: 'section', kind: 'bridge', label: null, lines: ['Drie'], implicit: false };
  assert.equal(fromBlocks({ blocks: [title, chorus, verse, added] }),
    '{title: X}\n\n{soc: Refrein}\nTwee\n{eoc}\n\n{sov}\nEen\n{eov}\n\n{start_of_bridge}\nDrie\n{end_of_bridge}\n');
  assert.equal(fromBlocks({ blocks: [title, chorus] }), '{title: X}\n\n{soc: Refrein}\nTwee\n{eoc}\n');   // a deleted block leaves no trace
});

test('GD-07: a typed line must stay a lyric line; a label or value must fit in a directive', () => {
  assert.equal(lyricLineProblem('[G]Vader Jacob \\{zacht\\}'), null);
  assert.equal(lyricLineProblem('  ingesprongen'), null);
  assert.equal(lyricLineProblem('{c: gesproken}'), 'is a directive');
  assert.equal(lyricLineProblem('{open'), 'is a directive');
  assert.equal(lyricLineProblem('#hashtag'), 'starts with #');
  assert.equal(lyricLineProblem(' #ingesprongen'), null);   // 5.2 (v0.25): only # in the first column is a comment
  assert.equal(lyricLineProblem('la\u0007'), 'control character');
  assert.equal(lyricLineProblem('a'.repeat(1001)), 'too long');
  assert.equal(valueProblem('Refrein (2x)'), null);
  assert.equal(valueProblem('a } b'), 'brace');
  assert.equal(valueProblem(' a'), 'spaces at an end');
  const form = toBlocks('{title: X}\n\nla\n');
  form.blocks[1].lines = ['la', '{c: nee}'];
  assert.throws(() => fromBlocks(form), /line 2 of a verse: is a directive/);
  form.blocks[1].lines = ['la'];
  form.blocks[1].label = 'a{b';
  assert.throws(() => fromBlocks(form), /label: brace/);
  assert.throws(() => fromBlocks({ blocks: [{ type: 'locked', lines: ['{c: x}'] }] }), /only come from the text/);
});

test('EDT-34, GD-05: metadata fields are read and set in place; a new field joins the song\'s head', () => {
  let form = toBlocks(SONG);
  assert.deepEqual(metaValues(form, 'tag'), ['canon']);
  form = setMeta(form, 'title', ['Vader Jacob (canon)']);
  form = setMeta(form, 'tag', ['canon', 'welpen']);
  form = setMeta(form, 'lyricist', ['traditioneel']);
  form = setMeta(form, 'language', []);
  const out = fromBlocks(form);
  assert.ok(out.startsWith('{title: Vader Jacob (canon)}\n{meta: id vader-jacob}\n{meta: tag canon}\n{meta: tag welpen}\n{lyricist: traditioneel}\n\n# een notitie'));
  assert.ok(!out.includes('{meta: language'));
  assert.equal(out.slice(out.indexOf('# een notitie')), SONG.slice(SONG.indexOf('# een notitie')));   // the rest untouched
  assert.deepEqual(parseSong(out).meta.get('tag'), ['canon', 'welpen']);
  assert.throws(() => fromBlocks(setMeta(form, 'source', ['a } b'])), /source: brace/);
  const bare = setMeta(toBlocks('Alleen tekst\n'), 'title', ['Nieuw']);
  assert.equal(fromBlocks(bare), '{title: Nieuw}\nAlleen tekst\n');
});

test('SR-35: random songs from awkward lines come back byte for byte, and a block edit never breaks the rest', () => {
  const PIECES = ['', '', 'la', '  la', '[G]la [D]li', '{sov}', '{eov}', '{soc: R}', '{eoc}', '{sob}', '{eob}', '{chorus}', '{chorus: R}',
    '{c: zacht}', '# notitie', '{sot}', '{eot}', '{start_of_x}', '{end_of_x}', '{title: T}', '{meta: tag a}', '{meta: weird x}',
    '{open', 'close}', '\{la\}', '{new_page}', '{start_of_verse: a}', '{end_of_chorus}', 'é ', '[', ']'];
  let seed = 12345;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let k = 0; k < 3000; k++) {
    const lines = Array.from({ length: 1 + rnd(25) }, () => PIECES[rnd(PIECES.length)]);
    const text = canonical(lines.join('\n'));
    const form = toBlocks(text);
    assert.equal(fromBlocks(form), text, JSON.stringify(text));
    const section = form.blocks.find((b) => b.type === 'section');
    if (section) {
      section.lines = [...section.lines.filter((x) => typeof x !== 'string' || !lyricLineProblem(x)), 'nieuw'];
      const out = fromBlocks(form);
      assert.equal(out, canonical(out));
      for (const b of form.blocks.filter((x) => x.type === 'locked')) assert.ok(out.includes(b.lines.join('\n')), JSON.stringify(text));
      for (const l of section.lines.filter((x) => typeof x !== 'string')) assert.ok(out.split('\n').includes(l.locked), JSON.stringify(text));
    }
  }
});

test('the worker turns a song into blocks and back, and answers a block it cannot write with its problem', async () => {
  const { handleMessage } = await import('../../src/workers/library-handler.js');
  const form = (await handleMessage({ id: 1, op: 'blocks', payload: { text: SONG } })).result;
  assert.equal((await handleMessage({ id: 2, op: 'unblocks', payload: { form } })).result.text, SONG);
  form.blocks[6].lines = ['{c: geen tekst}'];
  assert.match((await handleMessage({ id: 3, op: 'unblocks', payload: { form } })).result.problem, /is a directive/);
});

test('GD-33, 7.3: two implicit verses moved next to each other stay two verses', () => {
  const form = toBlocks('{title: X}\n# noot\nEen\n\nTwee\n');
  const [title, note, one, two] = form.blocks;
  assert.equal(one.blank, 0);                               // straight after the note
  const out = fromBlocks({ blocks: [title, note, two, one] });
  assert.equal(out, '{title: X}\n# noot\n\nTwee\n\nEen\n');
  assert.deepEqual(songView(out).map((s) => s.number), [1, 2]);
});
