# Lodestar Context

Written by `lodestar-setup` to `.agents/lodestar/context.md`. This is the
primary file lodestar skills read for repo facts. `lodestar-audit` and
`lodestar-fix` stop without it. `lodestar-architecture`, `lodestar-docs`,
`lodestar-plan`, and `lodestar-implement` can discover what they need when
it is missing. Keep it accurate; nothing else needs to be kept in sync.
When `lodestar-audit` is installed, freshness is:

```text
node <lodestar-audit-skill>/scripts/audit-state.mjs check-freshness --root <repo>
```

Exit 0: still true. Exit 2: named facts have drifted — re-run
`lodestar-setup` to rewrite them. Skip that check when audit is not
installed.

## Project

[One paragraph: what this repo does, its tech stack, and a brief summary of
how the code is organized. Example: "A TypeScript monorepo for the Acme
billing platform. Uses pnpm workspaces with packages for domain logic, the
HTTP layer, a background worker, and shared types/utilities."]

## Build & Test

| Command       | What it runs                                    |
| ------------- | ----------------------------------------------- |
| `[install]`   | Install all dependencies                        |
| `[build]`     | Build all packages                              |
| `[typecheck]` | TypeScript type check — run before every commit |
| `[lint]`      | Lint all packages — see below                   |
| `[test]`      | Full test suite                                 |

`n/a` in a command cell means that check does not exist. Do not invent
one. `lodestar-fix` runs the checks that are present and reports which
acceptance step was skipped. The audit's linter probe degrades to heuristics when `<lint>` is `n/a` —
it must not error.

When lint exists, the `lint` cell carries three semicolon-separated
parts: `dev-command; tool; probe-command`. Example:
`npm run lint; eslint; eslint --format json --max-warnings=999
<all_pkg_roots>`. Setup runs `detect-linter.mjs` for `tool` and
`probe-command`; the dev command is what Step 1 collected. Use `n/a`
when there is no lint check. `<lint>` resolves to the dev command only —
agents run that in fix acceptance; the audit runs `probe-command`.

A `pkg-manager` row records an unrecognized (or overridden) manager:
name, exec prefix (`dlx` / `npx` / `bunx` equivalent), and add-dev
command with a `<pkg>` placeholder. Write it only when needed, as a
table row whose value is `pixi; pixi run; pixi add --dev <pkg>`.
**Absent means detect from the lockfile.** The recorded row wins over
detection. Do not leave a placeholder row in the table.

A `layout-source` row records the file that declared the workspace
(`pnpm-workspace.yaml`, `package.json`, `nx.json`, …).
**Absent means the missing-package freshness check skips** rather than
walking the tree. Write it whenever setup observed a declaring file.

## Dependency Policy

Optional. User-stated intended import order — **not** today's observed
import graph. Setup writes this section only when the user supplies an
explicit policy on the review screen. Omit the whole section when there
is none.

Without this section, the audit still detects circular imports but skips
wrong-direction findings and says why. Do not paste a live topological
sort or edge list here.

**Acyclic policy** — intended chain (repo package names from the table
below):

```
[e.g. web → server → core → shared]
```

**Cyclic policy** — rare; list intended edges both ways when the team
accepts a documented cycle:

```
- core → api [cycle]
- api → core [cycle]
```

A single-package repo normally omits this section.

## Package Layout

The audit skill reads this table to know where to scan. List every
package or top-level source directory that contains code worth auditing.
Use the repo's own names — no role mapping is required, and no fixed set
of role names is assumed.

For each row, provide a one-sentence responsibility describing what the
package does **today** — not what it should do. Keep it concrete
("HTTP routes and request validation", "domain entities and use cases",
"DB and queue adapters"). Agents use this column, plus any Dependency
Policy above, to reason about boundaries.

`Scannable` is `yes` or `no`. `no` means the audit skips the package and
reports it as not scanned — typically because it is not TypeScript or
JavaScript. An optional language note may follow (`no (Python)`).
**Absent means `yes`:** a file with no `Scannable` column keeps today's
behavior; every row is scanned.

`Entry points` are comma-separated paths relative to the package root
(`index.ts`, `server`, `client`). **Absent means `index.ts`.** A
multi-entry `exports` map is a deliberate API surface — importing those
subpaths is not `imports` #1.

A single-package repo with **one** scannable row has no policy edges.
`imports` #6 and `boundaries` B cannot fire — list them in `INDEX.md` as
not applicable, not as a silent pass. Multi-package without a Dependency
Policy skips #6 only (cycles still run). Directory-level rows (feature or
module dirs as separate rows) are legitimate and **do** give those
categories something to check when policy exists. The table has never
required npm packages.

