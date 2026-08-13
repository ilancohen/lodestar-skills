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
- A POSIX-compatible shell for remaining skill command recipes.
  PowerShell equivalents exist for suite validation scripts; skills do
  not claim Windows support until the CI matrix is green.
- [Fallow](https://docs.fallow.tools) **3.10.0–3.14.0** (schema 7) in the
  target repository for `ep-audit`. Pin with
  `npm install --save-dev fallow@3.14.0`. Fallow 3.15+ emits schema 10 and
  is outside the tested contract.

## Install

Project scope is the default. The skills write project-specific configuration
and audit output.

```bash
npx skills add ilancohen/engineering-principles-skills \
  --skill ep-setup ep-audit ep-fix ep-review-architecture
```

From this directory during development:

```bash
npx skills add . --skill ep-setup ep-audit ep-fix ep-review-architecture
```

See [UPGRADING.md](UPGRADING.md) for updates, version pinning, rollback, and
migration of legacy copied skills.

Copying or symlinking `skills/` by hand is a legacy path, not the normal
install method.

### Product packages

This repository also contains:

- `plugin.json` — Agent Plugins 1.0 manifest, currently supported by Cursor.
- `.claude-plugin/plugin.json` — Claude Code plugin adapter.
- `.codex-plugin/plugin.json` — Codex plugin adapter.
- `gemini-extension.json` — Gemini CLI extension adapter.
- `.kiro/steering/` — Kiro manual steering for `ep-setup`, `ep-audit`, and
  `ep-review-architecture`. `ep-fix` is **not** shipped there: Kiro CLI
  loads all steering files and ignores inclusion modes (see
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
node scripts/check_package.mjs
node --test tests/*.test.mjs
uvx --from skills-ref agentskills validate skills/ep-setup
uvx --from skills-ref agentskills validate skills/ep-audit
uvx --from skills-ref agentskills validate skills/ep-fix
uvx --from skills-ref agentskills validate skills/ep-review-architecture
npx skills add . --list
```

```powershell
node scripts/check_package.mjs
node --test tests/*.test.mjs
uvx --from skills-ref agentskills validate skills/ep-setup
uvx --from skills-ref agentskills validate skills/ep-audit
uvx --from skills-ref agentskills validate skills/ep-fix
uvx --from skills-ref agentskills validate skills/ep-review-architecture
npx --yes skills add . --list
```

Or `scripts/smoke.ps1`.

## Status

Initial standalone extraction: `0.1.0`.

The skills have extensive real-world use in their source repository. The
starter eval sets in each skill are scaffolding for repeatable cross-client
evaluation and have not yet been benchmarked.

## License

MIT. See [LICENSE](LICENSE).
