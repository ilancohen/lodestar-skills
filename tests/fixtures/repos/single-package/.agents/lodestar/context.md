# Fixture — one package, declared manager, git policy

## Build & Test

| Command     | Run                                      |
| ----------- | ---------------------------------------- |
| typecheck   | n/a                                      |
| lint        | n/a                                      |
| test        | pixi run test                            |
| pkg-manager | pixi; pixi run; pixi add --dev <pkg>     |

## Dependency Direction

Basis: observed import graph, captured 2026-08-18.

## Package Layout

| Package | Path | Alias | Responsibility                      | Scannable | Entry points      |
| ------- | ---- | ----- | ----------------------------------- | --------- | ----------------- |
| app     | src  | n/a   | HTTP routes and request validation  | yes       | index.ts, server  |

## Audit Configuration

| Key              | Value                      | Notes |
| ---------------- | -------------------------- | ----- |
| `commits`        | `never`                    |       |
| `subject-format` | `fix(<category>): <slug>`  |       |
| `trailer`        | `none`                     |       |
| `protected`      | `main`                     |       |
| `require-clean`  | `yes`                      |       |
