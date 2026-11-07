#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Check the shared test libraries against their `<case>.expected.json` (FDS draft 0.6, section 6).

Run from the repository root:

    python test-libraries/check_test_libraries.py [--format-1-1 PATH/TO/release.py]

This is a second, separate reading of the FDS: it shares no code with `make_test_libraries.py` and
reads only the `.zbl` files. For each case it applies the rules of FDS section 6 as the Editor does
(every finding with its Editor severity) and derives the app's verdict from them (APP-01, the app
severities of section 6), then compares both with the expected result:

- editor: the multiset of (code, severity) must be equal, and `where` must be equal where the
  expected finding gives one;
- app: the verdict, and the set of refusing codes, must be equal.

Signatures are verified with the `cryptography` package when it is installed; otherwise the
checker says so and treats SIG-03 as not checked. With `--format-1-1` it also runs the library
repository's `release.py verify` on every case and checks that the format 1.1 verdict matches and
that every code in `format_1_1.codes` appears in its report.

It implements what these cases need, not a complete Editor: the song rules follow the ChordPro
profile (Zangbundel `design/song-format.md` sections 5 to 7) as far as the cases and the reference
songs exercise them.
"""

import base64
import collections
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))

try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    from cryptography.exceptions import InvalidSignature
    HAVE_CRYPTO = True
except ImportError:  # pragma: no cover
    HAVE_CRYPTO = False

# FDS 3.5
MAX_ZIP = 64 * 1024 * 1024
MAX_TOTAL = 256 * 1024 * 1024
MAX_RATIO = 20
MAX_ENTRIES = 10000
SHARING = 16 * 1024 * 1024
SONG_MAX = 64 * 1024
SONG_RECOMMENDED = 8 * 1024

SONG_ID = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')
UUID4 = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
UTC = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')
HEX64 = re.compile(r'^[0-9a-f]{64}$')
LANGUAGE = re.compile(r'^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{1,8})*$')                # song format 6.2
LABEL_BAD = re.compile('[\u0000-\u001f\u007f-\u009f]')                       # FDS 4.1 tags: one line, no controls
RESERVED = re.compile(r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$', re.IGNORECASE)
LANGUAGE = re.compile(r'^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{1,8})*$')
CHORD = re.compile(r'^[A-G](#|b)?[^/\s\[\]]*(/[A-G](#|b)?)?$')
LICENSE_ID = re.compile(r'^([A-Za-z0-9.+-]+|public-domain|proprietary)$')
IGNORED_NAMES = {'.DS_Store', 'Thumbs.db', 'desktop.ini'}

# FDS severities that differ between Editor and app (section 6): (editor, app); None = not applied.
APP_SEVERITY = {'PKG-09': None, 'SNG-05': None, 'SNG-08': None, 'SNG-12': 'Error',
                'VIEW-01': 'Error', 'VIEW-02': 'Error', 'VIEW-03': 'Error'}

# The ChordPro profile (song format 6.1, 6.2, 7, 10).
SINGLE = {'title', 'language', 'subtitle', 'sorttitle', 'copyright', 'license', 'source', 'melody',
          'variant-group', 'redistribute', 'key', 'capo', 'tempo', 'time', 'duration', 'year', 'id'}
ALIASES = {'t': 'title', 'st': 'subtitle', 'c': 'comment', 'ci': 'comment_italic', 'cb': 'comment_box',
           'sov': 'start_of_verse', 'eov': 'end_of_verse', 'soc': 'start_of_chorus', 'eoc': 'end_of_chorus',
           'sob': 'start_of_bridge', 'eob': 'end_of_bridge', 'sot': 'start_of_tab', 'eot': 'end_of_tab',
           'sog': 'start_of_grid', 'eog': 'end_of_grid', 'ns': 'new_song', 'np': 'new_page'}
METADATA = {'title', 'subtitle', 'sorttitle', 'lyricist', 'composer', 'artist', 'year', 'copyright',
            'key', 'capo', 'tempo', 'time', 'duration'}
LAYOUT = {'new_page', 'column_break', 'columns', 'textfont', 'textsize', 'textcolour', 'chordfont',
          'chordsize', 'chordcolour', 'titles', 'image'}
OTHER = {'meta', 'comment', 'comment_italic', 'comment_box', 'chorus', 'new_song'}
META_NAMES = METADATA | {'album', 'id', 'language', 'license', 'source', 'tag', 'melody', 'variant-group',
                         'redistribute', 'notation'}


class Finding:
    def __init__(self, code, severity, where=None):
        self.code, self.severity, self.where = code, severity, where

    def __repr__(self):
        return '%s/%s%s' % (self.code, self.severity, '@' + self.where if self.where else '')


class Fatal(Exception):
    pass


# ---------------------------------------------------------------------------
# Songs (FDS 6.6)
# ---------------------------------------------------------------------------

def check_song(song_id, data):
    """Findings of one `.cho` file; also returns its title (or None)."""
    out = []
    add = lambda code, sev: out.append(Finding(code, sev, song_id))
    if len(data) > SONG_MAX:
        add('SNG-18', 'Error')
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        add('SNG-01', 'Error')
        return out, None
    if any(ord(ch) < 0x20 and ch not in '\n\r\t' or ord(ch) == 0x7f for ch in text):
        add('SNG-01', 'Error')
        return out, None
    text = unicodedata.normalize('NFC', text.lstrip('﻿')).replace('\r\n', '\n').replace('\r', '\n')
    lines = [l.rstrip(' \t') for l in text.split('\n')]

    meta = collections.defaultdict(list)
    unknown = set()
    malformed = chord_bracket = chord_name = env_error = chorus_early = new_song = False
    env = None
    choruses = 0
    lyric = []
    for raw in lines:
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        starts, ends = line.startswith('{'), line.endswith('}')
        if starts != ends:
            malformed = True
            continue
        if starts:
            body = line[1:-1]
            name, _, value = body.partition(':')
            name, value = name.strip().lower(), value.strip()
            name = ALIASES.get(name, name)
            if name == 'meta':
                mname, _, mvalue = value.partition(' ')
                mname, mvalue = mname.strip().lower(), mvalue.strip()
                if mname not in META_NAMES:
                    unknown.add('meta ' + mname)
                meta[mname].append(mvalue)
            elif name in METADATA:
                meta[name].append(value)
            elif name.startswith('start_of_'):
                if env is not None:
                    env_error = True
                env = name[len('start_of_'):]
            elif name.startswith('end_of_'):
                if env != name[len('end_of_'):]:
                    env_error = True
                if env == 'chorus':
                    choruses += 1
                env = None
            elif name == 'chorus':
                if choruses == 0:
                    chorus_early = True
            elif name == 'new_song':
                new_song = True
            elif name in OTHER or name in LAYOUT:
                pass
            else:
                unknown.add(name)
            continue
        # A content line.
        if env not in (None, 'verse', 'chorus', 'bridge'):
            continue
        depth, display = 0, []
        i = 0
        while i < len(raw):
            ch = raw[i]
            if ch == '\\' and i + 1 < len(raw):
                if depth == 0:
                    display.append(raw[i + 1])
                i += 2
                continue
            if ch == '[':
                j = raw.find(']', i + 1)
                if j < 0 or '[' in raw[i + 1:j]:
                    chord_bracket = True
                    display.append(ch)
                    i += 1
                    continue
                token = raw[i + 1:j]
                if not token.startswith('*') and not CHORD.match(token):
                    chord_name = True
                i = j + 1
                continue
            if ch == ']':
                chord_bracket = True
            display.append(ch)
            i += 1
        shown = ''.join(display).replace('\t', ' ').rstrip()
        if shown:
            lyric.append(shown)
    if env is not None:
        env_error = True

    if malformed:
        add('SNG-04', 'Error')
    title = (meta.get('title') or [''])[0]
    if not title:
        add('SNG-02', 'Error')
    if any(len(v) > 1 for k, v in meta.items() if k in SINGLE):
        add('SNG-03', 'Error')
    if chord_bracket:
        add('SNG-05', 'Warning')
    if env_error:
        add('SNG-06', 'Error')
    if unknown:
        add('SNG-07', 'Info')
    if chord_name:
        add('SNG-08', 'Warning')
    if not lyric:
        add('SNG-09', 'Error')
    language = meta.get('language') or []
    if len(language) != 1 or not LANGUAGE.match(language[0]):
        add('SNG-11', 'Error')
    if meta.get('id') != [song_id]:
        add('SNG-12', 'Info')
    if chorus_early:
        add('SNG-13', 'Error')
    if new_song:
        add('SNG-14', 'Error')
    bad = any(v not in ('yes', 'no') for v in meta.get('redistribute', []))
    bad |= any(not re.match(r'^\d{4}$', v) for v in meta.get('year', []))
    bad |= any(not SONG_ID.match(v) for v in meta.get('variant-group', []) + meta.get('tag', []))
    if bad:
        add('SNG-15', 'Error')
    recommended = (meta.get('lyricist') or meta.get('composer')) and meta.get('copyright') and \
        meta.get('license') and meta.get('source') and meta.get('tag')
    if not recommended or any(not LICENSE_ID.match(v) for v in meta.get('license', [])):
        add('SNG-16', 'Warning')
    if len(title) > 60 or any(len(l) > 120 for l in lyric) or len(lyric) > 254 or len(data) > SONG_RECOMMENDED:
        add('SNG-17', 'Warning')
    return out, title or None


# ---------------------------------------------------------------------------
# The library
# ---------------------------------------------------------------------------

def valid_name(name):
    """PF-20, PF-21, the 100-character part of PF-22."""
    return (name and len(name) <= 100 and not any(c in '<>:"/\\|?*' or ord(c) < 0x20 or ord(c) == 0x7f for c in name)
            and not name.endswith(' ') and not name.endswith('.') and not RESERVED.match(name))


def ignored(path):
    parts = path.split('/')
    return parts[0] == '__MACOSX' or parts[-1] in IGNORED_NAMES


def read_setlist(data):
    """(title, id, entries) of a .zbs view file, or None."""
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        return None
    title = sid = None
    entries = []
    for line in text.split('\n'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        m = re.match(r'^\{title:\s*(.*)\}$', line)
        if m:
            title = m.group(1).strip()
            continue
        m = re.match(r'^\{meta:\s*id\s+(.*)\}$', line)
        if m:
            sid = m.group(1).strip()
            continue
        entries.append(line.split('#')[0].strip())
    return title, sid, entries


def check_view_library(data, app_version=(1, 0, 0)):
    """Song format 4.3, L002 to L006, for the view's zangbundel.json; returns True when it passes."""
    try:
        lib = json.loads(data.decode('utf-8'))
    except (UnicodeDecodeError, ValueError):
        return False
    if not isinstance(lib, dict):
        return False
    for k in ('format', 'format_version', 'id', 'name', 'description', 'min_app_version'):
        if not isinstance(lib.get(k), str):
            return False
    for k in ('maintainer', 'license'):
        if not isinstance(lib.get(k), dict):
            return False
    if not isinstance(lib['maintainer'].get('name'), str) or not (lib['maintainer'].get('email') or lib['maintainer'].get('url')):
        return False
    if not all(isinstance(lib['license'].get(k), str) for k in ('id', 'file', 'summary')):
        return False
    if lib['format'] != 'zangbundel-library':                                  # L003
        return False
    if not re.match(r'^1\.\d+$', lib['format_version']):                       # L004
        return False
    m = re.match(r'^(\d+)\.(\d+)\.(\d+)$', lib['min_app_version'])
    if not m or tuple(int(x) for x in m.groups()) > app_version:                # L005
        return False
    if not SONG_ID.match(lib['id']) or len(lib['id']) > 64:                    # L006
        return False
    return True


