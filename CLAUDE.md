---
stack: Not chosen — web app (local or hosted) or native app for Windows, Linux or Android (FDS 1.4, D-01); Markdown design specification; ZIP, JSON, SHA-256, Ed25519; ChordPro
status: Design — FDS draft 0.2, no code yet
repo: github.com/pe1mew/Zangbundel-bibliotheek-manager
framework: agent-ready-projects v1.49.2
---

# Zangbundel bibliotheek-manager

<!-- Canonical project file for Claude Code. No AGENTS.md exists; if one is
     added later, this file stays canonical and AGENTS.md should say so. -->

The bibliotheek-manager is the **Editor** of `design/FDS.md`: an application in which scout leaders with average computer skills create, check, edit and optionally sign song libraries for the Zangbundel app, and save them as one ZIP. The Zangbundel app imports that ZIP, applies the same validation rules and shows whether it is signed and by which key. The FDS is at draft 0.2; the implementation technology is not chosen and no code exists.

## Before You Start

| When | Read |
|------|------|
| Picking up where the last session left off | `memory/MEMORY.md` — **the index itself, not the topic files it lists**; those stay on demand. Nothing loads this file on its own, so if this row is missing it is simply never read. Keep it near the top — an open handoff is worthless one session late. |
| Starting any session (framework drift) | Compare the `framework: agent-ready-projects vX.Y.Z` line in this file's header against https://github.com/ducroq/agent-ready-projects/blob/master/CHANGELOG.md (or local clone if present). If the project is behind the latest released version, briefly surface the drift to the user before starting work. `/update-drift` does this triage. Don't auto-update — adopting changes is the engineer's call. |
| Changing what the manager must do, the package format, a validation rule or a message | `design/FDS.md` — requirements `PF/MF/SG/EDT/APP-nn`, rules `PKG/STR/MAN/SIG/SNG-nn` with severity, messages `M-nn`, open items `O-nn` (section 11), decisions `D-nn` (section 12). |
| Touching how the Zangbundel app reads songs or libraries today | The app repository `../Zangbundel` (github.com/pe1mew/Zangbundel): `design/song-format.md` defines the current `.zbl` release archive and the ChordPro profile. The FDS package format is a different, new format; migration is open item O-05. |
| Choosing the implementation technology, or writing the first code | Open item: FDS 1.4 and D-01 leave it open. Ask the owner; record the choice as a decision in a design document before code lands. |
| Stuck or debugging something weird | `memory/gotcha-log.md` — problem-fix archive |
| **Before committing** | Diff-driven review, lenses chosen by what changed — `/review-changes`. It needs the per-repo **review profile** at `.claude/review-profile.md`; without one it STOPS rather than reviewing at LOW. |
| Ending a session | `memory/gotcha-log.md` — review, promote patterns, retire stale entries. Then `/curate`. |
| Periodic — monthly, after restructuring, and when cutting a release | `/audit-context` (structural health across the layers). No `/release` skill is installed: the project cuts no versioned releases yet. |

## Hard Constraints

- **Lead with the point; no narrative.** Each entry is a fact or a rule in a line or two. How it got that way goes in the changelog, not here: this file is loaded every session, and narrative is what grows it.
- **Never commit, push, merge or rebase.** Git is manual and the owner's. Stage the files, write a suggested commit message, then stop — also when asked to "save" or "finalise".
- **The FDS is the specification.** IDs (`EDT-nn`, `SNG-nn`, `M-nn`, `D-nn`, …) are never reused or renumbered; a withdrawn requirement is marked *Withdrawn* and kept. A change bumps the FDS status (`Draft 0.2`, …) and date. Every ID cited must be defined in the FDS.
- **One set of rules, all implementations identical.** The manager and the Zangbundel app apply the validation rules of FDS section 6 identically (principle 2), and every Editor implementation behaves the same (FDS 1.4). A rule changed here is a change to the app too: say so in the Zangbundel repository.
- **Nothing is stored between sessions; the private key never touches disk.** No library content, no keys, no library-bound settings survive a session (EDT-02). The private key lives in memory only: never in a file, browser storage, the OS keychain or a log (EDT-64). A hosted web version deletes session data at session end or after 2 hours idle and uses HTTPS (EDT-04, EDT-65).
- **Every library is untrusted input.** Apply the fatal package rules (PKG-01 to PKG-04: limits, path traversal, symlinks, encryption) before reading any entry; enforce the limits of FDS 3.5 against zip bombs.
- **Signing is byte-exact.** The Ed25519 signature covers the exact bytes of `manifest.json` as stored (SG-02); never reformat a signed manifest. `.zbkey` files are in `.gitignore`; never weaken that rule, and never commit a real key.
- **English prose, Dutch UI terms in parentheses.** Requirement key words follow RFC 2119. User messages are the texts of FDS section 9.
- **Never add lyrics to this repository.** Test libraries contain only public-domain songs or songs written for the test.
- **Honesty.** Never claim a check passed without running it, never claim a file exists without reading it, and never describe a design as "verified" when it has only been written.

## Architecture

The product, as specified:

```
 Author ── Editor (this repo) ── library ZIP ──▶ any channel (mail, chat, web, USB)
            │  open / new, validate (FDS 6), edit,                    │
            │  save: version+1, manifest.json (SHA-256 per file),     ▼
            │  optional Ed25519 manifest.sig with a .zbkey      Zangbundel app (../Zangbundel)
            └── keeps nothing between sessions                  import: same rules (FDS 6),
                                                                device memory per libraryId,
                                                                decision table (FDS 8.3)
```

The repository, today:

```
Zangbundel-bibliotheek-manager/
├── CLAUDE.md                     ← this file (Layer 1)
├── design/
│   └── FDS.md                    ← functional design specification (canonical)
├── memory/                       ← MEMORY.md index, gotcha-log.md, todo.md (committed, shared)
├── .claude/                      ← review-profile.md
├── README.md, changelog.md, contributing.md, code_of_conduct.md, license.md, LICENSE, NOTICE
├── .editorconfig                 ← UTF-8, LF, final newline
├── .gitattributes                ← LF for text; test-libraries/ byte-exact (-text)
└── .gitignore                    ← *.zbkey, built ZIPs, build output, raw/
```

Related repositories: the app `github.com/pe1mew/Zangbundel` (imports libraries, FDS section 8), the libraries `github.com/pe1mew/Zangbundel-bibliotheek` and `github.com/pe1mew/Zangbundel-bibliotheek-Drasva` (today in the `.zbl` format of the app's `design/song-format.md`).

## How to Work Here

```bash
# Stage changes — never commit
git add design/ changelog.md
```

Every notable change gets a line under `[Unreleased]` in `changelog.md` in the same staging step. Once code exists, every source file starts with `SPDX-License-Identifier: Apache-2.0`, and the build and test commands go here.

## Commit Conventions

Imperative subject, under 72 characters, naming the document and its new version when a spec changes, as in `FDS draft 0.2: display order of sets and songs (O-03)`. The owner commits; an agent only proposes the message.