| Package         | Path glob(s)                 | Import alias          | Responsibility   | Scannable | Entry points       |
| --------------- | ---------------------------- | --------------------- | ---------------- | --------- | ------------------ |
| `[e.g. core]`   | `[e.g. packages/core/src]`   | `[e.g. @repo/core]`   | `[one sentence]` | `yes`     | `index.ts`         |
| `[e.g. server]` | `[e.g. packages/server/src]` | `[e.g. @repo/server]` | `[one sentence]` | `yes`     | `index.ts, server` |
| `[e.g. shared]` | `[e.g. packages/shared/src]` | `[e.g. @repo/shared]` | `[one sentence]` | `yes`     | `index.ts`         |
| `[e.g. web]`    | `[e.g. apps/web/src]`        | `[n/a]`               | `[one sentence]` | `yes`     | `index.ts`         |
| `[e.g. worker]` | `[e.g. services/worker]`     | `[n/a]`               | `[one sentence]` | `no (Go)` | `index.ts`         |

Notes for the table:

- One row per package or top-level source directory the audit should scan.
- For glob-style multi-target directories (e.g. `apps/*/src`), keep the
  glob in the path column — the audit expands it.
- If a package has no import alias (e.g. an application root), put `n/a`.
- Responsibility is short and concrete — it's used by the audit to
  understand which package owns which kind of code.
- Do not drop a `Scannable: no` row. The audit lists it as a known
  blind spot rather than omitting it.

## Docs Layout

Observed documentation trees. `lodestar-docs` harvests into `home` rows
and sweeps `staging` rows. `inflight` is left alone. `unknown` is out of
scope until you re-run setup and classify it.

**Absent means discover at run time:** a file with no `## Docs Layout`
section is valid. `lodestar-docs` then observes the same way setup
would. An empty table means there was no docs tree.

Do not invent folders to fill this table.

| Path                                 | Role       | Responsibility                                                |
| ------------------------------------ | ---------- | ------------------------------------------------------------- |
| `[e.g. docs/spec]`                   | `home`     | Durable specs. Harvest rescued facts here.                    |
| `[e.g. docs/rejected-approaches.md]` | `home`     | Dead ends. Do not retry.                                      |
| `[e.g. docs/audit]`                  | `staging`  | Audit runs. Sweep done/ and abandoned/ only; leave live runs. |
| `[e.g. docs/architecture-review]`    | `staging`  | Completed architecture reviews.                               |
| `[e.g. docs/plans]`                  | `inflight` | In-flight plans. Nested done/ and abandoned/ are leftovers.   |
| `[e.g. docs/notes.md]`               | `unknown`  | Unclassified. Out of scope until classified.                  |

Roles: `home`, `staging`, `inflight`, `unknown`. One row per top-level
docs folder or file (plus `output-root` / architecture-review when they
exist). Nested `done/` and `abandoned/` under plans get their own
staging rows.

## Conventions

Style conventions this repo follows. Skip polarity is in the table;
`lodestar-audit` `validate-input` applies it in memory. **Absent means
defaults** below — not "every key is `yes`". Written values are the only
way to opt out.

| Convention       | Value | What it gates                                               |
| ---------------- | ----- | ----------------------------------------------------------- |
| `result-types`   | `yes` | `errors` #B (expected failures return `Result<T, E>`)       |
| `branded-types`  | `yes` | `boundaries` A, `types` #4                                  |
| `barrel-exports` | `no`  | `imports` #4 (`export *`) — `yes` means barrels are allowed |
| `design-tokens`  | `yes` | the whole `styling` category                                |
| `coverage-floor` | `80`  | the Testability coverage floor and the pre-commit checklist |