def check_manifest(m):
    """Section 4.1 (MAN-02), MAN-07, MAN-08; returns a list of findings."""
    out = []
    def text(o, k, lo, hi, required=True):
        v = o.get(k) if isinstance(o, dict) else None
        if v is None:
            return not required
        return isinstance(v, str) and lo <= len(v) <= hi
    ok = isinstance(m.get('libraryId'), str) and UUID4.match(m['libraryId'])
    ok = ok and isinstance(m.get('version'), int) and not isinstance(m['version'], bool) and m['version'] >= 1
    ok = ok and text(m, 'title', 1, 80) and text(m, 'description', 0, 1000, False) and text(m, 'changes', 0, 500, False)
    ok = ok and all(isinstance(m.get(k), str) and UTC.match(m[k]) for k in ('created', 'modified'))
    ok = ok and isinstance(m.get('sets'), list) and all(
        isinstance(s, dict) and text(s, 'name', 1, 60) and isinstance(s.get('songs'), list)
        and all(isinstance(x, str) and SONG_ID.match(x) and len(x) <= 64 for x in s['songs']) for s in m['sets'])
    if 'tags' in m:                                     # FDS 4.1 (draft 0.10, D-44)
        t = m['tags']
        ok = ok and isinstance(t, dict) and len(t) <= 200 and all(
            isinstance(tag, str) and SONG_ID.match(tag) and len(tag) <= 64 and isinstance(ls, dict) and 1 <= len(ls) <= 20
            and all(isinstance(lang, str) and LANGUAGE.match(lang) and isinstance(lb, str) and 1 <= len(lb) <= 60
                    and not LABEL_BAD.search(lb) and unicodedata.normalize('NFC', lb) == lb for lang, lb in ls.items())
            for tag, ls in t.items())
    if 'author' in m:
        a = m['author']
        ok = ok and isinstance(a, dict) and text(a, 'name', 1, 100) and isinstance(a.get('publicKey'), str) \
            and len(a['publicKey']) == 44
        if ok:
            try:
                ok = len(base64.b64decode(a['publicKey'], validate=True)) == 32
            except ValueError:
                ok = False
    files = m.get('files')
    ok = ok and isinstance(files, list) and all(
        isinstance(f, dict) and isinstance(f.get('path'), str) and isinstance(f.get('size'), int)
        and isinstance(f.get('sha256'), str) and HEX64.match(f['sha256']) for f in files)
    if ok:
        paths = [f['path'] for f in files]
        ok = paths == sorted(paths, key=lambda p: p.encode('utf-8')) and len(set(paths)) == len(paths) \
            and 'manifest.json' not in paths and 'manifest.sig' not in paths
    if not ok:
        out.append(Finding('MAN-02', 'Error'))
    lic = m.get('license')
    if not (isinstance(lic, dict) and text(lic, 'id', 1, 100) and text(lic, 'summary', 1, 200)
            and text(lic, 'text', 0, 32000, False)):
        out.append(Finding('MAN-07', 'Error'))
    mt = m.get('maintainer')
    contact = isinstance(mt, dict) and (
        (isinstance(mt.get('email'), str) and '@' in mt['email']) or
        (isinstance(mt.get('url'), str) and mt['url'].startswith('https://')))
    if not (isinstance(mt, dict) and text(mt, 'name', 1, 100) and contact):
        out.append(Finding('MAN-08', 'Error'))
    return out


