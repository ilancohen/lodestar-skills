# Fixture

A repo that throws typed errors, uses Tailwind, and does not enforce a
coverage floor. Used to exercise convention opt-outs and a custom audit
output root.

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

## Conventions

| Convention       | Value  | What it gates                                               |
| ---------------- | ------ | ----------------------------------------------------------- |
| `result-types`   | `no`   | `errors` #B (expected failures return `Result<T, E>`)       |
| `branded-types`  | `yes`  | `boundaries` A, `types` #4                                  |
| `barrel-exports` | `no`   | `imports` #4 (`export *`) — `yes` means barrels are allowed |
| `design-tokens`  | `no`   | the whole `styling` category                                |
| `coverage-floor` | `none` | the Testability coverage floor and the pre-commit checklist |

## Audit Settings

| Setting       | Value     | Notes |
| ------------- | --------- | ----- |
| `categories`  | `all`     |       |
| `output-root` | `docs/qa` |       |

## Principles

See `.agents/skills/lodestar-setup/principles.md`.
