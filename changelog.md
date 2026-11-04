# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/). The design documents carry their own document versions in their headers.

## [Unreleased]

### Changed
- FDS draft 0.2, after the requester's answers on pe1mew/Zangbundel-bibliotheek#1:
  - Libraries are identified by their library ID. The app asks when a new library has the title of an installed one (M-73).
  - The import compares versions in every case and names a downgrade, also when the key changes (M-74, `{versionNote}`). It asks at most one question and warns rather than refuses (D-17, D-19).
  - The Editor warns when a saved ZIP is larger than 20 MB, since messaging apps and e-mail may not send it (PKG-09, M-08).
  - The Editor and its messages come in Dutch, English and German (section 7.9).
  - New open items: the file extension (O-07) and a "what changed" note (O-08). O-03 now asks whether a set is a setlist, and O-05 whether the hand-zipped route stays.

### Added
- `design/FDS.md`, the functional design specification, draft 0.1 (2026-11-04): the library package format (ZIP, manifest with SHA-256 hashes, optional Ed25519 signature), the validation rules shared with the Zangbundel app, the Editor's behaviour, the app's import, and the user messages.
- The repository set up like the other Zangbundel repositories: `README.md`, `contributing.md`, `code_of_conduct.md`, `license.md`, `LICENSE` (Apache 2.0), `NOTICE`, `changelog.md`, `.editorconfig`, `.gitattributes`, `.gitignore`, and for AI coding agents `CLAUDE.md`, `memory/` and `.claude/review-profile.md`.
