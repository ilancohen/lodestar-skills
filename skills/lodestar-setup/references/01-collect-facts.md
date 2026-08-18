# Step 1 — Collect the minimum required facts

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
- **Package layout** — find whatever declares the workspace; record the
  file as a `layout-source` row in Build & Test. Hints: `pnpm-workspace.yaml`, `package.json` `workspaces`,
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
  cleanup). A value already in `## Conventions` is never overwritten by a
  sweep that misses it.
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
- **Commit policy** — detect per `context-md.md` `## Audit Configuration` (commitlint,
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
