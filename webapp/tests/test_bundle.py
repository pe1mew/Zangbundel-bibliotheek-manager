#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Tests of webapp/tools/bundle.py (webappTDS TD-22): bundles that must work, run in Node, and
module code the bundler must refuse. Run: python webapp/tests/test_bundle.py. Needs node on PATH.
Exit 0 = all pass."""
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'tools'))
import bundle  # noqa: E402

ok_all = True


def report(ok, name, detail=''):
    global ok_all
    ok_all &= ok
    print(('PASS ' if ok else 'FAIL ') + f'{name:44} {detail}'[:150])


def tree(files):
    d = tempfile.mkdtemp()
    for rel, text in files.items():
        p = os.path.join(d, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(text)
    return d


# ---- a bundle that must work, checked by running it in Node --------------------------------
GOOD = {
    'src/main.js': r'''// SPDX-License-Identifier: Apache-2.0
// A comment that says: import { nothing } from './nowhere.js';
import { add, PI as pi } from './lib/math.js';
import * as text from './lib/text.js';
import {
  shout,
} from './lib/text.js';
const tricky = [
  'import x from "./a.js"',
  `export default ${1 + 1}`,
  /import\s+\{/.test('import {') ? 'regex ok' : 'regex wrong',
  `nested ${`inner ${'export const no = 1'}`}`,
];
/* export function hidden() {} */
const w = typeof Worker === 'undefined' ? null : new Worker(new URL('./workers/w.js', import.meta.url), { type: 'module' });
globalThis.__result = { sum: add(2, 3), pi, greet: text.greet('Zangbundel'), shout: shout('hi'), tricky, frozen: Object.isFrozen(text) };
''',
    'src/lib/math.js': '''export function add(a, b) { return a + b; }
export const PI = 3.14;
''',
    'src/lib/text.js': '''import { add } from './math.js';
function greet(name) { return `Hallo ${name} (${add(1, 1)})`; }
const shout = (s) => s.toUpperCase();
export { greet, shout };
export class Unused {}
''',
    'src/workers/w.js': '''import { add } from '../lib/math.js';
export async function run() { return add(40, 2); }
globalThis.__worker = add(40, 2);
''',
}
d = tree(GOOD)
try:
    code, workers, sources = bundle.bundle(os.path.join(d, 'src', 'main.js'), d)
    report(len(sources) == 3 and len(workers) == 1, 'main bundle: 3 modules, 1 worker', f'{len(sources)} modules, {len(workers)} workers')
    wcode, wworkers, wsources = bundle.bundle(workers[0], d)
    report(len(wsources) == 2 and not wworkers, 'worker bundle: 2 modules', f'{len(wsources)} modules')
    final = bundle.place_workers(code, {workers[0]: 'w.0123456789ab.js'})
    report("new URL('./w.0123456789ab.js', import.meta.url)" in final and '\x00' not in final,
           'worker URL replaced by the bundle name')
    for name, body in (('main.mjs', final), ('w.mjs', wcode)):
        with open(os.path.join(d, name), 'w', encoding='utf-8') as fh:
            fh.write(body)
    with open(os.path.join(d, 'run.mjs'), 'w', encoding='utf-8') as fh:
        fh.write("await import('./main.mjs'); await import('./w.mjs');\n"
                 "console.log(JSON.stringify({ r: globalThis.__result, w: globalThis.__worker }));\n")
    r = subprocess.run(['node', os.path.join(d, 'run.mjs')], capture_output=True, text=True)
    import json
    out = json.loads(r.stdout) if r.returncode == 0 else {}
    res = out.get('r', {})
    report(r.returncode == 0, 'bundles run in Node', r.stderr.strip()[-120:])
    report(res.get('sum') == 5 and res.get('pi') == 3.14, 'named and aliased imports')
    report(res.get('greet') == 'Hallo Zangbundel (2)' and res.get('shout') == 'HI', 'namespace import and export list')
    report(res.get('frozen') is True, 'module exports are frozen')
    report(res.get('tricky') == ['import x from "./a.js"', 'export default 2', 'regex ok', 'nested inner export const no = 1'],
           'import/export inside strings, templates, regexes untouched', str(res.get('tricky')))
    report(out.get('w') == 42, 'worker bundle runs')
    report(final.count('\n') >= GOOD['src/main.js'].count('\n'), 'line count of sources kept (blanked, not deleted)')
except bundle.BundleError as e:
    report(False, 'good tree bundles', str(e))
finally:
    shutil.rmtree(d, ignore_errors=True)

# ---- module code that must be refused --------------------------------------------------------
BAD = {
    'dynamic import()': ("const m = import('./x.js');", 'dynamic import'),
    'default export': ('export default function f() {}', 'default exports'),
    're-export': ("export * from './x.js';", 're-exports'),
    'named re-export': ("export { a } from './x.js';", 're-exports'),
    'bare specifier': ("import { a } from 'fflate';", 'only relative imports'),
    'two names in one export const': ('export const a = 1, b = 2;', 'one name per export'),
    'destructured export': ('export const { a } = { a: 1 };', 'simple name'),
    'import.meta outside a Worker URL': ('const u = import.meta.url;', 'import.meta is allowed only'),
    'import of a name not exported': ("import { nope } from './x.js';", "'nope' is not exported"),
}
for name, (text, expect) in BAD.items():
    d = tree({'src/main.js': text + '\n', 'src/x.js': 'export const a = 1;\n'})
    try:
        bundle.bundle(os.path.join(d, 'src', 'main.js'), d)
        report(False, f'refuses {name}', 'was bundled')
    except bundle.BundleError as e:
        report(expect in str(e), f'refuses {name}', str(e))
    finally:
        shutil.rmtree(d, ignore_errors=True)

d = tree({'src/a.js': "import { b } from './b.js';\nexport const a = 1;\n",
          'src/b.js': "import { a } from './a.js';\nexport const b = 2;\n"})
try:
    bundle.bundle(os.path.join(d, 'src', 'a.js'), d)
    report(False, 'refuses an import cycle', 'was bundled')
except bundle.BundleError as e:
    report('import cycle' in str(e), 'refuses an import cycle', str(e))
finally:
    shutil.rmtree(d, ignore_errors=True)

print('ALL OK' if ok_all else 'SOME FAILED')
sys.exit(0 if ok_all else 1)
