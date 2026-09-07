# Fixture — mixed TypeScript and Go

## Build & Test

| Command   | Run               |
| --------- | ----------------- |
| typecheck | npm run typecheck |
| lint      | npm run lint; eslint; eslint --format json --max-warnings=999 <all_pkg_roots>      |
| test      | npm test          |

## Dependency Direction

Basis: observed import graph, captured 2026-08-18.

## Package Layout

| Package | Path              | Alias      | Responsibility                            | Scannable |
| ------- | ----------------- | ---------- | ----------------------------------------- | --------- |
| core    | packages/core/src | @repo/core | Domain entities and use cases for billing | yes       |
| worker  | services/worker   | n/a        | Background jobs and queue consumers       | no (Go)   |

## Resolved Decisions

Derived by `lodestar-setup`. Regenerated on every re-run — do not hand-edit.

| Key | Value | Notes |
| --- | --- | --- |
| `probe-plan` | `eslint --format json --max-warnings=999 <all_pkg_roots>` | |
| `active-detectors` | see list below | |
| `blind-spots` | see list below | |

### Active detectors

- `imports`: #1, #2, #3, #4, #5, #7, #8, #9
- `types`: #1, #2, #3, #4
- `boundaries`: A, C, D, E
- `errors`: A, B
- `testability`: A, B
- `soc-yagni`: A, B, C, D
- `dry`: A, B, C
- `ssot`: A, B, C
- `styling`: A, B, C, D

### Blind spots

- `worker` — Go, not scanned
- `imports` #6 (wrong-direction imports) — not applicable: single-package repo
- `boundaries` B (cross-package misplaced logic) — not applicable: single-package repo
