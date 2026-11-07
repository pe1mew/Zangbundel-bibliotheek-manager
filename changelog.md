# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/). The design documents carry their own document versions in their headers.

## [Unreleased]

### Added
- **M3: keys and signing** (`design/implementationPlan.md` draft 0.17).
  - **`core/keyfile.js`** reads and writes `.zbkey` files (FDS 5.3). A damaged or DER-wrapped key is M-31.
  - **`core/ed25519.js`** signs with Web Crypto and a non-extractable key where the browser has Ed25519, and with `@noble/ed25519` elsewhere. Its known-answer self-test also cross-checks the two (SR-15, SR-16).
  - **The crypto worker** (`workers/crypto-handler.js`, `crypto-worker.js`) and its client (`app/crypto-client.js`) keep the private key in the worker only (SR-40) and overwrite it on `forget` and `pagehide` (SR-41). A new key signs only after its key file has been exported, with M-64 acknowledged (EDT-61).
  - **A signed save** gets its signature from the crypto worker over a `MessagePort` (SG-02, EDT-60, EDT-62).
  - **Tests:** the RFC 8032 test key reproduces `valid-signed.zbl`'s signature. `tests/unit/crypto.test.mjs` adds 11 tests; `node --test` 260 of 260, container 81 of 81.
  - **Browser check:** passed once in the browser pane (Chromium) under the SR-20 CSP; Firefox and Safari are still to run.
- **Tag labels in the manifest** (FDS draft 0.10, D-44; song format v0.26, decided by the owner). The optional manifest field `tags` holds a label per language for each tag of the songs; MAN-02 checks it.
  - **The engine** keeps the labels through open, save and Save as copy. It writes them into the manifest only, never into the 1.1 view, because current apps refuse an extra view field.
  - **Conversion** carries them over from `zangbundel.json` and lists what it leaves out (EDT-26).
  - **Test libraries** `tag-labels` and `tag-label-invalid`: 58 cases, all conformant. `tests/unit/tags.test.mjs` adds 5 tests; `node --test` 249 of 249, container 81 of 81, the long fuzz on the 58 libraries 0 failures.
  - **webappGUI draft 0.13** asks where the labels are edited (GQ-20).
- **M2.7: conversion** (`design/implementationPlan.md` draft 0.15). `webapp/src/core/convert.js` opens a ZIP without `manifest.json` as a new, unsigned library (EDT-21).
  - **Release archives and snapshots** keep their song IDs, title, description, licence and maintainer; setlists become sets, and entries of other libraries are reported (EDT-26).
  - **Plain ZIPs** of `<set>/<song>/<file>.cho` folders become sets, with a song of identical text stored once (EDT-25).
  - **Song IDs** are proposed from the title and made unique (EDT-36); other files are left out and listed (M-42).
  - **Tests:** `tests/unit/convert.test.mjs`, 5 tests; `node --test` 231 of 231; container 81 of 81.
  - **Fuzzing:** `fuzz.mjs` now counts the inputs it opened through conversion; the long run converted 101 of 20,000, with 0 failures.
- **M2.8: the library worker** (`design/implementationPlan.md` draft 0.14). Every library byte is now read in a Web Worker, which returns structured data only (SR-30).
  - **`src/workers/library-handler.js` and `library-worker.js`:** validate, open, save, copy and new.
  - **`src/app/library-client.js`** starts the worker through the Trusted Types policy `zbm-worker` (`src/app/trusted.js`, TD-23). After 20 s it ends the worker with PKG-02 (M-02), and the next request starts a new one (SR-31).
  - **Tested** with the real handler behind a fake worker. In the browser pane, a scratch page under the full CSP ran the bundled worker through the policy, and a raw `new Worker()` was refused.
- **M2.9: fuzzing of the ZIP and ChordPro readers** (SR-35, SC-11). `webapp/tests/fuzz.mjs` mutates the test libraries; every input must give findings, never throw, within 2 s.
  - **Long run:** 20,000 libraries and 2,000 songs with 0 failures, slowest 577 ms, at most 296 MB.
  - **Short run:** every `node --test` runs a short version.
