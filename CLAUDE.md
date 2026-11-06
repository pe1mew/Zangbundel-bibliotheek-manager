---
stack: Web app in webapp/ on nginx or Apache with PHP (webappTDS TD-01 to TD-03); Markdown design specifications; ZIP, JSON, SHA-256, Ed25519; ChordPro
status: M0 in progress — repository part done (placeholder, nginx, release chain, runbook webapp/server/README.md); the owner's server steps and the web app itself to do
repo: github.com/pe1mew/Zangbundel-bibliotheek-manager
framework: agent-ready-projects v1.49.2
---

# Zangbundel bibliotheek-manager

<!-- Canonical project file for Claude Code. No AGENTS.md exists; if one is
     added later, this file stays canonical and AGENTS.md should say so. -->

The bibliotheek-manager is the **Editor** of `design/FDS.md`: an application in which scout leaders with average computer skills create, check, edit and optionally sign song libraries for the Zangbundel app, and save them as one ZIP. The Zangbundel app imports that ZIP, applies the same validation rules and shows whether it is signed and by which key. The FDS is at draft 0.7. The Editor is built as a web app in `webapp/` (nginx or Apache with PHP); its designs are written; milestone M0 (placeholder on `zangbundel.nl`, server set-up, signed release chain) is built in the repository, and the web app itself (M1 onwards) is not.

## Before You Start

| When | Read |
|------|------|
| Picking up where the last session left off | `memory/MEMORY.md` — **the index itself, not the topic files it lists**; those stay on demand. Nothing loads this file on its own, so if this row is missing it is simply never read. Keep it near the top — an open handoff is worthless one session late. |
| Starting any session (framework drift) | Compare the `framework: agent-ready-projects vX.Y.Z` line in this file's header against https://github.com/ducroq/agent-ready-projects/blob/master/CHANGELOG.md (or local clone if present). If the project is behind the latest released version, briefly surface the drift to the user before starting work. `/update-drift` does this triage. Don't auto-update — adopting changes is the engineer's call. |
| Changing what the manager must do, the package format, a validation rule or a message | `design/FDS.md` — requirements `PF/MF/SG/EDT/APP-nn`, rules `PKG/STR/MAN/SIG/SNG-nn` with severity, messages `M-nn`, open items `O-nn` (section 11), decisions `D-nn` (section 12). |
| Touching how the Zangbundel app reads songs or libraries today | The app repository `../Zangbundel` (github.com/pe1mew/Zangbundel): `design/song-format.md` defines the current `.zbl` release archive and the ChordPro profile. The FDS package format is a different, new format; the app reads both (FDS D-23). |
| Designing a screen, a control, a colour, an icon, or what happens when the user does something | `design/webappGUI.md` — decisions `GD-nn` and open questions `GQ-nn`; screens **and behaviour**. Colours, buttons and icons come from the app (GD-01). Every design is checked in the mock before it is built. |
| Choosing how the web app is built, served, tested or deployed, or adding a library or server dependency | `design/webappTDS.md` — decisions `TD-nn` and open questions `TQ-nn`. Libraries and keys are processed in the browser only; the server never receives them (TD-06 to TD-08). Domain `zangbundel.nl` and a test instance, both hosted on contabo6 (TD-09, TD-10; its config lives in `../contabo-vps-6`). |
| Planning or doing implementation work, or asking what comes next | `design/implementationPlan.md` — milestones M0 to M7 with work, requirements and exit checks; the manager on `test.zangbundel.nl`, a placeholder on `zangbundel.nl` (TD-20). |
| Touching keys, files, the network, a dependency, headers, the server, DNS or the deployment | `design/securityAssessment.md` — findings SF-nn, requirements SR-nn (binding, TD-18), release gate SC-nn, open questions SQ-nn. Repeat the assessment for any such change (SR-91). |
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
- **Library content and keys never leave the browser.** The web app processes them in JavaScript; PHP and the server only deliver the app's files and receive no library data (webappTDS TD-06 to TD-08).
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
│   ├── FDS.md                    ← functional design specification (canonical)
│   ├── webappGUI.md              ← web app screens, behaviour and look (GD-nn, GQ-nn)
│   ├── webappTDS.md              ← web app technical design: server, mock, deployment (TD-nn, TQ-nn)
│   ├── securityAssessment.md     ← security and privacy: findings SF, requirements SR, release gate SC
│   └── implementationPlan.md     ← milestones M0 to M7 for the test instance and the placeholder
├── webapp/
│   ├── mock/                     ← clickable mock of webappGUI (static HTML, CSS, JS; app icon CC BY-SA 4.0); never deployed
│   ├── placeholder/              ← zangbundel.nl until go-live: nl/en/de pages, privacy, security.txt (no script)
│   ├── test-holding/             ← test.zangbundel.nl until M1.4
│   ├── tools/                    ← build.py, sign-release.sh, check_headers.py (SC-01); release-key.pub once the owner makes it
│   └── server/                   ← nginx config, zbm-receive, zbm-release, zbm-verify timer; README.md = M0 runbook
├── memory/                       ← MEMORY.md index, gotcha-log.md, todo.md (committed, shared)
├── .claude/                      ← review-profile.md, launch.json (preview server webapp-mock)
├── README.md, changelog.md, contributing.md, code_of_conduct.md, license.md, LICENSE, NOTICE
├── .editorconfig                 ← UTF-8, LF, final newline
├── .gitattributes                ← LF for text; test-libraries/ byte-exact (-text)
└── .gitignore                    ← *.zbkey, built ZIPs, build output, raw/
```

Related repositories: the app `github.com/pe1mew/Zangbundel` (imports libraries, FDS section 8), the libraries `github.com/pe1mew/Zangbundel-bibliotheek` and `github.com/pe1mew/Zangbundel-bibliotheek-Drasva` (today in the `.zbl` format of the app's `design/song-format.md`).

## How to Work Here

```bash
# Serve the mock for review (or start "webapp-mock" from .claude/launch.json)
python -m http.server 8771 --directory webapp/mock --bind 127.0.0.1

# Trial build of a static site (a real release needs a clean, tagged tree: drop --allow-dirty)
python webapp/tools/build.py build --src webapp/placeholder --name placeholder --version 0.1.0 --allow-dirty --force

# SC-01 header check against a host (see webapp/server/README.md for --connect/--insecure/--auth)
python webapp/tools/check_headers.py zangbundel.nl

# M0 test in an Ubuntu 24.04 + nginx 1.24 container (start Docker Desktop first; Git Bash: MSYS_NO_PATHCONV=1)
docker build -t zbm-m0test webapp/server/test && docker run --rm -v "$PWD:/repo:ro" zbm-m0test bash /repo/webapp/server/test/run.sh

# Stage changes — never commit
git add design/ webapp/ changelog.md
```

Every notable change gets a line under `[Unreleased]` in `changelog.md` in the same staging step. Every source file starts with `SPDX-License-Identifier: Apache-2.0`. A release build needs a clean tree and a signed tag on HEAD (`git tag -s`); `--allow-dirty` builds are trials, accepted only on the test instance (`zbm-release activate --trial`).

## Commit Conventions

Imperative subject, under 72 characters, naming the document and its new version when a spec changes, as in `FDS draft 0.2: display order of sets and songs (O-03)`. The owner commits; an agent only proposes the message.
