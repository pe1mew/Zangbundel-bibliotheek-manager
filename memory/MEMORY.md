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
