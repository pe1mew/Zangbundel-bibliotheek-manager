# Release gate for 0.3.0 (2026-11-12)

| | |
|---|---|
| **Release** | `v0.3.0` of the manager, with the wiki, for `test.zangbundel.nl` first and then `zangbundel.nl` (SR-84) |
| **Gate** | `design/securityAssessment.md` section 8, SC-01 to SC-13 (TD-18); completion plan C12 |
| **Why now** | The owner's decision (2026-11-12): release with C2, C4, C10 and the app's public 0.5.0 release still open. Safari is accepted as untested. |
| **Run by** | The agent; the items marked *owner* are the owner's |

## Before the tag

These checks ran on the working tree with `version.js` at `0.3.0`. They used a trial build, `dist/manager-0.3.0` (`--allow-dirty`, 30 files), which was deleted afterwards. The release build from the signed tag follows below.

| Check | Result | How |
|---|---|---|
| SC-02 TLS | **Passed.** Both hosts refuse TLS 1.0 and 1.1 and accept 1.2 (`ECDHE-ECDSA-AES256-GCM-SHA384`) and 1.3 (`TLS_AES_256_GCM_SHA384`). The Let's Encrypt chains are valid until 2027-02-05. HSTS is `max-age=604800; includeSubDomains` (ramp step 2). | Python `ssl`, one connection per version |
| SC-03 CSP | **Passed in Edge 157 and Firefox 160.** No `securitypolicyviolation` through the whole key and signing cycle. | `drive.mjs all`, with the production CSP except `connect-src 'self'` |
| SC-04 test libraries | **Passed.** 404 of 404 unit and conformance tests. The bundled engine equals the native engine on 59 of 59. | `node --test webapp/tests/`; `test_engine_bundle.py` |
| SC-05 crypto self-test | **Passed in Edge 157 and Firefox 160:** a key was made, so the self-test passed, and both have Web Crypto Ed25519. Chromium passed in the dry run. **Safari: accepted as untested** (the owner). | `drive.mjs all` |
| SC-06 storage | **Passed in Edge and Firefox.** Afterwards local storage held only `zbm.lang`. Session storage, IndexedDB, Cache Storage and cookies were all empty. | `drive.mjs all` |
| SC-07 network | **Carried over from the dry run** (Chromium, dev.4). Since then the app has changed only in one CSS rule (dev.5) and its version string. Under `connect-src` with its production value, `'none'`, the page cannot reach anything but its own files. | `2026-11-11-pre-gate-0.3.0-dev.4.md` |
| SC-10 advisories | **Passed.** fflate 0.8.3: GHSA-px8p-9vwx-vf98 affects only versions below 0.8.3, and no unreviewed advisory is listed. @noble/ed25519: none. `vendor.py check`: all files match `VENDOR.md`. | `gh api advisories`, reviewed and unreviewed, 2026-11-12 |
| SC-11 fuzz | **Passed.** 20,000 libraries and 2,000 ChordPro songs, 0 failures. The slowest input took 188 ms and memory peaked at 335 MB. No reader has changed since. | `node webapp/tests/fuzz.mjs --iterations 20000`, 2026-11-11 |
| SC-12 DNS | **Passed, with one leftover (C4).** All answers are DNSSEC-validated (`AD`). CAA allows Let's Encrypt only, with `accounturi`, `issuewild ";"` and `iodef`. SPF is `-all`, DMARC `reject`, and there is no MX. The CAA record still also allows the Let's Encrypt **staging** account. | `dns.google` with `do=1` |
| SC-13 `security.txt`, privacy | **Passed.** Both hosts serve it, and it expires 2027-11-01. No server or logging change since the last gate. | HTTPS fetch |
| Build and server | **Passed.** `test_build.py`, `test_bundle.py`, `test_vendor.py`: all OK. The container test, Ubuntu 24.04 with nginx 1.24, passed 102 of 102, including the wiki on `zangbundel.nl` with the page CSP. | — |
| Wiki | **Passed.** nl, en and de, 17 help links, and no drift from a fresh build. | `wiki.py check --need-hugo` (Hugo v0.169.0) |

## After the tag

| Check | Result | How |
|---|---|---|
| Release build | **Passed.** `dist/manager-0.3.0`, 30 files, from commit `2a42b6c` with the signed tag `v0.3.0` (good signature). `source_dirty: false`. Built twice: every file was byte-identical (SR-10). | `build.py build --src webapp/src --name manager --version 0.3.0`, with no `--allow-dirty` |
| SC-08 SRI | **Passed.** 21 integrity attributes in the release's pages, all matching their files. | Recomputed from `dist/manager-0.3.0` |
| SC-03, SC-05, SC-06 on the release | **Passed in Edge 157 and Firefox 160,** 15 of 15 steps each. | `drive.mjs all dist/manager-0.3.0` |
| SC-09 manifest | **Passed.** `zbm-release verify` gives `ok` for `test.zangbundel.nl manager-0.3.0 (30 files)` and `zangbundel.nl manager-0.3.0 (30 files)`. Both hosts run the one upload, `upload-20261112T183021Z-4043821.tar`, whose SHA-256 `38a313f4…02f2` equals the pack's. | On contabo6, read-only, as the owner's user |
| SC-01 headers | **Passed on both hosts.** Test instance: 19 of 19 (the owner, 2026-11-12). Production: 21 of 21 (the agent, 2026-11-12). Production serves `assets/main.7d5d3a6f3876.js`, the release's bundle. `/wiki/nl/` and `/wiki/de/good-practice/` answer 200. | `check_headers.py test.zangbundel.nl --auth remko --app`; `check_headers.py zangbundel.nl --app` |

**Released 2026-11-12, as SR-84 says:** the owner activated the upload on `test.zangbundel.nl` first, and after its checks activated the same upload on `zangbundel.nl`.

**The browser check's own fault, fixed (2026-11-12):** on the first run on the release, F1 failed in Edge. Headless Edge had started ignoring `--window-size` and opened at 500 × 320. At that size the manager shows the narrow layout, which hides the title field. dev.5, which had passed the day before, failed the same way, so the fault was in the check, not in the release. `drive.mjs` now sets the viewport through `Emulation.setDeviceMetricsOverride`, and its first step checks for 1400 × 900. The release was not changed.
