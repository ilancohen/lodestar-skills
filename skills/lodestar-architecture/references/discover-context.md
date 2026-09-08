# Discover context when it is missing

Only when `.agents/lodestar/context.md` is absent. When it exists, read
it and skip this file.

A missing context file is never a stop. Do not tell the user to run
`lodestar-setup` first, and never write `context.md` yourself.

Find each fact from the repo, cheapest source first. Existence checks
and file reads only — no tree walk.

| Fact | Where it comes from |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Architecture root | Default `docs/architecture-review`. |
| Package manager | The one lockfile present (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lock(b)`). |
| Commands | `scripts` in the root `package.json` and in workspace packages; then `Makefile`, `justfile`, `Taskfile.y*ml`, `nx.json`, `turbo.json`. |
| Package layout | `pnpm-workspace.yaml`, `package.json` `workspaces`, `nx.json`, `turbo.json`, `lerna.json`; else the dirs holding a non-root `package.json`; else the single source root. |
| Dependency evidence | The imports that exist today between packages. Not policy. |
| Dependency Policy | Only when `context.md` exists and has `## Dependency Policy` — otherwise none. |

Rules for the harder ones:

- **No lockfile, or more than one.** Ask which manager this repo uses.
  Do not guess.
- **No command for a check.** That check does not exist. Treat it as
  `n/a` and say so in the report. Do not invent one.
- **No workspace declaration.** A single-package repo is normal. One
  source root is a complete layout.
- **Evidence vs policy.** Describe today's imports as evidence. Do not
  invent an intended layout. Without a recorded Dependency Policy there
  is nothing to contradict as policy — cycles and surprising edges are
  discussion points, not recorded violations.

Then, in one short block:

- **Name what you found** — manager, the commands, the packages.
- **Say where it came from** — observed in the repo, not a recorded file.
- **Ask for corrections** once, then continue with the answers.

Mention `lodestar-setup` at most once, at the end, as optional: it records
these facts so later runs skip discovery. It is not a prerequisite.
