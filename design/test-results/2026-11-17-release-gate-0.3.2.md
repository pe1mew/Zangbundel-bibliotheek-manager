# Release gate for 0.3.2 (2026-11-17)

| | |
|---|---|
| **Release** | `v0.3.2` of the manager, with the wiki, for `test.zangbundel.nl` first and then `zangbundel.nl` (SR-84) |
| **Gate** | `design/securityAssessment.md` section 8, SC-01 to SC-13 (TD-18) |
| **Why now** | The owner's decision (2026-11-17), after trials `0.3.2-dev.1` and `-dev.2`: issue #1 (the language button keeps its place, webappGUI GD-48) and issue #5 (*Maak uit titel*, FDS draft 0.14 EDT-36 and D-48, GD-47). |
| **What changed since `v0.3.1`** | The editor, the session, the song fields, the bottom bar and the language menu, two CSS rules, the texts, the wiki's song-ID passages, the conversion report (`core/convert.js`) and the worker (`setSongId`), and the tests. On the server: the HSTS value in `zbm-common-headers.conf` (ramp step 3, live since 2026-11-17, securityAssessment draft 0.20). No vendor or build-tool change. |
| **Run by** | The agent; the items marked *owner* are the owner's |

## Before the tag

These checks ran on the working tree with `version.js` at `0.3.2`. The browser check used a trial build, `dist/manager-0.3.2` (`--allow-dirty`, 30 files), which was deleted afterwards. The release build from the signed tag follows below.

| Check | Result | How |
|---|---|---|
| SC-02 TLS | **Passed.** Both hosts refuse TLS 1.0 and 1.1 and accept 1.2 (`ECDHE-ECDSA-AES256-GCM-SHA384`) and 1.3 (`TLS_AES_256_GCM_SHA384`). The Let's Encrypt chains are valid until 2027-02-05. HSTS is `max-age=2592000; includeSubDomains` (ramp step 3). | Python `ssl`, one connection per version |
| SC-03 CSP | **Passed in Edge 157 and Firefox 160.** No `securitypolicyviolation` through the whole key and signing cycle. | `drive.mjs all`, with the production CSP except `connect-src 'self'` |
| SC-04 test libraries | **Passed.** 418 of 418 unit and conformance tests, with all 60 test libraries. The bundled engine equals the native engine on 60 of 60. | `node --test webapp/tests/`; `test_engine_bundle.py` |
| SC-05 crypto self-test | **Passed in Edge 157 and Firefox 160:** a key was made, so the self-test passed, and both have Web Crypto Ed25519. Safari: accepted as untested (the owner, 2026-11-12). | `drive.mjs all` |
| SC-06 storage | **Passed in Edge and Firefox.** Local storage held only `zbm.lang` and `zbm.bars`; nothing else was stored. | `drive.mjs all` |
| SC-07 network | **Carried over from the dry run** (`2026-11-11-pre-gate-0.3.0-dev.4.md`). No change since then makes a request: the changes are in the editor, the session, the bottom bar, the worker and the conversion report. Under `connect-src` with its production value, `'none'`, the page cannot reach anything but its own files. | Review of the diff `v0.3.1..HEAD` |
| SC-10 advisories | **Passed.** fflate 0.8.3: GHSA-px8p-9vwx-vf98 affects only versions below 0.8.3, and no unreviewed advisory is listed. @noble/ed25519: none. `vendor.py check`: all files match `VENDOR.md`. | `gh api advisories`, reviewed and unreviewed, 2026-11-17 |
| SC-11 fuzz | **Passed.** 20,000 libraries and 2,000 ChordPro songs, 0 failures. The slowest input took 457 ms and memory peaked at 373 MB. Run because the conversion report changed (`core/convert.js`). | `node webapp/tests/fuzz.mjs --iterations 20000`, 2026-11-17 |
| SC-12 DNS | **Passed, with the same leftover as for 0.3.1 (C4).** All answers are DNSSEC-validated (`AD`). CAA allows Let's Encrypt only, with `accounturi`, `issuewild ";"` and `iodef`. SPF is `-all`, DMARC `reject`, and there is no MX. The CAA record still also allows the Let's Encrypt **staging** account. | `dns.google` with `do=1` |
| SC-13 `security.txt`, privacy | **Passed.** Both hosts serve it, and it expires 2027-11-01. No logging change since the last gate. | HTTPS fetch |
| Build and server | **Passed.** `test_build.py`, `test_bundle.py`, `test_vendor.py`: all OK. The container test was not run (Docker Desktop was not running). The one server change, the HSTS value, is live and was checked on the hosts themselves: the installed file's SHA-256 equals the source's, and SC-01 on `zangbundel.nl` with `--hsts-min 2592000` passed 21 of 21 (2026-11-17). | — |
| Wiki | **Passed.** nl, en and de, 17 help links, and no drift from a fresh build. | `wiki.py check --need-hugo` (Hugo v0.169.0) |
| Trials | **Passed.** `0.3.2-dev.1` and `-dev.2` on `test.zangbundel.nl`: `zbm-release verify` ok (30 files) and SC-01 19 of 19 (the owner) for each. | 2026-11-16 |

## After the tag

| Check | Result | How |
|---|---|---|
| Release build | *To do.* | `build.py build --src webapp/src --name manager --version 0.3.2`, with no `--allow-dirty`, twice |
| SC-08 SRI | *To do.* | Recomputed from `dist/manager-0.3.2` |
| SC-03, SC-05, SC-06 on the release | *To do.* | `drive.mjs all dist/manager-0.3.2` |
| SC-09 manifest | *To do.* | `zbm-release verify` on contabo6 |
| SC-01 headers | *To do (test instance: owner).* | `check_headers.py test.zangbundel.nl --auth remko --app --hsts-min 2592000`; `check_headers.py zangbundel.nl --app --hsts-min 2592000` |
