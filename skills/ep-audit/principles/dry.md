# Category: `dry`

Duplicated logic, structurally similar code, and "wide-diff" smell.
Mostly **semantic** — LLM-driven analysis, optionally seeded by a clone
detector. Action items in this category almost always require a human
or LLM to read the cited code and decide on the right shape; mark
`requires_decision: true` by default unless the duplication is exact and
trivial to extract.

Scope note: `dry` covers duplicated _behaviour_ (logic, functions, code
blocks). Duplicated _facts_ (constants, schemas, config values) belong
in `ssot` — see `principles/ssot.md`. The two failure modes differ:
`dry` violations cause churn (the same change made twice); `ssot`
violations cause drift (one copy updated, the other lags silently).

Fallow is the required detector — `fallow dupes` covers both A and B
with one invocation. The grep heuristic below seeds the semantic pass for B.

## What counts as a violation

### A. Exact or near-exact duplication — mechanical-leaning

Two or more blocks of ≥ 8 lines that are byte-identical or differ only in
identifier names. Classic copy-paste.

Risk: low-to-medium. Often safe to extract.

### B. Structurally similar code — semantic

Two or more functions / modules that solve the same problem with different
identifiers and surface details — same control flow, same shape, same
domain concept. Example: `formatUserAddress`, `formatBillingAddress`,
`formatShippingAddress` that share 90% of their body.

Risk: medium. The "missing abstraction" may genuinely have three legitimate
shapes; abstracting prematurely is worse than the duplication.

### C. Wide-diff smell — process-level (not source-detectable)

CLAUDE.md treats a change that touches 6+ unrelated files for one logical
change as a missing-abstraction signal. This is a **commit-level** check,
not a code-state check. Surface it as a single advisory action item that
points the reader at recent PR/commit history, not at source files.

Risk: low (advisory only).

## Detection

All commands below use placeholders resolved from the `## Package Layout`
table in `AGENTS.md` (see references/discover.md). Substitute before running.

### Preferred: fallow seed

If `.audit-fallow-seed.json` exists from Discover, parse `dupes.clone_groups[]`:

- Each entry is one clone family. Every `instances[]` item provides `file`,
  `start_line`, and `end_line`. Emit one finding per clone family for **A**.
- For **B**, run a second pass in semantic mode (catches renamed-variable /
  renamed-literal clones the default mild mode misses):

  ```bash
  node scripts/fallow-contract.mjs run \
    --root <repo> \
    --id dupes-semantic \
    --out <repo>/.audit-fallow-dupes-semantic.json
  ```

  Parse only a `kind: "dupes"`, `schema_version: 7` envelope; a contract
  failure stops the audit. Each `clone_groups[]` entry from
  this run that is **not** also present in the mild-mode output is a B-style
  finding. Match groups by `fingerprint`. Confirm by reading the bodies
  before flagging — semantic mode has more false positives than mild. Delete
  `.audit-fallow-dupes-semantic.json` after parsing.

### Grep seed for B

```bash
# B — semantic duplication. No shell command. Process:
#   For each package in <packages> (one at a time, to keep context manageable):
#     1. List exported functions and top-level utility functions in <pkg_root>.
#     2. Group them by name pattern (`formatX`, `validateX`, `parseX`, etc.).
#     3. For each group of 2+, read the bodies and decide:
#        - Same shape, different details → flag for extraction
#        - Different shapes that happen to share a name → no flag
#     4. Also scan for repeated patterns across packages — e.g. the same
#        validation logic copied across multiple packages' handler files.
#
#   Heuristic seed (used to focus the semantic pass on likely areas):
grep -rEn "^(export )?(async )?function [a-z][A-Za-z0-9_]+" \
  <all_pkg_roots> --include="*.ts" \
  | awk -F: '{print $1, $NF}' \
  | sort -k2 | uniq -d -f1
```

### C — wide-diff smell

Always done by hand, regardless of which detector ran above. No shell
command. Emit exactly one advisory action item that points the reader at:

```bash
git log --since="3 months" --oneline --shortstat
```

and asks them to flag any commit touching 6+ unrelated files where
the message describes one logical change.

## Action-item granularity

- **A** — one duplication group per item (all sites listed together; the
  fix is one extraction).
- **B** — one logical concept per item (e.g. "extract `formatAddress` from
  three call sites"). Cite all sites.
- **C** — exactly one advisory item per run, regardless of how many wide
  diffs are suspected. Don't enumerate; defer to human review of git log.

## Suggested fix shape

- **A** — extract to a shared helper. Pick the location based on call-site
  packages:
  - All sites in one package → extract to a private helper in that package.
  - Sites in multiple packages → extract to whichever package the call
    sites can both reach per the dependency direction (typically the
    shared / types package nominated in AGENTS.md `## Package Layout`).
    Replace each site with a call. Run `<typecheck>` and `<test>`.

- **B** — propose the abstraction with:
  1. The proposed signature.
  2. The proposed location (which package, justified by call-site reach).
  3. How each existing site maps to the new abstraction.
  4. Anything that doesn't fit (so the reader can decide whether the fit
     is actually clean enough — three sites _are_ what the Rule of Three
     prescribes; one or two is too soon).
     Mark `requires_decision: true` unless mapping #3 is 1-to-1 with no
     divergent paths.

- **C** — describe the pattern (recent commit X touched files A, B, C, D…
  for change Y; a missing abstraction is likely). Do not propose a fix —
  the value of the item is in surfacing the smell, not prescribing.

## Scope rules (must appear verbatim in generated action items)

- **A** — extraction must preserve behaviour. Update every cited call site
  in the same commit. No public API changes.
- **B** — if the proposed abstraction would have fewer than 2 confident
  call sites after the work, do not extract; record the duplication and
  wait for the third site (Rule of Three). Mark `requires_decision: true`.
- **C** — advisory only. No code changes prescribed by this action item.

## Acceptance check

- **A** — `<typecheck>` and `<test>` pass; the duplicated blocks are gone
  from every cited site.
- **B** — `<typecheck>` and `<test>` pass; the new abstraction is used by
  ≥ 2 call sites; the cited sites are simplified to call-only.
- **C** — none; this item is for human review.
