---
name: lodestar-setup
description: >-
  Sets up the lodestar suite in a repository by documenting its package
  layout and which of a short list of conventions it already follows in
  .agents/lodestar/context.md, the one file the other lodestar skills
  read, which links to the bundled principles.md (never copied or
  inlined). Asks separately whether to add a pointer section to AGENTS.md
  so principles apply to every task (full suite) or to leave AGENTS.md
  untouched (skills-only). With separate user consent it may also install
  Fallow as a devDependency (writing package.json and the lockfile), write
  .fallowrc.json, add gitignore entries, and tighten existing linter rules.
  Do not load unless the user explicitly invokes lodestar-setup by name.
disable-model-invocation: true
license: MIT
compatibility: Requires filesystem write access and a POSIX-compatible shell for optional Fallow setup, plus network access if you accept the optional Fallow install. Supports npm, pnpm, and yarn repositories.
metadata:
  author: Ilan Cohen
  version: "0.5.0"
---

Write the agent-neutral config the lodestar skills need. The one file that
matters is `.agents/lodestar/context.md`: package layout, dependency
direction, build commands, and which conventions the repo already follows.
`lodestar-audit`, `lodestar-fix`, and `lodestar-architecture` read that
file and nothing else for repo facts — they never read `AGENTS.md`.

This requires only the information needed to fill in the templates — do not
do a broad repo survey, and do not propose architectural changes (the
`lodestar-architecture` skill exists for that).

Resolve every bundled template path relative to the directory containing this
`SKILL.md`. Paths beginning with `.agents/` below are output paths in the target
repository, not locations of this installed skill.

## What this skill does — and does not do

- **Does**: discover the packages that already exist, document each one
  (name, path, alias, one-sentence responsibility), record the observed
  package import graph, record which of a short list of conventions the
  repo already follows, and write the config files agents read.
- **Does not**: force the repo's packages into a fixed list of roles
  (`core`, `api`, `ui`, etc.). The audit operates on whatever packages
  this skill documents.
- **Does not**: write an intended or target dependency direction, even when
  the observed graph is cyclic. If the user wants a proposed layout, point
  them at `lodestar-architecture` and stop.
- **Does not**: propose, suggest, or critique an alternative layout.
  If the user asks for that, point them at `lodestar-architecture` and
  stop — do not silently start a layout review.

## Step 0 — Confirm the repo is scannable

Count TS/JS files (`source-scan` include list) by extension across
top-level source dirs, excluding `node_modules` and `.git`. Count
only. Tally other extensions (`.py`, `.go`, `.rs`, …) in the same pass.

- **Zero scannable files** → **stop**. Write nothing. Name the
  languages found with counts. Do not offer a partial setup.
- **Some scannable, some not** → continue; carry counts into Step 1.

## Step 1 — Collect the minimum required facts

Read only what's needed to fill in the template placeholders:

- **Package manager** — check for exactly one of `pnpm-lock.yaml`
  (pnpm), `yarn.lock` (yarn), or `package-lock.json` (npm). That sets
  the command prefix (`pnpm`, `yarn`, or `npm` / `npx`). If none or
  more than one is present, **ask the user** which of npm, yarn, or
  pnpm to use. Do not guess. Do not default to npm.
- **Build scripts** — read the root `package.json` `scripts` field.
  Identify the build, typecheck, lint, and test commands.
- **Package layout** — observe, in order: workspace files
  (`pnpm-workspace.yaml`, `package.json` `workspaces`, `nx.json`,
  `turbo.json`, `lerna.json`); else every non-root `package.json`
  (reasonable depth, skip Excluded Paths); else single-package: look
  one level into `src/` (or `main`/`exports`) for feature/module dirs
  and offer those as rows, or one row for the source root. Record how
  it was found. Directory rows are valid. For each:
  - Name, path glob, alias (`package.json` `name`, `tsconfig` `paths`,
    `imports` map, or bundler alias; else `n/a`).
  - Entry points: `exports` subpaths, `typesVersions`, or `main` /
    `module` / `types`; else `index.ts`.
  - One-sentence responsibility. `Scannable: no` + language if none.
- **Excluded paths** — gitignored paths inside layout globs; codegen
  configs (`prisma/schema.prisma`, `codegen.yml`/`ts`, `*.proto`,
  `openapi*.y?ml`) and their output; dirs named `generated`,
  `__generated__`, `dist`, `build`, `.next`, `.output`; `*.gen.ts` /
  `*.generated.ts`; `@generated` / "do not edit" banners. Tests: which
  of `*.test.*`, `*.spec.*`, `__tests__/`, `tests/` appear.
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
  Step 6).
