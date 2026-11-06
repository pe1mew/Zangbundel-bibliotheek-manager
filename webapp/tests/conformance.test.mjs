// SPDX-License-Identifier: Apache-2.0
// Conformance runner over the shared test libraries (FDS O-04; securityAssessment SC-04; plan M1.3).
// Run: node --test webapp/tests/
//
// Now (M1.3): the corpus itself is checked. Every <case>.zbl exists, has the SHA-256 its
// <case>.expected.json records, and every expected.json names its Editor findings with code,
// severity and place. Until the library engine exists (M2), each case's Editor check is a
// to-do: node --test reports it as such, never as a pass.
//
// From M2: webapp/src/core/validate.js exports validateLibrary(bytes), returning
// { findings: [{ code, severity, where }] }. Each case must then give exactly the findings of
// its expected.json "editor" section, order not counted (SC-04).
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

test('the corpus has its 56 cases', () => {
  assert.equal(cases.length, 56);
});

const key = (f) => `${f.code}|${f.severity}|${f.where ?? ''}`;

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
    test(`${name}: Editor findings (SC-04)`, () => {
      const got = engine.validateLibrary(new Uint8Array(readFileSync(zbl))).findings.map(key).sort();
      assert.deepEqual(got, expected.editor.codes.map(key).sort());
    });
  }
}
