---
name: lodestar-setup
description: >-
  Sets up the lodestar suite in a repository by documenting its package
  layout and which of a short list of conventions it already follows in
  .agents/lodestar/context.md, the one file the other lodestar skills
  read, which links to the bundled principles.md (never copied or
  inlined). Measures git churn (no source reading) and asks whether to
  scope the audit to code changed since today's commit. Asks how
  lodestar-fix should commit, and whether to add a pointer section to
  AGENTS.md so principles apply to every task (full suite) or to leave
  AGENTS.md untouched (skills-only). With separate user consent it may
  also install
  Fallow as a devDependency (writing package.json and the lockfile), write
  .fallowrc.json, add gitignore entries, and tighten existing linter rules.
  Do not load unless the user explicitly invokes lodestar-setup by name.
disable-model-invocation: true
license: MIT
compatibility: Requires filesystem write access and a POSIX-compatible shell for optional Fallow setup, plus network access if you accept the optional Fallow install. npm, pnpm, yarn, and Bun are detected from lockfiles; any other manager works when recorded in context.md. Deno and Bazel are not supported.
metadata:
  author: Ilan Cohen
  version: "0.7.0"
---

Write the agent-neutral config the lodestar skills need. The one file that
matters is `.agents/lodestar/context.md`: package layout, dependency
direction, build commands, conventions, audit scope, and how
`lodestar-fix` commits.
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
  package import graph, conventions, commit policy, and audit scope, and
  write the config files agents read.
- **Does not**: force packages into a fixed role list (`core`, `api`,
  `ui`), write a target dependency direction, propose an alternative
  layout, or read source to pick a scope. Point layout questions at
  `lodestar-architecture` and stop.

## Step 0 — Confirm the repo is scannable

Count TS/JS files (`source-scan` include list) by extension across
top-level source dirs, excluding `node_modules` and `.git`. Count
only. Tally other extensions (`.py`, `.go`, `.rs`, …) in the same pass.

- **Zero scannable files** → **stop**. Write nothing. Name the
  languages found with counts. Do not offer a partial setup.
- **Some scannable, some not** → continue; carry counts into Step 1.

## Step 1 — Collect the minimum required facts

Read only what's needed to fill in the template placeholders:

- **Package manager** — exactly one of pnpm / yarn / npm / Bun
  (`bun.lock` or `bun.lockb`; both still count as Bun). Several → ask.
  None recognized → ask name, exec prefix, add-dev; write `pkg-manager`.
  Do not offer only npm / yarn / pnpm when none of those lockfiles exist.
- **Build commands** — `package.json` `scripts` first, then Makefile /
  justfile / Taskfile / Nx / Turbo / README. Record what a developer
  types. Missing → `n/a`.
- **Package layout** — find whatever declares the workspace; record the
  file. Hints: `pnpm-workspace.yaml`, `package.json` `workspaces`,
  `nx.json`, `turbo.json`, `lerna.json`. Several → prefer the manager's
  file and name the others. Only if none: every non-root `package.json` (skip Excluded
  Paths); else single-package: feature dirs one level into `src/` (or
  `main`/`exports`), or one row for the source root. Directory rows are
  valid. For each: name, path, alias (`name`/`paths`/`imports`/bundler; else `n/a`); entry
  points (`exports`/`typesVersions`/`main`; else `index.ts`);
  responsibility; `Scannable: no` + language if none.
- **Excluded paths** — gitignored paths inside layout globs; codegen
  (`prisma/schema.prisma`, `codegen.yml`/`ts`, `*.proto`,
  `openapi*.y?ml`) and output; dirs `generated`, `__generated__`,
  `dist`, `build`, `.next`, `.output`; `*.gen.ts`/`*.generated.ts`;
  `@generated` / "do not edit" banners. Tests: `*.test.*`, `*.spec.*`,
  `__tests__/`, `tests/`.
- **Dependency direction** — package-level edge list (who imports whom,
  rough count), then cycles. Acyclic → chain. Cyclic → record edges and
  the cycle; do not order them. Ambiguous observation → ask once in
  Step 2; do not guess a target layout.
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
- **Commit policy** — detect per `context-md.md` `## Git` (commitlint,
  `git log`, hooks, current branch). Record paths, not a judgment.
- **Audit-scope measurements** — no source reading. No `.git` → record
  that and skip to `mode: all` with no question. Else four commands:
  `git rev-list --count HEAD`; `git log --reverse --format=%ad
  --date=short | head -n 1` (first commit; do not use `-1`, git applies
  it before `--reverse`); `git ls-files` count matching a layout glob
  and a scannable extension (`.ts`/`.tsx`/`.js`/`.jsx`/`.mts`/`.cts`);
  `git log --since=90.days --name-only --pretty=format:` unique paths
  intersected with that set. Churn = touched / files (`0` if files is
  0). Record the four numbers and the ratio.

