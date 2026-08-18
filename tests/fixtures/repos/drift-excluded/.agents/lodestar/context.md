# Fixture — Scannable no, make test, n/a typecheck

## Build & Test

| Command       | Run                 |
| ------------- | ------------------- |
| typecheck     | n/a                 |
| lint          | n/a                 |
| test          | make test           |
| layout-source | pnpm-workspace.yaml |

## Dependency Direction

Basis: observed import graph, captured 2026-08-18.

## Package Layout

| Package  | Path                  | Alias          | Responsibility                            | Scannable |
| -------- | --------------------- | -------------- | ----------------------------------------- | --------- |
| core     | packages/core/src     | @repo/core     | Domain entities and use cases for billing | yes       |
| internal | packages/internal/src | @repo/internal | Legacy internals kept but not audited     | no        |
