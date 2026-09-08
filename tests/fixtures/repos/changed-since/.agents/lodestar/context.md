# Fixture

A long-lived repo that adopted lodestar at a captured commit. Used to
exercise `## Audit Configuration` `mode: changed-since`.

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

## Audit Configuration

| Key             | Value                                      | Notes |
| --------------- | ------------------------------------------ | ----- |
| `mode`          | `changed-since`                            |       |
| `baseline-ref`  | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |       |
| `baseline-date` | `2026-08-18`                               |       |

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