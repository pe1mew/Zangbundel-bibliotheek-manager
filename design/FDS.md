# Functional Design Specification — Song Library Editor & Import

| | |
|---|---|
| **Document** | Functional Design Specification (FDS) |
| **Status** | Draft 0.2 |
| **Date** | 2026-11-04 |
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
| **Library** | A collection of sets, distributed as one ZIP file. |
| **Set** | A named group of songs inside a library. |
| **Song** | One song folder containing exactly one ChordPro file and optional attachments. |
| **ChordPro file** | A text file with lyrics, chords and directives (`.cho`). |
| **Attachment** | A non-ChordPro file in a song folder (audio, PDF, image). |
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

### 3.2 Folder structure

```
<library folder>/
├── manifest.json            required
├── manifest.sig             only when signed
├── <set folder>/
│   ├── <song folder>/
│   │   ├── <name>.cho       exactly one
│   │   └── <attachments>    optional
│   └── <song folder>/
│       └── …
└── <set folder>/
    └── …
```

| ID | Requirement |
|---|---|
| PF-10 | The library folder contains only `manifest.json`, optionally `manifest.sig`, and set folders. |
| PF-11 | A set folder contains only song folders. |
| PF-12 | A song folder contains exactly one `.cho` file and zero or more attachments. It contains no subfolders. |
| PF-13 | The set folder name is the set's display name. The song is displayed by its `{title}` directive. |

### 3.3 Names

| ID | Requirement |
|---|---|
| PF-20 | Folder and file names must not contain `< > : " / \ | ? *` or control characters, and must not end with a space or a dot. |
| PF-21 | Names must not be a Windows reserved name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`), with or without extension. |
| PF-22 | Each name is at most 100 characters; each full path at most 255 characters. |
| PF-23 | No two names in the same folder may differ only in letter case. |

### 3.4 Allowed attachment types

| Kind | Extensions |
|---|---|
| Audio | `.mp3`, `.m4a`, `.ogg` |
| Document | `.pdf` |
| Image | `.png`, `.jpg`, `.jpeg`, `.webp` |

See open item O-02.

### 3.5 Limits

Default limits; implementations may make them configurable but must not exceed them by default.

| Limit | Default |
|---|---|
| ZIP file size | 100 MB |
| Total uncompressed size | 500 MB |
| Number of entries | 5,000 |
| Compression ratio of any entry | 100 : 1 |
| ChordPro file size | 256 KB |

Sharing threshold: the Editor warns when the saved ZIP is larger than **20 MB** (PKG-09). This is not a limit; it reflects what common messaging apps and e-mail can send (D-21).

### 3.6 Ignored system files

The following entries are created by operating systems and are not part of the library: `__MACOSX/` (and everything below it), `.DS_Store`, `Thumbs.db`, `desktop.ini`.

| ID | Requirement |
|---|---|
| PF-30 | The Editor removes ignored system files when opening a library and reports this (M-40). |
| PF-31 | The Songbook app ignores them during import. They are not listed in the manifest. |

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
  "author": {
    "name": "Remko",
    "publicKey": "MCowBQYDK2VwAyEA…"
  },
  "files": [
    { "path": "Campfire/Kumbaya/kumbaya.cho", "size": 1532, "sha256": "9b1f…e07a" },
    { "path": "Campfire/Kumbaya/kumbaya.mp3", "size": 2840112, "sha256": "41cc…9d02" }
  ]
}
```

| Field | Type | Required | Rules |
|---|---|---|---|
| `formatVersion` | integer | yes | Format version of this specification. Currently `1`. |
| `libraryId` | string | yes | UUID version 4, lowercase. Assigned once; never changes except via Save as copy. |
| `version` | integer | yes | ≥ 1. Raised by the Editor (§7.6). |
| `title` | string | yes | 1–100 characters. |
| `description` | string | no | Up to 1,000 characters. |
| `created` | string | yes | UTC, ISO 8601, `YYYY-MM-DDThh:mm:ssZ`. Set when the library ID is assigned. |
| `modified` | string | yes | Same format. Set on every save that raises the version. |
| `author` | object | no | Present **only** when the library is signed. |
| `author.name` | string | if `author` | 1–100 characters. Chosen by the author; not verified. |
| `author.publicKey` | string | if `author` | Ed25519 public key, 32 bytes, base64 (standard alphabet, with padding). |
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
| SG-20 | Fingerprint = first 8 bytes of SHA-256 over the 32-byte public key, as 16 uppercase hex characters in four groups of four: `AB12-CD34-EF56-7890`. |
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

