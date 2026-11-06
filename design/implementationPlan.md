# Implementation Plan — Bibliotheek-manager web app

| | |
|---|---|
| **Document** | Plan for implementing the bibliotheek-manager web app on the test instance, with a placeholder on the production domain |
| **Status** | Draft 0.2 |
| **Date** | 2026-11-06 |
| **Depends on** | `design/FDS.md` draft 0.7, `design/webappGUI.md` draft 0.12, `design/webappTDS.md` draft 0.8, `design/securityAssessment.md` draft 0.4, `test-libraries/` (56 cases) |

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
| Privacy | Link to `/privacy/` |
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
│   │   ├── i18n/             nl.js, en.js, de.js (texts of GUI and FDS §9)
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
│   └── styles/               app.css; no inline styles
├── vendor/                   fflate 0.8.3, @noble/ed25519 3.2.0, VENDOR.md with hashes (SR-12)
├── tests/                    unit tests of core/, conformance runner over test-libraries/, fuzz harness
├── tools/
│   ├── build.py              offline, reproducible: hashed names, SRI, release-manifest.json (SR-10, SR-13)
│   ├── vendor.py             verifies a package against npm's dist.integrity, writes VENDOR.md (SR-12)
│   ├── sign-release.sh       signs the manifest with the release key (SR-11)
│   ├── check-headers.py      SC-01 against a live host
│   └── release-key.pub       public release key
├── placeholder/              the placeholder site (section 2.1)
└── server/                   copies of the nginx vhosts and the activation script; the live
                              copies are kept in ../contabo-vps-6 (SR-75)
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
| M0.1 | DNS: A and AAAA for `zangbundel.nl` and `test.zangbundel.nl` to contabo6; CAA (Let's Encrypt, `accounturi`, `iodef`); null MX replacing the current MX; SPF `-all`; DMARC `reject`; empty DKIM | SR-03, SR-07, §7.2 |
| M0.2 | Registrar: transfer lock; confirm two-factor authentication on registrar and DNS accounts | SR-05 |
| M0.3 | Certificates for both hosts with certbot; check certbot left the headers intact | SR-01 |
| M0.4 | nginx vhosts for both hosts as securityAssessment §7.1: headers, HSTS (start at 5 minutes, ramp up), method and dot-file rules, rate limits, shortened IP logs with 14-day rotation | SR-01, SR-02, SR-20 to SR-25, SR-51, SR-60, SR-61 |
| M0.5 | Basic authentication for `test.zangbundel.nl`, `X-Robots-Tag: noindex`, a holding page until M1 | SR-80, SR-81 |
| M0.6 | Release directories, the deploy user with a forced command, the activation script, the hourly file-integrity check | SR-11, SR-73, SR-74 |
| M0.7 | Release key pair (public part in `webapp/tools/release-key.pub`) | SR-11 |
| M0.8 | Placeholder pages in three languages, privacy statement, `security.txt`; deploy through the release procedure | §2.1, SR-52, SR-92 |
| M0.9 | External monitoring of both hosts (availability, certificate expiry, headers); Certificate Transparency alert | SR-06, SR-62 |

**Exit:** SC-01, SC-02, SC-09, SC-12 and SC-13 pass for both hosts; the placeholder is live on `zangbundel.nl`.

### M1 — Toolchain and release pipeline (M)

| # | Work | Requirements |
|---|---|---|
| M1.1 | Repository layout of 3.1; `build.py` writing hashed names, SRI attributes and `release-manifest.json`; reproducibility check (two builds, identical bytes) | SR-10, SR-13, SR-61 |
| M1.2 | Vendor `fflate` 0.8.3 and `@noble/ed25519` 3.2.0 with `vendor.py`: integrity, provenance, `VENDOR.md`, `NOTICE` | SR-12, SR-14 |
| M1.3 | Test runner: `node --test` for `core/`; the conformance runner reading `test-libraries/*.expected.json` | SR-34 |
| M1.4 | A minimal app (the splash only) built, signed, deployed to the test instance and activated | SR-11, SR-84 |
| M1.5 | `check-headers.py` (SC-01) run against both hosts | SC-01 |

**Exit:** a signed build reaches `test.zangbundel.nl` end to end; SC-08 and SC-09 pass.

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
| M2.8 | `library-worker.js` with a 20-second time limit per file | SR-30, SR-31 |
| M2.9 | Fuzzing of the ZIP and ChordPro readers, corpus from `test-libraries/` | SR-35 |

**Exit:** all 56 test libraries give exactly their expected findings (SC-04); a valid library opened and saved without changes is byte-identical (EDT-51); fuzzing ran without crash or hang (SC-11).

### M3 — Keys and signing (M)

| # | Work | Requirements |
|---|---|---|
| M3.1 | `crypto-worker.js`: make, load, export, sign, public key, fingerprint, forget | FDS §5, SR-40, SR-41 |
| M3.2 | Hybrid Ed25519: Web Crypto with non-extractable keys where available, `@noble/ed25519` elsewhere | SR-16, TD-17 |
| M3.3 | Known-answer self-test (RFC 8032 test 1, SHA-256) and cross-check | SR-15 |
| M3.4 | Key file reading and writing (FDS §5.3, SG-05, SG-11), including the RFC 8032 test key and `key-wrapped` refusal | SG-05, SG-10 to SG-12 |

**Exit:** SC-05 in every browser of TD-15; signing the reference library reproduces `valid-signed.zbl`'s signature; SC-06 for the key flows.

### M4 — Application shell (L)

| # | Work | Requirements |
|---|---|---|
| M4.1 | `dom.js` element builder; Trusted Types policy `zbm-download`; no `innerHTML` anywhere (a lint check in the build fails on it) | SR-24, SR-32 |
| M4.2 | i18n in nl, en, de; language from the browser and the bottom bar; remembered | GD-17, GD-34, EDT-80 to EDT-83 |
| M4.3 | Layout: four areas, resizable and foldable bars, splash with photograph (3 s), narrow-window page, colours, buttons, icons | GD-01, GD-03, GD-04, GD-10, GD-12, GD-27, GD-30 to GD-32 |
| M4.4 | Bottom bar with all groups; *Android-app* panel with *binnenkort* badges; *Over* with the privacy link | GD-14, GD-15, GD-35, SR-52 |
| M4.5 | Validation panel *Controle* with counts and *Ga naar* | GD-20, GD-29, EDT-40 to EDT-42 |

**Exit:** SC-03 (no CSP or Trusted Types violation) through every screen; the shell matches the mock's look in the three languages.

### M5 — Editing (L)

| # | Work | Requirements |
|---|---|---|
| M5.1 | Song list with search, sort, filters, bin, *Bewerken* | GD-13, GD-16, GD-25 |
| M5.2 | Song view: labels, repeats, chords, remarks | GD-19 |
| M5.3 | Song editor: *Blokken* and *Code (ChordPro)*, drag with scrolling, up/down, labels, locked blocks, apply always, the leave-editor question | GD-05 to GD-09, GD-11, GD-18, GD-19, GD-33, GD-36, GD-38 |
| M5.4 | Library fields in the left bar, licence and required maintainer | GD-22, GD-37, EDT-13, EDT-14, MAN-07, MAN-08 |
| M5.5 | Sets tab: add, rename, reorder, delete, entries | GD-21, EDT-31, SET-01 to SET-05 |

**Exit:** each GD of M5 demonstrated on the test instance against its text; unit tests for every state change of the library model.

### M6 — Open, save and sign (M)

| # | Work | Requirements |
|---|---|---|
| M6.1 | *Openen* (this format, plain ZIPs, release archives), *Nieuw*, *Sluiten* with the M-60 question | EDT-01 to EDT-03, EDT-10 to EDT-26, GD-23, GD-28 |
| M6.2 | *Downloaden*: version rule, change note, view, manifest, validation before download, file name, MIME type, blob URL | EDT-50 to EDT-59, SR-36, SR-37 |
| M6.3 | Signing in the download dialog; read-only signed libraries; *Opslaan als kopie* | GD-24, EDT-23, EDT-24, EDT-60 to EDT-73 |
| M6.4 | Key group: make, load, download, forget; inactivity warning | GD-14, GD-39, GD-40, SR-44 to SR-46 |

**Exit:** libraries made and signed by the manager pass the independent checker `test-libraries/check_test_libraries.py` (written as new cases), and import in the Songbook app on a test phone; SC-06 and SC-07 for a full edit, sign and download cycle.

### M7 — Hardening and test release (M)

| # | Work | Requirements |
|---|---|---|
| M7.1 | The full release gate SC-01 to SC-13 on the test instance | TD-18 |
| M7.2 | Browser matrix of TD-15 (Chrome, Edge, Firefox, Safari, about three years back) | TD-15 |
| M7.3 | Accessibility pass: keyboard paths, focus, contrast, labels | GD-10, GD-33 |
| M7.4 | Security assessment repeated for the implementation | SR-91 |
| M7.5 | Testers: the requester (Pepe) and two or three scout leaders, one basic-auth account each (SR-80); the RFC 8032 test key and test libraries (SR-82); a short tester guide; findings as GitHub issues in this repository (IQ-05) | SR-80, SR-82 |
| M7.6 | First draft of the manager's manual on the repository's wiki | GD-35 |

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
| Conformance | All 56 test libraries against `expected.json` | `node --test` with the conformance runner | SC-04, every change to `core/` |
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
