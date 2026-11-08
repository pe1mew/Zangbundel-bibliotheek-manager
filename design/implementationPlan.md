# Implementation Plan — Bibliotheek-manager web app

| | |
|---|---|
| **Document** | Plan for implementing the bibliotheek-manager web app on the test instance, with a placeholder on the production domain |
| **Status** | Draft 0.18 |
| **Date** | 2026-11-08 |
| **Depends on** | `design/FDS.md` draft 0.12, `design/webappGUI.md` draft 0.23, `design/webappTDS.md` draft 0.14, `design/securityAssessment.md` draft 0.14, `test-libraries/` (59 cases) |

---

## 1. Goal and scope

### 1.1 Goal

Build the bibliotheek-manager as specified, and run it on **`test.zangbundel.nl`** for testers, while **`zangbundel.nl`** shows a static **placeholder** until the owner decides to go live (milestone M8, outside this plan's scope).

The request named `test.zangbundel.net`; the owner confirmed `test.zangbundel.nl`, a subdomain of the registered domain (IQ-01, webappTDS TD-09).

### 1.2 What "done" means

The manager on `test.zangbundel.nl` does everything the FDS asks of the Editor (§7) for format version 1, behaves as the GUI design describes (GD-01 to GD-40), and passes the release gate of the security assessment (SC-01 to SC-13). The placeholder on `zangbundel.nl` meets the same transport, header and privacy requirements, and has no script at all.

### 1.3 Not in scope

- Going live on `zangbundel.nl` with the manager (M8: criteria listed in section 9, decision later).
- The Songbook app's import (app repository), and the open readings of FDS O-11, except where they change an `expected.json` (risk R-02).
- A user manual beyond a first draft (M7).

### 1.4 The governing documents

| Document | Governs |
|---|---|
| `design/FDS.md` | What the Editor does: format, rules (§6), behaviour (§7), messages (§9) |
| `design/webappGUI.md` | Screens and behaviour, GD-01 to GD-40 |
| `design/webappTDS.md` | Technology, hosting, libraries, TD-01 to TD-21 |
| `design/securityAssessment.md` | Binding security requirements SR-nn and the release gate SC-nn (TD-18) |
| `test-libraries/` | The expected findings for 56 libraries, the conformance test of the validator |
| `webapp/mock/` | Reference for look and behaviour only. Its code is not reused: it builds HTML with `innerHTML`, uses `style` attributes and keeps keys on the main thread, which SR-24, SR-32 and SR-40 forbid |

Where the plan and a governing document differ, the document wins and the plan is corrected.

---

## 2. Target situation

```
 zangbundel.nl            placeholder: one static page per language, no script   (TD-20)
   /                      redirect to the browser's language (nginx, Accept-Language)
   /nl/ /en/ /de/         the placeholder text, links, the app badges
   /privacy/              privacy statement (SR-52), three languages
   /.well-known/security.txt                                                   (SR-92)

 test.zangbundel.nl       the manager, behind basic authentication              (TD-13, SR-80)
   /                      index.html and hashed assets
   /privacy/              privacy statement
   /.well-known/security.txt

 Both: host nginx on contabo6, native, read-only release directories (TD-19, SR-70);
       headers, TLS, shortened IP logs as securityAssessment §7.1.
```

### 2.1 The placeholder

| Element | Content |
|---|---|
| Name and logo | *Zangbundel bibliotheek-manager* (GD-26) with the app icon (GD-30), on the app's black background (GD-12) |
| Text | One short paragraph: the manager for making song libraries for the Zangbundel app is being built; it will run here. No date (IQ-06). |
| Links | The Android panel's content of GD-15 and GD-35 (badges marked *binnenkort*, the GitHub APK, both repositories, both manuals) |
| Privacy | Link to `/<lang>/privacy.html`, one statement per language |
| Languages | Dutch, English and German as separate static pages. nginx sends `/` to the first matching language in `Accept-Language`, else English; each page links to the other two |
| Technology | HTML and CSS only. CSP as SR-20 but with `script-src 'none'; worker-src 'none'`. Same headers, TLS and logging as the manager |

The placeholder is not hidden behind a password and may be indexed by search engines.

---

## 3. Architecture of the implementation

### 3.1 Repository layout

```
webapp/
├── mock/                     the clickable mock (kept as design reference, never deployed)
├── src/                      the web app
│   ├── index.html            no inline script or style (SR-24)
│   ├── privacy/              privacy statement, three languages
│   ├── app/                  main thread: UI, rendering with DOM APIs, i18n, state
│   │   ├── dom.js            the element builder; the only place that touches the DOM directly
│   │   ├── screens/          splash, home, library, song view, editor, sets, panels, dialogs
│   │   ├── i18n.js           texts in nl, en, de (GUI and FDS §9); split per language when it grows
│   │   ├── version.js        the version on the splash; build.py checks it against --version
│   │   └── storage.js        localStorage allow-list: zbm.lang, zbm.bars (SR-42)
│   ├── core/                 pure functions, no DOM, no workers: runs in workers and in tests
│   │   ├── zip.js            reading with limits, writing deterministically (on fflate)
│   │   ├── manifest.js       §4: parse, check, write
│   │   ├── chordpro.js       the ChordPro profile: parse, canonical form, blocks <-> text (GD-18, GD-19)
│   │   ├── validate.js       §6: every rule with its code, severity and message parameters
│   │   ├── view.js           §3.7: write and check the 1.1 view
│   │   ├── convert.js        EDT-25, EDT-26: plain ZIPs and release archives
│   │   ├── names.js          PF-20 to PF-23, song IDs (EDT-36), file names (SR-36)
│   │   └── fingerprint.js    SG-20
│   ├── workers/
│   │   ├── library-worker.js reads and writes libraries with core/ (SR-30, SR-31)
│   │   └── crypto-worker.js  keys and signing (SR-40, SR-41, SR-15, SR-16)
│   ├── assets/               app.css (all styles; no inline styles), icon, photograph
│   └── .well-known/          security.txt (SR-92)
├── vendor/                   fflate 0.8.3, @noble/ed25519 3.2.0, VENDOR.md with hashes (SR-12)
├── tests/                    test_build.py, test_bundle.py, test_vendor.py; unit/*.test.mjs and conformance.test.mjs (node --test); fuzzing later
├── package.json              development only: "type": "module" for node --test; no dependencies
├── tools/
│   ├── build.py              offline, reproducible: hashed names, SRI, release-manifest.json (SR-10, SR-13)
│   ├── bundle.py             one bundle per entry point from a subset of ES modules (webappTDS TD-22)
│   ├── vendor.py             vendors a package: integrity, signatures, provenance, advisories; writes VENDOR.md (SR-12, SR-14)
│   ├── sign-release.sh       signs the manifest with the release key (SR-11)
│   ├── check_headers.py      SC-01 against a live host
│   └── release-key.pub       public release key
├── placeholder/              the placeholder site (section 2.1)
├── test-holding/             the test instance's holding page until M1.4 (M0.5)
└── server/                   nginx config, zbm-receive, zbm-release, the zbm-verify timer and the
                              M0 runbook (README.md); the live copies are kept in ../contabo-vps-6 (SR-75)
```

### 3.2 Threads

| Thread | Holds | Talks to |
|---|---|---|
| Main thread | The UI, the current library as plain data, the language and preferences | Both workers, by messages with plain data only |
| `library` worker | ZIP bytes while reading or writing, `core/` | Main thread |
| `crypto` worker | The private key (non-extractable Web Crypto key, or `Uint8Array` for `@noble/ed25519`) | Main thread: receives bytes to sign, returns signatures, public key, fingerprint; returns key-file bytes only for an explicit download |

The library worker computes hashes and builds the manifest; the main thread sends the manifest bytes to the crypto worker for signing and passes the signature back to the library worker for the ZIP. The private key never leaves the crypto worker except as the key file the user asked to download (SR-40).

### 3.3 Tools

| Tool | Use | State |
|---|---|---|
| Python 3.11 (standard library) | `build.py`, `vendor.py` support, the test libraries | Installed |
| Node.js LTS with npm | Unit and conformance tests (`node --test`, no test framework), vendoring checks (`npm pack`, `npm view`, `npm audit signatures`). Development only: nothing from npm reaches the site except the two vendored files (TD-21) | To install (IQ-02, decided) |
| A written browser checklist | SC-03, SC-06, SC-07 by hand in M4 to M6; a headless browser only if the checklist proves error-prone (IQ-03, decided) | `webapp/tests/browser-checklist.md`, to write in M4 |
| `testssl.sh` | SC-02 | On the owner's machine or the server |

---

## 4. Milestones

Each milestone ends with its exit checks passing and the result written to `design/test-results/` (SR, SC numbers as in the security assessment). Sizes are relative: S (a day or two), M (a few days), L (a week or more of focused work).

### M0 — Infrastructure and placeholder (M)

| # | Work | Requirements |
|---|---|---|
| M0.1 | DNS: A for `zangbundel.nl` and `test.zangbundel.nl` to contabo6, AAAA once contabo6 has working IPv6; CAA (Let's Encrypt, `accounturi`, `iodef`); no MX, because Openprovider refuses a null MX (securityAssessment SR-07), with port 25 closed; SPF `-all`; DMARC `reject`; empty DKIM | SR-03, SR-07, §7.2 |
| M0.2 | Registrar: confirm two-factor authentication on registrar and DNS accounts; `.nl` has no transfer lock (SR-05) | SR-05 |
| M0.3 | Certificates for both hosts with certbot; check certbot left the headers intact | SR-01 |
| M0.4 | nginx vhosts for both hosts as securityAssessment §7.1: headers, HSTS (start at 5 minutes, ramp up), method and dot-file rules, rate limits, shortened IP logs with 14-day rotation | SR-01, SR-02, SR-20 to SR-25, SR-51, SR-60, SR-61 |
| M0.5 | Basic authentication for `test.zangbundel.nl`, `X-Robots-Tag: noindex`, a holding page until M1 | SR-80, SR-81 |
| M0.6 | Release directories, the deploy user with a forced command, the activation script, the hourly file-integrity check | SR-11, SR-73, SR-74 |
| M0.7 | Release key pair (public part in `webapp/tools/release-key.pub`) | SR-11 |
| M0.8 | Placeholder pages in three languages, privacy statement, `security.txt`; deploy through the release procedure | §2.1, SR-52, SR-92 |
| M0.9 | External monitoring of both hosts (availability, certificate expiry, headers); Certificate Transparency alert | SR-06, SR-62 |

**Exit:** SC-01, SC-02, SC-09, SC-12 and SC-13 pass for both hosts; the placeholder is live on `zangbundel.nl`.

**State (2026-11-06).** The repository part of M0 is done: M0.4 to M0.6 and M0.8 are in `webapp/server/`, `webapp/placeholder/`, `webapp/test-holding/` and `webapp/tools/`. It was tested in an Ubuntu 24.04 container with nginx 1.24.0, throwaway keys and self-signed certificates (`webapp/server/test/run.sh`, 68 of 68 checks, SC-01 for both hosts; `webapp/tests/test_build.py`), and reviewed in two rounds with `/review-changes` (drafts 0.4 and 0.5). M0.1 to M0.3, M0.7, M0.9, the installation and the exit checks are the owner's steps, in the order of the runbook `webapp/server/README.md`. **2026-11-07: M0.1 and M0.2 done by the owner**, apart from the CAA `accounturi`, which waits for the certificates. Two deviations, accepted: no MX, and no transfer lock (securityAssessment draft 0.13, SR-05, SR-07). **2026-11-07: runbook step 4 installed on contabo6**: the files, users, folders and the port-80 bootstrap vhost, checked from outside. **Later the same day:** step 3's keys were made on the owner's computer, and the key parts of step 4 installed. The deploy key reaches only `zbm-receive`, tested. Git tag signing set up the same day with a dedicated key (`git-signing`), which completes M0.7. **M0.3 done the same day (runbook step 5):** both certificates issued; CAA bound to certbot's production and staging accounts; the renewal dry run succeeds for both. **Runbook step 6 done too:** both HTTPS sites enabled and checked from outside (TLS 1.2 and 1.3 only, the headers, the password on the test instance). **Runbook step 7 done too (M0.8):** `placeholder-0.1.0` is live on `zangbundel.nl` and `test-holding-0.1.0` on the test instance. Both are signed releases from the tag `placeholder-0.1.0`. SC-01 passes 25 of 25 for `zangbundel.nl` and 16 of 16 for the test instance, behind its password, with `--app`. Left of M0: step 8 (the hourly integrity check and monitoring), step 9 (HSTS ramp) and step 10 (the release gate).

### M1 — Toolchain and release pipeline (M)

| # | Work | Requirements |
|---|---|---|
| M1.1 | Repository layout of 3.1; `build.py` (written in M0 for static pages: hashed names, SRI, `release-manifest.json`, identical rebuilds) extended to the app's scripts and workers by bundling each entry point (webappTDS TD-22), and to the web manifest; reproducibility check (two builds, identical bytes) | SR-10, SR-13, SR-61 |
| M1.2 | Vendor `fflate` 0.8.3 and `@noble/ed25519` 3.2.0 with `vendor.py`: integrity, provenance, `VENDOR.md`, `NOTICE` | SR-12, SR-14 |
| M1.3 | Test runner: `node --test` for `core/`; the conformance runner reading `test-libraries/*.expected.json` | SR-34 |
| M1.4 | A minimal app (the splash only) built, signed, deployed to the test instance and activated | SR-11, SR-84 |
| M1.5 | `check_headers.py --app` (SC-01, written in M0) run against the test instance once the manager is on it; the host's CSP line in `conf.d/zangbundel.conf` switched to the SR-20 policy | SC-01 |

**Exit:** a signed build reaches `test.zangbundel.nl` end to end; SC-08 and SC-09 pass.

**State (2026-11-06).**
- **M1.1 done.** `webapp/tools/bundle.py`; `build.py` bundles each entry point, checks each bundle with `node --check`, and refuses JavaScript that names a renamed asset or a `--version` that differs from `app/version.js`. Tested in the repository: `webapp/tests/test_bundle.py` (33 checks, run in Node: bundles give the same result as the native modules, and the refusals) and `webapp/server/test/run.sh` (two builds byte-identical). The vendored fflate and @noble/ed25519, bundled, behave as the native modules (`webapp/tests/test_vendor.py`, including RFC 8032 test 1).
- **M1.4 built, not deployed.** The minimal app is in `webapp/src/` (splash, then a card). In the container test it is signed, activated on the test instance as a trial build and passes SC-01 with `--app`; a manual check in the browser pane (not in the repository's tests): it ran under the SR-20 CSP and `Integrity-Policy` without a report, and copies with a missing or a wrong script integrity were refused. Deploying it waits for M0's server steps.
- **M1.5, configuration part:** the test instance's CSP is now the SR-20 policy.
- **M1.2 done.** `webapp/tools/vendor.py` vendored both libraries into `webapp/vendor/` with `VENDOR.md`; `NOTICE` and `license.md` name them. Integrity, signatures and advisories were checked; provenance was verified for `@noble/ed25519`, while `fflate` 0.8.3 publishes none (securityAssessment 7.4).
- **M1.3 done as far as M1 can go.** `node --test webapp/tests/` runs the unit tests (`tests/unit/`) and `tests/conformance.test.mjs`: corpus integrity for all 56 cases now. The 56 Editor comparisons (SC-04) are reported as to-dos until `src/core/validate.js` exists (M2).
- **The container test** (`webapp/server/test/run.sh`) runs all of these: 80 of 80.

### M2 — Library engine (L)

| # | Work | Requirements |
|---|---|---|
| M2.1 | `zip.js`: central-directory limits before inflating, bounded inflation, path rules, encrypted flag, case clashes, ignored system files; deterministic writer | FDS §3, PKG-01 to PKG-09, SR-31 |
| M2.2 | `manifest.js`, `names.js`, `fingerprint.js` | FDS §4, PF-14, PF-20 to PF-23, SG-20 |
| M2.3 | `chordpro.js`: the profile's parser, canonical form (EDT-57), blocks to text and back without loss (GD-18, GD-19), locked blocks kept byte-exact | FDS §6.6, song format §5 to §8 |
| M2.4 | `validate.js`: every rule of §6 with code, severity, message ID and parameters; Editor and app severities | FDS §6, §9 |
| M2.5 | `view.js`: write and check the 1.1 view, byte-exact | FDS §3.7, VIEW-01 to VIEW-03 |
| M2.6 | Signature verification through the crypto worker's public functions | SIG-01 to SIG-03 |
| M2.7 | `convert.js`: plain ZIPs and release archives into this format | EDT-25, EDT-26 |
| M2.8 | `library-worker.js` with a 20-second time limit per file; the Trusted Types policy `zbm-worker` that starts it (webappTDS TD-23) | SR-30, SR-31, SR-20 |
| M2.9 | Fuzzing of the ZIP and ChordPro readers, corpus from `test-libraries/` | SR-35 |

**Exit:** all 59 test libraries give exactly their expected findings (SC-04); a valid library opened and saved without changes is byte-identical (EDT-51); fuzzing ran without crash or hang (SC-11).

**State (2026-11-06).**
- **SC-04 met:** all 58 test libraries (56 until FDS draft 0.10 added the two tag-label cases) give exactly their expected Editor findings, every rule family of FDS section 6 (`webapp/tests/conformance.test.mjs`, 0 to-dos). Seeded defects turn cases red: SIG-03 skipped, STR-08 for a second `.cho`, SNG-10 case-sensitive, SET-03 skipped, phase 2 directives not listed.
- **Done:** M2.1, M2.2, M2.4 and M2.6, and the reading half of M2.3 and M2.5.
  - `webapp/src/core/`: `zip.js`, `names.js`, `manifest.js`, `fingerprint.js`, `validate.js`.
  - `chordpro.js` gives the canonical form, the metadata, the environments, the chorus repeats and the canonical line list. On the corpus's `vuur-in-de-nacht` it gives the 18 lines of the song format's worked example (§9.3): the count, the first and last line, and lines 15–18 repeating 5–8 are tested; the section labels and the lines in between are not.
  - The view checks generate the exact PF-42 and PF-43 bytes.
- **Also tested:** the bundled engine gives the same findings as the native modules on all 56 libraries (`webapp/tests/test_engine_bundle.py`).
- **Readings beyond the test libraries:**
  - `{album: …}` is a known directive (song format §5.3 calls `album` a standard name).
  - VIEW-03 checks `min_app_version` against 0.1.0, the value PF-41 fixes, so a view that would lock out an app from 0.1.0 is reported.
  - SNG-17's 254-line bound counts the canonical line list with chorus repeats (song format W004).
- **Writing (M2.1 writer, M2.5 writer, EDT-51 to EDT-58, EDT-71):**
  - `zip.js` `writeZip` writes deterministically; `view.js` writes the 1.1 view, and VIEW-02 checks against the same functions.
  - `library.js` opens a library into an in-memory model and saves it. An unchanged library is saved byte for byte as opened, signature included (EDT-51). A changed one is built, with version + 1, `modified`, an optional `changes`, canonical songs and a new view, signed with the library's own key or a newly loaded one.
  - Every save runs the rules of section 6 on its own output and is refused on an Error (EDT-50). PKG-09 is added.
  - Tested in `tests/unit/library.test.mjs` (10 tests, two seeded defects caught):
    - EDT-51 on both reference libraries;
    - a changed library that reopens to the same model;
    - identical bytes from two builds;
    - signing with the RFC 8032 key, and refusal of a foreign key;
    - Save as copy of a signed library;
    - a refused save, and a new library needing its licence and maintainer;
    - the §3.3 names.
- **Reviewed 2026-11-07** (`/review-changes`, three lenses on 0f87a7e..8c22e37). The confirmed findings are fixed, each with a regression test that fails on the reviewed code:
  - **inflation stopped at the declared size** (it ran to the end of the stream before, SR-31);
  - **strict Ed25519 for SIG-03:** noble's default accepted a forged signature under a small-order key;
  - **ZIP structure:** local headers must agree with the directory; overlapping entries, empty or `.` segments, and a file and folder of one name are refused;
  - **no throw on hostile manifests;** linear trimming (SR-33);
  - **EDT-50 before EDT-51;** set names that would inject setlist lines (MAN-02);
  - **copies independent of the original;** dropped files reported; non-UTF-8 songs kept as found; `__proto__` fields kept.

  The readings this needed are listed in FDS O-11 (draft 0.8) for the app to confirm. `node --test` 220 of 220, container 81 of 81.
- **M2.8 done.** The library worker runs `src/workers/library-handler.js`: validate, open, save, copy, new; answers are structured data only (SR-30).
  - `src/app/library-client.js` starts it through the Trusted Types policy `zbm-worker` (`src/app/trusted.js`, TD-23). A request still open after 20 s ends the worker with PKG-02 (M-02); the next request starts a new one (SR-31).
  - **Tested in `tests/unit/library-worker.test.mjs`:** the real handler behind a fake worker, the timeout, recovery from a worker error, and a seeded missing `terminate`.
  - **Checked once in the browser pane,** not in the repository's tests: a scratch page built with `build.py` and served under the SR-20 CSP and Trusted Types ran the bundled worker through `zbm-worker`, and a raw `new Worker()` was refused.
  - **Still to come:** signing a library goes through the crypto worker (M3); the screens use the client from M4.
- **M2.9 done (SC-11).** `tests/fuzz.mjs` mutates the 56 test libraries: bytes, cuts, splices, directory and local-header fields, song text, manifest JSON. Every input must give findings without throwing (validate, open, save) within 2 s.
  - **Long run** (`node webapp/tests/fuzz.mjs --iterations 20000 --seed 1`, 2026-11-07): 20,000 libraries and 2,000 random songs, 0 failures; slowest input 577 ms, memory at most 296 MB, about 40 different first findings reached.
  - **Short run:** every `node --test` runs 400 libraries and 300 songs.
  - **The fuzzer finds real defects:** on the pre-review code it found the save that threw instead of refusing (111 hits in 6,000).
- **M2.7 done (EDT-21, EDT-25, EDT-26, EDT-36).** `src/core/convert.js` turns a ZIP without `manifest.json` into a new, unsigned library; `openLibrary` calls it and validates the result, so the screens get the converted library, its findings and a report for M-41 and M-42.
  - **Release archive or snapshot** (`zangbundel-archive.json` or `zangbundel.json`): the songs under `songs/` keep their IDs; title, description, licence (with the licence file as `license.text`) and maintainer come from `zangbundel.json`; a setlist becomes a set with the entries that name this library's songs, and the other entries are reported.
  - **Folders of song files:** every `.cho` becomes a song; `<set>/<song>/<file>.cho` places it in the set, in order of the song folders; identical text is stored once.
  - **Song IDs:** a valid `{meta: id}` is kept, then (in a repository) the file name, else one is proposed from the title (EDT-36) and made unique with `-2`, `-3`; the ID is written into the song. Files that are not songs are left out and listed.
  - **Readings beyond the FDS:** a setlist's set is named by its `{title}`, else its file name; a description equal to the title is dropped; a song that is not UTF-8 is taken over as found, so the save names SNG-01; songs outside `songs/` in a repository are left out.
  - **Tested in `tests/unit/convert.test.mjs`:** the corpus snapshot (`manifest-missing`, saved cleanly), a release archive built in the test, plain folders with a shared song, a proposed and a colliding ID, a left-out file, and a non-UTF-8 song. The fuzzer opens every mutated ZIP that lost its manifest through conversion and reports how many: the long run (seed 1, 2026-11-07) converted 101 of 20,000 inputs, with 0 failures, slowest input 531 ms, at most 299 MB.
- **Whitespace as song format v0.24** (FDS draft 0.9, O-11): directive names and values, the `meta` split, setlist lines and the set-name check trim or test spaces and tabs only, no longer JavaScript's `trim()` and `\s`, which also remove a no-break space and U+FEFF. Four regression tests in `tests/unit/whitespace.test.mjs` fail on the code before.
- **Comments and display text as song format v0.25** (FDS draft 0.9, O-11): a comment is a line whose first character is `#`, so `  # x` is a lyric line; the display text drops trailing spaces and Unicode Zs, Zl and Zp, so a no-break space too. The app's vectors `comment-indented` and `nbsp-display` give its line lists and canonical hashes (`tests/unit/whitespace.test.mjs`). W014, the validator's warning for an indented `#`, is not shown: the owner chose no new Editor rule.
- **Tag labels** (FDS draft 0.10, D-44): the manifest's optional `tags` is checked by MAN-02 (`tagsProblem` in `manifest.js`), kept in the model as `tags`, written into the manifest and never into the view, copied by Save as copy, and carried over from `zangbundel.json` on conversion, with what breaks §4.1 left out and listed as `tagsLeftOut`. The test libraries `tag-labels` and `tag-label-invalid` bring the corpus to 58 (SC-04: 58 of 58); `tests/unit/tags.test.mjs` has 5 tests. Editing the labels is a screen (M4 or M5, webappGUI GQ-20).
- **Done since (2026-11-07):** M2.3's block form, `core/blocks.js`, before M5.3 needs it.
  - `toBlocks(text)`: the song in file order as metadata lines, sections (verse, chorus, bridge, implicit verses), chorus repeats and locked blocks.
  - A verse, chorus or bridge environment is an editable section. A `{comment}`, a `#` note, an unknown directive or a malformed line inside it is a locked line in its place (`{ locked: line }`), and the section stays editable around it (GD-19 as clarified by the owner, webappGUI draft 0.20). A locked line may be left out but not changed, doubled or made up. An environment not closed by its own end, and tab, grid, ABC and unknown environments, are locked as a whole for the *Code (ChordPro)* mode (GD-38); so are comments, layout and unknown directives outside sections. Locked runs of lines are merged.
  - `fromBlocks(form)`: a block that still equals how it was read is written back as its original lines, so switching modes without a change gives the song back byte for byte (GD-38). A changed block is written canonically (EDT-57): `{start_of_<kind>[: label]}`, `{chorus[: label]}`, `{name: value}` or `{meta: name value}`. An implicit verse stays implicit while it has no label and no blank line. Locked blocks are never rewritten (GD-19).
  - It refuses what would change meaning: a typed line that would be a directive, a `#` comment or contain a control character (`lyricLineProblem`, GD-07), a label or value with a brace (`valueProblem`). The editor will check these while typing.
  - `metaValues` and `setMeta` read and set a metadata field in place; a new field joins the song's head (EDT-34, GD-05).
  - `chordpro.js` `readLine` classifies one line by the parser's own rules; the worker has ops `blocks` and `unblocks` (the latter answers a problem, never half a song).
  - **Tested:** `tests/unit/blocks.test.mjs`, 10 tests. All 401 songs of the test libraries come back byte for byte, also after `structuredClone`. Others cover: edits written canonically with the locked blocks byte-exact; kinds, labels and implicit verses; new and reordered blocks; refused lines and values; metadata; 3,000 random songs round-tripped and edited; the worker ops.
  - **Fuzz:** the ChordPro part of `fuzz.mjs` now also runs `songView` and the block round trip. `--iterations 20000` passed: 20,000 library and 2,000 ChordPro iterations, no failures.
  - `node --test`: 344 of 344, after the clarification of GD-19 (a test of a section edited around its remark). Long fuzz and container test (81 of 81) rerun after it.

### M3 — Keys and signing (M)

| # | Work | Requirements |
|---|---|---|
| M3.1 | `crypto-worker.js`: make, load, export, sign, public key, fingerprint, forget | FDS §5, SR-40, SR-41 |
| M3.2 | Hybrid Ed25519: Web Crypto with non-extractable keys where available, `@noble/ed25519` elsewhere | SR-16, TD-17 |
| M3.3 | Known-answer self-test (RFC 8032 test 1, SHA-256) and cross-check | SR-15 |
| M3.4 | Key file reading and writing (FDS §5.3, SG-05, SG-11), including the RFC 8032 test key and `key-wrapped` refusal | SG-05, SG-10 to SG-12 |

**Exit:** SC-05 in every browser of TD-15; signing the reference library reproduces `valid-signed.zbl`'s signature; SC-06 for the key flows.

**State (2026-11-07).** M3.1 to M3.4 are written and tested in Node; the exit is met in Chromium only.
- **Modules:**
  - `core/keyfile.js` reads and writes key files. A damaged file, or a key wrapped in DER as `openssl` writes it, is M-31.
  - `core/ed25519.js` holds the hybrid signer and the SR-15 self-test.
  - `workers/crypto-handler.js` and `crypto-worker.js` run the operations `selftest`, `make`, `exportKeyFile`, `load`, `info`, `sign`, `serve` and `forget`.
  - `app/crypto-client.js` starts the worker through `zbm-worker`, and ends it on `forget` and on `pagehide`.
- **The key's life (SR-40, SR-41, SR-16):**
  - A new key signs only after its key file was exported, once, with M-64 acknowledged (EDT-61).
  - After that export, or right after loading, the key is kept only as a non-extractable Web Crypto key, and its seed is overwritten with zeros. Where the browser has no Ed25519 in Web Crypto, `@noble/ed25519` keeps the seed instead.
  - No answer of the worker carries the private key, except the key file's bytes on that one export.
- **Signing a save:** the library worker asks the crypto worker for the signature over a `MessagePort` (`library-handler.js` `portSigner`), so the manifest bytes and the signature never pass the main thread.
- **The crypto worker's bundle** holds no library code: no fflate and no validator (`test_engine_bundle.py` checks this).
- **Tested in `tests/unit/crypto.test.mjs`:** 11 tests, on both Ed25519 paths. They cover:
  - the exit check: the RFC 8032 test key signs `valid-signed`'s manifest with exactly its `manifest.sig`;
  - SG-11 (M-31) and EDT-62 (M-30);
  - an unsigned library saved signed across both workers, which passes SIG-03;
  - the save refused for a key not yet exported;
  - the client's `forget` and `pagehide`.
- **Checked once in the browser pane (Chromium), not in the repository's tests.** A scratch page built with `build.py` was served under the SR-20 CSP with Trusted Types (`upgrade-insecure-requests` left out on plain http).
  - The self-test passed with Web Crypto, including the non-extractable key.
  - Make, export and sign worked, and signing before the export was refused.
  - The test key gave fingerprint `21FE-31DF-A154-A261` and RFC 8032's signature, also over the `MessagePort`.
  - After `forget`, local and session storage, cookies, IndexedDB and Cache Storage were empty (SC-06, as far as the worker goes).
  - A raw `new Worker()` was refused.
- **Still open for the exit:**
  - SC-05 in Firefox and Safari; Edge shares Chromium's engine but is to be run as well.
  - SC-06 through the app's own key flows, once they exist (M6).
  - The screens for making, loading and forgetting a key, M-64 and the idle timer (SR-46, GD-39, GD-40) come with M4 to M6.

### M4 — Application shell (L)

| # | Work | Requirements |
|---|---|---|
| M4.1 | `dom.js` element builder; Trusted Types policy `zbm-download`; no `innerHTML` anywhere (a lint check in the build fails on it) | SR-24, SR-32 |
| M4.2 | i18n in nl, en, de; language from the browser and the bottom bar; remembered | GD-17, GD-34, EDT-80 to EDT-83 |
| M4.3 | Layout: four areas, resizable and foldable bars, splash with photograph (3 s), narrow-window page, colours, buttons, icons | GD-01, GD-03, GD-04, GD-10, GD-12, GD-27, GD-30 to GD-32 |
| M4.4 | Bottom bar with all groups; *Android-app* panel with *binnenkort* badges; *Over* with the privacy link | GD-14, GD-15, GD-35, SR-52 |
| M4.5 | Validation panel *Controle* with counts and *Ga naar* | GD-20, GD-29, EDT-40 to EDT-42 |

**Exit:** SC-03 (no CSP or Trusted Types violation) through every screen; the shell matches the mock's look in the three languages.

**State (2026-11-07).** M4.1 is done, apart from `zbm-download`.
- **`app/dom.js`:**
  - `el()` builds elements from an allow-list of attributes. Event handlers come through `on`; `style`, `srcdoc` and every `on*` attribute are refused, and so is a `javascript:` or `data:` URL in `href` or `src`.
  - `icon()` draws the Material icons of `app/icons.js` as SVG through the DOM.
  - `setVar()` sets only CSS custom properties, for the GD-10 bar widths.
  - Tested in `tests/unit/dom.test.mjs` with a stand-in document.
- **`build.py` refuses HTML, style and script sinks** in every module of a bundle (`dom_sink`):
  - `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `srcdoc` and `cssText`, also as a string key;
  - `document.write`, `eval` and `new Function`;
  - `setAttribute` of `style`, `srcdoc` or `on*`, and assigning `element.style`.

  It reads the bundler's tokens, so comments and longer strings don't count. `test_build.py` has 9 cases refused and one allowed. All of `webapp/src` and `webapp/vendor` pass.
- **Checked in the browser pane:** the built app under the test instance's CSP, in a fresh tab, showed no console message at all (SC-03 for the current screen).
- **M4.2 done.**
  - **Texts:** `app/texts.js` holds all 242 texts in nl, en and de, taken over from the mock's texts. The mock-only texts and the Google Play notice are left out.
  - **Language:** `app/i18n.js` `createLanguage()` opens in the language remembered on this computer, else the browser's, else English (EDT-80 to EDT-82, GD-17, GD-34). It switches NL, EN, DE at once, and every screen is redrawn.
  - **Storage:** `app/storage.js` is the only module that touches browser storage, with the allow-list `zbm.lang`, `zbm.bars` (SR-42). `build.py` refuses `localStorage`, `sessionStorage`, `indexedDB` and `document.cookie` in every other module.
  - **Tested:** `tests/unit/i18n.test.mjs` checks that every text exists in every language, non-empty and without markup, with the same placeholders; it also covers the remembered language, a blocked store and the allow-list.
  - **In the browser pane:** NL, EN, DE switched at once, the choice survived a reload, local storage held only `zbm.lang`, and the console was empty.
  - **Until M4.4,** the language button sits on the start card; the bottom bar takes it over.
- **M4.3 done, with GD-41.** The main screen's four areas are in `app/layout.js`; the bars' state is in `app/bars.js`, as plain data.
  - **Splash:** in the centre with the photograph, the bars greyed and inert, their tabs and edges disabled (GD-03, GD-27, GD-30).
  - **Home screen:** the four primary actions, disabled until M5 and M6 with *Komt in een volgende testversie*.
  - **The bars (GD-10, GD-34):**
    - each edge resizes its bar by pointer and with the arrow keys in steps of 16 px, within GD-10's limits;
    - each tab folds and unfolds its bar, and a folded bar is inert;
    - widths and folding are remembered under `zbm.bars`.
  - **Narrow page:** shown below 980 px (GD-32).
  - **Styles:** taken over from the mock into `app.css`. One change: the home tiles wrap into one column, because in a 1024 px window the centre is 384 px wide with both bars at their defaults.
  - **`app/dom.js`** gained `setAttrs`, `toggleClass`, `setInert` and `listen`.
  - **GD-41 (the owner's answer to GQ-21):** the centre keeps at least 360 px.
    - `bars.js` `shownWidths()` narrows the bars on screen, the right first, without changing the stored widths, and `withWidth()` stops a drag or key there. `layout.js` redraws on a window resize.
    - **In the browser pane at 1024 px:** both bars stored at their maximum showed 424 and 240 px, and the centre 360 px. A drag stopped at 360 px. At 1600 px the stored 480 and 520 px came back.
    - **Caveat:** the pane was not painting during this run, so the grid's 0.2 s animation stood still. The final widths were read with the animation switched off.
  - **Tested:** `tests/unit/bars.test.mjs` has 4 tests.
  - **In the browser pane:**
    - the splash state, and folding by the tab;
    - the arrow keys, which stop at the 520 px limit;
    - dragging by pointer events, which stops at 480 px;
    - the stored layout coming back after a reload;
    - the narrow page at 900 px;
    - no console message.
- **M4.4 done.** `app/panels.js` draws the bottom bar and the panels it opens; `app/dialog.js` opens them on the browser's own `<dialog>`.
  - **The bottom bar's groups (GD-04, GD-14, GD-23, GD-39):**
    - the library buttons, *Controle* and the four key buttons, with *geen sleutel* under them;
    - *Android-app*, the language and *Over*.

    The library and key buttons stay disabled until M5 and M6, each saying why in its tooltip.
  - **The *Android-app* panel (GD-15, GD-35):**
    - F-Droid's badge, greyed with *binnenkort* (a CSS background, so the build renames it); no Google Play badge;
    - the APK, the manuals and the sources, every link https with `target=_blank` and `noopener noreferrer`.
  - **The narrow page (GD-32)** shows the same links and the privacy statement.
  - ***Over* (SR-52):** name, version, credits and the privacy statement on `zangbundel.nl/<lang>/privacy.html`, which covers both sites.
  - **Dialogs:** they keep focus inside and close on Escape, on the backdrop or with *Sluiten*. Focus then returns to the button that opened them.
  - **New in `dom.js`:** `target` (only `_blank`) and `extLink()` (https only). **New in `i18n.js`:** `tParts()`, for a link inside a sentence.
  - **Tested:** `tests/unit/panels.test.mjs` has 4 tests.
  - **Checked in the browser pane:**
    - 13 buttons, 10 disabled;
    - the panel: modal, its links, and closing on Escape with focus returning;
    - *Over*: its privacy link; the backdrop closes it, a click inside does not;
    - the narrow page's links at 827 px;
    - no console message.
- **M4.5 done.** *Controle* is `app/check.js`.
  - **The panel:** it groups the findings into *Fouten* (Error and Fatal), *Waarschuwingen* and *Info* with their counts (GD-29). Each item shows the severity word and icon, its place (song and line, set, file or library) and its message; a click closes the panel and goes there (EDT-40, EDT-41). The bottom bar's button shows the numbers of errors and warnings and the worst icon (GD-20).
  - **Messages:** `app/messages.js` holds the 53 messages of the section 6 rules. MAN-08 uses M-39; the app's M-75 is not needed here.
    - The English is the FDS's section 9, verbatim; a test compares the two.
    - The Dutch and German are translated with the same placeholders. **They are for the owner's review.**
    - The file is generated from the FDS; the mock's drafts, which had drifted, were not used.
  - **The engine gives each finding the details of its message** (`params` in validate.js), so the place has a line:
    - `chordpro.js` records where each problem first occurs (`problems.at`), the line of every metadata value and the first line of each unknown directive;
    - VIEW-03 names the field an older app refuses;
    - conformance (code, severity, location) is unchanged at 58 of 58.
  - **Tested:** `tests/unit/check.test.mjs` renders every finding of all 58 test libraries in nl, en and de with no placeholder or "…" left, and checks five line numbers against the songs.
  - **Checked in the browser pane** with a temporary page: the button's counts, the grouped modal panel in Dutch, the go-to click, no console message.
  - **Not yet in the app:** *Controle* waits for an open library (M6); *Ga naar* gets its targets with the song and set screens (M5).
- **M4 state:** M4.1 to M4.5 are done.
  - **SC-03:** no CSP or Trusted Types violation on any screen built so far.
  - **Still for the exit:** the shell beside the mock in the three languages, looked at by the owner.
- **`zbm-download` moves to M6.2, where the download is built.** Assigning a `blob:` URL to `a.href` is not a Trusted Types sink, so that policy has nothing to guard at that point. The download helper will create and revoke the `blob:` URL itself (SR-36); whether SR-32 still needs a policy of that name is for the M6 review.

### M5 — Editing (L)

| # | Work | Requirements |
|---|---|---|
| M5.1 | Song list with search, sort, filters, bin, *Bewerken* | GD-13, GD-16, GD-25 |
| M5.2 | Song view: labels, repeats, chords, remarks | GD-19 |
| M5.3 | Song editor: *Blokken* and *Code (ChordPro)*, drag with scrolling, up/down, labels, locked blocks, apply always, the leave-editor question | GD-05 to GD-09, GD-11, GD-18, GD-19, GD-33, GD-36, GD-38 |
| M5.4 | Library fields in the left bar, licence and required maintainer | GD-22, GD-37, EDT-13, EDT-14, MAN-07, MAN-08 |
| M5.5 | Sets tab: add, rename, reorder, delete, entries | GD-21, EDT-31, SET-01 to SET-05 |
| M5.6 | The owner's M5 review: observations F1 to F10 (under the state below) | GD-12, GD-13, GD-17, GD-20, GD-21, GD-30, GD-33, GD-34, SNG-10 |

**Exit:** each GD of M5 demonstrated on the test instance against its text; unit tests for every state change of the library model.

**State (2026-11-07).** M5.4 is done; built first, because it completes making a new library up to its download.
- **`app/library-form.js`:** title, description, licence and maintainer in the left bar while a library is open (GD-22).
  - Licence (EDT-13): the five common licences bring their summary in the interface language, unless the user wrote one. *Andere licentie (SPDX-code)* takes any identifier, checked with the engine's own pattern. The full text is optional.
  - Maintainer (EDT-14, GD-37): a name and one field *E-mail of website*, as in the mock (the owner's choice, 2026-11-07), with the note of EDT-14.
    - A value with a scheme (`https://…`) is the website; anything else is the e-mail address. MAN-08 refuses an `http:` website (M-39).
    - A library with both shows its e-mail address, and the website under the field (*Ook: …*). Typing replaces the contact the field shows; the other stays.
  - A field is applied on leaving it. The worker's findings (MAN-02 by its reasons, MAN-07, MAN-08) mark their fields with the FDS message, so the rules stay in the engine; the form itself refuses only an empty title and a malformed SPDX code.
  - The form is built once per library (`state.generation`), language and read-only state, and then only updated, so a recheck never takes text from under the cursor.
  - A read-only signed library shows its fields disabled (EDT-23).
- **`session.updateLibrary(patch)`:** changes those fields only, marks the library changed and rechecks it. A newer edit's check wins over an older one that returns later.
- **The worker's `check`, with `keyed`:** a signed library with its key loaded is checked as it will be saved; the signature is made and checked on saving. Before this, edits to a signed library were not checked.
- **Tested:**
  - `tests/unit/library-form.test.mjs`, 7 tests: licence choice, the contact field, both contacts, findings to fields, changes, marks, read-only;
  - `signing-session.test.mjs`, 3 more: a new library completed through its fields and saved as version 1; a signed library edited only with its key and signed again; the late check.
  - `node --test`: 314 of 314. Container test: 81 of 81.
- **In the browser pane (Chromium):**
  - a new library: licence and maintainer marked with M-29 and M-39, cleared as filled in, *Controle* from 2 errors to 0, downloaded as `Kampvuurliedjes-v1.zbl`;
  - a field being typed in kept its text and focus through a recheck;
  - `valid-signed`: 9 fields disabled until its key was loaded, then enabled; an edit gave version 2, signed with the same key;
  - the one contact field: `http://` refused with M-39, `https://` accepted, then replaced by an e-mail address;
  - storage empty, console clean.
- **Not in M5.4:** the labels of tags (EDT-30), because where they are edited is open (GQ-20); clicking the library's title in the right bar to return to these fields comes with the song list (M5.1).

**M5.1 done.**
- **`app/songlist.js`:** the song list in the right bar, as the app's songbook (GD-13; app `SongbookFilter.kt`).
  - Search: every typed word in the title, without case or accents; *Ook in de tekst* looks in the lyrics instead.
  - A–Z / Z–A by sort title or title; ties by song ID, so the order is stable.
  - Chips: the languages (only when more than one) and the tags; within a group any, between groups all.
  - *Wis filters* only when something differs from the default; *Geen liederen gevonden.* when nothing matches.
  - Each row: the song's worst Error or Warning as a mark, its language and lyricist, *Bewerken* (waits for M5.3) and the bin.
  - The filter belongs to the screen: the list is built once per library, language and read-only state, its node stays in place so the search field keeps focus, and another library starts with the default filter.
  - `reveal(id)` clears a filter that hides a song, for GD-25 once songs are applied in M5.3.
- **Selecting:** a click or Enter selects a song and marks it; clicking the library's title deselects it (GD-22). The centre and left bar show the selected song from M5.2.
- **Deleting (GD-16, EDT-32):** the bin asks M-62, then `session.deleteSong(id)` removes the song from the library and from every set; the next song in the list is selected, else the one before, else none. Read-only libraries delete nothing.
- **The worker's song summary** now also gives sort title, language, lyricist, tags and the lyrics as shown (`words`), so the page never parses a song (SR-30).
- **Found while testing:** *Openen* and *Nieuw* replaced a library with changes not yet downloaded without asking; they now ask M-60 first, as *Sluiten* does (EDT-03). Unreachable before M5, because nothing could change a library.
- **CSS:** `[hidden]` now hides elements that set their own `display`.
- **Tested:**
  - `tests/unit/songlist.test.mjs`, 9 tests: folding, title and text search, order, chips, *Wis filters*, the neighbour after deleting, the list itself, `reveal`, read-only;
  - `session.test.mjs`: the richer summary, and deleting a song from the library and its sets.
  - `node --test`: 324 of 324. Container test: 81 of 81.
- **In the browser pane (Chromium), on `valid-unsigned`:**
  - search with focus kept, *Ook in de tekst*, *Wis filters*, A–Z/Z–A, chips combined;
  - deleting *Lorem Ipsum!* after M-62: *Vader Jacob* selected next, the library *gewijzigd*, and the set *Demo* now reported empty;
  - *Openen* and *Nieuw* asking M-60 only with changes, *Annuleren* keeping them;
  - `valid-signed`: bins disabled; storage empty, console clean.
- **Open:**
  - the Sets tab of the right bar comes with M5.5;
  - (done) closing the browser tab with work that would be lost asks first, the owner's GD-42: `app/leave-guard.js` listens to `beforeunload` only while there are changes not yet downloaded or a new key not yet downloaded. Tested with `tests/unit/leave-guard.test.mjs` and in the browser pane with a dispatched `beforeunload` (no question before a change, one after a delete, none after downloading, one for a new key); the browser's own dialog itself was not shown.

**M5.2 done.**
- **`chordpro.js`:**
  - `lineSegments(line)`: a content line as chord, annotation and text segments, by the escape and bracket rules of 5.4 and the trailing-space rule of 9.1.
  - `songView(text)`: the song as the view shows it, in file order. Verse, chorus and bridge come with their own label or none; verses are numbered with the implicit ones (7.1, 7.3); a `{chorus}` repeat carries the chorus's lines again (7.2); comments become remarks in place (7.4); blank lines inside an environment become gaps. Tab, grid, ABC and unknown blocks, file comments and other directives are not shown.
  - One set of rules: over all 401 songs of the test libraries, the view's lines are exactly `parseSong`'s canonical line list (`tests/unit/songview.test.mjs`).
- **The worker's `song` op** (`songDetails`) gives a song's sections and its metadata (6.1); the page never parses a song (SR-30).
- **`app/songview.js`:**
  - The centre shows the selected song (GD-13): title, subtitle, words and music; *Verwijderen* (GD-16, M-62, then the next song) and *Bewerken* (waits for M5.3); the lyrics with labels generated in the interface language where the song has none, chords highlighted inline, annotations greyed, remarks in place.
  - The left bar shows the song's data read-only (GD-05; editing them is M5.3): title, language, words, music, copyright, licence (empty: the library's), source, tags, song ID.
  - With no song selected, the centre shows the library's title, a lead and *Lied toevoegen* (M5.3), as the mock.
- **`main.js`:** the centre is redrawn only when what it shows changes, so the reader keeps their place in a long song; a late answer from the worker for a song no longer selected is dropped.
- **Tested:** `tests/unit/songview.test.mjs`, 9 tests: segments, environments and numbering, repeats, remarks and hidden blocks, the corpus check, `songDetails`, generated labels, the view, the song's data. `node --test`: 334 of 334. Container test: 81 of 81 (a first run failed the server's upload-lock timing test, unrelated to this change; the rerun passed, see the gotcha log).
- **In the browser pane (Chromium), on `valid-unsigned`:**
  - the library's home; *Vuur in de nacht* with *Couplet 1*, *Refrein*, *Couplet 2*, *Brug* and the chorus repeated, its data in the left bar;
  - *Fire in the Night* with 30 chords inline and its own labels as written;
  - the reading position kept while searching the list;
  - deleting from the view after M-62, the next song shown; the library title back to the library;
  - console clean, apart from Chrome refusing a leave prompt when the tool reloaded a tab with changes (Chrome shows it only after a user gesture).

**M5.3 is built in five steps:**
- **M5.3a:** *Blokken* with *Toepassen*, *Annuleren* and the leave question.
- **M5.3b:** the *Code (ChordPro)* mode.
- **M5.3c:** the song's fields in the left bar.
- **M5.3d:** *Lied toevoegen*.
- **M5.3e:** dragging with auto-scroll.

**M5.3a done.**
- **`app/editor.js`:** the song editor in *Blokken* mode, on the block form the worker makes (M2.3).
  - Each block shows its kind (*Couplet*, *Refrein*, *Brug* in a list; *Refrein herhalen* and *Vergrendeld blok* as fixed names), a label field (empty: generated), *Omhoog*, *Omlaag* and *Blok verwijderen* (GD-33).
  - A section's text is edited in text fields around its locked lines, which show greyed with a button to remove them (GD-19 as clarified); locked blocks show greyed with *Alleen te wijzigen in de ChordPro-tekst*; a repeat names the chorus it repeats.
  - Typing (GD-07): braces and control characters are taken out with the hint *Accolades { } en stuurtekens kunnen niet in een liedtekst*; a line starting with `#` is flagged.
  - Adding: *Couplet*, *Refrein*, *Brug* and *Refrein herhalen* below the blocks; the new block gets focus. Moving keeps focus on the moved block's button.
  - Metadata lines are kept as they are; the left bar edits them in M5.3c.
- **Opening:** *Bewerken* on a song's row, above the song in view mode, and in the bottom bar (only with a song selected). A song that is not text has no *Blokken* (M5.3b gives it the code mode).
- ***Toepassen* (GD-09, GD-20):** the worker writes the blocks back (`unblocks`) and the song is applied with its findings (`session.updateSong`), also with an Error. The song then shows in view mode with *Wijzigingen toegepast*, or *Toegepast, met n fout(en)*. Only a block form the worker cannot write (a line or label that would change meaning) is not applied; the editor then says so above the blocks. The live checks make this rare.
- ***Annuleren*** throws the changes away without a question, as in the mock.
- **GD-36:** choosing another song, the library's title, another song's bin, *Openen*, *Nieuw*, *Sluiten* and *Downloaden* leave the editor.
  - With changes, they first ask *Je bent een lied aan het bewerken*, naming the song: apply (primary), throw away (with a notice), or keep editing.
  - Without changes they just leave. Search, filters, the language, *Controle* and the key buttons do not leave the editor.
- **GD-42:** the leave guard listens while the editor is open and asks only when it has changes (`leave-guard.js` `listenWhen`).
- **`core/blocks.js`:** lyric lines straight after lyric lines would join one implicit verse, so a block moved there is written with a blank line before it.
- **Deviations from the mock:**
  - the section text is a plain text field, as the mock's editor showed raw ChordPro too (`[G]` inline);
  - the kind list holds verse, chorus and bridge only: turning a section into a repeat would drop its text, so repeats are added, not converted;
  - the drag handle and the help line about dragging come with M5.3e.
- **Tested:**
  - `tests/unit/editor.test.mjs`, 5 tests: typing filter, `#` lines, parts and lines, moving past metadata, applying in the session, read-only;
  - `blocks.test.mjs`, 1 more (moved implicit verses); `leave-guard.test.mjs`, 1 more.
  - `node --test`: 351 of 351. Container test: 81 of 81.
- **In the browser pane (Chromium), on `valid-unsigned`:**
  - *Fire in the Night* opened as 7 blocks;
  - braces taken out with the hint; a `#` line flagged;
  - the bridge moved up with focus kept; a new chorus added and typed in;
  - *Toepassen* showed the song in its new order with *Wijzigingen toegepast*, the library *gewijzigd*;
  - GD-36: no question without changes; *Verder bewerken*, *weggooien* (notice, then the click) and *toepassen* (then the click); *Annuleren* without a question.

**M5.3b done.**
- ***Bewerken als* (GD-38):** *Blokken* and *Code (ChordPro)* above the song, a radio group with one Tab stop; the arrow keys switch, and the open mode is filled orange.
- **Switching:**
  - To the code, the worker writes the blocks out (`unblocks`); a line or label it cannot write keeps the editor in *Blokken* with *Wisselen kan nog niet*.
  - Back to the blocks, code that was not changed gives back exactly the blocks it came from; changed code is made canonical and read as blocks again (`canonical`, `blocks`).
  - So every change made in one mode is in the other, and switching without a change leaves the song as it was.
- **The code mode (EDT-33):**
  - the song's ChordPro code in a monospace field (at most 64 KiB, the limit of SNG-18); control characters are taken out, braces stay;
  - 300 ms after typing stops, the worker checks the code by the song rules of FDS 6.6 (`songCheck`, `validate.js` `checkSongText`) and the editor lists the messages with their lines, as Controle shows them, or *Geen fouten of waarschuwingen*;
  - the left bar says the data is now in the code (*Je bewerkt nu de ChordPro-tekst*).
- ***Toepassen*** applies in the mode that is open; code is stored canonically (EDT-57).
- **No-op apply:** a song applied without a change is no change: the library is not marked changed and the next download stays unchanged (EDT-51).
- **GD-36:** in the code mode, changes are compared with the song as opened, ignoring line-end spaces and blank lines at the end.
- **Not text:** a song that is not text (SNG-01, SNG-18) still cannot be edited: its bytes cannot be shown as code. It can be deleted.
- **Tested:**
  - `tests/unit/editor.test.mjs`, 4 more: comparing and cleaning code, the code checks against Controle's findings for all songs of the test libraries (identical), checks with their lines and canonical storage, the unchanged apply.
  - `node --test`: 355 of 355. Container test: 81 of 81.
- **In the browser pane (Chromium):**
  - *Vader Jacob* to code and back without a question;
  - `{c: open` reported as line 7, gone once fixed;
  - a remark typed in the code shown as a locked block in *Blokken*;
  - *Toepassen* in code mode;
  - the arrow keys switching with focus following;
  - *Fire in the Night* through both modes and applied: the library not marked changed.

**M5.3c done.**
- **`app/songfields.js`:** the song's fields in the left bar while it is edited in *Blokken* (GD-05, EDT-34), as the mock:
  - title and language (required); words, music, copyright, licence (empty: the library's), source, tags; the song ID shown, not edited (EDT-36);
  - the language from a list (Dutch, English, German, Frisian, French and the song's own), or *Andere taalcode…* with a field of its own;
  - several words or music writers separated by `;`, tags by commas.
- **Writing:** each field reads and writes its directives in the block form (`setMeta`) when it is left, so the fields and the code are one song; an empty field removes its directive. Braces and control characters cannot be typed into a field.
- **Marks:** while editing, a field marks what the song rules will report: no title (SNG-02), no or an invalid language (SNG-11), a tag that is not a tag (SNG-15). Controle and the code mode report them by the engine's rules.
- **`core/blockmeta.js`:** `setMeta`, `metaValues` and `valueProblem` moved out of `blocks.js` into a module without imports, so the page edits metadata without the ChordPro parser in its bundle (SR-30); the bundler allows no re-exports (TD-22), so `blocks.js` imports `valueProblem` from it and the tests import the rest directly. The page bundle was checked: no parser in it.
- **The editor's buttons** look up their block's place when used, so a field written in the left bar does not redraw the blocks, and a click into a verse right after typing in a field lands.
- **Tested:**
  - `tests/unit/songfields.test.mjs`, 4 tests: splitting names and tags, the marks, every field written as its directive (checked as code with `fromBlocks`), another language code, braces kept out.
  - `node --test`: 359 of 359. Container test: 81 of 81.
- **In the browser pane (Chromium):**
  - *Vader Jacob*: title, tags and music set in the fields; a click into a verse straight after typing the title landed;
  - the tag *Welpen* marked, then accepted in lower case;
  - the fields seen as directives in the code mode, whose checks moved on to the next missing field;
  - *Toepassen* showed the new title in the view, the left bar and the song list;
  - *Lorem Ipsum!* showed its own language *Latijn* and two lyricists.

**M5.3d done.**
- ***Lied toevoegen* (EDT-32):** on the library's home and below the song list. It opens the editor on an empty verse as *Nieuw lied*, without *Lied verwijderen* (GD-16: *Annuleren* throws a new song away). The ID field says it is proposed from the title on *Toepassen*.
- ***Toepassen* on a new song:** the worker takes the song in (`addSong`, `adoptSong`) and `session.addSong` adds it.
  - The ID is proposed from the title as song format 3.2 recommends and made unique with -2, -3, … (EDT-36; `names.js` `proposeSongId`, at most 64 characters, `lied` when nothing is left).
  - The song gets exactly that `{meta: id}`; a song with a valid, free ID of its own keeps it.
- ***Lied importeren* (EDT-32):** a `.cho` file of at most 64 KiB is read in the worker (`importSong`), taken in the same way and added at once, then shown; its problems are in Controle (GD-20). A file that is too large or not text is refused with the FDS message of SNG-18 (M-19) or SNG-01 (M-50).
- **GD-25:** a new or imported song that the search or filters would hide clears them, with *Filters gewist om het nieuwe lied te tonen*.
- **GD-36:** a new song is named in the leave question by its typed title, or *Nieuw lied*; an untouched new song leaves without a question.
- **Found by the build:** a name declared twice in `main.js`, which no unit test loads. `tests/unit/syntax.test.mjs` now checks that every module under `webapp/src` parses, so `node --test` catches this too.
- **Tested:**
  - `tests/unit/addsong.test.mjs`, 5 tests: the ID proposal (the format's own example, accents, numbers, 64 characters), taking in a song (own ID kept, taken ID replaced, two IDs made one, canonical text), import limits, a new song from an empty verse to a saved library without song errors, read-only;
  - `syntax.test.mjs`.
  - `node --test`: 365 of 365. Container test: 81 of 81.
- **In the browser pane (Chromium), on `valid-unsigned`:**
  - a new *Vader Jacob* added as `vader-jacob-2`, the search *lorem* that hid it cleared with the GD-25 notice;
  - `import.cho` added as `uit-een-bestand`; a file that is not UTF-8 refused with M-50;
  - a typed new song named in the leave question and thrown away; an untouched one left without a question.

**M5.3e done; with it M5.3.**
- **Dragging (GD-08):** each block has a handle (`aria-hidden`; the keyboard has *Omhoog* and *Omlaag*, GD-33).
  - The block follows the pointer and cannot leave the song; a line shows where it will land; on release it lands there and stays in view (GD-11).
  - `moveToPosition` puts it among the shown blocks, metadata lines keeping their place.
  - The help line *Sleep een blok aan … of gebruik … …* shows the handle and buttons as icons.
- **Auto-scroll (GD-11):** within 72 px of the top or bottom of the centre (the bottom above the *Toepassen* bar), the song scrolls towards that edge, faster the closer, at most 18 px a frame, stopping at the start and end (`edgeSpeed`).
- **Styling (SR-24, SR-32):** the offset is the custom property `--dy` (`dom.js` `setVar`), never a style attribute, and the drop line is a class (`dropbefore`, `dropafter`), not an inline shadow as in the mock. The console showed no CSP report.
- **Tested:** `tests/unit/editor.test.mjs`, 2 more: `moveToPosition` around metadata, and `edgeSpeed` at and between the edges. `node --test`: 367 of 367. Container test: 81 of 81.
- **In the browser pane (Chromium), with synthetic pointer events on *Fire in the Night*:**
  - *Bridge* dragged above *Verse 1*, the line on *Verse 1*;
  - *Verse 1* dragged below *Bridge*, the line before *Chorus (2x)*;
  - *Toepassen* showed the new order.
- **Not seen:** the auto-scroll itself. The pane was hidden, so the page drew no animation frames (0 in 700 ms) and the scrolling, which runs per frame, could not run. Its rule is unit-tested; the owner's look at the M5 exit should include dragging a block to an edge.

**M5.5 done; with it the five steps of M5.**
- **Tabs (GD-21):** the right bar has *Liedjes (n)* and *Sets (n)*. Both lists stay built, so switching keeps the search.
- **The *Sets* tab:** each set with its number of songs (*1 liedje*, *n liedjes*), or a warning mark when empty (SET-03). Each row has *Omhoog*, *Omlaag*, *Naam wijzigen* and *Set verwijderen*, and *Nieuwe set* is below the list.
  - A new set's name is proposed (*Nieuwe set*, numbered when taken).
  - The name dialog refuses an empty name, more than 60 characters, braces or line breaks, and a name in use without regard to case (SET-02; FDS 4.1).
  - Deleting asks M-62 and never deletes songs (EDT-31).
  - Moving the open set keeps it open.
- **An open set in the centre (GD-21):** its name with *Naam wijzigen*, the hint to add songs with *+*, M-13 when empty, and its songs in order. Each song has a number, a drag handle (`drag.js`, shared with the editor), *Omhoog*, *Omlaag*, and a bin that takes it out of the set only. A song the library does not have shows M-32 (SET-01). A redraw keeps the reader's place.
- ***+ Set*:** while a set is open, each song row has a button that adds the song to it; a song already in it shows a check (SET-04). Choosing a song closes the set view. Opening a set leaves the song editor through GD-36.
- **`app/sets.js`:** the operations are pure (add, rename, delete and move sets; add, remove and move entries), and `session.updateSets` applies them and rechecks. A read-only library changes nothing.
- **`app/drag.js`:** the drag of M5.3e moved out of the editor, for blocks and set entries alike.
- **Tested:**
  - `tests/unit/sets.test.mjs`, 4 tests: set names, every operation leaving the original untouched, sets made in the session saved in the manifest and as setlists of the view (PF-40) with no set errors and found again on reopening, read-only and malformed lists refused.
  - `node --test`: 371 of 371. Container test: 81 of 81.
- **In the browser pane (Chromium), on `valid-unsigned`:**
  - a new set with a taken name refused, then *Zomerkamp 2026* opened with M-13;
  - three songs added with *+*, each then checked;
  - reordered with *Omhoog* and by dragging, one taken out (the library kept 4 songs);
  - renamed with Enter; moved up while open; *Demo* deleted after M-62;
  - a song chosen, closing the set view.
  - `valid-signed` without its key: every set button and *+* disabled, no drag handles.

**Controle's *Ga naar* done (EDT-41, GD-20); M5's work is complete.**
- **`app/goto.js` `targetOf`** says where a finding leads; *Ga naar* in both Controle windows (the bottom bar's and the download dialog's) goes there, leaving the song editor through GD-36.
- **Song findings:**
  - about a field, to the editor in *Blokken* with that field focused: SNG-02 title, SNG-11 language, SNG-15 for a tag, and SNG-16's missing recommended field;
  - with a line (SNG-03 to SNG-08, SNG-13 to SNG-15), to the code mode with that line selected and in view (`editor.showLine`); the code is the song's own text, so the line is the finding's line;
  - otherwise, and in a read-only library or for a song that is not text, to the song in view mode.
- **Set findings** open the set on the *Sets* tab.
- **Library findings:** MAN-07, MAN-08 and MAN-02 (by its reasons) focus their field in the library's fields; the others show the library's home.
- **Tested:** `tests/unit/goto.test.mjs`, 3 tests: each kind of target; over all findings of the test libraries, every one leads somewhere and every line it points at is in its song. `node --test`: 374 of 374. Container test: 81 of 81.
- **In the browser pane (Chromium):**
  - SNG-07 at *Fire in the Night* · 49 opened the code mode with `{x_zb_time: 1 2.0}` selected;
  - SNG-16 focused *Tekst* of *Vader Jacob*;
  - with a change in the editor, GD-36 asked first, *toepassen* applied, then the line was shown;
  - SET-03 opened *Demo*;
  - MAN-07 and MAN-08 of a new library focused the licence and the maintainer's name.
- **Trial release on the test instance (2026-11-07):**
  - `manager-0.2.0-dev.1` was built from commit `07558a9` with `--allow-dirty`, twice, byte-identical (SR-10), and checked under the test instance's CSP (both workers, the crypto self-test, the banner, a clean console).
  - The owner signed it with the release key, uploaded it with the deploy key (706,560 bytes) and activated it with `zbm-release activate --trial test.zangbundel.nl`. `live` has pointed to it since 21:10; `test-holding-0.1.0` stays as the release to switch back to.
  - The owner's first look was in Firefox.
  - It showed one stale text: the *Bibliotheek bewerken* tile still said *Komt in een volgende testversie*. Fixed after the release: that tile now only says a library is needed, and *Bewerken* on a song that is not text gives that as its reason. Both go into the next trial build.
- **The M5 exit look, part 1 (2026-11-08):** the owner's ten observations are in M5.6 below.
- **Next:** M5.6. Then the rest of the M5 exit look, dragging a block to an edge included (its auto-scroll was not seen here), and M6's exit: a library made and signed here, through the independent checker and the phone.

#### M5.6 — The owner's M5 review (2026-11-08)

The owner's first look at the trial release (`manager-0.2.0-dev.1`, Firefox) gave ten observations, F1 to F10. Their causes were found in the code; nothing has been changed yet. Each look is written as a GD in `design/webappGUI.md` (draft 0.21) and checked in the mock before it is built (the GUI's own rule); F3 changes the FDS and therefore the app.

| # | Observation | Cause found | Work | Documents |
|---|---|---|---|---|
| F1 | Tag chips that do not fit cannot be seen; the scrollbar is hidden and overlaps the chips on hover. | `.chiprow` scrolls sideways with a thin scrollbar (`app.css`). | ◀ and ▶ buttons at the ends of the chip row, shown only when chips are hidden on that side; each steps to the next hidden chip. The scrollbar is hidden; the row still scrolls with the wheel, touch and keyboard focus. | GUI: GD-13 amended |
| F2 | *Ga naar* on the duplicate-title warning closes *Controle* and does nothing. | SNG-10's finding names all its songs in one `where` (`"a, b, c"`), which is no song ID, so `goto.js` finds no song. | SNG-10 also carries the song IDs as a list. *Ga naar* on it sets a song-list filter on exactly those songs: a chip *Zelfde titel: "…"* that *Wis filters* clears. Every other finding that names a song (SNG, and STR on `songs/<id>/…`) opens that song; a song not in the library leads to the library's home. A test runs every finding of the test libraries and checks that each one leads somewhere. | GUI: GD-20 amended |
| F3 | Three *Alouette* songs (English, French, Dutch; different subtitles, tags and song IDs) are reported as duplicates. That is not an error. | FDS SNG-10 (Warning, M-59): no two songs may share a title, case-insensitive; nothing else is compared. | SNG-10 is narrowed (decision **R1**). The validator, its test library and M-59 follow. | FDS draft 0.12; the app repository is told (principle 2); `test-libraries/` |
| F4 | The language button cycles through the languages. | `i18n.next()` in the bottom bar (GD-17). | The button opens a small menu with each language in its own name (*Nederlands*, *English*, *Deutsch*), the current one checked. A choice closes the menu and applies the language at once; Escape or a click outside closes it unchanged; the arrow keys move through it. | GUI: GD-17 amended |
| F5 | Reordering songs in a set only shows a line where the song will land. | `drag.js` marks the drop place with the classes `dropbefore` and `dropafter`. | While dragging, the other cards slide apart to open a gap where the card will land; on release the card slides into that gap. Offsets are custom properties set with `setVar` (no style attribute, SR-24); nothing moves under `prefers-reduced-motion`. The up/down buttons (GD-33) animate the same way. | GUI: GD-21 amended |
| F6 | A folded side bar shows only its fold tab. | The fold tab of `layout.js`. | A folded bar becomes a narrow strip with one icon per part: right *Liedjes* and *Sets*, left the song's data or the library's fields, whichever the bar would show. An icon opens the bar at that part; the bar stays open until it is folded again, and is remembered as now (GD-34). | GUI: GD-34 amended, new GD for the strip |
| F7 | Reordering blocks in the *Blokken* editor should move like F5. | The same `drag.js`. | Comes with F5: one animation in `drag.js` for both lists. | GUI: GD-33 amended |
| F8 | The song's data needs help, shown when the user asks for it. | — | A help text per field of the song's data (decision **R2**), each with a link to its wiki page (F9). The texts are in `texts.js` for every interface language. | GUI: new GD |
| F9 | A wiki in every language of the manager, now and later, with what the manager does and some best practices; the manager links to it. | GD-35 and M7.6 put the manual on this repository's GitHub wiki. | Owner's decisions: the wiki is on `zangbundel.nl`; its content is Markdown in this repository, converted by a simple static site generator; so the manager's help links stay on our own domain. Work under M7.6. | GUI: GD-35 amended; TDS: new TD; assessment: SR-91 |
| F10 | The centre's plain black background should be the photograph of the splash, with the centre's content on a box above it, like the song cards of a set. | The photograph is `assets/backdrop-3200x1440.webp`, used only by the splash (GD-30, CC BY-SA 4.0, credited in *Over*). | The centre gets the photograph as its background; the library home, song view, editor, set and *Controle* sit on a card in the surface colour of the set cards, opaque enough that the text keeps its contrast (M7.3). | GUI: GD-12 and GD-30 amended |

**Decisions (the owner accepted all three recommendations, 2026-11-08):**
- **R1, SNG-10 (F3).** Decided: two songs are reported only when they share title, subtitle and language, all compared case-insensitively, with no subtitle counting as the same subtitle. The three *Alouette* songs then differ in language and subtitle. The alternative is to leave out only songs that share a `variant-group`. That fits *Alouette*, but it still warns about two unrelated songs in different languages that share a title. Either way the app's import check must change the same way.
- **R2, the form of the help (F8).** Decided: an ⓘ beside each field label that opens a short explanation under the field and closes again on a second click (`aria-expanded`). The alternative is one help switch for the whole panel, which shows all the explanations at once.
- **R3, the site generator (F9).** Decided: Hugo. It is one binary with built-in multilingual sites, and we would use it with our own minimal templates and no JavaScript, so the pages fit the placeholder's CSP. It would be a development tool like Node.js (TD-21), never part of the site, with its version and SHA-256 pinned as in `vendor/VENDOR.md`. Zola is the close alternative. MkDocs needs a Python package tree and its themes bring JavaScript.

**Order of work.**
1. F3 and F2: they make *Controle* right, and F2's filter needs F3's list of IDs.
2. F4 and F1: small, and in the bottom bar and the song list.
3. F5 with F7: one change to `drag.js`.
4. F6, then F10: both change the layout, so each goes through the mock first.
5. F8: the help texts first, their links once the wiki exists.
6. F9 runs under M7.6 and can start beside steps 1 to 5. It touches neither `webapp/src` nor the manager's build.

Then a new trial build on the test instance and the rest of the M5 exit look.

**State (2026-11-08): step 1 done (F3, F2).**
- **F3, the rule:**
  - FDS draft 0.12 (D-46): SNG-10 compares title, subtitle and language, and M-59 says so.
  - `validate.js` and the independent `check_test_libraries.py` follow the new rule.
  - Test library `song-title-duplicate` now also makes `lorem-ipsum` Dutch with no subtitle, so it is still a duplicate. `song-title-other-language` is added (the same title alone), making 59 cases. The generator, run twice, changed only those two.
  - The app repository is told in `design/proposals/2026-11-08-sng-10-title-subtitle-language.md`. Its behaviour does not change, as it shows no Warnings, but its corpus `packages/` needs the two cases.
- **F3, the real library:** in the owner's Drasva library (414 songs), the title-only rule gave 11 groups, *Alouette* among them; the new rule gives none.
- **F2:**
  - SNG-10's finding carries `params.songs`.
  - In `goto.js`, SNG-10 leads to `{ kind: 'songs' }`, and a structure finding on `songs/<id>/…` leads to that song.
  - `songlist.js` has the filter `only` with its chip and `showOnly`. `layout.unfold` opens a folded bar.
  - In `main.js`, a song not in the library leads to the library's home.
  - webappGUI draft 0.21 amends GD-13 and GD-20. The chip looks like a chosen filter chip, so the mock is unchanged.
- **Tested:** `node --test` passes 380 of 380, and every SNG-10 finding of the test libraries names songs of its library. `test_engine_bundle.py` gives 59 of 59, and `test_build.py` and `test_bundle.py` are OK. The container test (Node 18) passes 81 of 81. All checks ran after the last code change.
- **In the browser pane (Chromium), a build under the test instance's CSP:**
  - In `song-title-duplicate`, *Ga naar* on M-59 closed *Controle*, showed only `lorem-ipsum` and `vader-jacob` with the chip on, and unfolded a folded right bar. The chip's click brought back all four songs.
  - SNG-16 focused *Tekst* of *Vader Jacob*.
  - `song-title-other-language` lists *Vader Jacob* twice, with no M-59.
  - The Drasva archive, converted, gives 0 errors and 0 warnings.
  - The console was clean.

**State (2026-11-08): step 2 done (F4, F1).**
- **F4:**
  - `app/langmenu.js` is the language menu, as the mock's: each language in its own name, the current one checked and focused.
  - A choice applies the language at once and focus returns to the button. Escape, Tab, a second click or a click outside close it; the arrow keys, Home and End move.
  - The button has `aria-haspopup="menu"` and `aria-expanded`. The menu is placed with `--mx` and `--my` through `setVar`, as the CSP requires. `i18n.next()` is removed.
- **F1:**
  - The mock got the triangles first and was checked in the pane.
  - In the app, `songlist.js` wraps the chip row in `.chipbar` with a triangle at each end, using the pure helpers `chipArrowState` and `chipStepDelta`. The scrollbar is hidden. Scroll events and a `ResizeObserver` keep the triangles up to date; smooth scrolling unless `prefers-reduced-motion`.
- **Documents:** webappGUI draft 0.22 amends GD-17 and GD-13.
- **Tested:** `node --test` passes 386 of 386; the new tests are `langmenu.test.mjs` and the triangle tests in `songlist.test.mjs`. `test_build.py` and `test_bundle.py` are OK, and `test_engine_bundle.py` gives 59 of 59. The container test (Node 18) passes 81 of 81. All checks ran after the last code change.
- **In the browser pane (Chromium), a build under the test instance's CSP:**
  - The menu opened above *NL*. A real click on *Deutsch* switched the interface to German, with focus back on the button. Escape, a click outside and a second click closed it unchanged.
  - The Drasva library has 23 chips in a 224 px row. The right triangle showed and the left one was invisible.
  - A real click scrolled one chip into view, and the left triangle appeared.
  - With instant scrolling, the triangles stepped to the end in 18 steps, where only the left one remained.
  - The console was clean.
  - Smooth scrolling and scroll events could be watched only while the pane was in front; hidden, the pane drew one frame per 500 ms.

**State (2026-11-08): step 3 done (F5, F7).**
- **`app/drag.js`:**
  - `shiftPlan(heights, gap, from, to)` gives each card's shift and the moved card's distance.
  - While dragging, the cards passed get `--shift` (sliding by the moved card's height plus the gap) under the list class `sorting`. The drop place is judged against the others' middles, taken once in content coordinates, so sliding cards do not move it.
  - On release, `settle` slides the card by `--dy` into its gap (`.settle`, .15 s) and then calls `onDrop`. Its promise is awaited before the old cards are reset.
  - `slideMove(list, card, to, done)` does the same for *Omhoog* and *Omlaag*. A list still settling takes no new move. With `prefers-reduced-motion` the change is made at once.
- **Callers:** used by `editor.js` (blocks) and `sets.js` (a set's songs). The drop lines (`dropbefore`, `dropafter`) are removed.
- **Documents:** the mock got the same first and was checked in the pane, for drag and up/down in a set and in the editor. webappGUI draft 0.23 amends GD-08, GD-21 and GD-33.
- **Tested:** `node --test` passes 390 of 390; `drag.test.mjs` is new. `test_build.py` and `test_bundle.py` are OK.
- **In the browser pane (Chromium), a build under the test instance's CSP, `valid-unsigned`:**
  - **Set *Kampvuur*, dragging:** dragging *Vader Jacob* past two songs gave them `--shift: -111px`, with a .15 s transition. The card settled at `222px`, and the set was redrawn as *Vuur in de nacht*, *Fire in the Night*, *Vader Jacob*.
  - **Set *Kampvuur*, *Omhoog*:** it slid the song and its neighbour by 111 px, then swapped them.
  - **Lorem Ipsum in the editor:** *Omlaag* on the verse slid it 244 px and the chorus −300 px, then swapped them, with focus kept on *Omlaag*. Dragging the third verse up past two blocks put it second.
  - The console was clean.
- **Not seen:** the motion itself. The pane was hidden, so the checks read the classes, offsets and transition durations, not the frames. The owner's look on the test instance is the visual check.

**Exit:** each of F1 to F8 and F10 shown to the owner on the test instance; F3's change in the FDS and announced to the app repository; `node --test` and the container test green.

### M6 — Open, save and sign (M)

| # | Work | Requirements |
|---|---|---|
| M6.1 | *Openen* (this format, plain ZIPs, release archives), *Nieuw*, *Sluiten* with the M-60 question | EDT-01 to EDT-03, EDT-10 to EDT-26, GD-23, GD-28 |
| M6.2 | *Downloaden*: version rule, change note, view, manifest, validation before download, file name, MIME type, blob URL | EDT-50 to EDT-59, SR-36, SR-37 |
| M6.3 | Signing in the download dialog; read-only signed libraries; *Opslaan als kopie* | GD-24, EDT-23, EDT-24, EDT-60 to EDT-73 |
| M6.4 | Key group: make, load, download, forget; inactivity warning | GD-14, GD-39, GD-40, SR-44 to SR-46 |

**Exit:** libraries made and signed by the manager pass the independent checker `test-libraries/check_test_libraries.py` (written as new cases), and import in the Songbook app on a test phone; SC-06 and SC-07 for a full edit, sign and download cycle.

**State (2026-11-07).** M6.1 is done.
- **`app/session.js`** holds the open library, its song titles, its findings and whether it has changes not yet downloaded. It speaks to the library worker through `library-client.js`.
- **`app/library-ui.js`:**
  - **The file picker (GD-28):** a hidden file input; the bytes go to the worker.
  - **A file that cannot be opened (EDT-20):** its Fatal findings in the FDS's messages. A file above 64 MiB is refused before it is read.
  - **A converted ZIP (EDT-25, EDT-26):** the report of M-41 and M-42, and what was left out.
  - ***Nieuw* (EDT-10):** title and optional description.
  - ***Sluiten* with changes not yet downloaded:** the question of M-60 (EDT-03).
- **On screen:** the right bar shows the library's title, version, signing status and songs by title; *Controle* gets its findings.
- **The library worker gained:**
  - `check`: the findings of the library as it would be saved, without the VIEW rules, which concern a stored file (EDT-42);
  - a song summary, so the main thread never parses a song (SR-30).
- **`dialog.js`:** action buttons, and dialogs are taken out of the page at once when the app closes them; the browser's own close event can come late.
- **Tested:** `tests/unit/session.test.mjs` has 5 tests with the real handler.
- **In the browser pane, through the bundled library worker under the SR-20 CSP:**
  - `valid-unsigned` opened with its four songs and *Controle* 0/1;
  - a new library listed licence, maintainer and no songs;
  - *Sluiten* closed it, and a file that is not a ZIP was refused with M-01;
  - browser storage stayed empty and the console clean.
- **Not yet in the browser:** the conversion report; the unit tests cover it.
- **Waiting:** *Ga naar* targets (M5).

**M6.2 done.**
- **`session.preview()`** tells what *Downloaden* will do: whether the library changed, its version and file name, whether M-61 must be asked, and the findings of the library as it would be saved.
  - Those findings decide the block (EDT-50, M-63). A library whose files differ from its manifest is not blocked by that: saving records the current content after M-61 (EDT-22).
- **`session.save()`** saves in the library worker. The saved file then becomes the open library, so the version shown is the new one and the next unchanged download is byte-identical (EDT-51).
- **`app/download.js`** offers the bytes as a `blob:` URL of PF-04's MIME type under the generated name, then revokes the URL (EDT-59, SR-36). The name may only be a generated `.zbl` or `.zbkey` name. No Trusted Types policy is needed for it (see the `zbm-download` note under M4).
- **The dialog (GD-23):**
  - the file name, and either the new version or *Ongewijzigd*;
  - when the version goes up, an empty note field of at most 500 characters (EDT-58);
  - when blocked, *Controle openen* instead of the download;
  - after saving, the size, and M-08 above the sharing threshold (EDT-56).
- **The file-name rule** (EDT-54) is now `names.js` `libraryFileName`, for the worker and the page alike.
- **Tested:** `tests/unit/session.test.mjs` has 3 more tests: an unchanged byte-identical save, a new library blocked and then saved as version 1, and `file-changed` with M-61 saved as version 2.
- **In the browser pane:**
  - a new library was blocked, with *Controle openen*;
  - `valid-unsigned` downloaded as `Zangbundel testbibliotheek-v1.zbl`, `application/vnd.zangbundel.library+zip`, byte-identical to the opened file, with its link removed;
  - the console stayed clean.
- **Open:**
  - a changed download in the browser waits for editing (M5);
  - signing in the dialog and *Opslaan als kopie* are M6.3.

**M6.3 done.**
- **The crypto worker is now part of the app.** *Sleutel laden* (bottom bar, and the read-only bar) passes the picked `File` to the crypto worker unread; the worker reads it and zeroes the raw bytes, so the page never holds a key file's bytes (SR-40).
  - A file above 4 KiB is refused with M-31 before it is read.
  - With a signed library open, only its author's key is accepted (M-30, EDT-62).
- **Read-only (EDT-23, EDT-24, GD-24):** a signed library without its key gets a bar above the centre with the author's name and fingerprint and *Sleutel laden*. It downloads only unchanged; any change needs its key or a copy.
- **Signing in the download dialog (EDT-60 to EDT-63):**
  - with a key loaded, *Ondertekenen als <name> · <fingerprint>*;
  - ticking it on an unsigned library makes the download a change (version + 1, the key's name as author, SG-12);
  - a signed library with its key loaded is always signed again, and the tick cannot be cleared.
  - The signature is made over a `MessagePort` between the library and the crypto worker, so neither the manifest nor the signature passes the main thread.
- ***Opslaan als kopie* (EDT-70 to EDT-73):** in the download dialog. It asks for a title (proposed: `<title> (kopie)`, at most 80 characters); the copy gets a new ID, version 1 and no author, and work goes on in the copy.
- **Tested:** `tests/unit/signing-session.test.mjs`, 7 tests with the real library and crypto handlers and a real `MessageChannel`:
  - read-only without the key;
  - M-30 for another key and M-31 for an oversized file;
  - the key file read only in the worker's handler, and no private key in the result;
  - signing an unsigned library (SIG and MAN rules pass);
  - a copy of a signed library;
  - SIG-03 blocking, and its copy not blocked.
- **`node --test`:** 293 of 293. Container test: 81 of 81, run before the signing tests switched to `File`. The committed M6.3 tests fail under the container's Node 18, where `File` is not global; M6.4 imports it from `node:buffer`.
- **In the browser pane (Chromium), through both bundled workers, under the SR-20 CSP with `connect-src 'self'` added only so the harness could fetch the test files:**
  - `valid-signed` showed the read-only bar and downloaded unchanged, byte-identical;
  - the RFC 8032 test key loaded while every read method of the page's `File` threw, so only the worker read it;
  - `valid-unsigned` signed on download as version 2 with `manifest.sig`. After a reload (key gone), the file reopened as signed by that key with 0 errors;
  - *Opslaan als kopie* gave `Zangbundel testbibliotheek (kopie)-v1.zbl`, unsigned;
  - no stale dialogs, console clean.
- **Security (SR-91):** the first version read the key file on the main thread, against SR-40. It was caught in this milestone's recheck and changed before staging.
- **Open:**
  - a changed, signed download in the browser waits for editing (M5);
  - Firefox, Safari and Edge (SC-05);
  - make, download and forget a key, and the inactivity timeout, are M6.4.

**M6.4 done.** The key group of the bottom bar works; M6 has its four steps.
- ***Sleutel maken* (EDT-61, GD-14):**
  - asks for the author's name (1 to 100 characters, `autocomplete="off"`, SR-45);
  - makes the key in the crypto worker and shows its name and fingerprint, M-64 and the SR-44 advice;
  - *Sleutelbestand downloaden* works only after the tick and saves `sleutel-<name>.zbkey`; *Later* keeps the key in the page only.
  - A key already in memory is replaced only after a question, which warns when that key was never downloaded.
- **A new key signs only once its file is downloaded (EDT-61).** Until then the download dialog says so instead of offering the tick.
- ***Sleutel downloaden*:** only for a new key not yet downloaded, once, and the button carries a dot until then. Afterwards the worker keeps the key non-extractable (SR-16), so no file can be made again; the button then says the file is already on the computer. The owner's decision (2026-11-07) amends GD-14 (webappGUI draft 0.17).
- ***Sleutel vergeten* (GD-39, SR-41, SR-46):**
  - overwrites the key, ends the crypto worker and says so; the library stays as it is, and a signed one is read-only again;
  - a key not yet downloaded is forgotten only after a question, which offers the download.
- **The key stays until the page closes:** through *Sluiten* and downloads, so one key can sign several libraries. The owner's decision (2026-11-07) clarifies SR-41 (securityAssessment draft 0.14).
- **Inactivity (GD-40, SR-46):** `app/idle.js`.
  - After 30 minutes without input, a warning with a 60-second countdown, *Sleutel houden* (primary) and *Nu vergeten*.
  - Without an answer the key is forgotten. Input during the warning does not answer it.
  - Time is measured, not counted, so a background tab keeps the rule.
  - A key not yet downloaded is warned about but never forgotten by itself; its warning offers the download.
- **`dialog.js`:** `toast()` for short notices; `closePrimary` for a dialog whose close button is the primary choice.
- **Tested:**
  - `tests/unit/idle.test.mjs`: 7 tests with a fake clock;
  - `signing-session.test.mjs`: make, export once, then sign; forget; unlock;
  - `panels.test.mjs`: the key buttons.
  - `node --test`: 304 of 304. Container test: 81 of 81, with the fix above.
- **In the browser pane (Chromium), both workers bundled, the SR-20 CSP with `connect-src 'self'` for the harness only:**
  - *Sleutel maken*, *Later* (dot), the dialog's note before the download, the questions for replacing and forgetting an unsaved key;
  - the key file `sleutel-Leiding Troep 12.zbkey` with all its fields, after the tick only, then the signing tick in *Downloaden*;
  - with the page clock moved forward: no warning at 29 minutes; at 31 the warning with its countdown; the key forgotten after 60 seconds, the library still open;
  - an unsaved key's warning still open 10 minutes later, and *Sleutel houden*;
  - local and session storage, cookies, IndexedDB and caches empty after making a key (SR-42); console clean.
- **Open:**
  - SR-42/SC-06 asks for an *automated* storage test; the browser check here was by hand (M7);
  - Firefox, Safari and Edge (SC-05);
  - M6's exit: libraries made and signed here through the independent checker and the phone (after M5).

### M7 — Hardening and test release (M)

| # | Work | Requirements |
|---|---|---|
| M7.1 | The full release gate SC-01 to SC-13 on the test instance | TD-18 |
| M7.2 | Browser matrix of TD-15 (Chrome, Edge, Firefox, Safari, about three years back) | TD-15 |
| M7.3 | Accessibility pass: keyboard paths, focus, contrast, labels | GD-10, GD-33 |
| M7.4 | Security assessment repeated for the implementation | SR-91 |
| M7.5 | Testers: the requester (Pepe) and two or three scout leaders, one basic-auth account each (SR-80); the RFC 8032 test key and test libraries (SR-82); a short tester guide; findings as GitHub issues in this repository (IQ-05) | SR-80, SR-82 |
| M7.6 | The wiki on `zangbundel.nl`, in every interface language (M5.6 F9; details below) | GD-35, SR-10, SR-91 |

**M7.6 in detail:**
- **Source:** Markdown in this repository (`wiki/<lang>/`), built by the static site generator of R3.
- **Languages:** every interface language. A build check refuses a page that a language lacks, and a help link of the manager whose page does not exist.
- **Release:** built through `build.py`, signed and activated with `zbm-release` together with the placeholder, and checked with SC-01.
- **First pages:** what the manager does, step by step, and best practices (song IDs, tags, sets, keys and signing).

**Exit:** the tagged release `v0.2.0` (IQ-04) on `test.zangbundel.nl`, with the gate's results in `design/test-results/`, and the testers' findings recorded as issues.

### M8 — Go live on zangbundel.nl (outside this plan)

Criteria for the owner's decision: M7 complete; testers' blocking issues closed; the Songbook app's import of this format released; HSTS at one year for three months (then preload, SQ-03); the release procedure practised at least three times on the test instance. Going live is then the same signed release activated in the production directory (SR-84), replacing the placeholder.

---

## 5. Order and dependencies

```
M0 ──▶ M1 ──▶ M2 ──┬──▶ M5 ──▶ M6 ──▶ M7
                   │      ▲      ▲
       M3 ─────────┴──────┼──────┘
       M4 ────────────────┘
```

- M0 and M1 come first: every later milestone is deployed through them.
- M2 (engine) and M3 (keys) can run side by side; M2 is the critical path because SC-04 depends on it.
- M4 (shell) can start once M1 builds, and runs beside M2 and M3.
- M5 needs M2 and M4; M6 needs M3, M4 and M5.

---

## 6. Testing

| Level | What | Where it runs | Gate |
|---|---|---|---|
| Unit | `core/` functions: ZIP, manifest, ChordPro, names, view, validation rules | `node --test` | Every change |
| Conformance | All 59 test libraries against `expected.json` | `node --test` with the conformance runner | SC-04, every change to `core/` |
| Round trip | Open and save unchanged gives identical bytes; blocks to text and back gives identical songs | `node --test` | Every change to `core/` |
| Crypto | Known-answer tests, cross-check, `valid-signed` reproduction | `node --test` and every browser | SC-05 |
| Fuzz | ZIP and ChordPro readers with the test libraries as corpus | A fuzz harness under `node` | SC-11, before each release |
| Browser | CSP and Trusted Types clean, storage empty of keys, no third-party requests | The written browser checklist, in every browser of TD-15 (IQ-03) | SC-03, SC-06, SC-07 |
| Server | Headers, TLS, DNS, integrity | `check-headers.py`, `testssl.sh`, the integrity timer | SC-01, SC-02, SC-09, SC-12 |
| People | Testers on the test instance | `test.zangbundel.nl` | M7 |

---

## 7. Release procedure for the test instance and the placeholder

As securityAssessment §7.4, for both sites:

1. Tag (`git tag -s`), build offline, check reproducibility.
2. Sign `release-manifest.json` with the release key.
3. Upload as the deploy user into the staging directory.
4. The owner runs the activation script: verify signature and hashes, copy read-only into `releases/<version>/`, switch `live`.
5. Run SC-01 and SC-09 against the host; write the result to `design/test-results/`.

The placeholder and the manager have separate release directories and separate manifests; activating one never touches the other.

---

## 8. Risks

| ID | Risk | Effect | Handling |
|---|---|---|---|
| R-01 | The FDS changes during implementation (open item O-11, the app's proposal) | `expected.json` files and rules change; rework in M2 | M2 starts with the rules O-11 does not touch; the conformance runner makes every change visible |
| R-02 | The Songbook app and the manager read a rule differently (O-11: app reports S-codes, stops at the first error) | Libraries pass in one and fail in the other | Settle O-11 before M6's exit, which imports manager-made libraries in the app |
| R-03 | Browser support older than Chrome 137 lacks Web Crypto Ed25519 | Two code paths | SR-15 cross-check; both paths in the browser matrix (M7.2) |
| R-04 | `@noble/ed25519` v3 unaudited (securityAssessment SF-03) | Accepted risk | Known-answer tests; used only where Web Crypto lacks Ed25519 |
| R-05 | A dependency gets a new advisory | Blocks a release (SR-14) | Advisory check in SC-10 before every release |
| R-06 | Testers use real keys or libraries on the test instance | Real keys on a less-checked build | SR-81 banner, SR-82 test key, tester guide |
| R-07 | Manual browser checks are skipped or done carelessly | A CSP violation or a key in storage goes unnoticed | The checklist's result is written to `design/test-results/` for every release; automate in M7 if a check was missed (IQ-03) |
| R-08 | Certbot or a manual edit removes the security headers | Silent weakening | SC-01 after every certificate renewal (monitor, M0.9) |

---

## 9. Questions and decisions

| ID | Question | Decision |
|---|---|---|
| IQ-01 | The request said `test.zangbundel.net`. Is that `test.zangbundel.nl`, or should `zangbundel.net` be registered too? | Decided 2026-11-06: `test.zangbundel.nl`; no second domain |
| IQ-02 | Install Node.js LTS as a development-only tool? | Decided 2026-11-06: yes (TD-21) |
| IQ-03 | Automate the browser checks (SC-03, SC-06, SC-07), or keep a manual checklist? | Decided 2026-11-06: a written checklist first; automate in M7 if it proves error-prone |
| IQ-04 | Version numbers of the web app? | Decided 2026-11-06: `v0.2.0` for the first test release at the end of M7, semantic versioning after that |
| IQ-05 | Who tests in M7, and how are findings collected? | Decided 2026-11-06: the requester (Pepe) and two or three leaders; GitHub issues in this repository |
| IQ-06 | Does the placeholder name a planned date? | Decided 2026-11-06: no date |

---

## 10. Change history

| Version | Date | Change |
|---|---|---|
| Draft 0.1 | 2026-11-06 | First plan: the manager on `test.zangbundel.nl`, a static placeholder on `zangbundel.nl` (TD-20); repository layout, threads and tools; milestones M0 to M7 with work, requirements and exit checks; order, testing, release procedure, risks R-01 to R-08, open questions IQ-01 to IQ-06. |
| Draft 0.2 | 2026-11-06 | The owner's decisions on IQ-01 to IQ-06: `test.zangbundel.nl`, Node.js LTS as a development tool (TD-21), a written browser checklist first, `v0.2.0`, the requester and two or three leaders as testers with GitHub issues, no date on the placeholder. |
| Draft 0.3 | 2026-11-06 | M0's repository part done and tested locally (state under M0); privacy link per language; `check_headers.py` and the test holding page in the layout; M1.1 and M1.5 build on the M0 tools. |
| Draft 0.4 | 2026-11-06 | After the review of M0: AAAA records only once contabo6 has working IPv6 (M0.1); the state under M0 names the extended container test. |
| Draft 0.5 | 2026-11-06 | After the second review round: the state under M0 names 68 checks and the build test. M1.1 must add reference rewriting for JavaScript and web manifests; `build.py` refuses both until then. |
| Draft 0.6 | 2026-11-06 | M1.1 bundles each entry point (webappTDS TD-22); Node.js LTS 26.13.0 installed on the development machine (IQ-02). |
| Draft 0.7 | 2026-11-06 | After the review of M1 part 1: the M1 state separates repository tests from one-off and manual checks; layout 3.1 matches `webapp/src/`. |
| Draft 0.8 | 2026-11-06 | M2.8 includes the Trusted Types policy `zbm-worker` (webappTDS TD-23, the owner's decision on TQ-08). |
| Draft 0.9 | 2026-11-06 | M1.2 and M1.3 done (state under M1): vendoring with `vendor.py`, `node --test` with unit tests and the conformance runner's corpus checks. |
| Draft 0.10 | 2026-11-06 | M2 started (state under M2): ZIP reader, names, manifest, fingerprint, and the PKG, STR, MAN and SIG rules, conformant on all 56 cases for those families. |
| Draft 0.11 | 2026-11-06 | M2: every rule family implemented; SC-04 met on all 56 test libraries; readings beyond the corpus and what is left of M2 listed under M2. |
| Draft 0.12 | 2026-11-06 | M2: writing and saving done (deterministic ZIP, view writer, `library.js` with EDT-50 to EDT-58 and EDT-71); left: block form, conversion, worker, fuzzing. |
| Draft 0.13 | 2026-11-07 | M2 reviewed: findings fixed and listed under M2; the §9.3 test described as far as it goes. |
| Draft 0.14 | 2026-11-07 | M2.8 (library worker, client, `zbm-worker` policy, 20 s limit) and M2.9 (fuzzing, SC-11: 20,000 inputs, 0 failures) done. |
| Draft 0.15 | 2026-11-07 | M2.7 (conversion of release archives, snapshots and plain ZIPs) done; left in M2: the block form. |
| Draft 0.16 | 2026-11-07 | The engine follows song format v0.24 to v0.26: whitespace, comments, display text, and tag labels in the manifest (FDS draft 0.10); 58 test libraries. |
| Draft 0.18 | 2026-11-08 | M5.6: the owner's M5 review, observations F1 to F10, with their causes, work, documents, the decisions R1 to R3 (accepted by the owner) and the order of work. M7.6: the wiki is on `zangbundel.nl`, built from Markdown in this repository. |
| Draft 0.17 | 2026-11-07 | M3 written: key files, hybrid Ed25519 with self-test, the crypto worker and client, signed saves over a MessagePort. The exit is met in Chromium; Firefox, Safari and Edge are still to run. |
