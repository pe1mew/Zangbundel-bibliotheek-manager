# Test libraries

Shared test libraries in the format of FDS draft 0.6, for FDS open item O-04. Every Editor implementation and the Songbook app must give each library the result in its `<case>.expected.json`.

**Status:** 56 cases. Two valid libraries with sets (signed and unsigned) and at least one invalid case for every rule of FDS section 6 except PKG-09, for which see [Not covered](#not-covered). The unsigned copy of APP-06 (a `zangbundel.json` library with a package's id) is `manifest-missing`.

## How the cases are made

Each case is the reference library with as little changed as possible: one file, one field or one line. Unless a case says otherwise it is based on `valid-unsigned`, so that no signature has to be broken along the way; the signature cases are based on `valid-signed`. A song rule changes only `lorem-ipsum`, the one song with every metadata field, and its hash is updated in the manifest so that MAN-06 holds. A set rule writes the view from the changed manifest, so that VIEW-02 holds.

Each library gives two findings that every case shares: SNG-16, a Warning, for `vader-jacob` (no recommended metadata), and SNG-07, an Info, for `fire-in-the-night` (a phase 2 timing directive). The Editor shows them; the app does not (FDS 6.1). They are absent where a Fatal rule stops everything else (the Editor does not open the library, EDT-20) and in `no-songs`, which has no songs.

Where a case cannot avoid a second finding, its `expected.json` lists every finding and its `description` says why: `names-case`, `song-folder-invalid`, `license-missing` and `song-too-large`.

## The cases

App: the Songbook app's verdict (APP-01), with the rules that refuse it. Editor: the findings besides the shared two, with their Editor severity. Format 1.1: an app that predates library packages and reads only the view (song format 12.5).

### The reference library and the first five

| Case | What it is | App | Editor | Format 1.1 app |
|---|---|---|---|---|
| `valid-signed` | The reference library: four songs, two sets, the 1.1 view, signed with the RFC 8032 test key (fingerprint `21FE-31DF-A154-A261`) | Accepted | — | Accepted as a snapshot (A102) |
| `valid-unsigned` | The same library without `author` and `manifest.sig` | Accepted, with W013 (APP-22) | — | Accepted as a snapshot |
| `view-missing` | `setlists/set-2.zbs` left out, also from the files list | Refused: VIEW-01 | VIEW-01 Info | Accepted, one setlist fewer |
| `view-mismatch` | `LICENSE` changed and its hash updated; the manifest's licence unchanged | Refused: VIEW-02 | VIEW-02 Info | Accepted, showing the changed licence (FDS limitation 9) |
| `signature-invalid` | A song changed after signing, its hash updated in the signed manifest | Refused: SIG-03 | SIG-03 Error | Accepted; the change goes unnoticed (limitation 9) |
| `key-wrapped` | `author.publicKey` as X.509 SubjectPublicKeyInfo, as `openssl` writes it, instead of the raw 32 bytes | Refused: MAN-02 (SG-05) | MAN-02 Error | Accepted as a snapshot |

### Package rules (PKG, FDS 6.2)

| Case | Rule | What it is | App | Editor | Format 1.1 app |
|---|---|---|---|---|---|
| `zip-truncated` | PKG-01 | The reference library cut off after 4096 bytes: no central directory | Refused: PKG-01 | PKG-01 Fatal | Refused: A001 |
| `zip-ratio` | PKG-02 | Every song padded with comment lines to 60 KiB: uncompressed 37 times the ZIP size, above 20 | Refused: PKG-02 | PKG-02 Fatal | Refused: A003 |
| `path-traversal` | PKG-03 | An extra entry `<folder>/../../buiten.txt` | Refused: PKG-03 | PKG-03 Fatal | Refused: A006 |
| `symlink` | PKG-03 | `LICENSE` stored as a symbolic link to `/etc/passwd` | Refused: PKG-03 | PKG-03 Fatal | Refused: A005 |
| `entry-encrypted` | PKG-04 | The "encrypted" flag set on one song entry (the data is not encrypted) | Refused: PKG-04 | PKG-04 Fatal | Refused: A004 |
| `two-top-folders` | PKG-05 | A second top-level folder `extra/` | Refused: PKG-05 (see the note on APP-02) | PKG-05 Error | Refused: A001 |
| `name-reserved` | PKG-06 | The library folder named `AUX` (PF-21) | Refused: PKG-06 | PKG-06 Error | Accepted as a snapshot |
| `names-case` | PKG-07 | A file `License` next to `LICENSE`, listed | Refused: PKG-07, STR-01 | PKG-07 Error, STR-01 Error | Refused: A006 |
| `system-files` | PKG-08 | `.DS_Store` in the library folder, `Thumbs.db` in a song folder, not listed | Accepted, W013 | PKG-08 Info | Accepted as a snapshot |

### Structure rules (STR, FDS 6.3)

| Case | Rule | What it is | App | Editor | Format 1.1 app |
|---|---|---|---|---|---|
| `stray-file` | STR-01 | `README.txt` in the library folder, listed | Refused: STR-01 | STR-01 Error | Accepted as a snapshot |
| `no-songs` | STR-02 | No songs and no sets | Accepted, W013 | STR-02 Warning (no shared findings) | Refused: L008 (unless the user confirms an empty library) |
| `song-file-misnamed` | STR-05 | The song file of `lorem-ipsum` named `lorem-ipsm.cho` | Refused: STR-05 | STR-05 Error | Accepted; the song skipped (S004) |
| `song-two-files` | STR-06 | A copy `lorem-ipsum-oud.cho` next to `lorem-ipsum.cho`, listed | Refused: STR-06 | STR-06 Error | Accepted; S004, S005 |
| `song-subfolder` | STR-07 | A subfolder `oud/` with a copy of the song, listed | Refused: STR-07 | STR-07 Error | Accepted; S005 |
| `song-extra-file` | STR-08 | `notities.txt` in the folder of `lorem-ipsum`, listed | Refused: STR-08 | STR-08 Error | Accepted as a snapshot |
| `song-folder-invalid` | STR-10 | An extra song in the folder `Testlied` with `{meta: id testlied}` | Refused: STR-10, SNG-12 | STR-10 Error, SNG-12 Info | Accepted; the song skipped (S004) |
| `songs-stray-file` | STR-11 | `songs/LEESMIJ.txt`, listed | Refused: STR-11 | STR-11 Error | Accepted as a snapshot |

### Manifest and signature rules (MAN, SIG, FDS 6.4 and 6.5)

| Case | Rule | What it is | App | Editor | Format 1.1 app |
|---|---|---|---|---|---|
| `manifest-missing` | MAN-01 | No `manifest.json`: the view and the songs, which is a repository snapshot | Accepted as a snapshot (APP-02), A102, W002, W013; an unsigned copy (APP-06) where the library is known | MAN-01 Info; opened as a new library (EDT-26) | Accepted as a snapshot |
| `manifest-invalid` | MAN-02 | `created` is `2026-11-06T13:00:00+01:00`, not the `Z` form | Refused: MAN-02 | MAN-02 Error | Accepted as a snapshot |
| `format-unsupported` | MAN-03 | `formatVersion` 2 | Refused: MAN-03 | MAN-03 Fatal | Accepted as a snapshot |
| `file-missing` | MAN-04 | The files list names `songs/testlied/testlied.cho`, which is not in the ZIP | Refused: MAN-04 | MAN-04 Error | Accepted as a snapshot |
| `file-unlisted` | MAN-05 | A valid song `testlied` added, not listed | Refused: MAN-05 | MAN-05 Error | Accepted, with the added song |
| `file-changed` | MAN-06 | A line of `lorem-ipsum` changed, the manifest not | Refused: MAN-06 | MAN-06 Error | Accepted; the change goes unnoticed |
| `license-missing` | MAN-07 | `license` removed from the manifest, the view left as it was | Refused: MAN-07, VIEW-02 | MAN-07 Error, VIEW-02 Info twice (`zangbundel.json`, `LICENSE`) | Accepted as a snapshot |
| `maintainer-no-contact` | MAN-08 | The maintainer's only contact an `http:` URL; the view written from it | Refused: MAN-08 (M-75) | MAN-08 Error | Accepted as a snapshot |
| `signature-missing` | SIG-01 | `valid-signed` without `manifest.sig` | Refused: SIG-01 | SIG-01 Error | Accepted as a snapshot |
| `signature-orphan` | SIG-01 | `valid-unsigned` with the `manifest.sig` of `valid-signed` | Refused: SIG-01 | SIG-01 Error | Accepted as a snapshot |
| `signature-algorithm` | SIG-02 | `valid-signed` with `"algorithm": "Ed448"` | Refused: SIG-02 | SIG-02 Error | Accepted as a snapshot |

### Song rules (SNG, FDS 6.6); each changes `lorem-ipsum` only

| Case | Rule | What it is | App | Editor | Format 1.1 app |
|---|---|---|---|---|---|
| `song-not-utf8` | SNG-01 | A comment line with `Fr\xe8re` (Latin-1) | Refused: SNG-01 | SNG-01 Error | Accepted; the song skipped (S001) |
| `song-no-title` | SNG-02 | The `{title}` line removed | Refused: SNG-02 | SNG-02 Error | Accepted; skipped (S003) |
| `song-directive-twice` | SNG-03 | `{key: F}` and `{key: G}` | Refused: SNG-03 | SNG-03 Error | Accepted; skipped (S006) |
| `song-directive-malformed` | SNG-04 | A line `{comment: zachter` | Refused: SNG-04 | SNG-04 Error | Accepted; skipped (S011) |
| `song-chord-bracket` | SNG-05 | `[F]amet consec[Ctetur,` | Accepted, W013 (Editor only) | SNG-05 Warning | Accepted as a snapshot |
| `song-environment-open` | SNG-06 | The last `{end_of_verse}` removed | Refused: SNG-06 | SNG-06 Error | Accepted; skipped (S007) |
| `song-chord-unknown` | SNG-08 | The chord `[H]` | Accepted, W013 (Editor only) | SNG-08 Warning | Accepted as a snapshot |
| `song-no-lyrics` | SNG-09 | Comments and metadata only | Refused: SNG-09 | SNG-09 Error | Accepted; skipped (S010) |
| `song-title-duplicate` | SNG-10 | Titled `vader jacob`, as `vader-jacob` in other case | Accepted, W013 | SNG-10 Warning | Accepted as a snapshot |
| `song-no-language` | SNG-11 | The `{meta: language}` line removed | Refused: SNG-11 | SNG-11 Error | Accepted; skipped (S003) |
| `song-id-differs` | SNG-12 | `{meta: id lorem-ipsum-oud}` | Refused: SNG-12 (an Error in the app) | SNG-12 Info | Accepted; skipped (S004) |
| `song-chorus-early` | SNG-13 | A `{chorus}` before the first chorus | Refused: SNG-13 | SNG-13 Error | Accepted; skipped (S008) |
| `song-new-song` | SNG-14 | A `{new_song}` at the end | Refused: SNG-14 | SNG-14 Error | Accepted; skipped (S009) |
| `song-value-invalid` | SNG-15 | `{meta: redistribute ja}` | Refused: SNG-15 | SNG-15 Error | Accepted; skipped (S012) |
| `song-long-title` | SNG-17 | A title of 72 characters | Accepted, W013 | SNG-17 Warning | Accepted; W003 |
| `song-too-large` | SNG-18 | Padded with comment lines to 65,537 bytes | Refused: SNG-18 | SNG-18 Error, SNG-17 Warning | Accepted; skipped (S002) |

A skipped song is in the set Demo, so its entry in `setlists/set-2.zbs` is not found (SL101). SNG-07 and SNG-16 are covered by the shared findings of every case.

### Set and view rules (SET, VIEW, FDS 6.7 and 6.8)

| Case | Rule | What it is | App | Editor | Format 1.1 app |
|---|---|---|---|---|---|
| `set-song-unknown` | SET-01 | The set Demo also names `testlied`, which is not in the library | Refused: SET-01 | SET-01 Error | Accepted; SL101 |
| `set-name-duplicate` | SET-02 | The second set named `kampvuur` | Refused: SET-02 | SET-02 Error | Accepted as a snapshot |
| `set-empty` | SET-03 | The set Demo empty | Accepted, W013 | SET-03 Warning | Accepted; the empty setlist skipped (SL005) |
| `set-song-twice` | SET-04 | `vader-jacob` twice in Kampvuur | Accepted, W013 | SET-04 Warning | Accepted as a snapshot |
| `set-too-long` | SET-05 | Kampvuur with 201 different songs (198 small songs written for the test) | Accepted, W013 | SET-05 Warning | Accepted; SL103 |
| `view-format` | VIEW-03 | `format` in the view's `zangbundel.json` is `zangbundel-bibliotheek` | Refused: VIEW-03 | VIEW-03 Info | Refused: L003 |

VIEW-01 and VIEW-02 are `view-missing` and `view-mismatch` above.

## Not covered

- **PKG-09** (the 16 MiB sharing threshold, a Warning in the Editor only). The rule looks at the size of the ZIP file itself, so the case would be a file of more than 16 MiB of incompressible data: too large for the repository. An Editor can be tested with a generated file instead.
- **PKG-02**, the other limits: only the ratio is covered. A ZIP above 64 MiB or 256 MiB uncompressed is too large for the repository, and 10,001 entries would be well over 1 MiB of headers.
- **PKG-03**, the other forms: only a `..` segment and a symbolic link are covered, not an absolute path, a drive letter or a backslash.
- **MAN-02** with a manifest that is not JSON at all. What the Editor shows then besides MAN-02 (the songs it can still read, the view it cannot compare) is not specified, so the case would not be truthful. `manifest-invalid` and `key-wrapped` cover MAN-02 with valid JSON.

## Conventions and readings of the FDS

- **`app.codes`** lists every Fatal or Error rule the library fails, with the app severities of section 6 (SNG-12 and VIEW-* are Errors; PKG-09, SNG-05 and SNG-08 are not applied). A Fatal rule stops everything else. APP-01 does not say whether an app reports one refusing rule or all of them; an app that stops at the first should report one of the listed codes, and the four multi-finding cases say which one it meets first.
- **`editor.codes`** lists every finding. `where` names the song ID, set, path or name; where it is absent the location is the library.
- **`format_1_1.codes`** lists codes that must appear in the report of a format 1.1 import; the report holds more, such as W002 for `vader-jacob`.
- **Song rules** apply to `songs/<id>/<id>.cho` only. A misnamed, second or nested file in a song folder is a structure finding (STR-05 to STR-08), not a song. The song ID is the folder name (section 1.3), so a set still names a song whose file is misnamed.
- **STR-06 and STR-08:** a second `.cho` file is STR-06 only. STR-08 ("no file other than its .cho file") would also cover it if read literally; its message M-17 ("is not a song file") shows it is about other files.
- **Ignored system files** are left out before any other rule: no PKG-05, STR-01, STR-08 or MAN-05 for them.
- **PKG-05:** the Editor takes the top-level folder that holds `manifest.json` as the library folder. In the app, APP-02 recognises this format by `manifest.json` "in the single top-level folder", which `two-top-folders` lacks; an app that recognises the format first answers M-20 instead of M-05. The import is refused either way.
- **PKG-02:** FDS 3.5 bounds the ratio by the ZIP file size, song format 12.2 by the compressed size. `zip-ratio` exceeds both, `song-too-large` neither.
- **MAN-07** is "part of MAN-02" in the app, by the FDS. The cases expect the app to name MAN-07, as it names MAN-08 (with M-75). In the Editor a missing licence is MAN-07, not also MAN-02.
- **VIEW-02** compares the fields the rule names with the manifest; `format`, `format_version` and `min_app_version` are fixed by PF-41 and belong to VIEW-03 (song format L003 to L005). One VIEW-02 finding per file that disagrees (M-37 names one file).
- **An empty set** (SET-03) is written as `setlists/set-<n>.zbs` with only its title and id lines: PF-43 asks for an empty line before the songs and for the canonical form, and the canonical form has no trailing empty line.

## `<case>.expected.json`

| Field | Meaning |
|---|---|
| `description` | What the case tests, and why any second finding cannot be avoided |
| `app` | The Songbook app: `verdict`, the FDS rule `codes` that refuse it, `signed` and `fingerprint` where it matters, `song_format_warnings` such as W013, and a `note` where the FDS leaves room |
| `editor` | The Editor: every finding with its severity, and `where` |
| `format_1_1` | An app that predates library packages, which reads only the 1.1 view (song format 12.5) |
| `sha256` | SHA-256 of the `.zbl` itself, so a changed library is noticed |

## The test key

`test-key-rfc8032.zbkey` is the key of RFC 8032 section 7.1, test 1, in the key-file format of FDS 5.3. Its private key is published in the RFC, so **anyone can sign with it**. It exists so the signed cases can be checked by anyone, and so an Editor can be tested with "Load key" (EDT-62). Never sign a real library with it.

This file is the one key file in the repository. `.gitignore` excludes `*.zbkey`, and this one is added by name.

## Rebuilding and checking

```bash
python test-libraries/make_test_libraries.py
python test-libraries/check_test_libraries.py [--format-1-1 ../Zangbundel-bibliotheek/scripts/release.py]
```

Standard library only. The generator implements Ed25519 after RFC 8032 and checks it against the RFC's test vector before it writes anything. Its output is deterministic: an unchanged case gives a byte-identical file.

`check_test_libraries.py` is a second reading of FDS section 6, sharing no code with the generator: it applies the rules to each `.zbl`, derives the app's verdict, and compares both with the `expected.json`. It verifies signatures with the `cryptography` package when that is installed and says so when it is not. With `--format-1-1` it also runs the library repository's `release.py verify` on each case. It implements what these cases need, not a complete Editor.

## Checks done (2026-11-06)

- **Determinism:** the generator ran twice; all 113 files (56 libraries, 56 expected results, the key) were byte-identical. The six cases of the first version and the key file are byte-identical to that version.
- **Independent check:** `check_test_libraries.py` with `cryptography` 49.0.0: 56 cases, 0 failed. Each case produced exactly its expected Editor findings and app verdict, and the valid cases nothing beyond the shared two. Cross-checked, each case's findings fail every other case's `expected.json` except for the pairs that test the same rule (`signature-missing` and `signature-orphan`, `key-wrapped` and `manifest-invalid`, the two valid cases).
- **The 1.1 side:** `release.py verify` of the library repository gave every case its `format_1_1` verdict, with every listed code in its report.

The FDS rules have no Editor implementation yet, and the Songbook app has not run the cases added in this version.

## The songs

`source/songs/` holds four songs. Three come from the app repository's conformance corpus and are CC0: `vader-jacob`, `vuur-in-de-nacht` and `fire-in-the-night`. The fourth, `lorem-ipsum`, is the demonstration song of the song library, also CC0. The generator adds `testlied` and `testlied-001` to `testlied-198`, two-line songs written for these tests, CC0. None contains lyrics under copyright.
