---
name: implement-plan
description: Implements a plan from docs/plans/ one stage at a time. For each stage it applies the changes the plan specifies, runs <typecheck> and <test>, spawns a code-reviewer subagent (auto-fixes once if it flags issues), commits the result, and marks the stage done — moving the plan into docs/plans/done/ and updating the docs/plans/README.md ledger when every stage is complete. Stages are folder sub-plans for folder plans and `## Pass N` sections for single-file plans. Stops at unresolved decision points and asks the user. Restartable — re-runs pick up at the next unfinished stage. Modifies application source code, commits, and rewrites the plans ledger.
---

You are running `implement-plan`. The job is to **execute** a plan from
`docs/plans/`, one stage at a time, with code review and acceptance
checks between stages, until the plan is fully landed and moved to
`docs/plans/done/`.

This skill is the executive counterpart for the plans workflow, mirroring
what `ep-fix` is for audits:

| Skill              | Input shape                              | Modifies source? |
| ------------------ | ---------------------------------------- | ---------------- |
| `ep-fix`           | One `docs/audit/<RUN_ID>/` directory     | **Yes** |
| `implement-plan`   | One `docs/plans/<plan>` file or folder   | **Yes** |

Both also rewrite their own index — `ep-fix` moves items into `done/`
and promotes finished runs; `implement-plan` moves the plan into
`docs/plans/done/` and updates `docs/plans/README.md`.

---

## Inputs

Required:

- The plan to implement — either a single `.md` file or a folder
  containing `README.md` plus numbered sub-plan files.
- `AGENTS.md` — read it to capture `<typecheck>`, `<lint>`, `<test>`
  commands and the dependency direction. If those are missing, stop
  and tell the user to run `ep-setup` first.
- `CONTRIBUTING.md` — read the pre-commit checklist. Every commit this skill
  produces must satisfy it.
- `docs/plans/README.md` — the ledger. It will be updated when the
  plan completes.

The plan is the contract. Do not implement from memory; re-read each
stage's section before applying it.

---

## Step 1 — Pick a plan

If the invocation names a plan (path, slug, or folder name), use it.
Otherwise:

1. List candidates: every `.md` file and every folder directly under
   `docs/plans/` that is **not** in `done/`, `abandoned/`, or `adr/`.
2. Cross-reference with the "Awaiting Implementation" table in
   `docs/plans/README.md` and the modification date.
3. If exactly one plan is named in the invocation context (e.g. the
   user said "implement the corpus-admission plan" and only one slug
   matches), use it.
4. Otherwise list the candidates and ask which one.

Print: "Working on `docs/plans/<plan>`. Single-file plan / Folder plan."

---

## Step 2 — Identify the stages

A **stage** is the unit of work — one commit, one acceptance run, one
review pass, one done-mark.

**Folder plan** (`docs/plans/<slug>/`):

- The stages are the numbered sub-plan files (`00-…md`, `01-…md`, …)
  in lexicographic order.
- The folder's `README.md` is the design document, not a stage.
- A sub-plan whose frontmatter or body declares `status: done` is
  skipped.
- A sub-plan with `Sequenced after: <other-sub-plan>` must wait until
  that prerequisite is `status: done`; if it isn't, stop and ask the
  user.

**Single-file plan** (`docs/plans/<slug>.md`):

- The stages are the top-level `## Pass N — <title>` sections in
  document order. If the file has no `## Pass N` sections but the body
  is a single coherent change, the whole file is one stage.
- A pass with a `Status: done` line directly under the heading is
  skipped.
- A pass that says it's gated on a decision (`Rides D1`,
  `Requires decision DN`, etc.) without that decision being resolved
  goes through the decision gate (Step 3.2).

Print a one-line summary per stage:

```
Stages:
  [ ] 00-schema-additions          (folder sub-plan)
  [ ] 01-discovery-signal-fetcher  (folder sub-plan)
  [x] 02-wikipedia-categories      (already done)
  ...
```

Then ask:

> Implement all unfinished stages in order? (yes / pick a subset / start
> from a specific stage)

---

## Step 3 — Implement, per stage

For each selected stage, in order:

### Step 3.1 — Read the stage

Open the stage's content (sub-plan file or `## Pass N` section) and
read every part: motivation, scope, files-to-touch, acceptance criteria,
notes on test coverage. The stage is the contract — do not apply changes
from memory or from a template.

If the plan also has an appendix, design summary, or rubric spec that
the stage references, read it. Do not skim.

### Step 3.2 — Decision gate

If the stage rides an unresolved decision point (any `Rides D<N>`,
`Requires decision`, `Awaiting decision on …`, or a section labelled
"Decision Points" that is not marked resolved), **stop**.

Print the decision question, the options the plan offers, and the plan's
default if it has one. Ask the user to pick. Then either:

- Record the chosen value somewhere durable (the plan text, an env var,
  or a configuration constant the plan names) and proceed.
- If the user defers, mark the stage `status: deferred` with a one-line
  reason, leave the rest of the plan untouched, and stop the session.

