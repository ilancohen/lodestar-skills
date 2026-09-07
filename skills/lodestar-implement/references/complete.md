# Complete the plan

Mark the stage done via frontmatter (`status: done`, `completed_at`) or
a `Status: done — <date>` line under a single-file pass heading. Do
**not** require a commit message or frontmatter field to contain its own
SHA before the commit exists.

When commits are enabled: create the commit first, then write
`commit: <short-sha>` (or append `, commit <sha>` on a Status line) as a
working-tree edit of the stage file. When commits are disabled: omit
`commit:` entirely.

When every stage is done, run — except `light`, which already ran
acceptance once and must not run a second sweep:

1. `<typecheck>` whole repo
2. `<test>` whole repo
3. `<lint>` whole repo if present

A failure here is a new sub-stage: fix, re-run, and (only when
`sessionCommits` allows) commit
`<plan-slug>: housekeeping — fix cross-package regression` before the
move.

Then **one** operation, not a copy:

```text
node <this-skill>/scripts/plan-state.mjs move-done --root <repo> --plan <slug>
node <this-skill>/scripts/plan-state.mjs complete-ledger --root <repo> --plan <slug-or-href> --evidence <text>
```

`move-done` fails if source and destination both exist, or if the
post-condition (source gone, destination present) is not true. Do not
paper over that.

`light` with commits on: these commands run before the single commit, so
the commit contains the code, the done-mark, the move, and the ledger
row. Write the SHA into frontmatter after that commit if desired.

`standard` / `full` with commits on: a final housekeeping commit
`<plan-slug>: housekeeping — move to done & update ledger`.

With commits off: run `move-done` and `complete-ledger` and leave the
working tree unstaged — no housekeeping commit.

Print the session summary: stages done / skipped, commits (or
"unstaged"), new path.
