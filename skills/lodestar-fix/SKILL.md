---
name: lodestar-fix
description: >-
  Triages and executes action items produced by lodestar-audit. Updates item
  status, verifies changes, and can commit with consent. Modifies application
  source code. Do not load unless the user explicitly invokes lodestar-fix by
  name.
disable-model-invocation: true
license: MIT
compatibility: Requires git and the target repository's declared typecheck and test commands (`n/a` skips that check). npm, pnpm, yarn, and Bun are detected from lockfiles; any other manager works when recorded in context.md. Deno and Bazel are not supported. Shell examples assume a POSIX-compatible environment.
metadata:
  author: Ilan Cohen
  version: "0.11.1"
---

You are running `lodestar-fix`. The job is to **triage** and **execute** the
action items produced by a `lodestar-audit` run, marking each with a status
so re-runs pick up where you left off. Unlike `lodestar-audit` (read-only)
and `lodestar-architecture` (read-only), this skill modifies
application source code.

Scripts live beside this `SKILL.md` under `scripts/`. Keep the process
cwd as the target repository. Invoke scripts with an absolute path to
that file (or `node <skill-dir>/scripts/<name>.mjs`). `--file` and
`--run-dir` are paths in the target repository. Use them for status
writes and file moves instead of POSIX `mv`.

---

## How to talk to the user

Anything you print or ask is read by a person who is skimming.

What you say:

- Ask one clear question at a time. Say what happens for each answer.
- Describe a fix by what it changes, not by its category key or item id.
- Keep status values (`deferred`, `in_progress`, …) out of questions — say
  "left for later", "half-finished".
- Never trim or postpone a warning. A dirty tree, a protected branch, a
  rejected commit, or a fix that grew past its scope is said plainly and
  up front.
- Short sentences. No unexplained abbreviations. No filler openers.

How you lay it out:

- Put the point first. No wind-up, no restating it at the end.
- Bullets, not paragraphs. One idea per bullet, one or two sentences.
- Blank line between blocks. Never one dense block of text.
- Bold the first few words of each bullet, plus any count, file name, or
  recommendation, so reading only the bold still gives the gist.
- Say the least that fully answers, then stop.

The Step 4 report block and any commit message keep their given shape.
Everything else you print follows the rules above.

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
   that lacks `INDEX.md` — Inputs would stop immediately.
2. An "unfinished" run is one where the run root (not the `done/`
   subfolder) still holds at least one action-item file. If exactly one
   run is unfinished, default to that. Otherwise list the unfinished
   runs and ask which one. If no candidate run qualifies, say so and
   point the user at `lodestar-audit`'s Plan phase.
3. Print: "Working through the fixes in `<output-root>/<RUN_ID>/`."

---

## Step 2 — Triage

Read `INDEX.md` and parse the frontmatter of every action-item file.
Build a summary:

- By category: count of items, broken down by status (`done` /
  `skipped` / `deferred` / `in_progress` / unstarted).
- By risk (`low` / `medium` / `high`).
- Count of `requires_decision: true` items.

Print the summary, then ask one question:

> What do you want to work on now?
>
> 1. **The safe ones** — every fix that hasn't been started and is
>    low-risk. Anything needing a judgement call from you is left out.
> 2. **By area** — you pick which areas to work through.
> 3. **Just the judgement calls** — only the fixes that need you to decide
>    something. I'll walk you through them one by one.
> 4. **Specific ones** — give me the numbers.

For (1) and (2), order items by category in the suggested sequence
`imports → types → ssot → soc-yagni → boundaries → errors →
testability → dry → styling`, then by ID within each category. This order is
chosen so mechanical low-risk fixes land first and unblock the rest.

Items with `status: done` or `status: skipped` are never re-touched.
Items with `status: in_progress` from an earlier interrupted session
surface first (Step 4 — Resuming).

Set `AUTO_COMMIT` from `sessionCommits` (the Step 1 override, not the
raw `git.commits` payload):

- `per-item` — `AUTO_COMMIT = yes`. Say so plainly: setup asked for one
  commit per fix, so each will be committed as it's done, without asking.
- `never` — `AUTO_COMMIT = no`. Say why in one line — either setup said
  never commit, or you're on a protected branch — and that changes will be
  left in the working copy for them to commit. Do not ask.
- `ask` — ask today's question:

> Should I commit each fix as I finish it, or leave everything for you to
> review and commit yourself? (commit each one / leave them to me)

