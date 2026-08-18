# Plan

Load this file before writing action items. Discover must already have a
valid `findings.md`.

## Read findings

Parse every `### F<NNNN>` block. Write action items only for
`in_scope: true` findings. Out-of-scope findings stay in `findings.md`
and are counted in `INDEX.md`'s Backlog — do not drop them. Group the
in-scope set by `scope_unit`:

- Bundle findings that share a scope unit when the fix is one commit
  (example: two `cross-package-src` lines in the same file).
- Otherwise one action item per finding.

Assign action-item IDs as `001`, `002`, … over the files actually
written (category table order then file path). No gaps — a scoped run's
`001…0NN` is the working set, not a sparse subset of all findings.
Action-item IDs are independent of finding IDs.

Category order for files and INDEX (must match `lodestar-fix`):

`imports → types → ssot → soc-yagni → boundaries → errors →
testability → dry → styling`

## Write action items

For each item write
`<output-root>/<RUN_ID>/<NNN>-<category>-<slug>.md` from
`templates/action-item.md`. Fill every section. Copy fix steps, scope
rules, and acceptance check from `categories/<category>.md` with real
`<typecheck>` / `<lint>` / `<test>` / `<output-root>` values.

Slugs are kebab-case, at most five words.

If that path already exists from an interrupted Plan, skip it. Do not
overwrite.

After each file, run
`node scripts/audit-state.mjs validate-output --path <file>`.
Fix leftover placeholders in place before the next item.

## INDEX.md

Write `<output-root>/<RUN_ID>/INDEX.md` from `templates/index.md`:

- Run ID (directory name)
- Commands from `context.md` (`.agents/lodestar/context.md`)
- Totals by category, risk, and `requires_decision: true` (in-scope
  action items only)
- One row per action item
- Known blind spots from `SKILL.md`
- **Backlog** — always write `## Backlog`. When every finding is in
  scope (`mode: all`, or a `changed-since` run with nothing left out):
  "Every finding is in scope — there is no backlog for this run." Do
  not mention a baseline unless `mode` is `changed-since`. When there
  is a backlog, list per-category counts of `in_scope: false` findings,
  the `baseline-ref` sha and `baseline-date`, and that they were not
  expanded because they do not touch code changed since that commit.
  In-scope finding count + out-of-scope finding count = the
  `findings.md` total (not action-item count — bundling can merge
  in-scope findings).

## Report

Print counts by category and how many items need a human decision.
Point at `INDEX.md`. Do not start `lodestar-fix`.
