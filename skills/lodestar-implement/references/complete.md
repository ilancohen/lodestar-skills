# Complete the plan

Mark the stage done via frontmatter (`status: done`, `completed_at`,
`commit`) or a `Status: done — <date>, commit <sha>` line under a
single-file pass heading. Rewrite the SHA after the commit exists.

When every stage is done, run — except `light`, which already ran
acceptance once and must not run a second sweep:

1. `<typecheck>` whole repo
2. `<test>` whole repo
3. `<lint>` whole repo if present

A failure here is a new sub-stage: fix, re-run, commit
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

`light`: these commands run before the single commit, so the commit
contains the code, the done-mark, the move, and the ledger row.

`standard` / `full`: a final housekeeping commit
`<plan-slug>: housekeeping — move to done & update ledger`.

Print the session summary: stages done / skipped, commits, new path.
