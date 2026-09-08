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

## Decision

Yes: remove the api import from core (or move the call site). No: skip.
Defer: leave deferred until Dependency Policy is clear.

## Acceptance check

Run `npm run typecheck` and `npm test`.
