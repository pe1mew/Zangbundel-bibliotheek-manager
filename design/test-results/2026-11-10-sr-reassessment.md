# Security re-assessment of the implementation (2026-11-10)

| | |
|---|---|
| **Scope** | Every requirement SR-01 to SR-93 of `design/securityAssessment.md` (draft 0.16), against the code in `webapp/` at commit `9fe69ee` (tag `v0.2.1`) and the server as running on contabo6 |
| **Why** | SR-91, implementationPlan M7.4 (completion plan C6) |
| **Run by** | The agent. Server facts were read over SSH as the owner's user, without sudo. GitHub facts come from the API with the owner's `gh` login. |
| **Live** | `zangbundel.nl`: `manager-0.2.1`. `test.zangbundel.nl`: `manager-0.2.0-dev.7`. |

## Checks run for this assessment

- **Unit and conformance tests:** `node --test webapp/tests/` gives 399 of 399 (SC-04).
- **Vendored files:** `vendor.py check` says all files match `VENDOR.md`.
- **Container test:** 92 of 92, including a byte-identical second build (SR-10).
- **SC-01 on `zangbundel.nl`:** `check_headers.py zangbundel.nl --app --hsts-min 604800` gives 21 of 21.
- **HSTS:** both hosts send `max-age=604800; includeSubDomains`.
- **Hourly check:** `zbm-release verify` gives `ok` for both sites, and the timer is enabled.
- **Code searches over `webapp/src`:** no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, string timers, `style` attributes or `console.` calls. The only storage access is in `app/storage.js`. There is no service worker.
- **Server, read-only:** unattended upgrades, the sshd settings, the owners and modes of the release trees, the htpasswd mode, and the accounts.
- **DNS:** the CAA records, read through `dns.google`.
- **GitHub:** the protection of `main`.
- **Advisories:** GitLab's advisory database for fflate and @noble/ed25519 (SR-14).

Not re-run here, because nothing they cover has changed since the gate of 2026-11-09 (`2026-11-09-release-gate-0.2.0.md`):
- **SC-02:** TLS protocols.
- **SC-03, SC-06, SC-07:** the browser runs.
- **SC-11:** the fuzz. No file under `core/`, `workers/` or `vendor/` has changed since then (`git log 687627c..HEAD`).

## Results

**Met** means the requirement holds as built, with where. **Finding** points to a new SF in the assessment, draft 0.17. **Open** is a step that has not been done yet, with its completion-plan item.

