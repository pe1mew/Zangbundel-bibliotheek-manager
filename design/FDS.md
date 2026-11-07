# Functional Design Specification — Song Library Editor & Import

| | |
|---|---|
| **Document** | Functional Design Specification (FDS) |
| **Status** | Draft 0.8 |
| **Date** | 2026-11-07 |
| **Scope** | Library package format, Editor, Songbook app import |

---

## 1. Introduction

### 1.1 Purpose

Creating a single song in ChordPro is easy. Turning songs into a complete, validated and versioned library is not — the current process is too technical for the target audience: scout leaders with average computer skills.

This document specifies a simple process:

1. Open an existing library ZIP in the **Editor**, or start a new library.
2. The Editor checks integrity and correctness, and lets the user maintain the songs.
3. Optionally sign the library.
4. Save it as a ZIP and publish it any way the user likes.
5. The **Songbook app** imports the ZIP, checks it, and shows whether it is signed and by which key.

### 1.2 Scope

In scope:

- The library package format (ZIP structure, manifest, signature).
- Validation rules shared by the Editor and the Songbook app.
- Functional behaviour of the Editor.
- Import behaviour of the Songbook app.
- User-facing messages.

Out of scope:

- A trust model or central authority deciding which authors are trustworthy.
- Recovery of lost or leaked signing keys.
- Distribution of library ZIPs (email, messaging, website, USB, etc.).
- Screen designs and implementation technology.

### 1.3 Terms

| Term | Meaning |
|---|---|
| **Library** | A collection of songs and sets, distributed as one ZIP file (`.zbl`). |
| **Set** | A named, ordered list of songs of the library, used as a setlist in the Songbook app. A song is stored once and can be in any number of sets (D-22). |
| **Song** | One song folder containing exactly one ChordPro file. |
| **Song ID** | The name of a song folder, also the name of its ChordPro file and the value of its `{meta: id}` directive. Assigned once by the Editor. |
| **ChordPro file** | A text file with lyrics, chords and directives (`.cho`). |
| **ChordPro profile** | The song file format of the Songbook app: Zangbundel `design/song-format.md`, sections 5 to 8 (github.com/pe1mew/Zangbundel). The song rules of this specification are those of the profile (D-26). |
| **Release archive** | The library format the Songbook app read before this specification: a `.zbl` file with `zangbundel-archive.json`, built from a git library repository (song format §12). The app keeps reading it (D-23). |
| **Attachment** | A non-ChordPro file in a song folder (audio, PDF, image). Not allowed in format version 1 (D-24). |
| **Manifest** | `manifest.json`: library ID, version, metadata and a hash of every file. |
| **Library ID** | A random identifier assigned once to a library (§4.1). It, not the title or the author, identifies a library: a later version of the same library has the same ID. |
| **Signature** | `manifest.sig`: an Ed25519 signature over the manifest. |
| **Key file** | A file holding an author's private and public key. |
| **Fingerprint** | A short, human-readable code derived from a public key. |
| **Editor** | The application used to create, check, edit and sign libraries. |
| **Songbook app** | The application that imports and displays libraries. |
| **Session** | One Editor run from opening (or creating) a library to saving or discarding it. |

### 1.4 Platforms

The Editor may be implemented as a web app (local or hosted), a native Windows or Linux app, or an Android app. **All Editor implementations behave identically.** This specification is platform-neutral; requirements apply to every implementation unless stated otherwise.

### 1.5 Requirement notation

- Requirements have an ID (`EDT-xx`, `APP-xx`, …) and use **must**, **should** or **may**.
- Validation rules have a code (`PKG-xx`, `STR-xx`, …) with a severity (§6.1).
- Messages have an ID (`M-xx`), see §9.

---

## 2. Principles

1. **Simple for the user.** Open, edit, save. No command line, no manual version numbers, no hand-built folder structures.
2. **One set of rules.** The Editor and the Songbook app apply the same validation rules (§6).
3. **Integrity always, signing optional.** Every library carries file hashes. Signing is an extra the author may choose.
4. **No central responsibility.** Nobody vouches for authors. The Songbook app only makes changes of author visible; the user decides.
5. **Nothing is stored.** The Editor keeps nothing between sessions — not libraries, not keys.

---

## 3. Library package format

### 3.1 ZIP container

| ID | Requirement |
|---|---|
| PF-01 | A library is a standard ZIP file (deflate or stored). Encrypted entries are not allowed. |
| PF-02 | The ZIP contains exactly one top-level folder, the **library folder**. Its name is not significant; the library title is in the manifest. |
| PF-03 | All paths in this specification are relative to the library folder, use `/` as separator, and are encoded in UTF-8, normalised to Unicode NFC. |
| PF-04 | A saved library has the extension `.zbl` and the MIME type `application/vnd.zangbundel.library+zip`, as the release archive (song format §12.2; D-25, D-30). |

### 3.2 Folder structure

```
<library folder>/
├── manifest.json            required; also holds the sets (§4.1)
├── manifest.sig             only when signed
├── zangbundel.json          1.1 view (§3.7), generated
├── LICENSE                  1.1 view, generated
├── songs/
│   ├── <song id>/
│   │   └── <song id>.cho    exactly one, nothing else
│   └── <song id>/
│       └── <song id>.cho
└── setlists/                1.1 view, generated; only when there are sets
    └── set-<n>.zbs
```

| ID | Requirement |
|---|---|
| PF-10 | The library folder contains only `manifest.json`, optionally `manifest.sig`, the 1.1 view files of §3.7 (`zangbundel.json`, `LICENSE`, `setlists/`) and the folder `songs/` with the song folders. *Changed in draft 0.5* (D-34): song folders moved under `songs/`, view added. |
| PF-11 | *Withdrawn in draft 0.3.* Sets are no longer folders; they are lists in the manifest (D-22). |
| PF-12 | A song folder lies in `songs/`, is named after its song ID and contains exactly one file, `<song id>.cho`. It contains no subfolders. The folder level is kept so that a later format version can add attachments (D-24). |
| PF-13 | A set is displayed by its `name` in the manifest. A song is displayed by its `{title}` directive. |
| PF-14 | A song ID follows the song ID syntax of the ChordPro profile (song format §3.2): `^[a-z0-9]+(-[a-z0-9]+)*$`, at most 64 characters. The `{meta: id}` directive of the song equals the song ID. |

### 3.3 Names