Keys and allowed values:

- `result-types`, `branded-types`, `design-tokens`: `yes` / `no` (default `yes`)
- `barrel-exports`: `no` / `yes` (default `no`) — `yes` means barrels are allowed
- `coverage-floor`: a positive integer or `none` (default `80`)

Unknown keys are ignored. A typo in a known value is an error at audit
time, not a silent default.

A repo that throws typed errors and uses Tailwind would set
`result-types` to `no` and `design-tokens` to `no`; the other rows stay
at their defaults.

## Review Rubric

Repo-owned paths a later review or implement pass should read, **in
addition to** the principles that ship with the installed
`lodestar-setup` skill. List only repository files here — never the
bundled `principles.md` (skills resolve that from the setup skill
directory). **Absent means principles only.** No version gate and no
fail-closed parse — a file with no such section still audits. Setup
writes this section even when the extras list is empty.

Bullets are what setup found (`CONTRIBUTING.md`, `AGENTS.md`,
`CLAUDE.md`, style docs under the observed docs tree, host-agent rules
files) plus review-screen corrections.

- `[e.g. CONTRIBUTING.md]`
- `[e.g. AGENTS.md]`

## Audit Configuration

How the audit and `lodestar-fix` behave. **Omit this whole section when
`lodestar-audit` is not installed** — plan and implement discover commit
policy themselves. When audit is installed, **absent means default:**
every category, output under `docs/audit`, Fallow required, `mode: all`,
ask each session before committing, no extra exclusions. Setup writes
this section at those defaults and does not ask about categories,
output-root, or fallow. `lodestar-audit` may offer to persist a category
subset here after a run.

Discovery still scans the whole repo; `mode` only decides which findings
become action items.

