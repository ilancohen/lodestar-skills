# Lodestar

A portable suite of four Agent Skills for documenting, auditing, reviewing,
and improving software architecture:

- `lodestar-setup` — document a repository's commands, package responsibilities,
  dependency direction, and engineering principles.
- `lodestar-audit` — discover principle violations and write self-contained action
  items without modifying application source.
- `lodestar-fix` — triage and apply those action items with explicit scope and
  verification gates.
- `lodestar-architecture` — review the package layout itself and optionally
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
  target repository for `lodestar-audit`. Pin with that repo's package manager,
  e.g. `pnpm add -D fallow@3.15.0` (or `npm install --save-dev` /
  `yarn add -D`).

## Install

Project scope is the default. The skills write project-specific configuration
and audit output.

The installer detects which coding agents you use, pre-selects them plus all
four skills, and installs. Enter accepts those defaults; space toggles.

```bash
pnpm dlx github:ilancohen/lodestar-skills
```

npm: `npx github:ilancohen/lodestar-skills`. Yarn:
`yarn dlx github:ilancohen/lodestar-skills`. Use the
target repository's package manager; ask if more than one lockfile is
present, or none is.

From this directory during development:

```bash
node scripts/install.mjs
```

| Intent       | Command                                                                      |
| ------------ | ---------------------------------------------------------------------------- |
| Skip prompts | `node scripts/install.mjs -y`                                                |
| One agent    | `node scripts/install.mjs -a cursor`                                         |
| Scripts / CI | `pnpm dlx skills add ilancohen/lodestar-skills --skill '*' -y` |

Agent ids: `cursor`, `claude-code`, `codex`, `gemini-cli`, `github-copilot`,
`kiro-cli`. See the
[skills CLI supported agents](https://github.com/vercel-labs/skills#supported-agents)
for the full list.

See [UPGRADING.md](UPGRADING.md) for updates, version pinning, and rollback.

Copying or symlinking `skills/` by hand is a legacy path, not the normal
install method.

### Native plugins

Prefer a native plugin only when you do not want the skills CLI:

- Cursor — `plugin.json` (Agent Plugins 1.0)
- Claude Code — `.claude-plugin/plugin.json`
- Codex — `.codex-plugin/plugin.json`
- Gemini CLI — `gemini-extension.json`

All adapters load the same canonical `skills/` directories. They do not copy
skill logic.

## Use

Run the workflow in this order:

1. Invoke `lodestar-setup` once in the target repository.
2. Invoke `lodestar-audit` to produce `docs/audit/<run-id>/`.
3. Review the generated index and decisions.
4. Invoke `lodestar-fix` only when you want source changes.
5. Invoke `lodestar-architecture` separately when the package layout itself
   needs review.

Invocation syntax varies by client: `/lodestar-setup`, `$lodestar-setup`, or selecting the
skill from the client's skills UI.

## Development

Read [AGENTS.md](AGENTS.md) and
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

## Status

Initial standalone extraction: `0.1.0`.

The skills have extensive real-world use in their source repository.
Trigger phrases and expected outcomes live in [`docs/evals.md`](docs/evals.md)
as a manual checklist.

## License

MIT. See [LICENSE](LICENSE).