- **Conventions evidence** — a short, bounded sweep so Step 3 can
  pre-check from evidence. Record paths (or "not found"), not a
  judgment. Stop at the first hit per signal; do not walk the whole
  tree.
  - `result-types`: a `Result` / `Either` type or `ok:` discriminant
    exported from a package in the layout table (search those packages'
    public `index.ts` and a file named `result.ts` / `either.ts` if
    present).
  - `branded-types`: `& { readonly __brand` under the layout globs
    (one grep, first hit).
  - `barrel-exports`: `export *` in any package `index.ts` named by the
    layout table.
  - `design-tokens`: a `tokens.css`, `theme.ts`, or a CSS custom-property
    block (`:root` with `--`) at the repo root or a layout package root.
  - `coverage-floor`: a coverage threshold in the test runner config the
    Build & Test `test` script already points at (vitest / jest / c8
    `coverage.thresholds` or equivalent).

Stop there. Do not read tsconfig deeply, explore individual packages, check
for issue trackers, or investigate test frameworks beyond the scripts and
the coverage threshold above.
Do not try to map the discovered packages onto a canonical role list —
the table you write is keyed by the repo's own package names.

## Step 2 — Confirm one thing

Present a single short summary:

- The package manager you detected (or that you could not tell).
- The commands you found.
- The observed package import graph — acyclic chain or cyclic edge list,
  using the repo's actual package names.
- How the layout was found, and the table — name, path, alias, entry
  points, responsibility, Scannable. Name unscannable rows. An empty
  graph is valid for a single-package repo.

When the graph is cyclic, state plainly that it is cyclic, show the cycle
edges, and say they will be recorded as-is and reported by the audit as
circular dependencies. Ask the user to correct the graph only if the
_observation_ is wrong — do not ask them to declare a target layout.

If the package manager is unclear, ask which of npm, yarn, or pnpm to
use as part of this same confirmation. Do not proceed with install or
script prefixes until that is answered.

Ask the user to correct anything wrong. One round of feedback only.
Do not ask about conventions here — that is Step 3. Do not ask whether
the layout is "right" — that's `lodestar-architecture`'s job, not setup's.
Then a second confirmation: excluded-path candidates with evidence,
one round to add/remove (empty allowed). Write `## Excluded Paths`
from that answer in both enforcement modes.

## Step 3 — Confirm which conventions the repo already follows

Present one multi-select, pre-checked from the Step 1 sweep, with the
evidence shown per row. Frame it as what the repo already does, not as
what to enforce:

> Which of these does this repo already follow? Pre-checked from a
> short evidence sweep — uncheck anything that doesn't match. One
> round of feedback.
>
> - [ ] `result-types` — expected failures return `Result<T, E>`
>       (evidence: `<path>` / not found)
> - [ ] `branded-types` — domain identifiers are branded types
>       (evidence: `<path>` / not found)
> - [x] no `export *` barrels (`barrel-exports: no`)
>       (evidence: `export *` found at `<path>` / none — none → checked)
> - [ ] `design-tokens` — styling uses design tokens
>       (evidence: `<path>` / not found)
> - coverage floor: `<N or none>` (evidence: `<path>: <N>` / not found;
>   default 80)

Pre-check per row from evidence — do not apply one rule to every row:

- `result-types` / `branded-types` / `design-tokens`: check when the
  signal was found; leave unchecked when not found.
- no `export *` barrels: check when **no** `export *` was found (the
  default); uncheck when one was. The quote above shows the default.
- coverage: pre-fill the number from the test config, or `80` when not
  found.

Record the answers as the `## Conventions` table values:

- checked `result-types` / `branded-types` / `design-tokens` → `yes`;
  unchecked → `no`
- checked "no `export *`" → `barrel-exports: no`; unchecked → `yes`
  (barrels allowed)
- coverage floor → the confirmed integer or `none`

Do not ask a second question. Setup stays descriptive.

## Step 4 — Choose how principles get enforced

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
Steps 5 and 6. This choice does not affect any other step — the layout
table, the conventions table, Fallow (Step 7), and linting (Step 8) run
the same way regardless, since `lodestar-audit` needs them whether or not
principles are auto-enforced.

## Step 5 — Write the files

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
`.agents/lodestar/context.md`'s `## Build & Test`, `## Package Layout`,
and `## Conventions` tables by name instead of embedding literal
commands, so it reads correctly untouched, in every consuming repo.

### .agents/lodestar/context.md

