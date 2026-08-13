# Discover

Load this file before running detectors. Keep the read-only rule from
`SKILL.md`.

## Package set

Use `node scripts/audit-state.mjs validate-input --root <repo>`. It
returns `packages`, `direction`, `commands`, `pkgManager`, `run`,
`allPkgRoots`, and `aliasPrefix`.

Substitute placeholders literally before any detector command:

| Placeholder | Resolved to |
|---|---|
| `<typecheck>`, `<lint>`, `<test>` | Commands from AGENTS.md |
| `<pkg_root>` | Current row `path` |
| `<pkg_alias>` | Current row `alias` |
| `<pkg_responsibility>` | Current row `responsibility` |
| `<all_pkg_roots>` | Space-separated paths |
| `<alias_prefix>` | Longest common alias prefix |
| `<pkg_manager>`, `<run>` | From lockfiles |

Never run a command that still contains `<placeholder>` text. The
Responsibility column is advisory context for judgment detectors, not a
string to pattern-match.

## Fallow seed

Read `principles/fallow-seed.md` once. Fallow is required. Cache JSON in
memory or write `.audit-fallow-seed.json` at the repo root and delete it
at the end of Phase 1. If Fallow is missing or the envelope is invalid,
**stop** before writing findings.

The seed never modifies source.

## Mechanical pass

Order: `imports`, `types`, `boundaries`, `errors`, `testability`,
`soc-yagni` (B, C, D), `dry` (A), `ssot` (A, B, C), `styling` (A–D,
UI-bearing packages only).

For each category:

1. Open the category sub-doc.
2. Run every Detection command. Iterate `<pkg_root>` per package row.
3. Drop false positives in tests (`*.spec.ts`, `*.test.ts`) unless the
   sub-doc says otherwise, generated code, `*.d.ts`, and
   `eslint-disable`-guarded `any`.
4. Append finding objects. Do not write action-item files here.
5. Checkpoint:
   `node scripts/audit-state.mjs checkpoint --run-dir docs/audit/<RUN_ID> --category <name> --status complete --count N`

When resuming, skip categories that already have
`## category: <name> — complete` in `findings.md`.

## Optional mechanical fan-out

If a sub-agent tool exists and there are 4+ packages, spawn one
sub-agent per package. Each prompt must include the package row,
categories, substituted principle text, and the exclusion list.
Sub-agents are read-only, return JSON findings, and must not write
`findings.md` or re-run Fallow.

After they return, merge with
`node scripts/audit-state.mjs merge-findings --in a.json --in b.json --out docs/audit/<RUN_ID>/findings.md --run-id <RUN_ID>`.
That command reassigns `F0001…` in category then file order. For every
(package × category) with no result, append
`## skipped: <category> in <package> — sub-agent did not return`.

## Semantic pass

Detectors: `soc-yagni.A`, `dry.B`, `dry.C`. Work one package at a time.

- `soc-yagni.A`: non-trivial source files (≥ 30 lines, not re-export,
  not type-only). If the file's responsibility needs "and", or sits
  outside the package Responsibility, write a finding.
- `dry.B`: group exported functions by name pattern; confirm in code.
- `dry.C`: exactly one advisory finding per run from recent git
  history. Orchestrator only; do not fan out.

Optional fan-out: one sub-agent per package for `soc-yagni.A` and
`dry.B`. Same read-only rules.

After each package, record progress in `.checkpoint.json` (`status:
partial`, `package: <name>`). Only call `checkpoint` with a real
category name when that category is finished for every package.

## Finish Discover

Validate:

```text
node scripts/audit-state.mjs validate-output --path docs/audit/<RUN_ID>/findings.md
```

Any unresolved placeholder is a bug. Fix the block in place.

Print finding counts by category. Ask whether to proceed to Plan.
