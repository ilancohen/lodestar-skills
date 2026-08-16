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

## Vendored copies: drift check and re-sync

If you've vendored a skill (copied its files into `.agents/skills`,
`.claude/skills`, or `.cursor/skills` instead of installing via `skills
add`), check it against the current source and re-sync it:

```bash
# dry-run (default): reports drift, exits 1 if anything needs syncing
node /path/to/lodestar-skills/scripts/migrate_vendored.mjs --target .

# apply: backs up under .lodestar-backup/; refuses local edits unless --force
node /path/to/lodestar-skills/scripts/migrate_vendored.mjs --target . --apply
```

The script only touches known skill parents (`.agents/skills`,
`.claude/skills`, `.cursor/skills`). It never rewrites application source.

This same script is the hook for handling a future skill ID rename
(should one ever ship): it can detect a vendored copy under its old
directory name and re-home it to the current name, backing up first.
No rename is in flight today — this suite has not shipped one yet.
