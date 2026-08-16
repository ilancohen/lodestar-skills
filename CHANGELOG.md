# Changelog

All notable changes to this project will be documented here.

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
