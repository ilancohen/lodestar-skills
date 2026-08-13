---
id: 001
category: imports
subtype: cross-package-src
risk: low
requires_decision: false
files:
  - packages/api/src/routes/users.ts
scope: Replace the deep core import with the package alias
findings: F0001
---

# 001 — Stop importing `@repo/core/src`

## Problem

`packages/api/src/routes/users.ts` imports `@repo/core/src/user/user.service`.

## Suggested fix

1. Import from `@repo/core` instead of `@repo/core/src/...`.

## Scope rules

Do not modify files outside `files:`.

## Acceptance check

Run `npm run typecheck` and `npm test`.
