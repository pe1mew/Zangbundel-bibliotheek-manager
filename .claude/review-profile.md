# Review Profile

<!-- Read by the review-changes skill at Step 1. One per repo; never user-global
     (the skill is global, this file is the repo-specific half). -->

Read by `review-changes` Step 1. **This file is the bibliotheek-manager's half of that skill.** The
skill ships identically to every project; everything in this file is ours and never travels.

`design/FDS.md` is the specification the manager and the Zangbundel app's import are built from; a
wrong sentence in it reaches both, which is why it is HIGH. No code exists yet. When it does, the
parts that read untrusted ZIPs, write the manifest, sign or verify, or handle the private key are
HIGH; add their paths here when the implementation technology is chosen.

## Risk tiers

| Tier | File patterns | Depth |
|------|-------------|-------|
| **HIGH** | `design/FDS.md`, `design/securityAssessment.md`, `webapp/**` (once it holds the implementation), `CLAUDE.md`, `.claude/review-profile.md`, `scripts/**`, `.gitignore`, `.gitattributes`, `LICENSE`, `license.md`, `NOTICE`, `.github/workflows/**`, `test-libraries/**` | Full battery (3-4 lenses) |
| **MEDIUM** | `design/**` (anything else under design), `README.md`, `contributing.md` | Two lenses (adversarial + doc-accuracy) |
| **LOW** | `memory/**`, `changelog.md`, `code_of_conduct.md` | One lens (adversarial) |

`**` crosses directory levels; a leading `/` anchors to the repo root. **The most specific
matching pattern wins.** Where no pattern is more specific than another, take the highest tier.

## Guarantee surfaces

Every path here sits in the HIGH row above.

- `design/FDS.md`: an ID (`PF/MF/SG/EDT/APP-nn`, rule codes, `M-nn`, `O-nn`, `D-nn`), once published, keeps its meaning for ever; a withdrawn one is marked *Withdrawn* and kept. The package format (sections 3 to 5: folder layout, manifest fields, signature over the exact manifest bytes, key file, fingerprint) is a file format shared with the Zangbundel app: within `formatVersion` 1 it may only be added to, never re-meaned; a breaking change raises `formatVersion`. The validation rules (section 6) bind the app as well as the manager.
- `.gitignore`: guarantees that `.zbkey` key files never enter the repository while `.claude/review-profile.md` stays trackable.
- `.gitattributes`: keeps test libraries byte-exact; a conversion silently changes what a test checks.
- `test-libraries/**` (once it exists, O-04): the shared conformance set both the manager and the app must pass; an expected result changed without the rule it tests changing is a defect.

## Test baseline

```bash
# None yet: no code and no check script. Add the commands here when they exist.
```

## Always-full-depth carve-outs (project additions)

- The FDS header table (`Status`, `Date`): a version bump claims the document changed; check that the body actually changed to match.
- FDS section 6 against section 9: every rule's message ID must exist in section 9, and every severity must match the table of 6.1.
- FDS section 11 (open items) and 12 (decision log): a change elsewhere that silently answers an open item without recording it.

## Project lenses

- `rule-symmetry` — fires on: `design/FDS.md`
  *Refute the claim that the Editor and the Songbook app still apply the same rules. Find any rule in section 6 whose severity, scope or wording now differs between what section 7 (Editor) and section 8 (app) do with it; any limit stated in two places (section 3.5, the rules, the messages) that now differs; any requirement that names a rule or message ID the document does not define. A positive is a concrete pair of sentences that cannot both be true.*
