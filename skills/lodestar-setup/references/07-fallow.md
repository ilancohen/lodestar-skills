# Step 7 — Fallow and `.fallowrc.json` for the audit's fallow seed

The audit skill **requires** [fallow](https://docs.fallow.tools) as the
primary graph-based detector for `imports`, `dry`, and `soc-yagni`
unless `## Audit Configuration` records `fallow: optional`. Configured, it
also supplies wrong-direction findings. Without `.fallowrc.json`,
boundaries fall back to a heuristic grep.

### Resolve fallow, and offer to install it

1. Prefer the project copy, then `PATH`, via
   `lodestar-audit/scripts/fallow-contract.mjs`:
   ```bash
   node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>
   ```
   ```powershell
   node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>
   ```
   In-range binary → **never install over it**; go to `.fallowrc.json`.
2. Missing or out of range: offer to install. `resolve-bin` already
   ends in `Install a compatible version with: <command>` — quote that
   command (SSOT for pin and manager syntax). Ambiguous lockfile lists
   three managers; use Step 2's answer, or ask. Settle location (item 3)
   first; that final command is what you run, prompt, and print on "no".

   Nothing resolved:

   > The audit needs a tool called fallow to see how your files import
   > each other. It isn't installed here. Shall I add it as a dev
   > dependency? I'd run `<command>`.
   > (yes / no — I'll just show you the command and move on)

   Out of range — name the version (this changes a pin others may use):

   > This repo has fallow `<found version>`, but the audit needs a newer
   > one. Shall I upgrade it with `<command>`? Note this changes the
   > version for everyone on the project.
   > (yes / no — I'll just show you the command and move on)

3. Multi-package: ask root vs named package. Root: `pnpm add -D -w` /
   `npm install --save-dev` / `yarn add -D` / `bun add -d`. Package:
   `pnpm --filter <name> add -D` / `npm install --save-dev --workspace
<name>` / `yarn workspace <name> add -D` / `bun add -d --cwd <package>`.
   Recommend root. Bun lands in `node_modules` like npm. Do not proceed
   without an answer.
4. On "yes", run that command, re-run `resolve-bin`, name the version.
   Still missing or out of range = failed install. `resolve-bin` sees
   `<root>/node_modules/.bin` then `PATH`, not a package-local bin. If
   root is empty, retry `--root` at the package; if it resolves there,
   say the audit won't see it from the repo root — move it to root or
   `PATH`. Do not tell them to point the audit `--root` at the package.
5. On "no" or failed install: print the command, say `lodestar-audit`
   refuses until a compatible fallow is present (`fallow: required`,
   the default this step writes), and carry on — `.fallowrc.json` is
   still asked. Network/platform misses are not setup failures.

### Write `.fallowrc.json`

Ask this whether or not fallow ended up installed — the config is useful
the moment it is:

> Shall I write a `.fallowrc.json` file describing which package is
> allowed to import which? With it, the audit can tell for certain when an
> import goes the wrong way. Without it, it has to guess by searching
> text. (yes / no)

If fallow is not installed, say the file will sit ready until it is.

If `.fallowrc.json` already exists, say so and ask whether to add the
import-boundary part to it, leave the file alone, or replace it.

If the user opts in, write `.fallowrc.json` from `fallowrc.md` (JSON in a
fenced block). Substitute:

- One `boundaries.zones[]` per **scannable** row (`Scannable: no` has no
  zone). `name` = package name; `patterns` = the table glob (`<path>/**`
  if bare). `apps/*/src` → `"autoDiscover": ["apps"]`.
- One `boundaries.rules[]` per scannable package. `allow` = every
  package reachable from `from` (including cycle partners); acyclic
  chain → everything to the right; tail gets `allow: []`.
- `ignorePatterns`: one per `### Excluded Paths` glob. Skip Fallow
  built-ins. `dupes`/`health` honor it; `extends` replaces arrays.

Write to `.fallowrc.json`. Then ask:

> The audit leaves behind two throwaway things — a `.audit-fallow-seed.json`
> file and a `.fallow/` folder — that shouldn't be committed. Add them to
> `.gitignore`? (yes / no)

If yes and `.gitignore` exists and does not already cover them, add
both. If they decline, still write `.fallowrc.json` and say gitignore
was skipped.

`.agents/lodestar/fallow-compat.json` is a team-committed audit artifact
— never gitignore it.

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
