# Step 1 — Collect the minimum required facts

Prefer `setup-state.mjs collect`. Else:

### Installed sibling skills

Before anything else, list directories named `lodestar-*` that sit beside
this skill's directory and contain `SKILL.md`. That set is the installed
suite for this run. Do **not** ask which workflows the user plans to
use, and do **not** infer intent from the prompt.

Record at least: whether `lodestar-audit` is present (gates Fallow,
Audit Configuration, audit-scope review, and framework
`scan-extensions` written for audit). Also note `lodestar-fix`,
`lodestar-architecture`, `lodestar-plan`, `lodestar-implement`, and
`lodestar-docs` for the Reference skills table and Step 5 Next
pointers.

Read only what's needed to fill in the template placeholders:

- **Package manager** — exactly one of pnpm / yarn / npm / Bun
  (`bun.lock` or `bun.lockb`; both still count as Bun). Several
  lockfiles, or none recognized → ask **now**, before the review
  screen: name, exec prefix, and add-dev — not a closed list. Write
  `pkg-manager`. Do not offer only npm / yarn / pnpm when none of those
  lockfiles exist. Do not proceed with install prefixes until that is
  answered. An unambiguous lockfile is not a question.
- **Build commands** — `package.json` `scripts` first, then Makefile /
  justfile / Taskfile / Nx / Turbo / README. Record what a developer
  types. Missing → `n/a`.
- **Linter** — run `node <lodestar-setup-skill>/scripts/detect-linter.mjs
--root <repo>`. Record `tool`, `probe`, and `signals`. When
  `needsProbe` is true, infer from the lint script or that linter's docs
  before writing context. Combine with the dev lint command using
  `formatLintCell(devCommand, detection)` from the same script module.
  No linter (`tool: null`) → lint cell is `n/a`. Do not install a linter.
- **Package layout** — find whatever declares the workspace; record the
  file as a `layout-source` row in Build & Test. Hints: `pnpm-workspace.yaml`, `package.json` `workspaces`,
  `nx.json`, `turbo.json`, `lerna.json`. Several → prefer the manager's
  file and name the others. Only if none: every non-root `package.json` (skip Excluded
  Paths); else single-package: feature dirs one level into `src/` (or
  `main`/`exports`), or one row for the source root. Directory rows are
  valid. For each: name, path, alias (`name`/`paths`/`imports`/bundler; else `n/a`); entry
  points (`exports`/`typesVersions`/`main`; else `index.ts`);
  responsibility; `Scannable: no` + language if none.
- **Fallow entry surfaces** — **only when `lodestar-audit` is installed.**
  For each **application** row (especially under `apps/*` or multiple
  front-end roots), record project-root-relative globs Fallow should
  treat as graph roots when auto-discovery is not enough: `index.html`,
  `src/main.ts`, `main.ts`, `server.ts`, framework convention files
  (Next `app/**/page.tsx`, Vite `index.html`, …). Use judgment —
  inspect `package.json` scripts, HTML shells, and bundler config.
  **Single-app repos** usually need no explicit list (count `0`, omit
  the `entry` key). **Multi-app repos** record one glob per distinct
  app surface and the total count `N` for the post-write `--minimum N`
  check. Do not guess paths that do not exist on disk. When audit is
  absent, skip this entirely.
- **Excluded paths** — gitignored paths inside layout globs; codegen
  (`prisma/schema.prisma`, `codegen.yml`/`ts`, `*.proto`,
  `openapi*.y?ml`) and output; dirs `generated`, `__generated__`,
  `dist`, `build`, `.next`, `.output`; `*.gen.ts`/`*.generated.ts`;
  `@generated` / "do not edit" banners. Tests: `*.test.*`, `*.spec.*`,
  `__tests__/`, `tests/`.
- **Dependency observation (ephemeral)** — optional package-level edge
  list for the review screen and (when audit is installed) for
  `.fallowrc.json` boundaries. Acyclic / cyclic notes are fine to show.
  **Do not persist** the observed graph into `context.md`. Dependency
  Policy is user-stated intent only — collect it on the review screen if
  the user supplies one; never invent policy from observation.
