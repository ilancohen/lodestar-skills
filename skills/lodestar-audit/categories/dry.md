# Category: `dry`

Duplicated logic, structurally similar code, and "wide-diff" smell.
Mostly **semantic** — Fallow seeds candidates; bounded judgment confirms
structural clones. Action items in this category almost always require a
human or LLM to read the cited code and decide on the right shape; mark
`requires_decision: true` by default unless the duplication is exact and
trivial to extract.

Scope note: `dry` covers duplicated _behaviour_ (logic, functions, code
blocks). Duplicated _facts_ (constants, schemas, config values) belong
in `ssot`. The two failure modes differ:
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

The DRY principle treats a change that touches 6+ unrelated files for one logical
change as a missing-abstraction signal. This is a **commit-level** check,
not a code-state check. Surface it as a single advisory action item that
points the reader at recent PR/commit history, not at source files.

Risk: low (advisory only).

## Detection

All commands below use placeholders resolved from the `## Package Layout`
table in `context.md`. Substitute before running.

### Preferred: fallow seed

Parse `dupes.clone_groups[]` from `.audit-fallow-seed.json` (required):

- Each entry is one clone family. Every `instances[]` item provides `file`,
  `start_line`, and `end_line`. Emit one finding per clone family for **A**,
  filtered to the scan file list.
- For **B**, run a second pass in semantic mode (catches renamed-variable /
  renamed-literal clones the default mild mode misses):

  ```bash
  node scripts/fallow-contract.mjs run \
    --root <repo> \
    --id dupes-semantic \
    --out <repo>/.audit-fallow-dupes-semantic.json
  ```

  Parse only a `kind: "dupes"` envelope with the contracted
  `schema_version` (8 or newer); a contract failure **stops** the audit.
  Each `clone_groups[]` entry from this run that is **not** also present
  in the mild-mode output is a B-style candidate. Match groups by
  `fingerprint`. Confirm with a bounded judgment pass on the clone
  snippets only — semantic mode has more false positives than mild. Delete
  `.audit-fallow-dupes-semantic.json` after parsing.

### Grep seed for B

```bash
# B — semantic duplication. Cheap candidate collection in the orchestrator
# (no per-package sub-agent). Restrict to the scan file list:
#   1. List exported / top-level utility functions in those files.
#   2. Group by name pattern (`formatX`, `validateX`, `parseX`, etc.).
#   3. For each group of 2+, bounded judgment on the snippets only:
#        - Same shape, different details → flag for extraction
#        - Different shapes that share a name → no flag
#
#   Heuristic seed (focus the judgment pass):
#   node scripts/source-scan.mjs --pattern '^(export )?(async )?function ' \
#     --file <each scan path> --cwd <repo>
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
    sites can both reach per the Dependency Policy when present (typically the
    shared / types package nominated in `context.md` `## Package Layout`).
    Replace each site with a call. Run `<typecheck>` and `<test>`.

- **B** — propose the abstraction with:
  1. The proposed signature.
  2. The proposed location (which package, justified by call-site reach).
  3. How each existing site maps to the new abstraction.
  4. Anything that doesn't fit (so the reader can decide whether the fit
     is actually clean enough — identify duplication at two sites; extract
     at three unless immediate divergence risk has evidence).
     Mark `requires_decision: true` unless mapping #3 is 1-to-1 with no
     divergent paths.

- **C** — describe the pattern (recent commit X touched files A, B, C, D…
  for change Y; a missing abstraction is likely). Do not propose a fix —
  the value of the item is in surfacing the smell, not prescribing.

## Scope exceptions (item-specific only)

Do **not** copy this block into every action item. Put only unusual
overrides into `## Scope exceptions`.

- **A** — extraction must preserve behaviour; update every cited call site
  in the same commit; no public API changes unless Decision says otherwise.
- **B** — if the abstraction would have fewer than 3 confident call sites
  (and no evidence of immediate divergence risk), do not extract; record
  under Decision / Suggested fix (Rule of Three).
- **C** — advisory only; no code changes.

## Acceptance check

- **A** — `<typecheck>` and `<test>` pass; the duplicated blocks are gone
  from every cited site.
- **B** — `<typecheck>` and `<test>` pass; the new abstraction is used by
  ≥ 2 call sites; the cited sites are simplified to call-only.
- **C** — none; this item is for human review.
