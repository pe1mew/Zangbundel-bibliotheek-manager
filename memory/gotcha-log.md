# Gotcha Log

<!-- Structured problem/solution journal. Append-only.
     Part of the self-learning loop: Capture → Surface → Promote → Retire.

     PROMOTION LIFECYCLE:
     - New entries start here (Capture phase)
     - At end-of-session, review for patterns (Surface phase)
     - When an entry recurs 2-3 times, promote it to the relevant topic file
       as an "if X, then Y" pattern (Promote phase). Word it without the
       first instance's domain, or it will not fire in the next one: "a result
       correct in its own terms is read as covering the claim it is used for",
       not "tests green != prod verified". Check for an existing row first.
     - When a gotcha's root cause is fixed, mark it [RESOLVED] IN THE HEADING
       (Retire phase) — `### Title (2026-08-12) [RESOLVED]`. Curation reads
       headings and the Promoted table, not bodies, so a status written in a
       body is invisible to it — and so is a resolved entry whose heading was
       never marked, which then reads as open forever. Nothing chases you:
       marking the heading is the only thing that keeps the log's open set
       meaningful.
     - Track what you've promoted in the "Promoted" section below

     When the root cause is fixed, mark it resolved here (don't delete).

     ARCHIVE WHEN IT GROWS; STILL DON'T DELETE. Once most of what a grep
     returns is resolved, MOVE entries that are resolved AND dated before the
     current month to gotcha-log-archive.md beside this file:
     - Select on the `[RESOLVED` PREFIX. Read the kept side, not only the count.
     - Never move `[OPEN]` or `[PARKED]` entries, however old.
     - The Promoted and Mechanized tables stay here.
     - End an entry at the next `##` OR `###` heading.
     - Move, never summarise: afterwards every heading is in exactly one of
       the two files and no body line is missing from both.
     - Point each file at the other, and point the project file's
       stuck-or-debugging row at both.

     This file is tracked in git, so its history is available: questions
     about CHANGE (when did a status move, was every entry present before a
     split present after) are answerable with `git log -p memory/gotcha-log.md`. -->

<!-- Template for new entries:

### [Short description] (YYYY-MM-DD)
**Problem**: What went wrong or was confusing.
**Root cause**: Why it happened.
**Fix**: What solved it.

     Write the lesson and the action, not the narrative of the session
     that found it — having just lived through it, you will overweight
     the detail.

     A real entry runs ~700-1,200 characters and that is fine, so long as
     the process reads headings first. ABOVE ~3,000 CHARACTERS is the signal
     worth acting on — that is a page, and a page belongs in a topic file.

     WHAT TO CUT: precision is a claim specific enough to check; verbosity is
     restatement, emphasis and narration of your own reasoning. Keep the wrong
     value and the right one, the mechanism, file and section names, how it
     was caught, and the rule as if/then. One statement per fact. Do not
     abbreviate words to save characters.

     For this project the likely first entries are spec-level: an ID cited
     before it is defined, a rule whose severity or message differs between
     section 6 and section 9 of the FDS, or a rule the manager and the app
     apply differently. Log them the same way — Problem, Root cause, Fix —
     and name the documents.
-->

### nginx: map regex braces, $server_name in a multi-name server (2026-11-06)
**Problem**: `nginx -t` failed with `unexpected "{"` on the IPv6 line of the address-shortening `map` (`[0-9a-f]{0,4}`). Separately, the shared port-80 server redirected `test.zangbundel.nl` to `https://zangbundel.nl/…`.
**Root cause**: In nginx, a regex containing `{` must be quoted. `$server_name` is the FIRST name of the `server_name` list, not the name that matched.
**Fix**: Quote the regex (`"~*^(?<p>…{0,4}…):"`). Redirect with `$host`, which is safe when `server_name` lists exact names only. Both were caught by `webapp/server/test/run.sh` (SC-01 in an Ubuntu 24.04/nginx 1.24 container), not by reading. Rule: if server config changes, run that test before claiming it works.

### Local server test needs Docker Desktop started; Git Bash mangles container paths (2026-11-06)
**Problem**: `docker info` failed with "cannot find dockerDesktopLinuxEngine"; mounted paths like `/repo` arrived rewritten.
**Root cause**: Docker Desktop is installed but not running by default. Git Bash (MSYS) converts arguments that look like POSIX paths.
**Fix**: Start it with `Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`; the engine is up within seconds. Prefix `docker run` with `MSYS_NO_PATHCONV=1`. `bash -c` with several `cat <<'EOF'` blocks still fails in this shell; a single `python - <<'PY'` heredoc works, and the Write tool always does.

### A check that only lists what it can read reports green on what it cannot (2026-11-06)
**Problem**: `zbm-release verify` (SR-73) said "ok" while an unlisted page sat in a mode-0711 directory under the live release; nginx served it. The run as root caught it, the run as the unprivileged check user did not.
**Root cause**: `os.walk` skips a directory it cannot list unless `onerror` is given. A tamper check run with fewer rights than the web server sees less than the web server serves.
**Fix**: Pass `onerror` that raises, and check owner and mode of every entry. Rule: if an integrity check runs as a different user than the server, test it as that user with a seeded hidden file (`webapp/server/test/run.sh`, "file hidden in an unreadable dir").

### Regex checks on HTML are evadable; check the result with a parser (2026-11-06)
**Problem**: `build.py` "refused" inline script and handlers by regex. `<img/onerror=…>`, `<a title=">" onclick=…>`, `<p/style=…>`, `</script x>` and single-quoted `href` all passed; a single-quoted stylesheet shipped without SRI and pointing at a renamed file.
**Root cause**: The regexes assumed one spelling of HTML; browsers tokenize many.
**Fix**: Check with `html.parser`, and after rewriting verify the output: every local reference resolves and every stylesheet and script has the right SRI. A form the rewrite misses then fails the build instead of shipping.

### `exec N>file 2>/dev/null` silences the whole script (2026-11-06)
**Problem**: After the round-2 fix, every refusal of `zbm-receive` printed nothing; the uploads were still refused, so only a test asserting the message noticed (8 checks in `run.sh`).
**Root cause**: In bash, a redirection on a bare `exec` is permanent: `2>/dev/null` there closes stderr for the rest of the script, not just for the open.
**Fix**: Put the redirect on a brace group: `{ exec 9>>"$f"; } 2>/dev/null || refuse ...`. Rule: a test of a refusal asserts its message, not only the exit code.

### A stock logrotate stanza with `notifempty` keeps quiet logs indefinitely (2026-11-06)
**Problem**: The privacy statement promised deletion after 14 days; Ubuntu's `/etc/logrotate.d/nginx` (`daily`, `rotate 14`, `notifempty`) never rotates an empty log, so a quiet error log kept full IP addresses for as long as it stayed quiet.
**Root cause**: Old rotations are only deleted when a rotation happens; `notifempty` skips it.
**Fix**: Own folder and stanza (`webapp/server/logrotate/zangbundel`: `ifempty`, `rotate 13`, `maxage 14`), tested by forcing 16 rotations in `run.sh`. Rule: a retention promise is checked against the rotation config, not against "daily, 14 kept".

### A source transform that deletes statements changes ASI (2026-11-06)
**Problem**: The bundler blanked `import`/`export { }` statements to spaces. Before a line starting with `(` or `[`, the previous statement without `;` then ran on into it: `let msg = greet` + `('x')` became `greet('x')`. The bundle was valid JavaScript, just different, so no syntax check could see it.
**Root cause**: A blank is not a statement boundary; the removed statement was the boundary.
**Fix**: Replace a removed statement with `;` plus blanks (`webapp/tools/bundle.py` `blank`). Rule: test a source transform by comparing its output's behaviour with the original's (`test_bundle.py` `same_as_native`), not only by checking that it parses.

### A bounded output buffer is not bounded work (2026-11-07)
**Problem**: zip.js inflated each entry into a buffer of exactly its declared size and called that "bounded". fflate kept decoding the whole stream and dropped the excess bytes silently: an entry declaring 0 bytes but holding 256 MiB of zeros took a second each, 20 overlapping copies 35 s, and a song could hide a tail no other reader would miss.
**Root cause**: The check measured memory, not the amount of input processed; the overflow never reached the code that compared lengths.
**Fix**: Streaming `Inflate` in 4 KiB steps, stopped as soon as the output passes the declared size; overlapping entries refused. Rule: when a limit protects against hostile input, test it with a timing assertion on a crafted input (`zip.test.mjs` SR-31), not only with a size check.

### A crypto library's lenient default is a verification bug (2026-11-07)
**Problem**: SIG-03 used noble's `verifyAsync` with defaults; its ZIP-215 mode accepts R = identity, S = 0 under the identity key for any message, so a "signed" library could be forged, while Web Crypto and OpenSSL reject it.
**Root cause**: The default chosen for consensus systems is not the RFC 8032 strictness every other verifier of this format uses.
**Fix**: `{ zip215: false }`; a regression test with the identity key. Rule: when two implementations must agree (FDS principle 2), pin the verification mode explicitly and test a known forgery.

### Reading a file to hand it to a worker puts its bytes in the page (2026-11-07) [RESOLVED]
**Problem**: The first M6.3 `session.loadKey` did `file.arrayBuffer()` on the main thread and transferred the buffer to the crypto worker. Transferring detaches the buffer, so it looked safe, but the page had held the private key's bytes: against SR-40.
**Root cause**: The library path (read, then transfer) was copied to the key path, where the rule is stricter: library bytes may pass the page, key bytes may not.
**Fix**: Post the `File` itself (structured-cloneable); the worker reads it and zeroes the bytes. Tested by making every read method of the page's `File` throw. Rule: when data must stay in a worker, send the handle (File, Blob, port), never its contents.

### A check run before the last edit was reported for the final state (2026-11-07) [RESOLVED]
**Problem**: M6.3 reported "container 81 of 81", but the container ran before the signing tests switched to the global `File`, which the container's Node 18 lacks. The committed M6.3 failed 9 tests there.
**Root cause**: The checks ran in the order the work was done, and an edit made after a check was never checked again. Local Node 26 hid the difference.
**Fix**: `File` imported from `node:buffer`; M6.4 ran every check after its last edit. Rule: a reported check result describes the tree it ran on; rerun the whole set after the last edit, before staging.

## Promoted

<!-- Track gotchas that have been promoted to topic files or the memory index.
     This helps you avoid re-promoting and shows the loop is working.

     STATUS TAGS:
     - [PROMOTED] — lesson was moved up the stack (to a topic file, memory index, or project file)
     - [RESOLVED] — root cause was fixed; entry stays as history. Put it in
       the heading. Same for a recurrence count: `[x3]` in the heading, so the
       promotion step can see it without opening the entry.

     OCCURRENCES is the column that survives compression. Keep incrementing
     AFTER promotion: a promoted pattern that recurs means the promotion did
     not take. Date each recurrence briefly, so a rising rate is visible. -->

| Date | Gotcha | Occurrences | Promoted to |
|------|--------|-------------|-------------|

## Mechanized

<!-- Review findings promoted to a deterministic check. The destination for
     `review-changes` Step 3.1. Separate from Promoted above because the
     destinations differ: a gotcha becomes PROSE an agent reads, a review
     finding becomes a CHECK that runs.

     STATUS:
     - `proposed` — the shape is named, no check exists yet
     - `live` — the check exists AND a seeded positive has made it go red.
       Nothing becomes `live` on the author's read of it.
     - `rejected` — triaged and judged NOT mechanizable; the Check cell
       carries the reason. Kept, not deleted.
     - `retired` — the class can no longer occur; say what removed it

     OCCURRENCES here counts sightings AFTER the row went `live` only.
     A lens finding a class its own live check covers means the check does
     not fire on the real shape. Investigate the check, not the finding. -->

| Date | Finding shape | Check | Status | Occurrences |
|------|---------------|-------|--------|-------------|
| 2026-11-07 | Inflation not stopped at the declared size (work unbounded) | `webapp/tests/unit/zip.test.mjs` "SR-31" (64 MiB stream declaring 0 bytes, < 500 ms); fails on 8c22e37 | live | 0 |
| 2026-11-07 | Lenient signature verification (ZIP-215 forgery) | `webapp/tests/unit/validate.test.mjs` "SIG-03 … identity key"; fails on 8c22e37 | live | 0 |
| 2026-11-07 | Engine throws on hostile manifest instead of reporting | `webapp/tests/unit/validate.test.mjs` "nested deeply …"; fails on 8c22e37 | live | 0 |
| 2026-11-07 | Pipe inside a code span in a table cell | the Step 1.5 structural pre-check of `/review-changes` (caught FDS PF-20) | live | 1 (2026-11-07) |
| 2026-11-06 | Bundle valid but behaves differently from the modules (ASI, regex/division) | `webapp/tests/test_bundle.py` `same_as_native` (7 cases, node); against the 13f7776 bundler 9 checks went red and one crashed | live | 0 |
| 2026-11-06 | Doc presents a one-off or manual check as a repository test | needs intent | rejected | 0 |
| 2026-11-06 | Quiet log kept past the promised retention | `webapp/server/test/run.sh` "16 forced rotations leave the log and 13 old copies" | proposed | 0 |
| 2026-11-06 | Refusal message lost, exit code still right | `webapp/server/test/run.sh` `refused` helper asserts the message; it went red on all 8 `zbm-receive` refusals when stderr was silenced | live | 0 |
| 2026-11-06 | Integrity check blind to unreadable directories | `webapp/server/test/run.sh` "verify: file hidden in an unreadable dir" | proposed | 0 |
| 2026-11-06 | nginx error page (401/404/405) without CSP, COOP or COEP | `webapp/tools/check_headers.py` (error responses checked against the file CSP and the common set); seeded: COEP removed, 24 checks went red | live | 0 |
| 2026-11-06 | HTML check evaded (attribute spelling, quoting, parser divergence) | `webapp/tests/test_build.py` (22 unsafe pages, 1 valid page; run by `webapp/server/test/run.sh`); five of its cases passed the f089ab0 build (round-2 review) | live | 1 (2026-11-06, round 2: comment/CDATA divergence) |
| 2026-11-06 | Release built without a signed tag | `webapp/server/test/run.sh` "build without a signed tag", "trial build to zangbundel.nl" | proposed | 0 |
| 2026-11-06 | Upload limits checked without a lock | `webapp/server/test/run.sh` "second upload while one runs" | proposed | 0 |
| 2026-11-06 | Test step printed PASS but never counted a failure | `webapp/server/test/run.sh` uses only `check`/`refused`; a grep for `&& ok` without `bad` in `webapp/server/test/` <!-- placeholder --> | proposed | 0 |
| 2026-11-06 | A count in a doc ("6 files") differs from disk | a doc-count lint <!-- placeholder --> comparing counts in `webapp/server/README.md` with `ls` | proposed | 0 |
