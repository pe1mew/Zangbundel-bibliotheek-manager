#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
"""Build the shared test libraries of FDS open item O-04, in the format of FDS draft 0.5.

Run from the repository root:

    python test-libraries/make_test_libraries.py

It reads the songs under test-libraries/source/songs/ and writes, per case, a library
`test-libraries/<case>.zbl` and its expected result `test-libraries/<case>.expected.json`. The
output is deterministic: running it again gives byte-identical files, so a changed file in git
means a changed case.

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
        lines = ['{title: %s}' % s['name'], '{meta: id set-%d}' % n, '']
        lines += ['%s/%s' % (manifest['libraryId'], song) for song in s['songs']]
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


def write_zip(path, files):
    """One top-level folder named after the title (EDT-55); sorted, fixed time, deterministic."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        for name in sorted(files, key=lambda n: (n not in ('manifest.json', 'manifest.sig'), n.encode('utf-8'))):
            info = zipfile.ZipInfo('%s/%s' % (TITLE, name), date_time=ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            zf.writestr(info, files[name], compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    with open(path, 'wb') as fh:
        fh.write(buf.getvalue())
    return hashlib.sha256(buf.getvalue()).hexdigest()


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
    return cases


def main():
    _selftest()
    out = HERE
    for name, (files, expected) in build_cases().items():
        digest = write_zip(os.path.join(out, name + '.zbl'), files)
        expected = dict(expected, sha256=digest)
        with open(os.path.join(out, name + '.expected.json'), 'wb') as fh:
            fh.write(json_bytes(expected))
        print('%-18s %s' % (name, digest))
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
