# Upgrading

Default to **project scope**. These skills write repository-specific config
and `docs/audit/` output.

## Install

```bash
npx skills add ilancohen/lodestar-skills
```

Enter accepts detected agents and all four skills. That is the normal
install path.

Per-agent example:

```bash
npx skills add ilancohen/lodestar-skills --skill '*' -a cursor
```

Scripts that must not prompt:

```bash
npx skills add ilancohen/lodestar-skills --skill '*' -y
```

## Upgrading to 0.3.0 — re-run setup

0.3.0 moves the repo facts the skills read out of `AGENTS.md` and into
`.agents/lodestar/context.md`. After updating, run `lodestar-setup` once
in each consuming repository. It reuses whatever it finds in `AGENTS.md`,
writes the new file, and offers to strip the leftover lodestar sections
from `AGENTS.md`. Until then, `lodestar-audit`, `lodestar-fix`, and
`lodestar-architecture` stop with "`.agents/lodestar/context.md` is
missing".

## Update

From the consuming repository:

```bash
npx skills add ilancohen/lodestar-skills
```

Non-interactive:

```bash
npx skills add ilancohen/lodestar-skills --skill '*' -y
```

Pin to a release:

```bash
npx skills add ilancohen/lodestar-skills@v0.2.0 --skill '*' -y
```

## Rollback

Re-run the install command against a prior tag:

```bash
npx skills add ilancohen/lodestar-skills@<prior-tag> --skill '*' -y
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
