#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Build the shared test libraries of FDS open item O-04, in the format of FDS draft 0.6.

Run from the repository root:

    python test-libraries/make_test_libraries.py

It reads the songs under test-libraries/source/songs/ and writes, per case, a library
`test-libraries/<case>.zbl` and its expected result `test-libraries/<case>.expected.json`. The
output is deterministic: running it again gives byte-identical files, so a changed file in git
means a changed case.

The first six cases are the reference library and five invalid variants of it. `rule_cases` adds one
case per rule of FDS section 6, each changing the reference library as little as possible; the
README lists them. `check_test_libraries.py` checks the output independently of this script.

The signed cases are signed with the key of RFC 8032 section 7.1, test 1. That key is public:
anyone can verify the signature, and anyone can sign with it. It exists for tests only and must
never sign a real library. The key file `test-key-rfc8032.zbkey` (FDS 5.3) is written next to the
libraries, so an Editor can be tested with it (EDT-62).

Standard library only, Python 3.8 or newer. Ed25519 is implemented below after the reference code
of RFC 8032 section 6, and checked against the RFC's test vector at every start.
"""

import base64
import copy
import hashlib
import io
import json
import os
import struct
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SONGS = os.path.join(HERE, 'source', 'songs')

# ---------------------------------------------------------------------------
# Ed25519 (RFC 8032 section 6, reference implementation)
# ---------------------------------------------------------------------------

P = 2 ** 255 - 19
Q = 2 ** 252 + 27742317777372353535851937790883648493
D = -121665 * pow(121666, P - 2, P) % P
SQRT_M1 = pow(2, (P - 1) // 4, P)


def _inv(x):
    return pow(x, P - 2, P)


def _add(a, b):
    pa = (a[1] - a[0]) * (b[1] - b[0]) % P
    pb = (a[1] + a[0]) * (b[1] + b[0]) % P
    pc = 2 * a[3] * b[3] * D % P
    pd = 2 * a[2] * b[2] % P
    e, f, g, h = pb - pa, pd - pc, pd + pc, pb + pa
    return (e * f % P, g * h % P, f * g % P, e * h % P)


def _mul(s, point):
    result = (0, 1, 1, 0)
    while s > 0:
        if s & 1:
            result = _add(result, point)
        point = _add(point, point)
        s >>= 1
    return result


def _recover_x(y, sign):
    if y >= P:
        return None
    x2 = (y * y - 1) * _inv(D * y * y + 1)
    if x2 == 0:
        return None if sign else 0
    x = pow(x2, (P + 3) // 8, P)
    if (x * x - x2) % P != 0:
        x = x * SQRT_M1 % P
    if (x * x - x2) % P != 0:
        return None
    if (x & 1) != sign:
        x = P - x
    return x


_GY = 4 * _inv(5) % P
_GX = _recover_x(_GY, 0)
G = (_GX, _GY, 1, _GX * _GY % P)


def _compress(point):
    zinv = _inv(point[2])
    x, y = point[0] * zinv % P, point[1] * zinv % P
    return int.to_bytes(y | ((x & 1) << 255), 32, 'little')


def _expand(seed):
    h = hashlib.sha512(seed).digest()
    a = int.from_bytes(h[:32], 'little')
    a &= (1 << 254) - 8
    a |= 1 << 254
    return a, h[32:]


def _hash_mod_q(data):
    return int.from_bytes(hashlib.sha512(data).digest(), 'little') % Q


def public_key(seed):
    return _compress(_mul(_expand(seed)[0], G))


def sign(seed, message):
    a, prefix = _expand(seed)
    pub = _compress(_mul(a, G))
    r = _hash_mod_q(prefix + message)
    big_r = _compress(_mul(r, G))
    s = (r + _hash_mod_q(big_r + pub + message) * a) % Q
    return big_r + int.to_bytes(s, 32, 'little')


def _selftest():
    """RFC 8032 section 7.1, test 1."""
    seed = bytes.fromhex('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60')
    assert public_key(seed).hex() == 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a'
    assert sign(seed, b'').hex() == (
        'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b')


TEST_SEED = bytes.fromhex('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60')


def fingerprint(pub):
    """FDS SG-20: first 8 bytes of SHA-256 over the raw public key, four groups of four."""
    h = hashlib.sha256(pub).hexdigest().upper()[:16]
    return '-'.join(h[i:i + 4] for i in range(0, 16, 4))


# ---------------------------------------------------------------------------
# The library
# ---------------------------------------------------------------------------

LIBRARY_ID = '6f1d2c3b-4a5e-4f60-8b7c-9d0e1f2a3b4c'
TITLE = 'Zangbundel testbibliotheek'
LICENSE_TEXT = ('This test library is dedicated to the public domain under CC0 1.0 Universal:\n'
                'https://creativecommons.org/publicdomain/zero/1.0/\n')
MANIFEST = {
    'formatVersion': 1,
    'libraryId': LIBRARY_ID,
    'version': 1,
    'title': TITLE,
    'description': 'Testbibliotheek voor de Zangbundel-app en de bibliotheek-manager (FDS O-04). Vier liedjes, twee sets.',
    'created': '2026-11-06T12:00:00Z',
    'modified': '2026-11-06T12:00:00Z',
    'changes': 'Eerste versie van de testbibliotheek.',
    'license': {
        'id': 'CC0-1.0',
        'summary': 'Vrij te gebruiken: gewijd aan het publiek domein (CC0 1.0).',
        'text': LICENSE_TEXT,
    },
    'maintainer': {'name': 'Zangbundel-project', 'url': 'https://github.com/pe1mew/Zangbundel-bibliotheek-manager'},
    'sets': [
        {'name': 'Kampvuur', 'songs': ['vader-jacob', 'vuur-in-de-nacht', 'fire-in-the-night']},
        {'name': 'Demo', 'songs': ['lorem-ipsum']},
    ],
}
SONG_IDS = ['fire-in-the-night', 'lorem-ipsum', 'vader-jacob', 'vuur-in-de-nacht']
ZIP_TIME = (2026, 11, 6, 12, 0, 0)


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def view_files(manifest):
    """The format 1.1 view of FDS 3.7 (PF-41 to PF-43), as {path: bytes}."""
    lib = {
        'format': 'zangbundel-library',
        'format_version': '1.1',
        'id': manifest['libraryId'],
        'name': manifest['title'],
        'description': manifest.get('description') or manifest['title'],
        'maintainer': manifest['maintainer'],
        'license': {'id': manifest['license']['id'], 'file': 'LICENSE', 'summary': manifest['license']['summary']},
        'min_app_version': '0.1.0',
    }
    text = manifest['license'].get('text') or manifest['license']['summary']
    files = {'zangbundel.json': json_bytes(lib), 'LICENSE': (text.rstrip('\n') + '\n').encode('utf-8')}
    for n, s in enumerate(manifest['sets'], 1):
        lines = ['{title: %s}' % s['name'], '{meta: id set-%d}' % n]
        # PF-43 asks for an empty line before the songs and for the canonical form; for an empty set
        # (SET-03) the canonical form drops that line, since it would be a trailing empty line (song format 8.1).
        if s['songs']:
            lines += [''] + ['%s/%s' % (manifest['libraryId'], song) for song in s['songs']]
        files['setlists/set-%d.zbs' % n] = ('\n'.join(lines) + '\n').encode('utf-8')
    return files


def song_files():
    files = {}
    for song in SONG_IDS:
        with open(os.path.join(SONGS, song, song + '.cho'), 'rb') as fh:
            files['songs/%s/%s.cho' % (song, song)] = fh.read()
    return files


def with_files_list(manifest, files):
    m = copy.deepcopy(manifest)
    m['files'] = [{'path': p, 'size': len(b), 'sha256': hashlib.sha256(b).hexdigest()}
                  for p, b in sorted(files.items(), key=lambda kv: kv[0].encode('utf-8'))]
    return m


def signed(manifest, files, seed, name='RFC 8032 test key (not for real use)'):
    """Add `author`, list the files, sign the exact manifest bytes (SG-02). Returns (manifest bytes, sig bytes)."""
    m = copy.deepcopy(manifest)
    m['author'] = {'name': name, 'publicKey': base64.b64encode(public_key(seed)).decode('ascii')}
    m = with_files_list(m, files)
    data = json_bytes(m)
    sig = json_bytes({'algorithm': 'Ed25519', 'signature': base64.b64encode(sign(seed, data)).decode('ascii')})
    return data, sig


def zip_bytes(files, top=TITLE, outside=None, symlinks=(), encrypted=()):
    """One top-level folder named after the title (EDT-55); sorted, fixed time, deterministic.

    The options exist for the package-rule cases only; without them the bytes are those of the first six cases.
    `top`: the library folder's name. `outside`: {full entry name: bytes}, written after the library folder,
    as stored (no folder prefix). `symlinks`: paths in `files` stored as symbolic links (Unix mode 120777) whose
    target is the entry's data. `encrypted`: paths in `files` whose general-purpose flag bit 0 (encrypted) is
    set in the local and central headers; the data itself is not encrypted (PKG-04 looks at the flag).
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        def add(full, data, mode):
            info = zipfile.ZipInfo(full, date_time=ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = mode << 16
            zf.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        for name in sorted(files, key=lambda n: (n not in ('manifest.json', 'manifest.sig'), n.encode('utf-8'))):
            add('%s/%s' % (top, name), files[name], 0o120777 if name in symlinks else 0o100644)
        for full in sorted(outside or {}, key=lambda n: n.encode('utf-8')):
            add(full, outside[full], 0o100644)
    data = bytearray(buf.getvalue())
    for name in encrypted:
        _set_encrypted_flag(data, '%s/%s' % (top, name))
    return bytes(data)


def _set_encrypted_flag(data, full):
    """Set flag bit 0 of entry `full` in its local header and its central directory record."""
    eocd = data.rindex(b'PK\x05\x06')
    count, cd_size, cd_offset = struct.unpack('<HII', data[eocd + 10:eocd + 20])
    pos, found = cd_offset, False
    for _ in range(count):
        assert data[pos:pos + 4] == b'PK\x01\x02'
        name_len, extra_len, comment_len = struct.unpack('<HHH', data[pos + 28:pos + 34])
        local = struct.unpack('<I', data[pos + 42:pos + 46])[0]
        if data[pos + 46:pos + 46 + name_len].decode('utf-8') == full:
            data[pos + 8] |= 0x01
            assert data[local:local + 4] == b'PK\x03\x04'
            data[local + 6] |= 0x01
            found = True
        pos += 46 + name_len + extra_len + comment_len
    assert found, full


def write_zip(path, files, **options):
    """Write the library ZIP (see zip_bytes), or `raw` bytes as given; returns the SHA-256 of the file."""
    data = options.pop('raw', None) or zip_bytes(files, **options)
    with open(path, 'wb') as fh:
        fh.write(data)
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# The cases
# ---------------------------------------------------------------------------

EXPECTED_WARNINGS = [{'code': 'SNG-16', 'severity': 'Warning', 'where': 'vader-jacob'},
                     {'code': 'SNG-07', 'severity': 'Info', 'where': 'fire-in-the-night'}]


def build_cases():
    songs = song_files()
    base = dict(songs, **view_files(MANIFEST))
    cases = {}

    # 1. valid-signed: the reference library.
    data, sig = signed(MANIFEST, base, TEST_SEED)
    cases['valid-signed'] = (dict(base, **{'manifest.json': data, 'manifest.sig': sig}), {
        'description': 'A valid library with a 1.1 view, signed with the RFC 8032 test key.',
        'app': {'verdict': 'accepted', 'codes': [], 'signed': True,
                'fingerprint': fingerprint(public_key(TEST_SEED)), 'song_format_warnings': []},
        'editor': {'codes': EXPECTED_WARNINGS},
        'format_1_1': {'verdict': 'accepted as snapshot', 'codes': ['A102']},
    })

    # 2. valid-unsigned: the same content without author and signature.
    unsigned = json_bytes(with_files_list(MANIFEST, base))
    cases['valid-unsigned'] = (dict(base, **{'manifest.json': unsigned}), {
        'description': 'The same library, not signed: accepted, with the song format warning W013 (APP-22).',
        'app': {'verdict': 'accepted', 'codes': [], 'signed': False, 'song_format_warnings': ['W013']},
        'editor': {'codes': EXPECTED_WARNINGS},
        'format_1_1': {'verdict': 'accepted as snapshot', 'codes': ['A102']},
    })

    # 3. view-missing (VIEW-01): set-2.zbs left out, consistently in the files list.
    files = {k: v for k, v in base.items() if k != 'setlists/set-2.zbs'}
    cases['view-missing'] = (dict(files, **{'manifest.json': json_bytes(with_files_list(MANIFEST, files))}), {
        'description': 'The view lacks setlists/set-2.zbs; manifest and files agree, so only VIEW-01 fails.',
        'app': {'verdict': 'refused', 'codes': ['VIEW-01']},
        'editor': {'codes': [{'code': 'VIEW-01', 'severity': 'Info'}] + EXPECTED_WARNINGS},
        'format_1_1': {'verdict': 'accepted as snapshot', 'codes': ['A102'],
                       'note': 'An older app imports it, with one setlist fewer.'},
    })

    # 4. view-mismatch (VIEW-02): LICENSE altered and its hash updated, manifest licence unchanged.
    files = dict(base, LICENSE=b'All rights reserved. This text was changed after saving.\n')
    cases['view-mismatch'] = (dict(files, **{'manifest.json': json_bytes(with_files_list(MANIFEST, files))}), {
        'description': 'LICENSE no longer matches license.text; the files list was updated, so only VIEW-02 fails.',
        'app': {'verdict': 'refused', 'codes': ['VIEW-02']},
        'editor': {'codes': [{'code': 'VIEW-02', 'severity': 'Info'}] + EXPECTED_WARNINGS},
        'format_1_1': {'verdict': 'accepted as snapshot', 'codes': ['A102'],
                       'note': 'An older app shows the altered licence: FDS limitation 9.'},
    })

    # 5. signature-invalid (SIG-03): a song changed after signing, its hash updated in the signed manifest.
    files = dict(base)
    files['songs/lorem-ipsum/lorem-ipsum.cho'] = base['songs/lorem-ipsum/lorem-ipsum.cho'].replace(
        b'Dolor sit, dolor sit,', b'Dolor sat, dolor sat,')
    data, sig = signed(MANIFEST, base, TEST_SEED)
    tampered = json.loads(data)
    tampered['files'] = with_files_list({}, files)['files']
    cases['signature-invalid'] = (dict(files, **{'manifest.json': json_bytes(tampered), 'manifest.sig': sig}), {
        'description': 'A song was changed after signing and its hash updated in the manifest; the signature no longer matches.',
        'app': {'verdict': 'refused', 'codes': ['SIG-03']},
        'editor': {'codes': [{'code': 'SIG-03', 'severity': 'Error'}] + EXPECTED_WARNINGS,
                   'note': 'Opens read-only (EDT-23).'},
        'format_1_1': {'verdict': 'accepted as snapshot', 'codes': ['A102'],
                       'note': 'An older app cannot see the change: FDS limitation 9.'},
    })

    # 6. key-wrapped (SG-05): the public key in X.509 SubjectPublicKeyInfo form, as openssl writes it.
    data, sig = signed(MANIFEST, base, TEST_SEED)
    wrapped = json.loads(data)
    spki = bytes.fromhex('302a300506032b6570032100') + public_key(TEST_SEED)
    wrapped['author']['publicKey'] = base64.b64encode(spki).decode('ascii')
    wrapped_bytes = json_bytes(wrapped)
    wrapped_sig = json_bytes({'algorithm': 'Ed25519', 'signature': base64.b64encode(sign(TEST_SEED, wrapped_bytes)).decode('ascii')})
    cases['key-wrapped'] = (dict(base, **{'manifest.json': wrapped_bytes, 'manifest.sig': wrapped_sig}), {
        'description': 'author.publicKey is the SubjectPublicKeyInfo form (60 base64 characters) instead of the raw 32 bytes (SG-05).',
        'app': {'verdict': 'refused', 'codes': ['MAN-02'],
                'note': 'The manifest does not match 4.1. The wrapped key would give fingerprint %s instead of %s.'
                        % (fingerprint(spki), fingerprint(public_key(TEST_SEED)))},
        'editor': {'codes': [{'code': 'MAN-02', 'severity': 'Error'}] + EXPECTED_WARNINGS},
        'format_1_1': {'verdict': 'accepted as snapshot', 'codes': ['A102']},
    })
    cases.update(rule_cases(base))
    return cases


# ---------------------------------------------------------------------------
# One case per rule of FDS section 6 (draft 0.6)
# ---------------------------------------------------------------------------

LOREM = 'songs/lorem-ipsum/lorem-ipsum.cho'

# A song written for these tests (CC0), for the cases that need a song that is in no set.
TESTLIED = '\n'.join([
    '# Testlied - geschreven voor de testbibliotheken van de bibliotheek-manager (FDS O-04), CC0.',
    '{title: Testlied}',
    '{meta: id testlied}',
    '{meta: language nl}',
    '{lyricist: Zangbundel-project}',
    '{composer: Zangbundel-project}',
    '{copyright: 2026 Zangbundel-project}',
    '{meta: license CC0-1.0}',
    '{meta: source Geschreven voor de testbibliotheken van de bibliotheek-manager}',
    '{meta: tag test}',
    '',
    'Dit lied is geschreven voor de test,',
    'het zingt niet mooi, maar het doet zijn best.',
    '']).encode('utf-8')


def numbered_song(n):
    """Song n of the SET-05 case: valid, every recommended field, a title of its own (CC0, written for the test)."""
    return '\n'.join([
        '{title: Testlied %03d}' % n,
        '{meta: id testlied-%03d}' % n,
        '{meta: language nl}',
        '{lyricist: Zangbundel-project}',
        '{copyright: 2026 Zangbundel-project}',
        '{meta: license CC0-1.0}',
        '{meta: source Geschreven voor de testbibliotheken van de bibliotheek-manager}',
        '{meta: tag test}',
        '',
        'Dit is testlied nummer %d,' % n,
        'geschreven voor de test.',
        '']).encode('utf-8')


def replace_once(data, old, new):
    assert data.count(old) >= 1, old
    return data.replace(old, new, 1)


def padded(data, size):
    """`data` with comment lines appended until it is exactly `size` bytes (comments are not lyrics, song format 5.2)."""
    line = b'# opvulling' + b'.' * 52 + b'\n'          # 64 bytes
    need = size - len(data)
    assert need >= 2
    out = data + line * ((need - 2) // 64)
    rest = size - len(out)
    if rest:
        out += b'#' + b'.' * (rest - 2) + b'\n' if rest >= 2 else b''
    assert len(out) == size, (len(out), size)
    return out


def ratio(zip_data):
    """Uncompressed total over the ZIP file size (FDS 3.5) and over the compressed total (song format 12.2)."""
    infos = zipfile.ZipFile(io.BytesIO(zip_data)).infolist()
    total = sum(i.file_size for i in infos)
    return total / len(zip_data), total / sum(i.compress_size for i in infos)


def unsigned(files, manifest=MANIFEST):
    """`files` with an unsigned manifest that lists them all."""
    return dict(files, **{'manifest.json': json_bytes(with_files_list(manifest, files))})


def finding(code, severity, where=None):
    f = {'code': code, 'severity': severity}
    if where is not None:
        f['where'] = where
    return f


APP_ACCEPTED = {'verdict': 'accepted', 'codes': [], 'signed': False, 'song_format_warnings': ['W013']}
F11_SNAPSHOT = {'verdict': 'accepted as snapshot', 'codes': ['A102']}


def expect(description, app_codes, editor, format_1_1=None, app_note=None, editor_note=None):
    """An expected result; `app_codes` None means accepted (unsigned, W013); `editor` excludes the shared two."""
    app = dict(APP_ACCEPTED) if app_codes is None else {'verdict': 'refused', 'codes': app_codes}
    if app_note:
        app['note'] = app_note
    ed = {'codes': editor}
    if editor_note:
        ed['note'] = editor_note
    return {'description': description, 'app': app, 'editor': ed, 'format_1_1': format_1_1 or F11_SNAPSHOT}


def f11(verdict, codes, note=None):
    out = {'verdict': verdict, 'codes': codes}
    if note:
        out['note'] = note
    return out


def rule_cases(base):
    cases = {}
    lorem = base[LOREM]
    plain = unsigned(base)                                  # valid-unsigned, as a dict of files
    shared = EXPECTED_WARNINGS
    fatal_note = 'Fatal: the Editor does not open the library, so no other rule is applied (EDT-20).'

    def song_case(name, new_song, rule, severity, description, app_codes, format_1_1, extra=(), app_note=None):
        files = dict(base, **{LOREM: new_song})
        cases[name] = (unsigned(files), expect(
            description, app_codes, [finding(rule, severity, 'lorem-ipsum')] + list(extra) + shared, format_1_1,
            app_note=app_note))

    # ---- PKG: the container (FDS 6.2) ----

    data = zip_bytes(plain)[:4096]
    assert b'PK\x05\x06' not in data and b'PK\x01\x02' not in data
    cases['zip-truncated'] = ({}, expect(
        'The reference library (unsigned) cut off after 4096 bytes, as by a broken download: no central '
        'directory, so it is not a readable ZIP.',
        ['PKG-01'], [finding('PKG-01', 'Fatal')], f11('refused', ['A001']), editor_note=fatal_note), {'raw': data})

    files = dict(base)
    for song in SONG_IDS:
        path = 'songs/%s/%s.cho' % (song, song)
        files[path] = padded(base[path], 60 * 1024)
    data = zip_bytes(unsigned(files))
    by_file, by_compressed = ratio(data)
    assert by_file > 20 and by_compressed > 20, (by_file, by_compressed)
    cases['zip-ratio'] = (unsigned(files), expect(
        'Every song padded with comment lines to 60 KiB, the manifest listing the padded files: the uncompressed '
        'total is %.0f times the ZIP file size, above the 20 times of FDS 3.5 (a zip-bomb guard). The songs '
        'stay under 64 KiB, so only the ratio fails; were it not Fatal, each song would also give SNG-17 '
        '(larger than 8 KiB).' % by_file,
        ['PKG-02'], [finding('PKG-02', 'Fatal')], f11('refused', ['A003']), editor_note=fatal_note))

    outside = {'%s/../../buiten.txt' % TITLE: b'Dit bestand zou buiten de uitpakmap terechtkomen.\n'}
    cases['path-traversal'] = (plain, expect(
        'The reference library (unsigned) plus an entry "%s/../../buiten.txt", whose ".." segments lead out of '
        'the folder it is unpacked into ("zip slip").' % TITLE,
        ['PKG-03'], [finding('PKG-03', 'Fatal', '%s/../../buiten.txt' % TITLE)], f11('refused', ['A006']),
        editor_note=fatal_note), {'outside': outside})

    files = dict(plain, LICENSE=b'/etc/passwd')
    cases['symlink'] = (files, expect(
        'LICENSE is stored as a symbolic link (Unix mode 120777) to /etc/passwd; the manifest is that of the '
        'reference library (unsigned).',
        ['PKG-03'], [finding('PKG-03', 'Fatal', '%s/LICENSE' % TITLE)], f11('refused', ['A005']),
        editor_note=fatal_note), {'symlinks': ('LICENSE',)})

    cases['entry-encrypted'] = (plain, expect(
        'The reference library (unsigned) with the "encrypted" flag (general-purpose bit 0) set on %s in the '
        'local and central headers. The data is not actually encrypted: the flag is what the rule looks at.' % LOREM,
        ['PKG-04'], [finding('PKG-04', 'Fatal', '%s/%s' % (TITLE, LOREM))], f11('refused', ['A004']),
        editor_note=fatal_note), {'encrypted': (LOREM,)})

    cases['two-top-folders'] = (plain, expect(
        'The reference library (unsigned) plus a second top-level folder "extra/" holding one file, as when '
        'two folders are compressed together.',
        ['PKG-05'], [finding('PKG-05', 'Error', 'extra')] + shared, f11('refused', ['A001']),
        app_note='APP-02 recognises this format by manifest.json in the single top-level folder, which this ZIP '
                 'does not have; an app that recognises the format before applying section 6 answers M-20 '
                 '(not a song library) instead of M-05. Either way the import is refused.',
        editor_note='The Editor takes the folder that holds manifest.json as the library folder; the rest of the '
                    'library is the valid reference.'), {'outside': {'extra/notities.txt': b'Notities.\n'}})

    cases['name-reserved'] = (plain, expect(
        'The library folder is named "AUX", a Windows reserved name (PF-21). Its name has no meaning (PF-02), '
        'so the library is otherwise the reference library (unsigned).',
        ['PKG-06'], [finding('PKG-06', 'Error', 'AUX')] + shared,
        f11('accepted as snapshot', ['A102'], 'Song format 12.2 has no rule on reserved names.')), {'top': 'AUX'})

    files = dict(base, License=base['LICENSE'])
    cases['names-case'] = (unsigned(files), expect(
        'A file "License" next to "LICENSE" in the library folder, listed in the manifest. The names differ only '
        'in case (PKG-07); "License" is also not a file the library folder may hold (STR-01), which cannot be '
        'avoided: every second name in a folder is a file the format does not have.',
        ['PKG-07', 'STR-01'],
        [finding('PKG-07', 'Error', 'LICENSE, License'), finding('STR-01', 'Error', 'License')] + shared,
        f11('refused', ['A006']),
        app_note='An app that stops at the first refusing rule reports PKG-07, which its ZIP reader finds first.'))

    files = dict(plain, **{'.DS_Store': b'\x00\x00\x00\x01Bud1', 'songs/lorem-ipsum/Thumbs.db': b'\xd0\xcf\x11\xe0'})
    cases['system-files'] = (files, expect(
        'The reference library (unsigned) plus ".DS_Store" in the library folder and "Thumbs.db" in a song '
        'folder, not listed in the manifest (PF-31). They are ignored: no STR-01, STR-08 or MAN-05.',
        None, [finding('PKG-08', 'Info')] + shared, editor_note='M-40 with {count} 2; the Editor removes them (PF-30).'))

    # PKG-09 (16 MiB sharing threshold) is not covered: the case would be a ZIP of more than 16 MiB (README).

    # ---- STR: the folder structure (FDS 6.3) ----

    def extra_file(name, path, data, rule, where, description, format_1_1=None):
        files = dict(base, **{path: data})
        cases[name] = (unsigned(files), expect(description, [rule], [finding(rule, 'Error', where)] + shared, format_1_1))

    extra_file('stray-file', 'README.txt', b'Notities van de leiding.\n', 'STR-01', 'README.txt',
               'A file README.txt in the library folder, listed in the manifest (so MAN-05 holds).')

    files = view_files(dict(MANIFEST, sets=[]))
    cases['no-songs'] = (unsigned(files, dict(MANIFEST, sets=[])), expect(
        'No songs and no sets; the view and the manifest agree. The shared findings are absent, since there are '
        'no songs.',
        None, [finding('STR-02', 'Warning')],
        f11('refused', ['L008'], 'A snapshot without songs is refused, unless the user confirms an empty library '
                                 '(song format 11.3, L008).')))

    files = {k: v for k, v in base.items() if k != LOREM}
    files['songs/lorem-ipsum/lorem-ipsm.cho'] = lorem
    cases['song-file-misnamed'] = (unsigned(files), expect(
        'The song file of lorem-ipsum is named "lorem-ipsm.cho". The song ID is the folder name (section 1.3), '
        'so the set Demo still names a song of the library (SET-01 holds); the song rules apply to '
        '<song id>.cho only, so the misnamed file gives no song finding.',
        ['STR-05'], [finding('STR-05', 'Error', 'songs/lorem-ipsum')] + shared,
        f11('accepted as snapshot', ['A102', 'S004', 'SL101'], 'The song is skipped: its id differs from its file name.')))

    extra_file('song-two-files', 'songs/lorem-ipsum/lorem-ipsum-oud.cho', lorem, 'STR-06', 'songs/lorem-ipsum',
               'A second .cho file, "lorem-ipsum-oud.cho" (a copy of the song), in the folder of lorem-ipsum, listed '
               'in the manifest. STR-06, not STR-08: STR-08 is about files that are not song files (M-17).',
               f11('accepted as snapshot', ['A102', 'S004'],
                   "The copy's id differs from its file name (S004), so the copy is skipped; a skipped file takes no "
                   "part in the duplicate-id check (song format v0.23, 11.3 S005), so lorem-ipsum.cho itself imports "
                   "and its setlist entry is found."))

    extra_file('song-subfolder', 'songs/lorem-ipsum/oud/lorem-ipsum.cho', lorem, 'STR-07', 'songs/lorem-ipsum',
               'A subfolder "oud/" with a copy of the song in the folder of lorem-ipsum, listed in the manifest.',
               f11('accepted as snapshot', ['A102', 'S005'], 'The two files share an id; the first in path order '
                                                             'is imported.'))

    extra_file('song-extra-file', 'songs/lorem-ipsum/notities.txt', b'Akkoorden nog nakijken.\n', 'STR-08',
               'songs/lorem-ipsum', 'A file "notities.txt" in the folder of lorem-ipsum, listed in the manifest.')

    files = dict(base, **{'songs/Testlied/Testlied.cho': TESTLIED})
    cases['song-folder-invalid'] = (unsigned(files), expect(
        'An extra song, in no set, in the folder "Testlied": upper case is not valid in a song ID (STR-10). Its '
        '{meta: id} is the valid "testlied", which then differs from the folder name (SNG-12). A second '
        'finding cannot be avoided: the song ID is also the file name and the {meta: id} (PF-14), and an '
        '{meta: id} equal to the invalid folder name would fail the profile\'s id syntax (S003) instead.',
        ['STR-10', 'SNG-12'], [finding('STR-10', 'Error', 'songs/Testlied'), finding('SNG-12', 'Info', 'Testlied')]
        + shared, f11('accepted as snapshot', ['A102', 'S004'], 'The extra song is skipped.'),
        app_note='SNG-12 is an Error in the app. An app that stops at the first refusing rule reports STR-10.'))

    extra_file('songs-stray-file', 'songs/LEESMIJ.txt', b'Een map per lied.\n', 'STR-11', 'songs/LEESMIJ.txt',
               'A file "LEESMIJ.txt" directly in songs/, listed in the manifest.')

    # ---- MAN: the manifest (FDS 6.4) ----

    cases['manifest-missing'] = (dict(base), {
        'description': 'The reference library without manifest.json: the view (zangbundel.json, LICENSE, '
                       'setlists/) and the songs only, which is a repository snapshot (song format 12.5).',
        'app': {'verdict': 'accepted as snapshot', 'codes': [], 'signed': False,
                'song_format_warnings': ['A102', 'W002', 'W013'],
                'note': 'Not this format (MAN-01, APP-02): imported as a repository snapshot under song format 12, '
                        'song by song. Its id is the libraryId of the reference library, so on a device that knows '
                        'that library it is an unsigned copy (APP-06): M-71 or M-72 is asked. W002 is for '
                        'vader-jacob.'},
        'editor': {'codes': [finding('MAN-01', 'Info')] + shared,
                   'note': 'Opened as a new library (EDT-21, EDT-26): a new libraryId, the songs and both sets '
                           'taken over from the snapshot, M-41.'},
        'format_1_1': F11_SNAPSHOT,
    })

    m = dict(MANIFEST, created='2026-11-06T13:00:00+01:00')
    cases['manifest-invalid'] = (unsigned(base, m), expect(
        '"created" is "2026-11-06T13:00:00+01:00": ISO 8601, but not the UTC form YYYY-MM-DDThh:mm:ssZ that '
        'section 4.1 requires. The manifest is valid JSON; nothing else differs.',
        ['MAN-02'], [finding('MAN-02', 'Error')] + shared))

    m = dict(MANIFEST, formatVersion=2)
    cases['format-unsupported'] = (unsigned(base, m), expect(
        '"formatVersion" is 2, a version no application supports yet. MAN-03 is Fatal, so nothing else is checked.',
        ['MAN-03'], [finding('MAN-03', 'Fatal')],
        f11('accepted as snapshot', ['A102'], 'An app before this format reads the view only and never sees '
                                              'formatVersion.'), editor_note=fatal_note))

    listed = with_files_list(MANIFEST, dict(base, **{'songs/testlied/testlied.cho': TESTLIED}))
    cases['file-missing'] = (dict(base, **{'manifest.json': json_bytes(listed)}), expect(
        'The files list names "songs/testlied/testlied.cho", which the ZIP does not hold: as if a song in no set '
        'was deleted from the ZIP by hand.',
        ['MAN-04'], [finding('MAN-04', 'Error', 'songs/testlied/testlied.cho')] + shared))

    files = dict(plain, **{'songs/testlied/testlied.cho': TESTLIED})
    cases['file-unlisted'] = (files, expect(
        'A valid song "testlied", in no set, added to the ZIP but not to the manifest\'s files list.',
        ['MAN-05'], [finding('MAN-05', 'Error', 'songs/testlied/testlied.cho')] + shared,
        f11('accepted as snapshot', ['A102'], 'An older app imports the added song.')))

    files = dict(plain)
    files[LOREM] = replace_once(lorem, b'Dolor sit, dolor sit,', b'Dolor sat, dolor sat,')
    cases['file-changed'] = (files, expect(
        'A line of lorem-ipsum changed after saving ("sit" to "sat", same size); the manifest is unchanged, so '
        'the hash differs.',
        ['MAN-06'], [finding('MAN-06', 'Error', LOREM)] + shared,
        f11('accepted as snapshot', ['A102'], 'An older app cannot see the change: FDS limitation 9.')))

    m = {k: v for k, v in MANIFEST.items() if k != 'license'}
    cases['license-missing'] = (unsigned(base, m), expect(
        '"license" removed from the manifest, the view left as it was. The view then no longer agrees with the '
        'manifest (VIEW-02, once for zangbundel.json and once for LICENSE, one M-37 per file): no view can, since '
        'PF-41 and PF-42 copy the licence from the manifest.',
        ['MAN-07', 'VIEW-02'], [finding('MAN-07', 'Error'), finding('VIEW-02', 'Info', 'zangbundel.json'),
                                finding('VIEW-02', 'Info', 'LICENSE')] + shared,
        f11('accepted as snapshot', ['A102'], 'An older app shows the licence of the view.'),
        app_note='The FDS makes MAN-07 "part of MAN-02" in the app; this case expects the app to name MAN-07, as it '
                 'names MAN-08 (M-75). An app that stops at the first refusing rule reports MAN-07.'))

    m = copy.deepcopy(MANIFEST)
    m['maintainer']['url'] = 'http://github.com/pe1mew/Zangbundel-bibliotheek-manager'
    cases['maintainer-no-contact'] = (unsigned(dict(base, **view_files(m)), m), expect(
        'The maintainer\'s only contact is an http: URL; section 4.1 asks for an e-mail address or an https: URL. '
        'The view was written from this manifest, so it agrees (VIEW-02 holds).',
        ['MAN-08'], [finding('MAN-08', 'Error')] + shared,
        f11('accepted as snapshot', ['A102'], 'Song format 4.2 does not require https: for the maintainer URL.'),
        app_note='Shown with M-75 (D-42).'))

    # ---- SIG: the signature (FDS 6.5), based on valid-signed ----

    data, sig = signed(MANIFEST, base, TEST_SEED)
    cases['signature-missing'] = (dict(base, **{'manifest.json': data}), expect(
        'The signed reference library without manifest.sig: author.publicKey is present, the signature is not.',
        ['SIG-01'], [finding('SIG-01', 'Error', 'manifest.sig')] + shared))

    cases['signature-orphan'] = (dict(plain, **{'manifest.sig': sig}), expect(
        'The unsigned reference library plus the manifest.sig of the signed one: a signature without '
        'author.publicKey.',
        ['SIG-01'], [finding('SIG-01', 'Error', 'manifest.sig')] + shared))

    other = json_bytes(dict(json.loads(sig), algorithm='Ed448'))
    cases['signature-algorithm'] = (dict(base, **{'manifest.json': data, 'manifest.sig': other}), expect(
        'The signed reference library with "algorithm" "Ed448" in manifest.sig; the signature bytes are the valid '
        'Ed25519 ones. SIG-03 is not reached: the algorithm is not supported.',
        ['SIG-02'], [finding('SIG-02', 'Error', 'manifest.sig')] + shared))

    # ---- SNG: the songs (FDS 6.6); only lorem-ipsum changes, its hash updated in the manifest ----

    skipped = lambda code, why: f11('accepted as snapshot', ['A102', code, 'SL101'],
                                   'The song is skipped (%s); its entry in setlists/set-2.zbs is not found.' % why)

    song_case('song-not-utf8', replace_once(lorem, 'Frère'.encode('utf-8'), b'Fr\xe8re'), 'SNG-01', 'Error',
              'A comment line of lorem-ipsum holds "Fr\\xe8re", Latin-1 for "Frère": invalid UTF-8.',
              ['SNG-01'], skipped('S001', 'not valid UTF-8'))
    song_case('song-no-title', replace_once(lorem, b'{title: Lorem Ipsum!}\n', b''), 'SNG-02', 'Error',
              'The {title} line of lorem-ipsum removed; its {sorttitle} stays.',
              ['SNG-02'], skipped('S003', 'no title'))
    song_case('song-directive-twice', replace_once(lorem, b'{key: F}\n', b'{key: F}\n{key: G}\n'), 'SNG-03', 'Error',
              'lorem-ipsum has {key: F} and {key: G}; key is single-valued.',
              ['SNG-03'], skipped('S006', 'key twice'))
    song_case('song-directive-malformed', replace_once(lorem, b'[F]amet consec[C]tetur,\n',
                                                       b'[F]amet consec[C]tetur,\n{comment: zachter\n'),
              'SNG-04', 'Error', 'A line "{comment: zachter" without its closing brace in the first verse of lorem-ipsum.',
              ['SNG-04'], skipped('S011', 'malformed directive'))
    song_case('song-chord-bracket', replace_once(lorem, b'[F]amet consec[C]tetur,', b'[F]amet consec[Ctetur,'),
              'SNG-05', 'Warning', 'A chord in lorem-ipsum lacks its closing bracket: "[F]amet consec[Ctetur,". '
              'Editor only (the profile treats chords as opaque), so the app accepts it.', None, F11_SNAPSHOT)
    head, sep, _ = lorem.rpartition(b'{end_of_verse}\n')
    assert sep and not _
    song_case('song-environment-open', head, 'SNG-06', 'Error',
              'The last {end_of_verse} of lorem-ipsum removed: the verse is still open at the end of the file.',
              ['SNG-06'], skipped('S007', 'environment not closed'))
    song_case('song-chord-unknown', replace_once(lorem, b'[F]Lorem ipsum,', b'[H]Lorem ipsum,'), 'SNG-08', 'Warning',
              'The chord [H] (the German name of B) in lorem-ipsum: not a recognisable chord name. Editor only, '
              'so the app accepts it.', None, F11_SNAPSHOT)
    body = lorem.index(b'{duration: 1:12}\n') + len(b'{duration: 1:12}\n')
    song_case('song-no-lyrics', lorem[:body], 'SNG-09', 'Error',
              'lorem-ipsum with its comments and metadata only: the whole body after {duration} removed.',
              ['SNG-09'], skipped('S010', 'no lyric lines'))
    song_case('song-title-duplicate', replace_once(lorem, b'{title: Lorem Ipsum!}', b'{title: vader jacob}'),
              'SNG-10', 'Warning', 'lorem-ipsum is titled "vader jacob", the title of vader-jacob in other case: '
              'the rule compares case-insensitively.', None,
              f11('accepted as snapshot', ['A102'], 'Song format section 11 has no rule on titles that repeat.'))
    cases['song-title-duplicate'][1]['editor']['codes'][0]['where'] = 'lorem-ipsum, vader-jacob'
    song_case('song-no-language', replace_once(lorem, b'{meta: language la}\n', b''), 'SNG-11', 'Error',
              'The {meta: language} line of lorem-ipsum removed.', ['SNG-11'], skipped('S003', 'no language'))
    song_case('song-id-differs', replace_once(lorem, b'{meta: id lorem-ipsum}', b'{meta: id lorem-ipsum-oud}'),
              'SNG-12', 'Info', 'The {meta: id} of lorem-ipsum is "lorem-ipsum-oud", not its folder name. Info in '
              'the Editor (corrected on save, EDT-36), an Error in the app.', ['SNG-12'],
              skipped('S004', 'id differs from the file name'))
    song_case('song-chorus-early', replace_once(lorem, b'{start_of_chorus}', b'{chorus}\n\n{start_of_chorus}'),
              'SNG-13', 'Error', 'A {chorus} in lorem-ipsum before the first chorus is defined.',
              ['SNG-13'], skipped('S008', 'chorus before its definition'))
    song_case('song-new-song', lorem + b'{new_song}\n', 'SNG-14', 'Error',
              'A {new_song} directive at the end of lorem-ipsum.', ['SNG-14'], skipped('S009', '{new_song}'))
    song_case('song-value-invalid', replace_once(lorem, b'{meta: redistribute yes}', b'{meta: redistribute ja}'),
              'SNG-15', 'Error', '{meta: redistribute ja} in lorem-ipsum: the value must be yes or no.',
              ['SNG-15'], skipped('S012', 'redistribute not yes or no'))
    title = b'Lorem Ipsum! Dolor sit amet, consectetur adipiscing elit, sed do eiusmod'
    assert len(title) > 60
    song_case('song-long-title', replace_once(lorem, b'{title: Lorem Ipsum!}', b'{title: ' + title + b'}'),
              'SNG-17', 'Warning', 'lorem-ipsum is titled "%s", %d characters; 60 is recommended.'
              % (title.decode(), len(title)), None, f11('accepted as snapshot', ['A102', 'W003']))
    big = padded(lorem, 64 * 1024 + 1)
    song_case('song-too-large', big, 'SNG-18', 'Error',
              'lorem-ipsum padded with comment lines to 65,537 bytes, one byte over 64 KiB. Such a file is also '
              'over the 8 KiB recommendation, so SNG-17 comes with it; that cannot be avoided.',
              ['SNG-18'], skipped('S002', 'larger than 64 KiB'), extra=[finding('SNG-17', 'Warning', 'lorem-ipsum')])
    by_file, by_compressed = ratio(zip_bytes(cases['song-too-large'][0]))
    assert by_file < 20 and by_compressed < 20, (by_file, by_compressed)

    # SNG-07 and SNG-16 are the two findings every case shares (fire-in-the-night, vader-jacob).

    # ---- SET: the sets (FDS 6.7); the view is written from the changed manifest, so VIEW-02 holds ----

    def set_case(name, sets, rule, severity, where, description, app_codes, format_1_1, extra_songs=None):
        m = dict(MANIFEST, sets=sets)
        files = dict(base, **(extra_songs or {}))
        files.update({k: v for k, v in view_files(m).items()})
        cases[name] = (unsigned(files, m), expect(description, app_codes, [finding(rule, severity, where)] + shared,
                                                  format_1_1))

    kampvuur, demo = MANIFEST['sets']
    set_case('set-song-unknown', [kampvuur, dict(demo, songs=['lorem-ipsum', 'testlied'])], 'SET-01', 'Error', 'Demo',
             'The set Demo also names "testlied", which is not a song of the library.', ['SET-01'],
             f11('accepted as snapshot', ['A102', 'SL101'], 'The setlist entry is shown as not found.'))
    set_case('set-name-duplicate', [kampvuur, dict(demo, name='kampvuur')], 'SET-02', 'Error', 'kampvuur',
             'The second set is named "kampvuur", the first "Kampvuur": the same name, case-insensitively.',
             ['SET-02'], F11_SNAPSHOT)
    set_case('set-empty', [kampvuur, dict(demo, songs=[])], 'SET-03', 'Warning', 'Demo',
             'The set Demo holds no songs; lorem-ipsum is then in no set. Its view file setlists/set-2.zbs holds the '
             'title and id lines only, in canonical form (no trailing empty line).', None,
             f11('accepted as snapshot', ['A102', 'SL005'], 'The empty setlist is skipped; the library imports.'))
    set_case('set-song-twice', [dict(kampvuur, songs=kampvuur['songs'] + ['vader-jacob']), demo], 'SET-04', 'Warning',
             'Kampvuur', 'The set Kampvuur names vader-jacob twice, first and last.', None, F11_SNAPSHOT)
    many = {'songs/testlied-%03d/testlied-%03d.cho' % (n, n): numbered_song(n) for n in range(1, 199)}
    songs201 = kampvuur['songs'] + ['testlied-%03d' % n for n in range(1, 199)]
    assert len(songs201) == 201 and len(set(songs201)) == 201
    set_case('set-too-long', [dict(kampvuur, songs=songs201), demo], 'SET-05', 'Warning', 'Kampvuur',
             'The set Kampvuur holds 201 different songs: its three, then 198 small valid songs written for the '
             'test (testlied-001 to testlied-198). Each song appears once, so SET-04 holds.', None,
             f11('accepted as snapshot', ['A102', 'SL103']), extra_songs=many)

    # ---- VIEW: VIEW-01 and VIEW-02 are view-missing and view-mismatch ----

    view = json.loads(base['zangbundel.json'])
    view['format'] = 'zangbundel-bibliotheek'
    files = dict(base, **{'zangbundel.json': json_bytes(view)})
    cases['view-format'] = (unsigned(files), expect(
        'In the view\'s zangbundel.json, "format" is "zangbundel-bibliotheek" instead of "zangbundel-library", '
        'listed with its new hash. An older app refuses it (L003), so VIEW-03 fails. "format" is fixed by PF-41 '
        'and is not among the fields VIEW-02 compares with the manifest, so VIEW-02 holds.',
        ['VIEW-03'], [finding('VIEW-03', 'Info', 'zangbundel.json')] + shared, f11('refused', ['L003'])))
    return cases


def main():
    _selftest()
    out = HERE
    for name, case in build_cases().items():
        files, expected, options = case if len(case) == 3 else case + ({},)
        digest = write_zip(os.path.join(out, name + '.zbl'), files, **dict(options))
        expected = dict(expected, sha256=digest)
        with open(os.path.join(out, name + '.expected.json'), 'wb') as fh:
            fh.write(json_bytes(expected))
        print('%-24s %s' % (name, digest))
    key = {'type': 'songbook-signing-key', 'formatVersion': 1, 'algorithm': 'Ed25519',
           'name': 'RFC 8032 test key (not for real use)',
           'privateKey': base64.b64encode(TEST_SEED).decode('ascii'),
           'publicKey': base64.b64encode(public_key(TEST_SEED)).decode('ascii'),
           'created': '2026-11-06T12:00:00Z'}
    with open(os.path.join(out, 'test-key-rfc8032.zbkey'), 'wb') as fh:
        fh.write(json_bytes(key))
    print('key fingerprint %s' % fingerprint(public_key(TEST_SEED)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
