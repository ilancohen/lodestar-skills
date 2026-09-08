# Upgrading

Default to **project scope**. These skills write repository-specific config
and `docs/audit/` output.

## Install

```bash
npx skills add ilancohen/lodestar-skills
```

Enter accepts detected agents and all seven skills. That is the normal
install path. Partial installs are supported when they include
`lodestar-setup` as the base. Omit `lodestar-docs` if you do not want
docs hygiene. Fallow is prepared only when `lodestar-audit` is in the
selection.

Per-agent example:

```bash
npx skills add ilancohen/lodestar-skills --skill '*' -a cursor
```

Scripts that must not prompt:

```bash
npx skills add ilancohen/lodestar-skills --skill '*' -y
```

## Upgrading past 0.17.0 — suite evaluation followups

Pre-1.0 format breaks from the 2026-09-07 evaluation plan. No version
bump ships with these notes alone — re-install skills, then re-run setup
when context shape changed.

### Removed `## Resolved Decisions`

That section is ignored. `validate-input` derives detector gates in
memory. The next `lodestar-setup` re-run deletes a leftover section.

### Optional `## Dependency Policy`

Observed import graphs are not policy. Setup writes `## Dependency Policy`
only when you state intended import order. Legacy `## Dependency Direction`
is ignored and deleted on the next setup. Without policy, audit still
detects cycles but gates wrong-direction (`imports` #6).

### Changed-scope audits

A `changed-since` audit scans only changed files under scannable
packages. `INDEX.md` states what was not scanned — it does not invent an
exact whole-repo backlog count.

### Compact action items

Audit writes single-concern contracts (evidence, files, change, decision,
scope exceptions, acceptance) without ready-made executor prompts.
`lodestar-fix` applies resident generic rules plus item overrides.
Multi-stage redesign belongs in `lodestar-plan`.

### Commit consent

Git commits and history rewrites always need explicit consent (`ask` /
`per-item` / `never`). Fix and implement never auto-rebase or
`--no-verify`.

### Partial installs

Supported when the selection includes `lodestar-setup` plus the chosen
workflow pair or standalone advisory skill. Recommended pairs:
`audit`+`fix`, `plan`+`implement`. Architecture and docs may stand alone
with setup.

### Audit-gated Fallow; no degraded mode

Setup installs/configures Fallow only when `lodestar-audit` is among the
installed siblings. Audit requires a declared, local, compatible Fallow.
`fallow: optional`, ephemeral Fallow, and grep-only degraded audit modes
are removed — missing Fallow is a hard stop with the install remedy.

### Plans ledger removed

Plan state is the filesystem: pending under the plans root, completed in
`done/`, abandoned in `abandoned/`. There is no machine-parsed ledger and
no docs-only housekeeping commit for `move-done` (folded into the final
code commit when safe).

### Principles path

Principles resolve from the installed `lodestar-setup` skill (beside
`SKILL.md`) on every adapter shape — not a fixed
`.agents/skills/lodestar-setup/principles.md` path.

### Chat milestones

Long runs print concise milestones (opening, current stage/category,
boundary counts, closing artifacts). Fallow/probes stream stderr with
sparse heartbeats and bounded timeouts. No persistent diagnostic run
logs.

## Upgrading past 0.17.0 — Dependency Policy + portable principles

`## Dependency Direction` (observed import graph) is retired as recorded
policy. Setup writes optional `## Dependency Policy` only when the user
states intended import order. Legacy `## Dependency Direction` is
ignored by `parseDirection` (same treatment as a stale
`## Resolved Decisions` section); the next setup re-run deletes it.
Without policy, audit still detects cycles but gates wrong-direction
(`imports` #6).

Principles resolve from the installed `lodestar-setup` skill (beside
`SKILL.md`), not a fixed `.agents/skills/lodestar-setup/principles.md`
path. `## Review Rubric` lists repo-owned extras only.

Partial installs that include setup are supported. Fallow install and
configuration run only when audit is among the installed siblings.
Setup no longer asks a post-write confirm question.

## Upgrading past 0.17.0 — Resolved Decisions retired

0.17.0 briefly required a persisted `## Resolved Decisions` section.
That requirement is retired: `validate-input` derives detector gates and
blind spots in memory from Conventions, Package Layout, Dependency
Policy (when present), and the linter cell. An existing `## Resolved Decisions`
section is ignored. The next `lodestar-setup` re-run deletes it. No
forced repository migration.

## Upgrading to 0.9.0 — re-run setup

0.9.0 collapses `.agents/lodestar/context.md` from 12 sections to 7.
There is no migration. A file written by `0.5.0`–`0.8.x` fails the
parser and names the remedy: re-run `lodestar-setup` to regenerate it.

What moved:

- `## Audit Settings`, `## Audit Scope`, `## Git`, and
  `## Excluded Paths` → one `## Audit Configuration` key/value table,
  with globs under nested `### Excluded Paths`
- `## Principles`, `## Skills`, and `## Audit Output` → one closing
  `## Reference` section

Hand-edited values in those four audit sections belong on the matching
keys of `## Audit Configuration` after setup rewrites the file.

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
