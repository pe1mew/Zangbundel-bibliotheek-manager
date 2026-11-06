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
if shutil.which('node') is None:
    print('node is not on PATH (webappTDS TD-21); in Git Bash on Windows: export PATH="/c/Program Files/nodejs:$PATH"')
    sys.exit(2)


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

# ---- same result as native ES modules (review of 13f7776: ASI, regex after ')', x++ / y, ...) ----
def same_as_native(name, files):
    """Run src/main.js natively (ESM) and as a bundle; both must set the same globalThis.__r."""
    d = tree(dict(files, **{'src/package.json': '{"type": "module"}'}))
    try:
        code, workers, _ = bundle.bundle(os.path.join(d, 'src', 'main.js'), d)
        with open(os.path.join(d, 'bundle.mjs'), 'w', encoding='utf-8') as fh:
            fh.write(code)
        outs = []
        for target in ('./src/main.js', './bundle.mjs'):
            with open(os.path.join(d, 'run.mjs'), 'w', encoding='utf-8') as fh:
                fh.write(f"await import('{target}'); console.log(JSON.stringify(globalThis.__r));\n")
            r = subprocess.run(['node', os.path.join(d, 'run.mjs')], capture_output=True, text=True)
            err = (r.stderr.strip().splitlines() or ['?'])[-1][:80]
            outs.append(r.stdout.strip() if r.returncode == 0 else 'ERROR ' + err)
        report(outs[0] == outs[1] and not outs[0].startswith('ERROR'), f'same as native: {name}',
               f'native {outs[0]} / bundle {outs[1]}')
    except bundle.BundleError as e:
        report(False, f'same as native: {name}', str(e))
    finally:
        shutil.rmtree(d, ignore_errors=True)


same_as_native('export list after a line without ;', {
    'src/main.js': "import { msg } from './m.js';\nglobalThis.__r = typeof msg;\n",
    'src/m.js': "const greet = (s) => 'hi ' + s\nlet msg = greet\nexport { msg }\n('x')\n"})
same_as_native('import between two lines without ;', {
    'src/main.js': "const f = (x) => x\nlet g = f\nimport { one } from './one.js'\n(1)\nglobalThis.__r = [typeof g, one];\n",
    'src/one.js': 'export const one = 1;\n'})
same_as_native('export list before a line starting with [', {
    'src/main.js': "import { a } from './a.js';\nglobalThis.__r = a;\n",
    'src/a.js': "const a = [1]\nexport { a }\n[0].forEach(() => {})\n"})
same_as_native('regex after if (...)', {
    'src/main.js': "const t = 'export {k}', k = 1; let r = 'none';\nif (k) /export {k}/i.test(t) ? (r = 'match') : 0;\nglobalThis.__r = r;\n"})
same_as_native('division after x++', {
    'src/main.js': "let i = 4; let h = i++ / 2; export const g = 7; let z = h / 4;\nglobalThis.__r = [h, g, z, i];\n"})
same_as_native('object keys and class fields named import/export', {
    'src/main.js': "const o = { export: 1, import: 2 };\nclass C { export = 3; import() { return 4; } }\nconst c = new C();\nglobalThis.__r = [o.export, o.import, c.export, c.import()];\n"})
same_as_native('a module that shadows Object', {
    'src/main.js': "import { v } from './o.js';\nglobalThis.__r = v;\n",
    'src/o.js': "const Object = { freeze: () => 'hijacked' };\nexport const v = 5;\n"})

for name, text, expect in (
        ('export { a as default }', 'const a = 1;\nexport { a as default };\n', 'default exports'),
        ("export { 'a-b' as c }", "const c = 1;\nexport { 'a-b' as c };\n", 'cannot read export'),
        ('a non-ASCII identifier', 'const é = 1;\nexport { é };\n', 'plain ASCII'),
        ('a NUL character', "const s = '\x00';\nexport const t = 1;\n", 'NUL'),
        ('import.meta.url on its own', 'export const u = import.meta.url;\n', 'import.meta is allowed only')):
    d = tree({'src/main.js': text})
    try:
        bundle.bundle(os.path.join(d, 'src', 'main.js'), d)
        report(False, f'refuses {name}', 'was bundled')
    except bundle.BundleError as e:
        report(expect in str(e), f'refuses {name}', str(e))
    finally:
        shutil.rmtree(d, ignore_errors=True)

d = tree({'src/main.js': "const u = new URL('./w.js', import.meta.url);\nexport const url = u;\n",
          'src/w.js': 'export const w = 1;\n'})
try:
    code, workers, _ = bundle.bundle(os.path.join(d, 'src', 'main.js'), d)
    report(len(workers) == 1 and code.splitlines()[1] == "'use strict';",
           "worker URL outside new Worker(); bundle starts 'use strict'")
except bundle.BundleError as e:
    report(False, "worker URL outside new Worker(); bundle starts 'use strict'", str(e))
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
