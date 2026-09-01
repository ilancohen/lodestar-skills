# Fixture

Used to exercise `lodestar-docs` default trees, live-run protection, and
discovered homes.

## Build & Test

| Command   | Run               |
| --------- | ----------------- |
| typecheck | npm run typecheck |
| lint      | n/a               |
| test      | npm test          |

## Dependency Direction

Basis: observed import graph, captured 2026-08-18.

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
