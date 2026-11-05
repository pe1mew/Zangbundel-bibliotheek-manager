# Memory

<!-- NOT loaded automatically. Reached by the "Picking up where the last session
     left off" row in CLAUDE.md. Keep it lean — it is read in full whenever it is
     reached. Deep knowledge goes in topic files; this is the index.

     (Claude Code auto-loads a different file with the same name, the user-level
     one under ~/.claude/projects/<slug>/memory/. This one is the committed, shared
     project memory.)

     END-OF-SESSION CURATION (/curate):
     1. Review memory/gotcha-log.md for recurring patterns — promote them here or to topic files
     2. Retire entries below that are now encoded in the documents or CLAUDE.md
     3. Update "Current State" to reflect what changed -->

## Topic Files

| File | When to load | Key insight |
|------|-------------|-------------|
| `memory/gotcha-log.md` | Stuck or debugging | Problem-fix archive. No entries yet. |
| `memory/todo.md` | Asked what is planned, or about to start new work | The owner's to-do list: items the owner named for later, built only on the owner's word. |

## Current State

- **2026-11-04: repository set up.** `design/FDS.md` draft 0.1 came from a session in another repository. Root files follow the other Zangbundel repositories: code Apache 2.0 without Commons Clause (as the app), content CC BY-NC 4.0, agent files after the app repository's `CLAUDE.md`. No code, no CI, no check script yet.
- **Open before code:** the implementation technology (FDS 1.4, D-01) and the FDS open items O-01 to O-06. O-04 (shared test libraries) decides how "the app and the manager apply the rules identically" can be checked.
- **Two library formats exist.** The app and both library repositories use the `.zbl` release archive of the app's `design/song-format.md` section 12 (`zangbundel-archive.json`, `songs/<lang>/<id>.cho`, `zangbundel.json`). The FDS defines a new ZIP with `manifest.json`, set folders and song folders. How they relate is O-05.
- **2026-11-04: FDS draft 0.2** from Pepe's (pepe-hb9evt) answers on pe1mew/Zangbundel-bibliotheek#1: identity by library ID with a same-title question (M-73), downgrade warning in every case (M-74), warn but never refuse (D-17, D-19), 20 MB sharing warning (PKG-09), Editor in nl/en/de (7.9). The owner's step 3 comment on that issue still says the app "refuses" another key; the FDS warns instead. Pepe did not answer the message-language part of question 7 or "see what changed" (now O-08).
- **2026-11-04: FDS draft 0.3**, the owner's choices on the open items, all as recommended: sets are setlists in the manifest with songs stored once (D-22); the app keeps reading `.zbl` release archives, and the Editor converts them (D-23); no attachments (D-24); `.zbl` recognised by content (D-25); song rules and limits from the app's `design/song-format.md` (D-26); change note (D-27).
- **2026-11-04: FDS draft 0.4** from the app repository's proposal `design/proposals/2026-11-04-library-package-id-and-file-type.md` (owner-approved): D-29 libraryId used unchanged, D-30 Share/Open registration, licence in the manifest (D-31), maintainer optional (D-32), all-or-nothing import (D-33). **Waiting in the app repository:** amend FR-LIB-05 (contact optional, `formatVersion` as minimum app version) and FR-LIB-07 (skip songs only for release archives and snapshots), and mark the proposal approved. Open here: O-04 test libraries only.
- **2026-11-05: web app design started.** The Editor is a web app in `webapp/` on nginx or Apache with PHP; designs are checked in a mock before a test server (`design/webappTDS.md` TD-01 to TD-05). `design/webappGUI.md` covers screens and behaviour, with the app's colours, buttons and icons (GD-01, GD-02). TQ-01 decided: processing in the browser (TD-06 to TD-08, TDS draft 0.2). No screen written yet; NOTICE and license.md must name Material Icons and the app artwork in the change that copies them (webappGUI 2.3).
- **2026-11-05: webappGUI draft 0.2** holds the owner's GUI notes as GD-03 to GD-09 (startup like the app, four-area main screen, verse/chorus section editor with drag reorder, check on apply). The notes said *Songbook Dictionary Manager* and *dictionary*; the document uses *library* and asks for the name (GQ-06). Open points against the FDS: plain-text editing EDT-33 (GQ-14), profile parts beyond verse and chorus must round-trip unchanged (GQ-13), apply vs EDT-42/EDT-50 (GQ-12), "upload" wording vs TD-06 (GQ-08). Sets, library fields, validation panel and signing not yet placed (GQ-10 to GQ-12).