| Code | Rule | Severity | Message |
|---|---|---|---|
| PKG-01 | The file is a readable ZIP. | Fatal | M-01 |
| PKG-02 | The limits of §3.5 are respected. | Fatal | M-02 |
| PKG-03 | No entry has an absolute path, a drive letter, a `..` segment, a backslash, or is a symbolic link. | Fatal | M-03 |
| PKG-04 | No entry is encrypted. | Fatal | M-04 |
| PKG-05 | There is exactly one top-level folder. | Error | M-05 |
| PKG-06 | Names follow PF-20, PF-21, PF-22. | Error | M-06 |
| PKG-07 | No two names in one folder differ only in case (PF-23). | Error | M-07 |
| PKG-08 | Ignored system files are present (§3.6). | Info | M-40 |
| PKG-09 | The ZIP is not larger than the sharing threshold (§3.5). Editor only: checked on the opened ZIP and on save. | Warning | M-08 |

### 6.3 Structure rules (STR)

| Code | Rule | Severity | Message |
|---|---|---|---|
| STR-01 | The library folder contains no files other than `manifest.json` and `manifest.sig`. | Error | M-10 |
| STR-02 | The library contains at least one song. | Warning | M-11 |
| STR-03 | A set folder contains no files. | Error | M-12 |
| STR-04 | A set folder contains at least one song folder. | Warning | M-13 |
| STR-05 | A song folder contains a `.cho` file. | Error | M-14 |
| STR-06 | A song folder contains no more than one `.cho` file. | Error | M-15 |
| STR-07 | A song folder contains no subfolders. | Error | M-16 |
| STR-08 | Attachments have an allowed extension (§3.4). | Error | M-17 |
| STR-09 | Attachments are not empty. | Warning | M-18 |

### 6.4 Manifest rules (MAN)

| Code | Rule | Severity | Message |
|---|---|---|---|
| MAN-01 | `manifest.json` is present. | Editor: Info (manifest is created on save). App: Error. | M-20 |
| MAN-02 | The manifest is valid JSON and matches §4.1. | Error | M-21 |
| MAN-03 | `formatVersion` is supported by this application. | Fatal | M-22 |
| MAN-04 | Every listed file exists (MF-02). | Error | M-23 |
| MAN-05 | Every file is listed (MF-01). | Error | M-24 |
| MAN-06 | Size and hash of every file match (MF-02). | Error | M-25 |

### 6.5 Signature rules (SIG)

| Code | Rule | Severity | Message |
|---|---|---|---|
| SIG-01 | If `author.publicKey` is present, `manifest.sig` is present, and vice versa (SG-04). | Error | M-26 |
| SIG-02 | `manifest.sig` is valid JSON with a supported `algorithm`. | Error | M-27 |
| SIG-03 | The signature verifies against `author.publicKey` and the bytes of `manifest.json`. | Error | M-28 |

### 6.6 Song rules (SNG)

| Code | Rule | Severity | Message |
|---|---|---|---|
| SNG-01 | The `.cho` file is valid UTF-8. A leading BOM is allowed; the Editor removes it on save. | Error | M-50 |
| SNG-02 | The song has a `{title:}` (or `{t:}`) directive with a non-empty value. | Error | M-51 |
| SNG-03 | The song has no more than one title directive. | Warning | M-52 |
| SNG-04 | Every directive has matching `{` and `}` on the same line. | Error | M-53 |
| SNG-05 | Every chord has matching `[` and `]` on the same line. | Error | M-54 |
| SNG-06 | Every section start (`start_of_chorus`/`soc`, `start_of_verse`/`sov`, `start_of_bridge`/`sob`, `start_of_tab`/`sot`) has a matching end, without nesting, and every end has a start. | Error | M-55 |
| SNG-07 | Directives are known to the Songbook app (open item O-01). | Warning | M-56 |
| SNG-08 | Chord names are recognisable (root `A`–`G`, optional `#`/`b`, optional suffix, optional `/bass`). | Warning | M-57 |
| SNG-09 | The song contains at least one line of lyrics. | Warning | M-58 |
| SNG-10 | No two songs in the same set have the same title (case-insensitive). | Warning | M-59 |
| SNG-11 | Metadata required by the Songbook app is present (open item O-01). | TBD | — |

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
| EDT-10 | The user enters a title and optionally a description. |
| EDT-11 | The Editor assigns a new `libraryId` and sets `created`. The library starts unsigned. Version 1 is written on the first save. |
| EDT-12 | The new library starts with one empty set, which the user can rename. |

