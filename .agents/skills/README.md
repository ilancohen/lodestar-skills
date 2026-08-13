# Engineering Principles

Single source of truth for engineering standards in this repo. Any agent
completing a task should check this before submitting work.

---

## Principles

### Separation of Concerns (SoC)
Each module has one reason to change. If you can't describe its responsibility
in one sentence without "and", split it. Business logic lives in dedicated
domain modules, isolated from I/O and framework wiring.

### DRY
Extract on the second occurrence, not before. Shared logic goes in the
package nominated for shared / domain code in AGENTS.md (`## Package
Layout`). If a change touches 6+ unrelated files, find the missing
abstraction first.

### Single Source of Truth (SSOT)
Every fact has exactly one home: constants, types, configuration values,
schemas, domain rules, and tool versions are defined once and referenced
elsewhere. Two copies of the same value will drift — when one moves, the
other lags behind silently. If you find yourself updating "the same thing"
in two places, the second place is the bug.

DRY is about behaviour (no duplicated logic); SSOT is about state and
definitions (no duplicated facts). They overlap — a copied constant is
both — but the failure mode of an SSOT violation is *drift*, while the
failure mode of a DRY violation is *churn*.

### YAGNI
Implement only what the current task requires. Every abstraction needs two
concrete callers to justify existence; wait for three before generalizing.
Don't add parameters, options, or generics that no current code uses.

### CQS (Command Query Separation)
Functions either return meaningful data (query) or cause side effects (command),
never both. A function that returns a value AND writes to the DB, emits an event,
or mutates state is a violation.

### Tell Don't Ask
Push behavior toward the data. A getter chain (`a.getB().getC().doThing()`)
is a signal that the behavior belongs on `B` or `C`, not on the caller.
Expose methods that do things; don't expose state for callers to make
decisions on.

### Parse Don't Validate
Validate and brand at the boundary (route handler, CLI arg, env var). Once
inside the domain, parameters are already typed correctly — no re-validation
deeper in.

### Rule of Three
One use case: implement concretely. Two: wait. Three: now you know the real
shape; abstract.

### Prefer Proven Libraries (Avoid NIH)
When a well-maintained library already solves a problem reliably, use it.
Custom re-implementations of solved problems (date handling, validation,
cryptography, HTTP, parsing) accumulate bugs that the library has already
fixed. Roll your own only when a library has an unacceptable tradeoff —
unsuitable license, prohibitive bundle cost, deep API mismatch — not merely
because you *could* write it.

### Ubiquitous Language
One term, one concept — everywhere. The same idea must use the same name in
code, comments, logs, API contracts, tests, and conversation. Two names for
the same concept force readers to mentally map between them; one name
covering two concepts forces readers to guess from context. Pick the domain's
own vocabulary and enforce it uniformly. If a rename is needed, rename it
everywhere at once.

### Styling
CSS lives in stylesheets, not inline. Use external CSS files, CSS Modules,
or design-system primitives — never `style={{...}}` props — so classes,
custom properties, and tokens can be reused. Colours, spacings, fonts,
radii, and z-indexes are defined once (a CSS variable or a token export)
and referenced by name; the same literal must not appear in two places.
Reach for inline styles only when the value is genuinely dynamic per
render (a computed pixel offset bound to runtime state), and even then
only the dynamic property is inline — every static property stays in a
class.

DRY and SSOT apply to styles exactly as they do to code: duplicated class
bodies are churn; duplicated literals are drift. One canonical home per
design token, imported everywhere it's used.

---

## TypeScript Rules

- **Centralize types.** Domain types used across packages live in the
  package nominated for shared types in `AGENTS.md` (`## Package Layout`).
  Never redefine a type in a consuming package; import it.
- **Extend and compose.** Specializations use `extends`. Derived types use
  `Pick`, `Omit`, `Partial`, `Required`, `Extract`, `Exclude`, `ReturnType`,
  `Parameters`. Reach for these before writing a new type from scratch.
- **Branded primitives.** Domain identifiers, monetary amounts, and validated
  strings use branded types (`UserId`, `Money`, `Slug`), not raw `string` or
  `number`. Define brands in the shared types package.
- **No `any`.** Use `unknown` and narrow it. Exceptions require an inline
  comment explaining why.

---

## Module API Surface

Each package exposes its public API through a curated `index.ts`. Export only
what external consumers need. Internal helpers stay unexported. If a test
needs an internal, the test belongs in the same package.

---

## Testability

- Inject dependencies; don't import them directly.
- Domain code depends on interfaces, not concrete infrastructure
  implementations.
- No side effects at module load time. Nothing happens when a file is imported.
- No mutable `let` at module scope.
- **Coverage floor:** 80% for domain and shared packages. Route- or
  component-level integration tests required for any package exposing an
  HTTP API or UI surface.

---

## Error Handling

- No empty or log-only `catch` blocks. Handle, rethrow, or convert.
- Expected failures (`not-found`, network error, validation) return
  `Result<T, E>` or a discriminated union — not thrown errors.
- Reserve thrown errors for unrecoverable programmer errors.

---

## Anti-Pattern Reference

