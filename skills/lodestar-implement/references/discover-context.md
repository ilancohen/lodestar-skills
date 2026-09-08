# Discover context when it is missing

Only when `.agents/lodestar/context.md` is absent. When it exists, read
it and skip this file.

A missing context file is never a stop. Do not tell the user to run
`lodestar-setup` first, and never write `context.md` yourself.

Order of precedence for a command: what the plan's `Accept` line says,
then what you discover here. A plan that names its own commands has
already answered this.

Find each fact from the repo. Existence checks and file reads only — no
tree walk.

| Fact            | Where it comes from                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manager | The one lockfile present (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lock(b)`).                                                                 |
| `<typecheck>`   | A `package.json` script named `typecheck` / `tsc` / `types`, or the equivalent task-file target.                                                              |
| `<test>`        | A `package.json` script named `test`, or the equivalent task-file target.                                                                                     |
| `<lint>`        | A `package.json` script named `lint`, or the equivalent task-file target.                                                                                     |
| Review rubric   | The installed `lodestar-setup/principles.md` (beside that skill's `SKILL.md`), plus whichever of `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`, and host-agent rules files exist. |

Rules:

- **No lockfile, or more than one.** Ask which manager this repo uses.
  Do not guess.
- **No script for a check.** That check is `n/a` and is skipped, exactly
  as a recorded `n/a` would be. Say which one you skipped. Do not invent
  a command.
- **Several plausible scripts** for one check (`test` and `test:unit`).
  Ask once, listing them, before the first stage runs.
- **Rubric.** Principles alone is a valid rubric. Do not turn a
  discovered guideline file into a repo-specific checklist; read it the
  same way `## Review Rubric` paths are read.

Print the resolved commands in the opening status block, before any edit,
so a wrong guess is visible while it is still cheap.

Mention `lodestar-setup` at most once, at the end, as optional: it records
these facts so later runs skip discovery. It is not a prerequisite.
