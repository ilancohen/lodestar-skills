# Write the plan

Do not commit unless the user asked.

Create the plans root only now — after grounding succeeded:

```text
node <this-skill>/scripts/setup-modules.mjs ensure-root --root <repo>
```

That creates `<plansRoot>` alone. It does not create `done/`,
`abandoned/`, or a README. An optional human README is never parsed.

## Single-file

```markdown
---
rigor: <light|standard|full>
---

# <Title>

**Status:** pending
**Source / Issues:** [optional links]

<goal + out-of-scope>

## Execution order

| #   | Stage | Done when |
| --- | ----- | --------- |

## Pass 1 — <title>

**Scope / files:** …
**Action:** …
**Done when:** …
**Accept:** …  # optional; else implement uses project defaults
**Requires decision:** …  # only if needed
```

Stages are top-level `## Pass` / `## Gap` / `## Step` only. The execution
order table is a summary, not a second stage list. An undivided file is
one stage.

## Folder plan

```
<plansRoot>/<slug>/
  README.md           # design only — not a stage
  00-<name>.md
  01-<name>.md
```

The folder `README.md` carries `rigor:` and the design. Sub-plans use
the same fields as a Pass. Optional frontmatter `status: pending`.
`Sequenced after: <file>` only when required. Lexicographic `NN-` names.

## Quality

- Verifiable Done when. Accept optional but preferred when checks are known.
- No speculative work. Link a spec instead of inlining a large rubric.
- File lists you believe are accurate — implement may ask to amend them
  if reality diverged.

## State

The filesystem is the index. A pending plan is a `.md` file or folder
directly under the plans root. Completed plans live under `done/`;
abandoned under `abandoned/`. There is no machine-parsed ledger and no
`add-awaiting` step.

## Output

Summarize path, stages, open decisions, linked audit/spec. Do not
implement unless asked.