- **M2: writing and saving a library** (`design/implementationPlan.md` draft 0.12).
  - **New core modules:** `webapp/src/core/zip.js` writes ZIPs deterministically; `view.js` writes the 1.1 view; `library.js` opens a library into the Editor's model and saves it.
  - **Unchanged:** saved byte for byte as opened, signature included (EDT-51).
  - **Changed:** version + 1, `modified`, an optional `changes` note, canonical songs, a new view and manifest, and the signature of the library's own key (EDT-52 to EDT-58, EDT-60, EDT-62, EDT-63).
  - **Save as copy** gets a new ID, version 1, and no author (EDT-71).
  - **Every save runs the rules on its own output** and is refused on an Error (EDT-50). PKG-09, the sharing warning, is added.
  - **Tests:** `tests/unit/library.test.mjs`, 10 tests; `node --test` 201 of 201, container 81 of 81.
- **M2: every validation rule of FDS section 6, SC-04 met.** `webapp/src/core/chordpro.js` reads a song as the ChordPro profile of the app's song format defines it: canonical form, metadata, environments, chorus repeats and the canonical line list. It reproduces the worked example of song format §9.3.
  - **`validate.js`** adds the song rules (SNG-01 to SNG-18), the set rules (SET-01 to SET-05) and the view checks (VIEW-01 to VIEW-03, with the exact PF-42/PF-43 bytes).
  - **SC-04:** all 56 test libraries give exactly their expected Editor findings, with no to-dos left. Five seeded defects turn cases red.
  - **The bundled engine gives the same findings** as the native modules on every library (`webapp/tests/test_engine_bundle.py`); `tests/unit/chordpro.test.mjs` covers the parser.
  - **Container test:** 81 of 81. `design/implementationPlan.md` draft 0.11 lists the readings made beyond the corpus and what is left of M2.
- **M2 started: the library engine** in `webapp/src/core/` (`design/implementationPlan.md` draft 0.10).
  - **`zip.js`** reads the ZIP as untrusted input. It checks the central directory and every limit before inflating, then inflates each entry into a buffer of exactly its declared size and checks the CRC-32, so a ZIP bomb cannot allocate more than the limits.
  - **`names.js`, `manifest.js` and `fingerprint.js`** cover the name rules, the manifest and `manifest.sig`, and SG-20.
  - **`validate.js`** applies the PKG, STR, MAN and SIG rules with the readings of FDS O-11, verifying signatures with the vendored `@noble/ed25519`.
  - **Conformance:** for these four families all 56 test libraries give exactly their expected findings. Song, set and view rules are listed as to-dos (49).
  - **Unit tests** (`tests/unit/zip.test.mjs`) cover the PKG forms the corpus cannot hold and a ZIP bomb that lies about its size.
  - **The container test** runs the engine under Node 18 with `--experimental-global-webcrypto`: 80 of 80.
- **M1.2, vendoring.** `webapp/tools/vendor.py` vendored `fflate` 0.8.3 and `@noble/ed25519` 3.2.0 into `webapp/vendor/`, with their MIT licences and `VENDOR.md`.
  - **Checks run:** the tarball SHA-512 against the registry's `dist.integrity`, the registry signatures, provenance, and `npm audit` with no advisories.
  - **fflate 0.8.3 publishes no provenance attestation.** It is vendored with `--accept-missing-provenance` and recorded as such. noble's SLSA provenance verified.
  - **`build.py` re-checks** every vendored file against `VENDOR.md` when it bundles one.
  - **`.gitattributes`** keeps `webapp/vendor/` byte-exact (`-text`), as it does `test-libraries/`.
  - **`webapp/tests/test_vendor.py`** bundles both and runs them in Node: same exports and ZIP bytes as the native modules, and RFC 8032 test 1.
  - `NOTICE`, `license.md`, `design/securityAssessment.md` draft 0.11 (7.4) and `design/webappTDS.md` draft 0.14 (TD-17) record the result.
