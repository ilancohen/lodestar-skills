---
name: lodestar-setup
description: >-
  Sets up the lodestar suite in a repository: writes
  .agents/lodestar/context.md (package layout, conventions, optional
  dependency policy, audit scope when audit is installed). Principles
  resolve from the installed lodestar-setup skill. Measures git churn
  when audit is present. Do not load unless the user explicitly invokes
  lodestar-setup by name.
disable-model-invocation: true
license: MIT
compatibility: Requires filesystem write access and a POSIX-compatible shell. When lodestar-audit is installed, also needs network access if you accept the Fallow install. Lockfiles detect npm, pnpm, yarn, and Bun; other managers via context.md. No Deno or Bazel.
metadata:
  author: Ilan Cohen
  version: "0.17.0"
---

Write the agent-neutral config the lodestar skills need. The one file that
matters is `.agents/lodestar/context.md`: package layout, documentation
trees, optional dependency policy, build commands, conventions, and —
when `lodestar-audit` is installed — audit scope and how `lodestar-fix`
commits. Sibling skills that need repo facts read that file; they never
read `AGENTS.md` for layout or commit policy. Architecture, docs, plan,
and implement can also discover facts when context is absent.

This requires only the information needed to fill in the templates — do not
do a broad repo survey, and do not propose architectural changes (the
`lodestar-architecture` skill exists for that).

Resolve every bundled template path relative to the directory containing this
`SKILL.md`. Paths beginning with `.agents/` below are output paths in the target
repository, not locations of this installed skill.

## What this skill does — and does not do

- **Does**: detect which sibling `lodestar-*` skills are installed beside
  this one, discover the packages that already exist, document each one
  (name, path, alias, one-sentence responsibility), record documentation
  trees, conventions the user confirms, optional dependency policy the
  user states, and — when audit is installed — audit scope and commit
  policy. Write the config files agents read. Prepare Fallow only when
  audit is among the installed siblings.
- **Does not**: ask which workflows the user plans to use, infer intent
  from the prompt, force packages into a fixed role list, turn today's
  import graph into dependency policy, propose an alternative layout, or
  read source to pick a scope. Point layout questions at
  `lodestar-architecture` and stop.

## How to talk to the user

Anything you print or ask is read by a person who is skimming.

- Ask one clear question at a time. Say what happens for each answer.
- Say what a thing is, not what it is called. Keep internal config keys out of questions.
- Never make the user do arithmetic; give the numbers and your recommendation.
- Never trim or postpone a warning.
- Point first. Bullets, not paragraphs. Blank line between blocks.
- Bold the first few words of each bullet.

### Milestones

Concise chat progress — not diagnostic logs or run files:

- **Opening** — scope, output path, checks, mutation/commit policy
- **Before long work** — current step name
- **At boundaries** — completed count and next step
- **Closing** — artifacts written, what was skipped, actionable failures

Work through the steps in order. Before each step, load the
`references/` file or files that step names. Those files are one hop
from this one — a step reference must not load another step reference.

## Step 0 — Confirm the repo is scannable

Follow [references/00-confirm-scannable.md](references/00-confirm-scannable.md).
Count only. Zero scannable files → **stop**, write nothing.

## Step 1 — Collect the minimum required facts

Follow [references/01-collect-facts.md](references/01-collect-facts.md).
First detect installed sibling skills (directories named `lodestar-*`
beside this skill that contain `SKILL.md`). Do not ask which workflows;
do not infer from the user prompt. Read only what that file names. Do
not survey the repo.

## Step 2 — Review what was observed

Follow [references/02-review.md](references/02-review.md).
Consent: one review screen, one round of corrections. Package manager
is already settled unless Step 1 had to ask. Skip audit-only headings
when audit is not among the siblings.

## Step 3 — Permissions for writes outside `.agents/`

Follow [references/03-permissions.md](references/03-permissions.md).
Consent: one tick list. When audit is installed, pre-tick Fallow
install, `.fallowrc.json`, and gitignore; untick `AGENTS.md` and
linters. When audit is absent, omit every Fallow row. Omit other rows
that cannot apply.

## Step 4 — Do the work

Follow each of these in order. They honor the permissions-screen ticks
and ask nothing:

- [references/04-write-files.md](references/04-write-files.md)
- [references/05-cleanup.md](references/05-cleanup.md)
- [references/06-fallow.md](references/06-fallow.md) — **only when
  `lodestar-audit` is among the installed siblings**; otherwise skip
- [references/07-linters.md](references/07-linters.md)

`principles.md` (beside this `SKILL.md`) is never copied, inlined, or
edited — skills resolve it from the installed setup skill. Do not write
`CLAUDE.md` or Copilot instructions. `skills-only` does not touch
`AGENTS.md`. Never install over an in-range Fallow. A declined or
failed install is not a setup failure.

## Step 5 — Summarize

Follow [references/08-confirm.md](references/08-confirm.md).
Completion summary only — no "does this look right" question. Point at
sensible next skills from the installed siblings. Do not run
`lodestar-audit`, `lodestar-architecture`, or `lodestar-docs`
automatically.
