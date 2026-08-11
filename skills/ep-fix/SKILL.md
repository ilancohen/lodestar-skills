---
name: ep-fix
description: >-
  Triages and executes action items produced by ep-audit. Use when asked to
  apply fixes from a docs/audit run, filter them by risk or category, or resume
  unfinished audit remediation. Updates item status, verifies changes, and can
  commit with consent. Modifies application source code.
license: MIT
compatibility: Requires git and the target repository's declared typecheck and test commands. Shell examples assume a POSIX-compatible environment.
metadata:
  author: Ilan Cohen
  version: "0.1.0"
---

You are running `ep-fix`. The job is to **triage** and **execute** the
action items produced by an `ep-audit` run, marking each with a status
so re-runs pick up where you left off. Unlike `ep-audit` (read-only)
and `ep-review-architecture` (read-only), this skill modifies
application source code.

This skill is the executive counterpart to the rest of the harness:

| Skill                   | Shape                                          | Modifies source? |
| ----------------------- | ---------------------------------------------- | ---------------- |
| `ep-setup`              | Descriptive — documents the layout             | No (writes config files) |
| `ep-audit`              | Prescriptive-local — one fix per finding       | No (writes `docs/audit/`) |
| `ep-review-architecture`| Advisory-global — one report on the layout     | No (writes `docs/architecture-review/`) |
| `ep-fix` (this)         | Executive — applies the audit's fixes          | **Yes** |

---

## Inputs

The skill operates on one `docs/audit/<RUN_ID>/` directory at a time.
Required contents:

- `INDEX.md` (written by `ep-audit`'s Plan phase).
- One or more `NNN-<category>-<slug>.md` action items.

If any are missing, stop and ask the user to run `ep-audit` first.

Capture from `AGENTS.md`:

- `<typecheck>`, `<lint>`, `<test>` — the build commands used to verify
  each fix. If any is missing, stop and ask the user to re-run
  `ep-setup`.

---

## Step 1 — Pick a run

1. List `docs/audit/*/` directories that contain at least one
   `NNN-<category>-<slug>.md` file **in the run root** (not under
   `done/`). Exclude `docs/audit/done/` itself.
2. An "unfinished" run is one where the run root (not the `done/`
   subfolder) still holds at least one action-item file. If exactly one
   run is unfinished, default to that. Otherwise list the unfinished
   runs and ask which one.
3. Print: "Working on `docs/audit/<RUN_ID>/`."

---

## Step 2 — Triage

Read `INDEX.md` and parse the frontmatter of every action-item file.
Build a summary:

- By category: count of items, broken down by status (`done` /
  `skipped` / `deferred` / `in_progress` / unstarted).
- By risk (`low` / `medium` / `high`).
- Count of `requires_decision: true` items.

Print the summary, then ask one question:

> Which items do you want to tackle this session?
>
> 1. All unstarted, low-risk items (skip `requires_decision: true`).
> 2. By category — pick which categories to include.
> 3. Decision pass — only `requires_decision: true` items (interactive).
> 4. A specific list of IDs.

For (1) and (2), order items by category in the suggested sequence
`imports → types → ssot → soc-yagni → boundaries → errors →
testability → dry → styling`, then by ID within each category. This order is
chosen so mechanical low-risk fixes land first and unblock the rest.

Items with `status: done` or `status: skipped` are never re-touched.
Items with `status: in_progress` from an earlier interrupted session
surface first (Step 4 — Resuming).

Ask one more question:

> Auto-commit each item as it's completed? (yes — one git commit per
> item / no — leave the diff staged for human review)

Hold the answer (call it `AUTO_COMMIT`) for use in Step 3.6.

---

## Step 3 — Execute

For each selected item, in the order from Step 2:

### Step 3.1 — Read the item

Open the `NNN-<category>-<slug>.md` file. Read every section:
problem, suggested fix, scope rules, acceptance check, files list.
The action item is the contract — do not apply a fix from memory or
from a category template.

### Step 3.2 — Decision gate

If `requires_decision: true`, print the problem statement and the
suggested fix. Ask: "Proceed? (yes / skip / defer)".

- `skip` → write `status: skipped` with a one-line `note:`, move the
  file to `docs/audit/<RUN_ID>/done/` (create the subfolder if
  needed), and move on.
- `defer` → write `status: deferred` with a `note:` describing the
  open question, and move on (leave the file in the run root).
- `yes` → proceed to Step 3.3.

For items where `requires_decision: false`, no question — proceed
directly.

### Step 3.3 — Mark in_progress

Update the item's frontmatter to add `status: in_progress`. This is
the checkpoint that makes the skill resumable: if interrupted, the
next session sees the in-progress item and offers to retry it.

### Step 3.4 — Apply the fix

Follow the **Suggested fix** section of the item exactly. Honor the
**Scope rules** verbatim — they're the stop conditions for this
item.

Do not edit any file not in the `files:` list. If the fix requires
touching a file outside that list, stop, set `status: deferred` with
`note: scope-creep — <files outside list>`, and move on.

### Step 3.5 — Acceptance check

Run the commands listed under **Acceptance check** in the item. By
default this is `<typecheck>` and (where the item requires it)
`<test>`.

**Batched mode (opt-in).** For categories where every item's
acceptance check is `<typecheck>`-only (typically `imports`, `types`,
`ssot`), the orchestrator may defer verification until the end of the
category batch — apply every item's edits, run `<typecheck>` once,
then proceed item-by-item. If the batched check fails, bisect:
re-apply per-item and re-run acceptance to identify the offender;
mark it `status: deferred` with the failure noted, and revert only
its diff.

