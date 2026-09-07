---
id: 001
category: types
subtype: explicit-any
risk: low
requires_decision: false
files:
  - src/a.ts
  scope: nested wrongly
  findings: F0001
---

# 001 — Bad

## Problem

Something wrong in src/a.ts with any.

## Suggested fix

1. Remove any.

## Scope rules

Do not modify files outside files:.

## Acceptance check

Run typecheck.