Hold the answer for use in Step 3.6.

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
suggested fix in plain words. Ask: "Shall I make this change? (yes / no,
drop it / not now, ask me again later)".

- "no, drop it" → write `status: skipped` with a one-line `note:`, move
  the file to `<output-root>/<RUN_ID>/done/` (create the subfolder if
  needed), and move on.
- "not now" → write `status: deferred` with a `note:` describing the
  open question, and move on (leave the file in the run root).
- `yes` → proceed to Step 3.3.

For items where `requires_decision: false`, no question — proceed
directly.

### Step 3.3 — Mark in_progress

Update the item's frontmatter to add `status: in_progress`. This is
the checkpoint that makes the skill resumable: if interrupted, the
next session sees the in-progress item and offers to retry it.

### Step 3.4 — Apply the fix

Always warn — before applying — when any path in the item's `files:`
list already has uncommitted changes
(`git status --porcelain -- <files>`). Those edits would be swept
into a commit. Do not stop.

Follow the **Suggested fix** section of the item exactly. Honor the
**Scope rules** verbatim — they're the stop conditions for this
item.

Do not edit any file not in the `files:` list. If the fix requires
touching a file outside that list, stop, set `status: deferred` with
`note: scope-creep — <files outside list>`, and move on.

### Step 3.5 — Acceptance check

Run the commands listed under **Acceptance check** in the item. By
default this is `<typecheck>` and (where the item requires it)
`<test>`. Skip any command whose value is `n/a` and note the skip in
the item's `note:` (or the session report). A repo with no typecheck
is still fixable.

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

If `sessionCommits` is `never` (including a session that continued on a
protected branch without committing): do not `git add`. If any of the
item's files are already staged, unstage them with
`git restore --staged -- <those files>` without touching the working
tree. Continue.

If `AUTO_COMMIT == yes`:

Build the message with the item path relative to the repo root, write
stdout to a temp file, then:

```
git add <files from item>
git commit -F <temp>
```

`commit-message` invocation:

```
node <lodestar-fix-skill>/scripts/action-state.mjs commit-message \
  --file <output-root>/<RUN_ID>/<NNN>-<category>-<slug>.md \
  --item <output-root>/<RUN_ID>/<NNN>-<category>-<slug>.md \
  --subject-format "<git.subjectFormat>" \
  --trailer "<git.trailer>"
```

Use only the files listed in the item's `files:`. Never `git add -A`.
Never `--no-verify`. Never retry with a different message.

If the commit fails — a rejecting hook is the expected case — **stop
this item**. Write `status: deferred` with the hook output in `note:`,
leave the changes in place, tell the user, and move on. The edits are
good; only the commit failed. Do not mark the item done.

If `AUTO_COMMIT == no` (and `sessionCommits` is not `never`), leave the diff
staged or unstaged — whatever the host's edit tool produced — and
continue. The user will commit manually.

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

```bash
node scripts/action-state.mjs move-done --file <output-root>/<RUN_ID>/<NNN>-<category>-<slug>.md --run-dir <output-root>/<RUN_ID>
```

```powershell
node scripts/action-state.mjs move-done --file <output-root>/<RUN_ID>/<NNN>-<category>-<slug>.md --run-dir <output-root>/<RUN_ID>
```

Create `<output-root>/<RUN_ID>/done/` if it does not yet exist. This
keeps the run root to only unresolved items so future re-runs don't
have to scan completed work.

---

## Step 3a — (Optional) Sub-agent fan-out

If a sub-agent tool exists, categories parallelize (independent fixes).
Skip when unavailable — Step 3's inline loop is canonical.

Spawn one sub-agent per category with the item paths, full item text,
`<typecheck>` / `<test>`, `sessionCommits`, `AUTO_COMMIT`, and `git`
(`subjectFormat`, `trailer`). Constraints: action item is the
contract (scope rules stop the work); no edits outside `files:`; no
nested spawns; build commit messages with `commit-message` (never
`--no-verify`, never retry); hook reject → `status: deferred` with
hook output, leave edits, do not mark done; `sessionCommits: never` →
do not commit, leave unstaged. Return JSON
`[{item_id, status, files_modified, commit_sha, notes}]`.

Sub-agents run `<typecheck>` per batch but defer `<test>` to the
orchestrator (cross-category interactions). Orchestrator runs `<test>`
once after all return, then prints Step 4.

