---
name: lodestar-plan
description: >-
  Writes an implementable plan under the resolved plans root (default
  docs/plans/) with a rigor: light | standard | full tier, grounds named
  files and commands before writing, and bootstraps the plans root and
  ledger on first use. Does not implement the plan and does not edit
  application source. Do not load unless the user explicitly invokes
  lodestar-plan by name.
disable-model-invocation: true
license: MIT
compatibility: Requires Node.js. Reads .agents/lodestar/context.md when present; when it is absent, discovers the same facts from the repo and falls back to docs/plans/ — lodestar-setup is not a prerequisite. Does not require Fallow. npm, pnpm, yarn, and Bun are detected from lockfiles; any other manager is asked about, or read from context.md when recorded.
metadata:
  author: Ilan Cohen
  version: "0.17.0"
---

You are running `lodestar-plan`. Write a **plan**. Do not implement it
unless the user asked you to in the same turn.

Plans are _how_. Link audit findings or specs for _what_. Home is the
resolved plans root (default `docs/plans/`). Completed work goes to that
root's `done/` via `lodestar-implement`; do not write new plans into
`done/` or `abandoned/`.

Scripts live beside this `SKILL.md`. Reach the shared plans module only
through [scripts/setup-modules.mjs](scripts/setup-modules.mjs):

```text
node <this-skill>/scripts/setup-modules.mjs resolve --root <repo>
node <this-skill>/scripts/setup-modules.mjs bootstrap --root <repo>
node <this-skill>/scripts/setup-modules.mjs add-awaiting --root <repo> --plan <href> --summary <text>
```

Load references one hop from this file. Do not copy their procedures back
here.

## How to talk to the user

Anything you print or ask is read by a person who is skimming.

- Ask one clear question at a time. Say what happens for each answer.
- Name a file by its path, not by an internal key.
- Never trim or postpone a warning. A missing file or command the plan names stays in.
- Point first. Bullets, not paragraphs. Blank line between blocks.
- Bold the first few words of each bullet.

## Steps

Work in order. Load the named reference before each step.

1. **Locate** — [references/locate.md](references/locate.md). Resolve the
   plans root. Bootstrap it when absent.
2. **Discover** — [references/discover-context.md](references/discover-context.md).
   Only when `.agents/lodestar/context.md` is missing: find the same facts
   in the repo. Never a stop, and never a hand-off to `lodestar-setup`.
3. **Ground** — [references/ground.md](references/ground.md). Bounded
   verification, not research. Stop rather than write a plan that names a
   missing file or a command that is not real.
4. **Shape and tier** — [references/shape-and-tier.md](references/shape-and-tier.md).
   Pick file vs folder. Write `rigor:` from size, then risk.
5. **Write** — [references/write.md](references/write.md). Create the plan
   and the ledger row. Do not commit unless asked.

## Never

- Application source (`packages/**`, `src/**`, or the equivalent in
  Package Layout).
- `.agents/lodestar/context.md`.
- Guessing a missing file or command into existence. Stop and ask.
- Writing a folder plan with `rigor: light`.
