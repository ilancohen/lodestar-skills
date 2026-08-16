# Changelog

All notable changes to this project will be documented here.

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
  four skills; Enter accepts the defaults. `pnpm dlx github:ilancohen/lodestar-skills`.

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
