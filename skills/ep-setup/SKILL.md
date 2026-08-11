---
name: ep-setup
description: >-
  Sets up the engineering-principles suite in a repository by documenting its
  package layout and writing agent guidance. Use after installing the suite or
  when repository structure changes. May also configure Fallow, gitignore
  entries, and existing linter rules with user consent.
license: MIT
compatibility: Requires filesystem write access and a POSIX-compatible shell for optional Fallow setup. Supports npm, pnpm, yarn, and Bun repositories.
metadata:
  author: Ilan Cohen
  version: "0.1.0"
---

Write the four config files that coding agents need to use the engineering-principles
skills. This requires only the information needed to fill in the templates — do not
do a broad repo survey, and do not propose architectural changes (the
`ep-review-architecture` skill exists for that).

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
  If the user asks for that, point them at `ep-review-architecture` and
  stop — do not silently start a layout review.

## Step 1 — Collect the minimum required facts

Read only what's needed to fill in the template placeholders:

- **Package manager** — check for `pnpm-workspace.yaml`, `yarn.lock`,
  `package-lock.json`, `bun.lockb`. This sets the command prefix.
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
- **Existing files** — check whether `AGENTS.md`, `CLAUDE.md`, and
  `.github/copilot-instructions.md` already exist. If they do, read them
  briefly so you don't overwrite unrelated content.

Stop there. Do not read tsconfig deeply, explore individual packages, check
for issue trackers, or investigate test frameworks beyond the scripts.
Do not try to map the discovered packages onto a canonical role list —
the table you write is keyed by the repo's own package names.

## Step 2 — Confirm one thing

Present a single short summary:

- The commands you found.
- The dependency direction you'll record (using the repo's actual
  package names, e.g. `web → server → core → shared`).
- The Package Layout table you intend to write — one row per package,
  with name, path, alias, and the one-sentence responsibility you've
  drafted.

Ask the user to correct anything wrong. One round of feedback only.
Do not ask separate questions about coverage, branded types, or violations,
and do not ask whether the layout is "right" — that's `ep-review-architecture`'s
job, not setup's.

## Step 3 — Build the shared principles block

`principles.md` is the canonical engineering-principles
body. It gets inlined into all three of `CLAUDE.md`,
`.agents/skills/README.md`, and `.github/copilot-instructions.md` so the
three files never drift.

Read `principles.md` once and produce a substituted copy in memory:

| Placeholder | Replace with |
|---|---|
| `[typecheck]` | The exact typecheck command from `AGENTS.md` Build & Test table |
| `[lint]` | The exact lint command from `AGENTS.md` Build & Test table |

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
`## Dependency Direction`, `## Package Layout`, `## Engineering Principles`,
`## Skills`, and `## Audit Output` sections — leave everything else untouched.

Write to `AGENTS.md`.

### .agents/skills/README.md

Start from `skills-readme.md`. Fill in:
- The dependency direction (in `## Package Dependency Direction`), using
  the same package names as AGENTS.md.

Replace `<!-- INSERT principles.md -->` with `PRINCIPLES_BLOCK`.

Write to `.agents/skills/README.md`.

### CLAUDE.md

Start from `claude-md.md`. The body of this file
points at AGENTS.md `## Package Layout` rather than restating the layout
in CLAUDE.md, so there are no layout-specific placeholders to fill in
the Repository Layout section — leave the prose as-is.

Replace `<!-- INSERT principles.md -->` with `PRINCIPLES_BLOCK`.

If `CLAUDE.md` already exists, replace only the file's body from the first
`# CLAUDE.md` heading onward — leave any unrelated repo-specific content
above the heading untouched.

Write to `CLAUDE.md`.

### .github/copilot-instructions.md

Start from `copilot-instructions.md`. No
file-specific placeholders — just replace `<!-- INSERT principles.md -->`
with `PRINCIPLES_BLOCK`.

If `.github/copilot-instructions.md` already exists, add or update only the
`# GitHub Copilot Instructions` section onward — leave any unrelated
repo-specific content above the heading untouched.

Write to `.github/copilot-instructions.md`.

## Step 4.5 — `.fallowrc.json` for the audit's fallow seed