| Key               | Value                | Notes                                                                                                                                                                                                                           |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories`      | `all`                | `all`, or a comma-separated list of category names (`imports`, `types`, …)                                                                                                                                                      |
| `output-root`     | `docs/audit`         | Where audit runs land (`<output-root>/<RUN_ID>/`). Relative, no `..`.                                                                                                                                                           |
| `fallow`          | `required`           | `required` stops if Fallow is missing or out of range. `optional` continues with grep-only detectors.                                                                                                                           |
| `scan-extensions` | `.ts, .tsx, .vue`    | Comma-separated file extensions (with leading dot) for grep and `source-scan`. **Absent means default:** `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`. Setup writes a tailored list after observing frameworks. |
| `mode`            | `all`                | `all` expands every finding. `changed-since` expands only findings that touch code changed since `baseline-ref`.                                                                                                                |
| `baseline-ref`    | `[commit sha]`       | Required when `mode: changed-since`. Omit the row when `mode` is `all`.                                                                                                                                                         |
| `baseline-date`   | `[YYYY-MM-DD]`       | Human-readable capture date. Informational; never parsed.                                                                                                                                                                       |
| `commits`         | `ask`                | `ask` keeps today's question. `per-item` commits without asking. `never` never asks and never commits — edits stay unstaged.                                                                                                    |
| `subject-format`  | `<category>: <slug>` | Must contain `<slug>`. Also substitutes `<category>`. Single line, at most 200 characters.                                                                                                                                      |
| `trailer`         | `Closes <item>.`     | Body line. `none` for no trailer. `<item>` is the action-item path. Single line, at most 200 characters.                                                                                                                        |
| `protected`       | `none`               | Branches `lodestar-fix` refuses to commit on. Comma-separated names, or `none`.                                                                                                                                                 |
| `require-clean`   | `no`                 | `yes` refuses to start with a dirty working tree.                                                                                                                                                                               |

Architecture reports derive from the same root: `docs/audit` →
`docs/architecture-review`; any other root →
`<output-root>/architecture-review`.

`mode: changed-since` without a resolvable `baseline-ref` is an error
at audit time, not a silent fallback to `all`. Out-of-scope findings
stay in `findings.md` and are counted as a backlog in `INDEX.md`.

Unknown keys are ignored. A typo in a known value, or a `subject-format`
with no `<slug>`, is an error at audit time, not a silent default.

Setup detects commit policy; the review screen states **ask each time**
as the default. Detection uses commitlint (`commitlint.config.*`,
`.commitlintrc*`, `package.json` `commitlint`; use its type list —
`fix` → `fix(<category>): <slug>`, else `chore` or the first type);
last ~20 `git log --format=%s` subjects; hooks (`.husky/`,
`lefthook.y*ml`, non-sample `.git/hooks`); current branch
(`main`/`master` → propose for `protected`). Format keys are written,
not shown. Defaults otherwise: `commits: ask`, trailer `Closes
<item>.`, `require-clean: no`.

### Excluded Paths

Globs the audit does not treat as hand-written source. Nested here
because a glob list is not key/value. **Absent means default:** no extra
exclusions, and tests match `*.spec.*` / `*.test.*` plus `*.d.ts`.

**Not audited** — generated, vendored, and build output. Skipped entirely
by every detector and by Fallow `ignorePatterns`.

- `[e.g. packages/db/generated/**]` — Prisma client
- `[e.g. **/*.gen.ts]` — GraphQL codegen

**Test files** — skipped by default. Detectors that want tests pass
`--include-tests`. Replaces the hardcoded `*.spec.*` / `*.test.*` match
when this list is present.

- `[e.g. **/*.test.ts]` — vitest
- `[e.g. **/__tests__/**]` — colocated tests

One glob per bullet, with a one-line reason. Do not restate Fallow's
built-in ignores (`**/dist/**`, `**/*.d.ts`, `node_modules`).

## Reference

Principles (TypeScript rules, testability, error handling, anti-pattern
reference, pre-commit checklist) live in `principles.md` beside the
installed `lodestar-setup` `SKILL.md`. Resolve that path from the setup
skill directory — do not hardcode `.agents/skills/…`. Do not copy its
content here.

The following skills are installed beside setup (fill from detected
siblings; omit rows for skills that are not present). To use one, read
its `SKILL.md` and follow it.

| Skill               | File                                                  | When to use                                                                                   |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Setup               | `<setup-skill-parent>/lodestar-setup/SKILL.md`        | Re-scaffold or refresh this file                                                              |
| Audit               | `<setup-skill-parent>/lodestar-audit/SKILL.md`        | Scan the codebase and emit action-item files under the `output-root` in Audit Configuration   |
| Fix audit items     | `<setup-skill-parent>/lodestar-fix/SKILL.md`          | Triage and apply fixes from an audit run                                                      |
| Review architecture | `<setup-skill-parent>/lodestar-architecture/SKILL.md` | Get an advisory second opinion on the layout above; optionally have it propose an alternative |
| Write a plan        | `<setup-skill-parent>/lodestar-plan/SKILL.md`         | Multi-stage or cross-package work that needs an implementable plan                            |
| Implement a plan    | `<setup-skill-parent>/lodestar-implement/SKILL.md`    | Execute a plan one stage at a time                                                            |
| Prune leftover docs | `<setup-skill-parent>/lodestar-docs/SKILL.md`         | Harvest then delete leftover audit, architecture, and plan writeups; optional                 |

One outcome sentence: a **single-concern, fixable violation** → an
audit action item; a **multi-stage or cross-package redesign** →
`lodestar-plan`.

When audit is installed: it writes one self-contained `.md` file per
violation into `<output-root>/<run-id>/` (see `output-root` above;
default `docs/audit/<run-id>/`). Each file is independently fixable —
hand it to an LLM with a prompt like:

> Read `<output-root>/<RUN_ID>/<filename>.md`. Implement the fix exactly as
> specified. Do not modify files outside the `files:` list. Run
> `[typecheck]` and `[test]` before committing. Stop if any scope rule is hit.

The audit does not modify code itself.