| Pattern | Principle violated |
|---|---|
| `import { X } from '<alias>/src/...'` (cross-package internal path) | API surface |
| `export * from './everything'` barrel | API surface |
| Export in `index.ts` with no external consumer | API surface |
| Business logic in a route handler or UI component | SoC |
| Network / DOM / framework calls inside a package nominated as domain-only | SoC |
| A class with two unrelated responsibilities | SoC |
| Function returns data AND causes a side effect | CQS |
| `a.getB().getC().doThing()` getter chain | Tell Don't Ask |
| `if (user.getRole() === 'admin')` in a caller | Tell Don't Ask |
| Re-validating already-typed inputs inside the domain | Parse Don't Validate |
| Optional param with no current caller | YAGNI |
| Abstraction with only one call site | YAGNI |
| `process(x, true, false, true)` boolean flag params | SoC / API surface |
| Wide diff (6+ unrelated files) for one logical change | DRY |
| Same constant / config value declared in two packages | SSOT |
| Magic literal repeated where a named export would do | SSOT |
| Schema definition copied between producer and consumer | SSOT |
| Duplicated type in a second package | DRY / SSOT / Types |
| New interface that redeclares fields from an existing type | Type extension |
| `userId: string` for a domain identifier | Primitive obsession |
| `any` without a documented justification | TypeScript |
| Concrete infrastructure import inside a domain module | Testability / SoC |
| `new ConcreteService()` inside a service | Testability / DI |
| Side effect at module load time | Testability |
| Mutable `let` at module scope | Testability / implicit state |
| Empty or log-only `catch` block | Error handling |
| `throw new Error('not found')` for expected failure | Error handling |
| Import that violates the dependency direction in AGENTS.md | Boundaries |
| Custom re-implementation of a solved problem with a healthy library available | Proven Libraries (NIH) |
| Same concept named differently across modules, layers, or docs | Ubiquitous Language |
| One name used for two distinct concepts in the codebase | Ubiquitous Language |
| `style={{ color: '#333' }}` inline style for static properties | Styling |
| Same colour / spacing / radius literal hard-coded in two files | Styling / SSOT |
| Duplicated CSS class body (same rule set under two selectors) | Styling / DRY |
| Magic colour or magic spacing in JSX instead of a token | Styling / SSOT |

---

## Pre-Commit Checklist

Before marking any task complete:

- [ ] Each modified file has a single, nameable responsibility
- [ ] No function both returns data and causes a side effect
- [ ] No getter chains — behavior pushed toward the data
- [ ] No logic duplicated from elsewhere in the codebase
- [ ] No constant, schema, or config value redeclared — one canonical home, imported elsewhere
- [ ] No abstraction, parameter, or option added without a current caller
- [ ] New cross-package types live in the shared types package
- [ ] Existing types extended/composed rather than redefined
- [ ] New domain identifiers use branded types
- [ ] All cross-package imports go through `index.ts`
- [ ] Nothing exported from `index.ts` that no consumer needs
- [ ] No import crosses the dependency direction declared in AGENTS.md
- [ ] Domain modules depend on interfaces, not concrete infrastructure
- [ ] No side effects at module load time
- [ ] No new mutable module-level state introduced
- [ ] All `catch` blocks handle, rethrow, or convert — nothing swallowed
- [ ] Expected failure paths return `Result<T, E>`, not thrown errors
- [ ] No custom implementation where a well-maintained library already solves the problem
- [ ] Every concept uses exactly one name, consistently, across all files touched
- [ ] No inline `style={{...}}` for static properties — class / CSS Module / token instead
- [ ] No colour, spacing, font, radius, or z-index literal duplicated — one canonical token, referenced
- [ ] Tests written alongside the code
- [ ] `pnpm check-types` passes with no new errors
- [ ] `pnpm lint` passes

---

## When Uncertain

- Scope ambiguous → implement the minimum that satisfies the stated requirement.
- Refactor needed → do it in a separate commit first, then the feature.
- Principle conflicts with a constraint → surface the tradeoff in a comment with
  a ticket reference; don't silently compromise.
- Existing file already violates these rules → don't make it worse; flag it
  next time the audit skill is run; don't fix it unless that's the task.
- Architecture itself feels wrong → run `lodestar-architecture` for a
  structured second opinion. That skill is advisory only and never modifies
  source.

---

## Package Dependency Direction

```
shared/: types ← (nothing)
         config ← (nothing)
         dataset ← (nothing)
         data ← dataset
         dataset-db ← dataset

pipeline/ libs ← shared/ only
pipeline/pipeline-runtime ← shared/ + pipeline/ (shared composition wiring)
pipeline/orchestrator, pipeline/api ← shared/ + pipeline/ + pipeline-runtime (composition roots)
pipeline/admin-app ← shared/ + pipeline/pipeline-wire (HTTP client)

viz/ libs ← shared/ only
viz/web-app ← shared/ + viz/ (HTTP client)
```

See the `## Package Layout` table in `AGENTS.md` for the path → import
alias → responsibility mapping the audit skill uses.

---

## Skills Index

| Skill | File | When to use |
|---|---|---|
| Setup | `.agents/skills/lodestar-setup/SKILL.md` | Re-scaffold or refresh this config |
| Audit | `.agents/skills/lodestar-audit/SKILL.md` | Scan the codebase and emit action-item files into `docs/audit/<run-id>/` |
| Review architecture | `.agents/skills/lodestar-architecture/SKILL.md` | Advisory layout review; can propose an alternative architecture on request |

The audit skill is **discovery only** — it produces one self-contained
markdown file per violation. Each file is designed to be handed
independently to a human or LLM as a fix task.

The lodestar-architecture skill is **advisory only** — it never modifies
source and never writes audit-style action items. It produces a single
report comparing the documented layout to recognised architectural
patterns and, on request, a candidate alternative layout to discuss with
the team.
