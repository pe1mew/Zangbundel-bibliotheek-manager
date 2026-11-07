// SPDX-License-Identifier: Apache-2.0
// Unit tests of webapp/src/core/convert.js through openLibrary: a ZIP without manifest.json opened as a
// new library (FDS EDT-21), from a repository snapshot or release archive (EDT-26) or from plain
// folders of song files (EDT-25), with song IDs as EDT-36 proposes. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLibrary, saveLibrary } from '../../src/core/library.js';
import { proposeSongId, withSongId } from '../../src/core/convert.js';
import { readCentralDirectory, readEntry, writeZip } from '../../src/core/zip.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name) => new Uint8Array(readFileSync(join(HERE, '..', '..', '..', 'test-libraries', `${name}.zbl`)));
const NOW = new Date('2026-11-07T12:00:00Z');
const enc = new TextEncoder();
const dec = new TextDecoder();
const errors = (findings) => findings.filter((f) => f.severity === 'Error' || f.severity === 'Fatal');

/** The four test songs of the reference library, as { id: text }. */
function referenceSongs() {
  const z = corpus('valid-unsigned');
  const out = {};
  for (const e of readCentralDirectory(z)) {
    const m = /\/songs\/([^/]+)\/\1\.cho$/.exec(e.name);
    if (m) out[m[1]] = dec.decode(readEntry(z, e));
  }
  return out;
}

const zip = (files) => writeZip(Object.entries(files).map(([name, data]) => ({ name, data: typeof data === 'string' ? enc.encode(data) : data })), NOW);

test('EDT-36: song IDs proposed from a title', () => {
  assert.equal(proposeSongId('Zeg ken jij de mosselman?'), 'zeg-ken-jij-de-mosselman');
  assert.equal(proposeSongId('Frère Jacques'), 'frere-jacques');
  assert.equal(proposeSongId('  --  '), 'lied');
  assert.ok(proposeSongId('woord '.repeat(30)).length <= 64);
  assert.equal(withSongId('{title: A}\nla\n', 'a'), '{title: A}\n{meta: id a}\nla\n');
  assert.equal(withSongId('{title: A}\n{meta: id Old ID}\nla\n', 'a'), '{title: A}\n{meta: id a}\nla\n');
});

test('EDT-26: a repository snapshot (the test library without manifest) becomes a new library', async () => {
  const { library, converted, findings } = await openLibrary(corpus('manifest-missing'), { now: NOW });
  assert.equal(converted.kind, 'snapshot');
  assert.deepEqual([converted.songs, converted.sets], [4, 2]);
  assert.deepEqual(library.sets.map((s) => s.name), ['Kampvuur', 'Demo']);
  assert.equal(library.license.id, 'CC0-1.0');
  assert.ok(library.license.text);                             // the licence file becomes license.text
  assert.deepEqual(errors(findings), []);
  const view = JSON.parse(dec.decode(readEntry(corpus('manifest-missing'),
    readCentralDirectory(corpus('manifest-missing')).find((e) => e.name.endsWith('/zangbundel.json')))));
  assert.notEqual(library.libraryId, view.id);                 // EDT-21: a new libraryId
  const saved = await saveLibrary(library, { now: NOW });
  assert.equal(saved.refused, false, JSON.stringify(errors(saved.findings)));
  assert.equal(saved.version, 1);
});

test('EDT-26: a release archive keeps its song IDs; setlist entries of other libraries are reported', async () => {
  const songs = referenceSongs();
  const meta = { format: 'zangbundel-library', format_version: '1.1', id: 'voorbeeld', name: 'Voorbeeld', description: 'Een voorbeeld.',
    maintainer: { name: 'Leiding', email: 'leiding@example.org' }, license: { id: 'CC0-1.0', file: 'LICENSE', summary: 'Vrij te gebruiken.' },
    min_app_version: '0.1.0' };
  const files = {
    'voorbeeld-2026.10.0/zangbundel-archive.json': JSON.stringify({ format: 'zangbundel-archive', archive_version: '1.0', library: 'voorbeeld' }),
    'voorbeeld-2026.10.0/zangbundel.json': JSON.stringify(meta),
    'voorbeeld-2026.10.0/LICENSE': 'Vrij te gebruiken.\n',
    'voorbeeld-2026.10.0/README.md': 'Lees mij.\n',
    'voorbeeld-2026.10.0/setlists/kamp.zbs': '{title: Kamp}\n{meta: id kamp}\n\nvoorbeeld/vader-jacob   # Vader Jacob\nanders/iets\n? Onbekend lied\nvoorbeeld/lorem-ipsum\n',
  };
  for (const [id, text] of Object.entries(songs)) files[`voorbeeld-2026.10.0/songs/${id === 'fire-in-the-night' ? 'en' : 'nl'}/${id}.cho`] = text;
  const { library, converted, findings } = await openLibrary(zip(files), { now: NOW });
  assert.equal(converted.kind, 'release-archive');
  assert.deepEqual([...library.songs.keys()].sort(), Object.keys(songs).sort());
  assert.deepEqual(library.sets, [{ name: 'Kamp', songs: ['vader-jacob', 'lorem-ipsum'] }]);
  assert.deepEqual(converted.unresolved.map((u) => u.entry), ['anders/iets', 'Onbekend lied']);
  assert.deepEqual(converted.leftOut, ['README.md']);           // M-42
  assert.equal(library.title, 'Voorbeeld');
  assert.equal(library.description, 'Een voorbeeld.');
  assert.deepEqual(errors(findings), []);
});

