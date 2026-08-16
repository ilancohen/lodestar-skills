# Contributing

Read `AGENTS.md` before changing this skill suite.

The canonical skill implementations live under `skills/`. Product manifests
and client adapters are thin references only — they must not duplicate
workflow logic.

This suite uses **pnpm**. In a consuming repository, use that repo's
npm / yarn / pnpm setup; ask if the lockfile does not make it obvious.

## Pre-commit checklist

Before committing suite changes:

1. `pnpm check`
2. `pnpm test`
3. Confirm local discovery with `pnpm dlx skills add . --list`
4. Confirm adapters still discover exactly four skills, none auto-invoke
   (`disable-model-invocation: true`), and adapters never auto-load
   `lodestar-fix`

Keep versions synchronized via `VERSION` / `scripts/set_version.mjs`.
