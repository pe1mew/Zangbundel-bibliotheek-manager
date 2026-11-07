// SPDX-License-Identifier: Apache-2.0
// Every module of the app parses (webappTDS TD-22). main.js starts the page when imported, so no unit
// test loads it; this check catches what the build's syntax check would, such as a name declared twice,
// already in node --test. Run: node --test webapp/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

test('TD-22: every module under webapp/src parses', () => {
  const files = ['app', 'core', 'workers'].flatMap((d) => readdirSync(join(SRC, d)).filter((f) => f.endsWith('.js')).map((f) => join(SRC, d, f)));
  assert.ok(files.length > 30, `only ${files.length} modules`);
  for (const file of files) {
    const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${file}\n${r.stderr}`);
  }
});