### 7.3 Open library

| ID | Requirement |
|---|---|
| EDT-20 | The Editor applies all rules of §6. On a Fatal rule the library is not opened. |
| EDT-21 | A ZIP without a manifest (MAN-01) is opened as a new library: a `libraryId` is assigned and `created` is set. |
| EDT-22 | An **unsigned** library with manifest errors (MAN-04 to MAN-06) is opened; the differences are listed. Saving writes a new manifest for the current content (after confirmation, M-61). |
| EDT-23 | A **signed** library opens **read-only**. The user can view, validate, load the key file, or use Save as copy. |
| EDT-24 | After a matching key file is loaded (§7.7), the signed library becomes editable, including one with manifest or signature errors. |

### 7.4 Editing

| ID | Requirement |
|---|---|
| EDT-30 | Library: edit title and description. |
| EDT-31 | Sets: add, rename, delete (with confirmation, M-62). |
| EDT-32 | Songs: add (empty template or import an existing `.cho` file), edit, rename the folder, move to another set, delete (with confirmation, M-62). |
| EDT-33 | Song text: edit the ChordPro text directly, with validation while typing. |
| EDT-34 | Song metadata: edit through form fields that read and write the corresponding directives in the ChordPro text. Text and form stay in sync. |
| EDT-35 | Attachments: add, replace, remove. Only allowed types (§3.4) can be added. |
| EDT-36 | Folder names for new sets and songs are proposed from the set name or song title and adjusted to comply with §3.3. |
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
| EDT-52 | The Editor writes the manifest (§4) for the current content. |
| EDT-53 | If the library is signed, the Editor signs the new manifest with the loaded key (§5). |
| EDT-54 | The proposed file name is `<title>-v<version>.zip`, adjusted to comply with §3.3. The extension is open item O-07. |
| EDT-55 | The ZIP contains one top-level folder named after the title, adjusted to comply with §3.3. |
| EDT-56 | After saving, the Editor shows the size of the ZIP and, above the sharing threshold, the warning M-08 (PKG-09). |

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
| EDT-83 | Fixed terms (library, set, song, signed, unsigned, fingerprint) follow the Songbook app's glossary, so the user sees the same word in both applications. |

---

## 8. Songbook app — import

### 8.1 Steps

| ID | Requirement |
|---|---|
| APP-01 | The app applies all rules of §6. On any Fatal or Error rule the import is rejected with the matching message. Warnings and Info are not shown. |
| APP-02 | A ZIP without a manifest is rejected (M-20): it must be opened and saved in the Editor first. See open item O-05. |
| APP-03 | A library with a higher `formatVersion` than supported is rejected (M-22). |
| APP-04 | After validation, the app compares the library with its device memory (§8.2) and its installed libraries, and acts according to §8.3. |
| APP-05 | The app asks at most one question per import. |

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
| Unknown library ID; an installed library has the same title (case-insensitive) | Signed or unsigned | Ask: add as a separate library, replace the installed one, or cancel. On replace: remove the installed library and import the new one. | M-73 |
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

### 8.4 Display

