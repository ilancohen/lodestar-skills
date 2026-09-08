---
name: lodestar-fix
description: >-
  Triages and executes action items produced by lodestar-audit. Updates item
  status, verifies changes, and can commit with consent. Modifies application
  source code. Do not load unless the user explicitly invokes lodestar-fix by
  name.
disable-model-invocation: true
license: MIT
compatibility: Requires git and the target repository's declared typecheck and test commands (`n/a` skips that check). Lockfiles detect npm, pnpm, yarn, and Bun; other managers via context.md. No Deno or Bazel. Shell examples assume a POSIX-compatible environment.
metadata:
  author: Ilan Cohen
  version: "0.17.0"
---

You are running `lodestar-fix`. The job is to **triage** and **execute** the
action items produced by a `lodestar-audit` run, marking each with a status
so re-runs pick up where you left off. This skill modifies application source
code.

Scripts live beside this `SKILL.md` under `scripts/`. Keep the process
cwd as the target repository. Invoke scripts with an absolute path to
that file (or `node <skill-dir>/scripts/<name>.mjs`). `--file` and
`--run-dir` are paths in the target repository. Use them for status
writes and file moves instead of POSIX `mv`.

---

## How to talk to the user

Anything you print or ask is read by a person who is skimming. The Step 4 report and commit messages keep their given shape.

- Ask one clear question at a time. Say what happens for each answer.
- Describe a fix by what it changes, not by its category key or item id.
- Keep status values out of questions — say "left for later", not "deferred".
- Never trim or postpone a warning.
- Point first. Bullets, not paragraphs. Blank line between blocks.
- Bold the first few words of each bullet.

### Milestones

Concise chat progress — not diagnostic logs or run files:

- **Opening** — selected items, output path, checks, mutation/commit policy
- **Before long work** — current item
- **At boundaries** — done/skipped/deferred counts and next item
- **Closing** — artifacts, skipped coverage, actionable failures

---

## Inputs

The skill operates on one `<output-root>/<RUN_ID>/` directory at a time
(`outputRoot` from `node <lodestar-audit-skill>/scripts/audit-state.mjs
validate-input --root <repo>`, default `docs/audit`). Substitute that
value for the output directory — do not hardcode `docs/audit`.
Required contents:

- `INDEX.md` (written by `lodestar-audit`'s Plan phase).
- One or more `NNN-<category>-<slug>.md` action items.

If any are missing, stop and ask the user to run `lodestar-audit` first.

Capture from the same `validate-input` payload:

- `outputRoot` — where audit runs land.
- `git` — commit policy. Every key is populated; a missing git row in
  `## Audit Configuration` yields today's defaults (`commits: ask`, subject
  `<category>: <slug>`, trailer `Closes <item>.`, no protected
  branches, `require-clean: no`).

Capture from `.agents/lodestar/context.md` (the file `lodestar-setup`
writes; `AGENTS.md` is not read):

- `<typecheck>`, `<lint>`, `<test>` — context build commands. `n/a`
  skips that command when an item's acceptance names it. The item's
  **Acceptance check** is the contract; stop only when that section
  names no usable method.
- `## Package Layout` — the Package and Path glob(s) columns, read only
  when Step 2's "By area" option is chosen. A missing table does not
  stop the skill.

Then run command-only freshness (layout facts are not this skill's):

```text
node <lodestar-audit-skill>/scripts/audit-state.mjs check-freshness --root <repo> --facts commands
```

Exit 2: stop. Name the stale command and point at `lodestar-setup`.
`n/a` is not drift. Do not run a layout check.

---

## Step 1 — Pick a run

**Git preconditions** (before applying anything):

1. If `git.requireClean` is `yes`, run `git status --porcelain`. A
   dirty tree → **stop**. Name the dirty files. Do not pick a run.
2. If the current branch (`git branch --show-current`) is in
   `git.protected` and `git.commits` is not `never`, **stop** and offer
   to continue this session without committing. On yes, set
   `sessionCommits = never` for the rest of the session — do not write
   `context.md`. On no, stop entirely. Otherwise
   `sessionCommits = git.commits`.

Then:

1. List `<output-root>/*/` directories that contain **both** `INDEX.md` and
   at least one `NNN-<category>-<slug>.md` file **in the run root** (not
   under `done/`). Exclude `<output-root>/done/` itself. Never offer a run
   that lacks `INDEX.md`.
2. An "unfinished" run is one where the run root (not the `done/`
   subfolder) still holds at least one action-item file. If exactly one
   run is unfinished, default to that. Otherwise list the unfinished
   runs and ask which one. If no candidate run qualifies, say so and
   point the user at `lodestar-audit`'s Plan phase.
3. Print: "Working through the fixes in `<output-root>/<RUN_ID>/`."

---

## Steps

References load one hop from this file; a reference must not load another.

If the run root has `in_progress` or `deferred`, load
[references/resume.md](references/resume.md) first.

2. **Triage** — [references/triage.md](references/triage.md). Choose the
   batch and set `AUTO_COMMIT`.
3. **Execute** — [references/execute.md](references/execute.md). One item
   at a time, serially. No mutating sub-agent fan-out.
4. **Report** — [references/report.md](references/report.md). Session
   summary, archive run (Step 4a); do not refresh Dependency Policy
   (Step 4b).

**Resuming** a previous run: [references/resume.md](references/resume.md).

---

## Rules

- **Read each item before acting.** The action item is the contract —
  evidence, files, requested change, decision, scope exceptions, and
  acceptance. Do not load whole category documents; the item must stand
  alone with these resident rules.
- **Resident safety (always).** Apply unless the item's **Scope
  exceptions** or **Acceptance check** override them:
  - Edit only paths in `files:` (plus paths named in Scope exceptions).
  - Do not rewrite unrelated dirty hunks; stop on dirty listed files.
  - Never `git add -A`; stage only the item's files.
  - Honor stop conditions in Scope exceptions; hitting one → `deferred`.
  - Run the item's Acceptance check; when it names `<typecheck>` /
    `<lint>` / `<test>`, use context commands (`n/a` skips that cell).
  - One concern per item — do not expand into multi-stage redesign
    (`lodestar-plan`).
- **Scope exceptions are stop conditions.** Hitting one → `status: deferred`,
  never "ignore and proceed".
- **`requires_decision: true` always asks.** Even under a bulk pick. Use
  the item's **Decision** section when present.
- **Never modify the body of an action-item file.** Only frontmatter
  gains `status:`, `completed_at:`, `commit:`, `note:`. Problem / fix /
  scope / acceptance stay immutable.
- **Never delete an action-item file.** `done`/`skipped` move to
  `<output-root>/<RUN_ID>/done/`; deferred stay in the run root.
- **No `git add -A`.** Stage only the item's `files:`. Never stage a
  whole dirty file that already had unrelated edits.
- **Never rewrite Dependency Policy from observation.** Step 4b does not
  refresh `context.md` from the live import graph after cycle fixes.
- **Stop conditions:**
  - No `INDEX.md` or no action-item files in the run directory.
  - The item's acceptance method is empty or unusable (no command and no
    deterministic inspection named in the item).
  - `check-freshness --facts commands` reports drift → point at
    `lodestar-setup`.
  - The user says stop.
  - A `files:` path already has unrelated uncommitted changes the user
    has not resolved.
