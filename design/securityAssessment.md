# Security and Privacy Assessment — Bibliotheek-manager web app

| | |
|---|---|
| **Document** | Security and privacy assessment of the web app's design, with the requirements and implementation rules for the final implementation |
| **Status** | Draft 0.12 |
| **Date** | 2026-11-06 |
| **Depends on** | `design/FDS.md` draft 0.7, `design/webappGUI.md` draft 0.12, `design/webappTDS.md` draft 0.14 |
| **Scope** | The site `zangbundel.nl` and its test instance, the web app's code and libraries, the browser session, the host contabo6, the domain, the deployment, and the data the manager handles |

---

## 1. Introduction

### 1.1 Purpose

The bibliotheek-manager is a web app in which scout leaders create, check, edit and sign song libraries (FDS). Libraries and signing keys are processed in the user's browser and never reach the server (webappTDS TD-06 to TD-08). This document assesses the design for security and privacy risks, and specifies what the final implementation must do so that:

- the **site is authentic**: a user reaches the real manager, delivered unaltered;
- the **code and libraries the site sends to the browser have integrity**: nothing is changed on the way or on the server without it being noticed or refused;
- the site is **available** and recovers quickly;
- the **user's privacy** is respected, and the **data handled** (libraries, signing keys, the maintainer's contact) stays under the user's control;
- the site is **hardened against known classes of attack**.

It follows the method of the app's own assessment (`../Zangbundel/design/security-privacy-assessment.md`): what the design already does well, findings with a rating, then requirements. Requirements here are binding for the implementation (TD-18); a change to one is recorded in this document first.

### 1.2 Notation

- **SF-nn**: a finding. **SR-nn**: a requirement, with RFC 2119 key words. **SC-nn**: a check in the release gate (section 8). **SQ-nn**: an open question for the owner.
- Ratings: **High** (likely enough and harmful enough to block going live), **Medium** (to be fixed before going live unless accepted in writing), **Low** (fix when convenient, or accept).
- FDS, GUI and TDS IDs refer to `design/FDS.md`, `design/webappGUI.md` and `design/webappTDS.md`.

### 1.3 Method and sources

The assessment walks the data flows of section 2 with STRIDE (spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege) per asset and trust boundary, and adds privacy (data minimisation, purpose, retention). Facts were checked on 2026-11-06:

- the designs and the mock in this repository, and the test libraries (`test-libraries/`, 56 cases);
- the host's configuration in `../contabo-vps-6` (nginx vhosts, ufw rules, PHP notes, open items);
- the domain's live state: DNS over `dns.google`, registry data over SIDN's RDAP;
- public sources on the chosen libraries and browser features, listed in section 11.

---

## 2. System, assets and trust boundaries

### 2.1 Data flows

```
 ┌──────────── user's computer ─────────────────────────────────────────────┐
 │  Browser tab: https://zangbundel.nl                                       │
 │   ├─ page + scripts + styles + images  ◀── (1) HTTPS GET, static only ────┼──┐
 │   ├─ main thread: UI, rendering (no library parsing, no keys)             │  │
 │   ├─ worker "library": ZIP, manifest, ChordPro, validation (untrusted in) │  │
 │   └─ worker "crypto": Ed25519 keys, signing, hashing                      │  │
 │  Local files:  library .zbl  ──(2) file picker──▶ worker "library"        │  │
 │                key .zbkey    ──(3) file picker──▶ worker "crypto"         │  │
 │  Downloads:    ◀──(4) generated .zbl / .zbkey (Blob, never via server)    │  │
 │  localStorage: language, bar widths only (GD-34)                          │  │
 └───────────────────────────────────────────────────────────────────────────┘  │
                                                                                 │
 ┌──── contabo6 (shared VPS) ───────────────┐      ┌── DNS (Openprovider, DNSSEC) ┐
 │  nginx :443  zangbundel.nl, test.…       │◀─────┤  A/AAAA, CAA, MX, TXT         │
 │  webroot (read-only to nginx)            │      └───────────────────────────────┘
 │  other sites and services (section 4)    │      ┌── Let's Encrypt (ACME) ───────┐
 └───────────────▲──────────────────────────┘      └───────────────────────────────┘
                 │ (5) deploy over SSH, signed release
 ┌───────────────┴──────────────┐
 │  GitHub repository, tags     │◀── owner's account
 └──────────────────────────────┘
```

Flows (2) to (4) never cross the network: that is the core privacy property of the design (TD-06). Flow (1) is the only thing the site does, and it is the most valuable target: whoever controls what (1) delivers controls the code that sees every library and key.

### 2.2 Assets

| ID | Asset | Why it matters | Properties |
|---|---|---|---|
| AS-01 | The web app's code as the browser receives it (HTML, JS, CSS, libraries) | Runs with full access to the user's libraries and private key | Integrity, authenticity |
| AS-02 | The user's private signing key (`.zbkey`, FDS §5.3) | Whoever has it signs as the user; it cannot be revoked (FDS limitation 4) | Confidentiality, integrity |
| AS-03 | The user's library (songs, sets, maintainer contact) while it is open | The maintainer contact is personal data; the songs are the user's work | Confidentiality, integrity |
| AS-04 | The libraries the manager writes | Every Songbook app trusts their manifest and signature (FDS §4, §5) | Integrity, correctness |
| AS-05 | The site's identity: domain, DNS, certificates | Lets users tell the real manager from a copy | Authenticity |
| AS-06 | The site's availability | Users depend on it to maintain their libraries | Availability |
| AS-07 | Visitors' metadata (IP address, user agent, time) | Personal data under the GDPR (AVG) | Confidentiality, minimisation |
| AS-08 | The release pipeline: repository, tags, deploy credentials, server webroot | Controls AS-01 | Integrity, authenticity |
| AS-09 | The test instance and its access credentials | A weaker copy of AS-01 next to the real one | Integrity, confidentiality |

### 2.3 Attackers considered

| ID | Attacker | Capability |
|---|---|---|
| AT-1 | Anyone on the internet | Sends requests, crafts library files, hosts look-alike sites, sends mail and messages |
| AT-2 | Someone who hands a user a library | A crafted `.zbl` reaches the user's browser through the file picker (flow 2) |
| AT-3 | A network attacker | On the user's path (public Wi-Fi); can intercept anything not protected by TLS and HSTS |
| AT-4 | An attacker in another service on contabo6 | Gains code execution in a neighbouring site or container (section 4) |
| AT-5 | An attacker with the owner's GitHub, registrar or DNS credentials | Changes code, tags, DNS or the domain |
| AT-6 | Malicious or compromised third-party code | A tampered or vulnerable library version |
| AT-7 | A script or extension in the user's own browser | Out of the site's control; considered only for what the site can limit |

Out of scope: a fully compromised user device, physical access, and the Songbook app's import (assessed in the app repository).

---

## 3. What the design already does well

| Design choice | Effect |
|---|---|
| Libraries and keys are processed only in the browser; PHP plays no part; the server receives nothing (TD-06, TD-07) | No server-side data to steal, leak or retain. EDT-04 and EDT-65 (server deletion, in-memory keys on a server) are met by construction. |
| Every request stays on the site's own origin; no CDN, fonts, analytics or badges from elsewhere (TD-08, GD-15) | No third party learns who uses the manager; a CSP can forbid everything else. |
| Static files only in version 0.1 (TD-12) | The server's attack surface is nginx serving files; no application server, database or upload endpoint. |
| No accounts, no login, no cookies | Nothing to phish from the site itself, no session to hijack, no consent banner needed for the app. |
| Strict input rules in the FDS: limits checked before decompression (§3.5), path rules (PKG-03), whole-or-nothing import (APP-01) | The untrusted-input surface is specified, and 56 shared test libraries exercise it (O-04). |
| Signed libraries with raw Ed25519 keys and a manifest of SHA-256 hashes (FDS §4, §5, SG-05) | Tampering with a library after it leaves the manager is detectable. |
| Nothing kept between sessions except two preferences (EDT-02, EDT-64, GD-34) | A shared computer keeps no library or key after the page closes. |
| DNSSEC already active for `zangbundel.nl` (checked 2026-11-06: DS record at SIDN, validated `AD` answers) | Forged DNS answers are rejected by validating resolvers. |

---

## 4. The host as found (contabo6, 2026-11-06)

From `../contabo-vps-6`. These facts drive several findings.

