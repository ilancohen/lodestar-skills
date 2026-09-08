# Clean up a pre-0.3 install

Honor the permissions tick `agents-cleanup` only.

If ticked: remove only the listed legacy sections from `AGENTS.md`
(plus `## Lodestar` when still `skills-only`). Leave everything else.

If unticked or omitted: leave `AGENTS.md` alone. If legacy sections
remain, note once that `context.md` is the copy that counts.

`record-result` immediately (`changed|skipped|failed` + path + remedy).
Never invent paths from dirty git.
