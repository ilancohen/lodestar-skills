---
name: create-plan
description: Create an implementable plan under docs/plans/ (YYYY-MM-DD-<slug>.md or <slug>/ with numbered stages) for implement-plan. Use when writing a plan, breaking work into stages, or turning an approach into an executable plan.
---

# Create Plan

Pipeline: **organize → create → implement**. Companions: [organize-plan-docs](../organize-plan-docs/SKILL.md), [implement-plan](../implement-plan/SKILL.md).

Write a **plan** under `docs/plans/`. Plans are _how_; link `docs/audit/` findings or `docs/spec/` for _what_ / reference. Don't commit unless asked.

## Before writing

1. Clarify goal, constraints, success. Read audit findings, specs, and code — don't invent scope.
2. List unresolved decisions as `Requires decision` / `Rides D<N>` (gates, not guesses).
3. Home: always `docs/plans/` (in-flight). Completed work goes to `docs/plans/done/` via implement-plan; do not write new plans into `done/` or `abandoned/`.
4. Shape:

| Shape | When |
| --- | --- |
| `docs/plans/YYYY-MM-DD-<slug>.md` | Fits one session (prefer date prefix; plain `<slug>.md` ok for short names) |
| `docs/plans/YYYY-MM-DD-<slug>/` or `docs/plans/<slug>/` | Too big for one session, or stages relatively independent |

Each folder sub-plan should be independently shippable when possible. Prefer fewer coarse stages. Add an Awaiting row to `docs/plans/README.md` (the ledger).

## Single-file

```markdown
# <Title>

**Status:** pending
**Source / Issues:** [optional links to docs/audit/… or docs/spec/…]

<goal + out-of-scope>

## Execution order

| #   | Stage | Done when |
| --- | ----- | --------- |

## Pass 1 — <title>

**Scope / files:** …
**Action:** …
**Done when:** … # behavior / outcome
**Accept:** … # optional commands; else implement uses project defaults
**Requires decision:** … # only if needed

## Pass 2 — …
```

Stages = `## Pass` / `## Gap` / `## Step` only. Execution order table is a **summary**, not a second stage list. Undivided file = one stage.

## Folder plan

```
docs/plans/<slug>/
  README.md           # design only — not a stage
  00-<name>.md
  01-<name>.md
```

Sub-plans: same fields as a Pass (`Scope / files`, `Action`, `Done when`, optional `Accept`). Optional frontmatter `status: pending`. `Sequenced after: <file>` only when required. Lexicographic `NN-` names.

## Quality

- Verifiable Done when; Accept optional but preferred when checks are known.
- No speculative work. Link `docs/spec/…` instead of inlining large rubrics.
- implement may later ask to amend scope/file lists if reality diverged — write lists you believe are accurate.

## Output

Create files. Summarize path, stages, open decisions, linked audit/spec. Do not implement unless asked.
