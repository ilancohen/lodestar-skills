# Contributing

Read `AGENTS.md` and `ROADMAP.md` before changing this skill suite.

The canonical skill implementations live under `skills/`. Product manifests
and client adapters are thin references only — they must not duplicate
workflow logic.

## Pre-commit checklist

Before committing suite changes:

1. `node scripts/check_package.mjs`
2. `node --test tests/*.test.mjs`
3. Validate each skill with `uvx --from skills-ref agentskills validate skills/<name>`
4. Confirm adapters still discover exactly four skills and never auto-load
   `ep-fix`

Keep versions synchronized via `VERSION` / `scripts/set_version.mjs`.
