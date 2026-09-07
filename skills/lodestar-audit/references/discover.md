# Discover

Load this file before running detectors. Keep the read-only rule from
`SKILL.md`.

Throughout this skill, `context.md` means `.agents/lodestar/context.md` in
the target repository — the file `lodestar-setup` writes. It is the only
source of package layout, dependency direction, commands, and conventions.
`AGENTS.md` is never read.

## Package set

Use `node scripts/audit-state.mjs validate-input --root <repo>`. It
returns `packages`, `direction` (acyclic chain order, empty when cyclic),
`directionGraph` (`chain`, `edges`, `cyclic`, `reachability`),
`conventions` (every key present; defaults filled when `## Conventions`
is missing or a row is missing), `linter` (`tool`, `probe`, or `null`
when the row is `n/a`), `scope` (`mode: all` when `mode` is
absent from `## Audit Configuration`; `changed-since` includes a resolved `baselineRef`),
`commands`,
`pkgManager`, `run`, `pkgManagerAmbiguous`, `pkgManagerLockfiles`,
`pkgManagerProvenance` (`lockfile` / `context.md` / `none`),
`allPkgRoots`, `aliasPrefix`, `excludedPaths`, `testGlobs`,
`scanExtensions` (file extensions to scan — from `scan-extensions` in
`## Audit Configuration`, or the TS/JS base list when absent),
`activeDetectors` (array of `{ category, subtypes }` for every category
that still runs, derived from Conventions and Package Layout),
`blindSpots` (string array ready to copy into INDEX.md Known blind spots),
and `probePlan` (the resolved linter probe command, or `"none"`).

Each `packages` row includes `scannable` (`yes` / `no`; default `yes`
when the column is absent), `language` (empty unless a `no (Python)`
note was written), `scannableCount`, and `entryPoints` (array; default
`["index.ts"]` when the column is absent). `allPkgRoots` and
`aliasPrefix` omit `scannable: no` rows. Iterate detectors only over
`scannable: yes` rows. Record `scannable: no` rows for `INDEX.md`
known-blind-spots (`<name>` — `<language>, not scanned`).
`validate-input` fails (exit 2) when a `scannable: yes` row contains
zero files matching `scanExtensions`. Category sub-docs that say to
iterate every Package Layout row mean every `scannable: yes` row.

Use `scanExtensions` for `source-scan` (`--include` comma list) and for
grep `--include` flags (repeat one `--include="*<ext>"` per extension,
stripping the leading dot). Built-in `source-scan` recipes intersect their
semantic extension list with that configured set and always keep
configured framework extras (`.vue`, `.svelte`, …) — they must not fall
back to a TS/JS-only replacement that drops them.
The hardcoded includes in category docs are examples — prefer
`scanExtensions` from `validate-input`.

`check-freshness` already ran in Preconditions. Do not re-run it here.
A resumed run inherits the `drift` key in `.checkpoint.json`.

`conventions` keys: `result-types`, `branded-types`, `barrel-exports`,
`design-tokens` (`yes` / `no`), and `coverage-floor` (positive integer or
`none`). Defaults: `yes`, `yes`, `no`, `yes`, `80`. Unknown table keys
are ignored. An unparseable known value fails `validate-input`.

Use `activeDetectors` from `validate-input` to decide which categories
and subtypes to run. A category absent from `activeDetectors` is gated
off — skip its detectors, checkpoint complete with count 0, and do not
re-evaluate the gate. A subtype absent from a category's list is gated
off — skip that detector only.

A category gated off is still checkpointed complete with count 0 so
resume logic is unaffected. Do not omit it from the scan loop's
checkpoint — skip its detectors, then checkpoint it complete.

Use `pkgManager` and `run` from `validate-input` for all install and
exec commands. Setup always resolves the package manager; if
`pkgManagerProvenance` is `none`, warn once that setup predates this
requirement and proceed with the lockfile-detected or context.md value.

Substitute placeholders literally before any detector command:

| Placeholder                       | Resolved to                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `<typecheck>`, `<lint>`, `<test>` | Commands from `context.md` (`n/a` → skip that probe)                                          |
| `<pkg_root>`                      | Current row `path`                                                                            |
| `<pkg_alias>`                     | Current row `alias`                                                                           |
| `<pkg_responsibility>`            | Current row `responsibility`                                                                  |
| `<all_pkg_roots>`                 | Space-separated paths                                                                         |
| `<alias_prefix>`                  | Longest common alias prefix                                                                   |
| `<pkg_manager>`, `<run>`          | `validate-input` `pkgManager` / `run` (recorded row wins)                                     |

Never run a command that still contains `<placeholder>` text. The
Responsibility column is advisory context for judgment detectors, not a
string to pattern-match.