| ID | Requirement |
|---|---|
| PF-20 | Folder and file names must not contain `< > : " / \ \| ? *` or control characters, and must not end with a space or a dot. |
| PF-21 | Names must not be a Windows reserved name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`), with or without extension. |
| PF-22 | Each name is at most 100 characters; each full path at most 255 characters. |
| PF-23 | No two names in the same folder may differ only in letter case. |

### 3.4 Attachments

Format version 1 has no attachments: a song folder holds only its ChordPro file (PF-12, STR-08). Attachments such as notation for the Songbook app's phase 3 come with a later format version (D-24).

### 3.5 Limits

The limits are those of the Songbook app's release archive (song format §12.2 and §5.5), so that both formats are bounded alike (D-26). Implementations may make them stricter, never looser.

| Limit | Value |
|---|---|
| ZIP file size | 64 MiB |
| Total uncompressed size | 256 MiB, and at most 20 × the ZIP file size |
| Number of entries | 10,000 |
| ChordPro file size | 64 KiB (SNG-18); 8 KiB recommended (SNG-17) |

The size and ratio limits are checked from the ZIP's central directory before any entry is decompressed, and enforced again while decompressing.

Sharing threshold: the Editor warns when the saved ZIP is larger than **16 MiB** (PKG-09), the size above which the Songbook app already warns for a release archive (song format A101). This is not a limit; it reflects what common messaging apps and e-mail can send (D-21, D-28).

### 3.6 Ignored system files

The following entries are created by operating systems and are not part of the library: `__MACOSX/` (and everything below it), `.DS_Store`, `Thumbs.db`, `desktop.ini`.

| ID | Requirement |
|---|---|
| PF-30 | The Editor removes ignored system files when opening a library and reports this (M-40). |
| PF-31 | The Songbook app ignores them during import. They are not listed in the manifest. |

### 3.7 Format 1.1 view

Every library carries a copy of itself in the format that Songbook apps before library packages read: the library format 1.1 of the app's song format specification (§4 and §12.5 there). Such an app imports the library as a repository snapshot, without signature, version, title check or whole-or-nothing validation. An app that reads this format reads the manifest and checks the view against it (VIEW-01 to VIEW-03). The view is generated; nobody edits it (D-34).

| ID | Requirement |
|---|---|
| PF-40 | On every save the Editor writes the view from the manifest: `zangbundel.json`, `LICENSE` and, per set, `setlists/set-<n>.zbs`, `n` being the set's 1-based position in `sets`. The songs under `songs/` are shared by both formats. |
| PF-41 | `zangbundel.json`: `format` `zangbundel-library`, `format_version` `1.1`, `id` = `libraryId`, `name` = `title`, `description` = `description` (or `title` when there is none), `maintainer` = `maintainer`, `license` = `{id: license.id, file: "LICENSE", summary: license.summary}`, `min_app_version` `0.1.0`. No other fields. UTF-8 without BOM, LF line ends. |
| PF-42 | `LICENSE` holds `license.text`, or `license.summary` when there is no text, encoded in UTF-8: the text with any trailing LFs removed, followed by exactly one LF. VIEW-02 compares these bytes exactly, so every implementation gives the same verdict. *Made exact in draft 0.6.* |
| PF-43 | `setlists/set-<n>.zbs` holds `{title: <set name>}`, `{meta: id set-<n>}`, an empty line, and one line `<libraryId>/<song id>` per song of the set, in order, in the canonical form of the song format specification (§13 there). Without sets there is no `setlists/` folder. |
| PF-44 | The view files are listed in `files` (MF-01) like the songs, so a signature covers them (SG-03). |
| PF-45 | The Editor never reads the view of a library it opens: it reads the manifest and writes a new view on save. |
| PF-46 | The view lets a Songbook app that predates this format import the library. It carries none of this format's protections there: anyone can change the view, and such an app does not notice (limitation 9). |

---

## 4. Manifest

### 4.1 Content

`manifest.json` is a UTF-8 JSON file without BOM.

```json
{
  "formatVersion": 1,
  "libraryId": "3f6c2a1e-8b4d-4c1a-9e2f-7d5b0a6c9e11",
  "version": 4,
  "title": "Troop 12 Campfire Songs",
  "description": "Songs for camps and campfires.",
  "created": "2026-03-14T18:22:05Z",
  "modified": "2026-11-04T09:41:30Z",
  "changes": "Three songs added for the summer camp.",
  "license": {
    "id": "CC-BY-NC-4.0",
    "summary": "Free to share and adapt for non-commercial use, with credit to Troop 12."
  },
  "maintainer": {
    "name": "Troop 12 leaders",
    "url": "https://troop12.example.org/songs"
  },
  "author": {
    "name": "Remko",
    "publicKey": "11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo="
  },
  "sets": [
    { "name": "Campfire", "songs": ["kumbaya", "vader-jacob"] },
    { "name": "Summer camp 2026", "songs": ["vader-jacob"] }
  ],
  "files": [
    { "path": "LICENSE", "size": 73, "sha256": "5e2a…c1b4" },
    { "path": "setlists/set-1.zbs", "size": 141, "sha256": "0d7c…a915" },
    { "path": "setlists/set-2.zbs", "size": 115, "sha256": "b38e…44f0" },
    { "path": "songs/kumbaya/kumbaya.cho", "size": 1532, "sha256": "9b1f…e07a" },
    { "path": "songs/vader-jacob/vader-jacob.cho", "size": 611, "sha256": "41cc…9d02" },
    { "path": "zangbundel.json", "size": 402, "sha256": "f6a0…2d87" }
  ]
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `formatVersion` | integer | yes | Format version of this specification. Currently `1`. |
| `libraryId` | string | yes | UUID version 4 in exactly this form: `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`. No upper case, no braces, no other UUID version; anything else fails MAN-02. Assigned once; never changes except via Save as copy. The Songbook app uses it unchanged as the library id in setlists, BLE song references and memories (D-29). |
| `version` | integer | yes | ≥ 1. Raised by the Editor (§7.6). |
| `title` | string | yes | 1–80 characters, the limit of `name` in the 1.1 view (PF-41). *Changed in draft 0.5* (D-38): was 100. |
| `description` | string | no | Up to 1,000 characters. |
| `created` | string | yes | UTC, ISO 8601, `YYYY-MM-DDThh:mm:ssZ`. Set when the library ID is assigned. |
| `modified` | string | yes | Same format. Set on every save that raises the version. |
| `changes` | string | no | Up to 500 characters: what changed in this version, written by the author (EDT-58, D-27). Belongs to one version: the Editor does not carry it over to the next. |
| `license` | object | yes | The licence of the collection, shown by the Songbook app on first import and on request (FR-LIB-21; D-31). It applies to every song that does not state its own `{meta: license}`. |
| `license.id` | string | yes | An SPDX identifier (`CC-BY-NC-4.0`, `CC-BY-SA-4.0`, `CC0-1.0`, …), `proprietary`, or `mixed` when the songs carry their own licences; as `license.id` in `zangbundel.json` (song format §4.2). |
| `license.summary` | string | yes | One sentence, 1–200 characters, shown before the full text. |
| `license.text` | string | no | The full licence text, up to 32,000 characters. The manifest is the source; the view's `LICENSE` is a copy (PF-42, D-37). |
| `maintainer` | object | yes | Who looks after the library, for rights holders and users with a correction. Copied into every copy of the library and shown by the Songbook app. Required because the 1.1 view needs it (PF-41, D-36); was optional until draft 0.4 (D-32). |
| `maintainer.name` | string | yes | 1–100 characters. |
| `maintainer.email`, `maintainer.url` | string | at least one | An e-mail address; an `https:` URL. |
| `sets` | array | yes | The sets, in display order. May be empty. |
| `sets[].name` | string | yes | 1–60 characters, as a setlist title (song format §13). Unique in the library, case-insensitive. |
| `sets[].songs` | array | yes | Song IDs (PF-14), in the order they are sung. |
| `author` | object | no | Present **only** when the library is signed. |
| `author.name` | string | if `author` | 1–100 characters. Chosen by the author; not verified. |
| `author.publicKey` | string | if `author` | Ed25519 public key, the raw 32 bytes of RFC 8032, base64 (standard alphabet, with padding): always 44 characters. Not wrapped in X.509 SubjectPublicKeyInfo (SG-05). |
| `files` | array | yes | One entry per file in the library, except `manifest.json` and `manifest.sig`. Sorted by `path`, ordinal byte order. |
| `files[].path` | string | yes | Path relative to the library folder (§3.1, PF-03). |
| `files[].size` | integer | yes | Size in bytes. |
| `files[].sha256` | string | yes | SHA-256 of the file bytes, lowercase hex. |

Unknown fields must be preserved by the Editor and ignored by the Songbook app.

### 4.2 Integrity

| ID | Requirement |
|---|---|
| MF-01 | Every file in the library folder (except `manifest.json`, `manifest.sig` and ignored system files) must be listed in `files`. |
| MF-02 | Every entry in `files` must exist, with matching `size` and `sha256`. |

---

## 5. Signing

### 5.1 Method

| ID | Requirement |
|---|---|
| SG-01 | Algorithm: **Ed25519** (RFC 8032). |
| SG-02 | The signature is computed over the **exact bytes** of `manifest.json` as stored in the ZIP. No reformatting or canonicalisation. Any change to the manifest invalidates the signature. |
| SG-03 | Because the manifest contains the hashes of all files and the author's public key, the signature covers the whole library. |
| SG-04 | A library is **signed** when `author.publicKey` is present in the manifest **and** `manifest.sig` is present. Both or neither must be present. |
| SG-05 | Keys are raw Ed25519 keys as RFC 8032 defines them: the public key is its 32 bytes, the private key the 32-byte seed. Wherever this specification stores a key (`author.publicKey`, the key file of §5.3) it is base64 of exactly those bytes. A key wrapped in X.509 SubjectPublicKeyInfo or PKCS #8, as `openssl` writes it, is not accepted: unwrap it first. Example: the public key of RFC 8032 section 7.1, test 1, is `11qYAYKxCrfVS/7TyWQHOg7hcvPapiMlrwIaaPcHURo=`, fingerprint `21FE-31DF-A154-A261` (SG-20). *Added in draft 0.5* (D-40). |

### 5.2 Signature file

`manifest.sig` is a UTF-8 JSON file:

```json
{
  "algorithm": "Ed25519",
  "signature": "base64 of the 64-byte signature"
}
```

### 5.3 Key file

A key file holds one author key pair. Proposed extension: `.zbkey`.

```json
{
  "type": "songbook-signing-key",
  "formatVersion": 1,
  "algorithm": "Ed25519",
  "name": "Remko",
  "privateKey": "base64 of the 32-byte private key seed",
  "publicKey": "base64 of the 32-byte public key",
  "created": "2026-03-14T18:20:11Z"
}
```

| ID | Requirement |
|---|---|
| SG-10 | The key file is not encrypted. Whoever has the file can sign as that author. |
| SG-11 | When a key file is loaded, the Editor derives the public key from `privateKey` and must reject the file if it does not equal `publicKey` (M-31). |
| SG-12 | `name` is copied into `author.name` when the library is first signed. |

### 5.4 Fingerprint

| ID | Requirement |
|---|---|
| SG-20 | Fingerprint = first 8 bytes of SHA-256 over the raw 32-byte public key (SG-05), as 16 uppercase hex characters in four groups of four: `AB12-CD34-EF56-7890`. |
| SG-21 | The Editor shows the fingerprint wherever a key is shown. The Songbook app shows it on the library screen. |

---

## 6. Validation rules

### 6.1 Severity

| Severity | Editor | Songbook app |
|---|---|---|
| **Fatal** | The ZIP cannot be opened. | Import is rejected. |
| **Error** | Shown; blocks Save until fixed. | Import is rejected. |
| **Warning** | Shown; does not block. | Not shown; does not block. |
| **Info** | Shown. | Not shown. |

Both applications must apply the rules in this chapter identically. Implementations should verify this against a shared set of test libraries (open item O-04).

### 6.2 Package rules (PKG)

The app's ZIP reader is shared with the release archive, whose checks have the song format's A-codes. For a library in this format, an implementation reports the FDS code; the column *Archive* only shows which archive check is the same. The shared test libraries name FDS codes (O-04). *Column added in draft 0.6.*

| Code | Rule | Severity | Message | Archive |
|---|---|---|---|---|
| PKG-01 | The file is a readable ZIP. | Fatal | M-01 | A001 |
| PKG-02 | The limits of §3.5 are respected. | Fatal | M-02 | A002, A003 |
| PKG-03 | No entry has an absolute path, a drive letter, a `..` segment, a backslash, or is a symbolic link. | Fatal | M-03 | A005, A006 |
| PKG-04 | No entry is encrypted. | Fatal | M-04 | A004 |
| PKG-05 | There is exactly one top-level folder. | Error | M-05 | — |
| PKG-06 | Names follow PF-20, PF-21, PF-22. | Error | M-06 | — |
| PKG-07 | No two names in one folder differ only in case (PF-23). | Error | M-07 | A006 |
| PKG-08 | Ignored system files are present (§3.6). | Info | M-40 | — |
| PKG-09 | The ZIP is not larger than the sharing threshold (§3.5). Editor only: checked on the opened ZIP and on save. | Warning | M-08 | A101 |

PKG-02 covers the ZIP size, uncompressed size, ratio and entry count of §3.5; the ChordPro file size is the song rule SNG-18, so that one oversized song does not stop the Editor from opening the library.

### 6.3 Structure rules (STR)

| Code | Rule | Severity | Message |
|---|---|---|---|
| STR-01 | The library folder contains nothing other than `manifest.json`, `manifest.sig`, the view files of §3.7 and `songs/` (PF-10). *Changed in draft 0.5*. | Error | M-10 |
| STR-02 | The library contains at least one song. | Warning | M-11 |
| STR-03 | *Withdrawn in draft 0.3* (set folders no longer exist, D-22). | — | — |
| STR-04 | *Withdrawn in draft 0.3*; replaced by SET-03. | — | — |
| STR-05 | A song folder contains `<song id>.cho` (PF-12). | Error | M-14 |
| STR-06 | A song folder contains no more than one `.cho` file. | Error | M-15 |
| STR-07 | A song folder contains no subfolders. | Error | M-16 |
| STR-08 | A song folder contains no file other than its `.cho` file (§3.4). | Error | M-17 |
| STR-09 | *Withdrawn in draft 0.3* (no attachments, D-24). | — | — |
| STR-10 | A song folder name is a valid song ID (PF-14). | Error | M-09 |
| STR-11 | The folder `songs/` contains only song folders. *Added in draft 0.5*. | Error | M-10 |

### 6.4 Manifest rules (MAN)

| Code | Rule | Severity | Message |
|---|---|---|---|
| MAN-01 | `manifest.json` is present. | Editor: Info (the ZIP is converted, EDT-25; the manifest is created on save). App: not this format, see APP-02. | M-20 |
| MAN-02 | The manifest is valid JSON and matches §4.1. | Error | M-21 |
| MAN-03 | `formatVersion` is supported by this application. | Fatal | M-22 |
| MAN-04 | Every listed file exists (MF-02). | Error | M-23 |
| MAN-05 | Every file is listed (MF-01). | Error | M-24 |
| MAN-06 | Size and hash of every file match (MF-02). | Error | M-25 |
| MAN-07 | The library has a licence (`license.id` and `license.summary`). In the Editor checked before every save; in the app part of MAN-02. | Error | M-29 |
| MAN-08 | The library has a maintainer with a name and an e-mail address or URL (§4.1). In the Editor checked before every save; in the app part of MAN-02. *Added in draft 0.5* (D-36). | Error | Editor: M-39. App: M-75 (D-42). |

### 6.5 Signature rules (SIG)

| Code | Rule | Severity | Message |
|---|---|---|---|
| SIG-01 | If `author.publicKey` is present, `manifest.sig` is present, and vice versa (SG-04). | Error | M-26 |
| SIG-02 | `manifest.sig` is valid JSON with a supported `algorithm`. | Error | M-27 |
| SIG-03 | The signature verifies against `author.publicKey` and the bytes of `manifest.json`. | Error | M-28 |

### 6.6 Song rules (SNG)

A song file is valid when it is valid under the ChordPro profile (song format sections 5 to 7). The rules below restate the profile's checks with this specification's severities and messages; the column *Profile* names the profile's code. Where this table and the profile disagree, the profile is right and this table is to be corrected (D-26).

The profile's song-level errors (S-codes) make the Songbook app skip the song in a release archive; in this format they reject the import (APP-01), because the Editor does not save a library with an Error.

| Code | Rule | Severity | Message | Profile |
|---|---|---|---|---|
| SNG-01 | The `.cho` file is valid UTF-8 without control characters other than LF, CR and tab. A BOM, CRLF line ends, trailing whitespace and NFD are allowed; the Editor writes the canonical form on save (EDT-57). | Error | M-50 | S001, W001 |
| SNG-02 | The song has a `{title:}` (or `{t:}`) directive with a non-empty value. | Error | M-51 | S003 |
| SNG-03 | A single-valued directive (title, language, subtitle, sorttitle, copyright, license, source, melody, variant-group, redistribute, key, capo, tempo, time, duration, year; song format §6.2) occurs at most once. | Error | M-52 | S006 |
| SNG-04 | No line starts with `{` without ending with `}`, or the reverse. | Error | M-53 | S011 |
| SNG-05 | Every chord has matching `[` and `]` on the same line. Editor only: the profile treats chords as opaque in phase 1. | Warning | M-54 | — |
| SNG-06 | Environments (`start_of_…`/`end_of_…` and their short forms, also unknown ones) are not nested, every start has an end and every end a start. | Error | M-55 | S007 |
| SNG-07 | Directives and meta names are known to the profile. Unknown ones are ignored by the app. | Info | M-56 | I001 |
| SNG-08 | Chord names are recognisable (root `A`–`G`, optional `#`/`b`, optional suffix, optional `/bass`). Editor only. | Warning | M-57 | — |
| SNG-09 | The song contains at least one lyric line. | Error | M-58 | S010 |
| SNG-10 | No two songs in the library have the same title (case-insensitive). | Warning | M-59 | — |
| SNG-11 | The song has a `{meta: language}` directive with a well-formed BCP 47 tag (song format §6.2). | Error | M-49 | S003 |
| SNG-12 | The `{meta: id}` directive is present and equals the song ID (PF-14). | Editor: Info (corrected on save, EDT-36). App: Error. | M-48 | S003, S004 |
| SNG-13 | `{chorus}` does not occur before any chorus is defined. | Error | M-47 | S008 |
| SNG-14 | The file contains no `{new_song}` directive. | Error | M-46 | S009 |
| SNG-15 | Values are valid: `redistribute` is `yes` or `no`, `year` has four digits, `variant-group` and `tag` follow the song ID syntax. | Error | M-45 | S012 |
| SNG-16 | Recommended metadata is present: lyricist or composer, copyright, license, source, tag. | Warning | M-44 | W002, W010 |
| SNG-17 | The song stays within the recommendations of song format §5.5: title ≤ 60 characters, lyric line ≤ 120 characters, ≤ 254 lyric lines, file ≤ 8 KiB. | Warning | M-43 | W003, W004, W005, W008 |
| SNG-18 | The `.cho` file is at most 64 KiB (§3.5). | Error | M-19 | S002 |

### 6.7 Set rules (SET)

| Code | Rule | Severity | Message |
|---|---|---|---|
| SET-01 | Every song ID in a set is a song of the library. | Error | M-32 |
| SET-02 | No two sets have the same name (case-insensitive). | Error | M-33 |
| SET-03 | A set contains at least one song. | Warning | M-13 |
| SET-04 | A set contains each song at most once. | Warning | M-34 |
| SET-05 | A set contains at most 200 songs, as a setlist file (song format §13). | Warning | M-35 |

### 6.8 View rules (VIEW)

The view (§3.7) is generated, so an Editor-saved library never fails these rules. They catch a view that was edited by hand, or altered to mislead Songbook apps that read only the view. The Editor reports them as Info and writes a new view on save (PF-45); the Songbook app refuses the import (APP-01). *Added in draft 0.5* (D-34).

| Code | Rule | Severity | Message |
|---|---|---|---|
| VIEW-01 | The view is complete: `zangbundel.json`, `LICENSE`, and `setlists/set-<n>.zbs` for each set and no others. | Editor: Info. App: Error. | M-36 |
| VIEW-02 | The view agrees with the manifest as PF-41 to PF-43 say: id, name, description, maintainer, licence id, summary and text, and every set with its songs in order. | Editor: Info. App: Error. | M-37 |
| VIEW-03 | `zangbundel.json` passes the library checks of the song format specification (§4.3 there: L002 to L006), so that an older Songbook app does not refuse it. | Editor: Info. App: Error. | M-38 |

---

## 7. Editor

### 7.1 Session

| ID | Requirement |
|---|---|
| EDT-01 | A session starts with **New library** or **Open library** and ends with **Save**, **Save as copy** or **Close**. |
| EDT-02 | Nothing is kept after a session ends: no library content, no keys, no settings tied to a library. This applies equally to web, native and Android implementations. |
| EDT-03 | Closing with unsaved changes requires confirmation (M-60). |
| EDT-04 | A hosted web implementation must delete all session data on the server when the session ends or after 2 hours of inactivity, whichever comes first, and must use HTTPS. |

### 7.2 New library

| ID | Requirement |
|---|---|
| EDT-10 | The user enters a title (at most 80 characters) and optionally a description. |
| EDT-11 | The Editor assigns a new `libraryId` and sets `created`. The library starts unsigned. Version 1 is written on the first save. |
| EDT-12 | The new library starts with no songs and no sets. |
| EDT-13 | Before the first save the user chooses the library's licence: a short list of common choices (CC BY-NC 4.0, CC BY-SA 4.0, CC0 1.0, `mixed`, `proprietary`) with their summary filled in, or another SPDX identifier with an own summary. The full text is optional (§4.1). |
| EDT-14 | Before the first save the user enters a maintainer: a name, and an e-mail address or a website (§4.1, MAN-08). The Editor says that the contact is copied into every copy of the library and shown to everyone who imports it, and that a group address or website serves as well as a personal one. *Changed in draft 0.5* (D-36): was optional. |

### 7.3 Open library

| ID | Requirement |
|---|---|
| EDT-20 | The Editor applies all rules of §6. On a Fatal rule the library is not opened. |
| EDT-21 | A ZIP without a manifest (MAN-01) is opened as a new library: a `libraryId` is assigned and `created` is set. Its content is taken over as described in EDT-25 and EDT-26. |
| EDT-22 | An **unsigned** library with manifest errors (MAN-04 to MAN-06) is opened; the differences are listed. Saving writes a new manifest for the current content (after confirmation, M-61). |
| EDT-23 | A **signed** library opens **read-only**. The user can view, validate, load the key file, or use Save as copy. |
| EDT-24 | After a matching key file is loaded (§7.7), the signed library becomes editable, including one with manifest or signature errors. |
| EDT-25 | **A ZIP of folders and song files** (for example made with the operating system's *Compress* command): when the ZIP has no single top-level folder, its root is taken as the library folder. Every `.cho` file becomes a song. When the folder two levels above a `.cho` file lies inside the library folder, as in `<set>/<song>/<song>.cho`, that folder becomes a set containing the song, in alphabetical order of the song folders. A song found in several set folders with identical text is stored once and placed in each of those sets. The Editor proposes song IDs (EDT-36), leaves out all files that are not `.cho` files (M-42), and reports what it took over (M-41). The rules of §6 then apply to the result. |
| EDT-26 | **A release archive or a library repository snapshot** (a `.zbl` with `zangbundel-archive.json`, or a ZIP with `zangbundel.json`; song format §12): the songs are taken over with their song IDs; title, description, licence (`license.id`, `license.summary`, and the licence file as `license.text`) and maintainer come from `zangbundel.json`. Setlists (`.zbs`) whose entries are songs of this library become sets; other entries are left out and reported. The library gets a new `libraryId` (EDT-21); the original stays readable by the Songbook app (D-23). Reported with M-41 and M-42. |

### 7.4 Editing

| ID | Requirement |
|---|---|
| EDT-30 | Library: edit title, description, licence and maintainer. |
| EDT-31 | Sets: add, rename, reorder, delete (with confirmation, M-62). Within a set: add songs, remove songs, reorder songs. Deleting a set or removing a song from a set does not delete the song. |
| EDT-32 | Songs: add (empty template or import an existing `.cho` file), edit, delete (with confirmation, M-62). Deleting a song removes it from every set. |
| EDT-33 | Song text: edit the ChordPro text directly, with validation while typing. |
| EDT-34 | Song metadata: edit through form fields that read and write the corresponding directives in the ChordPro text: at least the fields of song format §6.1 marked MUST or SHOULD. Text and form stay in sync. The song ID is shown but not edited. |
| EDT-35 | *Withdrawn in draft 0.3* (no attachments, D-24). |
| EDT-36 | The song ID of a new song is proposed from its title as song format §3.2 recommends (lower case, accents removed, everything that is not a letter or digit becomes a hyphen, hyphens collapsed), made unique with a number (PF-14). A song taken over with a valid `{meta: id}` keeps it. The Editor writes it as folder name, file name and `{meta: id}`. Once the library has been saved with a song, its song ID does not change, also when the title changes, because the Songbook app's setlists refer to it. |
| EDT-37 | System files found on opening are removed (PF-30). |

### 7.5 Validation panel

| ID | Requirement |
|---|---|
| EDT-40 | The Editor shows all current messages, grouped by severity, each with its location (set, song, line). |
| EDT-41 | Selecting a message navigates to its location. |
| EDT-42 | Validation updates as the user edits. |

### 7.6 Save

| ID | Requirement |
|---|---|
| EDT-50 | Save is blocked while any Error is present (M-63). |
| EDT-51 | If the content differs from what was opened, the Editor raises `version` by 1 (or sets it to 1 for a new library) and sets `modified`. If nothing changed, the library is saved unchanged, including its signature. |
| EDT-52 | The Editor writes the 1.1 view (§3.7) and then the manifest (§4) for the current content, the view listed in `files`. *Changed in draft 0.5* (D-34). |
| EDT-53 | If the library is signed, the Editor signs the new manifest with the loaded key (§5). |
| EDT-54 | The proposed file name is `<title>-v<version>.zbl`, adjusted to comply with §3.3 (D-25). |
| EDT-55 | The ZIP contains one top-level folder named after the title, adjusted to comply with §3.3. |
| EDT-56 | After saving, the Editor shows the size of the ZIP and, above the sharing threshold, the warning M-08 (PKG-09). |
| EDT-57 | Every song file is written in the canonical form of the ChordPro profile (song format §8.1), so that the file hash in the manifest and the Songbook app's content hash are taken over the same bytes. |
| EDT-58 | When a save raises the version, the Editor asks for an optional note on what changed (`changes`, at most 500 characters), with an empty field. Without a note the field is left out. |
| EDT-59 | A web implementation offers the saved library as a download with the MIME type of PF-04. |

### 7.7 Signing and keys

| ID | Requirement |
|---|---|
| EDT-60 | **Sign library** (unsigned library only): the user loads a key file or generates a new one. On the next save, `author` is added and the library is signed. |
| EDT-61 | **Generate key**: the Editor creates an Ed25519 key pair, asks for the author name, and lets the user save the key file. Before saving, it shows the notice M-64, which the user must acknowledge. |
| EDT-62 | **Load key** for a signed library: the key file must pass SG-11 and its public key must equal `author.publicKey`. Otherwise it is rejected (M-30). |
| EDT-63 | A signed library stays signed. The signature cannot be removed and the author key cannot be replaced; both are done through Save as copy. |
| EDT-64 | The private key is held in memory only. It must never be written to disk, browser storage, the OS keychain or logs, and must be discarded at the end of the session. |
| EDT-65 | A hosted web implementation should process the key on the user's device. If the key is sent to the server, it must be kept in memory only and discarded at the end of the session. |

### 7.8 Save as copy

| ID | Requirement |
|---|---|
| EDT-70 | Save as copy is always available, also for a signed library without its key. |
| EDT-71 | The copy gets a new `libraryId`, `version` 1, new `created` and `modified`, no `author` and no `manifest.sig`. The title is proposed as `<title> (copy)`. |
| EDT-72 | The copy may then be signed with any key (EDT-60). This is the only way to change the author key of a library. |
| EDT-73 | The Save rules of §7.6 apply. |

### 7.9 Language

| ID | Requirement |
|---|---|
| EDT-80 | The Editor's interface and messages are available in at least the languages of the Songbook app: Dutch, English and German (D-20). |
| EDT-81 | The Editor starts in the language of the operating system or browser, or in English when that language is not available. The user can change it at any time. |
| EDT-82 | The language choice is not tied to a library and may be remembered between sessions (EDT-02). |
| EDT-83 | Fixed terms (library, set, song, *signed by*, *not signed*, fingerprint) follow the Songbook app's glossary, so the user sees the same word in both applications. The app's glossary uses *signed by* and *not signed*, never a bare *signed*, which would clash with the app's own *signed in* (D-43). *Changed in draft 0.6*. |

---

## 8. Songbook app — import

### 8.1 Steps

| ID | Requirement |
|---|---|
| APP-01 | The app applies all rules of §6. On any Fatal or Error rule the import is rejected with the matching message. Warnings and Info are not shown. A library in this format is accepted whole or not at all, because the Editor never saves one with an Error; an Error therefore means damage or a change outside the Editor (D-33). |
| APP-02 | The app recognises the format by content, not by file name (D-25): `manifest.json` in the single top-level folder is this format; `zangbundel-archive.json` at the root is a release archive; `zangbundel.json` without it is a repository snapshot. A library in this format also holds a `zangbundel.json` in its view (§3.7); the manifest decides, so it is this format. A release archive or a snapshot is imported as before, under song format §12, song by song (D-23). A ZIP that is none of these is rejected (M-20). A Songbook app that predates this format finds only the view and imports the library as a snapshot (PF-46). |
| APP-03 | A library with a higher `formatVersion` than supported is rejected (M-22). |
| APP-04 | After validation, the app compares the library with its device memory (§8.2) and its installed libraries, and acts according to §8.3. |
| APP-05 | The app asks at most one question per import. |
| APP-06 | A release archive, repository snapshot or `zangbundel.json` library whose library id equals the `libraryId` of a library in this format is an **unsigned copy** of it. That holds when the library is installed, and also when it is only in the device memory. It is never refused for its id and never replaces the library silently. When the device memory has a key, the app asks M-71 with `{versionNote}` left empty, because such a library has no version to compare. When it records "unsigned", the app asks M-72. On accept the copy replaces the library and the device memory records "unsigned"; on cancel the library stays as it is. This matches the app's song format 4.3 and 12.11 (v0.21). *Added in draft 0.6* (D-41). |

### 8.2 Device memory

| ID | Requirement |
|---|---|
| APP-10 | For every imported library the app remembers, per `libraryId`: the public key (or "unsigned") and the version. |
| APP-11 | Device memory is kept on the device only and is not shared or synchronised. |
| APP-12 | Device memory is kept when a library is removed from the app, and is lost when the app's data is cleared or the app is reinstalled. |

### 8.3 Decision table

The app first identifies the library by its `libraryId`, then checks the signing key, then the version. The first row that matches decides.

| Device memory | Incoming library | Behaviour | Message |
|---|---|---|---|
| Unknown library ID; no installed library has the same title | Signed or unsigned | Import. Remember the key, or "unsigned". | — |
| Unknown library ID; an installed library has the same title (case-insensitive). Installed libraries include release archives and snapshots, compared by the `name` in their `zangbundel.json`. | Signed or unsigned | Ask: add as a separate library, replace the installed one, or cancel. On replace: remove the installed library and import the new one. | M-73 |
| Key X | Signed with Y | Ask. On accept: import and remember Y. | M-70 |
| Key X | Unsigned | Ask. On accept: import and remember "unsigned". | M-71 |
| Key X | Signed with X | Compare versions (table below). | see below |
| Unsigned | Signed or unsigned | Compare versions (table below). On import of a signed library, remember its key. | see below |

| Incoming version | Behaviour | Message |
|---|---|---|
| Higher | Update silently. | — |
| Same | Ask. On accept: replace. | M-72 |
| Lower | Warn and ask. On accept: replace. | M-74 |

When M-70 or M-71 is asked and the incoming version is not higher, the version sentence `{versionNote}` (§9) is part of that question, so a change of key never hides a downgrade and the user is asked only once (APP-05).

Replacing a library with an older version is always possible; the app warns but never refuses (D-19). The same holds for a change of key (D-17).

When the device memory knows the library ID but the library is no longer installed (APP-12), the comparison with the remembered key and version still applies; "replace" then means "import".

The table is for libraries in this format. A release archive, snapshot or `zangbundel.json` library with the ID of a library in this format follows APP-06.

### 8.4 Display

| ID | Requirement |
|---|---|
| APP-20 | The library screen shows title, version, `modified` date and signing status. |
| APP-21 | A signed library shows **signed by** with the author name and fingerprint (SG-20). |
| APP-22 | An unsigned library shows the label **not signed** (D-43; *Unsigned* until draft 0.5). On import it gets the song format's warning W013 (not signed), as release archives and repository snapshots do; it never blocks the import (D-39). |
| APP-23 | The sets of a library are offered as setlists of that library, in the order of `sets`; the songs of a set in the order of `sets[].songs`. Songs outside any set are in the library's songbook only. |
| APP-24 | When an update carries `changes`, the app shows the note once after the update and keeps it on the library screen until the next version. |
| APP-25 | The app shows the licence (`license.summary`, and `license.text` when present) when a library is first imported and on request afterwards (FR-LIB-21). |
| APP-26 | When `maintainer` is present, the library screen shows its name and contact. |

---

## 9. Messages

The texts are given in English and are the reference for their translations; both applications show them in the user's language (EDT-80). `{…}` marks a placeholder.

`{versionNote}` (M-70, M-71) is empty when the incoming version is higher than the installed one, and otherwise the sentence: "This is version {new}; you have version {current}."

| ID | Text |
|---|---|
| M-01 | This file is not a valid ZIP file. |
| M-02 | This ZIP file is too large or contains too many files. |
| M-03 | This ZIP file contains an unsafe file path and cannot be opened: {path}. |
| M-04 | This ZIP file is password-protected. Save it again without a password. |
| M-05 | The ZIP file must contain exactly one library folder. |
| M-06 | The name "{name}" is not allowed. Avoid special characters and keep names short. |
| M-07 | "{name1}" and "{name2}" differ only in capital letters. Rename one of them. |
| M-08 | This library is {size} MB. Some messaging apps and e-mail cannot send files larger than about 16 MB. Share it another way if it does not arrive. |
| M-09 | The folder name "{name}" is not a valid song ID. Use lower-case letters, digits and hyphens. |
| M-10 | The file "{name}" does not belong in the library folder. Move it into a song folder or remove it. |
| M-11 | This library has no songs yet. |
| M-12 | *Withdrawn in draft 0.3* (STR-03). |
| M-13 | The set "{set}" is empty. |
| M-14 | The song folder "{folder}" has no song file "{folder}.cho". |
| M-15 | The song folder "{folder}" has more than one song file. Keep one song per folder. |
| M-16 | The song folder "{folder}" contains a subfolder. Song folders cannot contain folders. |
| M-17 | The file "{name}" in "{folder}" is not a song file. Other files cannot be added to a library yet. |
| M-18 | *Withdrawn in draft 0.3* (STR-09). |
| M-19 | The song file "{song}" is larger than 64 KB and cannot be used. |
| M-20 | This file is not a song library. Open and save it in the bibliotheek-manager first. |
| M-21 | The library's manifest is damaged. |
| M-22 | This library was made with a newer version. Update the app to open it. |
| M-23 | The file "{path}" is missing. The library may be damaged or incomplete. |
| M-24 | The file "{path}" was added outside the Editor. |
| M-25 | The file "{path}" was changed outside the Editor or is damaged. |
| M-26 | The library's signature is incomplete. |
| M-27 | The library's signature is damaged. |
| M-28 | The library's signature is not valid. The library was changed after signing. |
| M-29 | Choose a licence for this library before saving. |
| M-30 | This key does not belong to this library. |
| M-31 | This key file is damaged. |
| M-32 | The set "{set}" contains "{song}", which is not a song of this library. |
| M-33 | There are two sets called "{set}". Rename one of them. |
| M-34 | The set "{set}" contains "{song}" more than once. |
| M-35 | The set "{set}" has {count} songs. A setlist of more than 200 songs is hard to use at a campfire. |
| M-36 | Files for older Songbook apps are missing: {names}. Save the library again in the Editor. |
| M-37 | The file "{path}" does not match the library. Save the library again in the Editor. |
| M-38 | Older Songbook apps cannot read this library's details: {reason}. Save the library again in the Editor. |
| M-39 | Enter who looks after this library (name and e-mail address or website) before saving. |
| M-40 | System files ({count}) were removed. They are not part of the library. |
| M-41 | {songs} songs and {sets} sets were taken from this file. Check them before saving. |
| M-42 | {count} files that are not songs were left out: {names}. |
| M-43 | "{song}" is longer than recommended: {what}. It may be hard to read on a phone. |
| M-44 | The song "{song}" has no {field}. Add it so singers can see who wrote it and under which licence. |
| M-45 | Line {line} of "{song}": "{value}" is not a valid value for {directive}. |
| M-46 | The song file "{song}" contains more than one song. Keep one song per file. |
| M-47 | Line {line} of "{song}": the chorus is repeated before it has been written. |
| M-48 | The song ID in "{folder}" is missing or differs from the folder name. The Editor corrects it when you save. |
| M-49 | The song "{song}" has no language. Choose the language of its first verse. |
| M-50 | The song "{song}" is not saved as UTF-8 text. |
| M-51 | The song in "{folder}" has no title. Add a title line. |
| M-52 | Line {line} of "{song}": "{directive}" appears more than once. Keep one. |
| M-53 | Line {line} of "{song}": a `{` or `}` is missing. |
| M-54 | Line {line} of "{song}": a `[` or `]` is missing. |
| M-55 | "{song}": the section starting at line {line} is not closed correctly. |
| M-56 | Line {line} of "{song}": "{directive}" is not known and will be ignored. Check the spelling. |
| M-57 | Line {line} of "{song}": "{chord}" does not look like a chord. |
| M-58 | The song "{song}" has no lyrics. |
| M-59 | The library contains more than one song titled "{title}". |
| M-60 | You have unsaved changes. Close anyway? |
| M-61 | Some files do not match the manifest. Saving will record the current content. Continue? |
| M-62 | Delete "{name}"? This cannot be undone in this session. |
| M-63 | Fix the errors before saving. |
| M-64 | Keep this key file safe. It cannot be recovered, and without it you cannot change or sign this library again. Anyone who has this file can sign as you. |
| M-70 | This update is signed by a different author than the version you have. Current: {name} ({fingerprint}). New: {name} ({fingerprint}). {versionNote} Import anyway? |
| M-71 | The version you have is signed by {name} ({fingerprint}), but this update is not signed. {versionNote} Import anyway? |
| M-72 | You already have version {current} of this library. Replace it with this copy? |
| M-73 | You already have a library called "{title}", but this is a different library. Add it as a separate library, or replace the one you have? |
| M-74 | This is an older version of the library than the one you have: version {new} instead of {current}. Replace it anyway? |
| M-75 | This library names nobody who looks after it (a name and an e-mail address or website). Save it again in the Editor. *App wording of MAN-08, added in draft 0.6* (D-42). |

---

## 10. Limitations

These limitations are accepted and must be stated in the user documentation.

1. **A signature shows that the library is intact, not who made it.** The author name is chosen by the author and is not verified.
2. **There is no trust model.** Nobody decides which authors are trustworthy. The Songbook app only warns when the author key of a library changes; the user decides.
3. **A new device trusts what it sees first.** After a reinstall or on a new device, the first import of a library is accepted without comparison.
4. **Lost or leaked keys cannot be recovered or revoked.** A lost key means the library can no longer be changed; use Save as copy to continue under a new library ID. Anyone with a leaked key file can sign as that author.
5. **One editor at a time.** Two people editing the same version produce two libraries with the same version number. The Songbook app cannot tell them apart and asks before replacing (M-72).
6. **Hand-made changes are detected, not prevented.** Anyone can change a ZIP by hand. The hashes and signature make such changes visible. A manifest shows that the content has not changed since the manifest was written, not that the Editor wrote it or that the library was validated; the Songbook app therefore always validates again (APP-01).
7. **A library is identified by its library ID, not by its title or author.** Starting a new library instead of opening the last saved ZIP creates a different library, which the app adds next to the old one unless the user chooses to replace it (M-73). Keep the last saved ZIP to make the next version.
8. **A converted library is a new library.** A release archive or snapshot opened in the Editor gets a new library ID (EDT-26). Setlist files and memories that name the old library do not find its songs in the converted one. Keeping the old ID in the manifest would bridge this; it is not part of format version 1.
9. **Older Songbook apps get the view without protection.** An app that predates this format imports the 1.1 view as a repository snapshot (PF-46): without signature check, version, title check or whole-or-nothing validation. Someone who alters the view can mislead such an app. An app that reads this format notices the change (VIEW-02).

---

## 11. Open items

| ID | Item |
|---|---|
| O-01 | *Resolved in draft 0.3* (D-26): the directives and metadata are those of the ChordPro profile; required are title, language and song ID (SNG-02, SNG-11, SNG-12). |
| O-02 | *Resolved in draft 0.3* (D-24): no attachments in format version 1. Library-level files (cover image) come, if wanted, with a later format version. |
| O-03 | *Resolved in draft 0.3* (D-22): a set is a setlist, kept in the manifest; a song is stored once; sets and their songs are shown in manifest order. |
| O-04 | Create the shared set of test libraries (valid and invalid) that every Editor implementation and the Songbook app must pass. Layout as the app's conformance vectors (`android/core/testing/src/main/resources/conformance/` in the app repository): per case a `<case>.zbl` and a `<case>.expected.json` listing the expected rule codes and severities, under `test-libraries/` in this repository. At least one invalid case per rule of §6, and one valid library with sets. Since draft 0.5 the cases include libraries with a 1.1 view: a valid one, which a format 1.1 app also accepts as a snapshot, and one invalid case each for VIEW-01 to VIEW-03. *Partly done in draft 0.6:* `test-libraries/` holds six cases, built by `make_test_libraries.py`: `valid-signed`, `valid-unsigned`, `view-missing` (VIEW-01), `view-mismatch` (VIEW-02), `signature-invalid` (SIG-03) and `key-wrapped` (SG-05), with the RFC 8032 test key. Still to write: the other rules of §6, VIEW-03, and a `zangbundel.json` library that is an unsigned copy (APP-06). *Draft 0.7:* 56 cases cover every rule of section 6 except PKG-09 (a ZIP over 16 MiB) and some forms of PKG-02 and PKG-03; `test-libraries/README.md` lists them, and `check_test_libraries.py` checks every case against its `expected.json`. |
| O-05 | *Resolved in draft 0.3* (D-23): the app keeps reading release archives and repository snapshots; the Editor converts them (EDT-26). |
| O-06 | *Resolved in draft 0.3* (D-26, D-28): the limits are the app's (§3.5); sharing threshold 16 MiB. |
| O-07 | *Resolved in draft 0.3* (D-25): `.zbl`, recognised by content. |
| O-08 | *Resolved in draft 0.3* (D-27): an optional `changes` note per version. |
| O-09 | *Resolved in draft 0.4* (D-29): the app uses `libraryId` unchanged. |
| O-10 | *Resolved in draft 0.4* (D-30): the app registers for Share and Open; whether a tap in a messaging app opens it is measured on phones, not promised. |
| O-11 | Confirm or correct the readings the test libraries had to make where section 6 leaves room (`test-libraries/README.md`, *Readings*): whether the app reports every refusing rule or the first (APP-01); PKG-05 against APP-02 when there are two top-level folders; MAN-07 reported as itself in the app; a second `.cho` as STR-06 only, not also STR-08; song rules only for `songs/<id>/<id>.cho`; the PKG-02 ratio against the ZIP file size or the compressed total (*settled 2026-11-06: the ZIP file size, as §3.5 says; song format v0.23 bounds the release archive the same way, 12.2 and A003, approved by the owner with the app's proposal `design/proposals/2026-11-06-shared-test-libraries.md`*); VIEW-02 against VIEW-03 for the fixed fields of PF-41; PF-43 for an empty set (empty line or canonical form); whether ignored system files match regardless of case; SIG-03 skipped when `author.publicKey` fails MAN-02. Each answer may change an `expected.json`. Several also concern the app, which today reports song format codes (S-, L-, A-codes) where the cases expect FDS codes, and stops at the first error. *Draft 0.8, the library manager's engine (implementationPlan M2) adds readings the test libraries do not exercise, to confirm with the app:* SIG-03 verifies by strict RFC 8032, as Web Crypto and OpenSSL do, so a signature under a small-order or non-canonically encoded key fails (a ZIP-215 verifier would accept a forgery); a set name must be usable as a setlist title (song format §13.2: one line, no `{` or `}`, no leading or trailing space, NFC), otherwise MAN-02; C1 control characters (U+0080–U+009F) count as control characters in SNG-01 and PF-20; a directive line holding another unescaped `{` or `}` (`{c: a} {new_song}`), or ending in an escaped `\}`, is malformed (SNG-04, song format §5.2); a blank line and a directive line are judged after trimming spaces and tabs only; `{chorus: label}` with two choruses of that label repeats the most recent; `{album: …}` is a known directive (§5.3); VIEW-03 checks `min_app_version` against 0.1.0, the value PF-41 fixes; SNG-17's 254 lines count the canonical line list with chorus repeats (song format W004); EDT-50 comes before EDT-51, so an unchanged library with an Error is not saved. |

---

## 12. Decision log

| # | Decision |
|---|---|
| D-01 | The Editor is an application: web app (local or hosted), native Windows or Linux app, or Android app. All implementations behave identically. |
| D-02 | A session runs from opening or creating a library to saving it. |
| D-03 | The Editor offers **New library**, so users do not need to build a ZIP by hand. |
| D-04 | The Editor assigns a library ID and raises the version automatically. |
| D-05 | Every library has a manifest with file hashes. Signing is optional. |
| D-06 | The author's public key is stored in the library. A provided private key is checked against it. |
| D-07 | Handing the private key to the Editor is accepted; protection was never meant to be absolute. |
| D-08 | There is no trust model; the project does not take responsibility for vouching for authors. |
| D-09 | Lost or leaked keys are out of scope. |
| D-10 | The Songbook app accepts unsigned libraries and labels them **Unsigned**. |
| D-11 | A signed library can only be changed in the Editor when its private key is provided. |
| D-12 | Purpose of signing: make tampering visible. The Songbook app shows author name and fingerprint, remembers the key per library on the device, and warns when it changes (option C). |
| D-13 | Replacing the author key is done through Save as copy. |
| D-14 | The limitation of parallel editing is accepted. |
| D-15 | The Editor shows a notice when a key is generated. |
| D-16 | No Editor implementation stores keys or libraries between sessions. |
| D-17 | A change of author key, or a signed library followed by an unsigned one, is never refused by the app: it warns and the user decides (M-70, M-71). This confirms D-12. |
| D-18 | A library is identified by its library ID. When an incoming library has an unknown ID but the title of an installed library, the app asks whether to add it separately or replace the installed one (M-73). |
| D-19 | A newer version replaces the installed one silently; the same or an older version is replaced only after a question, and an older version is named as such (M-72, M-74), also when the key changes. The app warns but never refuses. |
| D-20 | The Editor's interface and messages are in at least Dutch, English and German, the languages of the Songbook app. |
| D-21 | Libraries are shared through messaging apps, e-mail, file sharing and websites. The Editor warns above 20 MB, the size such channels commonly accept (PKG-09). |

| D-22 | A set is a setlist: an ordered list of song IDs in the manifest. Each song is stored once, in its own folder at library level, and can be in any number of sets. The Editor takes over a ZIP with one folder per set (EDT-25). Resolves O-03. |
| D-23 | The Songbook app keeps importing release archives (`.zbl` with `zangbundel-archive.json`) and repository snapshots as before, tolerant song by song. This format is strict: any Error rejects the import. The Editor opens a release archive or snapshot and saves it in this format (EDT-26). Resolves O-05. |
| D-24 | Format version 1 has no attachments; a song folder holds only its ChordPro file. The folder level is kept for attachments in a later format version. Resolves O-02. |
| D-25 | A saved library has the extension `.zbl`, as the release archive. Both applications recognise the format by its content (APP-02). Resolves O-07. |
| D-26 | Song files follow the ChordPro profile of the Songbook app (song format sections 5 to 8). The song ID is the folder name, the file name and `{meta: id}`, managed by the Editor. The limits are those of the release archive. Resolves O-01 and, with D-28, O-06. |
| D-27 | A library version can carry an optional note of at most 500 characters on what changed (`changes`); the Editor asks for it when the version is raised, the app shows it after the update. Resolves O-08. |
| D-28 | The sharing threshold is 16 MiB, the size above which the Songbook app warns for a release archive (song format A101). Supersedes the 20 MB of D-21. |

| D-29 | The Songbook app uses `libraryId` unchanged as the library id: songs are referred to as `<libraryId>/<song id>` in setlists, BLE song references, the resume record and memories; no short form is derived. A UUID fits every BLE limit (the worst-case state body is 377 of 440 bytes). ~~The UUID form is reserved for this format: the app refuses a `zangbundel.json` library whose id has that form, so the two formats never share an id.~~ *Superseded by D-35.* A library in this format is never refused because of its id; §8.3 decides. Manifest sets become read-only setlists shipped with their library. The optional `rev` of a BLE song reference is the `version` as a decimal string. Resolves O-09. |
| D-30 | The Songbook app registers for Share (SEND) with `application/vnd.zangbundel.library+zip`, `application/zip` and `application/octet-stream`, and for Open (VIEW) with the library MIME type and `content:` addresses whose path ends in `.zbl`. Whether a tap in a messaging app opens the app depends on what that app passes on; it is measured on phones before anything is promised. The Editor names the MIME type (PF-04, EDT-59). Resolves O-10. |
| D-31 | The licence of the collection is in the manifest: required `license.id` and `license.summary`, optional full `license.text`. ~~No licence file, so the library folder keeps only the manifest, the signature and song folders.~~ *The licence-file part is superseded by D-37.* |
| D-32 | ~~The maintainer contact is optional: a troop may not want an address in every copy.~~ *Superseded by D-36.* The minimum app version is covered by `formatVersion` (MAN-03), which departs from FR-LIB-05 of the app's FRD, to be amended for this format. |
| D-33 | A library in this format is accepted whole or not at all (APP-01). FR-LIB-07 of the app's FRD (report bad songs, import the rest) is to be amended to apply to release archives and snapshots only. |

| D-34 | Every library carries a format 1.1 view: `zangbundel.json`, `LICENSE` and the sets as `setlists/set-<n>.zbs`, generated by the Editor and listed in the manifest. The songs move under `songs/`, where both formats find them. A Songbook app that predates this format imports the view as a repository snapshot, without this format's protections (§3.7, limitation 9); an app that reads this format checks the view against the manifest (VIEW-01 to VIEW-03). |
| D-35 | The UUID form is no longer reserved for this format: a `zangbundel.json` id in that form is valid, and the view carries the library's `libraryId` there. Withdrawing it means no library that was valid becomes invalid; a library and its view share one id on every device. Supersedes the reservation in D-29. |
| D-36 | `maintainer` is required (MAN-08, EDT-14), because the view's `zangbundel.json` needs one. Supersedes the optional maintainer of D-32. |
| D-37 | The view's `LICENSE` is a generated copy of the manifest's licence (PF-42); the manifest stays the source. Supersedes "no licence file" in D-31. |
| D-38 | `title` is at most 80 characters, the limit of `name` in the view. |
| D-39 | An unsigned library gets the song format's warning W013 (not signed) on import, as release archives and repository snapshots do (APP-22). |
| D-40 | Keys are raw Ed25519 keys (SG-05). The draft 0.4 example of `author.publicKey` was an X.509 SubjectPublicKeyInfo, while every rule already said raw; the fingerprint (SG-20) differs between the two, so the example is corrected. |
| D-41 | A release archive, snapshot or `zangbundel.json` library carrying the ID of a library in this format is an unsigned copy of it (APP-06). The app asks M-71 (without the version sentence) or M-72, and never replaces silently. Refusing it with L006 was the alternative; the owner chose the question (2026-11-06, the app's assessment SP-39). |
| D-42 | The app shows a MAN-08 failure as M-75, worded for someone importing; M-39 is the Editor's wording for someone saving. |
| D-43 | The fixed terms are *signed by* and *not signed*, as in the app's glossary, which keeps a bare *signed* apart from *signed in* (EDT-83, APP-21, APP-22). |

Decisions D-17 to D-21 follow the answers of the requester on issue pe1mew/Zangbundel-bibliotheek#1 (2026-11-04). Decisions D-22 to D-28 are the owner's (2026-11-04). Decisions D-29 and D-30 come from the app repository's proposal `design/proposals/2026-11-04-library-package-id-and-file-type.md`, approved by the owner; D-31 to D-33 are the owner's answers to the differences that proposal found between this specification and the app's FRD (2026-11-04). Decisions D-34 to D-39 come from the app repository's proposal `design/proposals/2026-11-06-backward-compatible-packages.md`, approved by the owner on 2026-11-06. D-40 answers a question from the app's implementation on the same day. D-41 to D-43 come from the app session on 2026-11-06: D-41 is the owner's decision on that session's assessment SP-39, and D-42 and D-43 follow from writing the app's import questions (GUI design D-88).

---

## 13. Change history

| Version | Date | Change |
|---|---|---|
| Draft 0.1 | 2026-11-04 | First draft, from issue pe1mew/Zangbundel-bibliotheek#1. |
| Draft 0.2 | 2026-11-04 | After the requester's answers on the issue. Term *Library ID*. Sharing threshold (§3.5), PKG-09, M-08, EDT-56. Language of the Editor (§7.9, EDT-80 to EDT-83); messages are translated. Import (§8.3): same-title check (M-73), version compared in every case with a downgrade warning (M-74, `{versionNote}` in M-70 and M-71), at most one question (APP-05); M-72 reworded. Limitation 6 extended, limitation 7 added. Open items O-03 and O-05 extended, O-06 reworded, O-07 and O-08 added. Decisions D-17 to D-21. |
| Draft 0.3 | 2026-11-04 | Open items O-01 to O-03 and O-05 to O-08 resolved (D-22 to D-28); O-04 given a layout; O-09 and O-10 added for the app repository. Sets move from folders into the manifest (`sets`), songs sit in song-ID folders at library level (§3.2, PF-11 withdrawn, PF-14). No attachments (§3.4; STR-09, EDT-35 withdrawn). Limits from the app's release archive (§3.5); sharing threshold 16 MiB. Song rules follow the ChordPro profile (§6.6: SNG-03, SNG-07, SNG-09 changed severity, SNG-05 Warning, SNG-10 library-wide, SNG-11 to SNG-18 added). Set rules SET-01 to SET-04 (§6.7). STR-03, STR-04 withdrawn, STR-10 added. Editor: conversion of plain ZIPs and release archives (EDT-25, EDT-26), sets as ordered lists (EDT-31), stable song IDs (EDT-36), canonical form (EDT-57), change note (EDT-58), `.zbl` (EDT-54). App: format recognised by content (APP-02), sets as setlists (APP-23), change note (APP-24). Messages M-09, M-19, M-32 to M-34, M-41 to M-49 added; M-12, M-18 withdrawn; M-08, M-14, M-17, M-20, M-52, M-56, M-59 reworded. |
| Draft 0.4 | 2026-11-04 | The app repository's proposal on O-09 and O-10, approved by the owner, and the owner's answers to the differences it found with the app's FRD. `libraryId` pattern exact (§4.1). MIME type (PF-04, EDT-59). Same-title check covers release archives and snapshots (§8.3). Set names at most 60 characters; SET-05, M-35. Manifest fields `license` (required) and `maintainer` (optional); EDT-13, EDT-14, MAN-07, M-29, APP-25, APP-26; EDT-26 and EDT-30 extended. APP-01: a library is accepted whole or not at all. Limitation 8. O-09 and O-10 resolved. Decisions D-29 to D-33. |
| Draft 0.5 | 2026-11-06 | Libraries that Songbook apps before this format can read, from the app repository's proposal approved by the owner (D-34 to D-39). New §3.7: the format 1.1 view (PF-40 to PF-46), generated by the Editor, listed in the manifest. Songs move under `songs/` (§3.2, PF-10, PF-12, STR-01, new STR-11). New §6.8: view rules VIEW-01 to VIEW-03 with messages M-36 to M-38. `maintainer` required: §4.1, EDT-14, new MAN-08, M-39. `title` at most 80 characters (§4.1, EDT-10). Licence: a generated `LICENSE` in the view. EDT-52 writes the view; APP-02 recognises a library with a view as this format; APP-22 adds W013 for unsigned libraries. Limitation 9; O-04 extended. Keys: new SG-05 (raw Ed25519 keys), SG-20 refers to it, the `author.publicKey` example corrected from an X.509 wrapper to the RFC 8032 test key (D-40). D-29, D-31 and D-32 superseded in part. |
| Draft 0.6 | 2026-11-06 | From the app session. New APP-06: a release archive, snapshot or `zangbundel.json` library with the ID of a library in this format is an unsigned copy of it; the app asks M-71 (without `{versionNote}`) or M-72, never silently (D-41, the owner's decision); a sentence below the §8.3 table points to it. New M-75, the app's wording of a MAN-08 failure (D-42). Fixed terms *signed by* and *not signed* (EDT-83, APP-21, APP-22, D-43). O-04: the first six test libraries exist in `test-libraries/`. After the app's first run of them: PF-42 made byte-exact, and an *Archive* column in §6.2 mapping PKG-01 to PKG-09 to the shared archive checks, with FDS codes reported for packages. |
| Draft 0.7 | 2026-11-06 | O-04: 56 test libraries cover every rule of section 6 except PKG-09 and some forms of PKG-02 and PKG-03. New O-11: the readings the test libraries made where the rules leave room, to be confirmed. No rule changed. |
| Draft 0.8 | 2026-11-07 | O-11: the PKG-02 ratio reading is settled (the ZIP file size, §3.5), as song format v0.23 now bounds the release archive; and the readings of the manager's engine that the test libraries do not exercise are listed for the app to confirm (strict Ed25519 for SIG-03, set names as setlist titles, C1 controls, the brace rule of song format §5.2, among others). PF-20's list of forbidden characters is escaped so its table row renders whole. Song format v0.23 also settles S005 for a format 1.1 app, which changes the format 1.1 expectation of the test library `song-two-files`; no rule of this specification changed. |