def check(path):
    """All Editor findings of one library, in FDS section 6 order. A Fatal finding ends the list."""
    data = open(path, 'rb').read()
    out = []
    try:
        return _check(data, out)
    except Fatal:
        return out


def _check(data, out):
    def fatal(code, where=None):
        out.append(Finding(code, 'Fatal', where))
        raise Fatal()

    # PKG-01
    import io
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
        infos = zf.infolist()
    except (zipfile.BadZipFile, OSError, ValueError):
        fatal('PKG-01')
    # PKG-02, from the central directory before anything is inflated.
    total = sum(i.file_size for i in infos)
    if len(data) > MAX_ZIP or len(infos) > MAX_ENTRIES or total > MAX_TOTAL or total > MAX_RATIO * len(data):
        fatal('PKG-02')
    # PKG-03, PKG-04
    for i in infos:
        name = i.orig_filename
        if name.startswith('/') or re.match(r'^[A-Za-z]:', name) or '\\' in name or '..' in name.split('/'):
            fatal('PKG-03', name)
        if i.create_system == 3 and (i.external_attr >> 16) & 0o170000 == 0o120000:
            fatal('PKG-03', name)
        if i.flag_bits & 0x1:
            fatal('PKG-04', name)
    if len(data) > SHARING:
        out.append(Finding('PKG-09', 'Warning'))

    entries = {i.filename: i for i in infos if not i.is_dir()}
    system = [n for n in entries if ignored(n)]
    if system:
        out.append(Finding('PKG-08', 'Info'))
    names = [n for n in entries if not ignored(n)]

    # PKG-05: exactly one top-level folder; the library folder is the one holding manifest.json.
    tops = sorted({n.split('/')[0] for n in names})
    loose = [n for n in names if '/' not in n]
    top = tops[0] if len(tops) == 1 and not loose else None
    if top is None:
        holders = [t for t in tops if '%s/manifest.json' % t in entries]
        out.append(Finding('PKG-05', 'Error', ', '.join(t for t in tops if t not in holders[:1])))
        top = holders[0] if len(holders) == 1 else None
    if top is None:
        return out
    lib = {n[len(top) + 1:]: entries[n] for n in names if n.startswith(top + '/')}

    # PKG-06, PKG-07
    for n in sorted(names):
        if len(n) > 255 or not all(valid_name(p) for p in n.split('/')):
            bad = [p for p in n.split('/') if not valid_name(p)]
            out.append(Finding('PKG-06', 'Error', bad[0] if bad else n))
            break
    folders = collections.defaultdict(set)
    for n in names:
        parts = n.split('/')
        for d in range(len(parts)):
            folders['/'.join(parts[:d])].add(parts[d])
    for folder, children in sorted(folders.items()):
        by_case = collections.defaultdict(list)
        for c in children:
            by_case[c.lower()].append(c)
        for group in by_case.values():
            if len(group) > 1:
                out.append(Finding('PKG-07', 'Error', ', '.join(sorted(group))))

    read = lambda p: zf.read(lib[p])

    # MAN-01: no manifest. The Editor converts (EDT-21, EDT-26); only the song rules are left.
    if 'manifest.json' not in lib:
        out.append(Finding('MAN-01', 'Info'))
        out.extend(check_songs({p: read(p) for p in lib if p.startswith('songs/')}))
        return out

    manifest_bytes = read('manifest.json')
    try:
        text = manifest_bytes.decode('utf-8')
        manifest = json.loads(text) if not text.startswith('﻿') else None
    except (UnicodeDecodeError, ValueError):
        manifest = None
    if not isinstance(manifest, dict):
        out.append(Finding('MAN-02', 'Error'))
        return out
    fv = manifest.get('formatVersion')
    if isinstance(fv, int) and not isinstance(fv, bool) and fv > 1:
        fatal('MAN-03')
    if fv != 1:
        out.append(Finding('MAN-02', 'Error'))
    out.extend(check_manifest(manifest))

    # STR
    paths = sorted(p for p in lib if p not in ('manifest.json', 'manifest.sig'))
    song_folders = collections.defaultdict(list)
    for p in sorted(lib):
        parts = p.split('/')
        if len(parts) == 1:
            if p not in ('manifest.json', 'manifest.sig', 'zangbundel.json', 'LICENSE'):
                out.append(Finding('STR-01', 'Error', p))
        elif parts[0] == 'setlists':
            pass                                    # VIEW-01 decides which setlists belong
        elif parts[0] == 'songs':
            if len(parts) == 2:
                out.append(Finding('STR-11', 'Error', p))
            else:
                song_folders[parts[1]].append(parts[2:])
        else:
            out.append(Finding('STR-01', 'Error', parts[0]))
    song_files = {}
    for folder, items in sorted(song_folders.items()):
        where = 'songs/' + folder
        if not (SONG_ID.match(folder) and len(folder) <= 64):
            out.append(Finding('STR-10', 'Error', where))
        if any(len(i) > 1 for i in items):
            out.append(Finding('STR-07', 'Error', where))
        files = [i[0] for i in items if len(i) == 1]
        cho = [f for f in files if f.endswith('.cho')]
        if len(cho) > 1:
            out.append(Finding('STR-06', 'Error', where))
        if any(not f.endswith('.cho') for f in files):
            out.append(Finding('STR-08', 'Error', where))
        if folder + '.cho' not in files:
            out.append(Finding('STR-05', 'Error', where))
        else:
            song_files[folder] = read('songs/%s/%s.cho' % (folder, folder))
    if not song_folders:
        out.append(Finding('STR-02', 'Warning'))

    # SIG
    author = manifest.get('author')
    has_key = isinstance(author, dict) and 'publicKey' in author
    if has_key != ('manifest.sig' in lib):
        out.append(Finding('SIG-01', 'Error', 'manifest.sig'))
    elif has_key:
        try:
            sig = json.loads(read('manifest.sig').decode('utf-8'))
            assert isinstance(sig, dict) and sig.get('algorithm') == 'Ed25519'
            raw = base64.b64decode(sig['signature'], validate=True)
            assert len(raw) == 64
        except (AssertionError, ValueError, KeyError, TypeError, UnicodeDecodeError):
            out.append(Finding('SIG-02', 'Error', 'manifest.sig'))
        else:
            try:
                key_bytes = base64.b64decode(author['publicKey'], validate=True)
            except (ValueError, TypeError):
                key_bytes = b''
            # A key that is not the raw 32 bytes already fails MAN-02 (SG-05); SIG-03 is not reached.
            if HAVE_CRYPTO and len(key_bytes) == 32:
                try:
                    Ed25519PublicKey.from_public_bytes(key_bytes).verify(raw, manifest_bytes)
                except (InvalidSignature, ValueError):
                    out.append(Finding('SIG-03', 'Error', 'manifest.sig'))

    # MAN-04 to MAN-06
    listed = {f['path']: f for f in manifest.get('files', []) if isinstance(f, dict) and 'path' in f}
    for p in sorted(listed):
        if p not in lib:
            out.append(Finding('MAN-04', 'Error', p))
    for p in paths:
        if p not in listed:
            out.append(Finding('MAN-05', 'Error', p))
        else:
            b = read(p)
            if len(b) != listed[p].get('size') or hashlib.sha256(b).hexdigest() != listed[p].get('sha256'):
                out.append(Finding('MAN-06', 'Error', p))

    # SET
    sets = [s for s in manifest.get('sets', []) if isinstance(s, dict)]
    seen = set()
    for s in sets:
        songs = s.get('songs', [])
        if any(x not in song_folders for x in songs):
            out.append(Finding('SET-01', 'Error', s.get('name')))
        if str(s.get('name', '')).lower() in seen:            # reported at the later set
            out.append(Finding('SET-02', 'Error', s.get('name')))
        seen.add(str(s.get('name', '')).lower())
        if not songs:
            out.append(Finding('SET-03', 'Warning', s.get('name')))
        if len(set(songs)) != len(songs):
            out.append(Finding('SET-04', 'Warning', s.get('name')))
        if len(songs) > 200:
            out.append(Finding('SET-05', 'Warning', s.get('name')))

    # VIEW
    want = {'zangbundel.json', 'LICENSE'} | {'setlists/set-%d.zbs' % (n + 1) for n in range(len(sets))}
    have = {p for p in lib if p in ('zangbundel.json', 'LICENSE') or p.startswith('setlists/')}
    if want != have:
        out.append(Finding('VIEW-01', 'Info'))
    if 'zangbundel.json' in lib:
        view = read('zangbundel.json')
        if not check_view_library(view):
            out.append(Finding('VIEW-03', 'Info', 'zangbundel.json'))
        try:
            v = json.loads(view.decode('utf-8'))
        except (UnicodeDecodeError, ValueError):
            v = None
        lic = manifest.get('license') if isinstance(manifest.get('license'), dict) else {}
        agrees = isinstance(v, dict) and v.get('id') == manifest.get('libraryId') and v.get('name') == manifest.get('title') \
            and v.get('description') == (manifest.get('description') or manifest.get('title')) \
            and v.get('maintainer') == manifest.get('maintainer') \
            and v.get('license') == {'id': lic.get('id'), 'file': 'LICENSE', 'summary': lic.get('summary')}
        if not agrees:
            out.append(Finding('VIEW-02', 'Info', 'zangbundel.json'))
    if 'LICENSE' in lib:
        lic = manifest.get('license') if isinstance(manifest.get('license'), dict) else {}
        source = lic.get('text') or lic.get('summary')
        if source is None or read('LICENSE') != (source.rstrip('\n') + '\n').encode('utf-8'):
            out.append(Finding('VIEW-02', 'Info', 'LICENSE'))
    for n, s in enumerate(sets, 1):
        p = 'setlists/set-%d.zbs' % n
        if p in lib:
            got = read_setlist(read(p))
            exp = (s.get('name'), 'set-%d' % n, ['%s/%s' % (manifest.get('libraryId'), x) for x in s.get('songs', [])])
            if got != exp:
                out.append(Finding('VIEW-02', 'Info', p))

    # SNG
    out.extend(check_songs({'songs/%s/%s.cho' % (k, k): v for k, v in song_files.items()}))
    return out


