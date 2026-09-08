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

## Dependency Policy

User-stated intended import order — not an observed graph.

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

- `CONTRIBUTING.md`

## Audit Configuration

| Key           | Value        | Notes |
| ------------- | ------------ | ----- |
| `output-root` | `docs/audit` |       |

## Reference

Principles resolve from the installed lodestar-setup skill.

## Resolved Decisions

Derived by `lodestar-setup`. Regenerated on every re-run — do not hand-edit.

| Key | Value | Notes |
| --- | --- | --- |
| `probe-plan` | `eslint --format json --max-warnings=999 <all_pkg_roots>` | |
| `active-detectors` | see list below | |
| `blind-spots` | none | |

### Active detectors

- `imports`: #1, #2, #3, #4, #5, #6, #7, #8, #9
- `types`: #1, #2, #3, #4
- `boundaries`: A, B, C, D, E
- `errors`: A, B
- `testability`: A, B
- `soc-yagni`: A, B, C, D
- `dry`: A, B, C
- `ssot`: A, B, C
- `styling`: A, B, C, D

### Blind spots

(none)
