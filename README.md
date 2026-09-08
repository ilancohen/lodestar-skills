<h1>
    <img src="assets/logo.svg" alt="" width="40" height="40" style="position: relative" />
    <span style="display: inline-block; translate: 0 -0.25em;">Lodestar</span>
</h1>

Six skills that document your codebase's architecture, find where it breaks
the rules, fix those spots, write plans for larger work, and execute those
plans — with your say-so at every step. An optional seventh prunes leftover
writeups those skills leave behind.

- **`lodestar-setup`** — writes down how your repo is built: commands,
  packages, documentation trees, and the rules to follow. It all goes in
  one file, `.agents/lodestar/context.md`, which is the only file the
  other skills read.
- **`lodestar-audit`** — scans for rule-breaking and writes up each one as a
  standalone action item. Doesn't touch your code. Its `check-freshness`
  command also answers whether `context.md` still matches the repo,
  without running an audit or re-running setup.
- **`lodestar-fix`** — applies those action items, one scoped change at a
  time, checking its work as it goes.
- **`lodestar-architecture`** — a second opinion on the package layout
  itself. Advisory only, never edits code.
- **`lodestar-plan`** — writes an implementable plan under `docs/plans/`
  (or the plans root recorded at setup), with a `rigor:` tier, after
  checking that named files and commands exist. Creates the root only
  when writing a valid plan. Does not implement. Runs without setup —
  it discovers what it needs.
- **`lodestar-implement`** — executes that plan one stage at a time at
  the declared `rigor:` tier, then moves it to `done/`. The filesystem
  is the index (pending / `done/` / `abandoned/`). Also runs without
  setup. The only other skill besides `lodestar-fix` that edits
  application source.
- **`lodestar-docs`** — optional. Harvests leftover knowledge from
  `staging` docs trees into `home` trees recorded at setup, then deletes
  what an agent would not miss. Never creates new docs homes. Never edits
  application source.

Run them in that order when you want the full loop. `lodestar-setup` is
the base skill — include it in every install. Recommended pairs:
`audit`+`fix`, `plan`+`implement`. Architecture and docs can stand alone
with setup. Architecture, docs, plan, and implement can discover what
they need when `context.md` is absent; audit and fix need setup (and
Fallow only when audit is installed).

## Quickstart

```bash
npx skills add ilancohen/lodestar-skills
```

Detects your agent, pre-selects all seven skills — press Enter to confirm. Then, in your repo:

1. `/lodestar-setup` — one deterministic collector pass (bounded chat
   projection), then one review and one write consent; writes
   `.agents/lodestar/context.md`.
2. `/lodestar-audit` — scans for violations, writes each one as a standalone action item.
3. `/lodestar-fix` — applies those action items, one scoped change at a time, with your sign-off.

That's the main loop. For larger work: `/lodestar-plan` writes a staged plan; `/lodestar-implement` executes it.

## The rules it checks for

Full definitions: [`skills/lodestar-setup/principles.md`](skills/lodestar-setup/principles.md).

