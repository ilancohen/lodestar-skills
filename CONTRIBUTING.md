# Contributing

Read `AGENTS.md` before changing this skill suite.

The canonical skill implementations live under `skills/`. Product manifests
and client adapters are thin references only — they must not duplicate
workflow logic.

`lodestar-setup` step procedures live in
`skills/lodestar-setup/references/`. `SKILL.md` is the dispatcher — do
not copy procedure back into it.

This suite uses **pnpm**. In a consuming repository, use that repo's
npm / yarn / pnpm / Bun setup; ask if the lockfile does not make it obvious.

## Pre-commit checklist

Before committing suite changes:

1. `pnpm check`
2. `pnpm test`
3. Confirm local discovery with `pnpm dlx skills add . --list`
4. Confirm adapters still discover exactly six skills, none auto-invoke
   (`disable-model-invocation: true`), and adapters never auto-load
   `lodestar-fix`

Add a `CHANGELOG.md` section for the target version, then run
`pnpm run publish -- patch` (or `minor` / `major` / `x.y.z`). Use
`--push` or push branch and tag separately. See `AGENTS.md`.

## Module sharing

**The suite installs as a unit, and `lodestar-setup` is the base skill.**
Partial installs are an unsupported configuration.

That one rule settles where shared code lives:

- Shared modules live once, under `skills/lodestar-setup/scripts/` —
  `runtime.mjs`, `detect-linter.mjs`, `discover-docs.mjs`. Do not vendor
  copies into other skills.
- A dependent skill reaches them only through its own
  `scripts/setup-modules.mjs`. Nothing else under `skills/` may contain a
  `../../` import.
- That gateway imports dynamically and checks the file exists first, so an
  absent base skill prints an actionable message instead of
  `ERR_MODULE_NOT_FOUND` for a path the user never chose.
- Each gateway re-exports only what its own skill uses.
  `tests/runtime.test.mjs` pins that set and asserts the missing-base-skill
  message; `scripts/check_package.mjs` enforces the import rule.

Adding a shared module means putting it in `lodestar-setup/scripts/` and
re-exporting it from each gateway that needs it.

## Deliberate duplication

The commit-template checks are duplicated in
`lodestar-audit/scripts/audit-state.mjs` (parse time) and
`lodestar-fix/scripts/action-state.mjs` (commit time). Change them
together.