- **M1.3, test runner.** `node --test webapp/tests/` (`webapp/package.json` marks the folder as ES modules for Node; no dependencies) runs:
  - unit tests of `i18n.js`;
  - `conformance.test.mjs` over the 56 test libraries. It checks each `.zbl` against its recorded SHA-256 and each `expected.json`'s form now, and lists the Editor comparison (SC-04) as a to-do until the library engine exists (M2).
  - The container test runs all of these: 80 of 80. `design/implementationPlan.md` draft 0.9.
- Milestone M1, first part (`design/webappTDS.md` draft 0.11, `design/securityAssessment.md` draft 0.8, `design/implementationPlan.md` draft 0.6):
  - **TD-22, the owner's choice: the build bundles the JavaScript itself.** `Integrity-Policy` refuses modules imported without integrity, so `webapp/tools/bundle.py` joins each entry point (main thread, each worker) into one file with SRI. It works from a subset of ES modules, read with a lexer that skips comments, strings, templates and regexes. The bundler refuses default exports, re-exports, dynamic `import()`, bare specifiers and cycles.
  - **Tests.** `webapp/tests/test_bundle.py` runs bundles in Node: 20 checks. fflate 0.8.3 and @noble/ed25519 3.2.0, bundled from their npm packages in a scratch test, behave as natively, including an RFC 8032 signature.
  - **The minimal manager (M1.4)** in `webapp/src/`: the splash with the app's photograph (GD-27, GD-30) in nl/en/de, the TESTVERSIE banner on the test instance (SR-81), then a card saying what this build is. It renders through `dom.js` without `innerHTML` or style attributes, and has its own `security.txt`.
    - In the browser pane, under the SR-20 CSP and `Integrity-Policy`, it ran with no console report.
    - Copies with a missing or wrong script integrity were refused.
  - **The test instance's CSP is now the SR-20 policy** (M1.5, configuration part).
  - **The container test** builds, signs and activates the manager on the test instance: 74 of 74 checks pass.
  - **Node.js LTS 26.13.0** is installed on the development machine (TD-21).
- Milestone M0, the repository part (`design/implementationPlan.md` draft 0.3, `design/securityAssessment.md` draft 0.5):
  - **Placeholder for `zangbundel.nl`** in `webapp/placeholder/`: static pages in Dutch, English and German, a privacy statement in each language and `security.txt`. No script, no inline style.
  - **Holding page** for `test.zangbundel.nl` in `webapp/test-holding/`.
  - **nginx configuration** for both hosts in `webapp/server/nginx/`: security headers on every response, per-host CSP, basic auth and `noindex` on the test instance, GET/HEAD only, rate limits, shortened addresses in the access log, `certbot certonly --webroot`.
  - **Release chain:** `webapp/tools/build.py` (hashed asset names, SRI, `release-manifest.json`, identical rebuilds) and `sign-release.sh` (ssh-keygen signature). On the server, `zbm-receive` is the deploy user's forced command and `zbm-release` activates and checks releases; an hourly `zbm-verify` timer pushes to Uptime Kuma.
  - **SC-01 header check:** `webapp/tools/check_headers.py`.
  - **Runbook** for the owner's steps (DNS, registrar lock, keys, install, certificates, monitoring, HSTS ramp, release gate): `webapp/server/README.md`.
  - **Testing.** Tested in an Ubuntu 24.04 container with nginx 1.24.0: install, upload, activation, eight refused uploads, integrity check, and SC-01 for both hosts, 31 of 31 passed. The test is kept in `webapp/server/test/` and can be rerun. Nothing is installed on contabo6 yet.
- `design/implementationPlan.md` draft 0.1: the plan for implementing the manager on `test.zangbundel.nl` with a static placeholder on `zangbundel.nl` (webappTDS draft 0.9, TD-20). Repository layout, threads and tools; milestones M0 (infrastructure and placeholder) to M7 (hardening and test release) with their work, requirements and exit checks; testing, release procedure, risks and six open questions (among them `test.zangbundel.net` versus `.nl`, and Node.js as a development tool).
- `design/securityAssessment.md` draft 0.1: a security and privacy assessment of the web app's design. It names the assets, attackers and 20 findings (among them: the site's code as the root of trust, the shared host with end-of-life PHP sites, CVE-2026-45820 in `fflate` before 0.8.3, the unaudited `@noble/ed25519` v3, DOM injection from library content, missing security headers, no CAA, registrar lock, SPF or DMARC on the new domain), and specifies 67 binding requirements (SR-01 to SR-93), the nginx, DNS, application and release implementation, a release gate of 13 checks, accepted risks and eight open questions. webappTDS draft 0.6 makes it binding (TD-18).

