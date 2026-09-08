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
  version: "0.18.0"
---

Write the agent-neutral config the lodestar skills need. The one file that
matters is `.agents/lodestar/context.md`. Sibling skills that need repo
facts read that file; they never read `AGENTS.md` for layout or commit
policy.

Do not do a broad repo survey. Do not propose architectural changes
(`lodestar-architecture` exists for that). Do **not** `Read` the full
setup-state JSON into chat — pass its path to commands; use stdout
projections only.

Resolve every bundled template path relative to the directory containing
this `SKILL.md`. Paths beginning with `.agents/` are output paths in the
target repository.

## What this skill does — and does not do

- **Does**: one deterministic collector pass; two user interactions
  (review + permissions); drive writes from state + corrections;
  complete from `summarize-results`.
- **Does not**: ask which workflows the user plans to use, invent
  Dependency Policy from today's import graph, or load full state into
  conversation.

## How to talk to the user

Anything you print or ask is read by a person who is skimming.

- Ask one clear question at a time. Say what happens for each answer.
- Say what a thing is, not what it is called. Keep internal config keys
  out of questions.
- Never make the user do arithmetic; give the numbers and your
  recommendation.
- Never trim or postpone a warning. Never truncate consent rows.
- Point first. Bullets, not paragraphs. Blank line between blocks.
- Bold the first few words of each bullet.

### Milestones

Concise chat progress — not diagnostic logs or run files:

- **Opening** — scope, output path, checks, mutation/commit policy
- **Before long work** — current step name
- **At boundaries** — completed count and next step
- **Closing** — from `summarize-results` only

Work through the steps in order. Before each step, load the
`references/` file that step names. Those files are one hop from this
one — a step reference must not load another step reference.

## Temp paths (before Step 0)

Create three OS-temp paths (via `mktemp` or `runtime.tempDir`) for:

- `--out` state JSON
- corrections JSON
- results JSON

Never commit them. Pass paths to commands; do not paste file contents
into chat.

Let `<setup-skill>` be the directory containing this `SKILL.md`.
Let `<repo>` be the target repository root.

## Step 0 — Collect once

Follow [references/00-confirm-scannable.md](references/00-confirm-scannable.md)
and [references/01-collect-facts.md](references/01-collect-facts.md).

One discovery invocation only. Read **stdout projection** only. If
`scannable.total === 0` → **stop**, write nothing. If `needsInput`
includes pkg-manager → ask once; write answers into corrections JSON
(do not re-run full agent discovery).

## Step 1 — Review (interaction 1)

Follow [references/02-review.md](references/02-review.md).
One review screen from the projection; one correction round → small
corrections JSON. Skip audit-only headings when `hasAudit` is false.

## Step 2 — Permissions (interaction 2)

Follow [references/03-permissions.md](references/03-permissions.md).
One tick list of writes **outside `.agents/` only**. Do not repeat
layout/commands/conventions/scope from review. Omit Fallow rows when
audit is absent.

## Step 3 — Mutations

Honor ticks. Ask nothing. Follow in order:

- [references/04-write-files.md](references/04-write-files.md)
- [references/05-cleanup.md](references/05-cleanup.md)
- [references/06-fallow.md](references/06-fallow.md) — **only when
  `hasAudit`**; otherwise skip
- [references/07-linters.md](references/07-linters.md)

After each op, `record-result` immediately
(`changed|skipped|failed` + path + remedy). Never echo raw child
stdout into chat. Never rebuild the summary from dirty git.

`principles.md` is never copied. Do not write `CLAUDE.md` or Copilot
instructions. `skills-only` does not touch `AGENTS.md`. Never install
over an in-range Fallow. A declined or failed install is not a setup
failure.

## Step 4 — Completion

Follow [references/08-confirm.md](references/08-confirm.md).
`summarize-results --results <file> --state <file>` only. Then
`setup-state.mjs cleanup --state --corrections --results` (success or
after recording failures).
