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
  version: "0.15.0"
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

- `<typecheck>`, `<lint>`, `<test>` — the build commands used to verify
  each fix. `n/a` means that check does not exist: skip it and say so
  in the report. Stop and ask to re-run `lodestar-setup` only when a
  command is missing from the table entirely.
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
   at a time. Optional fan-out:
   [references/fan-out.md](references/fan-out.md).
4. **Report** — [references/report.md](references/report.md). Session
   summary, archive run (Step 4a), dependency direction (Step 4b).

**Resuming** a previous run: [references/resume.md](references/resume.md).

---

## Rules

- **Read each item before acting.** The action item is the contract —
  not a category template. Per-item scope and `files:` bind the executor.
- **Scope rules are stop conditions.** Hitting one → `status: deferred`,
  never "ignore and proceed".
- **`requires_decision: true` always asks.** Even under a bulk pick.
- **Never modify the body of an action-item file.** Only frontmatter
  gains `status:`, `completed_at:`, `commit:`, `note:`. Problem / fix /
  scope / acceptance stay immutable.
- **Never delete an action-item file.** `done`/`skipped` move to
  `<output-root>/<RUN_ID>/done/`; deferred stay in the run root.
- **No `git add -A`.** Stage only the item's `files:`.
- **`## Dependency Direction` refresh is the one exception.** Step 4b may
  rewrite that `context.md` section on consent after an `imports` #3 fix,
  in its own commit — not scope-creep.
- **Stop conditions:**
  - No `INDEX.md` or no action-item files in the run directory.
  - Both `<typecheck>` and `<test>` are `n/a` or missing (one `n/a` just
    skips that check).
  - `check-freshness --facts commands` reports drift → point at
    `lodestar-setup`.
  - The user says stop.
