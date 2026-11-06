# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/). The design documents carry their own document versions in their headers.

## [Unreleased]

### Changed
- `design/webappGUI.md` draft 0.6 and the mock: the bottom bar has an identity group, *Sleutel maken*, *Sleutel laden* and *Sleutel downloaden*, with the author's name and fingerprint, notice M-64 to acknowledge before the key file is saved, and a dot while a new key is not yet downloaded (GD-14). An *Android-app* button shows the official Google Play and F-Droid badges, the GitHub APK, the source code of the app and the manager, and the manuals of both (GD-15). Open: signing the library with the key (GQ-18), and the badges while the app is not yet public and the manager's manual (GQ-19). The two badges are named in `NOTICE` and `license.md`.
- `design/webappGUI.md` draft 0.5 and the mock: the song list has no *Bekijken* button any more, a click on a song shows it; above the list are search (*Zoeken*, with *Ook in de tekst*), the *A–Z* / *Z–A* order, filter chips for language and tag, and *Wis filters*, all as in the app's songbook (GD-13). Open question GQ-17: a new song hidden by the filter.
- `design/webappGUI.md` draft 0.4 and the mock, after the owner's feedback on the mock: the side bars can be resized and folded, with a tab in the middle of each inner edge (GD-10); the song scrolls along while a verse or chorus is dragged, keeping it in view (GD-11); the colours are now the app's night theme as its screens show it (black, dark grey `#121212`, white, grey labels, orange), instead of its night-blue configuration scheme (GD-12). Open question GQ-16: remembering bar widths between visits.
- `design/webappTDS.md` draft 0.3: the library manager gets the domain `zangbundel.nl` (TD-09), hosted on the owner's VPS contabo6, which also runs a test instance (TD-10). contabo6 runs nginx, Let's Encrypt and PHP 8.3 (section 2.1). Open: the test instance's address, access and the deployment (TQ-04), and whether the app's public pages move to the domain too (TQ-07).
- The first clickable mock of the web app in `webapp/mock/` (webappGUI draft 0.3, section 3.5). It covers the splash, the main page with the four primary actions, the four-area main screen with song list, song fields and view mode, the section editor with drag reordering, and the check on apply. Assumptions on open questions are marked with GQ badges. Preview server `webapp-mock` in `.claude/launch.json`. The app icon (CC BY-SA 4.0) and Material Icons path data (Apache 2.0) are named in `NOTICE` and `license.md`.
- FDS draft 0.6, from the app session:
  - New APP-06: a release archive, snapshot or `zangbundel.json` library with the ID of a library in this format is an unsigned copy of it. The app asks M-71 (without the version sentence) or M-72, never replaces it silently, and on accept records it as unsigned (D-41, the owner's decision on the app's assessment SP-39). A sentence below the §8.3 table points to it.
  - New M-75: how the app words a MAN-08 failure (D-42).
  - The fixed terms are *signed by* and *not signed*, as in the app's glossary (EDT-83, APP-21, APP-22, D-43).
  - O-04: the first six test libraries exist. The app's package reader is the first implementation to run them, and passes all six on both sides.
  - After that run, PF-42 is byte-exact (trailing LFs removed, exactly one added). §6.2 gains an *Archive* column that maps PKG-01 to PKG-09 to the archive checks the app's ZIP reader shares. A library in this format is reported with FDS codes.

