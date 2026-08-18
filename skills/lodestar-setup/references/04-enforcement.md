# Step 4 — Choose how principles get enforced

`.agents/lodestar/context.md` gets written either way — the other three
skills require it and won't run without it. What's optional is whether
`AGENTS.md` gets a short `## Lodestar` section telling _every_ agent, on
_every_ task, to check the principles. That's a bigger blast radius than
the rest of setup, so ask about it on its own:

> Should these principles apply automatically to every task any agent does
> in this repo, or only when someone explicitly runs a lodestar skill
> (`lodestar-audit`, `lodestar-fix`, `lodestar-architecture`)?
>
> - **Full suite** — add a short `## Lodestar` section to `AGENTS.md` that
>   tells every agent to check the principles before completing any task,
>   and points at `.agents/lodestar/context.md`.
> - **Skills-only** — leave `AGENTS.md` untouched. The skills still work
>   when invoked; nothing applies the principles unprompted.

Record the answer as `ENFORCEMENT_MODE` (`full` or `skills-only`) for
Steps 5 and 6. This choice does not affect any other step — layout,
conventions, Git, Fallow (Step 7), and linting (Step 8) run the same
way regardless.
