# Fixture

Used to exercise `lodestar-docs` default trees, live-run protection, and
discovered homes.

## Build & Test

| Command   | Run               |
| --------- | ----------------- |
| typecheck | npm run typecheck |
| lint      | n/a               |
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

| Key           | Value        | Notes |
| ------------- | ------------ | ----- |
| `output-root` | `docs/audit` |       |
| `commits`     | `never`      |       |

## Docs Layout

| Path | Role | Responsibility |
| --- | --- | --- |
| docs/audit | staging | Audit runs. Sweep done/ and abandoned/ only; leave live runs. |
| docs/architecture-review | staging | Completed architecture reviews. |
| docs/orphan.md | unknown | Unclassified. Out of scope until you say what it is. |
| docs/plans | inflight | In-flight plans. Nested done/ and abandoned/ are leftovers. |
| docs/plans/abandoned | staging | Leftover writeups. Default sweep. |
| docs/plans/done | staging | Leftover writeups. Default sweep. |
| docs/rejected-approaches.md | home | Durable docs. Harvest rescued facts here. |
| docs/spec | home | Durable docs. Harvest rescued facts here. |

## Resolved Decisions

Derived by `lodestar-setup`. Regenerated on every re-run — do not hand-edit.

| Key | Value | Notes |
| --- | --- | --- |
| `probe-plan` | `none` | |
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