---
name: lodestar-setup
description: >-
  Sets up the lodestar suite in a repository by documenting its package
  layout and which of a short list of conventions it already follows in
  .agents/lodestar/context.md, the one file the other lodestar skills
  read, which links to the bundled principles.md (never copied or
  inlined). Measures git churn (no source reading) and states a default
  audit scope. Two consent screens: one review of everything observed,
  one tick list for every write outside .agents/ (install Fallow,
  .fallowrc.json, gitignore, AGENTS.md, linters). An undetectable
  package manager is asked before the review screen. Do not load unless
  the user explicitly invokes lodestar-setup by name.
disable-model-invocation: true
license: MIT
compatibility: Requires filesystem write access and a POSIX-compatible shell for optional Fallow setup, plus network access if you accept the optional Fallow install. npm, pnpm, yarn, and Bun are detected from lockfiles; any other manager works when recorded in context.md. Deno and Bazel are not supported.
metadata:
  author: Ilan Cohen
  version: "0.10.1"
---

Write the agent-neutral config the lodestar skills need. The one file that
matters is `.agents/lodestar/context.md`: package layout, dependency
direction, build commands, conventions, audit scope, and how
`lodestar-fix` commits.
`lodestar-audit`, `lodestar-fix`, and `lodestar-architecture` read that
file and nothing else for repo facts — they never read `AGENTS.md`.

This requires only the information needed to fill in the templates — do not
do a broad repo survey, and do not propose architectural changes (the
`lodestar-architecture` skill exists for that).

Resolve every bundled template path relative to the directory containing this
`SKILL.md`. Paths beginning with `.agents/` below are output paths in the target
repository, not locations of this installed skill.

## What this skill does — and does not do

- **Does**: discover the packages that already exist, document each one
  (name, path, alias, one-sentence responsibility), record the observed
  package import graph, conventions, commit policy, and audit scope, and
  write the config files agents read.
- **Does not**: force packages into a fixed role list (`core`, `api`,
  `ui`), write a target dependency direction, propose an alternative
  layout, or read source to pick a scope. Point layout questions at
  `lodestar-architecture` and stop.

## How to talk to the user

Every question and summary in this skill is read by a person who may not
know what any of it means, and who is skimming. Write accordingly.

What you say:

- Ask one clear question at a time. Say what happens for each answer.
- Say what a thing is, not what it is called. "A tool that maps how your
  files import each other", not "the graph-based detector".
- Never make the user do arithmetic or compare a number to a threshold.
  Give the numbers and give your recommendation with a one-line reason.
- Keep internal config keys (`mode`, `changed-since`, `barrel-exports`,
  `ENFORCEMENT_MODE`, …) out of questions. They belong in the files you
  write, and in these instructions — not on screen.
- Never trim or postpone a warning. Anything that could make the user
  choose wrong stays in, however short the message.
- Short sentences. No unexplained abbreviations. No filler openers.

How you lay it out:

- Put the point first. No wind-up, no restating it at the end.
- Bullets, not paragraphs. One idea per bullet, one or two sentences.
- Blank line between blocks. Never one dense block of text.
- Bold the first few words of each bullet, plus any number, file name, or
  recommendation, so reading only the bold still gives the gist.
- Say the least that fully answers, then stop.

Work through the steps in order. Before each step, load the
`references/` file or files that step names. Those files are one hop
from this one — a step reference must not load another step reference.

## Step 0 — Confirm the repo is scannable

Follow [references/00-confirm-scannable.md](references/00-confirm-scannable.md).
Count only. Zero scannable files → **stop**, write nothing.

## Step 1 — Collect the minimum required facts

Follow [references/01-collect-facts.md](references/01-collect-facts.md).
Read only what that file names. Do not survey the repo.

## Step 2 — Review what was observed

Follow [references/02-review.md](references/02-review.md).
Consent: one review screen, one round of corrections. Package manager
is already settled unless Step 1 had to ask.

## Step 3 — Permissions for writes outside `.agents/`

Follow [references/03-permissions.md](references/03-permissions.md).
Consent: one tick list. Pre-ticked: Fallow install, `.fallowrc.json`,
gitignore. Unticked: `AGENTS.md`, linters. Omit rows that cannot apply.

## Step 4 — Do the work

Follow each of these in order. They honor the permissions-screen ticks
and ask nothing:

- [references/04-write-files.md](references/04-write-files.md)
- [references/05-cleanup.md](references/05-cleanup.md)
- [references/06-fallow.md](references/06-fallow.md)
- [references/07-linters.md](references/07-linters.md)

`principles.md` is never copied, inlined, or edited. Do not write
`CLAUDE.md` or Copilot instructions. `skills-only` does not touch
`AGENTS.md`. Never install over an in-range Fallow. A declined or
failed install is not a setup failure.

## Step 5 — Confirm

Follow [references/08-confirm.md](references/08-confirm.md).
Consent: does this look right. Do not run `lodestar-audit` or
`lodestar-architecture` automatically.
