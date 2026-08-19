# Pre-pass: `fallow`

[`fallow`](https://docs.fallow.tools) is a Rust-native codebase-intelligence
tool for TS/JS that builds a project-wide module graph in milliseconds. It is
**required** unless `## Audit Configuration` records `fallow: optional`. Several
detection categories have no viable alternative — `imports.unused-file`,
`imports.unused-dependency`, and `imports.unresolved-import` are fallow-only,
and the accuracy of several other categories degrades significantly without it.

When `fallow` is `optional` and the seed cannot run, skip this file's
commands, run grep-only detectors, and list the unchecked subtypes in
`INDEX.md` (`imports` #7–#9, `dry` A, `soc-yagni` A ranking).
`boundaries` B is grep-only and still runs.

---

## When to use this seed

Run the seed **once** at the start of Discover, after
package-set resolution and before iterating categories. Cache the JSON in memory; each category sub-doc consumes the
relevant slice.

Supported Fallow version and schema live in
`scripts/fallow-contract.json`. Resolve the binary, run the combined seed,
and validate the envelope **before** any findings are written. Do not use
`|| true` — exit 0/1 are success; exit 2 and contract failures stop the
audit when `fallow` is `required`. When `fallow` is `optional`, print the
remediation message, skip the seed, and continue Discover.

```bash
# Scripts live under the installed lodestar-audit skill. --out must be under <repo>.
# required: non-zero stops. optional: print, skip seed, continue.
node scripts/fallow-contract.mjs resolve-bin --root <repo>
node scripts/fallow-contract.mjs run \
  --root <repo> \
  --id combined \
  --out <repo>/.audit-fallow-seed.json
```

```powershell
node scripts/fallow-contract.mjs resolve-bin --root <repo>
if ($LASTEXITCODE -ne 0) {
  if ("<fallow>" -eq "optional") { Write-Host "skip seed; continue Discover"; return }
  throw "fallow contract failed"
}
node scripts/fallow-contract.mjs run --root <repo> --id combined --out <repo>/.audit-fallow-seed.json
if ($LASTEXITCODE -ne 0) {
  if ("<fallow>" -eq "optional") { Write-Host "skip seed; continue Discover"; return }
  throw "fallow contract failed"
}
```

On failure the script prints one remediation message with the installed
version, supported version, received schema/kind, and the install command
for this repo's package manager. When `fallow` is `required` (the default),
stop and report that message — do not create or change findings. When
`fallow` is `optional`, print the message, skip the seed, and continue
Discover with grep-only detectors. Two distinct failure modes:

- **Version below the floor** — message suggests upgrading:
  `pnpm add -D fallow@^3.15.0` (or the npm / yarn equivalent). If the
  manager cannot be detected, the message lists all three and you must
  ask which to use.
- **Version above the floor but a required field is missing** — the newer
  Fallow dropped a field the audit reads. Message says "changed fields the
  audit reads" and suggests pinning to the last known-good version
  (`fallow@~<last-good>`, typically the previous minor).

A schema higher than the baseline but with all required fields present is
automatically accepted. The first time this happens, the script records
the accepted version/schema pair in `.agents/lodestar/fallow-compat.json`
and prints a note to stderr. Commit that file so teammates and CI skip
re-verification.

`.audit-fallow-seed.json` is a temporary working file. Delete it after
Phase 1 completes; never commit it. (The audit skill is read-only outside
`<output-root>/` (default `docs/audit/`), but the seed is allowed in the repo root because it's
ephemeral and reproducible.)

---

## What the seed feeds where

| Fallow JSON field                                   | Consuming category | Subtype                   | Notes                                                                                                                                                                                  |
| --------------------------------------------------- | ------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check.boundary_violations[]`                       | `imports`          | `wrong-direction`         | Replaces `imports` #6 grep when `.fallowrc.json` is configured. Each entry already names `from_path`, `to_path`, `from_zone`, `to_zone`, `import_specifier`, `line`.                   |
| `check.circular_dependencies[]`                     | `imports`          | `circular-import`         | Replaces `imports` #3 detection. Graph-walked, exhaustive across re-export chains.                                                                                                     |
| `check.unused_files[]`                              | `imports`          | `unused-file`             | Fallow-only subtype — see `imports` #7.                                                                                                                                                |
| `check.unused_exports[]`                            | `imports`          | `over-broad-index`        | Replaces `imports` #5 per-symbol loop. Cross-reference with each row's `<pkg_root>/index.ts` to flag only the over-export subset.                                                      |
| `check.unused_dependencies[]`                       | `imports`          | `unused-dependency`       | Fallow-only subtype — see `imports` #8.                                                                                                                                                |
| `check.unresolved_imports[]`                        | `imports`          | `unresolved-import`       | Fallow-only subtype. Almost always a typo or missing dependency.                                                                                                                       |
| `dupes.clone_groups[]`                              | `dry`              | `exact-duplication`       | Primary detector for `dry.A`. Each `instances[]` item provides `file`, `start_line`, and `end_line`.                                                                                   |
| `dupes.clone_groups[]` (run with `--mode semantic`) | `dry`              | `structural-duplication`  | Seeds `dry.B`. Catches renamed-variable and renamed-literal clones the mild mode misses. Confirm with eyes-on-code before flagging — semantic mode has more false positives than mild. |
| `health.findings[]`                                 | `soc-yagni`        | `responsibility-overload` | Function-level complexity / size hits. Each entry has at least `path`. Limit the semantic file walk to those parent files.                                                             |
| `health.file_scores[]`                              | `soc-yagni`        | `responsibility-overload` | File-level ranking when findings are sparse. Sort by `total_cyclomatic` then `total_cognitive`; prefer rows with `crap_above_threshold > 0`.                                           |

Fields not listed above are not consumed. The harness does not act on
`unused-types`, `unused-enum-members`, or `unused-class-members` because
those overlap with TypeScript's own dead-code detection and are usually
better caught by `<typecheck>` or `<lint>`.

---

## Cross-tool deduplication

If both `pnpm check:deps` and fallow report the same import, prefer the
fallow finding (it carries `from_zone`/`to_zone` which makes the action-item
title cleaner). Dedupe by `(from_path, line, to_path)`.

Use `fallow dupes` for all duplication detection — do not run additional
clone detectors alongside it.

---

## Boundary configuration

For `check.boundary_violations` to fire, the repo must have a `.fallowrc.json`
whose zones match the `## Package Layout` table in `context.md`. The setup
skill writes this file (Step 7 of `lodestar-setup`) using the repo's
own package names as zone names — there is no canonical role mapping.
Setup also writes `ignorePatterns` from `### Excluded Paths`. Fallow's
schema excludes those files from analysis entirely, so `dupes` and
`health` honor the list without a second copy in `duplicates.ignore` /
`health.ignore`. Do not restate Fallow's built-in ignores (`**/dist/**`,
`**/*.d.ts`, `node_modules`). `extends` replaces array fields wholesale
— verify the merged config, not only the file setup wrote.

If `.fallowrc.json` is absent, fallow still produces useful output for
every other field above — `check.boundary_violations` is just empty. In that
case, `imports` #6 falls back to its grep heuristic.

To verify the boundary config matches what the audit expects, run:

```bash
node scripts/fallow-contract.mjs run --root <repo> --id list-boundaries --out <repo>/.audit-fallow-boundaries.json
```

The output should list one zone per **scannable** row in the Package
Layout table, with file counts > 0 for every zone the repo actually has. A zone reporting
zero files almost always means the path glob is wrong. Delete the temp
JSON after reading it.

`lodestar-setup` runs the same boundary check after writing
`.fallowrc.json`. It also runs `list-entry-points` and requires
`entry_point_count > 0`. Multi-app repos should pass `--minimum N` when
Step 1 recorded `N` entry surfaces; setup adds an `entry` array when
auto-discovery is not enough. Delete the temp JSON after reading it.

---

## What fallow can't help with

The audit seed intentionally uses Fallow's default syntactic analysis. Fallow
v3 also offers opt-in type-aware analysis, but it does not replace these
grep- and domain-judgment detectors:

- `types` (any, branded primitives, redeclared fields)
- `boundaries.A` (branded primitives missing)
- `boundaries.B` (misplaced business logic — path-pattern heuristic plus
  `context.md` responsibilities)
- `boundaries.C` (CQS violations)
- `boundaries.D` (Tell Don't Ask getter chains)
- `boundaries.E` (validation deeper than the boundary)
- `errors` (swallowed errors, expected failures not modeled as `Result`)
- `testability.A` and `.B` (module-level side effects, mutable state) —
  fallow does not analyze module-level execution
- `soc-yagni.B` (boolean flag params) — signature inspection, not graph
- `soc-yagni.C` (optional param with no caller)

For these, the existing grep + per-package LLM walk in each sub-doc
remains the only detector.

---

## Performance note

A single `fallow --format json --quiet` invocation typically takes seconds on
mid-sized monorepos (vs. repeated graph and clone-detector passes).
The seed pays for itself even when only one or two of the categories
above produce findings.