Batched mode never applies when an item's acceptance check includes
`<test>` — those run per-item so a flaky test in one item doesn't
mask a real failure in another.

### Step 3.6 — Commit

If `AUTO_COMMIT == yes`:

```
git add <files from item>
git commit -m "<category>: <slug>

Closes docs/audit/<RUN_ID>/<NNN>-<category>-<slug>.md."
```

Use only the files listed in the item's `files:`. Never `git add -A`.

If `AUTO_COMMIT == no`, leave the diff staged or unstaged — whatever
the host's edit tool produced — and continue. The user will commit
manually.

### Step 3.7 — Mark done and move

Update the item's frontmatter:

```
status: done
completed_at: <YYYY-MM-DD>
```

If a commit was created, also write `commit: <short-sha>`. Append
nothing else; the body of the action item is the immutable record of
what was asked.

Then **move** the file into the `done/` subfolder:

```
mv docs/audit/<RUN_ID>/<NNN>-<category>-<slug>.md \
   docs/audit/<RUN_ID>/done/<NNN>-<category>-<slug>.md
```

Create `docs/audit/<RUN_ID>/done/` if it does not yet exist. This
keeps the run root to only unresolved items so future re-runs don't
have to scan completed work.

---

## Step 3a — (Optional) Sub-agent fan-out

If your host exposes a sub-agent tool (e.g. Claude Code's `Agent` /
`Task`), per-category execution parallelizes cleanly. Categories are
independent — an `imports` fix doesn't depend on a `boundaries` fix.
Skip this section if no sub-agent tool is available; the inline loop
in Step 3 is the canonical path.

Spawn one sub-agent per category with:

- The list of action-item file paths to process for that category.
- The full content of each action item (so the sub-agent doesn't need
  to re-read).
- The substituted `<typecheck>` / `<test>` commands.
- The `AUTO_COMMIT` choice.

Constraints sub-agents must obey (state these explicitly in every
spawn prompt):

- The action item is the contract. Scope rules are stop conditions;
  hitting one means `status: deferred`, never "ignore and proceed".
- No edits to files outside any item's `files:` list.
- No spawning further sub-agents — flat fan-out only.
- Return a JSON array of `{item_id, status, files_modified, commit_sha,
  notes}` records.

The orchestrator:

- Runs `<test>` once after all sub-agents return (sub-agents run
  `<typecheck>` per their batch but defer `<test>` to the
  orchestrator, since a single test failure may surface from
  cross-category interactions).
- Reassembles the global status table and prints the Step 4 report.

---

## Step 4 — Report

Print a session summary:

```
ep-fix session complete on docs/audit/<RUN_ID>/.

  done:       N
  deferred:   N
  skipped:    N
  remaining:  N

Of the deferred items, M hit scope-creep limits and N need a human
decision — see the note: field in each.

Next steps:
  - Re-run `ep-fix` to pick up where you left off.
  - Review deferred items individually; resolve the blocker and either
    re-run `ep-fix` (which will surface them) or remove the deferred
    status manually to retry.
```

### Step 4a — Promote a finished run

After printing the report, check whether the run root
`docs/audit/<RUN_ID>/` contains **no remaining action-item files**
(only `INDEX.md`, the `done/` subfolder, and possibly other
non-action-item files). If so, the run is fully resolved:

```
mv docs/audit/<RUN_ID>/ docs/audit/done/<RUN_ID>/
```

Create `docs/audit/done/` if it does not exist. Print:

```
All items resolved. Run archived to docs/audit/done/<RUN_ID>/.
```

If any action-item files remain in the run root (deferred or
unstarted), skip this step and leave the run in place.

---

## Resuming

`ep-fix` is restartable. Re-running against the same run directory:

1. Files already moved to `docs/audit/<RUN_ID>/done/` are never
   re-touched — their absence from the run root is the signal.
2. Items with `status: in_progress` in the run root surface first. For
   each, print the item and the git diff (if any) and ask: "retry /
   mark done / revert and defer". Retry re-applies the fix from
   scratch (any partial diff must be reverted first); "mark done"
   trusts the existing diff and then moves the file to `done/`;
   "revert and defer" rolls back and writes `status: deferred` (leaves
   the file in the run root).
3. Items with `status: deferred` in the run root surface next. Ask:
   "Has the blocker been resolved? (retry / skip / leave deferred)".
4. Unstarted items follow as in a fresh session.

---

## Rules

- **Read each item before acting.** The action item file is the
  contract. Don't apply a fix from a category template — the per-item
  scope and files list are the only things the executor is bound by.
- **Scope rules are stop conditions.** Hitting one means
  `status: deferred`, never "ignore and proceed".
- **`requires_decision: true` always asks.** Even when the user picked
  "all unstarted items", these surface for confirmation.
- **Never modify the body of an action-item file.** Only the
  frontmatter gains `status:`, `completed_at:`, `commit:`, and `note:`
  fields. The problem / fix / scope-rules / acceptance sections are
  immutable historical record.
- **Never delete an action-item file.** Finished items (`done` or
  `skipped`) are moved to `docs/audit/<RUN_ID>/done/` — they stay as
  a record. Deferred items remain in the run root until resolved.
- **No `git add -A`.** Stage only the files listed in the item's
  `files:`. The audit's per-item granularity is the whole point —
  preserve it in the commit history.
- **Stop conditions:**
  - The run directory has no `INDEX.md` or no action-item files.
  - `<typecheck>` or `<test>` is not declared in `AGENTS.md`.
  - The user says stop.
