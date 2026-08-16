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
  Suite checks run on Windows under bash (CI: `ubuntu-latest`,
  `macos-latest`, and `windows-latest` with `shell: bash`) — not native
  PowerShell or cmd. Skill recipes are POSIX-first; a few places include
  PowerShell equivalents (for example `principles/fallow-seed.md` and
  `lodestar-fix` Step 3.7).
- [Fallow](https://docs.fallow.tools) **^3.15.0** (combined schema 10) in the
  target repository for `lodestar-audit`. Same major, at least 3.15.0. Install
  with that repo's package manager, e.g. `pnpm add -D fallow@^3.15.0` (or
  `npm install --save-dev` / `yarn add -D`).

## Install

Project scope is the default. The skills write project-specific configuration
and audit output.

Use whichever command matches tools you already have. All of these install
the suite into the current repository.

**Skills CLI** (works with any agent the [skills CLI](https://github.com/vercel-labs/skills) supports):

```bash
npx skills add ilancohen/lodestar-skills
# or:  pnpm dlx skills add ilancohen/lodestar-skills
# or:  yarn dlx skills add ilancohen/lodestar-skills
```

**Lodestar installer** (detects your agents, pre-selects them plus all four
skills; Enter accepts, space toggles):

```bash
npx github:ilancohen/lodestar-skills
# or:  pnpm dlx github:ilancohen/lodestar-skills
# or:  yarn dlx github:ilancohen/lodestar-skills
```

Prefer the package manager already used in the target repo. If none or more
than one lockfile is present, pick one — do not guess.

| Intent       | Example                                                          |
| ------------ | ---------------------------------------------------------------- |
| One agent    | `npx skills add ilancohen/lodestar-skills --skill '*' -a cursor` |
| Skip prompts | `npx skills add ilancohen/lodestar-skills --skill '*' -y`        |
| From a clone | `node scripts/install.mjs` (or `-y` / `-a cursor`)               |

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
- Claude Code — `.claude-plugin/plugin.json` (discovers root `skills/` by
  convention)
- Codex — `.codex-plugin/plugin.json` declares `"skills": "./skills/"`
- Gemini CLI — `gemini-extension.json` (discovers root `skills/` by
  convention, same as Claude Code)

Adapters do not copy skill logic. Convention-based clients rely on the
root `skills/` layout holding the four canonical skills.

## Use

Skills load **only when you invoke them by name**. They do not auto-activate
from related conversation. Syntax varies by client: `/lodestar-setup`,
`$lodestar-setup`, or picking the skill in the client's skills UI.

Run the workflow in this order:

1. Invoke `lodestar-setup` once in the target repository.
2. Invoke `lodestar-audit` to produce `docs/audit/<run-id>/`.
3. Review the generated index and decisions.
4. Invoke `lodestar-fix` only when you want source changes.
5. Invoke `lodestar-architecture` separately when the package layout itself
   needs review.

## Development

Read [AGENTS.md](AGENTS.md) and
[CONTRIBUTING.md](CONTRIBUTING.md) before changing the suite. Run:

```bash
pnpm check
pnpm test
pnpm dlx skills add . --list
```

## Status

Initial standalone extraction: `0.1.0`. First published release: `0.2.0`.

Trigger phrases and expected outcomes live in [`docs/evals.md`](docs/evals.md)
as a manual checklist.

## License

MIT. See [LICENSE](LICENSE).