def check_songs(files):
    """Song rules over `songs/<id>/<id>.cho` entries (other paths are structure findings, not songs)."""
    out, titles = [], collections.defaultdict(list)
    for p in sorted(files):
        parts = p.split('/')
        if len(parts) != 3 or parts[2] != parts[1] + '.cho':
            continue
        findings, title = check_song(parts[1], files[p])
        out.extend(findings)
        if title:
            titles[title.lower()].append(parts[1])
    for ids in titles.values():
        if len(ids) > 1:
            out.append(Finding('SNG-10', 'Warning', ', '.join(sorted(ids))))
    return out


def app_verdict(findings):
    """APP-01 with the app severities of section 6; MAN-01 means not this format (APP-02)."""
    if any(f.code == 'MAN-01' for f in findings):
        return 'accepted as snapshot', []
    refusing = set()
    for f in findings:
        sev = APP_SEVERITY.get(f.code, f.severity)
        if sev in ('Fatal', 'Error'):
            refusing.add(f.code)
    return ('refused' if refusing else 'accepted'), sorted(refusing)


def compare(name, expected, findings):
    problems = []
    got = collections.Counter((f.code, f.severity) for f in findings)
    want = collections.Counter((e['code'], e['severity']) for e in expected['editor']['codes'])
    if got != want:
        problems.append('editor: got %s, want %s' % (sorted(got.elements()), sorted(want.elements())))
    for e in expected['editor']['codes']:
        if 'where' in e and not any(f.code == e['code'] and f.where == e['where'] for f in findings):
            problems.append('editor: %s where %r not found in %s' % (e['code'], e['where'], findings))
    verdict, codes = app_verdict(findings)
    if verdict != expected['app']['verdict'] or codes != sorted(expected['app']['codes']):
        problems.append('app: got %s %s, want %s %s' % (verdict, codes, expected['app']['verdict'],
                                                         sorted(expected['app']['codes'])))
    return problems


