#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Build and pack a static release of the Zangbundel web pages (securityAssessment 7.4).

    build.py build --src webapp/placeholder --name placeholder --version 0.1.0
    build.py pack  dist/placeholder-0.1.0

build: copies the source tree to dist/<name>-<version>/, renames every file under assets/ to
       <stem>.<hash>.<ext> (SR-61), rewrites the references in HTML and CSS, adds SRI
       (sha384) to stylesheets and scripts (SR-12), refuses inline script, inline style and
       event-handler attributes (SR-24, SR-32), and writes release-manifest.json: the path,
       size and SHA-256 of every file (SR-11). Same input, same output: no timestamps.
pack:  after the manifest is signed (sign-release.sh), writes dist/<name>-<version>.tar with
       fixed owners, modes and times, in sorted order.

Standard library only; no network.
"""
import argparse
import base64
import hashlib
import io
import json
import os
import posixpath
import re
import shutil
import subprocess
import sys
import tarfile
from html.parser import HTMLParser

# .js and .webmanifest come with M1.1, which rewrites the references inside them; until then the
# build refuses them rather than ship references to files it renamed.
ALLOWED_EXT = {'.html', '.css', '.svg', '.png', '.webp', '.ico', '.txt', '.json'}
TEXT_EXT = {'.html', '.css', '.js', '.svg', '.txt', '.json', '.webmanifest'}
MANIFEST = 'release-manifest.json'
SIGNATURE = MANIFEST + '.sig'
VERSION_RE = re.compile(r'^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$')
NAME_RE = re.compile(r'^[a-z][a-z0-9-]{0,31}$')

# References are rewritten with these regexes; every result is then checked again with a real
# HTML parser (check_html, check_output), so a form the regexes miss fails the build instead of
# slipping through.
RE_REF = re.compile(r'''(?P<attr>(?<![-\w])(?:href|src))\s*=\s*"(?P<url>[^"]*)"''', re.I)
RE_CSS_URL = re.compile(r'''url\(\s*(?P<q>["']?)(?P<url>[^"')]+)(?P=q)\s*\)''')
RE_TAG = re.compile(r'<(?P<name>link|script)\b(?P<attrs>[^>]*)>', re.I)
RE_CSS_COMMENT = re.compile(r'/\*.*?\*/', re.S)

# Markup that Python's HTMLParser reads differently from a browser (comment and CDATA edge cases,
# end tags with attributes), or that can run or load something the checks do not follow. Refused
# outright; the CSP would block most of it, but the build promises not to ship it (SR-24, SR-32).
RE_HTML_TRAPS = [
    (re.compile(r'<!\[CDATA\[', re.I), 'a CDATA section'),
    (re.compile(r'--!>'), 'a "--!>" comment end'),
    (re.compile(r'<!---?>'), 'an abrupt comment (<!--> or <!--->)'),
    (re.compile(r'</[a-zA-Z][a-zA-Z0-9]*[^a-zA-Z0-9>\s]'), 'an end tag with extra characters'),
    (re.compile(r'</[a-zA-Z][a-zA-Z0-9]*\s+[^>\s]'), 'an end tag with attributes'),
    (re.compile(r'<!(?!--|doctype\s)', re.I), 'markup declaration other than a comment or doctype'),
]
REFUSED_TAGS = {'base', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'template'}


def fail(msg):
    print('build: ' + msg, file=sys.stderr)
    sys.exit(1)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def sri(data):
    return 'sha384-' + base64.b64encode(hashlib.sha384(data).digest()).decode('ascii')


def walk(src):
    """Relative POSIX paths of every file under src, sorted. Dot entries only for .well-known."""
    out = []
    for dirpath, dirnames, filenames in os.walk(src):
        rel_dir = os.path.relpath(dirpath, src).replace(os.sep, '/')
        rel_dir = '' if rel_dir == '.' else rel_dir
        dirnames[:] = sorted(d for d in dirnames if not d.startswith('.') or (rel_dir == '' and d == '.well-known'))
        for f in filenames:
            p = posixpath.join(rel_dir, f) if rel_dir else f
            if f.startswith('.'):
                fail(f'dot file in the source: {p}')
            full = os.path.join(dirpath, f)
            if os.path.islink(full):
                fail(f'symbolic link in the source: {p}')
            ext = posixpath.splitext(f)[1].lower()
            if ext not in ALLOWED_EXT:
                fail(f'file type not allowed in a release: {p}')
            if f in (MANIFEST, SIGNATURE):
                fail(f'reserved name in the source: {p}')
            out.append(p)
    return sorted(out)


def resolve(base_dir, url):
    """Map a reference in a file at base_dir to a release path, or None if it is external."""
    if re.match(r'^[a-z][a-z0-9+.-]*:', url, re.I) or url.startswith('//') or url.startswith('#') or url == '':
        return None
    path = url.split('#', 1)[0].split('?', 1)[0]
    if path.startswith('/'):
        joined = path.lstrip('/')
    else:
        joined = posixpath.normpath(posixpath.join(base_dir, path))
    return None if joined.startswith('..') else joined


def renamed_url(url, new_path):
    """Keep the reference's own directory form and its query or fragment; replace the file name."""
    m = re.match(r'^([^?#]*)(.*)$', url, re.S)
    head, _, _ = m.group(1).rpartition('/')
    return (head + '/' if head or url.startswith('/') else '') + posixpath.basename(new_path) + m.group(2)