| SR | Result | Where, or why |
|---|---|---|
| SR-01 | Met | SC-02 (2026-11-09): TLS 1.2 and 1.3 only. SC-01: HTTP is redirected to HTTPS. |
| SR-02 | In progress | Ramp step 2 (one week) has been live since 2026-11-10. Step 3 is due no earlier than 2026-11-17 (C3). |
| SR-03 | Met, one leftover | CAA allows Let's Encrypt only, bound to `accounturi` …`/acct/112577467`, with `issuewild ";"` and an `iodef`. A second `issue` record still allows the staging account …`/acct/24760018`; remove it (C4). |
| SR-04 | Met | SC-12: validated by DNSSEC, with a DS record. |
| SR-05 | Owner to confirm | `.nl` has no lock (deviation accepted, 2026-11-07). SR-05 records two-factor authentication on the registrar account as on (2026-11-07). The gate could not see that from outside, and C4 lists it as open. |
| SR-06 | Open | No Certificate Transparency watch yet (C2, owner). |
| SR-07 | Met, deviation accepted | No MX, port 25 closed, SPF `-all`, DMARC `reject` (SC-12). |
| SR-08 | **Finding SF-24** | Only the key notice states `https://zangbundel.nl` (`keySafety`, three languages). The *Over* dialog does not. The README says "Nothing is installed on the server yet". No `zangbundel.nl` was found in the app repository `../Zangbundel`. |
| SR-10 | Met | `build.py` requires `main` and a verified signed tag; `v0.2.1` verifies (`git tag -v`). The container test checks the second build. Trial builds are a recorded deviation and are accepted only on the test instance with `--trial`. |
| SR-11 | Met | `zbm-release activate` checks the signature and every hash, then switches atomically. `verify` gave `ok` today. |
| SR-12 | Met, deviation accepted | `vendor.py check`. fflate has no provenance (section 9). |
| SR-13 | Met | SC-08 (2026-11-09). SC-01 checks `Integrity-Policy`. |
| SR-14 | Met | fflate 0.8.3. SC-10 searched GitHub's database (2026-11-09). GitLab's database on 2026-11-10: fflate has only CVE-2026-45820 (up to 0.8.2, `unzipSync`, which is not used); @noble/ed25519 has no package page. |
| SR-15 | Met in code; SC-05 open | `core/ed25519.js` `selfTest`: RFC 8032 test 1 with noble and with Web Crypto, SHA-256 "abc", and a non-extractable check. Run first by `make` and `load`, which refuse if it fails. Firefox, Edge and Safari are still to run (C5). |
| SR-16 | Met | `workers/crypto-handler.js` `seal` keeps only a non-extractable Web Crypto key, and overwrites the seed with zeros, once the key file has been exported or read. The seed stays where Web Crypto Ed25519 is missing. |
| SR-17 | Met | The server only receives a tar through `zbm-receive`; it has no build tools for the site. |
| SR-20 | Met, see SF-25 | SC-01: 21 of 21 on production, 19 of 19 on test. The CSP names a Trusted Types policy `zbm-download` that does not exist (SF-25). |
| SR-21 to SR-23 | Met | SC-01. |
| SR-24 | Met | `build.py` checks the HTML. `dom.js` allows no `style` attribute. The code searches above found none. |
| SR-25 | Met | SC-01 (methods, dot and backup files, no listing, content types). |
| SR-26 | Met | No cookie and no service worker (code search, SC-06). |
| SR-27 | Met | One set of snippets for both hosts. Only basic auth, `X-Robots-Tag` and the banner differ. |
| SR-30 | Met | The page reads a picked file's bytes and transfers them to the library worker unparsed (`app/session.js`). It receives plain data back. `core/blockmeta.js`, used on the page, only reads blocks the worker made. |
| SR-31 | Met | Limits from the central directory (PKG-02 tests). `TIMEOUT_MS` is 20000 in `app/library-client.js`, which terminates the worker with M-02. |
| SR-32 | Met, see SF-25 | All DOM writes go through `dom.js`: text nodes, an attribute allow-list and a URL check. External links come only from constants (`panels.js`, https only). A library's contact is never made into a link. `zbm-worker` exists (`trusted.js`); `zbm-download` does not (SF-25). |
| SR-33 | Met | Fuzz 2026-11-09: slowest input 165 ms. The one nested quantifier, `^[a-z0-9]+(-[a-z0-9]+)*$` in `core/names.js`, cannot backtrack, because `-` separates the repeats. |
| SR-34 | Met | 399 of 399 today; 59 cases (SC-04). |
| SR-35 | Met | Fuzzed 2026-11-09 with 20,000 libraries; no reader has changed since. |
| SR-36 | Met | `core/names.js` `safeFileName` removes bidirectional controls and replaces control and forbidden characters. `app/download.js` accepts only a generated `.zbl` or `.zbkey` name, uses the right MIME types, and revokes the `blob:` URL after 10 s. |
| SR-37 | Met | `core/library.js`: an Error or Fatal refuses the save (EDT-50). |
| SR-40 | Met | The private key lives only in the crypto worker. Key-file bytes reach the page only for the explicit download of a new key, and are zeroed (draft 0.14). |
| SR-41 | Met | `wipe()` on replace and forget. On `pagehide`, `crypto-client.js` posts *forget* and terminates the worker. |
| SR-42 | Met | `app/storage.js` allows only `zbm.lang` and `zbm.bars`; SC-06. |
| SR-43 | Met | No `console.` calls in `webapp/src`; no error reporting. |
| SR-44 | Met | `keySafety` in nl, en and de, shown with M-64. |
| SR-45 | Met | `autocomplete="off"`. Keys only from the file picker or a drop; no clipboard. |
| SR-46 | Met | `app/idle.js`: 30 minutes, then a 60-second warning. |
| SR-47 | Accepted | Section 9. |
| SR-50 | Met | `connect-src 'none'`; SC-07. |
| SR-51 | Met | Container test (shortened address, no user agent, 13 old copies). |
| SR-52 | Met | `nl/en/de/privacy.html` in the release, linked from *Over* and the narrow page. |
| SR-53 | Met | `extLink` and the privacy pages use `noopener noreferrer`. |
| SR-54 | Met | Same pages and headers on the test instance. |
| SR-55 | Met | A new library starts with `maintainer: null` (`core/library.js`). |
| SR-60 | Met | Container test: 429 under 80 parallel requests. |
| SR-61 | Met | SC-01 (immutable assets, `no-cache` HTML). |
| SR-62 | Partly | The Kuma push of the hourly check has run since 2026-11-10. The outside availability and certificate-expiry monitor is still open (C2, owner). |
| SR-63 | **Finding SF-23** | `zbm-release switch` and the return to the placeholder are written. A restore of the whole site from the tag, `contabo-vps-6` and the release key is not written as one procedure and has not been tried. |
| SR-64 | Withdrawn | |
| SR-65 | Not applicable | No service worker. |
| SR-70 | Met | Native nginx. `/srv/zangbundel*/releases/*` are root-owned, 0755, and not writable by others (`find`). `verify` checks owner and mode every hour. |
| SR-72 | Met | `unattended-upgrades` is enabled and runs daily for `noble` and `noble-security` (last run 2026-11-10 06:16). sshd has `PasswordAuthentication no` and `PermitRootLogin no`. Seven security updates (perl, apache2-utils, python3-pyasn1) came out after this morning's run and wait for tomorrow's. |
| SR-73 | Met | Since 2026-11-10: `zbm-verify.timer` runs hourly as `zbm-verify` and pushes to Kuma. |
| SR-74 | Met, deviation recorded | `zbm-deploy` keeps `/bin/bash` because of the forced command (section 7.4). |
| SR-75 | Met | Since 2026-11-10: `../contabo-vps-6/zangbundel/` (C1). |
| SR-80 | Met | Basic auth over HTTPS. The htpasswd file is `root:www-data 0640`, outside any repository. Testers share the password; the owner accepted that on 2026-11-09. |
| SR-81 | Met | SC-01 (`X-Robots-Tag`); the banner on `test.` hosts. |
| SR-82 | Open | Tester instructions come with M7.5 (C10). |
| SR-83 | Met | Own vhost and release tree. |
| SR-84 | **Finding SF-21** | Neither `manager-0.2.0` nor `manager-0.2.1` was activated on the test instance before production. The tested builds were the trials up to `0.2.0-dev.7`, from different sources. |
| SR-90 | **Finding SF-22** | Release tags are signed and the build refuses an unsigned one. `main` on GitHub has no branch protection and no ruleset (`protected: false`), so force pushes are not blocked. Two-factor authentication on GitHub is the owner's to confirm. |
| SR-91 | Met | This assessment. |
| SR-92 | Met | SC-13: `security.txt` expires 2027-11-01. |
| SR-93 | **Finding SF-23** | There is no incident runbook: no maintenance page, no "take offline" step, no text for users. |

