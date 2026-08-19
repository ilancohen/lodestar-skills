# Fixture — cyclic import graph

## Build & Test

| Command   | Run               |
| --------- | ----------------- |
| typecheck | npm run typecheck |
| lint      | npm run lint; eslint; eslint --format json --max-warnings=999 <all_pkg_roots>      |
| test      | npm test          |

## Dependency Direction

Observed package import graph — not an intended or target layout.

Basis: observed import graph, captured 2026-08-18.

- core → api (1 import) [cycle]
- api → core (1 import) [cycle]

The graph is cyclic — no single dependency order exists.

## Package Layout

| Package | Path              | Alias      | Responsibility                            |
| ------- | ----------------- | ---------- | ----------------------------------------- |
| core    | packages/core/src | @repo/core | Domain entities and use cases for billing |
| api     | packages/api/src  | @repo/api  | HTTP routes and request validation        |
