# Fixture — Bun lockfile, no pkg-manager row

## Build & Test

| Command   | Run      |
| --------- | -------- |
| typecheck | n/a      |
| lint      | n/a      |
| test      | bun test |

## Dependency Direction

Basis: observed import graph, captured 2026-08-18.

## Package Layout

| Package | Path | Alias | Responsibility                     |
| ------- | ---- | ----- | ---------------------------------- |
| app     | src  | n/a   | HTTP routes and request validation |
