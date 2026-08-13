---
id: 003
category: imports
subtype: wrong-direction
risk: medium
requires_decision: true
files:
  - packages/core/src/billing/refunds.ts
scope: Remove the api import from core
findings: F0002
---

# 003 — Stop core importing api

## Problem

`packages/core/src/billing/refunds.ts` imports `@repo/api`, reversing core → api.

## Suggested fix

1. Ask which inversion to use, then remove the api import.

## Scope rules

Do not modify files outside `files:`. Ask before editing.

## Acceptance check

Run `npm run typecheck` and `npm test`.