### Changed
- **DNS set (M0.1, M0.2) with two accepted deviations** (`design/securityAssessment.md` draft 0.13).
  - **No MX record:** Openprovider refuses the null MX, so the domain publishes no MX, and port 25 on contabo6 is closed (SR-07).
  - **No transfer lock:** `.nl` has none, so two-factor authentication on the registrar account protects the domain (SR-05).
  - **Runbook step 1** also deletes the parked `mail`, `ftp`, `webmail` and `www` records.
- **Whitespace is spaces and tabs only** (FDS draft 0.9, O-11; song format v0.24, approved by the owner). The engine no longer trims a no-break space or U+FEFF from directive names, values, the `meta` split or setlist lines, and a set name may begin or end with one. `tests/unit/whitespace.test.mjs` adds 4 tests.
- **Comments and display text as the app reads them** (song format v0.25, approved by the owner). An indented `#` line is a lyric line, and the display text drops trailing Unicode spaces, the no-break space included, so the line list matches app 0.4.0. The app's vectors `comment-indented` and `nbsp-display` are tested; `node --test` 238 of 238, container 81 of 81, the long fuzz 0 failures.
- **Review of M2** (`/review-changes`, three lenses on 0f87a7e..8c22e37), with fixes (`design/implementationPlan.md` draft 0.13, FDS draft 0.8 O-11). Each fix has a regression test that fails on the reviewed code (`node --test` 220 of 220).
  - **Inflation stops at the declared size.** fflate with a fixed buffer bounded memory but decoded the whole stream: minutes of CPU for a ZIP within every limit, and silent truncation (SR-31).
  - **Signatures are verified by strict RFC 8032.** noble's ZIP-215 default accepted a forged signature under a small-order key.
  - **ZIP structure:**
    - local headers must agree with the central directory (a streaming unpacker reads the local name);
    - overlapping entries, empty and `.` path segments, and a file and folder of one name are refused.
  - **Hostile manifests no longer make the engine throw.** Trimming is linear (SR-33).
  - **Song readings:** C1 controls are SNG-01; braces inside a directive are SNG-04; `{chorus: label}` takes the most recent chorus with that label.
  - **Saving:**
    - an unchanged library with an Error is not saved (EDT-50 before EDT-51);
    - set names that would inject setlist lines are MAN-02, and MAN-02 carries its reasons;
    - copies share nothing with the original, and copy titles fit 80 characters;
    - files left out on save are reported;
    - non-UTF-8 songs are kept as found, so the message is SNG-01;
    - an author without a signature is dropped (SG-04);
    - `__proto__` fields are kept;
    - file names lose bidirectional controls (SR-36).
  - **Recorded:** the readings in FDS O-11 for the app to confirm, and the independent checker's differences from the song format in `test-libraries/README.md`.
- **Shared test libraries follow song format v0.23** (requested by the library repository's session, approved by the owner with the app's proposal on shared test libraries, 3.7 and O-11 f):
  - **`song-two-files`:** a format 1.1 app now skips only the bad copy (S004), and the song itself imports, so S005 and SL101 are gone. The `.zbl` is unchanged.
  - **FDS draft 0.8:** O-11's PKG-02 ratio reading is settled as the ZIP file size.
