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
4. Confirm adapters still discover exactly five skills, none auto-invoke
   (`disable-model-invocation: true`), and adapters never auto-load
   `lodestar-fix`

Add a `CHANGELOG.md` section for the target version, then run
`pnpm run publish -- patch` (or `minor` / `major` / `x.y.z`). Use
`--push` or push branch and tag separately. See `AGENTS.md`.

## Deliberate duplication

`runtime.mjs` ships in three skill copies (`lodestar-audit`,
`lodestar-fix`, `lodestar-setup`). The copies are intentional: each
skill must stand alone when installed individually. Do not "DRY" them into
a shared module under `scripts/` — that would break standalone install.
Edit each copy deliberately, or update them together in one change. Each
copy exports only what its own scripts use, and `tests/runtime.test.mjs`
pins that set.

The same rule covers the commit-template checks, which are duplicated in
`lodestar-audit/scripts/audit-state.mjs` (parse time) and
`lodestar-fix/scripts/action-state.mjs` (commit time). Change them
together.
