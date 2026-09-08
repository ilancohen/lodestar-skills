# Discover context when it is missing

Only when `.agents/lodestar/context.md` is absent. When it exists, read
it and skip this file.

A missing context file is never a stop when discovery or a named
`--tree` / `--full` can proceed. Do not tell the user to run
`lodestar-setup` first, and never write `context.md` yourself.

Find each fact from the repo, cheapest source first:

| Fact | Where it comes from |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Output root | Default `docs/audit` when that tree (or its `done`/`abandoned`) exists; else omit until observed. |
| Architecture root | Default `docs/architecture-review`. |
| Docs layout | Observe the same way setup's `discover-docs.mjs` would: existing docs trees with guessed roles. |
| Commit policy | Default `ask`. |

Rules:

- **Nothing to sweep.** If observation finds no staging trees and the
  user named no folder, say so and stop. Do not invent folders.
- **Named tree.** Survey only that path (`--tree`).
- **`--full`.** Survey `docs/` when it exists.

Mention `lodestar-setup` at most once, at the end, as optional: it
records docs roles so later runs skip discovery. It is not a
prerequisite.