- **Existing files** — check whether `.agents/lodestar/context.md` already
  exists, and whether `AGENTS.md` exists and already has a `## Lodestar`
  section. If they do, read them briefly so you don't overwrite unrelated
  content. Older installs kept the layout table and command table in
  `AGENTS.md` — if you find them there, reuse those values for
  `context.md` and then strip those sections from `AGENTS.md` (see
  cleanup). A value already in `## Conventions` is never overwritten by a
  sweep that misses it. A leftover `## Dependency Direction` section is
  stale observed graph — drop it on rewrite; do not treat it as Policy.
- **Conventions evidence** — a short, bounded sweep so the review screen
  can pre-check from evidence. Record paths (or "not found"), not a
  judgment. Stop at the first hit per signal; do not walk the whole
  tree. A recorded `## Conventions` value beats a later miss.
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
- **Commit policy** — **only when `lodestar-audit` is installed** (git
  keys live under `## Audit Configuration`). Detect per
  `context-md.md` (commitlint, `git log`, hooks, current branch). Record
  paths, not a judgment. When audit is absent, skip — do not collect for
  fix-alone installs.
- **Framework signals** — **only when `lodestar-audit` is installed**
  (for `scan-extensions`). Infer which UI frameworks are in use so the
  audit scans the right file types. This is judgment, not a fixed rule
  list. Weigh several signals together:
  - `dependencies` / `devDependencies` in root and workspace
    `package.json` files (`vue`, `svelte`, `react`, `solid-js`,
    `@angular/core`, …).
  - Config files (`vite.config.*`, `nuxt.config.*`, `svelte.config.*`,
    `angular.json`, …).
  - File counts under layout globs (how many `.vue` / `.svelte` / `.tsx`
    files exist).
  - Do **not** add an extension unless the repo plausibly uses it — a
    stray file or transitive dep is not enough.
  - Record the frameworks you believe are active (for the review screen)
    and the resulting extension list for `scan-extensions` (base TS/JS
    list plus any framework extensions you add).
  When audit is absent, skip framework / scan-extensions collection.
- **Docs layout** — run
  `node <lodestar-setup-skill>/scripts/discover-docs.mjs --root <repo>`
  (add `--output-root` from an existing `context.md` `output-root` row,
  else `docs/audit`). Record the JSON rows. Do not invent folders. No
  `docs/` tree and no audit/architecture output dirs → record an empty
  list and omit `## Docs Layout`. A path already in `## Docs Layout`
  keeps its Role and Responsibility even if this run would guess
  differently; new paths get the script's guess; gone paths are dropped.
- **Guideline sources** — bounded existence checks, not a tree walk.
  Record **repo-owned** paths that exist for `## Review Rubric`. Do
  **not** list the bundled `principles.md` — skills resolve it from the
  installed setup skill. Check these well-known files at the repo root:
  `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`. Host-agent rules, one
  level, only if the directory exists: `.cursor/rules/` (`*.md`,
  `*.mdc`), `.claude/rules/` (`*.md`), `.cursorrules`,
  `.github/copilot-instructions.md`. Under each observed docs-layout
  path, check for `CONTRIBUTING.md`, `STYLE.md`, `CONVENTIONS.md`, or a
  `*coding*standard*` file — stop at the first hit per docs path. Do
  not walk the rest of the tree. A path already in `## Review Rubric`
  stays unless the user drops it on the review screen.
- **Audit-scope measurements** — **only when `lodestar-audit` is
  installed.** No source reading. No `.git` → record that and skip to
  `mode: all` with no question. Else four commands:
  `git rev-list --count HEAD`; `git log --reverse --format=%ad
--date=short | head -n 1` (first commit; do not use `-1`, git applies
  it before `--reverse`); `git ls-files` count matching a layout glob
  and a scannable extension (the base list plus any framework extensions
  you recorded); `git log --since=90.days --name-only --pretty=format:`
  unique paths intersected with that set. Churn = touched / files (`0` if files is
  0). Record the four numbers and the ratio.

Stop there. Do not read tsconfig deeply, explore individual packages, check
for issue trackers, or investigate test frameworks beyond the scripts and
the coverage threshold above.
Do not try to map the discovered packages onto a canonical role list —
the table you write is keyed by the repo's own package names.
