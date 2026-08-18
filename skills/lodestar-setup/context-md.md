# Lodestar Context

Written by `lodestar-setup` to `.agents/lodestar/context.md`. This is the
only file the lodestar skills read for repo facts — `lodestar-audit`,
`lodestar-fix`, and `lodestar-architecture` stop and ask for setup if it is
missing. Keep it accurate; nothing else needs to be kept in sync. To
see whether this file still matches the repo, run `check-freshness`
(do not re-run setup just to find out):

```text
node <lodestar-audit-skill>/scripts/audit-state.mjs check-freshness --root <repo>
```

Exit 0: still true. Exit 2: named facts have drifted — re-run
`lodestar-setup` to rewrite them.

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
| `[lint]`      | Lint all packages                               |
| `[test]`      | Full test suite                                 |

`n/a` in a command cell means that check does not exist. Do not invent
one. `lodestar-fix` runs the checks that are present and reports which
acceptance step was skipped. The audit's linter probe degrades to
heuristics when `<lint>` is `n/a` — it must not error.

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

## Dependency Direction

Observed package import graph — not an intended or target layout. The audit
derives allowed imports from this graph: imports that oppose a documented
edge or path are wrong-direction findings; edges of a documented cycle are
reported as circular dependencies instead. Any intended-but-not-yet-true
layout belongs in `lodestar-architecture`'s advisory report, not here.

Basis: observed import graph, captured [YYYY-MM-DD].

**Acyclic** — record the topological order as a chain (one observed
ordering, not a rule):

```
[e.g. web → server → core → shared — use the actual package names from the
table below, not generic role names]
```

**Cyclic** — no single order exists; list observed edges instead:

```
- core → api (N imports) [cycle]
- api → core (N imports) [cycle]
```

The graph is cyclic — no single dependency order exists.

New downward imports consistent with the documented ordering are not
violations until this section is updated.

A single-package repo has an empty graph (no chain, no edges). That is
valid — do not invent a one-node chain.

## Package Layout

The audit skill reads this table to know where to scan. List every
package or top-level source directory that contains code worth auditing.
Use the repo's own names — no role mapping is required, and no fixed set
of role names is assumed.

For each row, provide a one-sentence responsibility describing what the
package does **today** — not what it should do. Keep it concrete
("HTTP routes and request validation", "domain entities and use cases",
"DB and queue adapters"). Agents use this column, plus the dependency
graph above, to reason about boundaries.

`Scannable` is `yes` or `no`. `no` means the audit skips the package and
reports it as not scanned — typically because it is not TypeScript or
JavaScript. An optional language note may follow (`no (Python)`).
**Absent means `yes`:** a file with no `Scannable` column keeps today's
behavior; every row is scanned.

`Entry points` are comma-separated paths relative to the package root
(`index.ts`, `server`, `client`). **Absent means `index.ts`.** A
multi-entry `exports` map is a deliberate API surface — importing those
subpaths is not `imports` #1.

A single-package repo with **one** scannable row has an empty graph.
`imports` #6 and `boundaries` B cannot fire — list them in `INDEX.md` as
not applicable, not as a silent pass. Directory-level rows (feature or
module dirs as separate rows) are legitimate and **do** give those
categories something to check; do not mark them inert. The table has
never required npm packages.

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

## Excluded Paths

Globs the audit does not treat as hand-written source. **Absent means
default:** no extra exclusions, and tests match `*.spec.*` / `*.test.*`
plus `*.d.ts` (today's `source-scan` behavior). A pre-existing file
without this section is unchanged.

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

## Conventions

Which of a short list of style conventions this repo actually follows.
The audit skips a detector only at that row's skip value: `no` for
`result-types`, `branded-types`, and `design-tokens`; `yes` for
`barrel-exports` (barrels allowed); `none` for `coverage-floor`.
**Absent means default:** a file with no `## Conventions` section, or a
missing row, uses the default in the table below — not "every key is
`yes`". Values written here are the only way to opt out.

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

## Audit Settings

How the audit runs — not the repo's style (that's `## Conventions`).
**Absent means default:** every category, output under `docs/audit`,
Fallow required. Setup writes this section at those defaults and does
not ask about it. `lodestar-audit` may offer to persist a category
subset here after a run.

