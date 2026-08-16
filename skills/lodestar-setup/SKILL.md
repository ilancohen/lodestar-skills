---
name: lodestar-setup
description: >-
  Sets up the lodestar suite in a repository by documenting its
  package layout and writing agent guidance. May also configure Fallow,
  gitignore entries, and existing linter rules with user consent. Do not
  load unless the user explicitly invokes lodestar-setup by name.
disable-model-invocation: true
license: MIT
compatibility: Requires filesystem write access and a POSIX-compatible shell for optional Fallow setup. Supports npm, pnpm, and yarn repositories.
metadata:
  author: Ilan Cohen
  version: "0.2.0"
---

Write the agent-neutral config files that coding agents need to use the
lodestar skills. This requires only the information needed to fill in the templates — do not
do a broad repo survey, and do not propose architectural changes (the
`lodestar-architecture` skill exists for that).

Resolve every bundled template path relative to the directory containing this
`SKILL.md`. Paths beginning with `.agents/` below are output paths in the target
repository, not locations of this installed skill.

## What this skill does — and does not do

- **Does**: discover the packages that already exist, document each one
  (name, path, alias, one-sentence responsibility), capture the declared
  dependency direction, and write the config files agents read.
- **Does not**: force the repo's packages into a fixed list of roles
  (`core`, `api`, `ui`, etc.). The audit operates on whatever packages
  this skill documents.
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
- **Dependency direction** — infer from imports between packages. If
  ambiguous or undocumented, ask the user once (Step 2) — don't guess
  silently.
- **Existing files** — check whether `AGENTS.md` and
  `.agents/skills/README.md` already exist. If they do, read them
  briefly so you don't overwrite unrelated content.

Stop there. Do not read tsconfig deeply, explore individual packages, check
for issue trackers, or investigate test frameworks beyond the scripts.
Do not try to map the discovered packages onto a canonical role list —
the table you write is keyed by the repo's own package names.

## Step 2 — Confirm one thing

Present a single short summary:

- The package manager you detected (or that you could not tell).
- The commands you found.
- The dependency direction you'll record (using the repo's actual
  package names, e.g. `web → server → core → shared`).
- The Package Layout table you intend to write — one row per package,
  with name, path, alias, and the one-sentence responsibility you've
  drafted.

If the package manager is unclear, ask which of npm, yarn, or pnpm to
use as part of this same confirmation. Do not proceed with install or
script prefixes until that is answered.

Ask the user to correct anything wrong. One round of feedback only.
Do not ask separate questions about coverage, branded types, or violations,
and do not ask whether the layout is "right" — that's `lodestar-architecture`'s
job, not setup's.

## Step 3 — Build the shared principles block

`principles.md` is the canonical lodestar
body. It gets inlined into `.agents/skills/README.md`. Do not write
agent-specific files (`CLAUDE.md`, `.github/copilot-instructions.md`,
or similar).

Read `principles.md` once and produce a substituted copy in memory:

| Placeholder   | Replace with                                                    |
| ------------- | --------------------------------------------------------------- |
| `[typecheck]` | The exact typecheck command from `AGENTS.md` Build & Test table |
| `[lint]`      | The exact lint command from `AGENTS.md` Build & Test table      |

`principles.md` no longer references specific role names — every principle
is stated abstractly and points back at AGENTS.md `## Package Layout`
for the concrete details. No package-name substitution is required here.

Hold the substituted block — call it `PRINCIPLES_BLOCK` — for use in the
file-write steps below.

## Step 4 — Write the files

Use the templates beside this `SKILL.md`. Fill every `[bracketed
placeholder]` with real values. Wherever a template contains the literal
line:

```
<!-- INSERT principles.md -->
```

replace that line (and only that line) with `PRINCIPLES_BLOCK` from Step 3.

Announce each file before writing it.

### AGENTS.md

Start from `agents-md.md`. Fill in:

- One-sentence project description.
- The exact commands in the Build & Test table.
- The dependency direction, using the repo's own package names.
- The Package Layout table — one row per package discovered in Step 1.
  Use the repo's own names verbatim. Fill the Responsibility column with
  the one-sentence summary you drafted.

`AGENTS.md` does not contain `<!-- INSERT principles.md -->`; it points at
`.agents/skills/README.md` for the principles. No inlining needed here.

If `AGENTS.md` already exists, add or update only the `## Build & Test`,
`## Dependency Direction`, `## Package Layout`, `## Lodestar`,
`## Skills`, and `## Audit Output` sections — leave everything else untouched.

Write to `AGENTS.md`.

### .agents/skills/README.md

Start from `skills-readme.md`. Fill in:

- The dependency direction (in `## Package Dependency Direction`), using
  the same package names as AGENTS.md.

Replace `<!-- INSERT principles.md -->` with `PRINCIPLES_BLOCK`.

Write to `.agents/skills/README.md`.

## Step 4.5 — `.fallowrc.json` for the audit's fallow seed

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
   "fallow ^3.15.0 (combined schema 10) is required for lodestar-audit. Install with
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
  in `AGENTS.md`. The zone `name` is the package name from the table.
  Use the literal path glob from the table as the `patterns` value
  (wrapping bare directory paths to `<path>/**`). For a row with a glob
  like `apps/*/src`, prefer `"autoDiscover": ["apps"]` so each app
  becomes its own sub-zone (sibling apps end up isolated from each
  other, which is usually what you want).
- One `boundaries.rules[]` entry per package. The `allow` list is every
  package to the right of `from` in the dependency direction. The
  tail-of-chain package gets `allow: []`.

Write to `.fallowrc.json`.

Then ask separately before editing `.gitignore`:

> Add `.audit-fallow-seed.json` and `.fallow/` to `.gitignore`?
> (yes / no)

If the user agrees and `.gitignore` exists and does not already cover
them, add those two entries (`.audit-fallow-seed.json` is the audit's
transient seed cache; `.fallow/` is fallow's own cache directory). If
they decline, still write `.fallowrc.json` and say the gitignore entries
were skipped.

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

## Step 4.6 — (Optional) Linting rules for higher-accuracy audit findings

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

## Step 5 — Confirm

Print a one-line summary of each file written or updated (including
`.fallowrc.json` if Step 4.5 ran).
Ask: "Does this look right? If so, run the `lodestar-audit`
skill to scan the codebase and produce action-item files in
`docs/audit/<run-id>/`. If the layout itself feels off, run
`lodestar-architecture` instead — it produces an advisory report and never
modifies source."

Do not run the audit automatically. Do not run `lodestar-architecture`
automatically. Setup is descriptive — anything evaluative is the other
skill's job.