- The owner keeps `fflate` 0.8.3 although it publishes no provenance attestation: an accepted risk in `design/securityAssessment.md` draft 0.12, section 9.
- **The owner's decision on TQ-08: workers start through a second Trusted Types policy, `zbm-worker`** (`design/webappTDS.md` draft 0.13, TD-23; `design/securityAssessment.md` draft 0.10; `design/implementationPlan.md` draft 0.8). SR-20's CSP now lists `trusted-types zbm-download zbm-worker`, also in the test instance's nginx config and in `check_headers.py`. The policy accepts only `/assets/library-worker.<hash>.js` and `/assets/crypto-worker.<hash>.js`, and it comes with the first worker (M2.8). In a scratch check in the browser pane under the new CSP, a bundled worker started through such a policy, the policy refused a foreign URL, and Trusted Types blocked a raw `new Worker(url)`.
- Review of M1 part 1 (`/review-changes`, four lenses on 13f7776), with fixes (`design/webappTDS.md` draft 0.12, `design/securityAssessment.md` draft 0.9, `design/implementationPlan.md` draft 0.7):
  - **The bundler no longer makes silently wrong bundles.** A removed `import` or `export` line becomes `;`, so the line before it can't run on into the next one. A `/` after `if (…)` is read as a regex, and after `x++` as division.
  - **The build checks every bundle with `node --check`,** which also refuses a top-level `await`. The test image now has Node.
  - **Newly refused:** `export { a as default }`, string export names, non-ASCII identifiers and NUL bytes.
  - **No longer refused:** keys, class fields and methods named `import` or `export`.
  - **Every bundle starts with `'use strict'`.** A worker is any `new URL('./x.js', import.meta.url)`, so the code can pass it through a Trusted Types policy (open question TQ-08).
  - **The version check reads tokens,** so a comment can't fool it.
  - **The renamed-asset check looks at string literals only,** with no false hit on prose.
  - **The test banner is SR-81's fixed Dutch text in every language.**
  - **`test_bundle.py`** compares bundles with the native modules in Node: 33 checks.
  - **`run.sh`** checks that two builds are identical, that `live` really is the manager, and the hourly check with the manager live: 77 of 77.
  - **Documentation:** the plan separates repository tests from one-off and manual checks. The assessment records SR-27's one differing header until go-live and how SR-12 and SR-13 apply to bundles.
- Second review round of M0 (`/review-changes`, three lenses on f089ab0), with fixes (`design/securityAssessment.md` draft 0.7, `design/implementationPlan.md` draft 0.5):
  - **Logs.** They move to `/var/log/nginx/zangbundel/` with their own logrotate stanza (`webapp/server/logrotate/zangbundel`), because Ubuntu's `notifempty` kept quiet logs, full addresses and all, indefinitely. Retention is again 14 days.
  - **Byte ranges off.** A 416 answer doubled every header.
  - **Build.** It refuses markup that Python's parser reads differently from a browser (CDATA, abrupt comments, odd end tags), plus frames, `<base>`, `<meta http-equiv>`, external resources and SVG script. It refuses JavaScript and web manifests until M1.1, and checks `webapp/tools/` and `main` as well. Former false positives (`./`, `../`, `data-src`, CSS comments) now build. The cases are kept as `webapp/tests/test_build.py`.
  - **`zbm-receive`.** It refuses root, compressed uploads and tars without an end marker, counts the upload itself in the 200 MB, and opens its lock without truncating.
  - **Activation** works whatever root's umask.
  - **`sign-release.sh`** finds Python before asking for the passphrase.
  - **Privacy statements** name unknown-user logins too.
  - **Container test:** 68 of 68.
- Review of M0 (`/review-changes`, four lenses), with fixes (`design/securityAssessment.md` draft 0.6, `design/implementationPlan.md` draft 0.4):
  - **Hourly integrity check.** It no longer passes when files hide in a directory it cannot read. It also checks every file's owner and mode, and runs as its own `zbm-verify` user, not a dynamic one, whose uid ssh-keygen could not resolve.
  - **Build.** It checks the HTML with a parser; the regexes could be evaded. It verifies that every reference resolves and carries the right SRI, keeps fragments, and refuses `@import` and ignored files. A release build needs a signed tag (SR-10, SR-90); trial builds go only to the test instance.
  - **`zbm-receive`.** One upload at a time, a 200 MB staging quota, and incomplete tars refused.
  - **nginx.** Its own error pages carry the CSP, COOP and COEP. IPv6 addresses are shortened correctly when compressed. The comments on TLS and HTTP/2 now match contabo6.
  - **Privacy statements.** They name failed test logins in the error log and state retention as at most 15 days.
  - **Container test.** It counts every check: 55 of 55 pass.
  - **Runbook.** Corrections: snippet count, SR labels, tag signing, the `zbm-verify` user, `apache2-utils`, and the Kuma heartbeat.
