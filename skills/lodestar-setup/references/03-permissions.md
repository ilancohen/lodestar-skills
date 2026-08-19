# Step 3 — Permissions for writes outside `.agents/`

Everything you show the user here is read by a person, not a machine.
Follow `SKILL.md`'s "How to talk to the user": point first, bullets not
paragraphs, blank line between blocks, bold lead-ins, no jargon they did
not use first. Keep config keys (`ENFORCEMENT_MODE`, …) off this screen.

Present **one tick list**. Do not split this across turns. One round of
feedback. Later steps honor these ticks and ask nothing.

Before the list, gather what the rows need — do not load another step
reference:

- Run `resolve-bin` (same command the fallow procedure will re-run):
  `node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>`.
  In-range **and** declared in `package.json` **and** present under
  `node_modules/.bin` → omit the install row. Missing declaration,
  missing binary, or out of range → the trailing
  `Install a compatible version with: <command>` is the pin SSOT. Compose
  the command shown on the row from that pin plus the install location:
  default **repo root** (`pnpm add -D -w` /
  `npm install --save-dev` / `yarn add -D` / `bun add -d`). If the user
  names a package, rebuild with `pnpm --filter <name> add -D` /
  `npm install --save-dev --workspace <name>` /
  `yarn workspace <name> add -D` / `bun add -d --cwd <package>`. Use the
  package manager from Step 1. That composed command is what the fallow
  procedure runs when adding the dependency. When `fallow` is declared but
  `node_modules/.bin/fallow` is missing, the row also names the plain
  install command (`pnpm install`, …).
- Check whether `.fallowrc.json` exists (changes the write-row verb).
- Check whether `.gitignore` already covers `.audit-fallow-seed.json`
  and `.fallow/` (omit that row when both are covered).
- Detect the repo's linter from existing config and dependencies (omit
  the linter row when none is configured).
- Pre-0.3 `AGENTS.md` sections come from Step 1 (omit that row when
  none were found).

Omit a row that cannot apply: fallow already declared, installed in
`node_modules/.bin`, and in range (never install over it); no linter
configured; no pre-0.3 lodestar sections in
`AGENTS.md`; `.gitignore` already covering both entries.

Pre-tick per the defaults below. Unticked means skip that write.

> These writes go outside `.agents/`. Ticked ones run; untick anything
> you don't want. One round.

- [x] **Install fallow** with `<command>`. Declares `fallow` in
      `package.json` devDependencies (or upgrades the pin), runs install
      when needed, and downloads from npm. **The audit will not run without
      it declared and present in `node_modules/.bin`.** Multi-package:
      install at **the repo root** (say a package name to put it there
      instead).
      Omit this row when fallow is already declared, resolves in
      `node_modules/.bin`, and is in range. Out of range: same row, verb
      **upgrade**, name the installed version, and note that this changes
      the pin for everyone on the project. When declared but the binary
      is missing, also print `<install command>` (`pnpm install`, …).
- [x] **Write `.fallowrc.json`** describing which package may import
      which. If the file already exists, the verb is **merge the
      import-boundary section into your existing `.fallowrc.json`**;
      name **replace** as the alternative (user can say "replace"
      instead of merge). Unticked leaves the existing file alone.
- [x] **Add** `.audit-fallow-seed.json` and `.fallow/` to `.gitignore`.
      Omit when both entries are already covered.
- [ ] **Add a `## Lodestar` section to `AGENTS.md`** so any agent, on
      every task, checks the principles before it finishes. Unticked
      leaves `AGENTS.md` alone.
- [ ] **Tighten** the existing `<linter>` rules so the audit can report
      certain problems as definite rather than probable. Nothing new
      gets installed. Omit when no linter is configured.
- [ ] **Remove** these pre-0.3 lodestar sections from `AGENTS.md`:
      `<list them>`. Everything else in the file stays. Omit when none
      were found.

Record the ticks. Default `ENFORCEMENT_MODE` stays `skills-only` unless
the `AGENTS.md` row is ticked.

If fallow install is declined or later fails, print the command, say
the audit will not run without it, and carry on — that is not a setup
failure. `.fallowrc.json` still follows its own tick.
