# Execute a stage

**Opening commit choice** (once per session, before the first stage).
Read a recorded commit policy from `context.md` `## Audit Configuration`
when present (`commits: per-item` → commit each stage; `never` → leave
unstaged; `ask` or absent → ask). Otherwise ask once:

> Commit each stage as I finish it, or leave every change unstaged for
> you? (commit each / leave unstaged)

Hold the answer as `sessionCommits`. Never commit, amend, rebase, or
rewrite history without that consent. A protected-branch policy that
forces `never` for the session still applies.

Re-read the stage. Honor its file list. If you must touch a file outside
it, stop and ask.

**Decision gate.** `Requires decision` / `Rides D<N>` / unresolved
Decision Points → stop. Print the question, the options, and the default
if any. Record the choice in frontmatter, then continue. If the user
defers, mark `status: deferred` with a one-line reason and stop.

Apply the change. Walk the review rubric from `## Review Rubric` (or
principles only). Do not invent extra checklist items.

**Acceptance**, every stage, before any commit:

1. `<typecheck>`
2. `<test>` scoped to packages this stage touched (`light`: one unscoped
   run, no separate plan-end sweep)
3. `<lint>` if the stage touches lint-covered code

A failure that is a by-product of the edits: fix and re-run. A failure
that means the plan is wrong: stop and ask. Never mark the stage done
after a failed check.

Then load **only** the review file for the effective tier:

- `light` → [review-light.md](review-light.md) after the single stage
- `standard` → nothing until the last stage, then `review-standard.md`
- `full` → `review-full.md` after every stage

**Commit** only when `sessionCommits` allows it. One stage, one commit,
except `light` which also folds complete into that commit. Stage only
the files this stage changed, plus the done-mark. Never `git add -A`.
When commits are disabled, leave everything unstaged and still write
done-mark frontmatter without a `commit:` field.

```
<plan-slug>: <stage id> — <one-line summary>

Plan: <plansRoot>/<plan>
Stage: <stage id>
```

After the last stage, go to [complete.md](complete.md).
