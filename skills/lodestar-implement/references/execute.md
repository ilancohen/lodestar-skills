# Execute a stage

Re-read the stage. Honor its file list. If you must touch a file outside
it, stop and ask.

**Decision gate.** `Requires decision` / `Rides D<N>` / unresolved
Decision Points → stop. Print the question, the options, and the default
if any. Record the choice in frontmatter, then continue. If the user
defers, mark `status: deferred` with a one-line reason and stop.

Apply the change. Walk the review rubric from `## Review Rubric` (or
principles only). Do not invent extra checklist items.

**Acceptance**, every stage, before commit:

1. `<typecheck>`
2. `<test>` scoped to packages this stage touched (`light`: one unscoped
   run, no separate plan-end sweep)
3. `<lint>` if the stage touches lint-covered code

A failure that is a by-product of the edits: fix and re-run. A failure
that means the plan is wrong: stop and ask.

Then load **only** the review file for the effective tier:

- `light` → [review-light.md](review-light.md) after the single stage
- `standard` → nothing until the last stage, then `review-standard.md`
- `full` → `review-full.md` after every stage

**Commit.** One stage, one commit, except `light` which also folds
complete into that commit. Stage only the files this stage changed, plus
the done-mark. Never `git add -A`.

```
<plan-slug>: <stage id> — <one-line summary>

Plan: <plansRoot>/<plan>
Stage: <stage id>
```

After the last stage, go to [complete.md](complete.md).
