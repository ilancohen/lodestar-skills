<h1>
    <img src="assets/logo.svg" alt="" width="40" height="40" style="position: relative" />
    <span style="display: inline-block; translate: 0 -0.25em;">Lodestar</span>
</h1>

Four skills that document your codebase's architecture, find where it breaks
the rules, and fix those spots — with your say-so at every step.

- **`lodestar-setup`** — writes down how your repo is built: commands,
  packages, and the rules to follow. It all goes in one file,
  `.agents/lodestar/context.md`, which is the only file the other three
  skills read.
- **`lodestar-audit`** — scans for rule-breaking and writes up each one as a
  standalone action item. Doesn't touch your code. Its `check-freshness`
  command also answers whether `context.md` still matches the repo,
  without running an audit or re-running setup.
- **`lodestar-fix`** — applies those action items, one scoped change at a
  time, checking its work as it goes.
- **`lodestar-architecture`** — a second opinion on the package layout
  itself. Advisory only, never edits code.

Run them in that order. `lodestar-setup` first, always.

## The rules it checks for

Full definitions: [`skills/lodestar-setup/principles.md`](skills/lodestar-setup/principles.md).

- [Separation of Concerns](skills/lodestar-setup/principles.md#separation-of-concerns-soc) — one reason to change per module
- [DRY](skills/lodestar-setup/principles.md#dry) — extract on the second occurrence
- [Single Source of Truth](skills/lodestar-setup/principles.md#single-source-of-truth-ssot) — each fact has one home
- [YAGNI](skills/lodestar-setup/principles.md#yagni) — only what the current task needs
- [CQS](skills/lodestar-setup/principles.md#cqs-command-query-separation) — query or command, never both
- [Tell Don't Ask](skills/lodestar-setup/principles.md#tell-dont-ask) — push behavior toward the data
- [Parse Don't Validate](skills/lodestar-setup/principles.md#parse-dont-validate) — brand at the boundary, trust inside
- [Rule of Three](skills/lodestar-setup/principles.md#rule-of-three) — abstract only at the third use
- [Prefer Proven Libraries](skills/lodestar-setup/principles.md#prefer-proven-libraries-avoid-nih) — don't reimplement solved problems
- [Ubiquitous Language](skills/lodestar-setup/principles.md#ubiquitous-language) — one term, one concept

## Will this fight my codebase?

Defaults are opinionated. Five of them are negotiable at setup — one
multi-select, pre-checked from what the repo already does, written into
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
  `lodestar-audit`. `lodestar-setup` offers to install it for you (it asks
  first, and asks where in a monorepo), or add it yourself with
  `pnpm add -D fallow@^3.15.0` or the npm/yarn equivalent.

## Install

```bash
npx skills add ilancohen/lodestar-skills
```

That's the normal path — it detects your agent, pre-selects all four skills,
Enter to confirm. A few more ways to run it:

Adopting this in a large, long-lived repo does not have to open with a
thousand action items. Setup can scope the audit to code changed since
today's commit and keep the rest as a counted backlog in `INDEX.md`. A
`context.md` with no `## Audit Scope` section still expands every
finding.

| Want to...           | Run                                                                           |
| -------------------- | ----------------------------------------------------------------------------- |
| Pick one agent       | `npx skills add ilancohen/lodestar-skills --skill '*' -a cursor -a universal` |
| Skip the prompts     | `npx skills add ilancohen/lodestar-skills --skill '*' -y`                     |
| Install from a clone | `node scripts/install.mjs` (same `-y` / `-a cursor` flags)                    |

Agent ids: `cursor`, `claude-code`, `codex`, `gemini-cli`, `github-copilot`,
`kiro-cli` — see the [skills CLI's supported agents](https://github.com/vercel-labs/skills#supported-agents)
for the full list.

Every install (via `node scripts/install.mjs` or the plain `npx skills add`
command above) always also requests the CLI's `universal` pseudo-agent, so a
real copy of each skill — `principles.md` included — lands at the fixed path
`.agents/skills/<skill-name>/`, no matter which client agent(s) you picked.
`lodestar-setup` points `.agents/lodestar/context.md` at that fixed path. If
you hand-craft an `-a` list yourself, add `-a universal` too, or
`lodestar-setup`'s reference to `principles.md` may not resolve.

Don't want the CLI? Each agent also has a native plugin:

- Cursor — `plugin.json`
- Claude Code — `.claude-plugin/plugin.json`
- Codex — `.codex-plugin/plugin.json`
- Gemini CLI — `gemini-extension.json`

Updating, pinning a version, or rolling back? See [UPGRADING.md](UPGRADING.md).

## Using it

Skills don't activate on their own — you have to invoke them by name
(`/lodestar-setup`, `$lodestar-setup`, or however your agent's UI picks skills).

1. Run `lodestar-setup` once, in the target repo. It writes
   `.agents/lodestar/context.md` — your package layout, dependency
   direction, build commands, exclusions, conventions, audit scope, and
   commit policy — which is the only file the other skills read. It also asks whether
   principles should apply to every task automatically (full suite: a
   short pointer section is added to `AGENTS.md`) or only when you
   explicitly run a lodestar skill (skills-only: `AGENTS.md` is left
   alone). Either way it documents your layout and configures Fallow.
2. Run `lodestar-audit`. It writes to `docs/audit/<run-id>/` unless
   `## Audit Settings` names a different `output-root`.
3. Read the index it produces and decide what to act on.
4. Run `lodestar-fix` when you want it to actually change code.
5. Run `lodestar-architecture` separately, only if the package layout itself
   feels wrong.

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
