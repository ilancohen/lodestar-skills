# Upgrading

Default to **project scope**. These skills write repository-specific config
and `docs/audit/` output.

Use the consuming repository's package manager (`pnpm dlx`, `npx`, or
`yarn dlx`). Examples below use pnpm.

## Install

```bash
pnpm dlx skills add ilancohen/engineering-principles-skills
```

Omit `-a` so the skills CLI detects installed agents and uses those as the
default selection. That is the normal install and update path. Copying or
symlinking `skills/` into a repository is a legacy path; use
`node scripts/migrate_vendored.mjs` instead of copying again.

Scripts that must not prompt should pin the full suite with `--skill '*'`
and `-y`:

```bash
pnpm dlx skills add ilancohen/engineering-principles-skills --skill '*' -y
```

## Update

From the consuming repository:

```bash
pnpm dlx skills add ilancohen/engineering-principles-skills
```

Non-interactive:

```bash
pnpm dlx skills add ilancohen/engineering-principles-skills --skill '*' -y
```

Pin to a release:

```bash
pnpm dlx skills add ilancohen/engineering-principles-skills@v0.1.0 --skill '*' -y
```

## Rollback

Re-run the install command against a prior tag:

```bash
pnpm dlx skills add ilancohen/engineering-principles-skills@v0.1.0 --skill '*' -y
```

Confirm installed metadata reports the rolled-back version in each
`SKILL.md` `metadata.version` field.

## Legacy vendored copies

If a repository already copied these skills into `.agents/skills/`,
`.claude/skills/`, or `.cursor/skills/`:

```bash
node scripts/migrate_vendored.mjs --target /path/to/repo
node scripts/migrate_vendored.mjs --target /path/to/repo --check
node scripts/migrate_vendored.mjs --target /path/to/repo --apply
```

`--apply` is required to write. Local checksum changes are never
overwritten unless you also pass `--force`. Extra files in a copy are
never deleted; remove them yourself, then re-run `--check`. A backup is
written under `.ep-skills-backup/` first. The marker records
`source_version` and the source git tag from `git describe` (override
with `--tag`). Reruns are idempotent when the copy already matches this
package version.
