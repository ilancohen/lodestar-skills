# Changelog

All notable changes to this project will be documented here.

## [0.11.2] - 2026-08-19

### Changed

- **Simpler release flow.** `pnpm run publish` now requires a matching `CHANGELOG.md` section before tagging, supports `--push`, and prints the exact branch-and-tag push command when you do not use it.
- **Safer GitHub releases.** The release workflow marks new releases as latest and safely re-runs by updating an existing release instead of failing or leaving the wrong release marked latest.
- **Clearer versioning docs.** Contributor docs now say to add the changelog section first and to push `HEAD` plus the new tag explicitly instead of using `--follow-tags`.

## [0.11.1] - 2026-08-19

### Removed

- Removed custom install wrapper (`scripts/install.mjs`, `lodestar-skills` bin). Install with `npx skills add ilancohen/lodestar-skills`.

## [0.11.0] - 2026-08-19

### Added

- **`scan-extensions` in Audit Configuration.** Setup infers UI framework extensions; source-scan and Step 0 honor the list.
- **Linter tool and JSON probe.** Setup writes `dev-command; tool; probe-command`; audit reads the probe; check-freshness flags drift.
- **Fallow entry-point validation.** Setup verifies boundaries and entry surfaces; requires a declared `fallow` pin and positive `list-entry-points` count.

## [0.10.1] - 2026-08-18

### Added

- **`pnpm run publish`.** Bumps VERSION, manifests, and skill metadata; commits and tags `vX.Y.Z`.

## [0.10.0] - 2026-08-18

### Changed

- **Two consent screens instead of ten.** One review of observed repo state; one for writes outside `.agents/`. Ambiguous package manager stays a separate question. Defaults replace old prompts (80-files/30% audit scope, ask-each-time commits, skills-only enforcement).

## [0.9.1] - 2026-08-18

### Changed

- **Plain-language prompts.** User-facing questions rewritten; internal keys stay in files. Each `SKILL.md` adds a "How to talk to the user" section.

## [0.9.0] - 2026-08-18

### Changed

- **Setup and audit docs.** Step procedures live in `references/`; audit category docs do not cross-load.
- **Breaking: `context.md` is seven sections.** Audit settings merge into `## Audit Configuration`; principles, skills, and output merge into `## Reference`. Pre-0.8 files fail the parser — re-run setup.

## [0.8.0] - 2026-08-18

### Added

- **Context freshness.** `check-freshness` detects stale context (missing packages, gone commands). Audit warns; fix stops on command drift; architecture reports drift.

## [0.7.0] - 2026-08-18

### Added

- **`## Audit Scope`.** Setup measures git churn; large cold repos get `changed-since` recommended. Full findings in `findings.md`; Phase 2 expands `in_scope` only.
- **Backlog reporting.** Out-of-scope findings stay in the index; a later session can widen scope without re-scanning.

### Changed

- Missing `## Audit Scope` means audit everything (backward compatible).

## [0.6.0] - 2026-08-18

### Fixed

- Non-TS repos no longer look clean; setup stops early when no TypeScript or JavaScript is found.

### Added

- **`## Excluded Paths`** with evidence-backed globs.
- **Observed layout** from workspace config and package `exports`.
- **Bun detection** and unrecognized package-manager rows in context.
- **`## Git`** commit policy section.

### Changed

- Backward compatible; pre-0.6 files need no migration.

## [0.5.0] - 2026-08-18

### Added

- **`## Conventions`** multi-select for skip detectors.
- **`## Audit Settings`** for categories, output root, and Fallow mode.

### Changed

- Backward compatible; pre-0.5 files need no migration. Styling B threshold raised to 3 (was 2).

## [0.4.2] - 2026-08-18

### Changed

- **Setup offers Fallow install** with separate consent gates; decline or install failure is not a setup failure.

## [0.4.1] - 2026-08-18

### Changed

- **Fallow schema gate is a floor**, not exact match; records accepted schema in `fallow-compat.json`. Clearer remediation when a newer schema drops required fields.

## [0.4.0] - 2026-08-18

### Changed

- **Breaking: `## Dependency Direction` records the observed graph** (chain or cyclic edges). Re-run setup to upgrade.

## [0.3.1] - 2026-08-17

### Changed

- Setup steps renumbered to contiguous integers.

## [0.3.0] - 2026-08-17

### Changed

- **Breaking: skills read `.agents/lodestar/context.md` only**, not `AGENTS.md`. `principles/` renamed to `categories/`. Re-run setup before other skills.

## [0.2.0] - 2026-08-16

### Changed

- Audit accepts Fallow `^3.15.0`. Removed unused `ep-*` rename mapping from migrate script.

## [0.1.0] - 2026-08-13

### Changed

- Suite renamed to **Lodestar** (`ep-*` → `lodestar-*`, hard cutover). All skills set `disable-model-invocation: true`.

### Added

- Standalone package with four skills, plugin manifests, CI, VERSION source, and installer TUI.

### Fixed

- YAML frontmatter, relative resource paths, skill indexes, and assorted docs corrections.