Never guess a decision. The whole point of the gate is human signoff.

### Step 3.3 — Apply the change

Follow the stage's instructions exactly. Honor its file list and scope
rules as stop conditions:

- If the stage names specific files, edit only those.
- If the change requires touching a file outside the stage's stated
  scope, stop and ask. Either the scope is wrong (update the plan first)
  or the plan needs splitting.

Walk through the pre-commit checklist in `CONTRIBUTING.md` as you go — every
item that applies (SoC, DRY, SSOT, YAGNI, Tell Don't Ask, CQS, branded
types, no `any`, no module-load side effects, `Result<T, E>` for
expected failures, ubiquitous language, no inline static styles, LLM
cache-policy `manualEpoch` bumps when a renderer changes, dependency
direction). The checklist is part of the contract.

### Step 3.4 — Acceptance check

Run, in order, the commands from `AGENTS.md`:

1. `<typecheck>` (typically `pnpm check-types`).
2. `<test>` (typically `pnpm test`), **scoped to the packages this
   stage touched**. Use the package's own runner (e.g.
   `pnpm --filter <pkg> test`, or pass the touched file paths to
   `vitest`). The full suite runs once at plan-end (Step 4) — that's
   the safety net for cross-package breakage.
3. `<lint>` (typically `pnpm lint`) if the stage touches code that lint
   covers.

If any fails:

- Read the error. If it's a clear by-product of the stage's edits, fix
  it and re-run. This is part of the same stage's work, not a new
  stage.
- If the failure surfaces a hidden ambiguity in the plan (e.g. the plan
  says "delete X" but two callers still rely on it), stop and ask the
  user — the plan likely needs an amendment before continuing.

Do not commit until all three pass.

### Step 3.5 — Code review

**Trivial-stage carve-out.** If the stage's diff is *purely mechanical* —
a rename, file move, hoist/extract with no behavior change, or a
comment/dead-code removal — and the diff is under ~80 lines of real code
change, skip the subagent. Instead, walk the `CONTRIBUTING.md` pre-commit
checklist inline and proceed to Step 3.6. The end-of-plan state will
still be reviewed when the user inspects the final ledger update, and
typecheck + scoped tests already caught the structural breakage classes
this kind of diff can produce. If anything about the diff feels
non-mechanical (logic moved between branches, error handling reshaped,
a constant's value changed, a public API surface touched), don't take
the carve-out — spawn the reviewer.

Otherwise, spawn a `code-reviewer` subagent with:

- The plan's stage content (so the reviewer knows what was *supposed*
  to happen).
- The git diff for the stage (`git diff` on unstaged or staged
  changes — whichever applies).
