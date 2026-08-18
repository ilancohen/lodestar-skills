<!--
Template for `.fallowrc.json` — the optional config file that lets the
audit's fallow seed (see lodestar-audit/categories/fallow-seed.md)
detect cross-package boundary violations.

Read by `lodestar-setup` Step 7 only when the user opts in
to fallow integration. The setup skill substitutes the placeholders below
from the `.agents/lodestar/context.md` `## Package Layout` table and the
observed import graph in `## Dependency Direction`.

Do not check this template's literal `<placeholder>` form into a user
project — the setup skill must always substitute before writing.
-->

```jsonc
{
  "$schema": "./node_modules/fallow/schema.json",

  // Boundaries derived from `.agents/lodestar/context.md`
  // `## Package Layout` and the observed import graph declared above it.
  //
  // One zone per package row, using the repo's own package name (no role
  // mapping). `patterns` use the literal path glob from the table — no
  // `root` rewriting, so the file is hand-readable.
  //
  // Rules: each zone may import from itself plus every zone reachable from
  // it in the documented graph (acyclic chain: everything to its right;
  // cyclic: cycle partners list each other). The tail-of-chain package with
  // no downward edges gets `allow: []` unless it has cycle partners.
  "boundaries": {
    "zones": [
      // EXAMPLE — one entry per row in the context.md Package Layout table.
      // For rows using a glob like `apps/*/src`, prefer `autoDiscover`
      // (see fallow docs) so each app becomes its own sub-zone.
      { "name": "<package_name>", "patterns": ["<path_glob>"] },
    ],
    "rules": [
      // EXAMPLE — substitute one entry per package.
      {
        "from": "<package_name>",
        "allow": ["<package_to_right_1>", "<package_to_right_2>"],
      },
    ],
  },

  // Severities. Boundary violations and circular dependencies are the two
  // findings the audit consumes; keep them at error so a CI gate (if any)
  // catches them. Other issue types are reported by `fallow dead-code` but
  // not consumed by the audit — leaving them at default `warn` is fine.
  "rules": {
    "boundary-violation": "error",
    "circular-dependencies": "error",
  },
}
```

## Worked example — `web → server → core → shared`

For a `context.md` that declares the four-package chain
`web → server → core → shared` with these path globs:

| Package  | Path glob             |
| -------- | --------------------- |
| `web`    | `apps/web/src`        |
| `server` | `packages/server/src` |
| `core`   | `packages/core/src`   |
| `shared` | `packages/shared/src` |

The setup skill writes:

```jsonc
{
  "$schema": "./node_modules/fallow/schema.json",
  "boundaries": {
    "zones": [
      { "name": "web", "patterns": ["apps/web/src/**"] },
      { "name": "server", "patterns": ["packages/server/src/**"] },
      { "name": "core", "patterns": ["packages/core/src/**"] },
      { "name": "shared", "patterns": ["packages/shared/src/**"] },
    ],
    "rules": [
      { "from": "web", "allow": ["server", "core", "shared"] },
      { "from": "server", "allow": ["core", "shared"] },
      { "from": "core", "allow": ["shared"] },
      { "from": "shared", "allow": [] },
    ],
  },
  "rules": {
    "boundary-violation": "error",
    "circular-dependencies": "error",
  },
}
```

Multi-app globs (e.g. `apps/*/src`) become a single zone with
`autoDiscover` instead of literal `patterns`:

```jsonc
{ "name": "apps", "autoDiscover": ["apps"] }
```

This makes each app a sibling sub-zone, isolated from the others — usually
what you want when several apps share lower-level packages but should not
import from each other.

## Worked example — cyclic `core` ↔ `api`

For a `context.md` that records a cyclic graph between `core` and `api`:

| Package | Path glob             |
| ------- | --------------------- |
| `core`  | `packages/core/src`   |
| `api`   | `packages/api/src`    |

Observed edges (both marked `[cycle]`):

- `core → api`
- `api → core`

The setup skill writes:

```jsonc
{
  "$schema": "./node_modules/fallow/schema.json",
  "boundaries": {
    "zones": [
      { "name": "core", "patterns": ["packages/core/src/**"] },
      { "name": "api", "patterns": ["packages/api/src/**"] },
    ],
    "rules": [
      { "from": "core", "allow": ["api"] },
      { "from": "api", "allow": ["core"] },
    ],
  },
  "rules": {
    "boundary-violation": "error",
    "circular-dependencies": "error",
  },
}
```

`boundary-violation` stays quiet for the documented cycle edges while
`circular-dependencies` still reports the cycle. Both severities remain
`error`.

## Verifying the file

After writing, run:

```bash
# Absolute path to the installed lodestar-audit skill script; --root/--out are
# the target repository.
node <lodestar-audit-skill>/scripts/fallow-contract.mjs run \
  --root <repo> \
  --id list-boundaries \
  --out <repo>/.audit-fallow-boundaries.json
```

Parse only a `kind: "list-boundaries"` envelope. Every zone must report
`file_count > 0`. A contract failure or a zero-file zone means the
path glob in the Package Layout table doesn't match the on-disk layout —
fix the table and re-run setup. Delete the temp JSON after reading it.
