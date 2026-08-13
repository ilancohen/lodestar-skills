# Upgrading

Default to **project scope**. These skills write repository-specific config
and `docs/audit/` output.

## Install

```bash
npx skills add ilancohen/engineering-principles-skills \
  --skill ep-setup ep-audit ep-fix ep-review-architecture
```

That is the normal install and update path. Copying or symlinking `skills/`
into a repository is a legacy path; use `node scripts/migrate_vendored.mjs`
instead of copying again.

## Update

From the consuming repository:

```bash
npx skills add ilancohen/engineering-principles-skills \
  --skill ep-setup ep-audit ep-fix ep-review-architecture
```

Pin to a release:

```bash
npx skills add ilancohen/engineering-principles-skills@v0.1.0 \
  --skill ep-setup ep-audit ep-fix ep-review-architecture
```

## Rollback

Re-run the install command against a prior tag:

```bash
npx skills add ilancohen/engineering-principles-skills@v0.1.0 \
  --skill ep-setup ep-audit ep-fix ep-review-architecture
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