Every detector runs repo-wide under every scope. Scope is applied when
findings are merged, never when files are selected.

## Fallow seed

Read `categories/fallow-seed.md` once. Run
`scripts/fallow-contract.mjs` to resolve the binary and validate every
envelope before writing findings. Cache JSON in memory or write
`.audit-fallow-seed.json` at the repo root and delete it at the end of
Phase 1.

If Fallow is missing, out of the supported range, or the envelope fails
the contract:

- `fallow: required` (default, including a missing `## Audit Configuration`
  section) — **stop** before writing findings.
- `fallow: optional` — continue with grep-only detectors. Do not write
  a seed file. Record for `INDEX.md` that these subtypes were **not
  checked at all**: `imports` #7–#9, `dry` A, `soc-yagni` A ranking.
  Put that list at the top of known-blind-spots, not buried. Still run
  every grep-only detector the category docs name (`boundaries` B is
  among them).

The seed never modifies source.

## Mechanical pass

Order: `imports`, `types`, `boundaries`, `errors`, `testability`,
`soc-yagni` (B, C, D), `dry` (A), `ssot` (A, B, C), `styling` (A–D,
UI-bearing packages only). Discover's scan order and Plan's output
order differ on purpose — do not "fix" them to match.

For each category:

1. Open the category sub-doc. Check `activeDetectors` from `validate-input`:
   if the category is absent, skip every detector, emit nothing,
   still checkpoint complete with count 0.
2. Run every Detection command whose subtype is present in that
   category's `subtypes` list from `activeDetectors`. Subtypes absent
   from the list are gated off — skip them. Do not re-evaluate gates.
   Prefer `node scripts/source-scan.mjs`
   recipes over POSIX `grep` pipelines. Iterate `<pkg_root>` per
   **scannable** package row with repeated `--root` flags (paths may
   contain spaces). Skip `scannable: no` rows — do not grep them.
3. Drop false positives in tests and excluded paths from
   `validate-input` (`excludedPaths`, `testGlobs`). Every
   `source-scan.mjs` invocation must pass `--exclude` / `--test-glob`
   from those lists (repeatable) and `--cwd <repo>` (the same root as
   `validate-input`). `--include-tests` still means ignore
   the test globs for that scan. For POSIX `grep` fallbacks, apply the
   same globs via `--exclude-dir` / `--exclude` or filter hits
   afterward. `*.d.ts` and `eslint-disable`-guarded `any` stay dropped.
4. Append finding objects. Do not write action-item files here.
5. Checkpoint:
   `node scripts/audit-state.mjs checkpoint --run-dir <output-root>/<RUN_ID> --category <name> --status complete --count N`
   A category whose gated subtypes were skipped still checkpoints here
   (count is findings actually emitted, which may be 0).

When resuming, skip categories that already have
`## category: <name> — complete` in `findings.md`.

## Optional mechanical fan-out

If a sub-agent tool exists and there are 4+ **scannable** packages, spawn one
sub-agent per scannable package (package row, categories, principle text,
exclusion list, the `conventions` object, and which categories /
subtypes this run must skip). Do not spawn for `scannable: no` rows. Sub-agents skip those detectors the same
way the inline loop does. Constraints: read-only, JSON findings only, no
`findings.md` writes, no nested spawns, no Fallow re-run. Inline loop
is canonical when fan-out is unavailable.

Merge with `merge-findings`. Append
`## skipped: <category> in <package> — sub-agent did not return` for
missing (package × category) results.

## Semantic pass

Detectors: `soc-yagni.A`, `dry.B`, `dry.C`. Work one scannable package at a time.

- `soc-yagni.A`: non-trivial source files (≥ 30 lines, not re-export,
  not type-only). If the file's responsibility needs "and", or sits
  outside the package Responsibility, write a finding.
- `dry.B`: group exported functions by name pattern; confirm in code.
- `dry.C`: exactly one advisory finding per run from recent git
  history. Orchestrator only; do not fan out.

Optional fan-out: one sub-agent per package for `soc-yagni.A` and
`dry.B` (same read-only / structured-return / no-nested-spawn rules).

After each package, record progress in `.checkpoint.json` (`status:
partial`, `package: <name>`). Only call `checkpoint` with a real
category name when that category is finished for every package.

## Finish Discover

Merge with `merge-findings`. When `scope.mode` is `changed-since`, pass
`--changed-files` from `changed-files --root <repo> --since
<baselineRef>`. Scope is not part of run state — checkpoints and resume
are unchanged; a run started under one scope can be resumed under
another.

Then validate:

```text
node scripts/audit-state.mjs validate-output --path <output-root>/<RUN_ID>/findings.md
```

Any unresolved placeholder is a bug. Fix the block in place.

Print finding counts by category. Ask whether to proceed to Plan.
