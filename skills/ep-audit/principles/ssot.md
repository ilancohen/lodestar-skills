# Category: `ssot`

Single Source of Truth — every fact has one home. **Low to medium risk.**
Detectors are mechanical (grep-based literal / schema clustering); fixes
are mostly mechanical (move the value to one location, update imports).

Scope note: `ssot` covers duplicated *facts* (constants, schemas, config
values, magic literals). Duplicated *behaviour* (logic, functions, code
blocks) belongs in `dry`. Duplicated *type declarations* belong in
`types`. The failure mode that distinguishes `ssot` is **drift** — one
copy gets updated, the other lags silently, and the bug surfaces months
later in a different system.

## What counts as a violation

### A. Redeclared constant
A bare literal (string, number, regex, etc.) that appears in 3+ source
files when one named export would do.

Common shapes:
- The same URL, env var name, queue name, or feature flag hardcoded in
  every consumer.
- A numeric constant (timeout, retry count, page size, polling interval)
  repeated across multiple call sites.
- A regex literal duplicated across validators.

Risk: low. Fix is mechanical (define once, import everywhere) but
`requires_decision: true` when the "same" literal genuinely has two
meanings that happen to share a value.

### B. Redeclared schema or config object
A schema (`z.object`, `joi.object`, `yup.object`) or configuration object
defined in two or more places with overlapping fields — typically once
on the server (validation) and once on the client (form shape, derived
types). The two will drift, and the failure mode is usually a 4xx that
the client thinks should be a 2xx.

Risk: medium. Fix shape: one canonical definition in whichever package
both consumers can reach (typically the shared / types package per
AGENTS.md `## Package Layout`); both producer and consumer import.

### C. Configuration value duplicated across environments
A config key (DB URL, API base URL, timeout, feature flag) declared in
multiple env-loading sites — e.g. once in `process.env` parsing on the
server and once in a frontend `import.meta.env` block, instead of one
typed config module both import.

Risk: medium. Often `requires_decision: true` because the config
loading paths may legitimately differ between runtime targets.

## Detection

All commands below use placeholders resolved from the `## Package Layout`
table in `AGENTS.md` (see SKILL.md Step 1.0). Substitute before running.

These detectors produce candidate clusters. The executor must read the
code at every cited site and confirm the literal genuinely means the
same thing before promoting a candidate to a finding.

```bash
# A — repeated string literals across 3+ files
#   The 3-file threshold filters two-copy coincidences. Adjust by hand
#   if the codebase has well-known shared strings (logger tags, etc.).
grep -rEohn "'[A-Za-z_./:@-][A-Za-z0-9_./:@-]{3,}'" <all_pkg_roots> \
  --include="*.ts" --include="*.tsx" \
  | sort | uniq -c | awk '$1 >= 3 {print}' | sort -rn

# A — repeated numeric constants (3+ digit integers, excluding test files)
#   Filter trivial / common values (1000, 60000, 200, 404, 500) by hand —
#   not every shared number is an SSOT violation.
grep -rEohn "\b[0-9]{3,}\b" <all_pkg_roots> \
  --include="*.ts" --include="*.tsx" \
  | grep -vE "\.spec\.|\.test\." \
  | sort | uniq -c | awk '$1 >= 3 {print}' | sort -rn

# B — schema factories called in 2+ packages
#   The grep lists every file declaring a schema; cluster by hand to
#   find ones whose fields overlap.
grep -rEn "z\.object\(|joi\.object\(|yup\.object\(|Schema\(" \
  <all_pkg_roots> --include="*.ts"

# C — env-var reads scattered across packages
#   A repo with one config module shows hits in one file. Hits in 3+
#   files is a sign the config isn't centralized.
grep -rEn "process\.env\.[A-Z_]+|import\.meta\.env\.[A-Z_]+" \
  <all_pkg_roots> --include="*.ts" --include="*.tsx" \
  | awk -F: '{print $1}' | sort -u
```

Detection here is **not** seeded by the fallow pre-pass — fallow's
duplication detectors look at code-block similarity, not literal
clustering. The greps above are the primary path; fallow's `dupes`
output is separately consumed by `dry`.

## Action-item granularity

- **A** — one literal per item. All cited sites listed in `files:`. If a
  cluster has more than ~8 sites, mark `requires_decision: true` so the
  reader confirms the literals all mean the same thing.
- **B** — one schema per item. List producer and every consumer.
- **C** — one config key per item, or one logical config group
  (e.g. "database connection params" as a group of 4 keys).

## Suggested fix shape

- **A** — define the value in one place and import it:
  - All sites in one package → a private `constants.ts` (or similar)
    in that package.
  - Sites span packages → the package nominated for shared code in
    AGENTS.md `## Package Layout`. Add the export to `index.ts` so
    consumers don't reach into `/src/`.
  Replace each literal with the named import. Run `<typecheck>` and
  `<test>`.

- **B** — declare the schema once in the shared types package (per
  AGENTS.md). Producer imports it for validation; consumer imports it
  for typing (`z.infer<typeof Schema>`) and/or form construction. If the
  client and server need *similar but distinct* schemas (e.g. server
  has internal fields the client doesn't see), the canonical schema
  should describe the common subset, and each side extends with
  `.merge()` / `Pick` / `Omit`. Mark `requires_decision: true` when
  this is non-trivial.

- **C** — introduce a typed config module in the package responsible
  for composition / wiring (per AGENTS.md). All env reads happen there;
  every other module imports the typed config object. For multi-runtime
  repos (server + browser), accept that there may be two such modules
  (one per runtime) but each is itself canonical for its runtime.

## Scope rules (must appear verbatim in generated action items)

- The literals or schemas must mean the same thing semantically, not
  just share a value. Confirm by reading each cited site before
  extracting. If two literals share a value by coincidence
  (e.g. one is a timeout in ms, the other a queue size), leave them
  alone and explain in `notes:`.
- Update every cited site in the same commit. A partial migration
  leaves the codebase worse than before — both the old literal and the
  new import are now "the canonical place", which is the failure mode
  this category exists to prevent.
- No public API changes — internal refactor only.
- Run `<typecheck>` and `<test>` after the change.
- Mark `requires_decision: true` and stop if:
  - The fix would touch more than 8 files for a single literal.
  - The cited sites span packages with no shared package they both
    reach (per AGENTS.md `## Dependency Direction`). This is an
    architectural smell; suggest `ep-review-architecture` in `notes:`.
  - Two sites that "look the same" turn out to encode different
    business rules at the same value.

## Acceptance check

- `<typecheck>` passes.
- `<test>` full suite passes.
- The literal / schema / config key appears in exactly one declaration
  site.
- Every prior call site now imports from the canonical location.
- Re-running the detection grep for the named literal returns the
  declaration site only (≤ 1 file, excluding the import lines).