| ID | Requirement |
|---|---|
| APP-20 | The library screen shows title, version, `modified` date and signing status. |
| APP-21 | A signed library shows the author name and fingerprint (SG-20). |
| APP-22 | An unsigned library shows the label **Unsigned**. |

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
| M-08 | This library is {size} MB. Some messaging apps and e-mail cannot send files larger than about 20 MB. Use fewer or smaller attachments if it does not arrive. |
| M-10 | The file "{name}" does not belong in the library folder. Move it into a song folder or remove it. |
| M-11 | This library has no songs yet. |
| M-12 | The file "{name}" in set "{set}" must be inside a song folder. |
| M-13 | The set "{set}" is empty. |
| M-14 | The song folder "{folder}" has no song file (.cho). |
| M-15 | The song folder "{folder}" has more than one song file. Keep one song per folder. |
| M-16 | The song folder "{folder}" contains a subfolder. Song folders cannot contain folders. |
| M-17 | The file type of "{name}" is not supported. |
| M-18 | The file "{name}" is empty. |
| M-20 | This library has no manifest. Open and save it in the Editor first. |
| M-21 | The library's manifest is damaged. |
| M-22 | This library was made with a newer version. Update the app to open it. |
| M-23 | The file "{path}" is missing. The library may be damaged or incomplete. |
| M-24 | The file "{path}" was added outside the Editor. |
| M-25 | The file "{path}" was changed outside the Editor or is damaged. |
| M-26 | The library's signature is incomplete. |
| M-27 | The library's signature is damaged. |
| M-28 | The library's signature is not valid. The library was changed after signing. |
| M-30 | This key does not belong to this library. |
| M-31 | This key file is damaged. |
| M-40 | System files ({count}) were removed. They are not part of the library. |
| M-50 | The song "{song}" is not saved as UTF-8 text. |
| M-51 | The song in "{folder}" has no title. Add a title line. |
| M-52 | The song "{song}" has more than one title. |
| M-53 | Line {line} of "{song}": a `{` or `}` is missing. |
| M-54 | Line {line} of "{song}": a `[` or `]` is missing. |
| M-55 | "{song}": the section starting at line {line} is not closed correctly. |
| M-56 | Line {line} of "{song}": "{directive}" is not known and will be ignored. |
| M-57 | Line {line} of "{song}": "{chord}" does not look like a chord. |
| M-58 | The song "{song}" has no lyrics. |
| M-59 | Set "{set}" contains more than one song titled "{title}". |
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

---

## 11. Open items

| ID | Item |
|---|---|
| O-01 | Confirm which ChordPro directives and metadata the Songbook app supports and which are required (SNG-07, SNG-11, EDT-34). |
| O-02 | Confirm the allowed attachment types (§3.4) and whether library-level or set-level files (cover image, description) are needed. |
| O-03 | Define what a set is in the Songbook app and in which order sets and songs are shown. Is a set a group of songs for browsing, or a setlist to be sung in order at a campfire? If a setlist: a song used in two sets is copied into both song folders (PF-12), whereas the app's current setlists (`.zbs`) refer to songs instead of copying them. Order: alphabetical, or an explicit order in the manifest. |
| O-04 | Create a shared set of test libraries (valid and invalid) that every Editor implementation and the Songbook app must pass. |
| O-05 | Decide how existing libraries in the current format (the `.zbl` release archive with `zangbundel.json`) are migrated. Decide also whether the app keeps a route without the Editor: today a hand-zipped library is accepted and invalid songs are skipped while the rest is imported, whereas this specification rejects a ZIP without a manifest (APP-02) and a library with any Error (APP-01). |
| O-06 | Confirm the limits and the sharing threshold in §3.5. |
| O-07 | Choose the file extension of a saved library: `.zip` (EDT-54) opens in any archive tool, a dedicated extension such as `.zbl` lets the Songbook app open the file directly when it is tapped in a messaging app or e-mail. |
| O-08 | Decide whether a library can carry a short description of what changed in a version, shown by the app on update. |

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

Decisions D-17 to D-21 follow the answers of the requester on issue pe1mew/Zangbundel-bibliotheek#1 (2026-11-04).

---

## 13. Change history

| Version | Date | Change |
|---|---|---|
| Draft 0.1 | 2026-11-04 | First draft, from issue pe1mew/Zangbundel-bibliotheek#1. |
| Draft 0.2 | 2026-11-04 | After the requester's answers on the issue. Term *Library ID*. Sharing threshold (§3.5), PKG-09, M-08, EDT-56. Language of the Editor (§7.9, EDT-80 to EDT-83); messages are translated. Import (§8.3): same-title check (M-73), version compared in every case with a downgrade warning (M-74, `{versionNote}` in M-70 and M-71), at most one question (APP-05); M-72 reworded. Limitation 6 extended, limitation 7 added. Open items O-03 and O-05 extended, O-06 reworded, O-07 and O-08 added. Decisions D-17 to D-21. |
