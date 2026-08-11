# Category: `types`

Type hygiene — centralization, extension over redefinition, and `any`
elimination. **Low risk.** No logic changes, ever.

## What counts as a violation

1. **Misplaced type** — an `interface` or `type` defined in package `P` but
   imported from a different package. Should live in whichever package is
   nominated as the shared / types package in AGENTS.md `## Package
   Layout`. If no such package exists, this is a layout question — emit
   the finding anyway, mark `requires_decision: true`, and point the
   reader at `ep-review-architecture` in the notes.

2. **Redeclared fields** — type `B` repeats fields already on type `A`
   instead of extending it (`extends`, `Pick`, `Omit`, `Partial`, `Required`,
   `Extract`, `Exclude`, `ReturnType`, `Parameters`).

3. **Unguarded `any`** — `: any`, `as any`, `<any>` with no `eslint-disable`
   and no inline comment justifying it.

4. **Brand violation** — a domain identifier, monetary amount, or validated
   string typed as raw `string` / `number` (handled in `boundaries.md`,
   but mention here if you see it crossing a type boundary).

## Detection

All commands below use placeholders resolved from the `## Package Layout`
table in `AGENTS.md` (see SKILL.md Step 1.0). Substitute before running.

### Linter probe (best-effort, run once before greps)

Before running the greps below, check whether a linter with structured
JSON output is available — this avoids duplicating findings that the
linter already catches definitively.

```bash
# Detect which linter is configured (check devDependencies / config files)
# If ESLint: cache output for #1 and #3
<lint> --format json --max-warnings=999 2>/dev/null > /tmp/.audit-lint-types.json

# If Biome: use its JSON reporter instead
# biome check --reporter=json 2>/dev/null > /tmp/.audit-lint-types.json
```

Delete `/tmp/.audit-lint-types.json` at the end of Phase 1. This is a
read-only probe — do not install linter packages or modify config.

From the cached output, extract violations for:
- **#1** (`consistent-type-imports` / biome `useImportType`) → flag as misplaced-type
- **#3** (`no-explicit-any` / biome `noExplicitAny`) → flag as unguarded-any

If the linter probe produces no output (not configured, wrong rules, error),
fall through to the greps below silently.

```bash
# 1 — types used outside their defining package
#   For each `interface X` / `type X` declared inside <pkg_root>, grep
#   <all_pkg_roots> for `import { X } from '<pkg_alias>'`. A hit from a
#   path outside <pkg_root> is a candidate misplaced-type finding.
#   Skip the package(s) the user has explicitly nominated as the shared
#   types home — types living there are expected.
grep -rEn "^(export )?(interface|type) [A-Z]" <all_pkg_roots> --include="*.ts"

# 2 — types that redeclare base fields (heuristic — needs human review)
#   Look for interfaces with field overlap. Often surfaces during step 1.

# 3 — unguarded any (skip if linter probe already found these)
grep -rEn ": any\b|as any\b|<any>" <all_pkg_roots> \
  --include="*.ts" --include="*.tsx" \
  | grep -v "\.spec\.\|\.test\.\|eslint-disable"
```

To identify the "shared types home" for the purpose of #1: look at
the Responsibility column in AGENTS.md `## Package Layout`. Any row
whose responsibility mentions "shared types", "types", "domain types",
"DTOs", or similar qualifies. If multiple rows qualify or none do, mark
all #1 findings `requires_decision: true` and explain in `notes:`.

## Action-item granularity

- **One type per fix** for centralization (#1) and redeclaration (#2).
- **One file per fix** for `any` removal (#3), unless several `any`s in one
  file have the same root cause — then one item, multiple sites.

## Suggested fix shape

- #1 — move the type to the shared types package (per AGENTS.md), into
  whichever module is conventional there (e.g. `types/domain.ts` for
  entities, `types/api.ts` for HTTP shapes, `types/events.ts` for event
  payloads — whatever exists). Add to that package's `index.ts`. Update
  imports.
- #2 — replace with the appropriate utility (`extends`, `Pick`, `Omit`,
  `Partial`, `Required`, `Extract`, `Exclude`, `ReturnType`, `Parameters`, `&`).
  Delete the duplicated fields.
- #3 — replace with `unknown` + narrowing, or add
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a
  one-line comment explaining why.

Never widen a type to fix a compile error. If narrowing breaks something,
mark `requires_decision: true`.

## Scope rules (must appear verbatim in generated action items)

- No logic changes — type signatures and imports only.
- One type / one file per commit.
- Run `<typecheck>` after each file.

## Acceptance check

- `<typecheck>` passes.
- No `any` reintroduced; no eslint-disable without a comment.
- No new type duplicated across packages.