This is the load-bearing file. Start from `context-md.md`. Fill in:

- One-sentence project description.
- The exact commands in the Build & Test table.
- The observed import graph in whichever form applies (acyclic chain or
  cyclic edge list), plus a `Basis:` line with the capture date.
- The Package Layout table — one row per package discovered in Step 1,
  using the repo's own names. Fill Responsibility, `Scannable`, and
  Entry points (`index.ts` if undeclared).
- The Conventions table — the five keys from Step 3, with the confirmed
  values. Use the skip-value polarity from the template (`barrel-exports:
yes` means barrels are allowed).
- The Audit Settings table — defaults (`categories: all`, `output-root:
docs/audit`, `fallow: required`). Do not ask about these. If the user later persists a
  category subset from `lodestar-audit`, leave that row as they wrote it
  on a re-run unless they ask to reset it.
- Excluded Paths — Step 2 globs; replace wholesale; insert between
  Package Layout and Conventions if missing.

Leave the `## Principles` and `## Skills` sections as the template has
them — the principles link must stay pointed at
`.agents/skills/lodestar-setup/principles.md`.

If the file already exists, replace `## Build & Test`,
`## Dependency Direction`, `## Package Layout`, `## Conventions`, and
`## Excluded Paths`; leave other user content. If
`## Conventions` is missing (a pre-0.5 file), insert it between
`## Package Layout` and `## Principles`. If `## Audit Settings` is
missing, insert it between `## Conventions` and `## Principles` with
the defaults above. If it already exists, leave it — a stored category
subset or output-root must survive a setup re-run.

Create the `.agents/lodestar/` directory if needed, and write to
`.agents/lodestar/context.md`. Write it in both enforcement modes — the
other three skills require it. The Conventions table is written in both
modes too.

### AGENTS.md — only in `full` mode

If `ENFORCEMENT_MODE` is `skills-only`, **do not touch `AGENTS.md`**. Skip
to Step 6.

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

## Step 6 — Clean up a pre-0.3 install

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

## Step 7 — Fallow and `.fallowrc.json` for the audit's fallow seed