- The `CONTRIBUTING.md` pre-commit checklist as the review rubric (in
  addition to the reviewer's own rubric).

The reviewer returns a structured report. Filter to issues at
`high` and `medium` confidence — ignore `low` / nit-only items unless
the user asked for a strict pass.

**If the reviewer finds no medium-or-higher issues**, proceed to Step
3.6.

**If it finds issues**, do **one** auto-fix pass:

1. Address every medium-or-higher issue in a single follow-up edit
   batch.
2. Re-run the acceptance check (Step 3.4).
3. Re-spawn the `code-reviewer` subagent with the new diff and the
   same plan content.

If the second review still flags medium-or-higher issues, stop. Print
the remaining issues and ask the user to decide:

- Fix manually and continue (user signals when done).
- Mark the stage `status: deferred` with `reviewer-blocked: <summary>`.
- Override and commit anyway (user takes responsibility — record
  `review-override: true` in the commit body).

Never silently ship a stage that failed two review rounds.

### Step 3.6 — Mark the stage done

**Folder sub-plan:** Add (or update) a frontmatter block at the top of
the sub-plan file:

```yaml
---
status: done
completed_at: <YYYY-MM-DD>
commit: <short-sha>
---
```

Leave the body unchanged. The body is the immutable record of what was
asked.

**Single-file plan pass:** Insert a `Status: done — <YYYY-MM-DD>,
commit <short-sha>` line immediately under the `## Pass N — …` heading.
Don't touch the body of the pass.

### Step 3.7 — Commit

Stage only the files actually changed by this stage (plus the stage's
own done-mark from Step 3.6). Never `git add -A`.

Commit with the convention this repo uses (verify against `git log
--oneline -20` — usually `<category>: <subject>`):

```
<plan-slug>: <Stage N / sub-plan name> — <one-line summary>

Plan: docs/plans/<plan>
Stage: <stage identifier>
```

If the reviewer's second-pass issues were overridden in Step 3.5,
append `Review-override: <one-line reason>` to the commit body.

Capture the short SHA — needed both for the done-mark from Step 3.6
(re-write it now that the SHA exists) and for the ledger update in
Step 4.

---

## Step 4 — Plan completion

After the last stage commits successfully, run the **full** acceptance
suite once as the cross-package safety net that per-stage scoped runs
deliberately skipped:

1. `<typecheck>` across the whole repo.
2. `<test>` across the whole repo (no `--filter`).
3. `<lint>` across the whole repo.

If anything fails here, it almost certainly means a stage's scoped run
missed a downstream consumer. Treat the failure as a new sub-stage:
fix it, re-run the full suite, and commit as
`<plan-slug>: housekeeping — fix cross-package regression` *before*
the housekeeping commit below. Do **not** move the plan to `done/`
with a red full suite.

Then do **both** of the following in one final commit
(`<plan-slug>: housekeeping — move to done & update ledger`):

### Step 4.1 — Move the plan to `done/`

- **Folder plan:** `git mv docs/plans/<slug>/ docs/plans/done/<slug>/`.
- **Single-file plan:** `git mv docs/plans/<slug>.md
  docs/plans/done/<slug>.md`.

### Step 4.2 — Update `docs/plans/README.md`

1. Remove the plan's row from the **Awaiting Implementation** table.
2. Add a row to the **Done** table. Match the existing column shape —
   `| [path](path) | Evidence |`. Evidence should be a 1–3 sentence
   summary citing the commits this session produced (short SHAs) and
   any tangible artifacts (e.g. "Module `evaluateAdmissionRubric`
   landed at `shared/dataset/src/corpus/admissionRubric.ts`; rubric
   tested empirically against the 4,858-scholar corpus at
   `8b4f3a21`.").
3. If the plan superseded an earlier plan in the **Abandoned /
   Superseded** table, leave that row in place — it's still part of
   the historical record.

If any in-flight plan in the **Awaiting Implementation** table links
to the just-completed plan as a prerequisite, update its link to point
at the new `done/` location (`grep -n '<slug>' docs/plans/README.md`
to find every reference; rewrite them all).

### Step 4.3 — Report

Print a session summary:

```
implement-plan complete on docs/plans/<plan>.

  stages done:   N
  stages skipped: M (already done / deferred)
  commits:       <list of short SHAs>

Plan moved to docs/plans/done/<plan>/.
Ledger updated.

Pre-commit checklist verified per stage (typecheck, test, lint, review).
```

If the plan was only partially completed (deferred stages or unresolved
decisions), skip Step 4.1 and Step 4.2 — leave the plan in place.
Report what remains, and note which stages are deferred and why.

---

## Resuming

`implement-plan` is restartable. Re-running against the same plan:

1. Re-read the plan and recompute the stage list (Step 2). Stages
   already marked `status: done` (folder sub-plan frontmatter or
   single-file `Status: done` line) are skipped.
2. Stages with `status: deferred` surface first. Print the deferral
   reason and ask: "retry / leave deferred / skip permanently."
3. If a stage's previous attempt left uncommitted changes in the
   working tree, print the diff and ask: "continue from here / revert
   and retry / leave for manual handling." Never silently overwrite a
   partial diff.
4. Unstarted stages follow as in a fresh session.

---

## Rules

- **The plan is the contract.** Don't implement from memory. Re-read
  the stage before each commit.
- **Decisions stop the line.** Any unresolved `Rides D<N>` /
  `Requires decision` blocks the stage — ask the user, don't guess.
- **Scope rules are stop conditions.** If a stage's stated file list or
  scope is wrong, stop and ask. The plan needs amending, not silent
  expansion.
- **One stage = one commit.** No batching. The stage's done-mark and
  its diff land together so the history is a clean ledger of what
  happened.
- **No `git add -A`.** Stage only the files touched by the stage.
- **Acceptance every stage; review every non-mechanical stage.**
  Typecheck + scoped tests run on every stage without exception — a
  trivial stage that breaks typecheck is the most expensive mistake to
  debug later. Code review can be skipped for *purely mechanical*
  stages (rename, move, hoist, comment removal) per the Step 3.5
  carve-out; anything that reshapes logic still goes through the
  reviewer.
- **Full suite runs once, at plan-end.** Per-stage tests are scoped to
  the touched packages for speed; the full `<typecheck>` / `<test>` /
  `<lint>` sweep at Step 4 is the safety net for cross-package
  breakage. Skipping it forfeits the safety net — never move a plan to
  `done/` with a red full suite.
- **One auto-fix pass per stage.** If the reviewer flags issues twice,
  hand off to the user — don't loop indefinitely.
- **Plan body is immutable.** Only the frontmatter (folder sub-plans)
  or a `Status:` line under the pass heading (single-file plans) is
  added. Never edit the plan's prose to "fix" decisions or rationale —
  that's revisionism. If the plan was wrong, write a follow-up plan or
  amend via a normal commit before resuming.
- **Stop conditions:**
  - `AGENTS.md` is missing the `<typecheck>` / `<test>` commands.
  - The plan references files that don't exist and the discrepancy
    isn't clearly a typo (might mean the plan is stale).
  - A stage's acceptance check fails in a way the stage's edits can't
    explain.
  - Two consecutive code-reviewer passes flag medium-or-higher issues.
  - The user says stop.
