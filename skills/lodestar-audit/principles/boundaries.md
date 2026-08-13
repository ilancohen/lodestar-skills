# Category: `boundaries`

Architectural seams: branded primitives, parse-don't-validate, misplaced
business logic, CQS, and Tell Don't Ask. **Medium to high risk** — most
fixes change contracts.

This audit is structure-agnostic. The detectors below run across every
package in AGENTS.md `## Package Layout`. Where a detector needs to
distinguish "domain code" from "HTTP/UI code" or "infrastructure code",
it relies on:

- The Responsibility column from AGENTS.md (advisory — read it before
  judging a hit).
- Path-pattern signals (e.g. `routes/`, `*.tsx`, `infra/`) on the file
  itself, never the package name.

If neither signal is present, the audit flags the finding with
`requires_decision: true` and leaves the judgment to the reader.

## What counts as a violation

### A. Branded primitives missing
Domain identifiers, monetary amounts, and validated strings typed as raw
`string` / `number`. Risk: medium.

The grep below over-matches — any `id: string` field on a DTO, ORM model,
or API request shape will hit. Flag findings with
`requires_decision: true` unless the file's path makes it clear that the
type is a domain entity (e.g. `domain/`, `entities/`, `model/`), and
explicitly skip hits in obvious boundary-shape files (`*.dto.ts`,
`*.request.ts`, `*.response.ts`, generated client files).

### B. Misplaced business logic
Domain decisions in files that, by their path or responsibility, should
not own them:
- Conditional logic beyond request validation inside `*/routes/*`,
  `*/handlers/*`, or `*/controllers/*` files.
- Domain calculations in `*.tsx` / `*.jsx` component files.
- `if/else` chains deciding domain outcomes inside files whose path
  segment matches `*infra*`, `*adapters*`, `*persistence*`,
  `*integrations*`.

Risk: high. False-positive prone — read the responsibility column and the
code before flagging. **Default `requires_decision: true` for every B
finding sourced from the grep.** Drop hits whose `if` body is a single
`return`, `throw`, `res.status(...)`, or `next(...)` — those are
control-flow guards, not domain logic. Linter-sourced B findings
(when `eslint-plugin-boundaries` is already configured) do not require
`requires_decision: true` by default.

### C. CQS violation
A function that returns meaningful data **and** causes a side effect
(DB write, event dispatch, state mutation). Risk: medium.

The grep below is a coarse heuristic (it looks for `return` somewhere
near a write-shaped `await`). It will miss real CQS violations and
flag innocent code (e.g. a query that happens to return what it just
read). **Default `requires_decision: true` for every C finding sourced
from the grep.** A finding sourced from the fallow seed or from a
direct read of the function body can be flagged `false` when the
violation is clear-cut (the function definitely both writes and
returns the post-write state).

### D. Tell Don't Ask (getter chains)
`a.getB().getC().doThing()` patterns, or callers reading multiple getters
on an object to make a decision the object should own
(`if (user.getRole() === 'admin' && user.getStatus() === 'active')`).
Risk: medium.

### E. Validation deeper than the boundary
Schema parses, `isValid` checks, and `z.object` / `.safeParse` calls inside
files whose responsibility (per AGENTS.md) is downstream of the entry
point — i.e. anything called *after* request/CLI/event parsing should
already trust its inputs. Detection here is heuristic: the audit lists
candidate sites and asks the reader to confirm, since the call may be
legitimate (e.g. parsing a third-party API response at an internal
boundary).

Risk: medium. Default `requires_decision: true` unless the call is in a
file whose path strongly suggests it owns the entry boundary (e.g.
`*/routes/*`, `*/handlers/*`, `cli.ts`, `index.ts` for an event subscriber).

## Detection

All commands below use placeholders resolved from the `## Package Layout`
table in `AGENTS.md` (see references/discover.md). Substitute before running.
Where `<pkg_root>` appears, iterate over every row.

