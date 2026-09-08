# Complete the plan

Mark the stage done via frontmatter (`status: done`, `completed_at`) or
a `Status: done — <date>` line under a single-file pass heading. Do not
require a SHA in the mark before the commit exists.

Commits on: commit first, then write `commit: <short-sha>` (or append
`, commit <sha>` on a Status line). Commits off: omit `commit:`.

Plan-end acceptance — skip for `light` (already ran once):

- **`standard`:** only integration checks for packages this plan touched.
- **`full`:** whole-repo typecheck / test / lint only when the plan
  crosses integration boundaries; otherwise reuse the last stage's
  scoped checks — no duplicate whole-repo sweep.

A failure here is a new sub-stage: fix, re-run, and (consent on) commit
`<plan-slug>: fix — cross-package regression` before the move.

Then one move — not a copy:

```text
node <this-skill>/scripts/plan-state.mjs move-done --root <repo> --plan <slug>
```

Creates `done/` if needed. Fails if both copies exist or the
post-condition fails. No ledger.

**Never** a docs-only housekeeping commit for the move.

With commits on, the last stage deferred its commit (see
[execute.md](execute.md)). Run `move-done`, then make **one** commit that
includes the final stage code, its done-mark, and the move. Write
`commit: <short-sha>` into the stage frontmatter after that commit (as a
working-tree edit if plans are gitignored).

With commits off: `move-done`, leave everything unstaged.

Print summary: stages done / skipped, commits (or "unstaged"), new path.
