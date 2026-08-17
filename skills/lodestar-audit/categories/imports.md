# Category: `imports`

All detectors here are **mechanical** (fallow / grep). Most
action items are **low risk**.

Fallow is the required detector — it covers subtypes #3, #5, #6, #7,
#8, #9 directly. Subtypes #1 (`cross-package-src`) and #4 (`export *`
barrels) are always grep (they are not fallow concepts). When Fallow runs
but `.fallowrc.json` is absent, `check.boundary_violations` is empty and
subtype #6 uses the grep heuristic below.

## What counts as a violation

1. **Cross-package internal imports** — an import that crosses a package
   boundary and contains `/src/` in the path.
   Bad: `import { X } from '<pkg_alias>/src/user/user.service'`
   Good: `import { X } from '<pkg_alias>'`

2. **Missing re-export** — an external consumer needs something that isn't
   exported from the source package's `index.ts`.

3. **Circular import** — `A` imports `B` and `B` imports `A`. The lower-
   level package (per the dependency direction in `context.md`) should not
   import from the higher-level one.

4. **`export *` barrel** — `index.ts` re-exports everything from a sub-module
   without naming what's exported.

5. **Over-broad API surface** — an `index.ts` export that has no external
   consumer (used only inside the package, or not used at all).

6. **Wrong-direction dependency** — an import that violates the dependency
   direction declared in `context.md` (e.g. with direction
   `web → server → core → shared`, `core` may not import from `server`,
   and `shared` may not import from anywhere). Includes both intra-monorepo
   alias imports and relative imports crossing package boundaries.

7. **Unused file** — a source file that no entry point reaches transitively.
   Detected only when the fallow seed runs (`check.unused_files[]`).
   Risk: low; deletion is usually safe but verify with
   `fallow dead-code --trace-file`
   before removing.

8. **Unused dependency** — a package listed in `package.json` `dependencies`
   that nothing in the source tree imports and no script invokes. Detected
   only when the fallow seed runs (`check.unused_dependencies[]`).
   Risk: low.

9. **Unresolved import** — an import specifier fallow can't resolve to a
   file or a listed dependency. Detected only when the fallow seed runs
   (`check.unresolved_imports[]`). Almost always a typo or a missing
   entry in `package.json` — usually a bug.

## Detection

All commands below use placeholders resolved per row of the `## Package
Layout` table in `context.md` (see references/discover.md). Substitute the
real path globs and import aliases before running.

### Preferred: fallow seed

If `.audit-fallow-seed.json` exists from Discover, parse it once and
emit findings from these slices (no shell grep needed):

| JSON field                                                                | Subtype                                                                |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `check.boundary_violations[]`                                             | #6 `wrong-direction` (only when `.fallowrc.json` was written by setup) |
| `check.circular_dependencies[]`                                           | #3 `circular-import`                                                   |
| `check.unused_exports[]` (cross-referenced against `<pkg_root>/index.ts`) | #5 `over-broad-index`                                                  |
| `check.unused_files[]`                                                    | #7 `unused-file`                                                       |
| `check.unused_dependencies[]`                                             | #8 `unused-dependency`                                                 |
| `check.unresolved_imports[]`                                              | #9 `unresolved-import`                                                 |

Subtype #1 (`cross-package-src`) is not a fallow concept — it's a coding-
style rule. Always run the grep below for it. Subtype #4 (`export *`
barrels) is also grep-only.

For #5, only flag exports that originate from `<pkg_root>/index.ts`. Other
unused exports inside a package are valid internal symbols that aren't
re-exported; they're outside this category's scope.

### Fallback: greps

```bash
# 1 — cross-package /src/ imports (always scan — not a fallow concept)
node scripts/source-scan.mjs --recipe cross-package-src --alias-prefix '<alias_prefix>' --root <pkg_root>
# Repeat --root for each package path. Do not split paths on spaces.
#   <alias_prefix> = the common prefix of every alias (e.g. '@repo/').

# 4 — barrel re-exports (always scan — not a fallow concept)
node scripts/source-scan.mjs --recipe barrel-reexport --root <pkg_root>

# 5 — exports with no external consumer (per package P) — grep fallback
#   List symbols in <pkg_root>/index.ts; grep every other root for each symbol.
#   Symbols with zero hits outside P are over-exports.

# 6 — direction grep fallback when neither fallow nor check:deps is available
#   Parse the dependency direction from context.md (e.g. web → server → core → shared).
#   For each package P in the chain, the allowed import sources are P itself
#   and every package to its right. For each `from '<alias>'` import in P,
#   check that <alias> resolves to an allowed package. Anything else is a
#   direction violation.
#
#   Concretely: iterate <packages>; for each P, build `<forbidden_aliases>`
#   as the aliases of all packages to its left in the chain (i.e. higher
#   layers). Then for each forbidden alias A:
#
#     grep -rn "from '<A>'" <pkg_root_of_P> --include="*.ts" --include="*.tsx"
#
#   Each hit is a wrong-direction import.
```

### Cross-tool deduplication

If both `pnpm check:deps` and the fallow seed report the same
`(file:line, target)` triple, keep the fallow finding and drop the
dep-cruiser one — fallow's `from_zone`/`to_zone` data makes the
generated action-item title cleaner.

## Action-item granularity

- **One file per fix** for cross-package paths (#1), barrel replacements (#4),
  direction fixes (#6, when isolated to one importer), and unresolved
  imports (#9).
- **One package per fix** for index.ts tightening (#5).
- **One cycle per fix** for circular imports (#3) — note both ends.
- **One package per fix** for direction violations (#6) when the same
  importer has many lines pointing the wrong way.
- **One file per fix** for unused-file deletions (#7). When several
  unused files form a tightly-coupled subgraph (e.g. an entire abandoned
  feature folder), bundle them into one item with all paths listed in
  `files:` and mark `requires_decision: true` — the user may want to keep
  the folder around for reference.
- **One dependency per fix** for unused dependencies (#8). Move dependency
  removals into a single `package.json` commit per item.

## Suggested fix shape

- #1 — rewrite the import to the package root.
- #2 — add the symbol to `index.ts` of the source package; do not change the
  implementation.
- #3 — invert the dependency, or extract the shared piece to the package
  nominated for shared code (see `context.md` `## Package Layout`). This may
  require a logic decision — flag `requires_decision: true`.
- #4 — replace `export * from './x'` with explicit named re-exports.
- #5 — remove the export from `index.ts`. If the symbol is used in tests
  outside the package, the test belongs in the same package.
- #6 — move the imported symbol to a package allowed by the direction
  (usually the shared/types package), or invert the dependency so the
  importer becomes the imported. Often `requires_decision: true`.
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
- #9 — fix the import: correct the typo, install the missing dependency,
  or add the missing alias to `tsconfig.json` `paths`. Never silence #9
  by adding a wildcard — fix the underlying cause.

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
