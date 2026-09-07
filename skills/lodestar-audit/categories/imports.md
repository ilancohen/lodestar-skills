# Category: `imports`

All detectors here are **mechanical** (fallow / grep). Most action items
are **low risk**. Subtypes #1 (`cross-package-src`) and #4 (`export *`
barrels) are grep-only; #6 falls back to the grep below when
`.fallowrc.json` is absent.

## What counts as a violation

1. **Cross-package internal / deep-path imports** — an import that
   crosses a package boundary into a path that is **not** a declared
   entry of the importee. Scan every `from '<pkg_alias>'` / `from
'<pkg_alias>/…'` specifier, not only `/src/`.
   Bad: `from '<pkg_alias>/src/user/user.service'` or
   `from '<pkg_alias>/internal'` when entries are `index.ts`.
   Good: `from '<pkg_alias>'`, or `from '<pkg_alias>/server'` when
   `server` (or `./server`) is a declared entry.
   A multi-entry `exports` map is a deliberate API surface, not a
   violation. Drop a hit when `isDeclaredEntryImport(specifier, alias,
entryPoints)` is true (`audit-state.mjs`): canonicalize by stripping
   `./`, and treat empty / `.` / `index.ts` as the default entry.

2. **Missing re-export** — an external consumer needs something that isn't
   exported from the source package's `index.ts`.

