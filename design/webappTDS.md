# Technical Design Specification — Bibliotheek-manager web app

| | |
|---|---|
| **Document** | Technical Design Specification (TDS) of the web app |
| **Status** | Draft 0.15 |
| **Date** | 2026-11-11 |
| **Depends on** | `design/FDS.md` draft 0.7 |
| **Companion** | `design/webappGUI.md` (screens, colours, buttons, icons) |

---

## 1. Introduction

### 1.1 Purpose

This document records how the bibliotheek-manager is built as a web app: where the code lives, what it runs on, how a design is verified, and how it reaches a server. *What* the manager does is the FDS; *how it looks* is `design/webappGUI.md`. This document is a log: decisions are added as they are taken, with the date, and are never renumbered.

### 1.2 Notation

- Decisions are `TD-nn`, open questions `TQ-nn`. IDs are never reused; a superseded decision is marked *Superseded by TD-nn* and kept.
- Requirement key words follow RFC 2119.
- FDS IDs (`EDT-nn`, `D-nn`, …) refer to `design/FDS.md`.

---

## 2. Decisions

| ID | Date | Decision |
|---|---|---|
| TD-01 | 2026-11-05 | **The Editor is a web app.** Of the platforms FDS 1.4 and D-01 allow, the owner chose the web app, hosted on a server. Native Windows, Linux and Android Editors are not planned. |
| TD-02 | 2026-11-05 | **The web app lives in `webapp/`** in this repository. Everything that is deployed to a server comes from that folder. |
| TD-03 | 2026-11-05 | **The server is nginx or Apache with PHP.** The web app must run on either web server, so it must not depend on a feature only one of them has (for example `.htaccess` rules without an nginx equivalent). Any server configuration the app needs is documented for both. |
| TD-04 | 2026-11-05 | **A design is verified in a mock before it is deployed.** Every screen is first built as a clickable mock and checked by the owner in a browser. Only a design approved in the mock is built into the web app and deployed, first to a test server. |
| TD-05 | 2026-11-05 | **HTTPS only.** The hosted web app is served over HTTPS (FDS EDT-04). |
| TD-06 | 2026-11-05 | **Libraries and keys are processed in the browser.** Opening, validating, editing, hashing, signing and saving a library run in JavaScript on the user's device. The server delivers the web app's files and nothing else: no library, song, key or manifest is ever sent to it. This meets FDS EDT-02, EDT-04 and EDT-65 by construction, since the server holds no session data, and keeps the promise on pe1mew/Zangbundel-bibliotheek#1 that nothing is uploaded. Resolves TQ-01. |
| TD-07 | 2026-11-05 | **PHP has no part in library handling.** It may serve pages, the interface texts in the three languages (EDT-80) and security headers; it receives no form posts or uploads with library content. A future PHP feature that would receive user data needs a new decision here first. |
| TD-08 | 2026-11-05 | **No request carries library data, and no third party is contacted.** The web app makes requests only to its own server, for its own files. A Content Security Policy enforces this (`default-src 'self'`, no `connect-src` beyond `'self'`), so a mistake in the code cannot send a library or key elsewhere. |
| TD-09 | 2026-11-06 | **Domain: `zangbundel.nl`**, registered by the owner for the library manager. |
| TD-10 | 2026-11-06 | **Host: contabo6.** `zangbundel.nl` is hosted on contabo6, the owner's VPS (configuration in the local repository `contabo-vps-6`). The same host also runs a **test instance**, where each version is tested (TD-04) before it reaches `zangbundel.nl`. The server configs for both are added to `contabo-vps-6`, next to the other sites. |
| TD-11 | 2026-11-06 | **`zangbundel.nl` is for the library manager only, for now.** The Zangbundel app's public pages (privacy policy, join page, manual) stay where they are; moving them is a separate decision in the app repository. Resolves TQ-07. |
| TD-12 | 2026-11-06 | **The first version is static files.** HTML, CSS and JavaScript only, served by nginx; no PHP. PHP 8.3 on contabo6 is used only when a feature needs it, after a decision here (TD-07). Resolves TQ-02. |
| TD-13 | 2026-11-06 | **The test instance is `test.zangbundel.nl`, behind a password.** HTTP basic authentication, so that testers do not mistake it for the real manager, and `noindex` so that search engines skip it. A script deploys `webapp/` to the test instance and promotes a tested version to `zangbundel.nl`. Resolves TQ-04, except who has access (owner and invited testers, to be listed when testing starts). |
| TD-14 | 2026-11-06 | **The browser's own APIs first; a small library only where the browser lacks one.** Web Crypto, Compression Streams, `TextDecoder` and `String.prototype.normalize` are used where the supported browsers (TD-15) have them. Where they do not, a small free library may be used, pinned to a version and a checksum, served from `zangbundel.nl` itself (TD-08), and each recorded as a decision here. No UI framework. Resolves TQ-05. |
| TD-15 | 2026-11-06 | **Supported browsers: desktop Chrome, Edge, Firefox and Safari up to about three years old.** Older browsers than the evergreen ones lack Ed25519 in Web Crypto and parts of Compression Streams, so under TD-14 signing and ZIP will need a library; which ones is a decision still to take. Resolves TQ-06. |
| TD-16 | 2026-11-06 | **The mock lives in `webapp/mock/`** as static HTML, CSS and JavaScript without PHP, reviewed through the preview server `webapp-mock` (`.claude/launch.json`, `python -m http.server`). The mock as it stands on 2026-11-06 (webappGUI draft 0.10) is version **0.1.0** of this repository. Resolves TQ-03. |
| TD-17 | 2026-11-06 | **Two small libraries, chosen under TD-14 for the browsers of TD-15.** *ZIP*: `fflate` 0.8.3 (MIT), reading and writing ZIP with deflate and CRC-32; the browsers of TD-15 have no ZIP reader of their own. *Ed25519*: the browser's Web Crypto Ed25519 where available, with keys made non-extractable as soon as possible; `@noble/ed25519` 3.2.0 (MIT) in browsers of TD-15 that lack it, with raw 32-byte keys as FDS SG-05 requires (*amended 2026-11-06*, securityAssessment SQ-05, SR-16). `@noble/ed25519` takes its SHA-512 from Web Crypto (`crypto.subtle`), so `@noble/hashes` is not needed. Everything else is the browser's own: SHA-256 (Web Crypto), UTF-8 with `TextDecoder` in fatal mode, NFC with `String.prototype.normalize`, random UUIDs with `crypto.getRandomValues`. Both libraries are copied into `webapp/` (no CDN, TD-08), each with its version and SHA-256 recorded next to it and its licence named in `NOTICE`, in the change that adds them. A newer version is a new decision. *Audit status (securityAssessment SF-03, SR-14 to SR-16):* `fflate` 0.8.3 is the first 0.8 release with CVE-2026-45820 fixed and is therefore the minimum; `@noble/ed25519` v3 is not independently audited (v1 was, by Cure53 in 2022), which the assessment accepts with a known-answer self-test and a cross-check against Web Crypto. *Vendored 2026-11-06 (`webapp/vendor/VENDOR.md`): `@noble/ed25519` 3.2.0 carries a verified SLSA provenance attestation; `fflate` 0.8.3 has none published, so only its registry signature and `dist.integrity` could be checked (securityAssessment 7.4).* |
| TD-18 | 2026-11-06 | **The security requirements are binding.** `design/securityAssessment.md` specifies the requirements SR-01 to SR-93 and the release gate SC-01 to SC-13 for the final implementation: site authenticity (TLS, HSTS, CAA, DNSSEC, registrar lock), code integrity (signed releases, vendored and verified libraries, SRI, Integrity-Policy, file-integrity monitoring), browser hardening (CSP with Trusted Types, isolation headers), untrusted input in a worker, keys only in a crypto worker, privacy (no third parties, shortened IP logs for 14 days, a privacy statement), availability, server isolation and the test instance. A change to one of them is made in that document first. |
| TD-19 | 2026-11-06 | **The host nginx serves the site natively.** `zangbundel.nl` and `test.zangbundel.nl` are vhosts of the host nginx on contabo6, each serving its own read-only release directory, with no container and no interpreter (securityAssessment SQ-01, SR-70, SR-83). Unlike the other sites on the host, which nginx proxies to containers; the assessment found no security gain in a container here, and native has fewer parts to patch and configure. |
| TD-20 | 2026-11-06 | **Until going live, `zangbundel.nl` shows a static placeholder and the manager runs on `test.zangbundel.nl`.** The placeholder is HTML and CSS only, in Dutch, English and German, with the name and logo, a line that the manager is being built, the Android links of GD-15 and GD-35, the privacy statement and `security.txt`; its CSP forbids all script (`script-src 'none'`). It meets the same transport, header and logging requirements as the manager. Replacing it with the manager is a later decision (`design/implementationPlan.md` M8). |
| TD-21 | 2026-11-06 | **Node.js LTS is a development tool, never part of the site.** It runs the unit and conformance tests with its built-in test runner (`node --test`, no test framework) and the npm checks of the vendored libraries (securityAssessment SR-12: `npm pack`, `npm view … dist.integrity`, `npm audit signatures`). The site contains no npm package except the two vendored files of TD-17. Browser checks start as a written checklist (implementationPlan IQ-03). |
| TD-22 | 2026-11-06 | **The build bundles each entry point into one file, from a subset of ES modules.** `Integrity-Policy: blocked-destinations=(script)` (securityAssessment SR-13) refuses a script without integrity metadata, and a module loaded by `import` has none, so the app cannot be served as loose modules. `webapp/tools/build.py` joins each entry point into one file with a hashed name, offline and in Python (`webapp/tools/bundle.py`): the main thread (`index.html`'s `<script type="module">`) and each worker. The source may use only static imports from a relative path (`import { a, b as c } from './x.js'`, `import * as ns from './x.js'`), exported declarations with one simple name (`export function`, `export async function`, `export function*`, `export class`, `export const`, `export let`, `export var`) and export lists of identifiers (`export { a, b as c }`). The build refuses default exports (also `as default`), re-exports, dynamic `import()`, bare specifiers, non-ASCII identifiers and import cycles; a regular expression may follow `)` only after `if`, `while`, `for` or `with`. Every bundle starts with `'use strict'`, and the build checks it with `node --check` (TD-21), which also refuses a top-level `await`. An imported binding is a copy, not a live binding. A worker entry point is written as `new URL('./worker.js', import.meta.url)`: the build bundles that module separately and writes the bundle's hashed name into the URL; the code passes the URL to `new Worker()` through the Trusted Types policy `zbm-worker` (TD-23). Browsers have no integrity attribute for workers, so a worker bundle is protected by its hashed name, the signed release manifest and the hourly check (SR-11, SR-73), not by SRI. Chosen by the owner over esbuild (an npm dependency in the build chain) and an inline import map (a CSP change, newest browsers only). |
| TD-23 | 2026-11-06 | **Workers start through a second Trusted Types policy, `zbm-worker`.** *(Resolves TQ-08; the owner's decision.)* Under SR-20, `require-trusted-types-for 'script'` makes `new Worker(url)` a sink that needs a `TrustedScriptURL`, so SR-20's CSP listed two policies: `trusted-types zbm-download zbm-worker`. *Amended 2026-11-11 (securityAssessment SF-25): `zbm-download` was never needed, because a `blob:` URL on a link is not a sink; the CSP lists only `trusted-types zbm-worker`.* The app creates `zbm-worker` once, in one module, and its `createScriptURL` accepts only a same-origin URL whose path is `/assets/library-worker.<hash>.js` or `/assets/crypto-worker.<hash>.js` (12 hexadecimal digits, as build.py names bundles); anything else throws. The worker URL comes from `new URL('./<name>.js', import.meta.url)`, which the build rewrites to the bundle's hashed name (TD-22). Written with the first worker (implementationPlan M2.8). |
| TD-24 | 2026-11-11 | **Hugo builds the wiki; its output is committed.** *(implementationPlan R3, M7.6, C9; the owner allowed the download.)* The wiki's source is Markdown in `wiki/<lang>/` with our own templates in `wiki/layouts/`, no theme and no JavaScript; `wiki/hugo.toml` passes no raw HTML through. Hugo is a development tool like Node.js (TD-21), never part of the site. It is pinned to **v0.169.0**: the zip `hugo_0.169.0_windows-amd64.zip` (SHA-256 `d1ea8b32…b09948`, from the release's checksums file; Hugo publishes no attestation) is unpacked as is into `C:\Apps\hugo`, without an installer, and `hugo.exe` has SHA-256 `48f73c26…715797`. `webapp/tools/wiki.py build` writes `webapp/src/wiki/`, which is committed. A release therefore needs no Hugo and stays reproducible from its signed tag (SR-10), and `build.py` checks the pages like every page; the stylesheet is `assets/wiki.css`. `wiki.py check` refuses a language without the wiki, a page missing in a language, a help link of the manager (`fieldhelp.js` `WIKI`) without its page and anchor, and, with the pinned Hugo present, output that differs from a fresh build. Two builds are byte-identical. The wiki is served at `/wiki/<lang>/`. |

---

### 2.1 contabo6 as found (2026-11-06)

What the host already runs, from the repository `contabo-vps-6`. These are facts about the server, not decisions of this project; check them again before deploying.

| Item | On contabo6 | Consequence |
|---|---|---|
| Web server | nginx, one config file per site in `contabo-vps-6/nginx/` | The nginx variant of TD-03 is the one that is tested first; the Apache variant stays documented but untested until a server needs it. |
| TLS | Let's Encrypt certificates via `certbot --nginx` | TD-05 is met the same way as for the other sites. |
| PHP | Native `php8.3-fpm` over a Unix socket; other PHP versions only in containers of other sites | See TQ-02. |

## 3. Requirements from the FDS that shape the build

These FDS requirements constrain every technical choice below; they are listed here so they are not missed, not restated.

| FDS | Consequence for the web app |
|---|---|
| EDT-02, D-16 | Nothing about a library or a key is kept between sessions: no server-side storage of libraries, no cookies or browser storage holding library content or keys. |
| EDT-04 | A hosted web app deletes all session data on the server at session end or after 2 hours of inactivity, whichever comes first, and uses HTTPS. With TD-06 the server holds no session data. |
| EDT-64, EDT-65 | The private key is held in memory only and never logged. With TD-06 it stays in the browser: not in `localStorage`, `sessionStorage`, IndexedDB, cookies or the console. |
| §3.5, PKG-01 to PKG-04 | Uploaded or opened ZIPs are untrusted: limits and path checks before any entry is read, wherever the ZIP is processed. |
| §6.1, principle 2 | The validation rules must give the same result as the Songbook app's (shared test libraries, FDS O-04). |
| EDT-59 | Saved libraries are offered as downloads with the MIME type `application/vnd.zangbundel.library+zip`. |
| PF-40 to PF-46, EDT-52 | On every save the Editor generates the format 1.1 view (`zangbundel.json`, `LICENSE`, `setlists/set-<n>.zbs`) from the manifest, byte-exact as PF-42 and PF-43 describe, and lists it in `files`; it never reads the view of a library it opens. Songs live under `songs/`. |
| SG-05, SG-20 | Keys are raw Ed25519 keys (32-byte public key, 32-byte seed), never X.509 or PKCS #8; the fingerprint is taken over the raw public key. The test key of RFC 8032 (`test-libraries/test-key-rfc8032.zbkey`) checks this. |
| §6, O-04 | The validation must give the findings listed in `test-libraries/<case>.expected.json` for every shared test library. |
| EDT-80 to EDT-83 | The interface is in Dutch, English and German. |

---

## 4. Open questions

| ID | Date | Question |
|---|---|---|
| TQ-01 | 2026-11-05 | *Resolved 2026-11-05 by TD-06: in the browser.* Where is a library processed: in the browser or on the server? |
| TQ-02 | 2026-11-05 | *Resolved 2026-11-06 by TD-12.* Which PHP version is the minimum? With TD-06 and TD-07, PHP needs no extensions for libraries; the question is what the host offers and what serving the pages needs. Is PHP needed at all for the first version, or can the server deliver static files only? *2026-11-06: contabo6 runs PHP 8.3 (native `php8.3-fpm`, see `contabo-vps-6/php/readme.md`); if PHP is used, 8.3 is the target.* |
| TQ-03 | 2026-11-05 | *Resolved 2026-11-06 by TD-16.* Where does the mock live and how is it served for review: a folder of static HTML, CSS and JavaScript under `webapp/` (for example `webapp/mock/`), or under `design/`? Does it need PHP to run? *2026-11-06: the first mock is in `webapp/mock/`, static, without PHP, served for review by `python -m http.server` (`.claude/launch.json`, `webapp-mock`). To be confirmed by the owner.* |
| TQ-04 | 2026-11-05 | *Resolved 2026-11-06 by TD-13.* *Partly resolved 2026-11-06 by TD-09 and TD-10: `zangbundel.nl` and a test instance, both on contabo6.* Still open: the address of the test instance (for example `test.zangbundel.nl`), whether it is open to everyone or protected (for example with a password, so that testers do not mistake it for the real manager), how a version is deployed to each instance and promoted from test to `zangbundel.nl` (copy, `git pull`, a script), and who has access. |
| TQ-05 | 2026-11-05 | *Resolved 2026-11-06 by TD-14.* Are external libraries allowed in the web app (a ZIP library, an Ed25519 library, a UI framework), or is everything written for the project? If allowed: which, at which version, served from the project's own server rather than a CDN (TD-08), so that no third party sees who uses the manager. |
| TQ-06 | 2026-11-05 | *Resolved 2026-11-06 by TD-15.* Which browsers and versions are supported? TD-06 needs, in the browser: reading and writing ZIP (deflate), SHA-256, Ed25519 key generation, signing and verification, UTF-8 decoding that reports invalid bytes, and Unicode NFC. Check what the chosen browsers provide natively (Web Crypto, Compression Streams, `TextDecoder` with `fatal`, `String.prototype.normalize`) before deciding what TQ-05 must supply. |
| TQ-07 | 2026-11-06 | *Resolved 2026-11-06 by TD-11.* Is `zangbundel.nl` for the library manager only, or also a home for the Zangbundel app's public pages (privacy policy, join page, manual), which are now on `pe1mew.github.io`? Moving those touches the app's App Links and published URLs, so it is the app repository's decision; this document only needs to know which paths the manager may use. |
| TQ-08 | 2026-11-06 | *Resolved 2026-11-06 by TD-23: a second policy `zbm-worker`.* Which Trusted Types policy starts the workers? Under SR-20, `require-trusted-types-for 'script'` makes `new Worker(url)` a sink that needs a `TrustedScriptURL`, and `trusted-types zbm-download` allowed only the download policy. |

---

## 5. Change history

| Version | Date | Change |
|---|---|---|
| Draft 0.1 | 2026-11-05 | First draft: the web app chosen (TD-01), `webapp/` (TD-02), nginx or Apache with PHP (TD-03), mock before deployment (TD-04), HTTPS (TD-05); FDS constraints; open questions TQ-01 to TQ-05. |
| Draft 0.2 | 2026-11-05 | The owner's answer to TQ-01: processing in the browser (TD-06); PHP has no part in library handling (TD-07); no request carries library data, enforced by a Content Security Policy (TD-08). TQ-01 resolved, TQ-02 reworded, TQ-06 added. |
| Draft 0.3 | 2026-11-06 | The owner registered `zangbundel.nl` (TD-09); it is hosted on contabo6, which also runs a test instance (TD-10); what contabo6 runs today (section 2.1). TQ-02 and TQ-04 partly answered, TQ-07 added. |
| Draft 0.4 | 2026-11-06 | The owner's answers: `zangbundel.nl` for the manager only (TD-11), static files first (TD-12), `test.zangbundel.nl` behind a password with a deploy script (TD-13), browser APIs first and small pinned libraries where needed (TD-14), browsers up to about three years old (TD-15). TQ-02, TQ-04 to TQ-07 resolved; TQ-03 (mock location) still to confirm. |
| Draft 0.5 | 2026-11-06 | The mock confirmed in `webapp/mock/` and marked as version 0.1.0 (TD-16, resolves TQ-03); the ZIP and Ed25519 libraries chosen (TD-17); depends on FDS draft 0.6, with the 1.1 view, raw keys and the shared test libraries added to the FDS constraints. All open questions resolved. |
| Draft 0.6 | 2026-11-06 | TD-18: the security assessment's requirements are binding; TD-17 notes the audit status of the two libraries. |
| Draft 0.7 | 2026-11-06 | TD-17 amended: Web Crypto Ed25519 with non-extractable keys where available, `@noble/ed25519` elsewhere (securityAssessment SQ-05). |
| Draft 0.8 | 2026-11-06 | TD-19: the host nginx serves the site natively. |
| Draft 0.9 | 2026-11-06 | TD-20: a static placeholder on `zangbundel.nl` while the manager runs on the test instance; the implementation plan is `design/implementationPlan.md`. |
| Draft 0.10 | 2026-11-06 | TD-21: Node.js LTS as a development-only tool. |
| Draft 0.11 | 2026-11-06 | TD-22: the build bundles each entry point (main thread, two workers) into one file with SRI, from a subset of ES modules, because Integrity-Policy refuses imported modules without integrity. |
| Draft 0.12 | 2026-11-06 | After the review of the bundler: TD-22 states the subset as the code enforces it (also `as default`, `export function*`, regex after `)`, `'use strict'`, the `node --check` of each bundle) and the worker entry form `new URL(...)`; TQ-08 asks for the Trusted Types policy of the workers. |
| Draft 0.13 | 2026-11-06 | TD-23 (resolves TQ-08): workers start through a second Trusted Types policy `zbm-worker`, which accepts only the two worker bundles; SR-20's CSP lists `trusted-types zbm-download zbm-worker`. |
| Draft 0.14 | 2026-11-06 | TD-17 notes the vendoring result: provenance verified for `@noble/ed25519` 3.2.0, none published for `fflate` 0.8.3. |
| Draft 0.15 | 2026-11-11 | TD-23 amended (securityAssessment SF-25, the owner's choice): the CSP lists only `trusted-types zbm-worker`; `zbm-download` was never created. TD-24: Hugo v0.169.0 builds the wiki into `webapp/src/wiki/`, committed and checked by `wiki.py`. |
