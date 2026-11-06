# Zangbundel bibliotheek-manager

The Zangbundel bibliotheek-manager (*library manager*; the **Editor** of the specification) lets scout leaders with average computer skills create, check, edit and sign song libraries for the [Zangbundel](https://github.com/pe1mew/Zangbundel) app, without a command line, version numbers to keep by hand or folder structures to build.

The process it supports:

1. Open an existing library ZIP, or start a new library.
2. The manager checks the library's integrity and correctness, and lets the user maintain its sets and songs.
3. Optionally sign the library with the author's key.
4. Save it as a ZIP and publish it any way the user likes: e-mail, a messaging app, a website, a USB stick.
5. The Zangbundel app imports the ZIP, checks it, and shows whether it is signed and by whom.

## Status (4 November 2026)

**Version 0.1.0, design phase.** The functional design specification, [design/FDS.md](design/FDS.md), is at draft 0.7; the web app's design is in [design/webappGUI.md](design/webappGUI.md) and [design/webappTDS.md](design/webappTDS.md), with a clickable mock in `webapp/mock/`. The web app itself has no code yet.

- The manager is a web app at `zangbundel.nl`, hosted on the owner's server with a test instance; libraries and keys are processed in the browser and never sent to the server (webappTDS TD-01 to TD-17).
- `test-libraries/` holds 56 shared test libraries, one invalid case for nearly every rule of FDS section 6, with a checker (O-04). Still open: confirming the readings those cases had to make where the rules leave room (O-11).
- The import side of the specification (FDS section 8) is built in the Zangbundel app, not here.
- Milestone M0 of the [implementation plan](design/implementationPlan.md) is built in the repository: a placeholder page for `zangbundel.nl`, the nginx configuration for both hosts and a signed release chain, with a runbook in `webapp/server/README.md`. Nothing is installed on the server yet.

The [changelog](changelog.md) lists what changed and when.

## What the manager does

As specified in the FDS:

- **New or open.** Start a new library with a title, or open a library (`.zbl`). A ZIP of folders and song files, or a release archive of a git library, is taken in as a new library; a folder per set becomes a set.
- **Check.** Every rule of FDS section 6 (package, structure, manifest, signature, song) is applied while the user works. Messages are grouped by severity and lead to their location; errors block saving.
- **Edit.** Songs: add, edit, delete, as ChordPro text with live validation or through form fields that stay in step with the text. Sets: ordered setlists of the library's songs; a song can be in several sets.
- **Save.** The manager raises the version, asks for an optional note on what changed, writes the manifest with a SHA-256 hash of every file, and proposes the file name.
- **Sign.** Optional Ed25519 signing with a key file (`.zbkey`). The manager shows a key's fingerprint wherever it shows the key. A signed library opens read-only until its key is loaded; *Save as copy* starts a new library under a new key.
- **Nothing stored.** The manager keeps nothing between sessions: no libraries, no keys (FDS principle 5, EDT-02, EDT-64).

## Repository structure

```
design/                       the specification: FDS.md (what the manager does), webappGUI.md and webappTDS.md (the web app)
webapp/                       mock/ (design reference), placeholder/ and test-holding/ (static pages),
                              tools/ (build, sign, header check), server/ (nginx, release scripts, runbook)
memory/                       working memory for AI coding agents (index, gotcha log, to-do)
.claude/                      review profile for AI coding agents
CLAUDE.md                     orientation file for AI coding agents
```

The manager is built as a web app that runs on nginx or Apache with PHP. Each screen is checked in a mock first, then deployed to a test server. Code and test libraries follow.

## The documents

| Document | Read it when |
|---|---|
| [design/FDS.md](design/FDS.md) | You want to know what the manager must do: the library package format, the manifest, signing, the validation rules, the Editor's behaviour, the app's import, and every user message. Requirements are numbered (`PF-nn`, `EDT-nn`, `APP-nn`, …) and rules carry codes (`PKG-nn`, `SNG-nn`, …). |
| [design/webappGUI.md](design/webappGUI.md) | You design or review a screen of the web app: what it shows, what happens on each action, and its colours, buttons and icons, which come from the Zangbundel app. |
| [design/webappTDS.md](design/webappTDS.md) | You build, serve or deploy the web app: server (nginx or Apache with PHP), the mock, the test server. |
| [design/securityAssessment.md](design/securityAssessment.md) | You touch keys, files, the network, a dependency, the server or the deployment: the threats, and the requirements and release checks the implementation must meet. |
| [design/implementationPlan.md](design/implementationPlan.md) | You want to know how the manager is being built, in which order, and what has to pass before each step is done. |

The library format and the import rules in the FDS are shared with the [Zangbundel app](https://github.com/pe1mew/Zangbundel); the app and the manager must apply the same validation rules.

## Song libraries

This repository contains no lyrics and will not accept any. Libraries are made by their authors with the manager, on their own device. If you want to contribute songs, contribute to a library, such as [Zangbundel-bibliotheek](https://github.com/pe1mew/Zangbundel-bibliotheek), not here.

## Contributing

See [contributing.md](contributing.md) and the [Code of Conduct](code_of_conduct.md). The most useful help right now is a review of the FDS, especially from people who maintain a song library or support scout leaders, and answers to its open items through [GitHub issues](https://github.com/pe1mew/Zangbundel-bibliotheek-manager/issues).

If you use an AI coding agent, `CLAUDE.md` is its entry point; it follows the [agent-ready-projects](https://github.com/ducroq/agent-ready-projects) layout.

## License

See [license.md](license.md) for details.

The code in this repository is licensed under the Apache License 2.0 (see [LICENSE](LICENSE) and [NOTICE](NOTICE)). The documentation and other non-code content are licensed under a Creative Commons Attribution-NonCommercial 4.0 International License (http://creativecommons.org/licenses/by-nc/4.0/) by Remko Welling, PE1MEW (https://github.com/pe1mew).

<a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by-nc/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by-nc/4.0/">Creative Commons Attribution-NonCommercial 4.0 International License</a>.

## Disclaimer

This project is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
