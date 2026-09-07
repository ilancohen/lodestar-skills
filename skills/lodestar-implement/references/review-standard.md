# Review — standard

Once, at plan end, over the cumulative diff. Do not review per stage.

Spawn a generic review sub-agent with the plan content, the cumulative
diff, and the rubric from `## Review Rubric`. If the host provides a
named `code-reviewer` type, use that as an optional optimization. If the
host has no sub-agents, review inline against the same rubric.

Filter to medium-or-higher confidence.

**Fixes stay ordinary commits — never autosquash.** No
`git commit --fixup`, no `git rebase --autosquash`, no history rewrite.

- If the stage commit is not made yet, fold review fixes into that
  commit.
- If the stage was already committed and `sessionCommits` allows it,
  make one plain follow-up commit and say so.
- If commits are disabled, leave the fixes unstaged.

One auto-fix pass, then re-review. A second medium-or-higher round:
stop and ask (fix / defer / override).
