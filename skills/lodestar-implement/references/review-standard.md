# Review — standard

Once, at plan end, over the cumulative diff. Do not review per stage.

Spawn a generic review sub-agent with the plan content, the cumulative
diff, and the rubric from `## Review Rubric`. If the host provides a
named `code-reviewer` type, use that as an optional optimization. If the
host has no sub-agents, review inline against the same rubric.

Filter to medium-or-higher confidence.

**Fixes land as guarded fixups.** Per issue: `git commit --fixup <stage-sha>`.
Then one `git rebase --autosquash`. First run:

```text
node <this-skill>/scripts/plan-state.mjs can-autosquash --root <repo>
```

If it is not `ok` (dirty tree, commits already on the remote, or
`unpushed` smaller than this plan's stage count), **do not rebase**.
Make a plain follow-up commit and say so.

One auto-fix pass, then re-review. A second medium-or-higher round:
stop and ask (fix / defer / override).
