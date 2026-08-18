---
name: lodestar-setup
description: >-
  Sets up the lodestar suite in a repository by documenting its package
  layout in .agents/lodestar/context.md, the one file the other lodestar
  skills read, which links to the bundled principles.md (never copied or
  inlined). Asks separately whether to add a pointer section to AGENTS.md
  so principles apply to every task (full suite) or to leave AGENTS.md
  untouched (skills-only). May also configure Fallow, gitignore entries,
  and existing linter rules with user consent. Do not load unless the
  user explicitly invokes lodestar-setup by name.
disable-model-invocation: true
license: MIT
compatibility: Requires filesystem write access and a POSIX-compatible shell for optional Fallow setup. Supports npm, pnpm, and yarn repositories.
metadata:
  author: Ilan Cohen
  version: "0.4.1"
---

Write the agent-neutral config the lodestar skills need. The one file that
matters is `.agents/lodestar/context.md`: package layout, dependency
direction, and build commands. `lodestar-audit`, `lodestar-fix`, and
`lodestar-architecture` read that file and nothing else for repo facts —
they never read `AGENTS.md`.

This requires only the information needed to fill in the templates — do not
do a broad repo survey, and do not propose architectural changes (the
`lodestar-architecture` skill exists for that).

Resolve every bundled template path relative to the directory containing this
`SKILL.md`. Paths beginning with `.agents/` below are output paths in the target
repository, not locations of this installed skill.

## What this skill does — and does not do

- **Does**: discover the packages that already exist, document each one
  (name, path, alias, one-sentence responsibility), record the observed
  package import graph, and write the config files agents read.
- **Does not**: force the repo's packages into a fixed list of roles
  (`core`, `api`, `ui`, etc.). The audit operates on whatever packages
  this skill documents.
- **Does not**: write an intended or target dependency direction, even when
  the observed graph is cyclic. If the user wants a proposed layout, point
  them at `lodestar-architecture` and stop.
- **Does not**: propose, suggest, or critique an alternative layout.
  If the user asks for that, point them at `lodestar-architecture` and
  stop — do not silently start a layout review.

## Step 1 — Collect the minimum required facts

Read only what's needed to fill in the template placeholders:

- **Package manager** — check for exactly one of `pnpm-lock.yaml`
  (pnpm), `yarn.lock` (yarn), or `package-lock.json` (npm). That sets
  the command prefix (`pnpm`, `yarn`, or `npm` / `npx`). If none or
  more than one is present, **ask the user** which of npm, yarn, or
  pnpm to use. Do not guess. Do not default to npm.
- **Build scripts** — read the root `package.json` `scripts` field.
  Identify the build, typecheck, lint, and test commands.