### Added
- `test-libraries/`: the first shared test libraries of FDS open item O-04, in the format of FDS draft 0.5. There are six cases:
  - `valid-signed` and `valid-unsigned`;
  - `view-missing` (VIEW-01) and `view-mismatch` (VIEW-02);
  - `signature-invalid` (SIG-03) and `key-wrapped` (SG-05).

  Each has an `expected.json` with the verdict for the app, the Editor and an app that reads only format 1.1. They are built by `make_test_libraries.py` (standard library only, deterministic, Ed25519 after RFC 8032, checked against the RFC's test vector) from four CC0 songs. They are signed with the published RFC 8032 test key, which is included as `test-key-rfc8032.zbkey` and marked as not for real use.

  An independent check found every case failing exactly its expected rule, with signatures verified by the `cryptography` package. The library repository's `release.py` accepts all six as format 1.1 snapshots. No Editor or app implementation has run them yet.
- FDS draft 0.5: libraries that Songbook apps from before this format can read, from the app repository's proposal `design/proposals/2026-11-06-backward-compatible-packages.md`, approved by the owner on 2026-11-06 (D-34 to D-39).
  - Every library carries a format 1.1 view (new §3.7, PF-40 to PF-46): `zangbundel.json`, `LICENSE` and `setlists/set-<n>.zbs`, generated on every save (EDT-52) and listed in the manifest.
  - Songs move under `songs/` (§3.2, PF-10, PF-12, STR-01, new STR-11).
  - New view rules VIEW-01 to VIEW-03 (§6.8, M-36 to M-38) catch a view that disagrees with the manifest.
  - `maintainer` is required (MAN-08, M-39, EDT-14), and `title` is at most 80 characters.
  - An unsigned library gets the app's warning W013 (APP-22).
  - Limitation 9: older apps get the view without protection.
  - Keys are raw Ed25519 keys (new SG-05, D-40). The `author.publicKey` example was an X.509 wrapper whose fingerprint differs from the raw key's; it is now the RFC 8032 test key. The app's implementation found this.
  - D-29, D-31 and D-32 are superseded in part.
- `design/webappGUI.md` draft 0.2, the owner's GUI notes: startup like the Songbook app's (GD-03); one main screen with a bottom navigation bar, the song list on the right, the song's fields on the left and the song in the centre (GD-04, GD-05); songs edited as verse and chorus sections, each with a small WYSIWYG editor, reordered by dragging (GD-06 to GD-08); a check before a change is applied and a view after it (GD-09). Open questions GQ-06 to GQ-15 for what the notes leave open or where they meet the FDS, among them the plain-text ChordPro editing of EDT-33 (GQ-14) and the profile parts beyond verse and chorus (GQ-13).
- `design/webappTDS.md` draft 0.2: libraries and keys are processed in the browser (TD-06, resolves TQ-01). PHP has no part in library handling (TD-07), and a Content Security Policy keeps every request on the app's own server (TD-08). New open question TQ-06 on supported browsers.
- FDS draft 0.4, after the app repository's proposal on O-09 and O-10 (`design/proposals/2026-11-04-library-package-id-and-file-type.md` there), approved by the owner:
  - The app uses `libraryId` unchanged; its pattern is now exact (D-29).
  - Saved libraries have the MIME type `application/vnd.zangbundel.library+zip`; the app registers for Share and Open (PF-04, EDT-59, D-30).
  - The same-title check also covers release archives and snapshots, set names are at most 60 characters, and a set of more than 200 songs gets a warning (SET-05).
  - The manifest carries the collection's licence (`license`, required) and an optional `maintainer`, as the app's FR-LIB-05 and FR-LIB-21 ask (D-31, D-32).
  - A library in this format is accepted whole or not at all (D-33).
  - Still to be made in the app's FRD: FR-LIB-05 (contact optional, `formatVersion` as the minimum app version) and FR-LIB-07 (skipping songs only for release archives and snapshots).
- FDS draft 0.3, the owner's decisions on the open items (D-22 to D-28):
  - A set is a setlist in the manifest; each song is stored once, in a folder named after its song ID (O-03).
  - The Songbook app keeps reading release archives and snapshots, and the Editor converts them and plain ZIPs of folders (EDT-25, EDT-26; O-05).
  - Format version 1 has no attachments (O-02), and a library is saved as `.zbl`, recognised by content (O-07).
  - Song rules and limits follow the app's ChordPro profile and release archive (§6.6, §3.5; O-01, O-06); the sharing threshold is now 16 MiB.
  - A version can carry a change note (`changes`; O-08).
  - Still open: the test libraries (O-04), and for the app repository how songs of this format are referred to (O-09) and registering `.zbl` (O-10).
- FDS draft 0.2, after the requester's answers on pe1mew/Zangbundel-bibliotheek#1:
  - Libraries are identified by their library ID. The app asks when a new library has the title of an installed one (M-73).
  - The import compares versions in every case and names a downgrade, also when the key changes (M-74, `{versionNote}`). It asks at most one question and warns rather than refuses (D-17, D-19).
  - The Editor warns when a saved ZIP is larger than 20 MB, since messaging apps and e-mail may not send it (PKG-09, M-08).
  - The Editor and its messages come in Dutch, English and German (section 7.9).
  - New open items: the file extension (O-07) and a "what changed" note (O-08). O-03 now asks whether a set is a setlist, and O-05 whether the hand-zipped route stays.

### Added
- `design/webappTDS.md`, the technical design of the web app, draft 0.1: the Editor is a web app (TD-01) in `webapp/` (TD-02), running on nginx or Apache with PHP (TD-03), every design verified in a mock before it goes to a test server (TD-04), HTTPS (TD-05). Open questions TQ-01 to TQ-05, first among them whether libraries are processed in the browser or on the server.
- `design/webappGUI.md`, the GUI design of the web app, draft 0.1: screens and their behaviour (GD-02), with the colours, buttons and icons of the Zangbundel app (GD-01). Open questions GQ-01 to GQ-05.
- `design/FDS.md`, the functional design specification, draft 0.1 (2026-11-04): the library package format (ZIP, manifest with SHA-256 hashes, optional Ed25519 signature), the validation rules shared with the Zangbundel app, the Editor's behaviour, the app's import, and the user messages.
- The repository set up like the other Zangbundel repositories: `README.md`, `contributing.md`, `code_of_conduct.md`, `license.md`, `LICENSE` (Apache 2.0), `NOTICE`, `changelog.md`, `.editorconfig`, `.gitattributes`, `.gitignore`, and for AI coding agents `CLAUDE.md`, `memory/` and `.claude/review-profile.md`.
