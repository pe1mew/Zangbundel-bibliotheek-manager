# Release gate for 0.3.1 (2026-11-16)

| | |
|---|---|
| **Release** | `v0.3.1` of the manager, with the wiki, for `test.zangbundel.nl` first and then `zangbundel.nl` (SR-84) |
| **Gate** | `design/securityAssessment.md` section 8, SC-01 to SC-13 (TD-18) |
| **Why now** | The owner's decision (2026-11-16), after looking at trial `0.3.1-dev.1`: the fixes for issues #2 and #3, and SNG-19, which makes the manager on `zangbundel.nl` read a nested `{chorus}` as the app does (FDS D-47). |
| **What changed since `v0.3.0`** | The song editor (`editor.js`, `main.js`), one CSS rule, one Dutch text, the song reader (`chordpro.js`, `validate.js`, `messages.js`) and the tests. No server, vendor, wiki or build-tool change. |
| **Run by** | The agent; the items marked *owner* are the owner's |

## Before the tag

These checks ran on the working tree with `version.js` at `0.3.1`. The browser check used a trial build, `dist/manager-0.3.1` (`--allow-dirty`, 30 files), which was deleted afterwards. The release build from the signed tag follows below.

| Check | Result | How |
|---|---|---|
| SC-02 TLS | **Passed.** Both hosts refuse TLS 1.0 and 1.1 and accept 1.2 (`ECDHE-ECDSA-AES256-GCM-SHA384`) and 1.3 (`TLS_AES_256_GCM_SHA384`). The Let's Encrypt chains are valid until 2027-02-05. HSTS is `max-age=604800; includeSubDomains` (ramp step 2). | Python `ssl`, one connection per version |
| SC-03 CSP | **Passed in Edge 157 and Firefox 160.** No `securitypolicyviolation` through the whole key and signing cycle. | `drive.mjs all`, with the production CSP except `connect-src 'self'` |
| SC-04 test libraries | **Passed.** 414 of 414 unit and conformance tests, with all 60 test libraries. The bundled engine equals the native engine on 60 of 60. | `node --test webapp/tests/`; `test_engine_bundle.py` |
| SC-05 crypto self-test | **Passed in Edge 157 and Firefox 160:** a key was made, so the self-test passed, and both have Web Crypto Ed25519. Safari: accepted as untested (the owner, 2026-11-12). | `drive.mjs all` |
| SC-06 storage | **Passed in Edge and Firefox.** Local storage held only `zbm.lang` and `zbm.bars`; nothing else was stored. | `drive.mjs all` |
| SC-07 network | **Carried over from the dry run** (`2026-11-11-pre-gate-0.3.0-dev.4.md`). No change since then makes a request: the changes are in the editor, the song reader and one CSS rule. Under `connect-src` with its production value, `'none'`, the page cannot reach anything but its own files. | Review of the diff `v0.3.0..HEAD` |
| SC-10 advisories | **Passed.** fflate 0.8.3: GHSA-px8p-9vwx-vf98 affects only versions below 0.8.3, and no unreviewed advisory is listed. @noble/ed25519: none. `vendor.py check`: all files match `VENDOR.md`. | `gh api advisories`, reviewed and unreviewed, 2026-11-16 |
| SC-11 fuzz | **Passed.** 20,000 libraries and 2,000 ChordPro songs, 0 failures; SNG-19 was hit 80 times. The slowest input took 294 ms and memory peaked at 401 MB. Run after the song reader changed (SNG-19). | `node webapp/tests/fuzz.mjs --iterations 20000`, 2026-11-16 |
| SC-12 DNS | **Passed, with the same leftover as for 0.3.0 (C4).** All answers are DNSSEC-validated (`AD`). CAA allows Let's Encrypt only, with `accounturi`, `issuewild ";"` and `iodef`. SPF is `-all`, DMARC `reject`, and there is no MX. The CAA record still also allows the Let's Encrypt **staging** account. | `dns.google` with `do=1` |
| SC-13 `security.txt`, privacy | **Passed.** Both hosts serve it, and it expires 2027-11-01. No server or logging change since the last gate. | HTTPS fetch |
| Build and server | **Passed.** `test_build.py`, `test_bundle.py`, `test_vendor.py`: all OK. The container test is carried over from 0.3.0 (102 of 102): `webapp/server/` has not changed since `v0.3.0`. | — |
| Wiki | **Passed.** nl, en and de, 17 help links, and no drift from a fresh build. | `wiki.py check --need-hugo` (Hugo v0.169.0) |
| Trial | **Passed.** `0.3.1-dev.1` on `test.zangbundel.nl`: `zbm-release verify` ok (30 files), SC-01 19 of 19 (the owner), and the owner's look at the fixes for #2 and #3. | 2026-11-16 |

## After the tag

| Check | Result | How |
|---|---|---|
| Release build | **Passed.** `dist/manager-0.3.1`, 30 files, from commit `ffbc781` with the signed tag `v0.3.1` (good signature). `source_dirty: false`. Built twice: every file was byte-identical (SR-10). The bundle is `assets/main.cc102e790c87.js`. | `build.py build --src webapp/src --name manager --version 0.3.1`, with no `--allow-dirty`, twice |
| SC-08 SRI | **Passed.** 21 integrity attributes in the release's pages, all matching their files. | Recomputed from `dist/manager-0.3.1` |
| SC-03, SC-05, SC-06 on the release | **Passed in Edge 157 and Firefox 160,** 15 of 15 steps each. | `drive.mjs all dist/manager-0.3.1` |
| SC-09 manifest | **Passed.** `zbm-release verify` gives `ok` for `test.zangbundel.nl manager-0.3.1 (30 files)` and `zangbundel.nl manager-0.3.1 (30 files)`. Both hosts run the one upload, `upload-20261116T182747Z-1268346.tar`, whose SHA-256 `b9f575f0…21bd` equals the pack's. | `zbm-release verify` on contabo6 |
| SC-01 headers | **Passed on both hosts.** Test instance: 19 of 19 (the owner, 2026-11-16). Production: 21 of 21 (the agent, 2026-11-16). Production serves `assets/main.cc102e790c87.js`, the release's bundle. `/wiki/nl/` and `/wiki/de/good-practice/` answer 200. | `check_headers.py test.zangbundel.nl --auth remko --app`; `check_headers.py zangbundel.nl --app` |

**Released 2026-11-16, as SR-84 says:** the owner activated the upload on `test.zangbundel.nl` first, and after its checks activated the same upload on `zangbundel.nl`.
