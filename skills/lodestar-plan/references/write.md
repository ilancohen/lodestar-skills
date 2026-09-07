# Write the plan and the ledger row

Do not commit unless the user asked.

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

## Ledger

After the files exist, add an Awaiting row. Do not add or retire a row by
hand; run:

```text
node <this-skill>/scripts/setup-modules.mjs add-awaiting --root <repo> --plan <href> --summary <one-line summary>
```

`<href>` is repo-relative to the plans root (`<slug>.md` or `<slug>/`).
The command is idempotent: a slug already in Awaiting is left alone —
including its summary, so re-running never corrects one.

Three parts of the ledger are parsed and must not be hand-edited: the
markdown link in a row's `Plan` cell, and the `## Awaiting Implementation`
and `## Done` headings. Only exact link syntax and exact heading text are
recognized. The link target is how a row is found again, so breaking any
of the three makes `complete-ledger` fail with `no Awaiting row matched`
when the plan finishes.

Summary and Evidence prose is not parsed and may be edited by hand — the
only rule is to escape any `|` inside a cell.

## Output

Summarize path, stages, open decisions, linked audit/spec. Do not
implement unless asked.
