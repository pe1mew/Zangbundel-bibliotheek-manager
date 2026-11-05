# Technical Design Specification — Bibliotheek-manager web app

| | |
|---|---|
| **Document** | Technical Design Specification (TDS) of the web app |
| **Status** | Draft 0.2 |
| **Date** | 2026-11-05 |
| **Depends on** | `design/FDS.md` draft 0.4 |
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

---

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
| EDT-80 to EDT-83 | The interface is in Dutch, English and German. |

---

## 4. Open questions

| ID | Date | Question |
|---|---|---|
| TQ-01 | 2026-11-05 | *Resolved 2026-11-05 by TD-06: in the browser.* Where is a library processed: in the browser or on the server? |
| TQ-02 | 2026-11-05 | Which PHP version is the minimum? With TD-06 and TD-07, PHP needs no extensions for libraries; the question is what the test server offers and what serving the pages needs. Is PHP needed at all for the first version, or can the server deliver static files only? |
| TQ-03 | 2026-11-05 | Where does the mock live and how is it served for review: a folder of static HTML, CSS and JavaScript under `webapp/` (for example `webapp/mock/`), or under `design/`? Does it need PHP to run? |
| TQ-04 | 2026-11-05 | Which test server, at which address, and how is the web app deployed there (copy, `git pull`, a script)? Who has access? |
| TQ-05 | 2026-11-05 | Are external libraries allowed in the web app (a ZIP library, an Ed25519 library, a UI framework), or is everything written for the project? If allowed: which, at which version, served from the project's own server rather than a CDN (TD-08), so that no third party sees who uses the manager. |
| TQ-06 | 2026-11-05 | Which browsers and versions are supported? TD-06 needs, in the browser: reading and writing ZIP (deflate), SHA-256, Ed25519 key generation, signing and verification, UTF-8 decoding that reports invalid bytes, and Unicode NFC. Check what the chosen browsers provide natively (Web Crypto, Compression Streams, `TextDecoder` with `fatal`, `String.prototype.normalize`) before deciding what TQ-05 must supply. |

---

## 5. Change history

| Version | Date | Change |
|---|---|---|
| Draft 0.1 | 2026-11-05 | First draft: the web app chosen (TD-01), `webapp/` (TD-02), nginx or Apache with PHP (TD-03), mock before deployment (TD-04), HTTPS (TD-05); FDS constraints; open questions TQ-01 to TQ-05. |
| Draft 0.2 | 2026-11-05 | The owner's answer to TQ-01: processing in the browser (TD-06); PHP has no part in library handling (TD-07); no request carries library data, enforced by a Content Security Policy (TD-08). TQ-01 resolved, TQ-02 reworded, TQ-06 added. |
