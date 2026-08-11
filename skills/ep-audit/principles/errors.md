# Category: `errors`

Error handling — eliminating swallowed errors and converting expected
failures to `Result` types. **High risk** — changes calling contracts.

## What counts as a violation

### A. Swallowed errors
A `catch` block that:
- Is empty.
- Only logs (`console.log`, `console.warn`) without taking action.
- Returns `undefined` / `null` implicitly without converting to a typed failure.

The grep below uses an `-A 4` window and `-B 3` follow-up grep; it
catches the obvious cases but produces false positives whenever a
`catch` block legitimately swallows a known-safe condition (e.g. a
shutdown hook). **Default `requires_decision: true` for every A finding.**

### B. Expected failure thrown
Code that `throw`s for an outcome the caller is expected to handle:
- `throw new Error('not found')` / `throw new NotFoundError()`
- `throw` inside a catch wrapping a network or DB call
- Functions whose callers always wrap in try/catch

These should return `Result<T, E>`.

## Detection

All commands below use placeholders resolved from the `## Package Layout`
table in `AGENTS.md` (see SKILL.md Step 1.0). Substitute before running.

### Linter probe (best-effort, run once before greps)

Before running the greps below, check whether a linter with structured
JSON output is available.

```bash
# If ESLint:
<lint> --format json --max-warnings=999 2>/dev/null > /tmp/.audit-lint-errors.json

# If Biome:
# biome check --reporter=json 2>/dev/null > /tmp/.audit-lint-errors.json
```

Delete `/tmp/.audit-lint-errors.json` at the end of Phase 1. Do not
install linter packages or modify config — read-only probe only.

From the cached output, extract violations for:
- **A** (`no-floating-promises` / biome `noFloatingPromises`) → flag as swallowed-async
- **B** (`no-throw-literal`, `prefer-promise-reject-errors` / biome equivalents) → flag as expected-failure-thrown

Linter-sourced B findings do not require `requires_decision: true` by
default (unlike grep-sourced ones). If the probe produces no output,
fall through to the greps below silently.

```bash
# A — empty / log-only catches (use if linter probe didn't cover this)
grep -rEn -A 4 "} catch" <all_pkg_roots> \
  --include="*.ts" --include="*.tsx" \
  | grep -B 3 "^\s*}|console\.(log|warn|error)\s*\("

# B — thrown errors that look expected (use if linter probe didn't cover this)
grep -rEn "throw new (Error|NotFound|Validation|Unauthorized)" \
  <all_pkg_roots> --include="*.ts"

# Cross-reference: do callers wrap this function in try/catch?
#   For each suspect function name, grep <all_pkg_roots> for
#   `try {\s*.*<fnName>(` patterns.
```

## Action-item granularity

- **A** — one catch block per item.
- **B** — one function per item. Bundle all callers into the same item —
  the fix must update every caller in the same commit.

## Suggested fix shape

- **A** — pick exactly one:
  1. Handle: take a real recovery action.
  2. Rethrow with context: `throw new AppError('message', { cause: e })`.
  3. Convert to a `Result` (use item B's recipe).
- **B** — define `Result<T, E>` once in the shared types package (per
  AGENTS.md `## Package Layout`) if not yet present:
  ```ts
  type Result<T, E = string> =
    | { ok: true; value: T }
    | { ok: false; error: E };
  ```
  Change the function's return type to
  `Promise<Result<T, 'not-found' | '…'>>`, replace `throw` with
  `return { ok: false, error: '…' }`, update every caller in the same
  commit, update tests that expected thrown errors.

## Scope rules (must appear verbatim in generated action items)

- Never convert a function without updating all callers in the same commit.
- Never mix A-style and B-style fixes in one commit.
- Mark `requires_decision: true` and stop if the function has **more than
  5 callers** — that's a larger migration that deserves its own plan.
- Reserve `throw` for programmer errors (assertion failures, impossible
  states). Don't convert those.

## Acceptance check

- `<typecheck>` passes.
- `<test>` passes, including updated tests for callers.
- No `catch` block left that swallows silently.
- No `throw` left for the converted failure mode.
