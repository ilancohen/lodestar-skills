# Upgrading

Default to **project scope**. These skills write repository-specific config
and `docs/audit/` output.

Use the consuming repository's package manager (`pnpm dlx`, `npx`, or
`yarn dlx`). Examples below use pnpm.

## Install

```bash
pnpm dlx github:ilancohen/lodestar-skills
```

Enter accepts detected agents and all four skills. That is the normal
install path.

Scripts that must not prompt:

```bash
pnpm dlx skills add ilancohen/lodestar-skills --skill '*' -y
```

## Update

From the consuming repository:

```bash
pnpm dlx github:ilancohen/lodestar-skills
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
