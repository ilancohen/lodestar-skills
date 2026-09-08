# Fixture

A repo that throws typed errors, uses Tailwind, and does not enforce a
coverage floor. Used to exercise convention opt-outs and a custom audit
output root.

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
| `result-types`   | `no`   | `errors` #B (expected failures return `Result<T, E>`)       |
| `branded-types`  | `yes`  | `boundaries` A, `types` #4                                  |
| `barrel-exports` | `no`   | `imports` #4 (`export *`) — `yes` means barrels are allowed |
| `design-tokens`  | `no`   | the whole `styling` category                                |
| `coverage-floor` | `none` | the Testability coverage floor and the pre-commit checklist |

## Audit Configuration

| Key           | Value     | Notes |
| ------------- | --------- | ----- |
| `output-root` | `docs/qa` |       |

## Reference

Principles resolve from the installed lodestar-setup skill.

## Resolved Decisions

Derived by `lodestar-setup`. Regenerated on every re-run — do not hand-edit.

| Key | Value | Notes |
| --- | --- | --- |
| `probe-plan` | `eslint --format json --max-warnings=999 <all_pkg_roots>` | |
| `active-detectors` | see list below | |
| `blind-spots` | see list below | |

### Active detectors

- `imports`: #1, #2, #3, #4, #5, #6, #7, #8, #9
- `types`: #1, #2, #3, #4
- `boundaries`: A, B, C, D, E
- `errors`: A
- `testability`: A, B
- `soc-yagni`: A, B, C, D
- `dry`: A, B, C
- `ssot`: A, B, C

### Blind spots

- `errors` B (expected-failure Result returns) — skipped; `result-types` is `no`
- `styling` (entire category) — skipped; `design-tokens` is `no`
