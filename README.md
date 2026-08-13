# Engineering Principles Skills

A portable suite of four Agent Skills for documenting, auditing, reviewing,
and improving software architecture:

- `ep-setup` — document a repository's commands, package responsibilities,
  dependency direction, and engineering principles.
- `ep-audit` — discover principle violations and write self-contained action
  items without modifying application source.
- `ep-fix` — triage and apply those action items with explicit scope and
  verification gates.
- `ep-review-architecture` — review the package layout itself and optionally
  propose alternatives.

## Requirements

- A skills-compatible coding agent.
- Git.
- Node.js 22 or later for package checks and bundled skill scripts.
- pnpm 11 for this suite's own commands. Target repositories may use
  pnpm, npm, or yarn — skills detect the lockfile and ask if it is
  unclear.
- A POSIX-compatible shell for remaining skill command recipes.
  PowerShell equivalents exist for suite validation scripts; skills do
  not claim Windows support until the CI matrix is green.
- [Fallow](https://docs.fallow.tools) **3.15.0** (combined schema 10) in the
  target repository for `ep-audit`. Pin with that repo's package manager,
  e.g. `pnpm add -D fallow@3.15.0` (or `npm install --save-dev` /
  `yarn add -D`).

## Install

Project scope is the default. The skills write project-specific configuration
and audit output.

The [skills CLI](https://github.com/vercel-labs/skills) discovers this suite,
detects the coding agents you have installed, and prompts for which to
install to. Omit `-a` so detection is the default selection.

```bash
pnpm dlx skills add ilancohen/engineering-principles-skills
```

npm: `npx skills add …`. Yarn: `yarn dlx skills add …`. Use the
target repository's package manager; ask if more than one lockfile is
present, or none is.

From this directory during development:

```bash
pnpm dlx skills add .
```

| Intent | Command |
| --- | --- |
| Full suite, skip skill picker | `pnpm dlx skills add ilancohen/engineering-principles-skills --skill '*'` |
| One agent | `pnpm dlx skills add ilancohen/engineering-principles-skills --skill '*' -a cursor` |
| Several agents | `pnpm dlx skills add ilancohen/engineering-principles-skills --skill '*' -a cursor -a claude-code` |
| Non-interactive (CI / scripts) | same plus `-y` (and `--copy` when a smoke test needs copies) |

Agent ids for clients this suite ships adapters for: `cursor`, `claude-code`,
`codex`, `gemini-cli`, `github-copilot`, `kiro-cli`. See the
[skills CLI supported agents](https://github.com/vercel-labs/skills#supported-agents)
for the full list.

See [UPGRADING.md](UPGRADING.md) for updates, version pinning, rollback, and
migration of legacy copied skills.

Copying or symlinking `skills/` by hand is a legacy path, not the normal
install method.

### Native plugins

Prefer a native plugin only when you do not want the skills CLI:

- Cursor — `plugin.json` (Agent Plugins 1.0)
- Claude Code — `.claude-plugin/plugin.json`
- Codex — `.codex-plugin/plugin.json`
- Gemini CLI — `gemini-extension.json`
- Kiro — `.kiro/steering/` for `ep-setup`, `ep-audit`, and
  `ep-review-architecture` (manual). `ep-fix` is **not** shipped there:
  Kiro CLI loads all steering files and ignores inclusion modes (see
  `.kiro/steering/README.md`).

All adapters load the same canonical `skills/` directories. They do not copy
skill logic.

## Use

Run the workflow in this order:

1. Invoke `ep-setup` once in the target repository.
2. Invoke `ep-audit` to produce `docs/audit/<run-id>/`.
3. Review the generated index and decisions.
4. Invoke `ep-fix` only when you want source changes.
5. Invoke `ep-review-architecture` separately when the package layout itself
   needs review.

Invocation syntax varies by client: `/ep-setup`, `$ep-setup`, or selecting the
skill from the client's skills UI.

## Development

Read [ROADMAP.md](ROADMAP.md), [AGENTS.md](AGENTS.md), and
[CONTRIBUTING.md](CONTRIBUTING.md) before changing the suite. Run:

```bash
pnpm check
pnpm test
pnpm dlx skills add . --list
```

```powershell
pnpm check
pnpm test
pnpm dlx skills add . --list
```

Or `scripts/smoke.ps1`.

## Status

Initial standalone extraction: `0.1.0`.

The skills have extensive real-world use in their source repository. The
starter eval sets in each skill are scaffolding for repeatable cross-client
evaluation and have not yet been benchmarked.

## License

MIT. See [LICENSE](LICENSE).
