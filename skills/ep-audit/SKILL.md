---
name: ep-audit
description: >-
  Audits a codebase against the engineering principles documented by ep-setup
  and writes self-contained findings and action items under docs/audit/. Use
  when asked to find architecture, boundary, duplication, type, error-handling,
  testability, or styling violations. Discovery only; never modifies
  application source. Restartable from findings.md.
license: MIT
compatibility: Requires git, a POSIX-compatible shell, Node.js, and Fallow installed in the target project or available on PATH. Designed for JavaScript/TypeScript repositories.
metadata:
  author: Ilan Cohen
  version: "0.1.0"
---

You are running an engineering-principles audit. Your job is to **discover**
and **document** violations as self-contained action items, **not to fix them**.

The output is a directory of `.md` files — one per violation — that the
user can triage, hand to LLMs, file as tickets, or ignore. Each action-item
file must stand on its own: an agent reading only that one file should have
everything needed to land the fix.

---

## Structure model

This audit is **structure-agnostic**: it does not assume a fixed list of
roles (`core`, `api`, `ui`, `shared`, `infra`, `apps`). It reasons about
the codebase using two things from `AGENTS.md`:

1. The `## Package Layout` table — every package the audit should scan,
   with the repo's own names, paths, aliases, and a one-sentence
   responsibility per package.
2. The dependency direction declared above the table — the allowed
   import direction between those packages.

All detectors run package-by-package across the table's rows. Where a
principle (e.g. "no business logic in HTTP routes") talks about a
particular *kind* of code, the audit relies on the Responsibility column
plus path-pattern signals — never on package name alone.

---

## Two-phase structure

The audit has two phases, run back-to-back in a single invocation by default:

```
Phase 1 — DISCOVER     →  docs/audit/<RUN_ID>/findings.md
Phase 2 — PLAN         →  docs/audit/<RUN_ID>/INDEX.md + NNN-….md files
```

`findings.md` is the seam:

- Discover writes one finding block per violation. It does **not** write
  per-violation action-item files.
- Plan reads every finding block and expands it into a full action item.
- A human can edit `findings.md` between phases (delete false positives,
  mark items as `requires_decision: true`, add notes). Do this when the
  run is large and you want to triage before producing action items.
- Both phases are **restartable**: if interrupted, re-run with the same
  `<RUN_ID>` and the skill resumes from where it stopped.

---

## Inputs

Before you start, confirm these exist. If any is missing, stop and tell the
user to run `/ep-setup` first:

- `AGENTS.md`
- `CLAUDE.md`
- `.agents/skills/README.md`

Read `.agents/skills/README.md` to absorb project-specific principles
(coverage floors, branded-type conventions, the canonical anti-pattern
table).

Read `AGENTS.md` to capture:

1. The exact `<typecheck>`, `<lint>`, and `<test>` commands.
2. The dependency direction (a chain of package names).
3. The `## Package Layout` table — every row, with package name, path
   glob, import alias, and one-sentence responsibility. This is the only
   place the audit learns about the repo's structure.

If `AGENTS.md` is missing the `## Package Layout` table, or any row is
missing a Responsibility, stop and tell the user to re-run
`ep-setup`. The audit cannot reason about boundaries
without a responsibility per package.

**Responsibility quality check.** Every row's Responsibility must be a
real one-sentence description. Reject the table and stop with a clear
error if any row's Responsibility is:

- shorter than 20 characters,
- still a template placeholder (matches `^\[.*\]$` or contains the
  literal string `one sentence`, `TODO`, `TBD`, or `???`),
- a single noun without a verb-like clause (e.g. just `core`, `shared`,
  `stuff`).

Tell the user: "Package `<name>` has no real Responsibility. Re-run
`ep-setup` and write a concrete one-sentence
description (e.g. `HTTP routes and request validation`,
`domain entities and use cases`, `DB and queue adapters`). The audit
relies on this column to judge boundary findings and won't run with a
placeholder."

---

## Categories

Each violation belongs to exactly one category. The category selects the
sub-doc with detection commands, fix recipes, and scope rules:

