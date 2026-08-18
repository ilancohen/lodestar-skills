# Changelog

All notable changes to this project will be documented here.

## [0.8.0] - 2026-08-18

### Added

- **Context freshness.** `check-freshness` notices when
  `.agents/lodestar/context.md` has stopped being true — a package on
  disk with no layout row, or a recorded command whose script is gone.
  Skips when the inputs are absent rather than guessing. Audit warns
  and asks whether to proceed, recording the stale basis in the run;
  `lodestar-fix` stops on command drift and can refresh `## Dependency
  Direction` after breaking a documented cycle; `lodestar-architecture`
  reports drift without blocking. A pre-0.8 file, and a repo where
  every check skips, behave as today.

## [0.7.0] - 2026-08-18

### Added

- **`context.md` `## Audit Scope`.** Setup measures git churn (commit
  count, first-commit date, tracked source files, 90-day touches) and
  asks one question: expand every finding, or only code changed since
  today's commit. Large mostly-cold repos (80+ source files and under
  30% 90-day churn) get `changed-since` recommended; the rest get
  `all`. The baseline is `HEAD` at setup. Absent section means `all`.
  `changed-since` without a resolvable `baseline-ref` is an error, not
  a silent fallback.

- **Backlog reporting.** Discovery still scans the whole repo.
  `findings.md` is complete under every scope; Phase 2 expands
  `in_scope` findings only and `INDEX.md` counts the rest. A later
  session can promote a category or package without re-scanning. A
  one-run widening is not written back to `context.md`.

### Changed

- **Backward compatible.** A `context.md` with no `## Audit Scope`
  section audits everything and expands every finding, as today.

## [0.6.0] - 2026-08-18

### Fixed

- **Non-TS repos no longer look clean.** Setup stops before writing
  anything when the repo has no TypeScript or JavaScript, and names the
  languages it found. A mixed repo keeps unscannable packages as
  `Scannable: no` rows; the audit lists them as not scanned instead of
  producing an empty `findings.md`.

### Added

- **`context.md` `## Excluded Paths`.** Setup proposes generated and
  test globs with evidence; every detector and Fallow `ignorePatterns`
  skip them. Absent means today's `*.spec.*` / `*.test.*` / `*.d.ts`
  behavior.

- **Observed layout.** Setup finds whatever declares the workspace
  (`pnpm-workspace.yaml`, `package.json` workspaces, Nx / Turbo / Lerna
  as hints), records entry points from `exports`, and supports a
  single-package repo (empty graph; `imports` #6 and `boundaries` B
  listed as not applicable).

- **Other toolchains.** Bun is detected from `bun.lock` / `bun.lockb`.
  An unrecognized manager is a `pkg-manager` row in `context.md` that
  wins over lockfile detection. Deno and Bazel are unsupported.

- **`context.md` `## Git`.** Whether `lodestar-fix` commits (`ask` /
  `per-item` / `never`), the subject and trailer templates, protected
  branches, and `require-clean`. Absent means today's ask-each-session
  behavior. A rejecting hook defers the item and leaves the edits.

### Changed

- **Backward compatible.** A `context.md` with none of the new sections
  or columns parses as today. Pre-0.6 files need no migration.

## [0.5.0] - 2026-08-18

### Added

- **`context.md` `## Conventions`.** Setup asks one multi-select —
  pre-checked from a bounded evidence sweep — which of five style
  conventions the repo already follows: `result-types`, `branded-types`,
  `barrel-exports`, `design-tokens`, `coverage-floor`. The audit skips the
  matching detectors when a row is at its skip value, and lists the skip
  in `INDEX.md` rather than staying silent. `principles.md` still states
  the defaults; it points at the table instead of copying values.

