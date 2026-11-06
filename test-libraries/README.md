# Test libraries

Shared test libraries in the format of FDS draft 0.5, for FDS open item O-04. Every Editor implementation and the Songbook app must give each library the result in its `<case>.expected.json`.

**Status:** the first six cases. O-04 asks for at least one invalid case per rule of FDS section 6; these cover the reference library, the view (VIEW-01, VIEW-02), the signature (SIG-03) and the key format (SG-05). The other rules still need their cases.

## The cases

| Case | What it is | App | Format 1.1 app |
|---|---|---|---|
| `valid-signed` | The reference library: four songs, two sets, the 1.1 view, signed with the RFC 8032 test key (fingerprint `21FE-31DF-A154-A261`) | Accepted | Accepted as a snapshot (A102) |
| `valid-unsigned` | The same library without `author` and `manifest.sig` | Accepted, with W013 (APP-22) | Accepted as a snapshot |
| `view-missing` | `setlists/set-2.zbs` left out, also from the files list | Refused: VIEW-01 | Accepted, one setlist fewer |
| `view-mismatch` | `LICENSE` changed and its hash updated; the manifest's licence unchanged | Refused: VIEW-02 | Accepted, showing the changed licence (FDS limitation 9) |
| `signature-invalid` | A song changed after signing, its hash updated in the signed manifest | Refused: SIG-03 | Accepted; the change goes unnoticed (limitation 9) |
| `key-wrapped` | `author.publicKey` as X.509 SubjectPublicKeyInfo, as `openssl` writes it, instead of the raw 32 bytes | Refused: MAN-02 (SG-05) | Accepted as a snapshot |

Each library also gives two findings that every case shares: SNG-16, a Warning, for `vader-jacob` (no recommended metadata), and SNG-07, an Info, for `fire-in-the-night` (a phase 2 timing directive). The Editor shows them; the app does not (FDS 6.1).

## `<case>.expected.json`

| Field | Meaning |
|---|---|
| `description` | What the case tests |
| `app` | The Songbook app: `verdict`, the FDS rule `codes` that refuse it, `signed` and `fingerprint` where it matters, and `song_format_warnings` such as W013 |
| `editor` | The Editor: every finding with its severity |
| `format_1_1` | An app that predates library packages, which reads only the 1.1 view (song format 12.5) |
| `sha256` | SHA-256 of the `.zbl` itself, so a changed library is noticed |

## The test key

`test-key-rfc8032.zbkey` is the key of RFC 8032 section 7.1, test 1, in the key-file format of FDS 5.3. Its private key is published in the RFC, so **anyone can sign with it**. It exists so the signed cases can be checked by anyone, and so an Editor can be tested with "Load key" (EDT-62). Never sign a real library with it.

This file is the one key file in the repository. `.gitignore` excludes `*.zbkey`, and this one is added by name.

## Rebuilding

```bash
python test-libraries/make_test_libraries.py
```

Standard library only. The script implements Ed25519 after RFC 8032 and checks it against the RFC's test vector before it writes anything. Its output is deterministic: an unchanged case gives a byte-identical file.

## Checks done when the cases were made (2026-11-06)

- **Determinism:** two runs gave identical files.
- **Independent check:** a script separate from the generator checked file hashes, the files list, the view against the manifest, field rules, and the signature. It verified the signatures with the `cryptography` package (49.0.0), not with the generator's own code. Every case failed exactly the rule in its `expected.json`, and the two valid cases failed none.
- **The 1.1 side:** the library repository's `scripts/release.py verify` accepted all six as snapshots.

The FDS rules have no implementation yet, so no Editor or app has run these cases.

## The songs

`source/songs/` holds four songs. Three come from the app repository's conformance corpus and are CC0: `vader-jacob`, `vuur-in-de-nacht` and `fire-in-the-night`. The fourth, `lorem-ipsum`, is the demonstration song of the song library, also CC0. They contain no lyrics under copyright.
