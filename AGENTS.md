# AGENTS.md

Suite contributors: also read `CONTRIBUTING.md` and `ROADMAP.md` before
changing this skill package.

## Project

Portable Agent Skills for setting up engineering principles, auditing a
repository, applying audit fixes, and reviewing package architecture.

## Layout

| Path | Responsibility |
|---|---|
| `skills/ep-setup/` | Repository context and principles setup |
| `skills/ep-audit/` | Read-only violation discovery and action-item planning |
| `skills/ep-fix/` | Scoped execution of audit action items |
| `skills/ep-review-architecture/` | Advisory package-layout review |
| `scripts/` | Deterministic package-development validation |
| `plugin.json` | Portable Agent Plugins manifest |
| `.claude-plugin/` | Claude Code packaging adapter |
| `.codex-plugin/` | Codex packaging adapter |
| `gemini-extension.json` | Gemini CLI packaging adapter |

## Commands

```bash
node scripts/check_package.mjs
node --test tests/*.test.mjs
uvx --from skills-ref agentskills validate skills/ep-setup
uvx --from skills-ref agentskills validate skills/ep-audit
uvx --from skills-ref agentskills validate skills/ep-fix
uvx --from skills-ref agentskills validate skills/ep-review-architecture
npx skills add . --list
```

## Rules

- `skills/` is canonical. Never duplicate skill logic into adapters.
- Keep each skill focused on its documented responsibility.
- Use Agent Skills standard frontmatter in canonical skills.
- Reference bundled files relative to the skill directory.
- Keep target-repository output paths explicit.
- Describe all source mutation in the skill's discovery description.
- `ep-fix` remains the only skill that modifies application source.
- Preserve consent gates, scope limits, and restartability.
- Keep manifest and skill metadata versions synchronized.
- Add or update evals when behavior or triggering changes.
- Validate every skill and local package discovery before release.

## Scope

This repository develops the reusable suite itself. Do not encode assumptions
from one consuming repository into canonical skill logic. Capture examples in
eval fixtures or documentation instead.

Read `ROADMAP.md` and `CONTRIBUTING.md` for the remaining implementation work and acceptance
criteria.
