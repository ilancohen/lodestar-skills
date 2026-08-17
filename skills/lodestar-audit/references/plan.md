# Plan

Load this file before writing action items. Discover must already have a
valid `findings.md`.

## Read findings

Parse every `### F<NNNN>` block. Group by `scope_unit`:

- Bundle findings that share a scope unit when the fix is one commit
  (example: two `cross-package-src` lines in the same file).
- Otherwise one action item per finding.

Assign action-item IDs as `001`, `002`, … ordered by category table
order then file path. Action-item IDs are independent of finding IDs.

Category order for files and INDEX (must match `lodestar-fix`):

`imports → types → ssot → soc-yagni → boundaries → errors →
testability → dry → styling`

## Write action items

For each item write
`docs/audit/<RUN_ID>/<NNN>-<category>-<slug>.md` from
`templates/action-item.md`. Fill every section. Copy fix steps, scope
rules, and acceptance check from `categories/<category>.md` with real
`<typecheck>` / `<lint>` / `<test>` values.

Slugs are kebab-case, at most five words.

If that path already exists from an interrupted Plan, skip it. Do not
overwrite.

After each file, run
`node scripts/audit-state.mjs validate-output --path <file>`.
Fix leftover placeholders in place before the next item.

## INDEX.md

Write `docs/audit/<RUN_ID>/INDEX.md` from `templates/index.md`:

- Run ID (directory name)
- Commands from `context.md` (`.agents/lodestar/context.md`)
- Totals by category, risk, and `requires_decision: true`
- One row per action item
- Known blind spots from `SKILL.md`

## Report

Print counts by category and how many items need a human decision.
Point at `INDEX.md`. Do not start `lodestar-fix`.
