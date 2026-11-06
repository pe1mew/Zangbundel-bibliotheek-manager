#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Vendor a third-party package into webapp/vendor/ as securityAssessment SR-12 and SR-14 require.

    vendor.py add fflate 0.8.3 --file esm/browser.js [--accept-missing-provenance]
    vendor.py check

add:   1. npm view: the registry's dist.integrity (SHA-512), tarball URL, licence and provenance
          attestations of the exact version;
       2. npm pack: downloads the tarball; its SHA-512 must equal dist.integrity;
       3. in a scratch project: npm install --ignore-scripts, then `npm audit signatures` (registry
          signatures and provenance must verify) and `npm audit` (no known advisory, SR-14);
       4. copies one file of the package and its licence into webapp/vendor/ and records name,
          version, source, SHA-512 of the tarball, SHA-256 of the file, provenance and licence in
          webapp/vendor/VENDOR.md; the file must fit the bundler's module subset (TD-22).
       A package without a provenance attestation is refused unless --accept-missing-provenance is
       given; VENDOR.md then says so.
check: every file in VENDOR.md exists with its recorded SHA-256, and nothing else is in vendor/.

Needs npm on PATH (a development tool, webappTDS TD-21). Downloads from registry.npmjs.org only in
`add`; `check` and build.py work offline.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bundle  # noqa: E402

VENDOR = os.path.normpath(os.path.join(HERE, '..', 'vendor'))
TABLE = os.path.join(VENDOR, 'VENDOR.md')
HEADER = '''# Vendored packages

Written by `webapp/tools/vendor.py` (securityAssessment SR-12, SR-14; webappTDS TD-17, TD-22). Do not edit
by hand: `vendor.py add` replaces a package's row, `vendor.py check` and `build.py` compare every file with
its SHA-256 here. Each file is one file of the npm package, unchanged; its licence is next to it.

| File | Package | Version | Source | Tarball SHA-512 (npm `dist.integrity`) | File SHA-256 | Provenance | Licence |
|---|---|---|---|---|---|---|---|
'''
ROW = re.compile(r'^\| `(?P<file>[^`]+)` \| `(?P<name>[^`]+)` \| (?P<version>[^ |]+) \| (?P<source>[^|]+?) \| `(?P<sha512>[^`]+)` '
                 r'\| `(?P<sha256>[0-9a-f]{64})` \| (?P<prov>[^|]+?) \| (?P<licence>[^|]+?) \|$')


def fail(msg):
    print('vendor: ' + msg, file=sys.stderr)
    sys.exit(1)


def npm(*args, cwd=None):
    exe = shutil.which('npm') or shutil.which('npm.cmd')
    if exe is None:
        fail('npm is not on PATH (webappTDS TD-21)')
    return subprocess.run([exe, *args], cwd=cwd, capture_output=True, text=True)


def read_table():
    if not os.path.isfile(TABLE):
        return []
    rows = []
    for line in open(TABLE, encoding='utf-8'):
        m = ROW.match(line.rstrip('\n'))
        if m:
            rows.append(m.groupdict())
    return rows