| Category | Sub-doc | Risk | Detection style |
|---|---|---|---|
| `imports` | `principles/imports.md` | low | mechanical (fallow preferred, grep fallback) |
| `types` | `principles/types.md` | low | mechanical |
| `boundaries` | `principles/boundaries.md` | medium–high | mechanical |
| `errors` | `principles/errors.md` | high | mechanical |
| `testability` | `principles/testability.md` | high | mechanical |
| `soc-yagni` | `principles/soc-yagni.md` | low–high | mostly mechanical (fallow seeds the semantic file/class SoC pass) |
| `dry` | `principles/dry.md` | low–medium | mostly semantic; fallow `dupes` required for A, grep seed for B |
| `ssot` | `principles/ssot.md` | low–medium | mechanical (literal / schema / config clustering greps) |
| `styling` | `principles/styling.md` | low–medium | mechanical (grep for inline `style={{...}}`, raw colour / spacing literals, duplicated class bodies) |

Read each sub-doc before scanning that category. There is also a
companion sub-doc `principles/fallow-seed.md` describing the required
[fallow](https://docs.fallow.tools) pre-pass — read it once before Step 1.2.

### Known blind spots

These are not covered by detectors and require human judgment over time:

- **Coverage floor** (80% for domain/shared packages, integration tests
  for HTTP/UI packages). Detect only if the repo's `<test>` command emits
  a coverage report; otherwise emit a single advisory action item under
  `testability` pointing the reader at the coverage tool.
- **Wide-diff DRY** — covered as an advisory item under `dry.C` only.
- **Rule of Three at implementation time** — partially captured by
  `soc-yagni.D` (single-call-site exports). The rest is a process rule
  enforced by code review, not by the audit.
- **Architecture itself** — whether the documented layout is the right
  one is out of scope for this audit. The `ep-review-architecture` skill
  exists for that question.

Generated `INDEX.md` should list these blind spots so a reader doesn't
mistake a clean run for "no principle violations exist".

---

## Output Location

```
docs/audit/<RUN_ID>/
  findings.md        ← Phase 1 output, parsed by Phase 2
  INDEX.md           ← Phase 2 output, the landing page
  001-<category>-<slug>.md
  002-…
  …
```

`<RUN_ID>` is the UTC date `YYYY-MM-DD` (e.g. `2026-05-15`) for the
first run on that day. If the directory already exists, append a
zero-padded same-day counter starting at `-002`:

```
docs/audit/2026-05-15/        ← first run that day
docs/audit/2026-05-15-002/    ← second run same day
docs/audit/2026-05-15-003/    ← third run same day
```

Resolve `<RUN_ID>` by listing the existing entries under `docs/audit/`
that match today's date and picking the next free slot (`YYYY-MM-DD` if
free, otherwise the lowest `YYYY-MM-DD-NNN` ≥ `002` that isn't taken).
Never overwrite a previous run's output.

---

## Phase 1 — Discover

### Step 1.0 — Resolve the package set

Before running any detection command, build a working representation of
the repo's layout from `AGENTS.md`:

- `<typecheck>`, `<lint>`, `<test>` — from the Build & Test table.
- `<packages>` — the ordered list of rows from `## Package Layout`. For
  each row capture `{name, path, alias, responsibility}`.
- `<direction>` — the dependency-direction chain (a list of package
  names, leftmost = top of the chain).
- `<all_pkg_roots>` — every `path` from `<packages>`, space-separated.

Detector sub-docs use these placeholders:

| Placeholder | Resolved to |
|---|---|
| `<typecheck>`, `<lint>`, `<test>` | The actual commands |
| `<pkg_root>` | The current row's `path` when iterating package-by-package |
| `<pkg_alias>` | The current row's `alias` |
| `<pkg_responsibility>` | The current row's `responsibility` (one sentence) |
| `<all_pkg_roots>` | Space-separated path globs (every package's path) |
| `<alias_prefix>` | The longest common prefix of all aliases (e.g. `@repo/`); if there is no common prefix, run the relevant grep once per alias |
| `<pkg_manager>` | Detected from lock files at repo root: `pnpm-lock.yaml` → `pnpm`; `yarn.lock` → `yarn`; `bun.lockb` → `bun`; else `npm` |
| `<run>` | Derived from `<pkg_manager>`: `npm` → `npx`; `pnpm` → `pnpm dlx`; `yarn` → `yarn dlx`; `bun` → `bunx` |

Rules:

- Substitute placeholders literally. If a sub-doc says
  `grep -rEn "..." <pkg_root>`, run the command once per package, with
  `<pkg_root>` resolved to that package's `path`.
- Substitute aliases the same way. If a sub-doc says
  `from '<pkg_alias>'`, search for the actual alias string
  (e.g. `from '@repo/core'`).
- The substituted commands are what run; never run the literal
  `<placeholder>` form.
- The Responsibility column is *advisory context* for judgment-based
  detectors (e.g. `boundaries.B` — misplaced business logic) — agents
  read it to decide whether a hit is real. The audit does not pattern-
  match against the responsibility text.

### Step 1.1 — Plan the run

1. Detect any in-progress run from earlier today. List
   `docs/audit/YYYY-MM-DD*/` directories where `findings.md` exists but
   `INDEX.md` does not (or where `findings.md` has unfinished category
   markers). If any are found, name the most recent one by its directory
   name and ask: "Resume that run? (yes / start a fresh run)"
2. Compute `<RUN_ID>` per the rule in the **Output Location** section
   above: `YYYY-MM-DD` if free, else next free `YYYY-MM-DD-NNN` starting
   at `002`. Print: "Output → `docs/audit/<RUN_ID>/`."
3. List the categories you will scan. Ask: "Proceed? (yes / pick a subset)"
4. Wait for confirmation. If the user picks a subset, run only those
   categories.

When resuming, do not re-run categories that already have a
`## category: <name> — complete` line in findings.md.

### Step 1.1a — Fallow seed (required pre-pass)

Read `principles/fallow-seed.md` once. Fallow is required — run the seed
command described in that file and cache the JSON in memory (or write it to
`.audit-fallow-seed.json` at the repo root and delete it at the end of
Phase 1). Each category's mechanical detector consumes the relevant slice
of this JSON.

If fallow is not available or exits with an error, **stop** and tell the
user:

> fallow is required for this audit.
> Install the latest version as a devDependency at the workspace root.
> Then re-run.

The seed never modifies source code. The transient
`.audit-fallow-seed.json` is the only filesystem write outside `docs/audit/`
this skill performs; delete it after Phase 1 completes.

### Step 1.2 — Mechanical pass

For each category whose detection style is `mechanical`, in this order:

1. `imports`
2. `types`
3. `boundaries`
4. `errors`
5. `testability`
6. `soc-yagni` (mechanical detectors B, C, D only)
7. `dry` (detector A only — uses the fallow seed)
8. `ssot` (detectors A, B, C — all mechanical greps)
9. `styling` (detectors A, B, C, D — all mechanical greps; UI-bearing packages only)

For each category:

1. Open the category sub-doc.
2. Run every `Detection` shell command listed under it. Where the sub-doc
   iterates per package (e.g. `<pkg_root>`), run the command once per row
   in `<packages>`.
3. For each raw hit, decide whether it's a real violation. False positives
   to drop:
   - Hits in test files (`*.spec.ts`, `*.test.ts`) unless the sub-doc says
     otherwise.
   - Hits in generated code or `*.d.ts` files.
   - `eslint-disable`-guarded `any` (types).
4. Append a finding block to `findings.md` (see format below) for each
   real violation.
5. After the category is done, append a marker line so the run is
   resumable: `## category: <name> — complete (N findings)`.

Do not modify any application source code under any circumstance. The skill
is read-only outside `docs/audit/`.

### Step 1.2a — (Optional) Sub-agent fan-out for the mechanical pass

If your host exposes a sub-agent tool (e.g. Claude Code's `Agent` /
`Task`, an SDK-level subagent runner), the per-package mechanical scans
can be parallelized. Skip this step entirely if no sub-agent tool is
available — the inline loop in Step 1.2 is the canonical path.

When to fan out:

- The repo has 4+ packages in `<packages>`, **and**
- The orchestrator's context is already pressured by reading every
  `principles/*.md` sub-doc plus the fallow seed.

Below that bar, the inline loop is faster.

How to fan out:

1. Spawn one sub-agent per package (not per category — keeping each
   sub-agent scoped to one filesystem subtree is the whole point).
2. The sub-agent's prompt must contain:
   - The package row it owns (`name`, `path`, `alias`, `responsibility`).
   - The list of categories to run.
   - The relevant `principles/<category>.md` content **with placeholders
     already substituted** (`<typecheck>`, `<pkg_root>`, `<pkg_alias>`,
     `<all_pkg_roots>`, `<alias_prefix>`, `<pkg_manager>`, `<run>`
     resolved from Step 1.0).
   - The exclusion list (test files, generated code, `*.d.ts`).
3. Required return shape — a JSON array of finding objects with the
   same fields used by `findings.md` blocks (`category`, `subtype`,
   `files`, `evidence`, `scope_unit`, `requires_decision`, `notes`).
   The sub-agent **does not write to `findings.md`** — only the
   orchestrator writes.

Rules sub-agents must obey (state these explicitly in every spawn prompt):

- Read-only. No source-file edits, no writes outside the structured
  return value. The audit's read-only rule applies inside every
  sub-agent.
- No Fallow re-invocation — the seed is already in the
  orchestrator's hand; pass the relevant slice in the prompt.
- Report partial work. If a category fails (e.g. a grep errors out),
  return what's been collected and name the failure in `notes:`.

After all sub-agents return:

- Merge findings into `findings.md` in the canonical category order from
  Step 1.2 (don't preserve sub-agent return order — it's nondeterministic).
- Reassign finding IDs sequentially (`F0001`, `F0002`, …) in the
  orchestrator. Sub-agents may use placeholder IDs; the orchestrator
  rewrites them on merge.
- For every (package × category) pair with no result, append a
  `## skipped: <category> in <package> — sub-agent did not return` line
  to `findings.md` so the gap is auditable. Never silently drop.

### Step 1.3 — Semantic pass

For each category that has semantic detectors (`soc-yagni.A`, `dry.B`,
`dry.C`):

1. Read the relevant sub-doc detector description.
2. Work **one package at a time** to keep context tight. Iterate over each
   row in `<packages>`.
3. For each package:
   - **`soc-yagni.A`** (file/class responsibilities): for each non-trivial
     source file (≥ 30 lines, not a re-export, not type-only), summarize
     its responsibility in one sentence. Compare against the package's
     Responsibility from AGENTS.md. If the file's responsibility needs
     "and", or describes work outside the package's stated responsibility,
     write a finding.
   - **`dry.B`** (structural duplication): list exported functions and
     top-level utilities. Group by name pattern. For each group of 2+,
     read the bodies and decide. The heuristic grep in `principles/dry.md`
     gives a starting seed — confirm with eyes-on-code before flagging.
   - **`dry.C`** (wide-diff): emit exactly one advisory finding per run
     pointing the reader at recent git history. Do this once, not per
     package.
4. After each package, append `## category: <name>/<package> — complete`.

Semantic findings cite the file(s) and a short excerpt, exactly like
mechanical ones. They differ only in that the executor is being told to
read the code and apply judgment, not to apply a one-liner fix.

**Sub-agent fan-out for the semantic pass (recommended when available).**
The semantic pass is the most context-heavy phase of the audit — each
package's responsibility analysis requires reading every non-trivial
source file in that package. If a sub-agent tool is available, this is
the strongest case for using it. Spawn one sub-agent per package with:

- The package row (`name`, `path`, `alias`, `responsibility`).
- The detector descriptions for `soc-yagni.A` and `dry.B` from this
  SKILL.md (Step 1.3, items 3a–3b above).
- The fallow `health.findings[]` slice for that package (if the seed
  ran), so the sub-agent walks complexity hotspots rather than every file.
- Instruction to return a JSON array of `{file, finding, evidence,
  scope_unit, requires_decision, notes}` objects.

Sub-agent rules from Step 1.2a apply identically: read-only, structured
return only, partial-work reporting, no source modifications. `dry.C`
(wide-diff smell) is **not** fanned out — it's a single advisory
finding per run, emitted by the orchestrator after reading
`git log --since="3 months" --oneline --shortstat`.

After all sub-agents return, the orchestrator merges, reassigns IDs,
and appends per-package completion markers as in the inline path.

### Step 1.3a — Placeholder-leak check

Before concluding Phase 1, scan the written `findings.md` for any
unresolved `<placeholder>` markers. A leak means a substitution from
Step 1.0 was missed and the executor will see template text instead of
real values.

```bash
grep -nE "<(typecheck|lint|test|pkg_root|pkg_alias|pkg_responsibility|all_pkg_roots|alias_prefix|pkg_manager|run|RUN_ID)>" \
  docs/audit/<RUN_ID>/findings.md
```

Any match is a bug. Fix the offending block in-place (re-resolve the
placeholder from `AGENTS.md`) before proceeding to Phase 2. Do not paper
over by deleting the placeholder text.

The same check runs again at the end of Phase 2 against every generated
action-item file — see Step 2.3a.

### Step 1.4 — Conclude Phase 1

Print:

```
Discover complete. Wrote N findings to docs/audit/<RUN_ID>/findings.md.

  imports:      N
  types:        N
  boundaries:   N
  errors:       N
  testability:  N
  soc-yagni:    N
  dry:          N
  ssot:         N
  styling:      N

Review findings.md if you want to triage before action items are produced.
Edit, delete, or annotate freely — the next phase parses this file.

Proceed to Phase 2 (write action items) now? (yes / pause)
```

If the user pauses, stop. The run is resumable: invoking the skill again
with the same `<RUN_ID>` will skip Discover (it's already complete) and
go straight to Plan.

---

## findings.md format

```markdown
# Audit findings — <RUN_ID>

Generated by ep-audit. One block per detected
violation. Edit freely before Phase 2 — false positives can be removed
by deleting the block.

## category: imports — complete (4 findings)

### F0001
- category: imports
- subtype: cross-package-src
- package: server
- files:
  - packages/server/src/routes/users.ts:12
- evidence: |
    import { userService } from '@repo/core/src/user/user.service';
- scope_unit: one-file
- requires_decision: false
- notes: |

### F0002
- category: imports
- subtype: wrong-direction
- package: core
- files:
  - packages/core/src/billing/refunds.ts:3
- evidence: |
    import { httpClient } from '@repo/server';
- scope_unit: one-file
- requires_decision: true
- notes: |
    `core` importing from `server` violates the declared direction
    web → server → core → shared.

## category: types — complete (0 findings)

…
```

Rules for the format:

- Finding IDs are `F` + four-digit sequential numbers across the whole run.
- `category`: one of the nine from the table above.
- `subtype`: the letter/sub-task identifier from the sub-doc
  (e.g. `cross-package-src`, `branded-primitive-missing`, `cqs-violation`,
  `getter-chain`, `responsibility-overload`).
- `package`: the package name from `<packages>` whose `<pkg_root>` produced
  the hit. Optional for findings that span multiple packages (e.g. wide-diff
  advisory) — omit the field in that case.
- `files`: list of `path:line` entries. Multiple OK.
- `evidence`: short literal excerpt or a one-sentence summary (semantic
  findings). Block-style `|` so newlines are preserved.
- `scope_unit`: `one-file`, `one-package`, `one-function`, `one-entity`,
  `one-class`, `one-symbol`, `advisory`. Plan phase uses this to decide
  action-item granularity.
- `requires_decision`: `true` whenever the sub-doc's stop conditions
  apply, or whenever the fix needs a judgment call. Default `false` for
  mechanical fixes, `true` for semantic ones unless the fix is obvious.
- `notes`: free text. Plan phase will fold these into the action item.

---

## Phase 2 — Plan

### Step 2.1 — Read findings.md

Parse every `### F<NNNN>` block. Group by `scope_unit`:

- Bundle multiple findings that share the same scope unit when the fix is
  one commit (e.g. two `cross-package-src` lines in the same file → one
  action item, both lines listed in `files:`).
- Otherwise, one action item per finding.

Assign action-item IDs as three-digit sequential numbers (`001`, `002`, …),
ordered by category (in the table order) then by file path. The action
item ID is independent of the finding ID — one action item may absorb
multiple findings.

### Step 2.2 — Write action items

For each action item, write `docs/audit/<RUN_ID>/<NNN>-<category>-<slug>.md`
using `templates/action-item.md`. Fill every section. The fix steps, scope
rules, and acceptance check come verbatim from the matching
`principles/<category>.md` sub-doc, substituting the real
`<typecheck>` / `<lint>` / `<test>` commands.

Slugs are kebab-case, ≤ 5 words.

If `docs/audit/<RUN_ID>/NNN-….md` already exists from an earlier interrupted
Plan pass, skip it — don't overwrite. The run is resumable.

### Step 2.2a — Placeholder-leak check (per file)

After writing each action item, re-run the placeholder check against the
freshly written file:

```bash
grep -nE "<(typecheck|lint|test|pkg_root|pkg_alias|pkg_responsibility|all_pkg_roots|alias_prefix|pkg_manager|run|RUN_ID)>" \
  docs/audit/<RUN_ID>/<NNN>-<category>-<slug>.md
```

If anything matches, the substitution from `principles/<category>.md`
left a placeholder behind. Fix in place before moving to the next action
item — the generated file is supposed to be self-contained, and
unresolved `<…>` markers will confuse the executor.

### Step 2.3 — Write INDEX.md

Use `templates/index.md`. Include:

- Run ID (the directory name).
- Commands (from `AGENTS.md`).
- Summary stats: total items, breakdown by category, breakdown by risk,
  count of `requires_decision: true`.
- A row per action item: ID, category, risk, one-line scope, file link.
- Known blind spots section (paste from this SKILL.md's "Known blind spots"
  subsection above).

### Step 2.4 — Report

Print:

```
Audit complete. Wrote N action items to docs/audit/<RUN_ID>/.

  imports:      N
  types:        N
  boundaries:   N
  errors:       N
  testability:  N
  soc-yagni:    N
  dry:          N
  ssot:         N
  styling:      N

Of these, M are flagged `requires_decision: true` — human review before
automation.

Next steps:
  - Review docs/audit/<RUN_ID>/INDEX.md
  - Hand individual files to an LLM with: "Read <file>. Implement it. Run
    [typecheck] and [test] before committing."
  - Or triage manually.
```

---

## Rules

- **Read-only.** This skill never modifies application source code; only
  writes into `docs/audit/`. The single exception is the transient
  `.audit-fallow-seed.json` cache (see Step 1.1a) — created at the repo
  root if `fallow` is available, deleted at the end of Phase 1, and never
  intended to be committed.
- **One concern per action item.** If you find yourself writing "and also…"
  in the problem statement, split the action item.
- **Self-contained.** Each action item must include all the context a
  fresh agent would need: the principle violated, exact file(s), the
  suggested fix, scope rules, acceptance check, and a ready-to-paste
  prompt. No "see the audit skill" references in generated files — the
  audit skill won't be available to the executor.
- **Substitute every placeholder.** When a template or sub-doc uses
  `<typecheck>`, `<pkg_root>`, `<pkg_alias>`, etc., resolve to the real
  value from `AGENTS.md` (Build & Test table or the current row of
  `## Package Layout`). No `<bracketed>` placeholders may leak into
  generated `findings.md`, `INDEX.md`, or `NNN-….md` files. Step 1.3a
  and Step 2.2a re-check for this; treat any hit as a bug.
- **Tag every action item.** `requires_decision: true` is the right
  default for semantic findings unless the fix is obvious.
- **Don't fix.** Even if a violation is trivial, do not modify source.
  The user controls when fixes happen.
- **Don't second-guess the layout.** If a finding only makes sense
  under a different package layout, write it anyway scoped to the
  current layout — and add a `notes:` line suggesting the user run
  `ep-review-architecture`. The audit never proposes layout changes.
- **Stop conditions:** the codebase has zero files in any of the
  documented package paths; required commands from `AGENTS.md` don't
  exist; the user says stop.

---

## Re-running

Each run gets its own dated directory (`YYYY-MM-DD` for the first run
that day, `YYYY-MM-DD-NNN` for subsequent same-day runs). Past runs are
never modified. To resume an interrupted run, invoke the skill again —
Step 1.1 detects in-progress runs from earlier today and offers to
resume, picking up from the last completed checkpoint in `findings.md`
(Phase 1) or from the last written action item (Phase 2). A
`findings.md` whose sections all end with `— complete` triggers Plan
directly; Discover is skipped.

To re-run only Plan (e.g. after manually editing `findings.md`), keep
`findings.md` in place and delete any `NNN-….md` and `INDEX.md` in the
run directory before re-invoking.