- **`context.md` `## Audit Settings`.** Optional `categories` (default
  all), `output-root` (default `docs/audit`), and `fallow` (`required` |
  `optional`, default `required`). Setup does not ask; `lodestar-audit`
  may persist a subset if the user asks after a run. Architecture
  reports stay beside the audit root (`docs/audit` →
  `docs/architecture-review`; any other root →
  `<output-root>/architecture-review`). `fallow: optional` continues
  without Fallow using grep-only detectors and lists unchecked subtypes
  in `INDEX.md` (`imports` #7–#9, `dry` A, `soc-yagni` A ranking).

### Changed

- **Backward compatible.** A `context.md` with neither new section
  parses as today: every convention on, coverage floor 80, all nine
  categories, output under `docs/audit`. Pre-0.5 files need no
  migration. Styling B now waits for a third occurrence of a literal,
  matching `ssot` A (was 2).

## [0.4.2] - 2026-08-18

### Changed

- **`lodestar-setup` Step 6 offers to install Fallow** instead of only
  printing the command and leaving it to the user. It asks first, asks where
  the devDependency goes when the repo has more than one package, and never
  installs over a copy that already resolves in range. An out-of-range copy
  gets the same prompt worded as an upgrade, with the installed version
  named.

  The command is quoted from `resolve-bin`'s own failure message, so the
  version pin and the per-manager syntax keep one source.

  Declining, or an install that fails (no network, or a platform with no
  Fallow binary), is not a setup failure: the command is printed, the step
  says `lodestar-audit` needs a compatible Fallow, and `.fallowrc.json` is
  still offered. The install, `.fallowrc.json`, and the `.gitignore` edit
  are three independent consent gates.

## [0.4.1] - 2026-08-18

### Changed

- **`lodestar-audit` Fallow schema gate changed from exact equality to a
  floor.** A schema above the contract baseline (combined 10, dupes 8) passes
  when every field the audit reads is still present. On the first encounter
  the contract script records the accepted version/schema pair in
  `.agents/lodestar/fallow-compat.json` in the target repo and prints a
  one-line note to stderr; subsequent runs with the same recorded schema are
  silent. Commit `fallow-compat.json` to share the decision with the team.

  This unblocks Fallow 3.17.0 (combined schema 11, dupes schema 9), whose
  changes are additive — new optional fields, a new counter, a new enum
  variant. Nothing the audit reads changed.

- **Improved remediation message when a newer Fallow schema drops a required
  field.** The message now says "Fallow X.Y.Z changed fields the audit reads"
  and suggests `fallow@~<last-good>` (pinning backwards) instead of
  `fallow@^3.15.0` (which would resolve to the broken version).

  **Unblocking an affected repo now:** `<pm> add -D fallow@3.16.0` — 3.16
  still emits combined schema 10.

## [0.4.0] - 2026-08-18

### Changed

- **Breaking (semantic).** `context.md` `## Dependency Direction` records the
  **observed** package import graph, not an intended layering. Acyclic repos
  keep the chain form; cyclic repos use an explicit edge list plus a cyclic
  statement. A `Basis:` capture date is required. `lodestar-setup` never
  infers or writes a target direction when the graph is cyclic.

- `lodestar-audit` `imports` subtype #6 (`wrong-direction`) now means an
  import opposes a documented edge or path. Documented cycle edges are
  reported as #3 (`circular-import`), not #6. `validate-input` adds
  `directionGraph` (`chain`, `edges`, `cyclic`, `reachability`); `direction`
  remains the acyclic chain order (empty when cyclic).

- `.fallowrc.json` boundary `allow` lists derive from documented graph
  reachability (cycle partners list each other), matching the new semantics.

  **Upgrading:** re-run `lodestar-setup` to refresh `context.md` and
  `.fallowrc.json`, or hand-edit the direction section to the new form.

## [0.3.1] - 2026-08-17

### Changed

- `lodestar-setup` steps renumbered to contiguous integers (former 2.5 → 3,
  4.1 → 5, 4.5 → 6, 4.6 → 7, Confirm → 8). The old "principles.md stays
  where it is" step is folded into Write the files.

## [0.3.0] - 2026-08-17

### Changed

- **Breaking.** `AGENTS.md` is no longer load-bearing. `lodestar-setup`
  writes the package layout, dependency direction, and build commands to
  `.agents/lodestar/context.md`, and `lodestar-audit`, `lodestar-fix`, and
  `lodestar-architecture` read only that file. They no longer read
  `AGENTS.md` at all, and will not fall back to a layout table left there
  by an older setup.

- `lodestar-setup` touches `AGENTS.md` only when the user picks full-suite
  enforcement, and then only to add a short `## Lodestar` pointer section.
  In skills-only mode `AGENTS.md` is left untouched. A new Step 4.1 offers
  to strip the now-unread lodestar sections from a pre-0.3 `AGENTS.md`.

- `.agents/skills/README.md` is now a static signpost. No skill requires or
  reads it.

- `lodestar-audit`'s `principles/` directory is renamed to `categories/`.
  Those files are per-category detector playbooks (what counts as a
  violation, detection commands, fix recipes); the principles themselves
  live only in `skills/lodestar-setup/principles.md`. The old name implied
  two competing copies.

  **Upgrading:** re-run `lodestar-setup` in each consuming repository
  before running the other skills. They stop with
  "`.agents/lodestar/context.md` is missing" until you do.

## [0.2.0] - 2026-08-16

### Changed

- `lodestar-audit` accepts Fallow `^3.15.0` (same major, at least 3.15.0)
  instead of pinning an exact tool version. Envelope schema and field
  checks are unchanged.

- `scripts/migrate_vendored.mjs` drops the `ep-*` -> `lodestar-*` rename
  mapping (never published under the old name, so no vendored `ep-*`
  copies exist to migrate). The rename-detection mechanism itself stays
  as a generic, currently-empty `RENAME_MAP` for handling a future skill
  ID rename; the drift-check/re-sync path for vendored copies (checksum
  compare, backup, reapply) is unaffected.

## [0.1.0] - 2026-08-13

### Changed

- All four skills set `disable-model-invocation: true` so they load only when
  the user invokes them by name.

- Suite renamed to **Lodestar** (`ilancohen/lodestar-skills`). Hard cutover —
  old `ep-*` skill IDs are not aliases. Mapping:

  | Old                      | New                     |
  | ------------------------ | ----------------------- |
  | `ep-setup`               | `lodestar-setup`        |
  | `ep-audit`               | `lodestar-audit`        |
  | `ep-fix`                 | `lodestar-fix`          |
  | `ep-review-architecture` | `lodestar-architecture` |

- Dry-run-first `scripts/migrate_vendored.mjs` for legacy vendored `ep-*`
  copies under `.agents/skills`, `.claude/skills`, and `.cursor/skills`
  (refuses local checksum edits without `--force`).

- Generated audit `INDEX.md` title is `# Lodestar audit`; suggested order of
  attack matches the canonical category sequence
  (`imports → types → ssot → soc-yagni → boundaries → errors →
testability → dry → styling`).

- `lodestar-architecture` Inputs require only `AGENTS.md` (Package Layout
  and Dependency Direction); `.agents/skills/README.md` is not a gate.

- `lodestar-setup` asks separately before adding `.audit-fallow-seed.json`
  and `.fallow/` to `.gitignore` (decline still writes `.fallowrc.json`).

- `lodestar-fix` Step 1 only offers runs that already have both `INDEX.md`
  and at least one `NNN-*.md` in the run root.

- Optional linter rule detail for setup lives in bundled `linters.md`;
  Step 4.6 is a short consent step.

### Added

- Standalone package for `lodestar-setup`, `lodestar-audit`, `lodestar-fix`, and
  `lodestar-architecture`.
- Portable Agent Plugin and Claude, Codex, and Gemini package manifests.
- Implementation roadmap, package validation, and CI.
- Canonical `VERSION` source and install/upgrade docs.
- Installer TUI (`@clack/prompts`) pre-selects detected agents and all
  four skills; Enter accepts the defaults. `npx github:ilancohen/lodestar-skills`.

### Fixed

- Made `lodestar-fix` frontmatter valid YAML.
- Replaced installed-location assumptions for `lodestar-setup` resources with
  relative paths.
- Added `lodestar-fix` to generated skill indexes.
- Corrected the audit category count and the fix-category order.
- Corrected a stale `lodestar-setup` reference in the Fallow seed guide.
- Documented per-client adapter discovery (Codex `skills` path; Claude /
  Gemini convention on root `skills/`; Cursor Agent Plugins).
- Clarified Windows CI: suite checks run under bash on `windows-latest`,
  not native PowerShell.
- Removed unreachable no-Fallow coverage narrative from `imports.md`.
- `audit-state checkpoint` help lists `--package`.
