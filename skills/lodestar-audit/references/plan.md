# Plan

Load this file before writing action items. Discover must already have a
valid `findings.md`.

## Recover

```text
node scripts/audit-state.mjs recover --run-dir <output-root>/<RUN_ID>
```

Honor its phase recommendation before writing action items.

## Read findings

Parse every `### F<NNNN>` block. Write action items only for
`in_scope: true` findings. Out-of-scope findings stay in `findings.md`
and are counted in `INDEX.md`'s Backlog — do not drop them. Group the
in-scope set by `scope_unit`:

- Bundle findings that share a scope unit when the fix is one commit
  (example: two `cross-package-src` lines in the same file).
- Otherwise one action item per finding.

Assign action-item IDs as `001`, `002`, … over the files actually
written on the **first** Plan (category table order then file path). No
gaps. On promotion, skip findings that already have a matching
`*-<category>-<slug>.md`; assign new IDs from `max(existing NNN)+1`.
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

If that path already exists from an interrupted Plan **or a prior
promotion**, skip it. Do not overwrite.

When promoting a backlog slice onto a finished run, continue IDs from
the highest existing `NNN` so the new files append. Then rewrite
`INDEX.md` (Backlog counts must match remaining `in_scope: false`
findings).

After each file, run
`node scripts/audit-state.mjs validate-output --path <file>`.
Fix leftover placeholders in place before the next item.

## Known blind spots

Copy into `INDEX.md` Known blind spots. Start with the `blindSpots`
array from `validate-input` — it already contains convention-gated
skips, `Scannable: no` packages, and single-package not-applicable
entries in the correct order. Then append runtime entries:

1. If this run skipped the Fallow seed (`fallow: optional` and Fallow
   missing or invalid), append this prominently: **not checked at all**
   — `imports` #7–#9, `dry` A, `soc-yagni` A ranking.
2. Coverage floor when it is a number and `<test>` does not emit
   coverage.
3. Wide-diff DRY as `dry.C` advisory only.
4. Rule of Three beyond `soc-yagni.D`.
5. Whether the documented layout is the right one
   (`lodestar-architecture`).

Do not re-assemble convention gates, `Scannable: no` packages, or
single-package entries — those are already in `validate-input`
`blindSpots`.

## INDEX.md

Write `<output-root>/<RUN_ID>/INDEX.md` from `templates/index.md`:

- Run ID (directory name)
- Commands from `context.md` (`.agents/lodestar/context.md`)
- Totals by category, risk, and `requires_decision: true` (in-scope
  action items only)
- One row per action item
- Known blind spots from the list above
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