| Setting       | Value        | Notes                                                                                                                                                                |
| ------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories`  | `all`        | `all`, or a comma-separated list of category names (`imports`, `types`, …)                                                                                           |
| `output-root` | `docs/audit` | Where audit runs land (`<output-root>/<RUN_ID>/`). Relative, no `..`.                                                                                                |
| `fallow`      | `required`   | `required` (default) stops the audit if Fallow is missing or out of range. `optional` continues with grep-only detectors and lists unchecked subtypes in `INDEX.md`. |

Architecture reports derive from the same root so the two stay together:
`docs/audit` → `docs/architecture-review`; any other root →
`<output-root>/architecture-review`.

Unknown keys are ignored. A typo in a known value is an error at audit
time, not a silent default.

## Audit Scope

Which findings become action items. Discovery still scans the whole
repo and writes every finding into `findings.md`; this section does
not narrow the scan. **Absent means
`mode: all`:** a file with no `## Audit Scope` section expands every
finding, exactly as today.

| Key             | Value                          | Notes                                                                                          |
| --------------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `mode`          | `all`                          | `all` expands every finding. `changed-since` expands only findings that touch code changed since `baseline-ref`. |
| `baseline-ref`  | `[commit sha]`                 | The adoption commit. Required when `mode: changed-since`.                                      |
| `baseline-date` | `[YYYY-MM-DD]`                 | Human-readable capture date. Informational; never parsed.                                      |

`mode: changed-since` without a resolvable `baseline-ref` is an error
at audit time, not a silent fallback to `all`. Out-of-scope findings
stay in `findings.md` and are counted as a backlog in `INDEX.md`.

Unknown keys are ignored. A typo in a known value is an error at audit
time, not a silent default.

## Git

How `lodestar-fix` commits. **Absent means default:** ask each session,
today's subject and trailer, no protected branches, dirty trees allowed.
A pre-existing file without this section is unchanged.

| Key              | Value                | Notes                                                                                          |
| ---------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `commits`        | `ask`                | `ask` keeps today's question. `per-item` commits without asking. `never` never asks and never commits — edits stay unstaged. |
| `subject-format` | `<category>: <slug>` | Must contain `<slug>`. Also substitutes `<category>`.                                          |
| `trailer`        | `Closes <item>.`     | Body line. `none` for no trailer. `<item>` is the action-item path.                            |
| `protected`      | `none`               | Branches `lodestar-fix` refuses to commit on. Comma-separated names, or `none`.                |
| `require-clean`  | `no`                 | `yes` refuses to start with a dirty working tree.                                              |

Unknown keys are ignored. A typo in a known value, or a `subject-format`
with no `<slug>`, is an error at audit time, not a silent default.

Setup detects, then asks once with the table pre-filled: commitlint
(`commitlint.config.*`, `.commitlintrc*`, `package.json` `commitlint`;
use its type list — `fix` → `fix(<category>): <slug>`, else `chore` or
the first type); last ~20 `git log --format=%s` subjects (Conventional
Commits → same shape; a leading ticket ID has no placeholder — they
can prefix the template); hooks (`.husky/`, `lefthook.y*ml`, non-sample
`.git/hooks`; grep prettier / biome / `eslint --fix`); current branch
(`main`/`master` → propose for `protected`). Defaults otherwise:
`commits: ask`, trailer `Closes <item>.`, `require-clean: no`.

## Principles

The principles, TypeScript rules, testability and error-handling rules,
anti-pattern reference, and pre-commit checklist live in
`.agents/skills/lodestar-setup/principles.md`. That file is the single
source of truth — do not copy its content here.

## Skills

The following skills are available. To use one, read its `SKILL.md` and follow it.

| Skill               | File                                            | When to use                                                                                   |
| ------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Setup               | `.agents/skills/lodestar-setup/SKILL.md`        | Re-scaffold or refresh this file                                                              |
| Audit               | `.agents/skills/lodestar-audit/SKILL.md`        | Scan the codebase and emit action-item files under the `output-root` in `## Audit Settings`   |
| Fix audit items     | `.agents/skills/lodestar-fix/SKILL.md`          | Triage and apply fixes from an audit run                                                      |
| Review architecture | `.agents/skills/lodestar-architecture/SKILL.md` | Get an advisory second opinion on the layout above; optionally have it propose an alternative |

## Audit Output

The audit skill writes one self-contained `.md` file per violation into
`<output-root>/<run-id>/` (see `## Audit Settings`; default
`docs/audit/<run-id>/`). Each file is independently fixable — hand it
to an LLM with a prompt like:

> Read `<output-root>/<RUN_ID>/<filename>.md`. Implement the fix exactly as
> specified. Do not modify files outside the `files:` list. Run
> `[typecheck]` and `[test]` before committing. Stop if any scope rule is hit.

The audit does not modify code itself.
