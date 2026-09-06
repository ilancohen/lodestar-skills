# Review — full

Every stage. Spawn a generic review sub-agent with that stage's content,
its diff, and the rubric from `## Review Rubric`. Named `code-reviewer`
when the host provides one; inline self-review when it has no
sub-agents.

Skip the sub-agent only when the stage itself declared a lower tier for
mechanical work (rename, move, hoist, comment removal) **and** the diff
matches that claim.

Filter to medium-or-higher. One auto-fix pass, then re-review. A second
medium-or-higher round: stop and ask (fix / defer / override with
`review-override` in the commit body).