class Tags(HTMLParser):
    """Every start tag with its attributes, as a browser's tokenizer sees them, plus script text."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags, self.script_text, self._in_script = [], [], False

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, attrs))
        self._in_script = tag == 'script'

    def handle_endtag(self, tag):
        if tag == 'script':
            self._in_script = False

    def handle_data(self, data):
        if self._in_script and data.strip():
            self.script_text.append(data.strip()[:40])


def parse(text):
    t = Tags()
    t.feed(text)
    t.close()
    return t


def check_html(path, text):
    """SR-24, SR-32: no inline style, no inline script, no event handlers, no script URLs."""
    problems = set()
    for rx, what in RE_HTML_TRAPS:
        if rx.search(text):
            problems.add(what)
    for m in re.finditer(r'<!--(.*?)-->', text, re.S):
        if '<' in m.group(1) or '>' in m.group(1):
            problems.add('a comment containing < or >')
    t = parse(text)
    for tag, attrs in t.tags:
        a = dict(attrs)
        if tag in REFUSED_TAGS or (tag == 'meta' and a.get('http-equiv')):
            problems.add(f'a <{tag}> element' + (' with http-equiv' if tag == 'meta' else ''))
        if tag in ('img', 'script', 'link', 'source', 'audio', 'video', 'track', 'input') and \
                re.match(r'^\s*(https?:)?//', a.get('src') or (a.get('href') if tag == 'link' else '') or ''):
            problems.add(f'an external resource in <{tag}> (SR-12)')
        if tag == 'style':
            problems.add('a <style> element')
        if tag == 'script' and not dict(attrs).get('src'):
            problems.add('a <script> without src')
        for name, value in attrs:
            if name == 'style':
                problems.add('a style attribute')
            elif name.startswith('on'):
                problems.add(f'an event-handler attribute ({name})')
            elif name == 'integrity':
                problems.add('an integrity attribute (the build adds it)')
            elif name in ('srcset', 'srcdoc', 'formaction', 'xlink:href', 'ping'):
                problems.add(f'a {name} attribute')
            if value and re.sub(r'[\s\x00-\x1f]', '', value).lower().startswith(('javascript:', 'vbscript:', 'data:text/html')):
                problems.add(f'a script URL in {name}')
    if t.script_text:
        problems.add('an inline <script>')
    if problems:
        fail(f'{path} contains ' + ', '.join(sorted(problems)) + ' (SR-24, SR-32)')


def check_output(out_data):
    """After rewriting: every local reference resolves to a released file, and every stylesheet
    and script carries the right SRI (SR-12, SR-13). Catches what the regexes did not rewrite."""
    for p, body in out_data.items():
        base = posixpath.dirname(p)
        if p.endswith('.html'):
            for tag, attrs in parse(body.decode('utf-8')).tags:
                a = dict(attrs)
                for name in ('href', 'src'):
                    url = a.get(name)
                    target = resolve(base, url or '')
                    if target is None:
                        continue
                    if target not in out_data and posixpath.join(target, 'index.html') not in out_data \
                            and not (target in ('', '.') and 'index.html' in out_data):
                        fail(f'{p}: {name}="{url}" does not resolve to a file of the release '
                             '(write href and src in double quotes)')
                rel = (a.get('rel') or '').lower().split()
                if (tag == 'link' and 'stylesheet' in rel) or tag == 'script':
                    url = a.get('href') if tag == 'link' else a.get('src')
                    target = resolve(base, url or '')
                    if target is None:
                        fail(f'{p}: stylesheets and scripts must come from this site (SR-12): {url}')
                    if a.get('integrity') != sri(out_data[target]):
                        fail(f'{p}: {url} has no or a wrong integrity attribute (write rel, href and src in double quotes)')
        elif p.endswith('.css'):
            text = RE_CSS_COMMENT.sub('', body.decode('utf-8'))
            if re.search(r'@import', text, re.I):
                fail(f'{p}: @import is not supported; link each stylesheet from the HTML')
            for m in RE_CSS_URL.finditer(text):
                url = m.group('url').strip()
                if url.startswith('data:'):
                    continue
                target = resolve(base, url)
                if target is None:
                    fail(f'{p}: url({url}) is not a file of this site (SR-12)')
                if target not in out_data:
                    fail(f'{p}: url({url}) does not resolve to a file of the release')
        elif p.endswith('.svg'):
            text = body.decode('utf-8')
            if re.search(r'<script|\son[a-z]+\s*=|javascript:|<foreignObject', text, re.I):
                fail(f'{p}: an SVG with script, event handlers or foreignObject (SR-24)')


def git(src, *args):
    return subprocess.run(['git', *args], cwd=src, capture_output=True, text=True, check=True).stdout


def git_state(src, files):
    """(commit, dirty, tag, on_main). Dirty when the source or this build tool has uncommitted
    changes, or a file to be released is not tracked by git, for example an ignored file (SR-10).
    tag: a tag on HEAD whose signature git verifies (SR-90). on_main: HEAD is on main (SR-10)."""
    try:
        commit = git(src, 'rev-parse', 'HEAD').strip()
        tools = os.path.dirname(os.path.abspath(__file__))
        dirty = git(src, 'status', '--porcelain', '--', '.', tools).strip() != ''
        tracked = set(git(src, '-c', 'core.quotePath=false', 'ls-files', '--', '.').splitlines())
        if set(files) - tracked:
            dirty = True
        tag = None
        for t in sorted(git(src, 'tag', '--points-at', 'HEAD').split()):
            if subprocess.run(['git', 'verify-tag', t], cwd=src, capture_output=True).returncode == 0:
                tag = t
                break
        on_main = any(subprocess.run(['git', 'merge-base', '--is-ancestor', 'HEAD', ref], cwd=src,
                                     capture_output=True).returncode == 0
                      for ref in ('refs/heads/main', 'refs/remotes/origin/main'))
        return commit, dirty, tag, on_main
    except (OSError, subprocess.CalledProcessError):
        return None, True, None, False


def build(args):
    src = os.path.abspath(args.src)
    if not os.path.isdir(src):
        fail(f'no such directory: {args.src}')
    if not NAME_RE.match(args.name):
        fail('name: lower-case letters, digits and hyphens')
    if not VERSION_RE.match(args.version):
        fail('version: X.Y.Z')
    files = walk(src)
    commit, dirty, tag, on_main = git_state(src, files)
    if not args.allow_dirty:
        if commit is None:
            fail('cannot read the git state of the source and of this build tool; both must be in the same '
                 'git checkout (or pass --allow-dirty for a trial build)')
        if not on_main:
            fail('HEAD is not on main (SR-10); or pass --allow-dirty for a trial build')
        if dirty:
            fail('the source has uncommitted, untracked or ignored files; commit and tag first, '
                 'or pass --allow-dirty for a trial build')
        if not tag:
            fail('HEAD carries no tag with a valid signature (git tag -s, then git verify-tag); '
                 'or pass --allow-dirty for a trial build (SR-10, SR-90)')
    else:
        tag = None                                       # a trial build never claims a tag
    out = os.path.abspath(args.out or os.path.join('dist', f'{args.name}-{args.version}'))
    if os.path.exists(out):
        if not args.force:
            fail(f'{out} exists; pass --force to replace it')
        shutil.rmtree(out)

    data = {p: open(os.path.join(src, p.replace('/', os.sep)), 'rb').read() for p in files}
    for p in files:
        if posixpath.splitext(p)[1].lower() in TEXT_EXT:
            try:
                data[p].decode('utf-8')
            except UnicodeDecodeError:
                fail(f'{p} is not UTF-8')
        if p.endswith('.html'):
            check_html(p, data[p].decode('utf-8'))

    # 1. Hash-rename assets. Non-CSS first, so CSS can refer to them; CSS after its own rewrite.
    rename = {}
    assets = [p for p in files if p.startswith('assets/')]
    for p in [a for a in assets if not a.endswith('.css')] + [a for a in assets if a.endswith('.css')]:
        if p.endswith('.css'):
            text = data[p].decode('utf-8')
            base = posixpath.dirname(p)

            def css_sub(m):
                target = resolve(base, m.group('url'))
                if target in rename:
                    return f"url({m.group('q')}{renamed_url(m.group('url'), rename[target])}{m.group('q')})"
                if target is not None and target not in data:
                    fail(f'{p} refers to a missing file: {m.group("url")}')
                return m.group(0)
            data[p] = RE_CSS_URL.sub(css_sub, text).encode('utf-8')
        stem, ext = posixpath.splitext(p)
        new = f'{stem}.{sha256(data[p])[:12]}{ext}'
        rename[p] = new

    # 2. Rewrite references in HTML; add integrity to stylesheets and scripts.
    out_data = {}
    for p in files:
        if p in rename:
            out_data[rename[p]] = data[p]
    for p in files:
        if p in rename:
            continue
        if not p.endswith('.html'):
            out_data[p] = data[p]
            continue
        text = data[p].decode('utf-8')
        base = posixpath.dirname(p)

        def ref_sub(m):
            target = resolve(base, m.group('url'))
            if target is None:
                return m.group(0)
            if target in rename:
                return f'{m.group("attr")}="{renamed_url(m.group("url"), rename[target])}"'
            if target not in data and posixpath.join(target, 'index.html') not in data \
                    and not (target in ('', '.') and 'index.html' in data):
                fail(f'{p} refers to a missing file: {m.group("url")}')
            return m.group(0)
        text = RE_REF.sub(ref_sub, text)

        def tag_sub(m):
            name, attrs = m.group('name').lower(), m.group('attrs')
            is_css = name == 'link' and re.search(r'\brel\s*=\s*"[^"]*\bstylesheet\b[^"]*"', attrs, re.I)
            if not (is_css or name == 'script'):
                return m.group(0)
            um = re.search(r'\b(?:href|src)\s*=\s*"([^"]*)"', attrs, re.I)
            if not um:
                return m.group(0)
            target = resolve(base, um.group(1))
            if target is None:
                fail(f'{p}: stylesheets and scripts must come from this site (SR-12): {um.group(1)}')
            body = out_data.get(target)
            if body is None:
                fail(f'{p}: missing file {um.group(1)}')
            closing = '/>' if attrs.rstrip().endswith('/') else '>'
            attrs = attrs.rstrip().rstrip('/').rstrip()
            return f'<{m.group("name")}{attrs} integrity="{sri(body)}"{closing}'
        text = RE_TAG.sub(tag_sub, text)
        out_data[p] = text.encode('utf-8')
    check_output(out_data)

    # 3. Write the tree and the manifest.
    for p in sorted(out_data):
        full = os.path.join(out, p.replace('/', os.sep))
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, 'wb') as fh:
            fh.write(out_data[p])
    manifest = {
        'format': 1,
        'name': args.name,
        'version': args.version,
        'source_commit': commit,
        'source_dirty': dirty,
        'source_tag': tag,
        'files': [{'path': p, 'size': len(out_data[p]), 'sha256': sha256(out_data[p])} for p in sorted(out_data)],
    }
    with open(os.path.join(out, MANIFEST), 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(json.dumps(manifest, indent=1, sort_keys=True, ensure_ascii=False) + '\n')
    print(f'built {out}: {len(out_data)} files' + (' (trial build from uncommitted source)' if dirty else ''))


def pack(args):
    d = os.path.abspath(args.dir)
    if not os.path.isfile(os.path.join(d, MANIFEST)):
        fail(f'no {MANIFEST} in {args.dir}')
    if not os.path.isfile(os.path.join(d, SIGNATURE)):
        fail(f'no {SIGNATURE} in {args.dir}; sign the release first (sign-release.sh)')
    manifest = json.load(open(os.path.join(d, MANIFEST), encoding='utf-8'))
    listed = {f['path'] for f in manifest['files']}
    present = set()
    for dirpath, _, filenames in os.walk(d):
        for f in filenames:
            present.add(os.path.relpath(os.path.join(dirpath, f), d).replace(os.sep, '/'))
    extra = present - listed - {MANIFEST, SIGNATURE}
    if extra:
        fail('files not in the manifest: ' + ', '.join(sorted(extra)))
    for f in manifest['files']:
        body = open(os.path.join(d, f['path'].replace('/', os.sep)), 'rb').read()
        if len(body) != f['size'] or sha256(body) != f['sha256']:
            fail(f'{f["path"]} changed after the build')
    target = args.out or (d.rstrip('\\/') + '.tar')
    with tarfile.open(target, 'w', format=tarfile.PAX_FORMAT) as tar:
        for p in sorted(listed | {MANIFEST, SIGNATURE}):
            body = open(os.path.join(d, p.replace('/', os.sep)), 'rb').read()
            info = tarfile.TarInfo(p)
            info.size, info.mode, info.mtime = len(body), 0o644, 0
            info.uid = info.gid = 0
            info.uname = info.gname = 'root'
            tar.addfile(info, io.BytesIO(body))
    print(f'packed {target} (sha256 {sha256(open(target, "rb").read())})')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('build')
    b.add_argument('--src', required=True)
    b.add_argument('--name', required=True)
    b.add_argument('--version', required=True)
    b.add_argument('--out')
    b.add_argument('--force', action='store_true')
    b.add_argument('--allow-dirty', action='store_true', help='trial build from uncommitted source (never for a release)')
    p = sub.add_parser('pack')
    p.add_argument('dir')
    p.add_argument('--out')
    args = ap.parse_args()
    build(args) if args.cmd == 'build' else pack(args)


if __name__ == '__main__':
    main()
