# Category: `testability`

Makes code unit-testable without changing observable behaviour. **High risk** —
touches constructor signatures and module structure.

This audit is structure-agnostic. The detectors below run across every
package in AGENTS.md `## Package Layout`. The previous role-aware
"concrete infra imports inside core/shared only" rule has been retired —
without a fixed role mapping, the audit can't tell which package is
"core" or "shared". A general "concrete-implementation-coupling" detector
that runs across all packages is provided in `soc-yagni` (single-call-
site exports and large constructor surfaces); it catches the same class
of problem from a different angle.

## What counts as a violation

### A. Module-level side effects
A function call, event listener registration, DB connection, or subscription
at module scope (not inside a function/class body). Triggers on `import`,
making tests order-dependent and slow.

The grep below matches any line at column 0 whose first identifier
character is followed by a `(`. Decorators, IIFEs, top-level type guards
that happen to look like calls, and assignment-of-function-result
patterns all hit. **Default `requires_decision: true` for every A
finding sourced from the grep fallback.** Hits in files whose AGENTS.md
Responsibility names infra / boot / wiring should be flagged
`requires_decision: true` regardless of detector — those side effects
may be intentional composition-root calls.

### B. Mutable module-level state
`let` (or `var`) at module scope outside test files. Creates implicit
global state that pollutes tests.

## Detection

All commands below use placeholders resolved from the `## Package Layout`
table in `AGENTS.md` (see SKILL.md Step 1.0). Substitute before running.

```bash
# A — calls at module scope (heuristic; review required)
grep -rEn "^[a-zA-Z_].*\(" <all_pkg_roots> --include="*.ts" \
  | grep -v "^[^:]*:[[:space:]]*(export|const|let|var|function|class|interface|type|import|//)"

# Event listeners and connection openers at module scope.
#   A composition-root file that opens a connection at module scope is
#   sometimes legitimate. Use the Responsibility column from AGENTS.md
#   `## Package Layout` to judge: a package whose responsibility names
#   "DB", "queue", "infra", "adapters", or similar may legitimately do
#   this — emit those findings with requires_decision: true rather than
#   dropping them silently.
grep -rEn "^.*(addEventListener|\.on\(|subscribe\(|connect\(|createPool|createClient)" \
  <all_pkg_roots> --include="*.ts"

# B — module-level mutable bindings
grep -rEn "^(let|var) " <all_pkg_roots> --include="*.ts" \
  | grep -v "\.spec\.\|\.test\."
```

## Action-item granularity

- **A** — one file per item.
- **B** — one variable per item.

## Suggested fix shape

- **A** —
  1. Wrap the side effect in an `init()` function or a class constructor.
  2. Call it explicitly from the composition root (whichever package's
     responsibility is "compose / wire / boot", per AGENTS.md).
  3. Confirm the file can be imported in a test without triggering the
     side effect.

- **B** — classify and move:
  - Cache / singleton → into a class, inject it, or proper singleton pattern.
  - Counter / accumulator → into a class or closure.
  - Feature flag / config → injected at startup, not mutated at runtime.

## Scope rules (must appear verbatim in generated action items)

- Behaviour must be preserved. Refactor only.
- One file / variable per commit.
- Run `<test>` (full suite) after each commit — race conditions and test
  pollution often surface here.
- Mark `requires_decision: true` and stop if:
  - The file is in a package whose AGENTS.md responsibility describes
    infrastructure bootstrapping (e.g. "opens DB connection", "registers
    queue subscribers") — the side effect may be intentional.
  - A module-level variable is written from multiple unrelated call sites.
  - Removing the binding requires changing more than 4 files.

## Acceptance check

- `<typecheck>` passes.
- `<test>` full suite passes.
- The file can be imported in a test without triggering side effects (A).
- No `let`/`var` at module scope (B).
