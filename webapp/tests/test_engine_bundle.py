#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""The library engine as it ships: bundled by webapp/tools/bundle.py (webappTDS TD-22), it must give
the same findings as the native ES modules on every shared test library. The conformance runner
checks the native modules against expected.json; this test closes the gap to the bundle the library
worker will run. Run: python webapp/tests/test_engine_bundle.py. Needs node on PATH. Exit 0 = pass."""
import os
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
WEBAPP = os.path.normpath(os.path.join(HERE, '..'))
sys.path.insert(0, os.path.join(WEBAPP, 'tools'))
import bundle  # noqa: E402

if shutil.which('node') is None:
    print('node is not on PATH (webappTDS TD-21); in Git Bash on Windows: export PATH="/c/Program Files/nodejs:$PATH"')
    sys.exit(2)

d = tempfile.mkdtemp(prefix='.tmp-enginetest-', dir=WEBAPP)
try:
    entry = os.path.join(d, 'entry.js')
    with open(entry, 'w', encoding='utf-8') as fh:
        fh.write("import { validateLibrary } from '../src/core/validate.js';\nglobalThis.__zbm_engine = validateLibrary;\n")
    code, _, sources = bundle.bundle(entry, WEBAPP)
    with open(os.path.join(d, 'engine.bundle.mjs'), 'w', encoding='utf-8') as fh:
        fh.write(code)
    corpus = os.path.join(WEBAPP, '..', 'test-libraries').replace('\\', '/')
    native = 'file:///' + os.path.join(WEBAPP, 'src', 'core', 'validate.js').replace('\\', '/').lstrip('/')
    with open(os.path.join(d, 'compare.mjs'), 'w', encoding='utf-8') as fh:
        fh.write(f"""
import {{ readdirSync, readFileSync }} from 'node:fs';
import {{ validateLibrary as native }} from '{native}';
await import('./engine.bundle.mjs');
const bundled = globalThis.__zbm_engine;
const key = (r) => JSON.stringify(r.findings.map((f) => [f.code, f.severity, f.where ?? null]).sort());
let same = 0, differ = [];
for (const f of readdirSync('{corpus}').filter((x) => x.endsWith('.zbl')).sort()) {{
  const bytes = new Uint8Array(readFileSync('{corpus}/' + f));
  const a = key(await native(bytes)), b = key(await bundled(bytes));
  if (a === b) same++; else differ.push(f);
}}
console.log(JSON.stringify({{ same, differ }}));
""")
    r = subprocess.run(['node', os.path.join(d, 'compare.mjs')], capture_output=True, text=True)
    if r.returncode != 0:
        print('FAIL bundled engine did not run: ' + r.stderr.strip()[-300:])
        sys.exit(1)
    import json
    out = json.loads(r.stdout.strip().splitlines()[-1])
    ok = out['same'] == 59 and not out['differ']
    # The two workers and their clients, as the app will bundle them (TD-22): they bundle and parse.
    for entry in ('src/workers/library-worker.js', 'src/app/library-client.js',
                  'src/workers/crypto-worker.js', 'src/app/crypto-client.js'):
        wcode, _, wsources = bundle.bundle(os.path.join(WEBAPP, *entry.split('/')), WEBAPP)
        wfile = os.path.join(d, 'check.mjs')
        with open(wfile, 'w', encoding='utf-8') as fh:
            fh.write(wcode)
        rc = subprocess.run(['node', '--check', wfile], capture_output=True, text=True).returncode
        print(('PASS ' if rc == 0 else 'FAIL ') + f'{entry} bundles ({len(wsources)} modules) and passes node --check')
        ok = ok and rc == 0
        if entry == 'src/workers/crypto-worker.js':
            # SR-40: the key's worker carries the signing code only, not the library engine or fflate
            names = sorted(os.path.basename(s) for s in wsources)
            lean = not any(n.startswith(('fflate', 'zip', 'validate', 'library', 'chordpro')) for n in names)
            print(('PASS ' if lean else 'FAIL ') + f'crypto worker holds no library code: {", ".join(names)}')
            ok = ok and lean
    print(('PASS ' if ok else 'FAIL ') + f"bundled engine ({len(sources) - 1} modules) gives the native findings on "
          f"{out['same']} of 59 test libraries" + (f"; differs on {out['differ']}" if out['differ'] else ''))
    sys.exit(0 if ok else 1)
finally:
    shutil.rmtree(d, ignore_errors=True)
