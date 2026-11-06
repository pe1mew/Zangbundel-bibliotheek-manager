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
