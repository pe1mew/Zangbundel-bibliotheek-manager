#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Tests of the vendored packages (securityAssessment SR-12; webappTDS TD-17, TD-22): they match
VENDOR.md, they fit the bundler, and bundled they behave as the native modules in Node: fflate's
exports and a ZIP round trip, @noble/ed25519's RFC 8032 test 1. Also builds a page that imports
both through build.py. Run: python webapp/tests/test_vendor.py. Needs node on PATH. Exit 0 = pass."""
import json
import os
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.join(HERE, '..', 'tools')
sys.path.insert(0, TOOLS)
import bundle  # noqa: E402
import vendor  # noqa: E402

ok_all = True


def report(ok, name, detail=''):
    global ok_all
    ok_all &= ok
    print(('PASS ' if ok else 'FAIL ') + f'{name:52} {detail}'[:160])


if shutil.which('node') is None:
    print('node is not on PATH (webappTDS TD-21); in Git Bash on Windows: export PATH="/c/Program Files/nodejs:$PATH"')
    sys.exit(2)

problems = vendor.check(quiet=True)
report(not problems, 'webapp/vendor matches VENDOR.md', '; '.join(problems))
rows = {r['name']: r['file'] for r in vendor.read_table()}
report(set(rows) == {'fflate', '@noble/ed25519'}, 'VENDOR.md lists fflate and @noble/ed25519', str(sorted(rows)))

CHECK = r'''
import { createHash } from 'node:crypto';
import * as nativeF from './vendor/FFLATE';
import * as nativeN from './vendor/NOBLE';
await import('./bundle.mjs');
const B = globalThis.__zbm_test;
const out = {};
out.fflateKeys = JSON.stringify(Object.keys(nativeF).sort()) === JSON.stringify(Object.keys(B.f).sort());
out.nobleKeys = JSON.stringify(Object.keys(nativeN).sort()) === JSON.stringify(Object.keys(B.n).sort());
const files = { 'songs/a/a.cho': new TextEncoder().encode('{title: Test}\n'.repeat(50)), 'manifest.json': new TextEncoder().encode('{"x":1}') };
const z = B.f.zipSync(files, { level: 6 });
const back = B.f.unzipSync(z);
out.zip = new TextDecoder().decode(back['songs/a/a.cho']) === '{title: Test}\n'.repeat(50) && Object.keys(back).length === 2;
out.zipSameAsNative = Buffer.compare(Buffer.from(z), Buffer.from(nativeF.zipSync(files, { level: 6 }))) === 0;
B.n.hashes.sha512 = (m) => new Uint8Array(createHash('sha512').update(m).digest());
const sk = B.n.etc.hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
const pk = B.n.getPublicKey(sk);
const sig = B.n.sign(new Uint8Array(0), sk);
out.rfcPublicKey = B.n.etc.bytesToHex(pk) === 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
out.rfcSignature = B.n.etc.bytesToHex(sig) === 'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b';
out.verify = B.n.verify(sig, new Uint8Array(0), pk) === true;
out.verifyTampered = B.n.verify(sig, new Uint8Array([1]), pk) === false;
console.log(JSON.stringify(out));
'''

d = tempfile.mkdtemp()
try:
    shutil.copytree(vendor.VENDOR, os.path.join(d, 'vendor'))
    with open(os.path.join(d, 'package.json'), 'w', encoding='utf-8') as fh:
        fh.write('{"type": "module"}\n')
    os.makedirs(os.path.join(d, 'src'))
    with open(os.path.join(d, 'src', 'main.js'), 'w', encoding='utf-8') as fh:
        fh.write(f"import * as f from '../vendor/{rows['fflate']}';\n"
                 f"import * as n from '../vendor/{rows['@noble/ed25519']}';\n"
                 "globalThis.__zbm_test = { f, n };\n")
    code, workers, sources = bundle.bundle(os.path.join(d, 'src', 'main.js'), d)
    report(len(sources) == 3, 'both vendored files bundle (TD-22 subset)', f'{len(sources)} modules, {len(code)} bytes')
    with open(os.path.join(d, 'bundle.mjs'), 'w', encoding='utf-8') as fh:
        fh.write(code)
    with open(os.path.join(d, 'check.mjs'), 'w', encoding='utf-8') as fh:
        fh.write(CHECK.replace('FFLATE', rows['fflate']).replace('NOBLE', rows['@noble/ed25519']))
    r = subprocess.run(['node', os.path.join(d, 'check.mjs')], capture_output=True, text=True)
    out = json.loads(r.stdout) if r.returncode == 0 else {}
    report(r.returncode == 0, 'bundle runs in Node', r.stderr.strip()[-150:])
    report(out.get('fflateKeys') is True, 'fflate: same exports as the native module')
    report(out.get('nobleKeys') is True, '@noble/ed25519: same exports as the native module')
    report(out.get('zip') is True, 'fflate: ZIP round trip')
    report(out.get('zipSameAsNative') is True, 'fflate: ZIP bytes identical to the native module')
    report(out.get('rfcPublicKey') is True and out.get('rfcSignature') is True, '@noble/ed25519: RFC 8032 test 1 key and signature')
    report(out.get('verify') is True and out.get('verifyTampered') is True, '@noble/ed25519: verifies, and refuses a changed message')
finally:
    shutil.rmtree(d, ignore_errors=True)

# build.py with a page that imports the vendored files from webapp/vendor (vendor check + node --check)
webapp = os.path.normpath(os.path.join(HERE, '..'))
src = tempfile.mkdtemp(prefix='.tmp-vendortest-', dir=webapp)
out_dir = tempfile.mkdtemp()
try:
    os.makedirs(os.path.join(src, 'app'))
    with open(os.path.join(src, 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write('<!doctype html><html><head><script type="module" src="app/main.js"></script></head><body></body></html>\n')
    with open(os.path.join(src, 'app', 'main.js'), 'w', encoding='utf-8') as fh:
        fh.write(f"import {{ zipSync }} from '../../vendor/{rows['fflate']}';\n"
                 f"import {{ verify }} from '../../vendor/{rows['@noble/ed25519']}';\n"
                 "export const ready = typeof zipSync === 'function' && typeof verify === 'function';\n")
    r = subprocess.run([sys.executable, os.path.join(TOOLS, 'build.py'), 'build', '--src', src, '--name', 'vendortest',
                        '--version', '1.0.0', '--out', os.path.join(out_dir, 'o'), '--allow-dirty'], capture_output=True, text=True)
    report(r.returncode == 0, 'build.py bundles a page importing webapp/vendor', (r.stderr or r.stdout).strip()[-150:])
finally:
    shutil.rmtree(src, ignore_errors=True)
    shutil.rmtree(out_dir, ignore_errors=True)

print('ALL OK' if ok_all else 'SOME FAILED')
sys.exit(0 if ok_all else 1)
