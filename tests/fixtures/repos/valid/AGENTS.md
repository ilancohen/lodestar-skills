# Fixture

## Build & Test

| Command | Run |
|---|---|
| typecheck | npm run typecheck |
| lint | npm run lint |
| test | npm test |

## Dependency Direction

core → api

## Package Layout

| Package | Path | Alias | Responsibility |
|---|---|---|---|
| core | packages/core/src | @repo/core | Domain entities and use cases for billing |
| api | packages/api/src | @repo/api | HTTP routes and request validation |
