// SPDX-License-Identifier: Apache-2.0
// Unit tests of the song view (implementationPlan M5.2; webappGUI GD-05, GD-19; song format 5.4,
// 7.1 to 7.4): chordpro.js lineSegments and songView, the worker's songDetails, and songview.js drawn
// with a stand-in document. The view must show exactly the text the rules check: over every song of
// the test libraries, its lines are the canonical line list of parseSong (9.1).
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineSegments, parseSong, songView } from '../../src/core/chordpro.js';
import { openLibrary } from '../../src/core/library.js';
import { songDetails } from '../../src/workers/library-handler.js';

class FakeNode {
  constructor(tag, ns) { Object.assign(this, { tag, ns, attrs: {}, children: [], listeners: {} }); }
  setAttribute(n, v) { this.attrs[n] = v; }
  append(...c) { this.children.push(...c); }
  addEventListener(t, f) { this.listeners[t] = f; }
}
globalThis.document = { createElement: (t) => new FakeNode(t), createElementNS: (ns, t) => new FakeNode(t, ns), createTextNode: (s) => ({ text: s }) };
const { lyricsNode, sectionLabel, songDataNode, songViewNode } = await import('../../src/app/songview.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const LIBS = join(HERE, '..', '..', '..', 'test-libraries');
const shown = (segs) => segs.map((s) => s.text).join('');
const SONG = (body) => `{title: X}\n{meta: id x}\n{meta: language nl}\n${body}`;

test('5.4: segments: chords, annotations and escapes; the texts together are the display text', () => {
  assert.deepEqual(lineSegments('[G]Vader [D]Jacob'), [
    { chord: 'G', annotation: null, text: 'Vader ' }, { chord: 'D', annotation: null, text: 'Jacob' }]);
  assert.deepEqual(lineSegments('la [*zachter]la'), [
    { chord: null, annotation: null, text: 'la ' }, { chord: null, annotation: 'zachter', text: 'la' }]);
  assert.deepEqual(lineSegments('a \\[b\\] \\{c\\} \\\\ \\x'), [{ chord: null, annotation: null, text: 'a [b] {c} \\ \\x' }]);
  assert.deepEqual(lineSegments('open [G zonder eind'), [{ chord: null, annotation: null, text: 'open [G zonder eind' }]);
  assert.deepEqual(lineSegments('[G]'), [{ chord: 'G', annotation: null, text: '' }]);
  // 9.1: trailing spaces (a no-break space too) go across segments; the chords stay
  assert.deepEqual(lineSegments('la\t[G]   [D]  '), [
    { chord: null, annotation: null, text: 'la' }, { chord: 'G', annotation: null, text: '' }, { chord: 'D', annotation: null, text: '' }]);
  assert.equal(shown(lineSegments('la\t[G]   [D]  ')), parseSong(SONG('la\t[G]   [D]  \n')).lines[0]);
});

test('7.1, 7.3: environments with their labels; implicit verses split by blank lines and counted with the others', () => {
  const v = songView(SONG('Een\n\nTwee\n{sov}\nDrie\n\nnog drie\n\n{eov}\n{start_of_bridge: Tussenstuk}\nVier\n{eob}\n'));
  assert.deepEqual(v.map((s) => [s.kind, s.label, s.number, s.implicit]), [
    ['verse', null, 1, true], ['verse', null, 2, true], ['verse', null, 3, false], ['bridge', 'Tussenstuk', null, false]]);
  assert.deepEqual(v[2].lines.map((l) => (l.gap ? 'gap' : shown(l.segments))), ['Drie', 'gap', 'nog drie']);   // a gap inside, none at the end
});

test('7.2: {chorus} repeats the chorus with its text; a label picks the chorus that carried it; none before a chorus', () => {
  const v = songView(SONG('{chorus}\n{soc: A}\nla\n{eoc}\n{soc}\nli\n{eoc}\n{chorus}\n{chorus: A}\n{chorus: Refrein (2x)}\n'));
  assert.deepEqual(v.map((s) => [s.kind, s.label, s.repeat, s.lines.map((l) => shown(l.segments)).join('/')]), [
    ['chorus', 'A', false, 'la'], ['chorus', null, false, 'li'],
    ['chorus', null, true, 'li'], ['chorus', 'A', true, 'la'], ['chorus', 'Refrein (2x)', true, 'li']]);
});

test('7.4, 7.1: remarks show in place, inside a section too; file comments, tab and unknown blocks and other directives do not', () => {
  const v = songView(SONG('# beheerdersnotitie\n{c: gesproken}\n{sov}\nla\n{ci: zachter}\n{eov}\n{sot}\ne|--0--|\n{eot}\n{start_of_x}\nverborgen\n{end_of_x}\n{cb: einde}\n{new_page}\n'));
  assert.deepEqual(v, [
    { kind: 'remark', text: 'gesproken', style: 'plain' },
    { kind: 'verse', label: null, number: 1, implicit: false, repeat: false,
      lines: [{ segments: [{ chord: null, annotation: null, text: 'la' }] }, { remark: 'zachter', style: 'italic' }] },
    { kind: 'remark', text: 'einde', style: 'box' }]);
});

test('9.1: over every song of the test libraries, the view shows exactly the canonical line list', async () => {
  let songs = 0;
  for (const name of readdirSync(LIBS).filter((n) => n.endsWith('.zbl')).sort()) {
    const r = await openLibrary(new Uint8Array(readFileSync(join(LIBS, name))));
    if (!r.library) continue;
    for (const [id, text] of r.library.songs) {
      if (text === null) continue;
      const lines = songView(text).filter((s) => s.kind !== 'remark')
        .flatMap((s) => s.lines.filter((l) => l.segments).map((l) => shown(l.segments)).filter((x) => x !== ''));
      assert.deepEqual(lines, parseSong(text).lines, `${name}: ${id}`);
      songs += 1;
    }
  }
  assert.ok(songs >= 100, `only ${songs} songs`);
});

test('GD-05: the worker gives the song\'s sections and metadata; a song that is not text has neither', () => {
  const d = songDetails('{title: Vader Jacob}\n{meta: id vader-jacob}\n{meta: language nl}\n{lyricist: Iemand}\n{lyricist: Ander}\n{meta: tag canon}\n[G]Vader Jacob\n');
  assert.deepEqual(d.meta, { id: 'vader-jacob', title: 'Vader Jacob', subtitle: null, language: 'nl', lyricists: ['Iemand', 'Ander'],
    composers: [], copyright: null, license: null, source: null, tags: ['canon'] });
  assert.equal(d.sections.length, 1);
  assert.deepEqual(songDetails(null), { sections: null, meta: null });
});

function* walk(n) {
  yield n;
  for (const c of n.children || []) if (c && typeof c === 'object' && 'tag' in c) yield* walk(c);
}
const text = (n) => [...walk(n)].flatMap((x) => x.children).map((c) => (typeof c === 'string' ? c : c && c.text) || '').join('|');

test('7.1: labels the song does not carry are generated in the interface language', () => {
  assert.equal(sectionLabel('nl', { kind: 'verse', label: null, number: 2 }), 'Couplet 2');
  assert.equal(sectionLabel('en', { kind: 'chorus', label: null }), 'Chorus');
  assert.equal(sectionLabel('de', { kind: 'bridge', label: null }), 'Bridge');
  assert.equal(sectionLabel('en', { kind: 'verse', label: 'Couplet 1', number: 1 }), 'Couplet 1');   // as written
});

test('GD-13, GD-16, GD-19: the view: title, who wrote it, Verwijderen (not when read-only), Bewerken waits; chords highlighted', () => {
  const details = songDetails(SONG('{lyricist: Iemand}\n{soc}\n[G]la [*zacht]li\n{eoc}\n{chorus}\n'));
  const deleted = [];
  const node = songViewNode('nl', 'x', details, { readOnly: false, onDelete: (id, title) => deleted.push([id, title]) });
  assert.match(text(node), /\|X\|.*tekst: Iemand/);
  const chords = [...walk(node)].filter((n) => n.attrs.class === 'chord').map((n) => n.children[0].text);
  assert.deepEqual(chords, ['G', 'G']);                                   // the repeat shows the chorus again
  assert.equal([...walk(node)].filter((n) => n.attrs.class === 'annot').length, 2);
  const [del, edit] = [...walk(node)].filter((n) => n.tag === 'button');
  del.listeners.click();
  assert.deepEqual(deleted, [['x', 'X']]);
  assert.ok('disabled' in edit.attrs);
  const ro = songViewNode('nl', 'x', details, { readOnly: true, onDelete() { throw new Error('read-only'); } });
  assert.ok('disabled' in [...walk(ro)].find((n) => n.tag === 'button').attrs);
  const broken = songViewNode('nl', 'x', { sections: null, meta: null }, { readOnly: false, onDelete() {} });
  assert.match(text(broken), /geen geldige tekst/);
  assert.equal([...walk(lyricsNode('nl', details.sections))].filter((n) => n.tag === 'section').length, 2);
});

test('GD-05: the song\'s data in the left bar; an empty licence is the library\'s', () => {
  const node = songDataNode('nl', 'x', songDetails(SONG('{composer: Iemand}\n{meta: tag kampvuur}\nla\n')));
  const all = text(node);
  assert.match(all, /Muziek\|+Iemand/);
  assert.match(all, /Licentie\|+licentie van de bibliotheek/);
  assert.match(all, /Lied-ID\|+x/);
  assert.ok([...walk(node)].some((n) => n.attrs.class === 'chip' && n.children[0].text === 'kampvuur'));
});

test('GD-44 (F8): each field of the song data has an ⓘ that opens its explanation and closes it again', async () => {
  const { helpOpen, HELP } = await import('../../src/app/fieldhelp.js');
  const node = songDataNode('nl', 'x', songDetails(SONG('{composer: Iemand}\nla\n')));
  const buttons = [...walk(node)].filter((n) => n.attrs.class === 'helpbtn');
  assert.deepEqual(buttons.map((b) => b.attrs['aria-controls']), Object.keys(HELP).filter((k) => !k.startsWith('lib')).map((k) => `help-${k}`));
  assert.equal(buttons[0].attrs['aria-label'], 'Uitleg bij Titel');
  const panel = [...walk(node)].find((n) => n.attrs.id === 'help-license');
  const button = buttons.find((b) => b.attrs['aria-controls'] === 'help-license');
  assert.equal(panel.attrs.hidden, '');                              // closed until asked for
  button.listeners.click();
  assert.equal(button.attrs['aria-expanded'], 'true');
  assert.equal(panel.hidden, false);
  assert.ok(helpOpen('license'));
  assert.match(panel.children[0].text, /SPDX/);
  // a redrawn bar keeps it open; a second click closes it
  const again = songDataNode('nl', 'x', songDetails(SONG('la\n')));
  assert.ok(![...walk(again)].find((n) => n.attrs.id === 'help-license').attrs.hidden);
  button.listeners.click();
  assert.equal(panel.hidden, true);
  assert.ok(!helpOpen('license'));
});