| Item | Found | Relevance |
|---|---|---|
| Firewall | ufw armed 2026-07-31, default deny; SSH rate-limited | Good baseline. Docker-published ports bypass ufw (its readme). |
| Neighbours | ChirpStack, Node-RED (public dashboard by decision), MQTT, NTRIP caster, EchoLink proxy, Uptime Kuma, a PHP web app, and four legacy CMSimple sites on end-of-life PHP 7.4.33 and 5.6.40 (`php/readme.md`), each in its own Docker container behind the host nginx, which proxies to them and terminates HTTPS | The owner judges them isolated from the nginx that serves `zangbundel.nl` (SF-02 withdrawn). The requirements on the host (SR-70, SR-72 to SR-75) still apply. |
| nginx vhosts | No `add_header` security headers in any vhost; one vhost sets `ssl_protocols`; certificates by `certbot --nginx` | The defaults must not be copied for `zangbundel.nl` (SF-09). |
| Monitoring | Uptime Kuma runs on the same host | It cannot report the host being down (SF-12). |

---

## 5. Findings

| ID | Finding | Attacker | Rating | Requirements |
|---|---|---|---|---|
| SF-01 | **Code delivered by the site is the root of trust.** A web app is fetched anew on every visit. Whoever changes the files on the server, or in the release on the way there, gets code that reads every library and key the user opens. Neither TLS nor SRI helps against an attacker who controls the server, since they can change the page and its hashes together. | AT-4, AT-5, AT-6 | High | SR-10 to SR-16, SR-70, SR-72 to SR-75, SR-90 |
| SF-02 | *Withdrawn 2026-11-06 by the owner.* The finding was: the site runs on contabo6 next to end-of-life PHP sites. The owner's reason: those sites run in their own Docker containers, isolated from the nginx that will serve `zangbundel.nl`; that nginx only proxies to them and terminates HTTPS, and serves the manager's static files without PHP. | — | — | — |
| SF-03 | **Third-party libraries.** `fflate` up to 0.8.2 has CVE-2026-45820 (an infinite loop in `unzipSync` on a crafted ZIP64 archive, CVSS 7.5); 0.8.3 fixes it. `@noble/ed25519` v3 states that it "has not been independently audited"; its predecessor v1 was audited by Cure53 in February 2022. A tampered package version (supply-chain attack) would run with full access (SF-01). | AT-2, AT-6 | High | SR-12 to SR-17 |
| SF-04 | **DOM injection from library content.** Titles, set names, labels, ChordPro text, the maintainer, file names and error messages all come from untrusted files. The mock builds HTML with `innerHTML` and an escape function; one missed escape in the real app is a script running with the key in reach. | AT-2 | High | SR-24, SR-32, SR-33 |
| SF-05 | **Hostile library files.** A crafted `.zbl` can aim at memory or time exhaustion (ZIP bomb, ZIP64 tricks as in SF-03, millions of entries, deeply nested or huge ChordPro text, pathological regular expressions), or at the paths the code builds from entry names. The effect is a frozen tab or, combined with SF-04, worse. | AT-2 | Medium | SR-30, SR-31, SR-34, SR-35 |
| SF-06 | **Private key exposure in the browser.** The key file is not encrypted (FDS SG-10). In the page it could leak through an accidental store (local storage, an autosave), a log, a crash report, the main thread's reach of injected code, or a key file left in the Downloads folder of a shared computer. | AT-2, AT-7 | High | SR-40 to SR-47, SQ-04, SQ-08 |
| SF-07 | **Impersonation and phishing.** A look-alike site can offer to "check" a library or "restore" a key, collecting key files. Mail from `@zangbundel.nl` can be forged today: the domain has an MX record but no SPF or DMARC record. | AT-1 | Medium | SR-05, SR-06, SR-07, SR-08, SR-44 |
| SF-08 | **Domain, DNS and certificates.** The domain was registered on 2026-11-06 at Openprovider; its registry status is `active` with no transfer or update lock. There is no CAA record, so any public CA may issue a certificate for it. Nobody watches Certificate Transparency for unexpected certificates. | AT-5, AT-1 | Medium | SR-03 to SR-06 |
| SF-09 | **No browser security headers yet.** Without CSP, HSTS, framing, MIME-sniffing and isolation headers the browser enforces none of the design's promises (no third-party requests, no framing, no injected script). contabo6's existing vhosts set none. | AT-1, AT-2, AT-3 | High | SR-01, SR-02, SR-20 to SR-27 |
| SF-10 | **Framing and UI redress.** Another site could embed the manager in a frame and trick a user into clicking *Sleutelbestand downloaden* or *Downloaden*. | AT-1 | Medium | SR-21, SR-22 |
| SF-11 | **Visitor privacy.** nginx logs the IP address and user agent of every request by default, with no stated purpose or retention. Links to GitHub, Google Play and F-Droid can pass the page address as referrer. There is no privacy statement for the site yet. | AT-1 (and the operator's duty) | Medium | SR-50 to SR-55 |
| SF-12 | **Availability.** One VPS, no failover; a denial-of-service attack, a provider outage, an expired certificate or a host compromise takes the site down, and the monitoring on the same host would not report it. | AT-1, AT-4 | Medium | SR-60 to SR-63, SR-65 |
| SF-13 | **Test instance.** `test.zangbundel.nl` will run untested code next to the real site, behind a shared password. If indexed, mistaken for the real site, or used with real keys, it becomes a weaker path to the same users. | AT-1, AT-4 | Medium | SR-80 to SR-84 |
| SF-14 | **Repository and account takeover.** The release starts from GitHub. A stolen GitHub, registrar or SSH credential lets an attacker publish code or move the domain. | AT-5 | High | SR-90, SR-10, SR-11, SR-05 |
| SF-15 | **Stale or mixed files.** Caches can serve an old script with a new page; a service worker would keep serving compromised code after the server is fixed. | AT-1, AT-4 | Low | SR-61, SR-65 |
| SF-16 | **Generated downloads.** File names come from the library title and the author's name; a crafted title could produce a misleading or unsafe file name (`.exe`, path characters, right-to-left override). | AT-2 | Low | SR-36 |
| SF-17 | **Cross-origin side channels.** Without cross-origin isolation, another site in the same browser process could in theory read memory through Spectre-type side channels while a key is loaded. | AT-1 | Low | SR-23 |
| SF-18 | **Timing side channels in JavaScript cryptography.** `@noble/ed25519` targets "algorithmic constant time"; the JIT and garbage collector make true constant-time execution unattainable in JavaScript. Exploiting this needs local, repeated measurements of signing. | AT-7 | Low | SR-15, accepted (section 9) |
| SF-19 | **Incorrect output.** A library the manager writes with a wrong hash, view or signature is refused by every Songbook app, or worse, accepted with content the user did not intend. | — | Medium | SR-34, SR-37 |
| SF-20 | **No way to report a vulnerability or learn of an incident.** No `security.txt`, no stated contact, no incident procedure. | — | Low | SR-92, SR-93 |

---

## 6. Requirements

Every requirement applies to the production site and, unless stated, to the test instance. "MUST" requirements block going live (section 8).

### 6.1 Site authenticity and transport (SF-07, SF-08, SF-09)

| ID | Requirement |
|---|---|
| SR-01 | The site MUST be served only over HTTPS with TLS 1.3 and TLS 1.2 (no older protocols), with forward-secret cipher suites only. Port 80 MUST only answer ACME challenges and redirect everything else to `https://` with a 301. |
| SR-02 | Every HTTPS response MUST carry `Strict-Transport-Security: max-age=31536000; includeSubDomains`, rolled out as hstspreload.org advises (5 minutes, 1 week, 1 month, then 1 year). After three months at one year without problems, `preload` MUST be added and the domain submitted to the HSTS preload list (SQ-03, decided); from then on every subdomain MUST serve HTTPS. |
| SR-03 | The DNS MUST carry CAA records that allow only Let's Encrypt, bound to the owner's ACME account (`accounturi`), with an `iodef` contact: `0 issue "letsencrypt.org; accounturi=<account URL>"`, `0 issuewild ";"`, `0 iodef "mailto:<security contact>"`. |
| SR-04 | DNSSEC MUST stay enabled (it is today); a key roll-over at the DNS provider MUST be checked for a working chain afterwards. |
| SR-05 | The domain MUST have the registrar's transfer lock (`clientTransferProhibited`) and, where the registrar offers it, the update and delete locks; the registrar and DNS accounts MUST use two-factor authentication. *2026-11-06: two-factor authentication is enabled at the DNS provider (the owner). The registry still showed only `active`, without a lock, on 2026-11-06; check again with SC-12.* |
| SR-06 | Certificates issued for `zangbundel.nl` and its subdomains MUST be watched in Certificate Transparency logs (for example a crt.sh or provider alert), with an alert to the owner for any certificate the owner did not request. |
| SR-07 | `zangbundel.nl` sends and receives no mail (SQ-06, decided). It MUST publish a null MX (`0 .`), `v=spf1 -all`, `v=DMARC1; p=reject; adkim=s; aspf=s`, and an empty DKIM key, so mail claiming to be from the domain is rejected. A later mail use (for example a honeypot address) is a new decision; it needs a real MX instead of the null MX, while SPF `-all` and DMARC `reject` stay as long as the domain sends nothing. |
| SR-08 | The canonical address `https://zangbundel.nl` MUST be stated in the repository's README, in the app's About screen and manual, and on the site's own About dialog, so users have independent places to check it. The site MUST NOT ask users to send, upload or mail a key file anywhere, and its texts say so (SR-44). |

### 6.2 Code integrity and supply chain (SF-01, SF-03, SF-14)

| ID | Requirement |
|---|---|
| SR-10 | A release MUST be built only from a signed git tag on `main` in this repository, with a build that needs no network and gives byte-identical output on a second run (as the test libraries do). |
| SR-11 | Each release MUST have a manifest of the SHA-256 of every file it deploys, signed with the owner's release key (for example an SSH or minisign Ed25519 key kept off the server). The deploy MUST verify the signature and every hash before the release becomes live, and MUST switch releases atomically (a new directory and one symlink change). |
| SR-12 | Third-party code MUST be vendored: copied into the repository at an exact version, never fetched at build or run time. For each package the vendoring step MUST verify the tarball against the npm registry's `dist.integrity` (SHA-512) and the package's published provenance, record version, source URL and SHA-256 next to the file, and name its licence in `NOTICE`. |
| SR-13 | Every `<script>` and stylesheet MUST carry a Subresource Integrity attribute (`integrity="sha384-…"`), generated by the build from the vendored files. The page MUST send `Integrity-Policy: blocked-destinations=(script)`, so a script without a valid integrity attribute is refused in browsers that support it. SRI protects against a partly changed or stale file; it does not protect against a fully compromised server (SF-01), which SR-11 and SR-73 address. |
| SR-14 | `fflate` MUST be at least 0.8.3 (CVE-2026-45820). Before every release, each vendored package MUST be checked against the GitHub and GitLab advisory databases; a known vulnerability in a reachable function blocks the release. |
| SR-15 | Before the first use of a key in a session, the crypto worker MUST run a known-answer self-test of the implementation it will use: RFC 8032 section 7.1 test 1 (key derivation, signature, verification) and a SHA-256 test vector. Where both Web Crypto Ed25519 and `@noble/ed25519` are available, it MUST also check that they give the same public key and signature. If any test fails, signing and key loading MUST be refused with a message. |
| SR-16 | Signing MUST use the browser's Web Crypto Ed25519 where it is available, with the private key imported as **non-extractable** as soon as it has been offered for download (a new key) or after it has been read (a loaded key), so no script can read its bytes afterwards; and `@noble/ed25519` (TD-17) in browsers without it (SQ-05, decided). Ed25519 is deterministic (RFC 8032), so both give identical signatures, which SR-15 checks. The audit status of the `@noble/ed25519` version in use MUST be recorded in TDS TD-17. |
| SR-17 | No tool on the server installs or builds anything: the server receives only release files and their signed manifest. |

### 6.3 Browser hardening (SF-04, SF-09, SF-10, SF-17)

| ID | Requirement |
|---|---|
| SR-20 | Every HTML response MUST carry this Content Security Policy, with no `unsafe-inline`, no `unsafe-eval` and no external source: `default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' data: blob:; manifest-src 'self'; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests; require-trusted-types-for 'script'; trusted-types zbm-download zbm-worker`. A source added to it is a decision in this document. The placeholder of TD-20, which has no script, sends the same policy with `script-src 'none'; worker-src 'none'`. |
| SR-21 | Every response MUST carry `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` (for browsers without `frame-ancestors`), and `Cross-Origin-Resource-Policy: same-origin`. |
| SR-22 | Every response MUST carry a `Permissions-Policy` that disables what the manager never uses: `accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), xr-spatial-tracking=()`. |
| SR-23 | HTML responses MUST carry `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`, so the page runs cross-origin isolated (SF-17). Every resource is same-origin, so this costs nothing. |
| SR-24 | The page MUST NOT contain inline scripts, inline event handlers, `javascript:` URLs, or inline `style` attributes (the CSP forbids them). The mock does use `innerHTML` and `style` attributes; the implementation MUST NOT copy that (section 7.3). |
| SR-25 | nginx MUST answer only `GET` and `HEAD` (405 for anything else), set `server_tokens off`, list no directories, refuse dot-files and backup files (`~`, `.bak`, `.orig`, `.swp`), and send correct `Content-Type` headers with `charset=utf-8` for text. |
| SR-26 | The site MUST NOT set cookies, and MUST NOT use a service worker in version 0.x (SQ-07). |
| SR-27 | Headers MUST be identical for the production site and the test instance, apart from those in SR-80 and SR-81. |

### 6.4 Untrusted input (SF-04, SF-05, SF-16, SF-19)

| ID | Requirement |
|---|---|
| SR-30 | All reading of library files, key files and ChordPro text MUST run in a dedicated Web Worker (`library`) without DOM access. The main thread receives only structured data (plain objects, strings), never HTML. |
| SR-31 | The FDS limits (§3.5) MUST be checked from the ZIP's central directory before any entry is decompressed, and enforced again while decompressing: decompression MUST stop at the declared size and at the global limits, whatever the archive claims. The worker MUST be terminated, with message M-02, when reading one file takes longer than 20 s. |
| SR-32 | Text from a library or key file MUST reach the page only through `textContent`, attribute setters, or DOM construction; never through `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, or URL attributes built from it. Trusted Types (SR-20) MUST enforce this: there are two policies, `zbm-download`, which creates `blob:` URLs for downloads, and `zbm-worker`, which accepts only the URLs of the release's two worker bundles (webappTDS TD-23); neither accepts HTML. |
| SR-33 | Parsers of untrusted input MUST run in time linear in the input: no regular expression with nested quantifiers or backtracking on untrusted text, no recursion depth that depends on the input. |
| SR-34 | The implementation MUST give the findings of every shared test library (`test-libraries/<case>.expected.json`) exactly, in an automated test that runs before every release (SC-04). |
| SR-35 | The ZIP and ChordPro readers MUST be fuzzed before the first release and after each change to them, starting from the test libraries as corpus, with no crash, hang over the time limit, or unbounded memory growth (SC-11). |
| SR-36 | Names of generated files MUST be built from the title or author name with FDS PF-20 to PF-22 applied, Unicode controls and bidirectional overrides removed, and the extension fixed by the manager (`.zbl`, `.zbkey`). Downloads MUST use a `blob:` URL with the right MIME type (`application/vnd.zangbundel.library+zip`, `application/json`), revoked after use. |
| SR-37 | Every library the manager writes MUST be validated by the same validator before it is offered for download, and a library with an Error MUST NOT be offered (EDT-50). |

### 6.5 The signing key in the browser (SF-06)

| ID | Requirement |
|---|---|
| SR-40 | Private keys MUST live only in a dedicated Web Worker (`crypto`), as `Uint8Array`, never as a string except while the worker builds the bytes of a key file for an explicit download. The main thread MUST NOT receive the private key; it sends data to sign and receives signatures, the public key and the fingerprint. |
| SR-41 | The private key MUST be overwritten with zeros in the worker when the user replaces or forgets it (SR-46), when the library session ends, and on `pagehide`; the worker is then terminated. |
| SR-42 | Nothing about a key or a library MUST be written to local storage, session storage, IndexedDB, the Cache API, cookies, the URL or the history. An automated test MUST inspect all storage after making, loading and using a key (SC-06). Local storage MAY hold only the keys `zbm.lang` and `zbm.bars` (GD-34), enforced by an allow-list in the code. |
| SR-43 | The production build MUST NOT write library content, key material or file names to the console, and MUST NOT send error reports anywhere. |
| SR-44 | Key-related texts MUST say, besides M-64: keep the key file outside shared folders and off shared computers; the manager and its makers never ask for your key file; only `https://zangbundel.nl` is the manager. |
| SR-45 | Fields for the author's name have `autocomplete="off"`; a key file is read only through the file picker or drag-and-drop, never from a URL or the clipboard. |
| SR-46 | The identity group of the bottom bar MUST offer *Sleutel vergeten* (*forget key*), which removes the key from memory at once (SR-41). After 30 minutes without input while a key is loaded, a dialog MUST warn that the key will be forgotten in 60 seconds, with *Sleutel houden* and *Nu vergeten*; without an answer the key is forgotten. Neither ever touches the open library (SQ-08, decided; GUI GD-39, GD-40). |
| SR-47 | Key files stay unencrypted, as FDS SG-10 specifies (SQ-04, decided 2026-11-06: no passphrases; the project does not aim to be proof against a leaked key file). The risk is accepted in section 9. |

### 6.6 Privacy (SF-11)

| ID | Requirement |
|---|---|
| SR-50 | The site MUST NOT use analytics, tracking, fingerprinting, third-party requests, or cookies. `connect-src 'none'` in the CSP (SR-20) MUST stay, so the code cannot send data anywhere even by mistake. |
| SR-51 | nginx access logs MUST NOT store full IP addresses: the last octet of IPv4 and the last 80 bits of IPv6 are zeroed before writing, the user agent is not logged, and access and error logs are deleted after 14 days. The purpose (security and fault finding) is stated in the privacy statement. |
| SR-52 | The site MUST publish a privacy statement in Dutch, English and German (EDT-80), reachable from the *Over* dialog and the narrow-window page, stating: what the server logs and for how long; that libraries and keys never leave the browser; what local storage holds; which external pages the links lead to; the operator and a contact. |
| SR-53 | Links to other sites MUST use `rel="noopener noreferrer"` (SR-21 sets the referrer policy too). |
| SR-54 | The test instance follows SR-50 to SR-53; its basic-authentication user names are not personal. |
| SR-55 | The maintainer contact (personal data inside a library) is handled only in the browser and appears only where the FDS puts it; the Editor MUST NOT prefill it from anything the browser knows. |

### 6.7 Availability (SF-12, SF-15)

| ID | Requirement |
|---|---|
| SR-60 | nginx MUST limit requests per IP address (for example 20 requests/s with a burst of 40 for the whole site) and concurrent connections per IP, and MUST set short timeouts for request headers and bodies (no request has a body). |
| SR-61 | File names of scripts, styles and images MUST include a content hash and be served with `Cache-Control: public, max-age=31536000, immutable`; the HTML MUST be served with `Cache-Control: no-cache` so a new release reaches users on their next visit. |
| SR-62 | The site MUST be monitored from outside contabo6 (for example from the owner's other server or a free external monitor) for availability, for the certificate's expiry date (alert at 14 days), and for the headers of SR-20 to SR-23 (SC-01). |
| SR-63 | Restoring the site MUST need only this repository's signed tag, the nginx configuration in `contabo-vps-6`, and the release key; the procedure is written in a runbook and tried once before going live. |
| SR-64 | *Withdrawn 2026-11-06* (SQ-07): no offline package. |
| SR-65 | A service worker, if ever added, MUST be a TDS decision with this assessment updated, and MUST check the signed manifest before caching, with a server-side way to remove it. |

### 6.8 Hosting and server (SF-01)

| ID | Requirement |
|---|---|
| SR-70 | `zangbundel.nl` MUST be served **natively by the host nginx** (SQ-01, decided 2026-11-06) without any interpreter (no PHP, no CGI, no proxy to an application), from a release directory that the nginx user can only read and that only the activation step (SR-11) can write. TLS, the client's IP handling (SR-51) and the headers are configured once, in the site's vhost. |
| SR-71 | *Withdrawn 2026-11-06* with SF-02: the legacy sites stay on contabo6 in their containers (SQ-02). |
| SR-72 | The host MUST keep receiving security updates automatically (unattended upgrades for the OS, rebuilt containers for nginx), SSH MUST accept keys only, and root login over SSH MUST be off. |
| SR-73 | A check outside the web server's account MUST compare, at least hourly, the SHA-256 of every live file with the signed manifest of the live release, and alert the owner on any difference (SC-09). |
| SR-74 | The deploy account MUST be a separate user without a login shell, allowed only to upload a release into a staging directory (a forced command), with its own SSH key used for nothing else. Activating a release (SR-11) runs as a different, local step. |
| SR-75 | The nginx configuration of the site MUST be kept in `contabo-vps-6` and reviewed with this document's requirements as the checklist. |

### 6.9 Test instance (SF-13)

| ID | Requirement |
|---|---|
| SR-80 | `test.zangbundel.nl` MUST require HTTP basic authentication over HTTPS (TD-13), with bcrypt password hashes in a file outside any repository, one account per tester, removed when testing ends. |
| SR-81 | The test instance MUST send `X-Robots-Tag: noindex, nofollow` and show a fixed banner *TESTVERSIE — niet voor echte bibliotheken of sleutels* in every language. |
| SR-82 | Testers MUST use only the test key of RFC 8032 (`test-libraries/test-key-rfc8032.zbkey`) and test libraries; the banner and the tester instructions say so. |
| SR-83 | The test instance MUST have its own vhost and its own release directory, so a test release can never replace production files. |
| SR-84 | Promotion to production (TD-13) MUST deploy the same signed release that was tested, verified again by its manifest (SR-11). |

### 6.10 Process (SF-14, SF-20)

| ID | Requirement |
|---|---|
| SR-90 | The owner's GitHub, registrar, DNS and server accounts MUST use two-factor authentication, preferably a hardware key; release tags MUST be signed, and the deploy MUST refuse an unsigned tag; `main` MUST be protected against force pushes. |
| SR-91 | This assessment MUST be repeated before each release that adds a feature touching keys, files, the network or a dependency, and at least once a year. |
| SR-92 | The site MUST serve `/.well-known/security.txt` (RFC 9116) with a contact, the preferred languages (nl, en, de) and an expiry date at most one year ahead. |
| SR-93 | An incident runbook MUST describe how to take the site offline within minutes (a maintenance page served by nginx), how to verify and restore a release, and what to tell users. Users who used a key during a compromise window are advised to continue under a new key through *Opslaan als kopie* (FDS limitation 4, EDT-72). |

---

## 7. Implementation specification

The rules below make the requirements concrete. They are a starting point for the final implementation; a deviation is recorded here with its reason.

### 7.1 nginx (SR-01, SR-02, SR-20 to SR-25, SR-51, SR-60, SR-61, SR-80, SR-81)

```nginx
# /etc/nginx/sites-available/zangbundel.nl  (kept in contabo-vps-6, SR-75)
map $remote_addr $zbm_ip_anon {                      # SR-51: IPv4 /24, IPv6 /48
    ~^(?<p>\d+\.\d+\.\d+)\.\d+$        $p.0;
    ~^(?<p>[0-9a-f]*:[0-9a-f]*:[0-9a-f]*):  $p::;
    default                              0.0.0.0;
}
log_format zbm_anon '$zbm_ip_anon [$time_local] "$request" $status $body_bytes_sent';
limit_req_zone  $binary_remote_addr zone=zbm_req:10m rate=20r/s;  # SR-60
limit_conn_zone $binary_remote_addr zone=zbm_conn:10m;

server {
    listen 80; listen [::]:80;
    server_name zangbundel.nl;
    location /.well-known/acme-challenge/ { root /var/www/acme; }
    location / { return 301 https://zangbundel.nl$request_uri; }
}

server {
    listen 443 ssl; listen [::]:443 ssl;
    http2 on;
    server_name zangbundel.nl;
    root /srv/zangbundel/live;                         # symlink to a verified release, SR-11
    server_tokens off;
    autoindex off;
    access_log /var/log/nginx/zangbundel.access.log zbm_anon;   # rotated, 14 days, SR-51
    client_max_body_size 1k;  client_body_timeout 5s;  client_header_timeout 5s;
    limit_req zone=zbm_req burst=40 nodelay;  limit_conn zbm_conn 20;

    ssl_protocols TLSv1.2 TLSv1.3;                     # SR-01
    ssl_prefer_server_ciphers off;                     # TLS 1.2 suites: Mozilla "intermediate"
    ssl_session_tickets off;

    if ($request_method !~ ^(GET|HEAD)$) { return 405; }        # SR-25
    location ~ (^|/)\.(?!well-known/) { return 404; }
    location ~ (~|\.bak|\.orig|\.swp)$  { return 404; }

    # Headers for every response (SR-02, SR-21, SR-22). 'always' adds them to errors too.
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header X-Frame-Options "DENY" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;
    add_header Permissions-Policy "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), hid=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), xr-spatial-tracking=()" always;

    location = / { try_files /index.html =404; include snippets/zbm-html-headers.conf; }
    location ~ \.html$ { include snippets/zbm-html-headers.conf; }
    location /assets/ {                                # hashed names only, SR-61
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        # nginx does not inherit add_header into a block that has its own; repeat the common set:
        include snippets/zbm-common-headers.conf;
    }
}
```

`snippets/zbm-html-headers.conf` adds, besides the common set, `Cache-Control: no-cache`, the CSP of SR-20, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` and `Integrity-Policy: blocked-destinations=(script)`. The trap to avoid: in nginx, a `location` with any `add_header` drops all `add_header` lines of the server block, so every location includes the common set explicitly, and SC-01 checks every file type.

The test instance (`test.zangbundel.nl`) uses the same file with `root /srv/zangbundel-test/live`, `auth_basic` with its own `auth_basic_user_file` (SR-80), and `add_header X-Robots-Tag "noindex, nofollow" always;` (SR-81). Certificates come from `certbot certonly --webroot`, which does not edit nginx files (see below).

**As implemented (M0, `webapp/server/nginx/`).** The sketch above is implemented with these deviations, each tested on nginx 1.24.0 (Ubuntu 24.04) with SC-01:

- **No `http2` of our own.** On nginx 1.24 the `http2` parameter of `listen` applies to the whole 443 socket, so it is not ours to set. On contabo6 another vhost (`console.rfsee.net`) already sets it, so our hosts speak HTTP/2 there too. The container test checks the headers over HTTP/2.
- **One set of files for both hosts.** The common headers are a snippet that the server block and every location with its own headers include. The values that differ per host (the HTML CSP, `X-Robots-Tag`) come from maps keyed on `$server_name`, not on the client's `Host`.
- **Responses that are not HTML pages** carry `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox`, because an SVG opened on its own is a document that could run script.
- **nginx's own error pages** (401, 403, 404, 405, 429) are HTML too. They carry that same sandboxing CSP (SR-20) and, like every response, `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` (SR-23). The server block includes the file-header set for that reason.
- **The error log** cannot shorten addresses (SR-51 covers the access log). `log_not_found off` and rate-limit events at `warn` keep it to real faults. On the test instance, nginx also logs a failed basic-auth login there (unknown user or wrong password), at error level, with the user name entered. The privacy statement says so (7.5).
- **IPv6 addresses** arrive compressed. The map keeps at most the groups before a `::` within the first three, so nothing beyond the /48 is logged (SR-51).
- **Retention (SR-51).** Our logs live in `/var/log/nginx/zangbundel/`, outside Ubuntu's `/var/log/nginx/*.log` stanza. That stanza has `notifempty`, which never rotates a quiet log, so a quiet error log would keep full addresses indefinitely. Our own stanza (`webapp/server/logrotate/zangbundel`) rotates daily, also when empty, and keeps 13 old files plus `maxage 14`, so no entry is older than 14 days.
- **Byte ranges are off** (`max_ranges 0`). On a 416 answer nginx 1.24 sends every `always` header twice; a Range header is now ignored and the whole file sent.
- **TLS versions** are fixed by the default server of the 443 socket before SNI selects ours. The cipher list of `zbm-tls.conf` does apply. On contabo6 the default server (snakeoil certificate, `return 444`) sets no protocols. Ubuntu's OpenSSL 3 refused TLS 1.0 and 1.1 in the container test even where `nginx.conf` lists them. SC-02 checks what the real host offers.
- **Certificates** come from `certbot certonly --webroot`, so certbot never edits our files. A separate port-80 server answers ACME challenges and redirects everything else.
- **`release-manifest.json` and its signature** stay on disk for the integrity check, but nginx does not serve them.
- **SR-27 and the CSP.** While `zangbundel.nl` serves the placeholder and the test instance the manager, the two hosts differ in one header: the placeholder's script-free CSP (SR-20 allows that form) against SR-20's full policy. Every other header is the same. When the manager goes live, both carry SR-20's policy.
- **The placeholder** has a script-free CSP (`script-src 'none'; worker-src 'none'`). Its front door `/` redirects to `/nl/`, `/en/` or `/de/` by the first language in `Accept-Language`, else English.

### 7.2 DNS records (SR-03, SR-05, SR-07)

```
zangbundel.nl.        CAA  0 issue     "letsencrypt.org; accounturi=https://acme-v02.api.letsencrypt.org/acme/acct/<id>"
zangbundel.nl.        CAA  0 issuewild ";"
zangbundel.nl.        CAA  0 iodef     "mailto:<security contact>"
; the domain sends and receives no mail (SR-07, SQ-06 decided):
zangbundel.nl.        MX   0 .
zangbundel.nl.        TXT  "v=spf1 -all"
_dmarc.zangbundel.nl. TXT  "v=DMARC1; p=reject; adkim=s; aspf=s"
*._domainkey.zangbundel.nl. TXT "v=DKIM1; p="
```

The current MX record (`10 mail.zangbundel.nl`) is replaced by the null MX. The A record (now `127.0.0.1`) and an AAAA record point at contabo6 when the site goes live; `test.zangbundel.nl` gets its own records at the same time. At the registrar: transfer lock on (SR-05); two-factor authentication is already on at the DNS provider.

### 7.3 Application structure (SR-30, SR-32, SR-40 to SR-43)

```
index.html                      no inline script or style; <script type="module" src="/assets/main.<hash>.js" integrity="sha384-…">
assets/main.<hash>.js           main thread: UI only; renders with DOM APIs (createElement, textContent)
assets/library-worker.<hash>.js worker "library": fflate, manifest, ChordPro, FDS §6 validation
assets/crypto-worker.<hash>.js  worker "crypto": @noble/ed25519, SHA-256/512 via crypto.subtle, keys
assets/app.<hash>.css           all styles; no style attributes anywhere
```

**Bundles (webappTDS TD-22).** Each `.js` above is one bundle made by `webapp/tools/build.py` from a subset of ES modules. The vendored files of SR-12 (`webapp/vendor/`) are bundled into the worker that uses them, not served separately. The main bundle carries SRI, which `Integrity-Policy` enforces. The two workers cannot: browsers have no integrity attribute for `new Worker()`, and `blocked-destinations=(script)` does not cover the `worker` destination. Their hashed names, the signed release manifest (SR-11) and the hourly check (SR-73) protect them. SR-13's SRI is therefore computed over the bundles, which contain the vendored code, not over the vendored files themselves; SR-12's checks of the vendored files hold through git, the signed tag and the reproducible build. Workers start through the Trusted Types policy `zbm-worker`, which accepts only `/assets/library-worker.<hash>.js` and `/assets/crypto-worker.<hash>.js` (webappTDS TD-23).

- **Messages between threads** carry plain data only. The library worker returns, for example, `{ songs: [{ id, title, … }], findings: [{ code, severity, where, params }] }`; the main thread builds messages from the code and the translated text with `textContent`.
- **Rendering**: a small helper builds elements (`el('li', { class: 'song' }, [text(title)])`); there is no HTML string anywhere. The Trusted Types policy `zbm-download` only wraps `URL.createObjectURL` for download links; with `require-trusted-types-for 'script'` any accidental `innerHTML` throws.
- **Dynamic styles** (the side-bar widths of GD-10) are set through `element.style.setProperty`, which CSP allows, never through `style` attributes in markup.
- **The crypto worker** exposes `makeKey(name)`, `loadKey(bytes)`, `sign(manifestBytes)`, `publicKey()`, `fingerprint()`, `exportKeyFile()` (only after the M-64 acknowledgement in the UI) and `forget()`. Its self-test (SR-15) runs on start.
- **Storage**: one module wraps `localStorage` with an allow-list of `zbm.lang` and `zbm.bars`; no other code touches storage (SR-42).

### 7.4 Releases and deployment (SR-10 to SR-13, SR-17, SR-73, SR-74, SR-84)

1. On the owner's computer: `git tag -s vX.Y.Z`, then the build script (no network) writes `dist/` with hashed file names, SRI attributes and `release-manifest.json` (path, size, SHA-256 of every file).
2. The owner signs the manifest with the release key (`ssh-keygen -Y sign -n zangbundel-release`); the public key is in this repository (`webapp/tools/release-key.pub`) and on the server.
3. Upload to `test.zangbundel.nl`'s staging directory as the deploy user (forced command, SR-74).
4. On the server, an activation script (run by the owner, not by the deploy user) verifies the signature and every hash, copies the release to `/srv/zangbundel-test/releases/<name>-<version>/` read-only, and switches the `live` symlink.
5. After testing, the same signed release is activated for `zangbundel.nl` by the same script (SR-84).
6. A timer job checks the live files against the signed manifest hourly (SR-73) and reports to the owner.
7. Vendoring a package (SR-12): `npm pack <name>@<version>`, compare the tarball's SHA-512 with `npm view <name>@<version> dist.integrity`, check the provenance with `npm audit signatures` in a scratch project, copy the built file into `webapp/vendor/`, and record `name, version, source, sha256, licence` in `webapp/vendor/VENDOR.md`.

**As implemented (M1.2): vendoring.** `webapp/tools/vendor.py add <name> <version> --file <path>` does step 7.
- **It checks:** the tarball's SHA-512 against `dist.integrity`; the registry signatures and provenance (`npm audit signatures`, in a scratch project installed with `--ignore-scripts`); and `npm audit` (SR-14, GitHub's advisory database).
- **It records** every file in `webapp/vendor/VENDOR.md`, with the licence file next to it.
- **The build re-checks.** `vendor.py check`, and `build.py` whenever a bundle contains vendored code, compare every file with its recorded SHA-256.
- **Deviation from SR-12: fflate has no provenance.** `fflate` 0.8.3 is published without a provenance attestation, so for it SR-12's provenance check has nothing to verify; it is vendored with `--accept-missing-provenance`, as VENDOR.md says, and the owner accepted that risk on 2026-11-06 (section 9). `@noble/ed25519` 3.2.0 has a verified SLSA provenance.
- **SR-14's GitLab advisory database is a manual step.** `npm audit` covers only GitHub's database, so GitLab's has to be searched by hand before a release.

**As implemented (M0).** The runbook is `webapp/server/README.md`.

- **Build** (`webapp/tools/build.py`). A release build needs all of these (SR-10, SR-90), and records the tag in the manifest:
  - HEAD on `main`;
  - a tag on HEAD that `git verify-tag` accepts;
  - no uncommitted, untracked or ignored files in the source or in `webapp/tools/`.

  **Trial builds deviate from SR-10.** With `--allow-dirty`, `build.py` makes a trial build without those checks. `zbm-release` accepts one only on the test instance, and only with `--trial`, so testers can see work in progress. A trial build never reaches `zangbundel.nl`.

  The build also checks content:
  - HTML is checked with a parser: no inline script or style, no event handlers, no script URLs (SR-24, SR-32).
  - Markup the parser could read differently from a browser is refused outright: CDATA, abrupt or `--!>` comments, comments holding `<` or `>`, and end tags with extra characters.
  - So are `<base>`, `<meta http-equiv>`, frames, objects, `srcdoc` and external resources (SR-12), and SVG files with script or event handlers.
  - After rewriting, every local reference must resolve, and every stylesheet and script must carry the right SRI (SR-13).
  - JavaScript and web manifests are refused until M1.1 rewrites the references inside them.
- **Signing and packing** (`webapp/tools/sign-release.sh`).
- **Upload.** The release travels as one tar file piped over SSH to the deploy user. Its forced command `zbm-receive` refuses to run as root. It stores the upload, one at a time, within these limits: 50 MB per upload, 20 uploads waiting, and 200 MB in staging including this one. It stores only an uncompressed tar (`ustar` magic) that ends in its end-of-archive marker and lists without error.
- **The deploy user** keeps `/bin/bash` as its shell, because sshd runs a forced command through the user's shell. That is a deviation from SR-74's "without a login shell". What denies the user a shell is `command=` in `authorized_keys`: sshd runs `zbm-receive` whatever the client asks. `restrict` removes the terminal and forwarding, and the locked password rules out password logins.
- **Activation.** As root (whatever root's umask), `zbm-release activate` unpacks only listed regular files and checks the signature and every hash. It installs the release root-owned and read-only and switches `live` atomically.
- **Hourly check.** `zbm-release verify` (`zbm-verify.timer`) runs as its own user `zbm-verify`. It checks the signature, every hash and every file's owner and mode, and fails on a directory it cannot read. It pushes the result to Uptime Kuma.

### 7.5 Privacy statement (SR-52)

A page `privacy.html` in the three languages, with: who runs the site; that the manager processes libraries and keys only in the browser, and nothing is sent to the server; which server logs exist (shortened IP address, time, requested file, status) for security and fault finding, and that they are deleted after 14 days; that only a server fault, or on the test instance a failed login (unknown user or wrong password, with the user name entered), puts a full address in the separate error log, deleted on the same schedule; that local storage holds only the language and the bar widths; that there are no cookies, no analytics, no third parties; which external sites the links lead to; contact and the right to complain to the Autoriteit Persoonsgegevens.

---

## 8. Release gate

No release goes live, on the test instance or in production, unless these checks pass. Results go into `design/test-results/` (a new folder in this repository, one file per run, as in the app repository).

| ID | Check | Covers |
|---|---|---|
| SC-01 | A script fetches every file type of the live site (HTML, JS, CSS, images, 404, 405) and compares every header with SR-01, SR-02, SR-20 to SR-25 | SF-09, SF-10 |
| SC-02 | TLS scan of the host name (for example `testssl.sh`): TLS 1.2 and 1.3 only, no weak suites, valid chain, HSTS present | SF-09 |
| SC-03 | A browser run through every screen with the CSP and Integrity-Policy in force reports no violation | SF-04, SF-09 |
| SC-04 | All 56 shared test libraries give exactly their `expected.json` findings in the web app's own test runner | SF-05, SF-19 |
| SC-05 | The crypto self-test passes in every supported browser (TD-15) | SF-03, SF-18 |
| SC-06 | After making, loading, using and forgetting a key, local storage holds only `zbm.lang` and `zbm.bars`, and session storage, IndexedDB, Cache Storage and cookies are empty | SF-06 |
| SC-07 | A recorded browser session (HAR) of a full edit-sign-download cycle shows requests only to the site's own static files | SF-11 |
| SC-08 | The SRI attributes in the HTML match the deployed files | SF-01 |
| SC-09 | The signed manifest verifies on the server and every live file matches it | SF-01, SF-14 |
| SC-10 | No vendored package has a known advisory affecting a used function (SR-14) | SF-03 |
| SC-11 | The ZIP and ChordPro readers have been fuzzed since their last change, without crash, hang or unbounded memory (SR-35) | SF-05 |
| SC-12 | DNS: CAA, DNSSEC chain, SPF, DMARC and null MX (or mail authentication) as in section 7.2; registrar lock set | SF-07, SF-08 |
| SC-13 | `security.txt` present and not expired; privacy statement matches the actual logging | SF-11, SF-20 |

---

## 9. Accepted risks

| Risk | Why accepted | Mitigation that remains |
|---|---|---|
| A compromised user device or browser extension can read the page, the library and the key (AT-7) | Outside the site's control | Workers keep the key out of the main thread (SR-40); non-extractable Web Crypto keys where available (SR-16); SR-44 advises a trusted computer; *Sleutel vergeten* and the inactivity timeout (SR-46) |
| Every visit loads code from the server, so a server compromise reaches users until it is noticed (SF-01, trust on each visit) | Inherent to web apps; no offline package (SQ-07) | SR-11, SR-70, SR-73 shorten the window |
| JavaScript cryptography is not constant-time in practice (SF-18) | Exploitation needs local, repeated measurements, which equals AT-7 | SR-15 self-test; keys are used only briefly |
| Key files are not encrypted (FDS SG-10, D-07) | The owner's decision (SQ-04, 2026-11-06): passphrases would make an already demanding process harder, and the project does not aim to be proof against a leaked key file | SR-44 texts; a leaked key is handled as a lost one: continue under a new key through *Opslaan als kopie* (FDS limitation 4) |
| One server, no failover (SF-12) | Proportionate for a volunteer project | SR-62 monitoring, SR-63 restore |
| `@noble/ed25519` v3 is not independently audited (SF-03) | Its v1 was audited and v3 is cross-tested against the audited noble-curves; it is used only in browsers without Web Crypto Ed25519 (SR-16) | SR-15 known-answer test and cross-check |
| `fflate` 0.8.3 is published without a provenance attestation (SR-12) | The owner's decision (2026-11-06): it is the version that fixes CVE-2026-45820 (SR-14), chosen in webappTDS TD-17; no attested build of it exists | The tarball matches the registry's `dist.integrity` and its registry signature verifies; the file is vendored unchanged with its SHA-256 in `VENDOR.md`, checked by every build; a later release with provenance replaces it through `vendor.py add` |

---

## 10. Open questions and decisions

| ID | Question | State |
|---|---|---|
| SQ-01 | Native nginx or a container for `zangbundel.nl`? | Decided 2026-11-06: native (SR-70); arguments in 10.1 |
| SQ-02 | Retire or move the end-of-life PHP sites? | Decided 2026-11-06: not now, maybe later (SF-02, SR-71 withdrawn) |
| SQ-03 | Submit the domain to the HSTS preload list? | Decided 2026-11-06: yes, after three months at one year `max-age` without problems (SR-02) |
| SQ-04 | Encrypt key files with a passphrase? | Decided 2026-11-06: no; key files stay as FDS SG-10 says (SR-47, section 9) |
| SQ-05 | `@noble/ed25519` everywhere, or Web Crypto's Ed25519 where available? | Decided 2026-11-06: hybrid, Web Crypto with non-extractable keys where available, `@noble/ed25519` elsewhere (SR-15, SR-16, TD-17) |
| SQ-06 | Mail on the domain? | Decided 2026-11-06: no mail; null MX, SPF `-all`, DMARC `reject` (SR-07). A honeypot address later is a new decision. |
| SQ-07 | A signed offline package, and no service worker? | Decided 2026-11-06: no offline package (SR-64 withdrawn); no service worker in 0.x stays (SR-26) |
| SQ-08 | *Sleutel vergeten*, and forgetting the key after inactivity? | Decided 2026-11-06: both, 30 minutes with a 60-second warning (SR-46; GUI GD-39, GD-40) |

### 10.1 SQ-01: native nginx or a container — decided: native

The host nginx terminates HTTPS for every site on contabo6 and proxies to the containers of the other sites. For `zangbundel.nl` it can either serve the release directory itself (native) or proxy to a small nginx container that serves it.

| Aspect | Native | Container |
|---|---|---|
| Meets SR-70 | Yes: a release directory owned by the activation user, readable by nginx, no interpreter | Yes: read-only filesystem, non-root, read-only mount, `127.0.0.1` only |
| What an attacker gains by compromising the host nginx | Everything, as with every site | The same: the host nginx sees and can change all traffic it proxies |
| Parts to keep patched | The host nginx (already patched with the OS) | The host nginx **and** the nginx image, rebuilt with `--pull` (the drift `php/readme.md` describes for `webapp-fpm`) |
| Firewall | Nothing new | A published port; Docker bypasses ufw, so it must be bound to `127.0.0.1` |
| Headers, TLS, IP shortening (SR-20 to SR-23, SR-51) | In one place | Must still be set in the host nginx, which sees the client's IP; the container sees `127.0.0.1`. Setting headers in both risks duplicates or a stripped header |
| Logs | One access log | Two; only the host's has client IPs |
| Request path | One hop | Two hops (negligible for static files) |
| Moving to another host | Copy the vhost and the release directory | Run the image elsewhere |
| Production and test identical | Two vhosts, two directories | Two instances of one image |
| Consistency with the other sites | A different pattern | **The same pattern as the legacy sites** (the owner's argument) |

For security the two are equal: neither changes what the host nginx can do, and the attack surface of a static nginx inside a container is no smaller than serving the same files natively. Native has fewer parts to patch and configure. The container's advantages are operational: one way of running every site on the host, an image that moves to another host as it is, and identical test and production instances. **Recommendation, adopted 2026-11-06:** native, because it meets the requirements with less to maintain; a container is equally acceptable when consistency with the other sites weighs more, provided the conditions in SR-70 hold and the headers and IP shortening live only in the host nginx.

### 10.2 SQ-03: the HSTS preload list — decided: yes, after three months

Without preloading, a browser learns the HSTS header (SR-02) on its first HTTPS visit. The first visit itself, for example a user typing `zangbundel.nl` on a public Wi-Fi, can still be intercepted and downgraded (AT-3). The preload list is built into Chrome, Firefox, Safari and Edge, so even the first visit goes to HTTPS.

- **Conditions** (hstspreload.org): a valid certificate, a redirect from HTTP to HTTPS on the same host, HTTPS for every subdomain, and the header with `max-age` of at least one year, `includeSubDomains` and `preload`.
- **Costs:** every current and future subdomain must serve HTTPS. A web page on the domain without HTTPS becomes unreachable. Mail is not affected, so the later honeypot of SQ-06 is fine. Removal from the list takes months to reach all browsers.
- **Benefit for this site:** most visits come from a link or bookmark that already says `https://`, and the `.nl` domain is not preloaded as a whole. The gain is real but modest.

**Recommendation:** yes, after three months at one year `max-age` without problems, and once no plain-HTTP subdomain is planned.

### 10.3 SQ-04: a passphrase on key files — decided: no

Today a key file is unencrypted (FDS SG-10, D-07). Whoever gets the file can sign as the author, and the key cannot be revoked (FDS limitation 4). Key files end up in places users do not think of: the Downloads folder, a folder synchronised to a cloud (OneDrive and iCloud often sync Downloads and Documents), a chat message to a co-leader, a USB stick.

With a passphrase:

- **Format:** a key file version 2 adds `kdf` (PBKDF2-SHA-256, iterations, salt) and `cipher` (AES-256-GCM, nonce) and stores the encrypted seed instead of `privateKey`. Both come from Web Crypto in every browser of TD-15, so no new library is needed. OWASP's current guidance for PBKDF2-SHA-256 is 600,000 iterations, about half a second in a browser. scrypt or Argon2id would resist guessing better, but need a library.
- **Behaviour:** making a key asks for a passphrase twice, with a strength hint. Loading a key asks for it once. A wrong passphrase gives "wrong passphrase or damaged file". The manager never stores the passphrase.
- **Costs:**
  - An FDS change: §5.3, SG-10, SG-11, a new message, and the test libraries get a v2 key.
  - One more thing to remember: a forgotten passphrase loses the key, as a lost file does, and Save as copy is again the way out.
  - A weak passphrase only slows a determined attacker down.
- **Benefit:** a leaked file alone no longer signs. That protects against exactly the leaks above.

**Recommendation (not adopted):** yes, as key format version 2. **Decision 2026-11-06, the owner:** no passphrases. Handling a key file is already demanding for the users; the project does not aim to be proof against a leaked key file, and accepts the risk (section 9).

### 10.4 SQ-05: which Ed25519 implementation — decided: hybrid

Ed25519 signatures are deterministic (RFC 8032): the same key and message always give the same signature, in any correct implementation. So "identical behaviour in all browsers" (the reason for SR-16) does not require one implementation. Web Crypto offers something `@noble/ed25519` cannot: a **non-extractable** key. A key imported with `extractable: false` can sign, but its bytes cannot be read back by any script, including injected script (SF-04) or an extension using the page's API. Web Crypto's Ed25519 is the browser's own native code, maintained and reviewed with the browser. TD-15's oldest browsers lack it: Chrome before 137 (May 2025), Firefox before about 129 (August 2024), Safari before 17.

**Recommendation, changed from draft 0.1:** a hybrid.

- Where the browser has Web Crypto Ed25519, the crypto worker uses it, and imports a loaded or new key as non-extractable right after the key file has been offered for download.
- Elsewhere it uses `@noble/ed25519`.
- The self-test (SR-15) checks the active implementation against the RFC 8032 vector, and, where both exist, checks that they agree.

Adopted 2026-11-06 in SR-15, SR-16 and TD-17.

### 10.5 SQ-07: an offline package, and no service worker — decided: neither

**Offline package (SR-64, withdrawn).** A ZIP of a release with its signed manifest, attached to the GitHub release.

- **Use:**
  - The manager stays available when the site is down.
  - A cautious user can load verified code once, instead of trusting the server on every visit (SF-01).
- **Limit found during this assessment:** browsers do not run module scripts and Web Workers from `file://` pages. The package therefore does not work by double-clicking `index.html`; it needs a local web server (for example `python -m http.server`). That makes it a tool for technically skilled users and an archive, not something to offer average users.
- **Verifying it** needs the release key's public part (SR-11) and a command.

**No service worker.** A service worker could make the site work offline after the first visit. It would also keep serving whatever code it cached, including compromised code, until it updates itself. It adds a component that must check the signed manifest (SR-65).

**Recommendation:**
- Yes to the offline package as an archive for advanced users, described in the manual as such.
- Keep "no service worker" in 0.x.
- Reconsider offline use when the app gets an installable web-app form.

### 10.6 SQ-08: forgetting the key — decided: both

- **On request.** *Sleutel vergeten* (*forget key*) in the identity group removes the key from the crypto worker at once (SR-41, SR-46). The library and its changes stay; the next download needs the key loaded again. The cost is one button; the benefit is that a user leaving a shared computer can make sure the key is gone without closing the page.
- **After inactivity.** After 30 minutes without input, a dialog says the key will be forgotten in 60 seconds, with *Sleutel houden* (*keep key*) and *Nu vergeten* (*forget now*). Without an answer it is forgotten. This protects the case nobody plans for: a page left open on a club computer. It never loses library work. Its cost is reloading the key now and then.

**Recommendation:** both, with 30 minutes, recorded as GUI decisions and in the mock.

---

## 11. Sources

Checked on 2026-11-06.

- noble-ed25519, README (audit status, constant-time statement, release provenance): <https://github.com/paulmillr/noble-ed25519>
- Cure53, pentest report of noble-ed25519 v1 (February 2022): <https://cure53.de/pentest-report_ed25519.pdf>
- fflate CVE-2026-45820 (infinite loop in `unzipSync`, fixed in 0.8.3): <https://advisories.gitlab.com/npm/fflate/CVE-2026-45820/>, <https://access.redhat.com/security/cve/cve-2026-45820>; fflate changelog: <https://github.com/101arrowz/fflate/blob/master/CHANGELOG.md>
- Web Crypto Ed25519 support across browsers: <https://blog.ipfs.tech/2025-08-ed25519/>, <https://github.com/web-platform-dx/web-features/pull/1577/files>
- Trusted Types in all major engines (Firefox 148, Safari 26): <https://dev.to/grimicorn/trusted-types-is-baseline-dom-xss-is-now-a-type-error-1k1h>, <https://web-platform-dx.github.io/web-features-explorer/newly-available>
- Subresource Integrity: <https://www.w3.org/TR/sri/>, <https://developer.mozilla.org/docs/web/Security/Subresource_Integrity>; Integrity-Policy header: <https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Integrity-Policy>
- Cross-origin isolation (COOP, COEP): <https://web.dev/articles/why-coop-coep>
- HSTS preload rules: <https://hstspreload.org/>
- Let's Encrypt ending OCSP (CRLs instead; OCSP stapling no longer applies): <https://www.abetterinternet.org/post/ending-ocsp>
- F-Droid badge licence: <https://f-droid.org/docs/Badges/>
- Domain state: `dns.google` DNS-over-HTTPS answers and SIDN RDAP (`rdap.sidn.nl/domain/zangbundel.nl`), 2026-11-06.

The GDPR points (IP addresses as personal data, purpose and retention of server logs) follow general GDPR practice; the Autoriteit Persoonsgegevens' own guidance was not found in this research and should be checked before the privacy statement is published.

---

## 12. Change history

| Version | Date | Change |
|---|---|---|
| Draft 0.1 | 2026-11-06 | First assessment of the web app design: assets, attackers, findings SF-01 to SF-20, requirements SR-01 to SR-93, implementation specification, release gate SC-01 to SC-13, accepted risks, open questions SQ-01 to SQ-08. |
| Draft 0.2 | 2026-11-06 | The owner's answers: SF-02 and SR-71 withdrawn (the legacy sites run in containers behind the host nginx); two-factor authentication on at the DNS provider (SR-05); no mail on the domain (SQ-06 decided, SR-07, section 7.2); legacy sites stay (SQ-02 decided). SR-70 allows native or container; section 10 gives the arguments for SQ-01 and works out SQ-03, SQ-04, SQ-05 (recommendation changed to a hybrid with non-extractable Web Crypto keys), SQ-07 (the offline package needs a local web server) and SQ-08. |
| Draft 0.3 | 2026-11-06 | The owner's decisions: HSTS preload after three months (SQ-03, SR-02); no passphrases on key files (SQ-04, SR-47, accepted in section 9); hybrid Ed25519 with non-extractable Web Crypto keys (SQ-05, SR-15, SR-16); no offline package (SQ-07, SR-64 withdrawn); forget key on request and after 30 minutes of inactivity (SQ-08, SR-46). SQ-01 stays open. |
| Draft 0.4 | 2026-11-06 | SQ-01 decided: the host nginx serves `zangbundel.nl` natively (SR-70, SR-83). All open questions are decided. |
| Draft 0.5 | 2026-11-06 | M0 implemented: sections 7.1 and 7.4 record the implementation in `webapp/server/` and `webapp/tools/` and its deviations from the sketch (no `http2`, per-host maps, CSP and sandbox on non-HTML responses, error-log handling, `certonly --webroot`); the release public key is at `webapp/tools/release-key.pub`; 7.5 names the error log. |
| Draft 0.6 | 2026-11-06 | Review of the M0 implementation (7.1, 7.4, 7.5). nginx's own error pages carry a CSP, COOP and COEP. IPv6 is shortened correctly for compressed addresses. TLS and HTTP/2 are described as on contabo6. Log retention is stated as at most 15 days, and failed test logins are named. The build enforces a signed tag (SR-10, SR-90) and checks HTML with a parser. The hourly check runs as its own user and checks owner, mode and unreadable directories. `zbm-receive` takes one upload at a time. SR-74's shell deviation is recorded. |
| Draft 0.7 | 2026-11-06 | Second review round of M0 (7.1, 7.4, 7.5). Logs move to their own folder and logrotate stanza, because Ubuntu's `notifempty` kept quiet logs indefinitely; retention is again 14 days. Byte ranges are off, because a 416 doubled the headers. The build is tied to `main` and to a clean `webapp/tools/`. It refuses parser-divergent markup, frames, `<base>`, `<meta http-equiv>`, external resources, SVG script, and (until M1.1) JavaScript and web manifests. The trial-build deviation from SR-10 is recorded. `zbm-receive` refuses root, compressed uploads and tars without an end marker, and counts the upload itself in the 200 MB. Activation no longer depends on root's umask. SR-74's protection is described precisely. |
| Draft 0.8 | 2026-11-06 | Section 7.3: the app ships as three bundles (webappTDS TD-22); the vendored libraries are inside the worker bundles; workers are protected by hashed names, SR-11 and SR-73, since browsers have no SRI for workers. |
| Draft 0.9 | 2026-11-06 | After the review of M1 part 1: 7.3 names the main bundle `main.<hash>.js`, says SRI covers bundles and how SR-12 still holds, and points at webappTDS TQ-08 (the workers' Trusted Types policy). 7.1 records the one header that differs between the hosts until go-live (SR-27). The app's test banner is the fixed Dutch text of SR-81 in every language. |
| Draft 0.10 | 2026-11-06 | The owner's decision on webappTDS TQ-08 (TD-23): SR-20's CSP lists a second Trusted Types policy, `zbm-worker`, for starting the two workers; SR-32 and 7.3 say what each policy accepts. |
| Draft 0.11 | 2026-11-06 | 7.4 records the vendoring of M1.2 (`vendor.py`): SR-12 checks as run, fflate 0.8.3 without published provenance (accepted, recorded), SR-14's GitLab check by hand. |
| Draft 0.12 | 2026-11-06 | The owner keeps `fflate` 0.8.3 although it publishes no provenance: an accepted risk in section 9, noted in 7.4. |
