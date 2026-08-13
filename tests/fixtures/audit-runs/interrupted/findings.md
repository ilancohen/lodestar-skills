# Audit findings — 2026-08-10

## category: imports — complete (1 findings)

### F0001
- category: imports
- subtype: cross-package-src
- package: api
- files:
  - packages/api/src/routes/users.ts:12
- evidence: |
    import { x } from '@repo/core/src/x';
- scope_unit: one-file
- requires_decision: false
- notes: |

## category: types
