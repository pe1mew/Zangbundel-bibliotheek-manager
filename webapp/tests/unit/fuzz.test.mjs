// SPDX-License-Identifier: Apache-2.0
// A short run of the fuzzer (webapp/tests/fuzz.mjs) on every `node --test`, so a change that makes
// the readers throw or hang on mutated libraries is seen at once (securityAssessment SR-35). The long
// run is `node webapp/tests/fuzz.mjs --iterations 20000`, before a release.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuzzChordPro, runFuzz } from '../fuzz.mjs';

test('fuzz: 400 mutated libraries give findings, never throw, within 2 s each', async () => {
  const r = await runFuzz({ iterations: 400, seed: 20261107, limitMs: 2000 });
  assert.deepEqual(r.failures, []);
  assert.ok(Object.keys(r.byMutator).length >= 8, JSON.stringify(r.byMutator));
});

test('fuzz: 300 random song texts parse without throwing', () => {
  const r = fuzzChordPro({ iterations: 300, seed: 20261107 });
  assert.deepEqual(r.failures, []);
});