3. **Circular import** — `A` imports `B` and `B` imports `A`. Documented
   cycle edges in `context.md` surface here, not as wrong-direction (#6).

4. **`export *` barrel** — `index.ts` re-exports everything from a sub-module
   without naming what's exported.
   **Gate:** skip this subtype when `conventions["barrel-exports"]` is `yes`
   (barrels are allowed). Emit nothing. Record `imports` #4 as a
   deliberate skip in `INDEX.md`'s known-blind-spots list — do not stay
   silent. #2 (missing re-export) and #5 (over-broad surface) stay on.

5. **Over-broad API surface** — an `index.ts` export that has no external
   consumer (used only inside the package, or not used at all).

6. **Wrong-direction dependency** — an import that opposes a documented edge
   or documented path in `context.md` (e.g. with observed chain
   `web → server → core → shared`, `server` importing `web` opposes the
   documented `web → server` path). Includes intra-monorepo alias imports and
   relative imports crossing package boundaries. Edges of a documented cycle
   are documented in both directions, so they are **not** #6 findings — they
   surface under #3 `circular-import` instead. New downward imports consistent
   with the documented graph are not violations until `context.md` is updated.
   **Gate:** skip this subtype in a single-package repo (one scannable
   row, empty graph). Emit nothing. Record `imports` #6 as not
   applicable in `INDEX.md`'s known-blind-spots — do not stay silent.
   Other `imports` subtypes stay on. Checkpoint `imports` with the
   real count.

7. **Unused file** — a source file that no entry point reaches transitively
   (`check.unused_files[]`). Risk: low.

8. **Unused dependency** — a package in `dependencies` that nothing imports
   and no script invokes (`check.unused_dependencies[]`). Risk: low.

9. **Unresolved import** — a specifier fallow can't resolve to a file or
   listed dependency (`check.unresolved_imports[]`). Almost always a typo
   or missing `package.json` entry.

## Detection

All commands below use placeholders resolved per row of the `## Package
Layout` table in `context.md`. Substitute the
real path globs and import aliases before running.

### Preferred: fallow seed

Parse `.audit-fallow-seed.json` (from Discover) for these slices:

| JSON field                                                                | Subtype                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `check.boundary_violations[]`                                             | #6 `wrong-direction` (only when `.fallowrc.json` was written by setup) |
| `check.circular_dependencies[]`                                           | #3 `circular-import`                                                   |
| `check.unused_exports[]` (cross-referenced against `<pkg_root>/index.ts`) | #5 `over-broad-index`                                                  |
| `check.unused_files[]`                                                    | #7 `unused-file`                                                       |
| `check.unused_dependencies[]`                                             | #8 `unused-dependency`                                                 |
| `check.unresolved_imports[]`                                              | #9 `unresolved-import`                                                 |

For #5: flag only exports from `<pkg_root>/index.ts` — internal unexported
symbols are out of scope.

### Fallback: greps

```bash
# 1 — undeclared deep / /src/ imports (always scan — not a fallow concept)
#   Fast path for /src/:
node scripts/source-scan.mjs --recipe cross-package-src --alias-prefix '<alias_prefix>' --root <pkg_root>
# Repeat --root for each package path. Do not split paths on spaces.
#   <alias_prefix> = the common prefix of every alias (e.g. '@repo/').
#
#   Full path: grep each scannable root for `from '<T.alias>'` and
#   `from '<T.alias>/`; apply isDeclaredEntryImport filter (see #1 prose).

# 4 — barrel re-exports (always scan — not a fallow concept)
# Skip this grep when conventions["barrel-exports"] is yes.
node scripts/source-scan.mjs --recipe barrel-reexport --root <pkg_root>

# 5 — exports with no external consumer (per package P) — grep fallback
#   List symbols in <pkg_root>/index.ts; grep every other root for each symbol.
#   Symbols with zero hits outside P are over-exports.

# 6 — direction grep fallback when neither fallow nor check:deps is available
#   Skip when one scannable row and empty graph; other imports subtypes stay on.
#   Run `node scripts/audit-state.mjs validate-input --root <repo>`, read
#   `directionGraph.reachability`, and apply the wrong-direction rule from
#   #6 prose above to each `from '<alias>'` import in each package P.
```

### Cross-tool deduplication

When `pnpm check:deps` and the fallow seed both report the same `(file:line, target)` triple, keep the fallow finding — its `from_zone`/`to_zone` data makes action-item titles cleaner.

## Action-item granularity

- **One file per fix** for cross-package paths (#1), barrel replacements (#4),
  and unresolved imports (#9). For direction fixes (#6): one file when isolated
  to one importer; one package when the same importer has many violations.
- **One package per fix** for index.ts tightening (#5).
- **One cycle per fix** for circular imports (#3) — note both ends.
- **One file per fix** for unused-file deletions (#7). Bundle tightly-coupled
  unused subgraphs into one item (`files:`, `requires_decision: true`).
- **One dependency per fix** for unused dependencies (#8).

## Suggested fix shape

- #1 — rewrite the import to a declared entry, or add the subpath to
  `exports` if it is an intentional API surface.
- #2 — add the symbol to `index.ts` of the source package.
- #3, #6 — invert the dependency or extract to the shared package
  (nominated in `context.md`). Often `requires_decision: true`.
- #4 — replace `export * from './x'` with explicit named re-exports.
- #5 — remove the export from `index.ts` (if only consumed by tests
  outside the package, move the test into the same package).
- #7 — delete the file. Before deleting, run
  `node scripts/fallow-contract.mjs run --root <repo> --id dead-code-trace-file --file <path>`
  (stdout is the validated `kind: "trace"` envelope) to confirm fallow
  sees no inbound edges (sometimes dynamic imports, framework conventions,
  or build-only scripts reach the file in ways the static graph misses —
  if a plugin or convention is responsible, configure it in
  `.fallowrc.json` rather than deleting).
- #8 — remove the entry from `package.json` `dependencies` /
  `devDependencies`. Before removing, run
  `node scripts/fallow-contract.mjs run --root <repo> --id dead-code-trace-dependency --dependency <package>`
  (stdout is the validated envelope) to confirm.
  If the dependency is used only by a script in `package.json` or a CI
  config, it's a fallow false positive — leave it.
- #9 — fix the specifier: correct the typo, install the missing dep,
  or add the alias to `tsconfig.json` `paths`. Never use a wildcard.

## Scope rules (must appear verbatim in generated action items)

- No implementation changes beyond the import or re-export line.
- No moving files unless the fix is "extract to the shared package" (#3, #6).
- If fixing requires touching > 3 files, mark `requires_decision: true` and
  stop short of suggesting the change.
- For #7 / #8: never delete without first running the matching `fallow trace`
  command and confirming the verdict matches the action item.

## Acceptance check

- `<typecheck>` passes.
- `pnpm check:deps` passes (if configured).
- `node scripts/fallow-contract.mjs run --root <repo> --id combined` reports
  no occurrence of the named
  finding for this action item.
- No other diff than the lines named in the action item.