---

## Step 4 — Report

Print a session summary:

```
Finished this session on <output-root>/<RUN_ID>/.

  fixed:            N
  left for later:   N
  dropped:          N
  not started yet:  N

Changes were <committed one per fix | left in your working copy for you
to commit>.

Of the N left for later: M turned out to need bigger changes than the fix
allowed, N were blocked by a commit hook, and P are waiting on a decision
from you. Each one says why in its file.
(List the hook-blocked ones separately — those edits are already on disk
and can be picked up again.)

What you can do next:
  - Run `lodestar-fix` again to carry on from here.
  - Open anything left for later, deal with what's blocking it, then run
    `lodestar-fix` again — it will bring those back up.
```

### Step 4a — Promote a finished run

After printing the report, check whether the run root
`<output-root>/<RUN_ID>/` contains **no remaining action-item files**
(only `INDEX.md`, the `done/` subfolder, and possibly other
non-action-item files). If so, the run is fully resolved:

```bash
node scripts/action-state.mjs archive-run --run-dir <output-root>/<RUN_ID>
```

```powershell
node scripts/action-state.mjs archive-run --run-dir <output-root>/<RUN_ID>
```

Create `<output-root>/done/` if it does not exist. Print:

```
Nothing left in this batch. Moved it to <output-root>/done/<RUN_ID>/.
```

If any action-item files remain in the run root (deferred or
unstarted), skip this step and leave the run in place.

### Step 4b — Refresh `## Dependency Direction` after a cycle fix

If this session completed at least one `imports` #3 item (circular
dependency — subtype, title, or problem names a cycle), ask **once
after the last item**, never per item, never silently:

> Two of your packages used to import each other, and this session broke
> that loop. The setup notes still describe the old arrangement. Shall I
> update them to match the code as it is now? (yes / no)

On no, change nothing. On yes, run:

```text
node <lodestar-audit-skill>/scripts/audit-state.mjs derive-direction --root <repo>
```

If `cyclic` is still true — other imports along the same edge that no
item covered — report that and change nothing. If acyclic, replace
**only** `## Dependency Direction`, including a fresh `Basis:` date.
Layout, commands, conventions, and responsibilities stay untouched.

This write belongs to no item. Do not fold it into an item's commit.
Own commit, `context.md` only. Honor the session commit policy:
`never`, or `ask` when the user already declined auto-commit → write
and leave unstaged. `per-item` or `AUTO_COMMIT=yes` → commit. A run
with no #3 items never asks.

A `#6` (wrong-direction) fix converges toward the recorded graph and
does not trigger this.

---

## Resuming

`lodestar-fix` is restartable. Re-running against the same run directory:

1. Files already moved to `<output-root>/<RUN_ID>/done/` are never
   re-touched — their absence from the run root is the signal.
2. Items with `status: in_progress` in the run root surface first. For
   each, print the item and the git diff (if any) and ask: "This one was
   half-finished last time. Start it over, keep what's there and call it
   done, or undo it and come back to it later? (start over / keep it /
   undo it)". "Start over" re-applies the fix from scratch (any partial
   diff must be reverted first); "keep it" trusts the existing diff and
   moves the file to `done/`; "undo it" rolls back and writes
   `status: deferred` (leaves the file in the run root).
3. Items with `status: deferred` in the run root surface next. Say what
   was blocking each one, then ask: "Is this sorted now? (yes, try again /
   no, drop it / leave it for later)".
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
  `skipped`) are moved to `<output-root>/<RUN_ID>/done/` — they stay as
  a record. Deferred items remain in the run root until resolved.
- **No `git add -A`.** Stage only the files listed in the item's
  `files:`. The audit's per-item granularity is the whole point —
  preserve it in the commit history.
- **`## Dependency Direction` refresh is the one exception.** Step 4b
  may rewrite that section of `context.md` on consent after an
  `imports` #3 fix, in its own commit, because this skill is the one
  that can invalidate that section. It is not scope-creep.
- **Stop conditions:**
  - The run directory has no `INDEX.md` or no action-item files.
  - `<typecheck>` and `<test>` are both `n/a` or missing from
    `.agents/lodestar/context.md` (nothing to verify). A single `n/a`
    is not a stop — skip that check.
  - `check-freshness --facts commands` reports drift (a recorded
    command no longer resolves). Point at `lodestar-setup`.
  - The user says stop.