test('EDT-25: folders of song files; set folders, a song stored once in two sets, IDs proposed and made unique', async () => {
  const songs = referenceSongs();
  const noId = (text) => text.split('\n').filter((l) => !/^\{meta: id /.test(l)).join('\n');
  const files = {
    'Kampvuur/vader-jacob/vader.cho': noId(songs['vader-jacob']),
    'Kampvuur/vuur/vuur.cho': songs['vuur-in-de-nacht'],
    'Avond/vuur/vuur.cho': songs['vuur-in-de-nacht'],              // identical text: stored once (EDT-25)
    'Avond/zz-lorem/lorem.cho': songs['lorem-ipsum'],
    'losse-lied.cho': songs['fire-in-the-night'].replace('{meta: id fire-in-the-night}', '{meta: id Bad ID}'),
    'tweede/lied.cho': songs['fire-in-the-night'].replace('{meta: id fire-in-the-night}', '{meta: id Bad ID}').replace('[', '[C]['),
    'notities.txt': 'akkoorden nakijken\n',
  };
  const { library, converted, findings } = await openLibrary(zip(files), { now: NOW, title: 'Mijn bundel' });
  assert.equal(converted.kind, 'files');
  assert.equal(library.title, 'Mijn bundel');
  assert.deepEqual(converted.leftOut, ['notities.txt']);
  assert.deepEqual([...library.songs.keys()].sort(), ['fire-in-the-night', 'fire-in-the-night-2', 'lorem-ipsum', 'vader-jacob', 'vuur-in-de-nacht']);
  assert.deepEqual(library.sets, [
    { name: 'Avond', songs: ['vuur-in-de-nacht', 'lorem-ipsum'] },        // alphabetical song folders: vuur, zz-lorem
    { name: 'Kampvuur', songs: ['vader-jacob', 'vuur-in-de-nacht'] },
  ]);
  assert.match(library.songs.get('vader-jacob'), /^\{meta: id vader-jacob\}$/m);   // written into the song (EDT-36)
  assert.match(library.songs.get('fire-in-the-night'), /^\{meta: id fire-in-the-night\}$/m);
  assert.deepEqual(errors(findings).map((f) => f.code).sort(), ['MAN-07', 'MAN-08']);   // the user chooses them (EDT-13, EDT-14)
  library.license = { id: 'CC0-1.0', summary: 'Vrij te gebruiken.' };
  library.maintainer = { name: 'Leiding', email: 'leiding@example.org' };
  const saved = await saveLibrary(library, { now: NOW });
  assert.equal(saved.refused, false, JSON.stringify(errors(saved.findings)));
});

test('EDT-25: a song file that is not UTF-8 is taken over as found, so saving names SNG-01', async () => {
  const songs = referenceSongs();
  const bad = Uint8Array.from([...enc.encode(songs['lorem-ipsum']), 0xe8, 0x0a]);
  const { library } = await openLibrary(zip({ 'lib/a/a.cho': songs['vader-jacob'], 'lib/b/b.cho': bad }), { now: NOW });
  library.license = { id: 'CC0-1.0', summary: 'Vrij.' };
  library.maintainer = { name: 'L', email: 'l@example.org' };
  const saved = await saveLibrary(library, { now: NOW });
  assert.equal(saved.refused, true);
  assert.deepEqual(errors(saved.findings).map((f) => f.code), ['SNG-01']);
});
