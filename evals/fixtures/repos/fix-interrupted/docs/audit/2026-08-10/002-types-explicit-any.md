---
id: 002
category: types
subtype: explicit-any
risk: low
requires_decision: false
files:
  - packages/api/src/routes/users.ts
scope: Replace the explicit any return type
findings: F0003
---

# 002 — Remove explicit `any`

## Problem

`listUsers` in `packages/api/src/routes/users.ts` is annotated `: any`.

## Suggested fix

1. Change `export function listUsers(): any` to `export function listUsers()`.

## Scope rules

Do not modify files outside `files:`.

## Acceptance check

Run `npm run typecheck` and `npm test`.
