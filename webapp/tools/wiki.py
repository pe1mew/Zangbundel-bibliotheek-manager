#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Build and check the manager's wiki (implementationPlan M7.6, C9; webappTDS TD-24).

    wiki.py build      Hugo turns wiki/ into webapp/src/wiki/, which is committed and released with the manager
    wiki.py check      every language has every page; every help link of the manager has its page and anchor;
                       and, when the pinned Hugo is here, webapp/src/wiki/ is exactly what Hugo builds now

The wiki's source is Markdown in wiki/<lang>/ with our own templates (wiki/layouts/), no theme and no
JavaScript. Its output is committed, so a release needs no Hugo and stays reproducible from its signed tag
(SR-10); build.py checks the pages like every other page (SR-24, SR-13) and hashes wiki.css with the assets.

Hugo is a development tool, never part of the site (TD-24). It is pinned by version, and on Windows by the
SHA-256 of hugo.exe from the release zip whose SHA-256 is recorded below. It is found at $ZBM_HUGO,
C:\\Apps\\hugo\\hugo.exe, or as `hugo` on PATH. Hugo needs no network for a build.
"""
import argparse
import filecmp
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile

HUGO_VERSION = '0.169.0'
HUGO_ZIP = 'hugo_0.169.0_windows-amd64.zip'
HUGO_ZIP_SHA256 = 'd1ea8b32bdc2d3d5d4b56178efedf0925c027d2063e6779b5e8df6f406b09948'   # from the release's checksums file
HUGO_EXE_SHA256 = '48f73c2643336b309f1f86e374a5365a0e39adcd487a8dc8bf14dc117a715797'   # hugo.exe inside that zip

TOOLS = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(TOOLS))
SOURCE = os.path.join(REPO, 'wiki')
OUTPUT = os.path.join(REPO, 'webapp', 'src', 'wiki')
TEXTS = os.path.join(REPO, 'webapp', 'src', 'app', 'texts.js')
FIELDHELP = os.path.join(REPO, 'webapp', 'src', 'app', 'fieldhelp.js')


def fail(msg):
    print(f'wiki: {msg}', file=sys.stderr)
    sys.exit(1)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for block in iter(lambda: fh.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def find_hugo():
    """The pinned Hugo, or None with the reason."""
    candidates = [os.environ.get('ZBM_HUGO'), r'C:\Apps\hugo\hugo.exe', shutil.which('hugo')]
    for c in [c for c in candidates if c]:
        if not os.path.isfile(c):
            continue
        try:
            out = subprocess.run([c, 'version'], capture_output=True, text=True, timeout=30).stdout
        except OSError:
            continue
        if not out.startswith(f'hugo v{HUGO_VERSION}-'):
            return None, f'{c} is not Hugo {HUGO_VERSION}: {out.strip()[:60]}'
        if os.name == 'nt' and sha256_file(c) != HUGO_EXE_SHA256:
            return None, f'{c} is not the hugo.exe of {HUGO_ZIP} (SHA-256 differs)'
        return c, None
    return None, f'Hugo {HUGO_VERSION} not found (set ZBM_HUGO, or unpack {HUGO_ZIP} into C:\\Apps\\hugo)'


def run_hugo(hugo, dest):
    r = subprocess.run([hugo, '--source', SOURCE, '--destination', dest, '--cleanDestinationDir', '--noBuildLock', '--quiet'],
                       capture_output=True, text=True)
    if r.returncode != 0:
        fail('Hugo failed:\n' + r.stdout + r.stderr)


def files_under(root):
    out = []
    for dirpath, _, filenames in os.walk(root):
        for f in filenames:
            out.append(os.path.relpath(os.path.join(dirpath, f), root).replace(os.sep, '/'))
    return sorted(out)


def interface_languages():
    text = open(TEXTS, encoding='utf-8').read()
    return re.findall(r'^  ([a-z]{2}): \{', text, re.M)


def wiki_languages():
    text = open(os.path.join(SOURCE, 'hugo.toml'), encoding='utf-8').read()
    return re.findall(r'^\[languages\.([a-z]{2})\]', text, re.M)


def help_links():
    """{help name: (page, anchor)} from WIKI in fieldhelp.js."""
    text = open(FIELDHELP, encoding='utf-8').read()
    m = re.search(r'export const WIKI = Object\.freeze\(\{(.*?)\}\);', text, re.S)
    if not m:
        fail('fieldhelp.js has no WIKI map')
    return {k: (p, a) for k, p, a in re.findall(r"(\w+): \['([a-z-]+)', '([a-z-]+)'\]", m.group(1))}


def check_sources(problems):
    ui, wl = interface_languages(), wiki_languages()
    if sorted(ui) != sorted(wl):
        problems.append(f'the wiki has languages {wl}, the interface {ui}: every interface language needs its wiki (M7.6)')
    pages = {lang: sorted(f for f in os.listdir(os.path.join(SOURCE, lang)) if f.endswith('.md')) for lang in wl
             if os.path.isdir(os.path.join(SOURCE, lang))}
    every = sorted(set().union(*pages.values())) if pages else []
    for lang in wl:
        missing = [p for p in every if p not in pages.get(lang, [])]
        if missing:
            problems.append(f'wiki/{lang}/ lacks {", ".join(missing)}')
    return wl


def check_output(langs, problems):
    if not os.path.isdir(OUTPUT):
        problems.append('webapp/src/wiki/ does not exist: run wiki.py build')
        return
    for name, (page, anchor) in sorted(help_links().items()):
        for lang in langs:
            path = os.path.join(OUTPUT, lang, page, 'index.html')
            if not os.path.isfile(path):
                problems.append(f'help link {name}: no page {lang}/{page}/')
            elif f'id="{anchor}"' not in open(path, encoding='utf-8').read():
                problems.append(f'help link {name}: {lang}/{page}/ has no #{anchor}')


def build(_args):
    hugo, why = find_hugo()
    if not hugo:
        fail(why)
    problems = []
    check_sources(problems)
    if problems:
        fail('\n  '.join(['the source is incomplete:'] + problems))
    with tempfile.TemporaryDirectory() as tmp:
        dest = os.path.join(tmp, 'wiki')
        run_hugo(hugo, dest)
        if os.path.isdir(OUTPUT):
            shutil.rmtree(OUTPUT)
        shutil.copytree(dest, OUTPUT)
    print(f'wiki: built webapp/src/wiki/ with Hugo {HUGO_VERSION}: {len(files_under(OUTPUT))} files')


def check(args):
    problems = []
    langs = check_sources(problems)
    check_output(langs, problems)
    hugo, why = find_hugo()
    if hugo:
        with tempfile.TemporaryDirectory() as tmp:
            dest = os.path.join(tmp, 'wiki')
            run_hugo(hugo, dest)
            a, b = files_under(dest), files_under(OUTPUT) if os.path.isdir(OUTPUT) else []
            if a != b:
                problems.append(f'webapp/src/wiki/ differs from a fresh build in its files: run wiki.py build')
            else:
                changed = [f for f in a if not filecmp.cmp(os.path.join(dest, f), os.path.join(OUTPUT, f), shallow=False)]
                if changed:
                    problems.append(f'webapp/src/wiki/ is not what Hugo builds now ({", ".join(changed[:5])}): run wiki.py build')
    elif args.need_hugo:
        problems.append(why)
    else:
        print(f'wiki: {why}; the comparison with a fresh build is skipped')
    if problems:
        fail('\n  '.join(['check failed:'] + problems))
    print(f'wiki: ok ({", ".join(langs)}; {len(help_links())} help links)')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('build')
    c = sub.add_parser('check')
    c.add_argument('--need-hugo', action='store_true', help='fail when the pinned Hugo is missing (before a release)')
    args = ap.parse_args()
    {'build': build, 'check': check}[args.cmd](args)


if __name__ == '__main__':
    main()