```bash
# A — raw primitives for domain IDs
grep -rEn "(id|Id): string|(price|amount): number|slug: string" \
  <all_pkg_roots> --include="*.ts"

# B — check if eslint-plugin-boundaries is already configured (read-only probe)
#   If so, use linter output as the definitive source and skip the grep.
eslint --print-config <any-ts-file> 2>/dev/null | grep -q '"boundaries' \
  && <lint> --format json --max-warnings=999 2>/dev/null \
     | node -e "
         const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
         d.forEach(f=>f.messages
           .filter(m=>m.ruleId&&m.ruleId.startsWith('boundaries/'))
           .forEach(m=>console.log(f.filePath+':'+m.line+': '+m.message))
         )
       "
# If the probe above produces output, use those findings for B — no grep needed.
# If not (plugin not configured), fall through to the grep below.

# B — misplaced business logic (path-signal heuristic; use only if linter probe found nothing)
#   Post-filter: drop any hit whose `if` body is a single `return`, `throw`,
#   `res.status(...)`, or `next(...)` — those are control-flow guards.
grep -rEn "^\s*if \(" <all_pkg_roots> \
  --include="*.ts" --include="*.tsx" \
  | grep -E "/(routes|handlers|controllers)/|\.tsx:|/(infra|adapters|persistence|integrations)/" \
  | grep -v "\.spec\.\|\.test\."

# C — function returns AND causes a side effect (heuristic; needs review)
grep -rEn -A 10 "(async function|=> \{)" <all_pkg_roots> --include="*.ts" \
  | grep -B5 "return " | grep -B5 "await.*\.(create|update|delete|save|insert)\(\|emit\(\|dispatch\("

# D — getter chains
grep -rEn "\.\w+\(\)\.\w+\(\)\." <all_pkg_roots> --include="*.ts" \
  | grep -v "\.spec\.\|\.test\.\|\.d\.ts"

# E — validation inside non-boundary files
#   First find all validation calls, then filter to files that don't look
#   like an entry point (routes/handlers/cli/event-subscriber index.ts).
grep -rEn "isValid|\.parse\(|z\.object|\.safeParse" <all_pkg_roots> --include="*.ts" \
  | grep -vE "/(routes|handlers|controllers)/|/cli\.ts|/subscriber\.ts"
```

## Action-item granularity

- **A** — one entity type per item (e.g. "introduce `UserId`").
- **B** — one route handler / component / infra adapter per item.
- **C** — one function per item.
- **D** — one logical concept per item (e.g. "push `isActiveAdmin` onto User").
- **E** — one call site per item (or one tightly-coupled cluster — e.g.
  a single service that re-validates its inputs five times).

## Suggested fix shape

- **A** — define the brand in the package nominated for shared types
  (per AGENTS.md `## Package Layout`), export it, update signatures, add
  the boundary constructor (`toUserId`) at the entry point.
- **B** — name the rule, find or create the appropriate domain service
  (in whichever package owns domain logic per AGENTS.md), move the logic
  with injected dependencies, write a unit test that passes without HTTP
  or DOM, run the full suite.
- **C** — split into command (`Promise<void>`) and query (pure read);
  update callers; if the caller needs post-write state, have it call the
  query after the command.
- **D** — add a method on the owning domain object; replace callers that
  replicated the check.
- **E** — move the schema parse to the entry-point file (route handler,
  CLI parser, event subscriber); remove downstream validation; add or
  update an integration test (invalid input rejected at boundary, valid
  input reaches the service correctly typed).

If the fix would move logic between packages and the layout itself is
unclear, mark `requires_decision: true` and add a note suggesting
`lodestar-architecture`.

## Scope rules (must appear verbatim in generated action items)

- One entity / route / function / concept per commit.
- Update all call sites in the same commit.
- Run `<typecheck>` and `<test>` after each commit.
- Mark `requires_decision: true` and stop if:
  - Fix touches more than 3 files (A, B, E) or 5 callers (C, D).
  - Fix would change a public API consumed outside the monorepo.
  - The concept spans two bounded contexts (D).
  - The fix would require moving the file to a different package, and
    AGENTS.md doesn't clearly show which package should own it.

## Acceptance check

- `<typecheck>` passes.
- `<test>` passes (including any new tests required by the fix).
- No new direct primitive uses for the entity (A).
- The moved logic has a unit test that runs without HTTP/DOM (B).
- The function no longer returns data while writing (C).
- The getter chain pattern is removed and the new method is used (D).
- No remaining validation in the named non-boundary file (E).