Stop there. Do not read tsconfig deeply, explore individual packages, check
for issue trackers, or investigate test frameworks beyond the scripts and
the coverage threshold above.
Do not try to map the discovered packages onto a canonical role list —
the table you write is keyed by the repo's own package names.

## Step 2 — Confirm one thing

Present a single short summary:

- The package manager you detected (or that you could not tell), and
  where commands came from (`package.json` scripts, Makefile, …).
- The commands you found (`n/a` if a check does not exist).
- The observed package import graph — acyclic chain or cyclic edge list,
  using the repo's actual package names.
- How the layout was found, and the table — name, path, alias, entry
  points, responsibility, Scannable. Name unscannable rows. An empty
  graph is valid for a single-package repo.
- The four churn numbers (or "not a git repository").

When the graph is cyclic, state plainly that it is cyclic, show the cycle
edges, and say they will be recorded as-is and reported by the audit as
circular dependencies. Ask the user to correct the graph only if the
_observation_ is wrong — do not ask them to declare a target layout.

If the manager is unclear, ask here. When none of npm / yarn / pnpm /
Bun was detected, ask name, exec prefix, and add-dev — not a closed
list. Do not proceed with install prefixes until that is answered.

Ask the user to correct anything wrong. One round of feedback only.
Do not ask about conventions (Step 3) or commit policy (Step 3a) here.
Do not ask whether the layout is "right" — that's
`lodestar-architecture`'s job, not setup's.
Then a second confirmation: excluded-path candidates with evidence,
one round to add/remove (empty allowed). Write `## Excluded Paths`
from that answer in both enforcement modes.

Then the audit-scope question. Show the four numbers. Skip the question
when the repo is not git (`mode: all`) or `## Audit Scope` already
exists (leave it — the baseline does not move on a re-run).
Recommend `changed-since` when files ≥ 80 **and** churn < 0.30;
otherwise `all`. Always show the numbers.

> This repo has N commits since <date>, M source files, and K of them
> were touched in the last 90 days. Scope the audit to code changed
> since today's commit, keeping the rest as a reported backlog? Or
> expand every finding into an action item? Recommended:
> **<changed-since | all>** (threshold: 80 files and 30% churn).

On `changed-since`, capture `git rev-parse HEAD` and today's
`YYYY-MM-DD`; name the sha and say older-code findings are counted, not
expanded. On `all`, write `mode: all` with no baseline rows.

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

## Step 3a — Confirm how lodestar-fix commits

Ask once, pre-filled from Step 1 / `context-md.md` `## Git`:

> How should `lodestar-fix` commit? Pre-filled from the repo. One round.
>
> - commits: **ask** / per-item / never
> - subject-format / trailer / protected / require-clean — detected or default
>
> Hooks: `<husky | lefthook | .git/hooks | none>`. No `--no-verify`.

`never` = no ask, no commit, edits stay unstaged. Write `## Git` in
both enforcement modes.

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
Steps 5 and 6. This choice does not affect any other step — layout,
conventions, Git, Fallow (Step 7), and linting (Step 8) run the same
way regardless.

## Step 5 — Write the files

Use the templates beside this `SKILL.md`. Fill every `[bracketed
placeholder]` with real values. Announce each file before writing it.

`principles.md` (beside this `SKILL.md`) is the SSOT for principles.
The install always lands a copy at
`.agents/skills/lodestar-setup/principles.md`. Do not copy, inline, or
edit it, and do not write agent-specific files (`CLAUDE.md`, Copilot
instructions). It references `context.md` tables by name, so it needs
no placeholder substitution.

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
- The Audit Scope table — Step 2. `mode: all` with no baseline rows, or
  `mode: changed-since` plus `baseline-ref` (the captured sha) and
  `baseline-date` (today). If the section already exists, leave it.
- Excluded Paths — Step 2 globs; replace wholesale; insert between
  Package Layout and Conventions if missing. Git table — Step 3a.

Leave the `## Principles` and `## Skills` sections as the template has
them — the principles link must stay pointed at
`.agents/skills/lodestar-setup/principles.md`.

If the file already exists, replace `## Build & Test`,
`## Dependency Direction`, `## Package Layout`, `## Conventions`,
`## Excluded Paths`, and `## Git`; leave other user content. If
`## Conventions` is missing (a pre-0.5 file), insert it between
`## Package Layout` and `## Principles`. If `## Audit Settings` is
missing, insert it between `## Conventions` and `## Principles` with
the defaults above. If it already exists, leave it — a stored category
subset or output-root must survive a setup re-run. Missing `## Audit
Scope` → insert between `## Audit Settings` and `## Git` (or
`## Principles`); if present, leave it. Missing `## Git` → insert after
`## Audit Scope` when present, else between `## Audit Settings` and
`## Principles`.

Create the `.agents/lodestar/` directory if needed, and write to
`.agents/lodestar/context.md`. Write it in both enforcement modes —
Conventions, Audit Scope, and Git included.

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
unless `## Audit Settings` records `fallow: optional`. Configured, it
also supplies wrong-direction findings. Without `.fallowrc.json`,
boundaries fall back to a heuristic grep.

