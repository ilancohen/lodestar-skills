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
compatibility: Requires git and Node.js. Works with or without .agents/lodestar/context.md — discovers docs trees when context is absent. Does not require Fallow. npm, pnpm, yarn, and Bun are detected from lockfiles; any other manager works when recorded in context.md.
metadata:
  author: Ilan Cohen
  version: "0.18.0"
---

You are running `lodestar-docs`. The job is to **harvest**, then **delete**
leftover writeups so the docs tree stays small. Historical record is not
a goal. Git history is the archive.

This skill is optional. The other skills do not depend on it (the other
six can run without it). It does not
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

- Ask one clear question at a time. Say what happens for each answer.
- Name a file by its path, not by an internal key.
- Never trim or postpone a warning. A live audit run, a harvest with no home, or a spec-vs-code clash stays in.
- Point first. Bullets, not paragraphs. Blank line between blocks.
- Bold the first few words of each bullet.

### Milestones

Concise chat progress — not diagnostic logs or run files:

- **Opening** — docs scope, homes, checks, mutation/commit policy
- **Before long work** — survey / propose / harvest / delete
- **At boundaries** — proposed counts and next step
- **Closing** — harvested/deleted paths, protected skips, actionable failures

---

## Inputs

If `.agents/lodestar/context.md` is missing, follow
[references/discover-context.md](references/discover-context.md) and
continue — observe docs trees the same way setup would. A named
`--tree` or `--full` also proceeds without context. Do not invent
`docs/audit` as a fallback when nothing is observed and the user named
no folder.

When context exists, it is the primary file for repo facts. Do not read
`AGENTS.md` for layout, output-root, or commit policy.

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
