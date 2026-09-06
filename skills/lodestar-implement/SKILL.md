---
name: lodestar-implement
description: >-
  Executes a plan from the resolved plans root one stage at a time at the
  declared rigor: light | standard | full tier, with typecheck and scoped
  tests every stage, then moves the finished plan to done/ and updates the
  ledger. Modifies application source code, commits, and rewrites the plans
  ledger. Do not load unless the user explicitly invokes lodestar-implement
  by name.
disable-model-invocation: true
license: MIT
compatibility: Requires git, Node.js, and the target repository's declared typecheck and test commands (n/a skips that check). npm, pnpm, yarn, and Bun are detected from lockfiles; any other manager works when recorded in context.md. Deno and Bazel are not supported.
metadata:
  author: Ilan Cohen
  version: "0.14.0"
---

You are running `lodestar-implement`. Execute a plan from the resolved
plans root, one stage at a time, until it is in `done/` and the ledger
row has moved.

Companion: `lodestar-plan`. The plan is the contract. Do not implement
from memory; re-read each stage before applying it.

Scripts live beside this `SKILL.md`. Reach shared plans code only through
[scripts/setup-modules.mjs](scripts/setup-modules.mjs). Drive state with:

```text
node <this-skill>/scripts/plan-state.mjs pick-up --root <repo> --plan <slug>
node <this-skill>/scripts/plan-state.mjs write-rigor --root <repo> --plan <slug> --rigor <tier> --reason <text>
node <this-skill>/scripts/plan-state.mjs move-done --root <repo> --plan <slug>
node <this-skill>/scripts/plan-state.mjs complete-ledger --root <repo> --plan <href> --evidence <text>
node <this-skill>/scripts/plan-state.mjs can-autosquash --root <repo>
```

Load references one hop from this file. A `light` run loads
[references/review-light.md](references/review-light.md) and must not load
`review-standard.md` or `review-full.md`.

## How to talk to the user

Anything you print or ask is read by a person who is skimming.

- Ask one clear question at a time. Say what happens for each answer.
- Name a file by its path, not by an internal key.
- Never trim or postpone a warning.
- Point first. Bullets, not paragraphs. Blank line between blocks.
- Bold the first few words of each bullet.

## Steps

1. **Locate** — [references/locate.md](references/locate.md). Pick the
   plan. Stop on a leftover copy in both the root and `done/`.
2. **Tier** — [references/tier.md](references/tier.md). Read or infer
   `rigor:`. Escalate automatically when size or complexity demands it.
3. **Execute** — [references/execute.md](references/execute.md). One
   stage, then the matching review file, until the plan is complete.
4. **Complete** — [references/complete.md](references/complete.md).
   `move-done` plus the ledger row. `light` folds this into the one
   commit; `standard` and `full` use a housekeeping commit.

## Never

- `git add -A`.
- Editing a plan body. Frontmatter (and a `Status:` line under a pass
  heading) is the only mutable channel.
- Guessing an unresolved decision. Stop and ask.
- Touching a file outside a stage's declared scope. Stop and ask.
- A second auto-fix pass after review still flags medium-or-higher
  issues. Hand off to the user.
