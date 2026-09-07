# Fixture

## Package Layout

| Package | Path              | Alias      | Responsibility |
| ------- | ----------------- | ---------- | -------------- |
| core    | packages/core/src | @repo/core | TODO           |

## Resolved Decisions

Derived by `lodestar-setup`. Regenerated on every re-run — do not hand-edit.

| Key | Value | Notes |
| --- | --- | --- |
| `probe-plan` | `none` | |
| `active-detectors` | see list below | |
| `blind-spots` | see list below | |

### Active detectors

- `imports`: #1, #2, #3, #4, #5, #7, #8, #9
- `types`: #1, #2, #3, #4
- `boundaries`: A, C, D, E
- `errors`: A, B
- `testability`: A, B
- `soc-yagni`: A, B, C, D
- `dry`: A, B, C
- `ssot`: A, B, C
- `styling`: A, B, C, D

### Blind spots

- `imports` #6 (wrong-direction imports) — not applicable: single-package repo
- `boundaries` B (cross-package misplaced logic) — not applicable: single-package repo