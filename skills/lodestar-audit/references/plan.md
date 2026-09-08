# Plan

Load this file before writing action items. Discover must already have a
valid `findings.md`.

## Recover

```text
node scripts/audit-state.mjs recover --run-dir <output-root>/<RUN_ID>
```

Honor its phase recommendation before writing action items.

## Choose an expansion slice

After Discover (or when promoting), ask which findings need fix
instructions — expand **only** that slice; leave the rest as compact
findings in `findings.md`:

- **Recommended** — low-risk, `requires_decision: false`, in the current
  scan scope
- **One category** or **one package**
- **All** findings in this run
- **Stop** — write nothing; run stays resumable

Flip `in_scope: true` only on the chosen slice before writing files. A
large finding set must not automatically produce a large action-item set.

## Read findings

Parse every `### F<NNNN>` block. Write action items only for
`in_scope: true` findings. Compact (`in_scope: false`) findings stay in
`findings.md` and are counted in `INDEX.md`'s Backlog (not expanded) —
do not drop them. Group the in-scope set by `scope_unit`:

- Bundle findings that share a scope unit when the fix is one commit
  (example: two `cross-package-src` lines in the same file).
- Otherwise one action item per finding.

**One concern per item.** Split "and also…". Multi-stage or
cross-package redesign belongs to `lodestar-plan`, not an action item.

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
`templates/action-item.md`. Keep each file a **single-concern contract**:

- Concrete evidence in **Problem**
- Requested change in **Suggested fix**
- **Decision** only when `requires_decision: true`
- **Scope exceptions** only for item-specific overrides (omit when
  resident `lodestar-fix` rules suffice — do not copy whole category
  docs or generic "do not edit outside `files:`" boilerplate)
- **Acceptance check** with real commands substituted

Do **not** write "Why this matters", "Prompt for an agent", or
verbatim category Scope rules blocks.

Slugs are kebab-case, at most five words.

If that path already exists from an interrupted Plan **or a prior
promotion**, skip it. Do not overwrite.

When promoting a backlog slice onto a finished run, continue IDs from
the highest existing `NNN` so the new files append. Then rewrite
`INDEX.md` (Backlog counts must match remaining `in_scope: false`
findings).

After each file, run
`node scripts/audit-state.mjs validate-output --path <file> --root <repo>`.
That checks frontmatter (`scope` / `findings` top-level), non-empty
`files:`, finding links, problem/evidence, concrete fix, optional scope
exceptions, acceptance, risk, and `requires_decision`. Fix failures in
place before the next item. Malformed YAML indentation, placeholders,
unknown values, and paths outside the repository are rejected.

Before writing `INDEX.md`, validate the whole run:

```text
node scripts/audit-state.mjs validate-output --path <output-root>/<RUN_ID> --root <repo>
```

Do not write `INDEX.md` until that passes.

**Non-batched acceptance (for executors).** When an item is applied alone,
a failed acceptance check leaves it `deferred` with the exact failure in
`note:`, keeps the diff in the working tree, and never moves it to
`done/`. The item stays resumable.

## Known blind spots

Copy into `INDEX.md` Known blind spots. Start with the `blindSpots`
array from `validate-input` — it already contains convention-gated
skips, `Scannable: no` packages, and single-package not-applicable
entries in the correct order. Then append runtime entries:

1. Coverage floor when it is a number and `<test>` does not emit
   coverage.
2. Wide-diff DRY as `dry.C` advisory only.
3. Rule of Three beyond `soc-yagni.D`.
4. Whether the documented layout is the right one
   (`lodestar-architecture`).
5. When Discover used a file or category subset: state that other
   files/categories were **not scanned** (no exact whole-repo backlog
   count).

Do not re-assemble convention gates, `Scannable: no` packages, or
single-package entries — those are already in `validate-input`
`blindSpots`. There is no fallow-optional blind-spot line — missing
Fallow stops Discover.

## INDEX.md

Write `<output-root>/<RUN_ID>/INDEX.md` from `templates/index.md`:

- Run ID (directory name)
- Commands from `context.md` (`.agents/lodestar/context.md`)
- **Scan scope** — what was scanned (categories; `all` or changed-since
  baseline + file count). When scoped, say the rest of the repo was not
  scanned — do not invent an exact unscanned finding count.
- Totals by category, risk, and `requires_decision: true` (in-scope
  action items only)
- One row per action item
- Known blind spots from the list above
- **Backlog** — always write `## Backlog`. This is findings still
  compact (`in_scope: false`) — not yet expanded into fix instructions.
  When every finding is expanded: "Every finding is in scope — there is
  no backlog for this run." When some remain compact, list per-category
  counts. In-scope finding count + compact count = the `findings.md`
  total (not action-item count — bundling can merge in-scope findings).
  Do not equate backlog with "whole repo issues we found but skipped."

## Report

Print counts by category and how many items need a human decision.
Point at `INDEX.md`. Do not start `lodestar-fix`.
