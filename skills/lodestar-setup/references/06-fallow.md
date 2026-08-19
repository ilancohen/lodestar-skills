# Fallow and `.fallowrc.json` for the audit's fallow seed

The audit skill **requires** [fallow](https://docs.fallow.tools) as the
primary graph-based detector for `imports`, `dry`, and `soc-yagni`
unless `## Audit Configuration` records `fallow: optional`. Configured, it
also supplies wrong-direction findings. Without `.fallowrc.json`,
boundaries fall back to a heuristic grep.

Honor the permissions-screen ticks. Ask nothing here.

### Resolve fallow, declare in package.json, and install only if ticked

1. Prefer the project copy in `node_modules/.bin` via
   `lodestar-audit/scripts/fallow-contract.mjs` — **not** a global
   `PATH` install:
   ```bash
   node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>
   ```
   ```powershell
   node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>
   ```
   Success means `fallow` is declared in root `package.json`
   (`devDependencies` or `dependencies`), the binary is under
   `node_modules/.bin`, and the version is in range — **never install
   over that**; go to `.fallowrc.json`.
2. Missing or out of range, and the install row was ticked:
   - Not declared → run **the add-dev command** from the permissions row.
   - Declared but binary missing → run the plain install command for the
     package manager (`pnpm install`, `npm install`, `yarn install`,
     `bun install`), then re-run `resolve-bin`.
   - Out of range → run the add-dev **upgrade** command from the row,
     then re-run `resolve-bin`.
     After a ticked add/upgrade, run install when `node_modules/.bin/fallow`
     is still missing. Re-run `resolve-bin` and name the version.
     Still missing, undeclared, or out of range = failed install.
     `resolve-bin` checks `<root>/node_modules/.bin` only — not `PATH`. If
     root is empty, retry `--root` at the package; if it resolves there,
     say the audit won't see it from the repo root — move the declaration
     and install to root or reinstall at root. Do not tell them to point
     the audit `--root` at the package.
3. If the install row was unticked or the install failed: print the
   add-dev command and, when applicable, the plain install command. Say
   `lodestar-audit` refuses until fallow is declared in `package.json`
   and present in `node_modules/.bin` (`fallow: required`, the default
   this step writes), and carry on. That is not a setup failure.
   Network/platform misses are not setup failures. `.fallowrc.json`
   still follows its own tick.

### Write `.fallowrc.json`

If the `.fallowrc.json` row was unticked, skip this section.

If fallow is not installed, the file still sits ready until it is.

If the file does not exist, or the user said **replace**: write
`.fallowrc.json` from `fallowrc.md` (JSON in a fenced block). Substitute
the fields below.

If the file exists and the tick is **merge** (the default): read the
existing JSON. Set `boundaries` and `ignorePatterns` from the
substitution below. Set `entry` when Step 1 recorded explicit Fallow
entry globs; otherwise leave an existing `entry` array untouched. Leave
every other key (`$schema`, `dupes`, `health`, `extends`, …) untouched.

Substitute:

- One `boundaries.zones[]` per **scannable** row (`Scannable: no` has no
  zone). `name` = package name; `patterns` = the table glob (`<path>/**`
  if bare). `apps/*/src` → `"autoDiscover": ["apps"]`.
- One `boundaries.rules[]` per scannable package. `allow` = every
  package reachable from `from` (including cycle partners); acyclic
  chain → everything to the right; tail gets `allow: []`.
- `ignorePatterns`: one per `### Excluded Paths` glob. Skip Fallow
  built-ins. `dupes`/`health` honor it; `extends` replaces arrays.
- `entry`: when Step 1 recorded explicit Fallow entry globs (typical for
  multi-app repos), write one project-root-relative glob per surface
  (`apps/a/index.html`, `apps/b/src/main.ts`, …). **Single-app repos**
  usually omit `entry` and rely on auto-discovery. On **replace**, omit
  `entry` when none were recorded.

Write to `.fallowrc.json`.

### `.gitignore`

If the gitignore row was ticked and `.gitignore` exists and does not
already cover them, add `.audit-fallow-seed.json` and `.fallow/`. If it
was unticked, still write `.fallowrc.json` when that row was ticked, and
say gitignore was skipped.

`.agents/lodestar/fallow-compat.json` is a team-committed audit artifact
— never gitignore it.

### Verify zones and entry points

After writing, verify when a compatible fallow resolved; if none
resolved, skip and say unverified.

**Boundaries** — every zone needs `file_count > 0`:

```bash
node <lodestar-audit-skill>/scripts/fallow-contract.mjs run \
  --root <repo> \
  --id list-boundaries \
  --out <repo>/.audit-fallow-boundaries.json
```

**Entry points** — Fallow must see at least one graph root
(`entry_point_count > 0`). Single-app repos usually pass without an
`entry` array. Multi-app repos: if Step 1 recorded `N` entry surfaces,
pass `--minimum N`; on failure add or fix the `entry` array in
`.fallowrc.json` and re-run:

```bash
node <lodestar-audit-skill>/scripts/fallow-contract.mjs run \
  --root <repo> \
  --id list-entry-points \
  --minimum <N-or-omit> \
  --out <repo>/.audit-fallow-entry-points.json
```

Fix layout globs or `entry` paths on failure. Delete both temp JSON files.
