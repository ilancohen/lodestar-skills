# Fixture — 0.8.x section names, must fail closed

## Build & Test

| Command   | Run               |
| --------- | ----------------- |
| typecheck | npm run typecheck |
| lint      | npm run lint      |
| test      | npm test          |

## Dependency Direction

Basis: observed import graph, captured 2026-08-18.

core → api

## Package Layout

| Package | Path              | Alias      | Responsibility                            |
| ------- | ----------------- | ---------- | ----------------------------------------- |
| core    | packages/core/src | @repo/core | Domain entities and use cases for billing |
| api     | packages/api/src  | @repo/api  | HTTP routes and request validation        |

## Audit Settings

| Setting       | Value        | Notes |
| ------------- | ------------ | ----- |
| `categories`  | `all`        |       |
| `output-root` | `docs/audit` |       |
| `fallow`      | `required`   |       |

## Principles

See `.agents/skills/lodestar-setup/principles.md`.