## Findings

| ID | Finding | Rating | What closes it | Whose |
|---|---|---|---|---|
| SF-21 | The production releases were not the tested releases (SR-84) | Medium | Activate a tagged release on `test.zangbundel.nl` first, without `--trial`, then activate the same upload on `zangbundel.nl`. Now: activate `manager-0.2.1` on the test instance, so both hosts run the same signed release. Write the order into runbook step 7. | Owner activates; agent writes the runbook text |
| SF-22 | `main` is not protected against force pushes or deletion (SR-90) | Medium | A GitHub ruleset on `main` that blocks force pushes and deletion. Confirm two-factor authentication on the GitHub account. | Owner |
| SF-23 | No incident runbook; the full restore is not written or tried (SR-93, SR-63) | Low | A runbook section: a maintenance page served by nginx, verify and switch, a restore from the tag and `contabo-vps-6`, and the texts for users; then one dry run on the test instance. | Agent writes; owner tries it |
| SF-24 | The canonical address is missing from *Over*, the README and the app (SR-08) | Low | One line in *Over* in nl, en and de; the README updated. A note in the Zangbundel repository for its About screen and manual. | Agent; the app's part is the owner's |
| SF-25 | The CSP names the Trusted Types policy `zbm-download`, which the app never creates (SR-20, SR-32). *Fixed in the source 2026-11-11, the owner's choice.* | Low | Drop `zbm-download` from SR-20, from the CSP in `conf.d/zangbundel.conf`, and from the CSP that `check_headers.py` expects. Any script could create a policy under that unclaimed name, though only script that already runs could do so. | Owner decides (a change to SR-20); agent prepares it |

## Fixed the same day (2026-11-10)

- **SF-21:** runbook step 7 says: activate the tagged release on the test instance first, then the same upload in production. Still to do (owner): activate `manager-0.2.1` on `test.zangbundel.nl`.
- **SF-23:** runbook step 11 covers going offline, finding the cause, restoring from scratch, and what to tell users. The maintenance page is in `webapp/maintenance/`: no script, nl/en/de, and the privacy statement. In the container test (100 of 100), the maintenance page is activated on `zangbundel.nl`, serves no script, keeps the privacy statement reachable and passes `verify`; the manager then comes back with `switch`. Still to do (owner): tag and build it, then the dry run on the test instance.
- **SF-24:** *Over* says *Alleen https://zangbundel.nl is de bibliotheek-manager.* in nl, en and de (webappGUI GD-45). Checked in the browser with the CSP in force: no console errors. The README's status says the same. Live from the next release. Still to do (owner): the app's About screen and manual.

## Closed by the owner (2026-11-10)

- **SF-21:** the production upload of `manager-0.2.1` was activated on `test.zangbundel.nl`, so both hosts run the same signed release.
- **SF-23:** `maintenance-0.1.0` was built from its signed tag (commit `3168701`) and uploaded (SHA-256 `f315b6bd…`). On the test instance it was activated and checked, then `zbm-release switch test.zangbundel.nl manager-0.2.1` brought the manager back. `zbm-release verify` gave `ok` for both sites (13 files each). The release stays installed on the test instance; for production, the upload goes in at the moment of an incident (runbook step 11).
