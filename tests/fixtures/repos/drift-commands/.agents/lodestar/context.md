# Fixture — recorded test script no longer exists

## Build & Test

| Command       | Run                |
| ------------- | ------------------ |
| install       | pnpm install       |
| build         | pnpm run build     |
| typecheck     | pnpm run typecheck |
| lint          | pnpm run lint; eslint; eslint --format json --max-warnings=999 <all_pkg_roots>      |
| test          | pnpm test          |
| layout-source | pnpm-workspace.yaml |

## Dependency Direction

Basis: observed import graph, captured 2026-08-18.

core → api

## Package Layout

| Package | Path              | Alias      | Responsibility                            |
| ------- | ----------------- | ---------- | ----------------------------------------- |
| core    | packages/core/src | @repo/core | Domain entities and use cases for billing |
| api     | packages/api/src  | @repo/api  | HTTP routes and request validation        |