### Resolve fallow, and offer to install it

1. Prefer the project copy, then `PATH`, via
   `lodestar-audit/scripts/fallow-contract.mjs`:
   ```bash
   node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>
   ```
   ```powershell
   node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>
   ```
   In-range binary → **never install over it**; go to `.fallowrc.json`.
2. Missing or out of range: offer to install. `resolve-bin` already
   ends in `Install a compatible version with: <command>` — quote that
   command (SSOT for pin and manager syntax). Ambiguous lockfile lists
   three managers; use Step 2's answer, or ask. Settle location (item 3)
   first; that final command is what you run, prompt, and print on "no".

   Nothing resolved:

   > fallow is required by `lodestar-audit` and was not found in this repo
   > or on `PATH`. Install it as a devDependency with `<command>`?
   > (yes / no — I'll print the command and carry on)

   Out of range — name the version (this changes a pin others may use):

   > This repo has fallow `<found version>`, which `lodestar-audit` can't
   > use. Upgrade it with `<command>`? (yes / no — I'll print the command
   > and carry on)

3. Multi-package: ask root vs named package. Root: `pnpm add -D -w` /
   `npm install --save-dev` / `yarn add -D` / `bun add -d`. Package:
   `pnpm --filter <name> add -D` / `npm install --save-dev --workspace
<name>` / `yarn workspace <name> add -D` / `bun add -d --cwd <package>`.
   Recommend root. Bun lands in `node_modules` like npm. Do not proceed
   without an answer.
4. On "yes", run that command, re-run `resolve-bin`, name the version.
   Still missing or out of range = failed install. `resolve-bin` sees
   `<root>/node_modules/.bin` then `PATH`, not a package-local bin. If
   root is empty, retry `--root` at the package; if it resolves there,
   say the audit won't see it from the repo root — move it to root or
   `PATH`. Do not tell them to point the audit `--root` at the package.
5. On "no" or failed install: print the command, say `lodestar-audit`
   refuses until a compatible fallow is present (`fallow: required`,
   the default this step writes), and carry on — `.fallowrc.json` is
   still asked. Network/platform misses are not setup failures.

### Write `.fallowrc.json`

Ask this whether or not fallow ended up installed — the config is useful
the moment it is:

> Write `.fallowrc.json` so the audit detects wrong-direction imports with
> fallow instead of a heuristic grep? (yes / no)

If fallow is not installed, say the file will sit ready until it is.

If `.fallowrc.json` already exists, ask instead: "merge boundary section /
leave alone / overwrite?"

If the user opts in, write `.fallowrc.json` from `fallowrc.md` (JSON in a
fenced block). Substitute:

- One `boundaries.zones[]` per **scannable** row (`Scannable: no` has no
  zone). `name` = package name; `patterns` = the table glob (`<path>/**`
  if bare). `apps/*/src` → `"autoDiscover": ["apps"]`.
- One `boundaries.rules[]` per scannable package. `allow` = every
  package reachable from `from` (including cycle partners); acyclic
  chain → everything to the right; tail gets `allow: []`.
- `ignorePatterns`: one per `## Excluded Paths` glob. Skip Fallow
  built-ins. `dupes`/`health` honor it; `extends` replaces arrays.

Write to `.fallowrc.json`. Then ask:

> Add `.audit-fallow-seed.json` and `.fallow/` to `.gitignore`?
> (yes / no)

If yes and `.gitignore` exists and does not already cover them, add
both. If they decline, still write `.fallowrc.json` and say gitignore
was skipped.

`.agents/lodestar/fallow-compat.json` is a team-committed audit artifact
— never gitignore it.

After writing, verify zones when a compatible fallow resolved; if none
resolved, skip and say unverified. Else run this from the **absolute
path** of the installed `lodestar-audit/scripts/fallow-contract.mjs`:

```bash
node <lodestar-audit-skill>/scripts/fallow-contract.mjs run \
  --root <repo> \
  --id list-boundaries \
  --out <repo>/.audit-fallow-boundaries.json
```

Every zone needs `file_count > 0`. Fix the config or layout glob on
failure. Delete the temp JSON.

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
Name the commit policy. List every unscannable package by name and language (not scanned).
Name the audit scope. When `changed-since`, say the next audit will find
little by design (baseline is today's commit) and existing code shows
up as the `INDEX.md` backlog; widen for one run in the audit, not here.
Ask: "Does this look right? If so, run the `lodestar-audit`
skill to scan the codebase and produce action-item files in
`<output-root>/<run-id>/` (default `docs/audit/<run-id>/`). If the layout itself feels off, run
`lodestar-architecture` instead — it produces an advisory report and never
modifies source."

Do not run the audit automatically. Do not run `lodestar-architecture`
automatically. Setup is descriptive — anything evaluative is the other
skill's job.