The audit skill **requires** [fallow](https://docs.fallow.tools) as the
primary graph-based detector for `imports`, `dry`, and `soc-yagni`
unless `## Audit Settings` records `fallow: optional`. When
configured, Fallow also supplies wrong-direction import findings. Without `.fallowrc.json`, boundary
violations are not detected by fallow and the audit falls back to a
heuristic grep for direction violations.

### Resolve fallow, and offer to install it

1. Prefer the version already in the project, then check `PATH`, via the
   lodestar-audit contract script (absolute path to
   `lodestar-audit/scripts/fallow-contract.mjs`):
   ```bash
   node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>
   ```
   ```powershell
   node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>
   ```
   A binary that resolves and is in range needs nothing further — **never
   install over a working copy**. Go straight to `.fallowrc.json` below.
2. If fallow is missing or outside the supported range, offer to install
   it. `resolve-bin` fails with a message that already ends in `Install a
compatible version with: <command>`, built for the manager it detected
   from the lockfile — quote that command rather than composing one here,
   so the version pin and the per-manager syntax have one source. When the
   lockfile is ambiguous the message lists all three managers instead; use
   the one confirmed in Step 2, and if that is still unknown, ask before
   quoting or running anything. Do not guess. That quoted command is the
   base: settle the location (item 3 of this step) first, since it can
   change the command, and whatever the final command is, that is the one to
   run, to show in the prompt, and to print if the answer is "no".

   When nothing resolved:

   > fallow is required by `lodestar-audit` and was not found in this repo
   > or on `PATH`. Install it as a devDependency with `<command>`?
   > (yes / no — I'll print the command and carry on)

   When a version resolved but is out of range, name it. This changes a
   dependency the repo already pins, and something else may be using that
   binary:

   > This repo has fallow `<found version>`, which `lodestar-audit` can't
   > use. Upgrade it with `<command>`? (yes / no — I'll print the command
   > and carry on)

3. Before installing in a repo with more than one package, ask where it
   goes: the workspace root, or a named package. Adjust the quoted command
   for the answer — root is `pnpm add -D -w` / `npm install --save-dev` /
   `yarn add -D` at the root, and a named package is
   `pnpm --filter <name> add -D` / `npm install --save-dev --workspace
<name>` / `yarn workspace <name> add -D`. Recommend the root: a
   package-local install has to be verified and audited from that package.
   Do not proceed without an answer.
4. On "yes", run the final command from items 2 and 3 of this step, then
   re-run `resolve-bin` and say which version resolved. A binary that still
   doesn't resolve, or still falls outside the range, counts as a failed
   install.

   `resolve-bin` looks in `<root>/node_modules/.bin` and then `PATH`, so it
   cannot see a binary that landed in one package's own `node_modules`.
   Package-local installs often hoist to the root anyway — only if the root
   re-run comes back empty, re-run with `--root` pointed at the package
   directory. If that is where it resolves, say so: `lodestar-audit`
   resolves fallow the same way, so the install is invisible from the repo
   root, and it should be moved to the root or put on `PATH` before the
   audit runs. Do not tell the user to point the audit's `--root` at the
   package — that would narrow the scan to that package.

5. On "no", or on a failed install: print the command verbatim, say plainly
   that `lodestar-audit` will refuse to run until a compatible fallow is
   present (`fallow: required`, the default this step writes), and carry on — the `.fallowrc.json` question is asked either
   way. Installs fail for ordinary reasons (no network, or a platform with
   no fallow binary — it ships as platform-specific optional dependencies).
   That is not a setup failure and must not skip the rest of this step.

### Write `.fallowrc.json`

Ask this whether or not fallow ended up installed — the config is useful
the moment it is:

> Write `.fallowrc.json` so the audit detects wrong-direction imports with
> fallow instead of a heuristic grep? (yes / no)

If fallow is not installed, say the file will sit ready until it is.

If `.fallowrc.json` already exists, ask instead: "merge boundary section /
leave alone / overwrite?"

If the user opts in, write `.fallowrc.json` from `fallowrc.md` beside this
`SKILL.md` (the template document contains the
JSON inside a fenced block). Substitute:

- One `boundaries.zones[]` entry per **scannable** row (`Scannable: no`
  has no zone). The zone `name` is the package name from the table.
  Use the literal path glob from the table as the `patterns` value
  (wrapping bare directory paths to `<path>/**`). For a row with a glob
  like `apps/*/src`, prefer `"autoDiscover": ["apps"]` so each app
  becomes its own sub-zone.
- One `boundaries.rules[]` entry per scannable package. The `allow` list is every
  package reachable from `from` in the documented graph (including cycle
  partners). For an acyclic chain this matches every package to the right
  in the chain. The tail-of-chain package with no downward edges gets
  `allow: []` (or only cycle partners when cyclic).
- `ignorePatterns`: one entry per `## Excluded Paths` glob. Skip Fallow's built-in ignores. `dupes`/`health` honor it; do not mirror. `extends` replaces arrays — check the merge.

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

After writing, verify the zones. This needs a compatible fallow: if none
resolved — absent, or present but out of range and the upgrade declined —
skip the check, say so, and say the zones stay unverified until fallow is
installed. Otherwise run the lodestar-audit contract script
(absolute path to the installed
`lodestar-audit/scripts/fallow-contract.mjs`):

```bash
node <lodestar-audit-skill>/scripts/fallow-contract.mjs run \
  --root <repo> \
  --id list-boundaries \
  --out <repo>/.audit-fallow-boundaries.json
```

Every zone should report `file_count > 0`. A contract failure or a
zero-file zone means the config or Package Layout glob must be fixed
before continuing. Delete the temp JSON after reading it.

## Step 8 — (Optional) Linting rules for higher-accuracy audit findings

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

## Step 9 — Confirm

Print a one-line summary of each file written or updated (including
`.fallowrc.json` if Step 7 ran), and which `ENFORCEMENT_MODE` was used —
say plainly whether `AGENTS.md` was edited (`full`) or left alone
(`skills-only`). Name the fallow version Step 7 resolved, whether it was
already there or just installed. If none resolved, say so, repeat the
install command, and say `lodestar-audit` needs it.
List any convention recorded at its skip value, so the user sees what
the audit will skip: `result-types: no` (errors #B), `branded-types: no`
(`boundaries` A, `types` #4), `barrel-exports: yes` (`imports` #4),
`design-tokens: no` (the whole `styling` category), `coverage-floor:
none` (the coverage floor). If every row is at its default, say so.
List every unscannable package by name and language (not scanned).
Ask: "Does this look right? If so, run the `lodestar-audit`
skill to scan the codebase and produce action-item files in
`<output-root>/<run-id>/` (default `docs/audit/<run-id>/`). If the layout itself feels off, run
`lodestar-architecture` instead — it produces an advisory report and never
modifies source."

Do not run the audit automatically. Do not run `lodestar-architecture`
automatically. Setup is descriptive — anything evaluative is the other
skill's job.
