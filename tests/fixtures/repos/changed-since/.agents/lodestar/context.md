# Fixture

A long-lived repo that adopted lodestar at a captured commit. Used to
exercise `## Audit Configuration` `mode: changed-since`.

## Build & Test

| Command   | Run               |
| --------- | ----------------- |
| typecheck | npm run typecheck |
| lint      | npm run lint; eslint; eslint --format json --max-warnings=999 <all_pkg_roots>      |
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

| Key             | Value                                      | Notes |
| --------------- | ------------------------------------------ | ----- |
| `mode`          | `changed-since`                            |       |
| `baseline-ref`  | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |       |
| `baseline-date` | `2026-08-18`                               |       |