def check_format_1_1(release_py, path, expected):
    r = subprocess.run([sys.executable, release_py, 'verify', '--info', path], capture_output=True, text=True)
    out = r.stdout + r.stderr
    refused = 'Archive refused' in out
    problems = []
    if refused != expected['verdict'].startswith('refused'):
        problems.append('format 1.1: release.py %s, want %s' % ('refused' if refused else 'accepted', expected['verdict']))
    for code in expected['codes']:
        if not re.search(r'\b%s\b' % code, out):
            problems.append('format 1.1: %s not in the release.py report' % code)
    return problems


def main(argv):
    release_py = None
    if '--format-1-1' in argv:
        release_py = argv[argv.index('--format-1-1') + 1]
    if not HAVE_CRYPTO:
        print('note: the cryptography package is not installed; SIG-03 is not checked')
    names = sorted(f[:-4] for f in os.listdir(HERE) if f.endswith('.zbl'))
    failed = 0
    for name in names:
        path = os.path.join(HERE, name + '.zbl')
        with open(os.path.join(HERE, name + '.expected.json'), encoding='utf-8') as fh:
            expected = json.load(fh)
        problems = []
        if hashlib.sha256(open(path, 'rb').read()).hexdigest() != expected['sha256']:
            problems.append('sha256 of the .zbl differs from expected.json')
        findings = check(path)
        problems += compare(name, expected, findings)
        if release_py:
            problems += check_format_1_1(release_py, path, expected['format_1_1'])
        verdict, codes = app_verdict(findings)
        status = 'FAIL' if problems else 'ok'
        print('%-4s %-24s app %-21s %-18s editor %s' % (status, name, verdict, ','.join(codes) or '-',
                                                       ' '.join('%s/%s' % (f.code, f.severity[0]) for f in findings)))
        for p in problems:
            print('       ' + p)
        failed += bool(problems)
    print('%d case(s), %d failed%s' % (len(names), failed,
                                       '' if HAVE_CRYPTO else ' (signatures not verified: no cryptography package)'))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