- `design/implementationPlan.md` draft 0.2, the owner's decisions: the test instance is `test.zangbundel.nl`; Node.js LTS is a development-only tool (webappTDS draft 0.10, TD-21); browser checks start as a written checklist; the first test release is `v0.2.0`; testers are the requester and two or three leaders, with GitHub issues; the placeholder names no date.
- SQ-01 decided: the host nginx on contabo6 serves `zangbundel.nl` and its test instance natively, each from its own read-only release directory, without a container (`design/securityAssessment.md` draft 0.4, SR-70, SR-83; `design/webappTDS.md` draft 0.8, TD-19). All security questions are now decided.
- The owner's security decisions (`design/securityAssessment.md` draft 0.3): HSTS preload after three months (SQ-03); no passphrases on key files, the risk accepted (SQ-04); Ed25519 from the browser's Web Crypto with non-extractable keys where available and `@noble/ed25519` elsewhere (SQ-05; webappTDS draft 0.7, TD-17); no offline package (SQ-07, SR-64 withdrawn); forgetting the key on request and after 30 minutes without input (SQ-08). `design/webappGUI.md` draft 0.12 adds *Sleutel vergeten* (GD-39) and the inactivity warning (GD-40), and the mock shows both. SQ-01 (native or container) is still open.
- `design/securityAssessment.md` draft 0.2, the owner's answers: SF-02 and SR-71 withdrawn (the legacy sites on contabo6 run in their own containers behind the host nginx); two-factor authentication is on at the DNS provider; the domain has no mail, so a null MX, SPF `-all` and DMARC `reject` (SR-07). Section 10 compares native nginx with a container for SQ-01 (equal for security; native is simpler, the container consistent with the other sites) and works out SQ-03, SQ-04, SQ-05 (now a hybrid: non-extractable Web Crypto keys where the browser has Ed25519), SQ-07 (an offline package needs a local web server) and SQ-08.
- `design/webappGUI.md` draft 0.11 and the mock: while editing a song, *Bewerken als* offers two named modes, *Blokken* and *Code (ChordPro)*, as a segmented control instead of a switch; the user can change mode at any moment without losing changes (GD-38).

## [0.1.0] - 2026-11-06

The first version: the functional design specification (FDS draft 0.7), the GUI and technical design of the web app (webappGUI draft 0.10, webappTDS draft 0.5), the clickable mock in `webapp/mock/`, and the shared test libraries. There is no web app code yet.

