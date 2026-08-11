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
- A POSIX-compatible shell for the current command recipes.
- Node.js for JavaScript/TypeScript repository inspection.
- [Fallow](https://docs.fallow.tools) in the target repository for `ep-audit`.

## Install

### Cross-agent Skills CLI

From this directory during development:

```bash
npx skills add . --skill ep-setup ep-audit ep-fix ep-review-architecture
```

After publishing this repository:

```bash
npx skills add <owner>/<repository> \
  --skill ep-setup ep-audit ep-fix ep-review-architecture
```

Choose project scope unless you intentionally want the suite in every
repository. The skills write project-specific configuration and audit output.

### Direct project install

Copy or symlink the four directories under `skills/` into the target
repository's `.agents/skills/` directory.

### Product packages

This repository also contains:

- `plugin.json` — Agent Plugins 1.0 manifest, currently supported by Cursor.
- `.claude-plugin/plugin.json` — Claude Code plugin adapter.
- `.codex-plugin/plugin.json` — Codex plugin adapter.
- `gemini-extension.json` — Gemini CLI extension adapter.

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

Read [ROADMAP.md](ROADMAP.md) and [AGENTS.md](AGENTS.md) before changing the
suite. Run:

```bash
python3 scripts/check_package.py
uvx --from skills-ref agentskills validate skills/ep-setup
uvx --from skills-ref agentskills validate skills/ep-audit
uvx --from skills-ref agentskills validate skills/ep-fix
uvx --from skills-ref agentskills validate skills/ep-review-architecture
npx skills add . --list
```

## Status

Initial standalone extraction: `0.1.0`.

The skills have extensive real-world use in their source repository. The
starter eval sets in each skill are scaffolding for repeatable cross-client
evaluation and have not yet been benchmarked.

## License

MIT. See [LICENSE](LICENSE).
