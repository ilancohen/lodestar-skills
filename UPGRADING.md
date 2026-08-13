# Upgrading

Default to **project scope**. These skills write repository-specific config
and `docs/audit/` output.

Use the consuming repository's package manager (`pnpm dlx`, `npx`, or
`yarn dlx`). Examples below use pnpm.

## Install

```bash
pnpm dlx skills add ilancohen/lodestar-skills
```

Enter accepts detected agents and all four skills. That is the normal
install path.

Per-agent example:

```bash
pnpm dlx skills add ilancohen/lodestar-skills --skill '*' -a cursor
```

Scripts that must not prompt:

```bash
pnpm dlx skills add ilancohen/lodestar-skills --skill '*' -y
```

## Update

From the consuming repository:

```bash
pnpm dlx skills add ilancohen/lodestar-skills
```

Non-interactive:

```bash
pnpm dlx skills add ilancohen/lodestar-skills --skill '*' -y
```

Pin to a release:

```bash
pnpm dlx skills add ilancohen/lodestar-skills@v0.1.0 --skill '*' -y
```

## Rollback

Re-run the install command against a prior tag:

```bash
pnpm dlx skills add ilancohen/lodestar-skills@v0.1.0 --skill '*' -y
```

Confirm installed metadata reports the rolled-back version in each
`SKILL.md` `metadata.version` field.

## Migration from engineering-principles / `ep-*`

This suite was formerly **engineering-principles** with skill IDs
`ep-setup`, `ep-audit`, `ep-fix`, and `ep-review-architecture`.

**Hard cutover:** those IDs no longer install. There are no runtime
aliases. Reinstall with the Lodestar spec above, or migrate vendored
copies:

| Old                      | New                     |
| ------------------------ | ----------------------- |
| `ep-setup`               | `lodestar-setup`        |
| `ep-audit`               | `lodestar-audit`        |
| `ep-fix`                 | `lodestar-fix`          |
| `ep-review-architecture` | `lodestar-architecture` |

```bash
# dry-run (default)
node /path/to/lodestar-skills/scripts/migrate_vendored.mjs --target .

# apply (backs up under .lodestar-backup/; refuses local edits unless --force)
node /path/to/lodestar-skills/scripts/migrate_vendored.mjs --target . --apply
```

The migrator only touches known skill parents (`.agents/skills`,
`.claude/skills`, `.cursor/skills`). It never rewrites application source.

### Known consuming repositories

None yet — the suite has not been published under the old name. When
consumers appear, open follow-up PRs with their maintainers; do not
silently rewrite their application trees.