The audit skill **requires** [fallow](https://docs.fallow.tools) as the
primary graph-based detector for `imports`, `dry`, and `soc-yagni`. When
configured, Fallow also supplies wrong-direction import findings. Without `.fallowrc.json`, boundary
violations are not detected by fallow and the audit falls back to a
heuristic grep for direction violations.

Decide whether to write it:

1. Prefer the version pinned in the project, then check `PATH`:
   ```bash
   test -x node_modules/.bin/fallow || command -v fallow >/dev/null 2>&1
   ```
2. If fallow is not found, tell the user: "fallow is required for ep-audit.
   Install the latest version as a devDependency at the workspace root.
   Write `.fallowrc.json` anyway so it's ready when fallow is installed?"
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

Write to `.fallowrc.json`. Add `.audit-fallow-seed.json` and `.fallow/` to
the project's `.gitignore` if it exists and doesn't already cover them
(`.audit-fallow-seed.json` is the audit's transient seed cache; `.fallow/`
is fallow's own cache directory).

After writing, recommend the user verify with:

```bash
node_modules/.bin/fallow list --boundaries --format json --quiet 2>/dev/null || true
```

Parse only a `kind: "list-boundaries"` envelope. Every zone should report
`file_count > 0`. An `error: true` envelope or a zero-file zone means the
config or Package Layout glob must be fixed before continuing.

## Step 4.6 — (Optional) Linting rules for higher-accuracy audit findings

The ep-audit skill runs an opportunistic linter probe when detecting
`types` (#1, #3), `errors` (A, B), and `boundaries.B` violations. Enabling
the relevant rules in your existing linter config makes those findings
definitive rather than heuristic — no packages to install beyond what you
already use.

**Only do this if the project has a linter already configured.** Do not
set up a new linter or modify linter config without the user's consent.

### If the project uses ESLint with `@typescript-eslint`

Recommend enabling (in `eslint.config.*` or `.eslintrc.*`):

```js
// @typescript-eslint rules that map directly to ep-audit categories
'@typescript-eslint/no-explicit-any': 'error',          // types #3
'@typescript-eslint/consistent-type-imports': 'error',  // types #1
'@typescript-eslint/no-floating-promises': 'error',     // errors A
'@typescript-eslint/no-throw-literal': 'error',         // errors B
'@typescript-eslint/prefer-promise-reject-errors': 'error', // errors B
```

These rules are already assumed by ep-audit's fix recipes (e.g. the `any`
fix recipe references `eslint-disable-next-line @typescript-eslint/no-explicit-any`).

For `boundaries.B` (misplaced business logic), also recommend adding
`eslint-plugin-boundaries`. Once configured, the ep-audit skill uses its
output directly and produces definitive findings with no `requires_decision`
overhead. Use the zone structure already written to `.fallowrc.json` as
the source — each zone becomes an element type:

```js
// eslint-plugin-boundaries element-types rule
// (derived from .fallowrc.json zones — one entry per package)
'boundaries/element-types': ['error', {
  default: 'disallow',
  rules: [
    // Mirror the dependency direction from AGENTS.md:
    // e.g. { from: 'web', allow: ['server'] },
    //       { from: 'server', allow: ['core'] }, ...
  ]
}]
```

### If the project uses Biome

Biome covers the equivalent rules via its `correctness` and `suspicious`
groups. Check that these are enabled:

- `correctness/noFloatingPromises` → errors A
- `suspicious/noExplicitAny` → types #3
- `correctness/useImportType` → types #1

Biome does not have a boundaries/layer enforcement rule. The grep fallback
in ep-audit handles `boundaries.B` when Biome is the only linter.

Ask the user once whether they want to add any of these. Do not write
config without confirmation.

## Step 5 — Confirm

Print a one-line summary of each file written or updated (including
`.fallowrc.json` if Step 4.5 ran).
Ask: "Does this look right? If so, run the `ep-audit`
skill to scan the codebase and produce action-item files in
`docs/audit/<run-id>/`. If the layout itself feels off, run
`ep-review-architecture` instead — it produces an advisory report and never
modifies source."

Do not run the audit automatically. Do not run `ep-review-architecture`
automatically. Setup is descriptive — anything evaluative is the other
skill's job.
