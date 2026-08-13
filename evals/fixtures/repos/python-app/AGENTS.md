# Python app fixture

## Build & Test

| Command   | Run        |
| --------- | ---------- |
| typecheck | ruff check |
| test      | pytest     |

## Dependency Direction

core → api

## Package Layout

| Package | Path          | Alias | Responsibility  |
| ------- | ------------- | ----- | --------------- |
| core    | packages/core | core  | Domain entities |
| api     | packages/api  | api   | HTTP handlers   |