- [Separation of Concerns](skills/lodestar-setup/principles.md#separation-of-concerns-soc) — one reason to change per module
- [DRY](skills/lodestar-setup/principles.md#dry) — identify at two; extract at three
- [Single Source of Truth](skills/lodestar-setup/principles.md#single-source-of-truth-ssot) — each fact has one home
- [YAGNI](skills/lodestar-setup/principles.md#yagni) — only what the current task needs
- [CQS](skills/lodestar-setup/principles.md#cqs-command-query-separation) — query or command, never both
- [Tell Don't Ask](skills/lodestar-setup/principles.md#tell-dont-ask) — push behavior toward the data
- [Parse Don't Validate](skills/lodestar-setup/principles.md#parse-dont-validate) — brand at the boundary, trust inside
- [Rule of Three](skills/lodestar-setup/principles.md#rule-of-three) — abstract at the third use (same threshold as DRY)
- [Prefer Proven Libraries](skills/lodestar-setup/principles.md#prefer-proven-libraries-avoid-nih) — don't reimplement solved problems
- [Ubiquitous Language](skills/lodestar-setup/principles.md#ubiquitous-language) — one term, one concept

## Will this fight my codebase?

Defaults are opinionated. Five of them are negotiable at setup — stated
on the review screen from what the repo already does, written into
`.agents/lodestar/context.md` `## Conventions`:

- expected failures as `Result<T, E>` (`result-types`)
- branded domain identifiers (`branded-types`)
- no `export *` barrels (`barrel-exports`)
- design tokens instead of raw hex/spacing (`design-tokens`)
- an 80% coverage floor (`coverage-floor`)

A `context.md` with no `## Conventions` section keeps every default.
Nothing else is opt-out: unguarded `any`, module-level side effects, CQS,
and the rest stay on.

Setup observes the repo rather than assuming `packages/` and `apps/`: it
records layout, entry points, generated-code exclusions, and how
`lodestar-fix` should commit.

## Before you install

- A coding agent that supports Agent Skills, plus Git.
- **Node.js 22+** — for package checks and the bundled scripts.
- **pnpm, npm, yarn, or Bun** in the target repo — skills detect it from
  the lockfile, and ask if that's unclear. Any other manager works when
  recorded in `.agents/lodestar/context.md`. Deno, Bazel, and repos with
  no TypeScript or JavaScript are not supported. (This suite itself is
  built with pnpm; that's unrelated to what your project uses.)
- A POSIX-ish shell (macOS, Linux, or Windows via bash/WSL — plain
  PowerShell/cmd isn't supported for most steps).
- [Fallow](https://docs.fallow.tools) **^3.15.0**, only if you'll run
  `lodestar-audit`. `lodestar-setup` offers to install it on the
  permissions screen (pre-ticked; a monorepo defaults to the repo root),
  or add it yourself with
  `pnpm add -D fallow@^3.15.0` or the npm/yarn equivalent.

## Install

```bash
npx skills add ilancohen/lodestar-skills
```

That's the normal path — it detects your agent, pre-selects all seven skills,
Enter to confirm. Partial installs are supported when they include
`lodestar-setup` as the base (recommended pairs: audit+fix,
plan+implement; architecture and docs may stand alone with setup). A
skill missing its base will say so and stop. A few more ways to run it:

Adopting this in a large, long-lived repo does not have to open with a
thousand action items. Setup can scope the audit to code changed since
today's commit; the audit scans those files only and states what was not
scanned — it does not invent an exact whole-repo backlog count. After
findings, you choose which slice gets fix instructions. A `context.md`
with no `mode` row in `## Audit Configuration` still scans every
scannable file.

| Want to...       | Run                                                                           |
| ---------------- | ----------------------------------------------------------------------------- |
| Pick one agent   | `npx skills add ilancohen/lodestar-skills --skill '*' -a cursor -a universal` |
| Skip the prompts | `npx skills add ilancohen/lodestar-skills --skill '*' -y`                     |
| Install a clone  | `npx skills add /path/to/lodestar-skills --skill '*' -y`                      |

Agent ids: `cursor`, `claude-code`, `codex`, `gemini-cli`, `github-copilot`,
`kiro-cli` — see the [skills CLI's supported agents](https://github.com/vercel-labs/skills#supported-agents)
for the full list.

Every install via `npx skills add` can also request the CLI's `universal`
pseudo-agent. Principles resolve from the installed `lodestar-setup`
skill directory (beside its `SKILL.md`) on native, per-agent, and
universal paths alike — `context.md` does not hardcode
`.agents/skills/lodestar-setup/principles.md`.

Don't want the CLI? Each agent also has a native plugin:

- Cursor — `plugin.json`
- Claude Code — `.claude-plugin/plugin.json`
- Codex — `.codex-plugin/plugin.json`
- Gemini CLI — `gemini-extension.json`

Updating, pinning a version, or rolling back? See [UPGRADING.md](UPGRADING.md).

## Using it

Skills don't activate on their own — invoke them by exact name
(`/lodestar-setup`, `$lodestar-setup`, or your agent's skills UI).

| Outcome                               | Skill                                            |
| ------------------------------------- | ------------------------------------------------ |
| Record how the repo is built          | `lodestar-setup` → `.agents/lodestar/context.md` |
| Find rule breaks as action items      | `lodestar-audit` → `docs/audit/<run>/`           |
| Apply those action items              | `lodestar-fix`                                   |
| Second opinion on package layout      | `lodestar-architecture`                          |
| Staged plan for larger work           | `lodestar-plan`                                  |
| Execute that plan stage by stage      | `lodestar-implement`                             |
| Harvest then delete leftover writeups | `lodestar-docs` (optional)                       |

Normal path: setup once → audit → fix. Use plan → implement for
multi-stage or cross-package work. Architecture and docs are advisory /
hygiene. Runs print concise milestones (opening scope, current
stage/category, counts at boundaries, final artifacts) — not verbose
logs.

1. `lodestar-setup` — one collector discovery, one review correction, and
   one write consent. Bounded stdout only (full state stays in OS temp).
   Fallow only when audit is installed. No post-write confirm.
2. `lodestar-audit` — scoped scan; expand only the slice you choose for
   fix instructions.
3. `lodestar-fix` — serial fixes; commits only with consent.
4. `lodestar-plan` / `lodestar-implement` — filesystem index (pending /
   `done/` / `abandoned/`); no ledger.
5. `lodestar-architecture` / `lodestar-docs` — when layout or leftover
   docs need attention.

Partial installs need `lodestar-setup` as the base. Recommended pairs:
`audit`+`fix`, `plan`+`implement`.

## Contributing

Read [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md) first.
Then:

```bash
pnpm check
pnpm test
pnpm dlx skills add . --list
```

## Status

`0.1.0` was the first standalone cut of this suite. `0.2.0` was the first
published release.

Manual test checklist: [`docs/evals.md`](docs/evals.md).

## License

MIT. See [LICENSE](LICENSE).
