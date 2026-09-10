---
name: lodestar-implement
description: >-
  Executes a plan from the resolved plans root one stage at a time at the
  declared rigor: light | standard | full tier. Acceptance rises with risk
  and integration surface. Moves finished plans to done/; filesystem is
  the index — no ledger. Modifies application source and may commit with
  consent. Do not load unless the user explicitly invokes lodestar-implement
  by name.
disable-model-invocation: true
license: MIT
compatibility: Requires git, Node.js, and the target repository's typecheck and test commands — read from .agents/lodestar/context.md when present, otherwise discovered from the repo (a check with no command is skipped). lodestar-setup is not a prerequisite. Lockfiles detect npm, pnpm, yarn, and Bun; other managers via context.md. No Deno or Bazel.
metadata:
  author: Ilan Cohen
  version: "0.18.2"
---

You are running `lodestar-implement`. Execute a plan from the resolved
plans root, one stage at a time, until it is in `done/`.

Companion: `lodestar-plan`. The plan is the contract. Do not implement
from memory; re-read each stage before applying it.

Scripts live beside this `SKILL.md`. Reach shared plans code only through
[scripts/setup-modules.mjs](scripts/setup-modules.mjs). Drive state with:

```text
node <this-skill>/scripts/plan-state.mjs pick-up --root <repo> --plan <slug>
node <this-skill>/scripts/plan-state.mjs list --root <repo>
node <this-skill>/scripts/plan-state.mjs write-rigor --root <repo> --plan <slug> --rigor <tier> --reason <text>
node <this-skill>/scripts/plan-state.mjs move-done --root <repo> --plan <slug>
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

### Milestones

Concise chat progress — not diagnostic logs or run files:

- **Opening** — plan path, rigor, checks, mutation/commit policy
- **Before long work** — current stage id
- **At boundaries** — completed stages and next stage
- **Closing** — artifacts, skipped checks, actionable failures

## Steps

1. **Locate** — [references/locate.md](references/locate.md). Pick the
   plan. Stop on a leftover copy in both the root and `done/`.
2. **Discover** — [references/discover-context.md](references/discover-context.md).
   Only when `.agents/lodestar/context.md` is missing: find the commands
   and rubric in the repo. Never a stop, and never a hand-off to
   `lodestar-setup`.
3. **Tier** — [references/tier.md](references/tier.md). Read or infer
   `rigor:`. Escalate automatically when size or complexity demands it.
4. **Execute** — [references/execute.md](references/execute.md). One
   stage, then the matching review file, until the plan is complete.
5. **Complete** — [references/complete.md](references/complete.md).
   `move-done` only. Fold into the final code commit when safe; never a
   docs-only housekeeping commit.

## Never

- `git add -A`.
- Editing a plan body. Frontmatter (and a `Status:` line under a pass
  heading) is the only mutable channel.
- Guessing an unresolved decision. Stop and ask.
- Touching a file outside a stage's declared scope. Stop and ask.
- A second auto-fix pass after review still flags medium-or-higher
  issues. Hand off to the user.
