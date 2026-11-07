// SPDX-License-Identifier: Apache-2.0
// Unit tests of *Controle* (webapp/src/app/check.js, messages.js) and of the details validate.js now
// gives its findings (FDS EDT-40, EDT-41, section 9; webappGUI GD-20, GD-29; implementationPlan M4.5).
// Every finding of every shared test library is rendered in every language.
// Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

class FakeNode {
  constructor(tag, ns) { Object.assign(this, { tag, ns, attrs: {}, children: [], listeners: {} }); }
  setAttribute(n, v) { this.attrs[n] = v; }
  append(...c) { this.children.push(...c); }
  addEventListener(t, f) { this.listeners[t] = f; }
}
globalThis.document = { createElement: (t) => new FakeNode(t), createElementNS: (ns, t) => new FakeNode(t, ns), createTextNode: (s) => ({ text: s }) };

const { checkContent, counts, locationOf, messageFor, severityGroup } = await import('../../src/app/check.js');
const { MESSAGES, RULE_MESSAGE } = await import('../../src/app/messages.js');
const { LANGUAGES } = await import('../../src/app/i18n.js');
const { validateLibrary } = await import('../../src/core/validate.js');

const HERE = dirname(fileURLToPath(import.meta.url));
const LIBS = join(HERE, '..', '..', '..', 'test-libraries');
const all = readdirSync(LIBS).filter((f) => f.endsWith('.zbl')).sort();
const findingsOf = async (name) => (await validateLibrary(new Uint8Array(readFileSync(join(LIBS, name))))).findings;
const FDS = readFileSync(join(HERE, '..', '..', '..', 'design', 'FDS.md'), 'utf-8');

test('every rule of FDS section 6 has a message in every language; the English is the FDS text', () => {
  const rules = [...FDS.slice(FDS.indexOf('## 6. Validation rules'), FDS.indexOf('## 7. Editor')).matchAll(/^\| ((?:PKG|STR|MAN|SIG|SNG|SET|VIEW)-\d\d) \|(.*)$/gm)]
    .filter((m) => /M-\d\d/.test(m[2])).map((m) => m[1]);
  assert.deepEqual(Object.keys(RULE_MESSAGE).sort(), rules.sort());
  for (const [rule, id] of Object.entries(RULE_MESSAGE)) {
    for (const lang of LANGUAGES) assert.ok(MESSAGES[lang][id], `${lang} ${id} (${rule})`);
    const fds = new RegExp(`\\| ${id} \\| (.*?) \\|`).exec(FDS.slice(FDS.indexOf('## 9. Messages')))[1].replace(/`/g, '');   // section 9, not a rule table
    assert.equal(MESSAGES.en[id], fds, id);
  }
});

test('EDT-40: every finding of all 58 test libraries reads as a full message in nl, en and de', async () => {
  let n = 0;
  for (const name of all) {
    for (const f of await findingsOf(name)) {
      for (const lang of LANGUAGES) {
        const m = messageFor(lang, f);
        assert.doesNotMatch(m, /\{\w+\}/, `${name} ${f.code} ${lang}: ${m}`);
        assert.doesNotMatch(m, /…/, `${name} ${f.code} ${lang}: a detail is missing: ${m}`);
        assert.ok(locationOf(lang, f), `${name} ${f.code}`);
      }
      n += 1;
    }
  }
  assert.ok(n > 150, `${n} findings`);
});

test('EDT-40: song findings name the song and the line of the problem', async () => {
  const one = async (name, code) => (await findingsOf(name)).find((f) => f.code === code);
  const chord = await one('song-chord-unknown.zbl', 'SNG-08');
  assert.equal(messageFor('en', chord), 'Line 42 of "Lorem Ipsum!": "H" does not look like a chord.');
  assert.equal(messageFor('nl', chord), 'Regel 42 van "Lorem Ipsum!": "H" lijkt geen akkoord.');
  assert.equal(locationOf('nl', chord), 'Lorem Ipsum! · 42');
  assert.equal(messageFor('en', await one('song-directive-twice.zbl', 'SNG-03')), 'Line 29 of "Lorem Ipsum!": "key" appears more than once. Keep one.');
  assert.equal(messageFor('de', await one('song-chorus-early.zbl', 'SNG-13')), 'Zeile 41 von „Lorem Ipsum!": der Refrain wird wiederholt, bevor er geschrieben ist.');
  assert.equal(messageFor('en', await one('set-song-unknown.zbl', 'SET-01')), 'The set "Demo" contains "testlied", which is not a song of this library.');
  assert.match(messageFor('nl', await one('valid-unsigned.zbl', 'SNG-16')), /^Het lied "Vader Jacob" heeft geen tekst- of muziekschrijver\./);
});

test('GD-29: Error and Fatal count as errors; the panel groups by severity with counts; a click goes there (EDT-41)', () => {
  assert.equal(severityGroup('Fatal'), 'error');
  const findings = [
    { code: 'MAN-07', severity: 'Error' }, { code: 'PKG-04', severity: 'Fatal' },
    { code: 'SNG-16', severity: 'Warning', where: 'a', params: { song: 'A', field: 'fieldTag' } }, { code: 'SNG-07', severity: 'Info', where: 'a', params: { song: 'A', directive: 'x', line: 3 } },
  ];
  assert.deepEqual(counts(findings), { e: 2, w: 1 });
  const went = [];
  const groups = checkContent('nl', findings, (f) => went.push(f.code));
  assert.deepEqual(groups.map((g) => g.attrs['aria-label']), ['Fouten (2)', 'Waarschuwingen (1)', 'Info (1)']);
  const buttons = groups.flatMap((g) => g.children.filter((c) => c.tag === 'button'));
  buttons[2].listeners.click();
  assert.deepEqual(went, ['SNG-16']);
  assert.equal(checkContent('nl', [], () => {})[0].attrs.class, 'allclear');
  assert.equal(messageFor('nl', { code: 'SNG-17', severity: 'Warning', params: { song: 'A', what: ['title', 'size'] } }),
    '"A" is langer dan aangeraden: de titel is langer dan 60 tekens, het bestand is groter dan 8 KB. Het is misschien lastig te lezen op een telefoon.');
  assert.equal(messageFor('en', { code: 'SNG-04', severity: 'Error', where: 'a' }), 'Line … of "a": a { or } is missing.');   // a missing detail is "…"
});
