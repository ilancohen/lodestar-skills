---
name: lodestar-setup
description: >-
  Sets up the lodestar suite in a repository by documenting its package
  layout and which of a short list of conventions it already follows in
  .agents/lodestar/context.md, the one file the other lodestar skills
  read, which links to the bundled principles.md (never copied or
  inlined). Measures git churn (no source reading) and asks whether to
  scope the audit to code changed since today's commit. Asks how
  lodestar-fix should commit, and whether to add a pointer section to
  AGENTS.md so principles apply to every task (full suite) or to leave
  AGENTS.md untouched (skills-only). With separate user consent it may
  also install
  Fallow as a devDependency (writing package.json and the lockfile), write
  .fallowrc.json, add gitignore entries, and tighten existing linter rules.
  Do not load unless the user explicitly invokes lodestar-setup by name.
disable-model-invocation: true
license: MIT
compatibility: Requires filesystem write access and a POSIX-compatible shell for optional Fallow setup, plus network access if you accept the optional Fallow install. npm, pnpm, yarn, and Bun are detected from lockfiles; any other manager works when recorded in context.md. Deno and Bazel are not supported.
metadata:
  author: Ilan Cohen
  version: "0.9.1"
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

Work through the steps in order. Before each step, load its
`references/NN-*.md` file. Those files are one hop from this one — a
step reference must not load another step reference.

## Step 0 — Confirm the repo is scannable

Follow [references/00-confirm-scannable.md](references/00-confirm-scannable.md).
Count only. Zero scannable files → **stop**, write nothing.

## Step 1 — Collect the minimum required facts

Follow [references/01-collect-facts.md](references/01-collect-facts.md).
Read only what that file names. Do not survey the repo.

## Step 2 — Confirm one thing

Follow [references/02-review.md](references/02-review.md).
Consent gates (one round each): correct the summary; excluded-path
candidates; audit-scope question (skip when not git, or when
`## Audit Configuration` already has `mode`).

## Step 3 — Confirm which conventions the repo already follows

Follow [references/02-review.md](references/02-review.md).
Consent: one multi-select, pre-checked from the Step 1 sweep. Do not
ask a second conventions question.

## Step 3a — Confirm how lodestar-fix commits

Follow [references/02-review.md](references/02-review.md).
Consent: commit policy, once. Write git keys in `## Audit Configuration`
in both enforcement modes.

## Step 4 — Choose how principles get enforced

Follow [references/02-review.md](references/02-review.md).
Consent: **full suite** vs **skills-only**. Record `ENFORCEMENT_MODE`.
This choice does not skip layout, conventions, Git, Fallow, or linting.

## Step 5 — Write the files

Follow [references/05-write-files.md](references/05-write-files.md).
Announce each file before writing it. `principles.md` is never copied,
inlined, or edited. Do not write `CLAUDE.md` or Copilot instructions.
`skills-only` does not touch `AGENTS.md`.

## Step 6 — Clean up a pre-0.3 install

Follow [references/06-cleanup.md](references/06-cleanup.md).
Consent: if older lodestar sections are still in `AGENTS.md`, ask once
before removing them.

## Step 7 — Fallow and `.fallowrc.json` for the audit's fallow seed

Follow [references/07-fallow.md](references/07-fallow.md).
Consent, independently: install (or upgrade) Fallow; write
`.fallowrc.json`; add gitignore entries. Never install over an
in-range copy. A declined or failed install is not a setup failure.

## Step 8 — (Optional) Linting rules for higher-accuracy audit findings

Follow [references/08-linters.md](references/08-linters.md).
Consent: tighten existing ESLint / Biome rules. Skip when they decline
or there is no linter.

## Step 9 — Confirm

Follow [references/09-confirm.md](references/09-confirm.md).
Consent: does this look right. Do not run `lodestar-audit` or
`lodestar-architecture` automatically.
