# Fixture

A repo with a discovered `## Review Rubric` section. Used to prove the
section is optional-and-additive: `validate-input` still parses, and
`## Conventions` still stops at the next heading.

## Build & Test

| Command   | Run               |
| --------- | ----------------- |
| typecheck | npm run typecheck |
| lint      | npm run lint; eslint; eslint --format json --max-warnings=999 <all_pkg_roots>      |
| test      | npm test          |

## Dependency Direction

Basis: observed import graph, captured 2026-09-06.

core → api

## Package Layout

| Package | Path              | Alias      | Responsibility                            |
| ------- | ----------------- | ---------- | ----------------------------------------- |
| core    | packages/core/src | @repo/core | Domain entities and use cases for billing |
| api     | packages/api/src  | @repo/api  | HTTP routes and request validation        |

## Conventions

| Convention       | Value  | What it gates                                               |
| ---------------- | ------ | ----------------------------------------------------------- |
| `result-types`   | `yes`  | `errors` #B (expected failures return `Result<T, E>`)       |
| `branded-types`  | `yes`  | `boundaries` A, `types` #4                                  |
| `barrel-exports` | `no`   | `imports` #4 (`export *`) — `yes` means barrels are allowed |
| `design-tokens`  | `yes`  | the whole `styling` category                                |
| `coverage-floor` | `80`   | the Testability coverage floor and the pre-commit checklist |

## Review Rubric

- `.agents/skills/lodestar-setup/principles.md` — always; suite baseline
- `CONTRIBUTING.md`

## Audit Configuration

| Key           | Value        | Notes |
| ------------- | ------------ | ----- |
| `output-root` | `docs/audit` |       |

## Reference

See `.agents/skills/lodestar-setup/principles.md`.