def write_table(rows):
    os.makedirs(VENDOR, exist_ok=True)
    with open(TABLE, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(HEADER)
        for r in sorted(rows, key=lambda r: r['file']):
            fh.write(f"| `{r['file']}` | `{r['name']}` | {r['version']} | {r['source']} | `{r['sha512']}` | `{r['sha256']}` "
                     f"| {r['prov']} | {r['licence']} |\n")


def sha256(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def check(quiet=False):
    """Return a list of problems; [] when every vendored file matches VENDOR.md."""
    rows, problems = read_table(), []
    listed = set()
    for r in rows:
        listed.update({r['file'], r['file'][:-3] + '.LICENSE'})
        path = os.path.join(VENDOR, r['file'])
        if not os.path.isfile(path):
            problems.append(f"{r['file']}: missing")
        elif sha256(path) != r['sha256']:
            problems.append(f"{r['file']}: SHA-256 differs from VENDOR.md")
        if not os.path.isfile(os.path.join(VENDOR, r['file'][:-3] + '.LICENSE')):
            problems.append(f"{r['file']}: licence file missing")
    if os.path.isdir(VENDOR):
        extra = set(os.listdir(VENDOR)) - listed - {'VENDOR.md'}
        problems.extend(f'{x}: not in VENDOR.md' for x in sorted(extra))
    if not quiet:
        for p in problems:
            print('vendor: ' + p, file=sys.stderr)
    return problems


def cmd_add(a):
    if not re.fullmatch(r'\d+\.\d+\.\d+', a.version):
        fail('give an exact version, X.Y.Z')
    spec = f'{a.name}@{a.version}'
    r = npm('view', spec, 'dist.integrity', 'dist.tarball', 'dist.attestations', 'license', 'version', '--json')
    if r.returncode != 0:
        fail(f'npm view {spec}: {r.stderr.strip()[-300:]}')
    info = json.loads(r.stdout)
    if info.get('version') != a.version:
        fail(f'npm view returned version {info.get("version")}')
    integrity, tarball = info['dist.integrity'], info['dist.tarball']
    if not integrity.startswith('sha512-'):
        fail(f'no SHA-512 integrity for {spec}')
    has_provenance = bool(info.get('dist.attestations'))
    if not has_provenance and not a.accept_missing_provenance:
        fail(f'{spec} has no provenance attestation; pass --accept-missing-provenance to vendor it anyway (recorded in VENDOR.md)')

    with tempfile.TemporaryDirectory() as tmp:
        r = npm('pack', spec, '--json', '--pack-destination', tmp, cwd=tmp)
        if r.returncode != 0:
            fail(f'npm pack {spec}: {r.stderr.strip()[-300:]}')
        tgz = os.path.join(tmp, json.loads(r.stdout)[0]['filename'])
        got = 'sha512-' + base64.b64encode(hashlib.sha512(open(tgz, 'rb').read()).digest()).decode()
        if got != integrity:
            fail(f'tarball SHA-512 {got} differs from the registry dist.integrity {integrity}')

        proj = os.path.join(tmp, 'check')
        os.makedirs(proj)
        with open(os.path.join(proj, 'package.json'), 'w', encoding='utf-8') as fh:
            json.dump({'name': 'zbm-vendor-check', 'private': True, 'dependencies': {a.name: a.version}}, fh)
        r = npm('install', '--ignore-scripts', '--no-fund', '--no-audit', cwd=proj)
        if r.returncode != 0:
            fail(f'npm install {spec}: {r.stderr.strip()[-300:]}')
        r = npm('audit', 'signatures', '--json', '--include-attestations', cwd=proj)
        if r.returncode != 0:
            fail(f'npm audit signatures failed for {spec}: {(r.stdout + r.stderr).strip()[-400:]}')
        sig = json.loads(r.stdout or '{}')
        if sig.get('invalid') or sig.get('missing'):
            fail(f'npm audit signatures: invalid {sig.get("invalid")}, missing {sig.get("missing")}')
        attested = any(x.get('name') == a.name and x.get('attestations') for x in sig.get('verified', []))
        if has_provenance and not attested:
            fail(f'{spec} lists a provenance attestation that npm audit signatures did not verify')
        r = npm('audit', '--json', cwd=proj)
        vulns = json.loads(r.stdout or '{}').get('metadata', {}).get('vulnerabilities', {})
        if vulns.get('total', 1) != 0:
            fail(f'npm audit reports advisories for {spec}: {vulns} (SR-14)')

        with tarfile.open(tgz, 'r:gz') as t:
            names = {m.name: m for m in t.getmembers() if m.isfile()}
            want = 'package/' + a.file.lstrip('/')
            if want not in names or '..' in want:
                fail(f'{a.file} is not in the package')
            lic = next((n for n in ('package/LICENSE', 'package/LICENSE.md', 'package/LICENSE.txt') if n in names), None)
            if lic is None:
                fail(f'{spec} has no LICENSE file')
            body = t.extractfile(names[want]).read()
            lic_body = t.extractfile(names[lic]).read()

    slug = a.name.lstrip('@').replace('/', '-')
    fname = f'{slug}-{a.version}.js'
    os.makedirs(VENDOR, exist_ok=True)
    for old in [r for r in read_table() if r['name'] == a.name]:
        for p in (old['file'], old['file'][:-3] + '.LICENSE'):
            if os.path.exists(os.path.join(VENDOR, p)):
                os.remove(os.path.join(VENDOR, p))
    path = os.path.join(VENDOR, fname)
    with open(path, 'wb') as fh:
        fh.write(body)
    with open(path[:-3] + '.LICENSE', 'wb') as fh:
        fh.write(lic_body)
    try:
        bundle.parse_module(path, f'vendor/{fname}', VENDOR)
    except bundle.BundleError as e:
        os.remove(path)
        os.remove(path[:-3] + '.LICENSE')
        fail(f'{a.file} does not fit the bundler subset: {e}')

    rows = [r for r in read_table() if r['name'] != a.name]
    rows.append({'file': fname, 'name': a.name, 'version': a.version,
                 'source': f'{tarball} → `{a.file}`', 'sha512': integrity, 'sha256': sha256(path),
                 'prov': 'SLSA provenance, verified (`npm audit signatures`)' if has_provenance
                 else '**none published** (accepted with `--accept-missing-provenance`)',
                 'licence': str(info.get('license', '?'))})
    write_table(rows)
    print(f'vendored {spec} as webapp/vendor/{fname}: tarball SHA-512 matches the registry, '
          f'signatures verified, provenance {"verified" if has_provenance else "NONE"}, no advisories')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('add')
    p.add_argument('name')
    p.add_argument('version')
    p.add_argument('--file', required=True, help="the file inside the package, e.g. 'esm/browser.js'")
    p.add_argument('--accept-missing-provenance', action='store_true')
    sub.add_parser('check')
    a = ap.parse_args()
    if a.cmd == 'add':
        cmd_add(a)
    else:
        problems = check()
        print('vendor: all files match VENDOR.md' if not problems else f'vendor: {len(problems)} problem(s)')
        sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
