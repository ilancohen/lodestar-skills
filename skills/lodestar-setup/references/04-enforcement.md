# Step 4 — Choose how principles get enforced

`.agents/lodestar/context.md` gets written either way — the other three
skills require it and won't run without it. What's optional is whether
`AGENTS.md` gets a short `## Lodestar` section telling _every_ agent, on
_every_ task, to check the principles. That's a bigger blast radius than
the rest of setup, so ask about it on its own:

> One more choice: when should these coding principles apply?
>
> - **On every task** — I add a few lines to `AGENTS.md` telling any AI
>   agent working in this repo to check the principles before it finishes
>   anything, whatever it was asked to do.
> - **Only when asked** — I leave `AGENTS.md` alone. The principles apply
>   only when someone runs a lodestar skill by name.
>
> Either way the setup file gets written and the skills work.

Record "on every task" as `ENFORCEMENT_MODE: full` and "only when asked"
as `ENFORCEMENT_MODE: skills-only` for
Steps 5 and 6. This choice does not affect any other step — layout,
conventions, Git, Fallow (Step 7), and linting (Step 8) run the same
way regardless.
