# Fallow and `.fallowrc.json` for the audit's fallow seed

The audit skill **requires** [fallow](https://docs.fallow.tools) as the
primary graph-based detector for `imports`, `dry`, and `soc-yagni`
unless `## Audit Configuration` records `fallow: optional`. Configured, it
also supplies wrong-direction findings. Without `.fallowrc.json`,
boundaries fall back to a heuristic grep.

Honor the permissions-screen ticks. Ask nothing here.

### Resolve fallow, and install only if ticked

1. Prefer the project copy, then `PATH`, via
   `lodestar-audit/scripts/fallow-contract.mjs`:
   ```bash
   node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>
   ```
   ```powershell
   node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>
   ```
   In-range binary → **never install over it**; go to `.fallowrc.json`.
2. Missing or out of range, and the install row was ticked: run **the
   command shown on that row** — do not recompose it. After a ticked
   install, re-run `resolve-bin`, name the version.
   Still missing or out of range = failed install. `resolve-bin` sees
   `<root>/node_modules/.bin` then `PATH`, not a package-local bin. If
   root is empty, retry `--root` at the package; if it resolves there,
   say the audit won't see it from the repo root — move it to root or
   `PATH`.    Do not tell them to point the audit `--root` at the package.
3. If the install row was unticked or the install failed: print the
   command, say `lodestar-audit` refuses until a compatible fallow is
   present (`fallow: required`, the default this step writes), and
   carry on. That is not a setup failure. Network/platform misses are
   not setup failures. `.fallowrc.json` still follows its own tick.

### Write `.fallowrc.json`

If the `.fallowrc.json` row was unticked, skip this section.

If fallow is not installed, the file still sits ready until it is.

If the file does not exist, or the user said **replace**: write
`.fallowrc.json` from `fallowrc.md` (JSON in a fenced block). Substitute
the fields below.

If the file exists and the tick is **merge** (the default): read the
existing JSON. Set `boundaries` and `ignorePatterns` from the
substitution below. Leave every other key (`$schema`, `dupes`, `health`,
`extends`, …) untouched.

Substitute:

- One `boundaries.zones[]` per **scannable** row (`Scannable: no` has no
  zone). `name` = package name; `patterns` = the table glob (`<path>/**`
  if bare). `apps/*/src` → `"autoDiscover": ["apps"]`.
- One `boundaries.rules[]` per scannable package. `allow` = every
  package reachable from `from` (including cycle partners); acyclic
  chain → everything to the right; tail gets `allow: []`.
- `ignorePatterns`: one per `### Excluded Paths` glob. Skip Fallow
  built-ins. `dupes`/`health` honor it; `extends` replaces arrays.

Write to `.fallowrc.json`.

### `.gitignore`

If the gitignore row was ticked and `.gitignore` exists and does not
already cover them, add `.audit-fallow-seed.json` and `.fallow/`. If it
was unticked, still write `.fallowrc.json` when that row was ticked, and
say gitignore was skipped.

`.agents/lodestar/fallow-compat.json` is a team-committed audit artifact
— never gitignore it.

### Verify zones

After writing, verify zones when a compatible fallow resolved; if none
resolved, skip and say unverified. Else run this from the **absolute
path** of the installed `lodestar-audit/scripts/fallow-contract.mjs`:

```bash
node <lodestar-audit-skill>/scripts/fallow-contract.mjs run \
  --root <repo> \
  --id list-boundaries \
  --out <repo>/.audit-fallow-boundaries.json
```

Every zone needs `file_count > 0`. Fix the config or layout glob on
failure. Delete the temp JSON.
