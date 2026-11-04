# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/). The design documents carry their own document versions in their headers.

## [Unreleased]

### Changed
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
- `design/FDS.md`, the functional design specification, draft 0.1 (2026-11-04): the library package format (ZIP, manifest with SHA-256 hashes, optional Ed25519 signature), the validation rules shared with the Zangbundel app, the Editor's behaviour, the app's import, and the user messages.
- The repository set up like the other Zangbundel repositories: `README.md`, `contributing.md`, `code_of_conduct.md`, `license.md`, `LICENSE` (Apache 2.0), `NOTICE`, `changelog.md`, `.editorconfig`, `.gitattributes`, `.gitignore`, and for AI coding agents `CLAUDE.md`, `memory/` and `.claude/review-profile.md`.
