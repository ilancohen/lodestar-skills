---
name: lodestar-docs
description: >-
  Harvests leftover knowledge from lodestar-owned docs staging into
  existing canonical homes, then deletes files that would not help an
  agent starting fresh. Default scope is audit done/abandoned, architecture
  reviews, and plans done/abandoned — not the whole docs/ tree. Never
  creates new homes, never edits application source or
  .agents/lodestar/context.md. Do not load unless the user explicitly
  invokes lodestar-docs by name.
disable-model-invocation: true
license: MIT
compatibility: Requires git, Node.js, and .agents/lodestar/context.md from lodestar-setup. Does not require Fallow. npm, pnpm, yarn, and Bun are detected from lockfiles; any other manager works when recorded in context.md.
metadata:
  author: Ilan Cohen
  version: "0.15.0"
---

You are running `lodestar-docs`. The job is to **harvest**, then **delete**
leftover writeups so the docs tree stays small. Historical record is not
a goal. Git history is the archive.

This skill is optional. The other four do not depend on it. It does not
modify application source — only markdown (and, if the user ticks it, an
existing Docs map in `AGENTS.md`).

Scripts live beside this `SKILL.md` under `scripts/`. Invoke
`node <this-skill>/scripts/scope.mjs survey --root <repo>` (add `--full`
or `--tree <path>` when the user widened scope).

Load references one hop from this file. Do not copy their procedures back
here.

---

## How to talk to the user

Anything you print or ask is read by a person who is skimming.

What you say:

- Ask one clear question at a time. Say what happens for each answer.
- Name a file by its path, not by an internal key.
- Never trim or postpone a warning. A live audit run, a spec-vs-code
  clash, or a harvest with no home stays in, however short the message.
- Short sentences. No unexplained abbreviations. No filler openers.

How you lay it out:

- Put the point first. No wind-up, no restating it at the end.
- Bullets, not paragraphs. One idea per bullet, one or two sentences.
- Blank line between blocks. Never one dense block of text.
- Bold the first few words of each bullet, plus any count, file name, or
  recommendation, so reading only the bold still gives the gist.
- Say the least that fully answers, then stop.

---

## Inputs

Confirm `.agents/lodestar/context.md` exists. If it is missing, stop and
tell the user to run `/lodestar-setup` first — unless they named a folder
to sweep, in which case pass that folder as `--tree` after they confirm
the path.

This is the only file read for repo facts. Do not read `AGENTS.md` for
layout, output-root, or commit policy.

Capture from the survey JSON:

- `<output-root>`, `<architecture-root>`, `<commits>`
- `<docsLayout>` — recorded (or observed) path/role rows
- `<homes>` — markdown under `home` rows
- `<trees>` — directories and loose files in this run
- `<files>` — each path, size, last commit, `protected`

Protected rows are out of scope. Never propose deleting them.

---

## Keep-bar

For every file, ask:

> Would an agent starting fresh work tomorrow be worse off without this?

The default answer is no. The default action is delete.

A file survives only when you can name the concrete future task it helps.
"Someone might want to know how we got here" is not such a task.

---

## Steps

Work in order. Load the named reference before each step.

1. **Scope** — [references/scope.md](references/scope.md). Run the survey.
   Say what you are covering and why. If the tree is already tight, say so
   and stop.
2. **Homes** — [references/homes.md](references/homes.md). Route harvested
   facts only into `<homes>`. Never create a new home.
3. **Triage** — [references/operations.md](references/operations.md). One
   operation per file.
4. **Propose, then mutate** — [references/workflow.md](references/workflow.md).
   One written proposal. Wait for OK. Harvest commit, then delete commit,
   honoring `<commits>`.

---

## Never

- Application source (`packages/**`, `src/**`, or the equivalent in
  Package Layout).
- `.agents/lodestar/context.md`.
- Skill definition files (`.agents/skills/`, `.cursor/skills/`,
  `.claude/skills/`). If pruning invalidates a skill's assumptions,
  report that at the end and do not edit the skill.
- Live audit runs (`INDEX.md` plus `NNN-*.md` in the run root).
- In-flight plans (anything under `docs/plans/` except `done/` and
  `abandoned/`).
- Silently updating a spec to match the code when they disagree. Ask
  "spec or code?" with `file:line` on both sides.
