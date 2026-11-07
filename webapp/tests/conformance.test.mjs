// SPDX-License-Identifier: Apache-2.0
// Conformance runner over the shared test libraries (FDS O-04; securityAssessment SC-04; plan M1.3).
// Run: node --test webapp/tests/
//
// Now (M1.3): the corpus itself is checked. Every <case>.zbl exists, has the SHA-256 its
// <case>.expected.json records, and every expected.json names its Editor findings with code,
// severity and place. Until the library engine exists (M2), each case's Editor check is a
// to-do: node --test reports it as such, never as a pass.
//
// From M2: webapp/src/core/validate.js exports validateLibrary(bytes) (async), returning
// { findings: [{ code, severity, where? }] }, and IMPLEMENTED, the rule families it applies so far.
// For those families each case must give exactly the findings of its expected.json "editor"
// section: the same (code, severity) pairs as a multiset, order not counted, and the same `where`
// wherever the expected finding gives one (as check_test_libraries.py compares). A Fatal finding
// stops everything else, so a case that expects one is compared in full. Families not yet
// implemented stay a to-do per case (SC-04 passes only when none is left).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, '..', '..', 'test-libraries');
const ENGINE = join(HERE, '..', 'src', 'core', 'validate.js');
const SEVERITIES = new Set(['Fatal', 'Error', 'Warning', 'Info']);

const cases = readdirSync(CORPUS).filter((f) => f.endsWith('.expected.json')).map((f) => f.slice(0, -'.expected.json'.length)).sort();
const engine = existsSync(ENGINE) ? await import(pathToFileURL(ENGINE).href) : null;

test('the corpus has its 58 cases', () => {
  assert.equal(cases.length, 58);
});

const family = (code) => code.split('-')[0];

/** Match expected against got: equal (code, severity) multisets, and `where` where expected has one. */
function sameFindings(expected, got) {
  const left = [...got];
  for (const e of expected) {
    const i = left.findIndex((g) => g.code === e.code && g.severity === e.severity && (e.where === undefined || g.where === e.where));
    if (i < 0) {
      return `missing ${e.code} ${e.severity}${e.where ? ` at ${e.where}` : ''}`;
    }
    left.splice(i, 1);
  }
  return left.length ? `unexpected ${left.map((g) => `${g.code} ${g.severity}${g.where ? ` at ${g.where}` : ''}`).join('; ')}` : null;
}

for (const name of cases) {
  const expected = JSON.parse(readFileSync(join(CORPUS, `${name}.expected.json`), 'utf8'));
  const zbl = join(CORPUS, `${name}.zbl`);

  test(`${name}: library file present, SHA-256 as recorded`, () => {
    assert.ok(existsSync(zbl), `${name}.zbl missing`);
    const sha = createHash('sha256').update(readFileSync(zbl)).digest('hex');
    assert.equal(sha, expected.sha256);
  });

  test(`${name}: expected findings are well formed`, () => {
    assert.ok(expected.app && typeof expected.app.verdict === 'string', 'app.verdict');
    assert.ok(Array.isArray(expected.editor?.codes), 'editor.codes');
    for (const f of expected.editor.codes) {
      assert.match(f.code, /^[A-Z]{3,4}-\d{2}$/, `code ${f.code}`);
      assert.ok(SEVERITIES.has(f.severity), `severity ${f.severity}`);
    }
  });

  if (engine === null) {
    test(`${name}: Editor findings (SC-04)`, { todo: 'library engine not written yet (implementationPlan M2)' }, () => {});
  } else {
    const done = new Set(engine.IMPLEMENTED);
    const fatal = expected.editor.codes.some((f) => f.severity === 'Fatal');
    const want = fatal ? expected.editor.codes : expected.editor.codes.filter((f) => done.has(family(f.code)));
    const rest = fatal ? [] : [...new Set(expected.editor.codes.map((f) => family(f.code)).filter((x) => !done.has(x)))];
    test(`${name}: Editor findings, ${fatal ? 'all (Fatal)' : [...done].join(', ')} (SC-04)`, async () => {
      const result = await engine.validateLibrary(new Uint8Array(readFileSync(zbl)));
      const got = fatal ? result.findings : result.findings.filter((f) => done.has(family(f.code)));
      const diff = sameFindings(want, got);
      assert.equal(diff, null, diff ?? '');
    });
    if (rest.length) {
      test(`${name}: Editor findings, ${rest.join(', ')} (SC-04)`, { todo: 'rule families not implemented yet (implementationPlan M2.3 to M2.5)' }, () => {});
    }
  }
}
