# AGENTS.md

## Project

[One paragraph: what this repo does, its tech stack, and a brief summary of
how the code is organized. Example: "A TypeScript monorepo for the Acme
billing platform. Uses pnpm workspaces with packages for domain logic, the
HTTP layer, a background worker, and shared types/utilities."]

## Build & Test

| Command | What it runs |
|---|---|
| `[install]` | Install all dependencies |
| `[build]` | Build all packages |
| `[typecheck]` | TypeScript type check — run before every commit |
| `[lint]` | Lint all packages |
| `[test]` | Full test suite |

## Dependency Direction

Packages must only import in this direction:

```
[e.g. web → server → core → shared — use the actual package names from the
table below, not generic role names]
```

Reverse-direction imports are violations. They'll be surfaced by the
audit skill below.

## Package Layout

The audit skill reads this table to know where to scan. List every
package or top-level source directory that contains code worth auditing.
Use the repo's own names — no role mapping is required, and no fixed set
of role names is assumed.

For each row, provide a one-sentence responsibility. Keep it concrete
("HTTP routes and request validation", "domain entities and use cases",
"DB and queue adapters"). Agents use this column, plus the dependency
direction above, to reason about boundaries.

| Package | Path glob(s) | Import alias | Responsibility |
|---|---|---|---|
| `[e.g. core]` | `[e.g. packages/core/src]` | `[e.g. @repo/core]` | `[one sentence]` |
| `[e.g. server]` | `[e.g. packages/server/src]` | `[e.g. @repo/server]` | `[one sentence]` |
| `[e.g. shared]` | `[e.g. packages/shared/src]` | `[e.g. @repo/shared]` | `[one sentence]` |
| `[e.g. web]` | `[e.g. apps/web/src]` | `[n/a]` | `[one sentence]` |

Notes for the table:
- One row per package or top-level source directory the audit should scan.
- For glob-style multi-target directories (e.g. `apps/*/src`), keep the
  glob in the path column — the audit expands it.
- If a package has no import alias (e.g. an application root), put `n/a`.
- Responsibility is short and concrete — it's used by the audit to
  understand which package owns which kind of code.

## Lodestar

This repo enforces the principles in `.agents/skills/README.md`.
Before completing any task, check the pre-commit checklist in that file.

## Skills

The following skills are available. To use one, read its `SKILL.md` and follow it.

| Skill | File | When to use |
|---|---|---|
| Setup | `.agents/skills/lodestar-setup/SKILL.md` | Re-scaffold or refresh this config |
| Audit | `.agents/skills/lodestar-audit/SKILL.md` | Scan the codebase and emit action-item files into `docs/audit/<run-id>/` |
| Fix audit items | `.agents/skills/lodestar-fix/SKILL.md` | Triage and apply fixes from an audit run |
| Review architecture | `.agents/skills/lodestar-architecture/SKILL.md` | Get an advisory second opinion on the layout above; optionally have it propose an alternative |

## Audit Output

The audit skill writes one self-contained `.md` file per violation into
`docs/audit/<run-id>/`. Each file is independently fixable — hand it
to an LLM with a prompt like:

> Read `docs/audit/<RUN_ID>/<filename>.md`. Implement the fix exactly as
> specified. Do not modify files outside the `files:` list. Run
> `[typecheck]` and `[test]` before committing. Stop if any scope rule is hit.

The audit does not modify code itself.