- **Package layout** — list every package or top-level source directory
  the audit should scan. Sources of truth, in order: `pnpm-workspace.yaml`
  / `package.json` `workspaces` if present; otherwise `ls packages/`,
  `ls apps/`, and any other top-level source dirs the repo uses. For each:
  - The package's own name (whatever the repo calls it — do not rename).
  - The path glob (e.g. `packages/server/src`, `apps/*/src`).
  - The import alias from `package.json` `name`, or `tsconfig.json`
    `paths`. If there's no alias, record `n/a`.
  - A one-sentence summary of what the package does, derived from its
    `README.md`, `package.json` `description`, or — last resort — a
    quick scan of its top-level exports. Keep it short and concrete
    ("HTTP routes and request validation", "domain entities and use
    cases", "DB and queue adapters").
- **Dependency direction** — build the package-level edge list (which
  packages import which, with a rough count), then check for cycles.
  Acyclic → topological order as a chain. Cyclic → record the edges and
  the cycle; do not order them. If the observation is ambiguous, ask the
  user once in Step 2 — do not guess silently or infer a target layout.
- **Existing files** — check whether `.agents/lodestar/context.md` already
  exists, and whether `AGENTS.md` exists and already has a `## Lodestar`
  section. If they do, read them briefly so you don't overwrite unrelated
  content. Older installs kept the layout table and command table in
  `AGENTS.md` — if you find them there, reuse those values for
  `context.md` and then strip those sections from `AGENTS.md` (see
  Step 5).

Stop there. Do not read tsconfig deeply, explore individual packages, check
for issue trackers, or investigate test frameworks beyond the scripts.
Do not try to map the discovered packages onto a canonical role list —
the table you write is keyed by the repo's own package names.

## Step 2 — Confirm one thing

Present a single short summary:

- The package manager you detected (or that you could not tell).
- The commands you found.
- The observed package import graph — acyclic chain or cyclic edge list,
  using the repo's actual package names.
- The Package Layout table you intend to write — one row per package,
  with name, path, alias, and the one-sentence responsibility you've
  drafted.

When the graph is cyclic, state plainly that it is cyclic, show the cycle
edges, and say they will be recorded as-is and reported by the audit as
circular dependencies. Ask the user to correct the graph only if the
_observation_ is wrong — do not ask them to declare a target layout.

If the package manager is unclear, ask which of npm, yarn, or pnpm to
use as part of this same confirmation. Do not proceed with install or
script prefixes until that is answered.

Ask the user to correct anything wrong. One round of feedback only.
Do not ask separate questions about coverage, branded types, or violations,
and do not ask whether the layout is "right" — that's `lodestar-architecture`'s
job, not setup's.

## Step 3 — Choose how principles get enforced

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
Step 5. This choice does not affect any other step — the layout table,
Fallow (Step 6), and linting (Step 7) run the same way regardless,
since `lodestar-audit` needs them whether or not principles are
auto-enforced.

## Step 4 — Write the files

Use the templates beside this `SKILL.md`. Fill every `[bracketed
placeholder]` with real values. Announce each file before writing it.

`principles.md` (beside this `SKILL.md`) is not one of them. It is the
single source of truth for the principles content, and every install of
this suite — regardless of which agent(s) it was installed for — always
also lands a real copy at the fixed path
`.agents/skills/lodestar-setup/principles.md` (the install tooling requests
the skills CLI's `universal` target for exactly this reason). Do not copy,
inline, or edit its content into any other file, and do not write
agent-specific files (`CLAUDE.md`, `.github/copilot-instructions.md`, or
similar) — `.agents/lodestar/context.md` just links to it. No placeholder
substitution is needed either: `principles.md` references
`.agents/lodestar/context.md`'s `## Build & Test` and `## Package Layout`
tables by name instead of embedding literal commands, so it reads correctly
untouched, in every consuming repo.

### .agents/lodestar/context.md

This is the load-bearing file. Start from `context-md.md`. Fill in:

- One-sentence project description.
- The exact commands in the Build & Test table.
- The observed import graph in whichever form applies (acyclic chain or
  cyclic edge list), plus a `Basis:` line with the capture date.
- The Package Layout table — one row per package discovered in Step 1.
  Use the repo's own names verbatim. Fill the Responsibility column with
  the one-sentence summary you drafted.

Leave the `## Principles` and `## Skills` sections as the template has
them — the principles link must stay pointed at
`.agents/skills/lodestar-setup/principles.md`.

If the file already exists, replace the `## Build & Test`,
`## Dependency Direction`, and `## Package Layout` sections and leave any
other content the user added alone.

Create the `.agents/lodestar/` directory if needed, and write to
`.agents/lodestar/context.md`. Write it in both enforcement modes — the
other three skills require it.

### AGENTS.md — only in `full` mode

If `ENFORCEMENT_MODE` is `skills-only`, **do not touch `AGENTS.md`**. Skip
to Step 5.

If it is `full`, take the `## Lodestar` section from `agents-md.md` and
append it to `AGENTS.md`, or replace an existing `## Lodestar` section with
it. Change nothing else in the file. Do not add a layout table, a command
table, or a skills index to `AGENTS.md` — those live in `context.md`, and
duplicating them there would guarantee drift.

If `AGENTS.md` does not exist, create it with a `# AGENTS.md` heading and
that one section.

### .agents/skills/README.md

Write `skills-readme.md` verbatim to `.agents/skills/README.md`. It has no
placeholders: it is a signpost to `.agents/lodestar/context.md` and
`principles.md` for anyone browsing `.agents/skills/`. No skill reads it.
Skip it if a README already exists there with other content.

## Step 5 — Clean up a pre-0.3 install

Older versions of this skill put the `## Build & Test`,
`## Dependency Direction`, `## Package Layout`, `## Skills`, and
`## Audit Output` sections in `AGENTS.md`. If you found any of them there
in Step 1, their values now live in `context.md`, so ask once:

> `AGENTS.md` still has the lodestar sections from an older setup. The
> skills now read `.agents/lodestar/context.md` instead. Remove those
> sections from `AGENTS.md`? (yes / leave them)

If yes, remove only those sections (plus the `## Lodestar` section if
`ENFORCEMENT_MODE` is `skills-only`) and leave the rest of `AGENTS.md`
untouched. If they decline, say that `AGENTS.md` now holds a second,
unread copy of the layout and that `context.md` is the one that counts.

## Step 6 — `.fallowrc.json` for the audit's fallow seed

The audit skill **requires** [fallow](https://docs.fallow.tools) as the
primary graph-based detector for `imports`, `dry`, and `soc-yagni`. When
configured, Fallow also supplies wrong-direction import findings. Without `.fallowrc.json`, boundary
violations are not detected by fallow and the audit falls back to a
heuristic grep for direction violations.

Decide whether to write it:

1. Prefer the version already in the project, then check `PATH`, via the
   lodestar-audit contract script (absolute path to
   `lodestar-audit/scripts/fallow-contract.mjs`):
   ```bash
   node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>
   ```
   ```powershell
   node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>
   ```
2. If fallow is not found or outside `^3.15.0`, tell the user:
   "fallow ^3.15.0 (combined schema 10 or newer) is required for lodestar-audit. Install with
   `<pm add -D fallow@^3.15.0>` using this repo's package manager (pnpm:
   `pnpm add -D fallow@^3.15.0`; npm: `npm install --save-dev fallow@^3.15.0`;
   yarn: `yarn add -D fallow@^3.15.0`). Write `.fallowrc.json` anyway so
   it's ready when fallow is installed?"
   Use the command for the manager already confirmed in Step 2. If that
   manager is still unknown, ask before quoting an install command.
3. If `.fallowrc.json` already exists, ask: "merge boundary section / leave
   alone / overwrite?"

If the user opts in, write `.fallowrc.json` from `fallowrc.md` beside this
`SKILL.md` (the template document contains the
JSON inside a fenced block). Substitute:

- One `boundaries.zones[]` entry per row in the `## Package Layout` table
  in `context.md`. The zone `name` is the package name from the table.
  Use the literal path glob from the table as the `patterns` value
  (wrapping bare directory paths to `<path>/**`). For a row with a glob
  like `apps/*/src`, prefer `"autoDiscover": ["apps"]` so each app
  becomes its own sub-zone (sibling apps end up isolated from each
  other, which is usually what you want).
- One `boundaries.rules[]` entry per package. The `allow` list is every
  package reachable from `from` in the documented graph (including cycle
  partners). For an acyclic chain this matches every package to the right
  in the chain. The tail-of-chain package with no downward edges gets
  `allow: []` (or only cycle partners when cyclic).

Write to `.fallowrc.json`.

Then ask separately before editing `.gitignore`:

> Add `.audit-fallow-seed.json` and `.fallow/` to `.gitignore`?
> (yes / no)

If the user agrees and `.gitignore` exists and does not already cover
them, add those two entries (`.audit-fallow-seed.json` is the audit's
transient seed cache; `.fallow/` is fallow's own cache directory). If
they decline, still write `.fallowrc.json` and say the gitignore entries
were skipped.

`.agents/lodestar/fallow-compat.json` is written by lodestar-audit when
it accepts a Fallow schema newer than the baseline. It is a team decision
and must be committed — never add it to `.gitignore`.

After writing, verify with the lodestar-audit contract script (absolute path to
the installed `lodestar-audit/scripts/fallow-contract.mjs`):

```bash
node <lodestar-audit-skill>/scripts/fallow-contract.mjs run \
  --root <repo> \
  --id list-boundaries \
  --out <repo>/.audit-fallow-boundaries.json
```

Every zone should report `file_count > 0`. A contract failure or a
zero-file zone means the config or Package Layout glob must be fixed
before continuing. Delete the temp JSON after reading it.

## Step 7 — (Optional) Linting rules for higher-accuracy audit findings

The lodestar-audit skill runs an opportunistic linter probe when detecting
`types` (#1, #3), `errors` (A, B), and `boundaries.B` violations. Enabling
the relevant rules in your existing linter config makes those findings
definitive rather than heuristic — no packages to install beyond what you
already use.

**Only do this if the project has a linter already configured.** Do not
set up a new linter or modify linter config without the user's consent.

Ask once whether they want to tighten ESLint / Biome rules for audit
accuracy. If they decline, skip. If they opt in, read
[linters.md](linters.md) and apply only the rules they confirm.

## Step 8 — Confirm

Print a one-line summary of each file written or updated (including
`.fallowrc.json` if Step 6 ran), and which `ENFORCEMENT_MODE` was used —
say plainly whether `AGENTS.md` was edited (`full`) or left alone
(`skills-only`).
Ask: "Does this look right? If so, run the `lodestar-audit`
skill to scan the codebase and produce action-item files in
`docs/audit/<run-id>/`. If the layout itself feels off, run
`lodestar-architecture` instead — it produces an advisory report and never
modifies source."

Do not run the audit automatically. Do not run `lodestar-architecture`
automatically. Setup is descriptive — anything evaluative is the other
skill's job.
