# Release gate for 0.2.0, first part (2026-11-09)

| | |
|---|---|
| **Release** | The manager, `manager-0.2.0-dev.7` (commit `e3e02ea`), as live on `test.zangbundel.nl`; to become `v0.2.0` on `zangbundel.nl` |
| **Gate** | `design/securityAssessment.md` section 10, SC-01 to SC-13 (TD-18) |
| **Run by** | The agent, at the owner's request ("release gate first"); the items marked *owner* are the owner's to run |

## Results

| Check | Result | How |
|---|---|---|
| SC-01 headers | **Passed on the test instance**, 19 of 19, run by the owner on 2026-11-09 with the manager (`manager-0.2.0-dev.7`) live and `--app`. For production it is to run again after go-live. | The checks: HTTP to HTTPS; 401 without credentials; `security.txt` and `robots.txt` without auth; the HTML page; five assets; a range request; not found; POST and PUT refused; dot file, backup file, release manifest and its signature hidden; no directory listing. `check_headers.py test.zangbundel.nl --auth <tester> --app`. For production: `check_headers.py zangbundel.nl --app`. |
| SC-02 TLS | **Passed**, except the HSTS ramp. Both hosts refuse TLS 1.0 and 1.1 and accept TLS 1.2 (`ECDHE-ECDSA-AES256-GCM-SHA384`) and 1.3 (`TLS_AES_256_GCM_SHA384`). Both have a valid Let's Encrypt chain, valid until 2027-02-05. HSTS is present, but at `max-age=300`: the ramp of runbook step 9 is still open. | Python `ssl`, one connection per protocol version. No full `testssl.sh` scan: that would mean running a downloaded tool, which is the owner's call. |
| SC-03 CSP | **Passed (Chromium).** No `securitypolicyviolation` and a clean console through every screen: home, *Over*, *Android-app*, the language menu, a new library and its fields, the help, the editor in *Blokken* and code, the song view, a new set, *Controle*, the key group and the download dialog with signing. | The live pack `dist/manager-0.2.0-dev.7` served with the test instance's CSP (`csp_server.py`, `connect-src 'none'`). The splash was checked in earlier trials. The `Integrity-Policy` header is not in this local server; SC-01 checks it on the host. |
| SC-04 test libraries | **Passed.** All 59 give exactly their expected findings. | `node --test webapp/tests/` (399 of 399); `test_engine_bundle.py` 59 of 59, bundled = native. |
| SC-05 crypto self-test | **Passed in Chromium only; open (owner)** for Firefox, Edge and Safari. A key was made through the crypto worker, which runs its self-test first. | Run *Sleutel maken* once in each browser on `test.zangbundel.nl`. |
| SC-06 storage | **Passed (Chromium).** After making a key, the download dialog with signing and forgetting the key, local storage held only `zbm.lang`. Session storage, IndexedDB, Cache Storage, service workers and cookies were all empty. | Read in the page after the cycle. |
| SC-07 network | **Passed (Chromium), without a saved file.** Every request went to the site's own files: the icon, the F-Droid badge, the photograph and both workers. Nothing else. The cycle stopped at the download dialog, because signing a new key's library first asks to download the key file, which would save files to the owner's disk. | The browser pane's network log over the whole walk-through. |
| SC-08 SRI | **Passed.** The `sha384` integrity of `assets/main.e5fb429f13e5.js` and `assets/app.eaff984a151b.css` in `index.html` match the files. | Recomputed from `dist/manager-0.2.0-dev.7`, whose files the server verified (SC-09). |
| SC-09 manifest | **Passed.** `zbm-release verify test.zangbundel.nl` gives `ok test.zangbundel.nl manager-0.2.0-dev.7 (9 files)`. | On contabo6, read-only, as the owner's user. |
| SC-10 advisories | **Passed.** No advisory affects a used function. | GitHub advisory database and the project's advisory page, 2026-11-09. `vendor.py check`: all files match `VENDOR.md`. See *SC-10 in detail* below. |
| SC-11 fuzz | **Passed.** 20,000 libraries and 2,000 ChordPro songs, 0 failures. The slowest input took 165 ms, memory peaked at 344 MB, and 108 inputs went through conversion. | `node webapp/tests/fuzz.mjs --iterations 20000`. |
| SC-12 DNS | **Passed**, with one leftover and one item open (owner). | Records through `dns.google` with `do=1`, and through Windows `Resolve-DnsName`. See *SC-12 in detail* below. |
| SC-13 `security.txt`, privacy | **Passed.** `security.txt` is served on both hosts and expires 2027-11-01. The privacy statement matches the server's logging. | Fetched over HTTPS; `webapp/server/nginx/conf.d/zangbundel.conf` and `webapp/server/logrotate/zangbundel` read against `placeholder/*/privacy.html`. See *SC-13 in detail* below. |

### SC-10 in detail

- **fflate 0.8.3:** two advisories, both on `unzipSync`. The manager imports only `deflateSync` and `Inflate` (`src/core/zip.js`) and reads ZIP structure itself, so neither applies. Recheck them at the next update of fflate.
  - **GHSA-px8p-9vwx-vf98:** a ZIP64 infinite loop, fixed in 0.8.3.
  - **GHSA-3xf2-c6c2-98qc:** unreviewed, "up to 0.8.3", with no fix listed.
- **@noble/ed25519 3.2.0:** no published advisories.

### SC-12 in detail

- **Passed:** all of it validated by DNSSEC (`AD`, a DS record present).
  - **CAA:** Let's Encrypt only, `issuewild ";"`, and an `iodef` contact.
  - **Mail:** SPF `v=spf1 -all`, DMARC `p=reject; adkim=s; aspf=s`, and no MX.
  - **AAAA:** none, as planned while contabo6 has no IPv6.
- **Leftover:** the CAA record also allows the Let's Encrypt **staging** account (`acme-staging-v02`). Staging certificates are not trusted by browsers, so it is harmless, but worth removing.
- **Open (owner):** the registrar account's two-factor authentication.

### SC-13 in detail

The statement promises shortened IP addresses (`zbm_anon`) and deletion after 14 days. The server keeps logs daily with `rotate 13` and `maxage 14`.

## Not part of SC-01 to SC-13, but in the plan's criteria for going live (M8)

- **M7.2, the browser matrix:** only Chromium has been checked by the agent; the owner has looked in Firefox.
- **M7.3:** the accessibility pass. The ⓘ help is now mouse-only (GD-44).
- **M7.4:** the security re-assessment for the implementation (SR-91).
- **M7.5:** the testers.
- **HSTS:** at one year for three months.
- **The Zangbundel app:** its import of this format must be released.
- **Runbook step 8:** the hourly `zbm-verify` timer with its monitoring.

## Needed for production, found while preparing

- **The CSP:** `zangbundel.nl` still has the placeholder's, with no script. The manager needs SR-20's, as on the test instance (`conf.d/zangbundel.conf` already says so).
- **The front door:** `zangbundel.nl` redirects `/` to `/<lang>/`, the placeholder's language pages. With the manager there, `/` must serve its `index.html`.
- **The privacy statement:** the manager links to `https://zangbundel.nl/<lang>/privacy.html`, which only the placeholder provides. Those pages must come with the manager's own release.
