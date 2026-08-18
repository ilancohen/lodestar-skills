# Fixture — mixed TypeScript and Go

## Build & Test

| Command   | Run               |
| --------- | ----------------- |
| typecheck | npm run typecheck |
| lint      | npm run lint      |
| test      | npm test          |

## Dependency Direction

Basis: observed import graph, captured 2026-08-18.

## Package Layout

| Package | Path              | Alias      | Responsibility                            | Scannable |
| ------- | ----------------- | ---------- | ----------------------------------------- | --------- |
| core    | packages/core/src | @repo/core | Domain entities and use cases for billing | yes       |
| worker  | services/worker   | n/a        | Background jobs and queue consumers       | no (Go)   |