### Changed
- The mock is version 0.1.0 and lives in `webapp/mock/` as static files (webappTDS draft 0.5, TD-16). The ZIP and Ed25519 libraries for the web app are chosen: `fflate` 0.8.3 and `@noble/ed25519` 3.2.0, both MIT, with SHA-256 and SHA-512 from the browser (TD-17). Both web documents depend on FDS draft 0.6; the mock and webappGUI draft 0.10 follow it: the maintainer is required (M-39), the title at most 80 characters, and the terms are *signed by* and *not signed* (GD-37).
- The F-Droid badge's licence is checked: CC BY-SA 3.0, credit F-Droid (`license.md`, `NOTICE`).
- FDS draft 0.7: open item O-04 records that every rule of section 6 has a test library except PKG-09, and new open item O-11 lists the readings the test libraries had to make where the rules leave room.
- Mock: a block in the section editor has equal spacing below the text and at its sides (12 px); the empty hint line no longer takes space (webappGUI section 2.2).
- `design/webappGUI.md` draft 0.9 and the mock: leaving the song editor (for example adding a song to a set) no longer shows *Pas eerst toe of annuleer* but a dialog that names the song and offers *Wijzigingen in "<titel>" toepassen*, *… weggooien* or *Verder bewerken*; after applying or discarding, the click is carried out (GD-36).
- The mock follows the walk-through decisions (webappGUI draft 0.8): Dutch, English and German, taken from the browser and switched from the bottom bar, remembered with the bar widths; sections with verse, chorus, bridge, chorus repeat, labels and locked blocks, and a ChordPro text view that round-trips exactly; *Toepassen* always applies, problems marked in the song list and listed in the *Controle* panel; sets as a tab with ordering; library fields in the left bar; *Downloaden* keeps the library open, *Sluiten* separate, *Opslaan als kopie*; signing in the download dialog and a signed example library that is read-only until its key is loaded; the splash with the app's photograph for 3 seconds; severity icons; the narrow-window page; *binnenkort* badges. The app's background photograph is named in `NOTICE` and `license.md`.
- Walk-through of all open questions with the owner. `design/webappGUI.md` draft 0.7 (section 3.6, GD-16 to GD-35): deleting a song, with a bin on each row; the interface follows the browser's language and switches from the bottom bar; sections plus a ChordPro text view; verse, chorus, bridge, chorus repeat and labels, with everything else kept as locked blocks; *Toepassen* always applies and a *Controle* panel lists the problems; sets as a tab in the right bar; library fields in the left bar; *Downloaden* keeps the library open and *Sluiten* is separate; signing in the download dialog and read-only signed libraries; name, 3-second splash with the app's photograph, *Bibliotheek openen*, severity icons, system font, desktop only; widths and language remembered; *binnenkort* badges. `design/webappTDS.md` draft 0.4 (TD-11 to TD-15): the domain for the manager only, static files first, `test.zangbundel.nl` behind a password, browser APIs first, browsers up to about three years old. The mock shows deleting a song; the other decisions are not in the mock yet.
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
- `test-libraries/`: 50 more cases, 56 in all: an invalid library for every rule of FDS section 6 except PKG-09 (a ZIP over 16 MiB is too large for the repository) and some forms of PKG-02 and PKG-03, listed in the README. `check_test_libraries.py`, a checker that shares no code with the generator and verifies signatures with `cryptography`, gives every case exactly its expected findings (56 cases, 0 failed); the generator's output is byte-identical on a second run; the library repository's `release.py` gives the expected format 1.1 verdict for every case. The new test songs are two-line songs written for the tests (CC0).
- `test-libraries/`: the first shared test libraries of FDS open item O-04, in the format of FDS draft 0.5. There are six cases:
  - `valid-signed` and `valid-unsigned`;
  - `view-missing` (VIEW-01) and `view-mismatch` (VIEW-02);
  - `signature-invalid` (SIG-03) and `key-wrapped` (SG-05).

  Each has an `expected.json` with the verdict for the app, the Editor and an app that reads only format 1.1. They are built by `make_test_libraries.py` (standard library only, deterministic, Ed25519 after RFC 8032, checked against the RFC's test vector) from four CC0 songs. They are signed with the published RFC 8032 test key, which is included as `test-key-rfc8032.zbkey` and marked as not for real use.

  An independent check found every case failing exactly its expected rule, with signatures verified by the `cryptography` package. The library repository's `release.py` accepts all six as format 1.1 snapshots. No Editor or app implementation has run them yet.
- `design/webappTDS.md`, the technical design of the web app, draft 0.1: the Editor is a web app (TD-01) in `webapp/` (TD-02), running on nginx or Apache with PHP (TD-03), every design verified in a mock before it goes to a test server (TD-04), HTTPS (TD-05). Open questions TQ-01 to TQ-05, first among them whether libraries are processed in the browser or on the server.
- `design/webappGUI.md`, the GUI design of the web app, draft 0.1: screens and their behaviour (GD-02), with the colours, buttons and icons of the Zangbundel app (GD-01). Open questions GQ-01 to GQ-05.
- `design/FDS.md`, the functional design specification, draft 0.1 (2026-11-04): the library package format (ZIP, manifest with SHA-256 hashes, optional Ed25519 signature), the validation rules shared with the Zangbundel app, the Editor's behaviour, the app's import, and the user messages.
- The repository set up like the other Zangbundel repositories: `README.md`, `contributing.md`, `code_of_conduct.md`, `license.md`, `LICENSE` (Apache 2.0), `NOTICE`, `changelog.md`, `.editorconfig`, `.gitattributes`, `.gitignore`, and for AI coding agents `CLAUDE.md`, `memory/` and `.claude/review-profile.md`.
