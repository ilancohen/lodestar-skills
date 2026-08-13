# AGENTS.md

Suite contributors: also read `CONTRIBUTING.md` and `ROADMAP.md` before
changing this skill package.

## Project

Portable Agent Skills for documenting, auditing, reviewing, and
improving software architecture.

This suite itself uses **pnpm**. When a skill runs in a target
repository, use that repo's package manager (npm, yarn, or pnpm) from
its lockfile. If none or more than one lockfile is present, ask which
to use — do not guess.

## Layout

| Path                             | Responsibility                                         |
| -------------------------------- | ------------------------------------------------------ |
| `skills/ep-setup/`               | Repository context and principles setup                |
| `skills/ep-audit/`               | Read-only violation discovery and action-item planning |
| `skills/ep-fix/`                 | Scoped execution of audit action items                 |
| `skills/ep-review-architecture/` | Advisory package-layout review                         |
| `scripts/`                       | Deterministic package-development validation           |
| `package.json`                   | pnpm pin and suite scripts (`pnpm check`, `pnpm test`) |
| `plugin.json`                    | Portable Agent Plugins manifest                        |
| `.claude-plugin/`                | Claude Code packaging adapter                          |
| `.codex-plugin/`                 | Codex packaging adapter                                |
| `gemini-extension.json`          | Gemini CLI packaging adapter                           |

## Commands

```bash
pnpm check
pnpm test
pnpm dlx skills add . --list
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
- Update `docs/evals.md` when behavior or triggering changes.
- Validate every skill and local package discovery before release.

## Scope

This repository develops the reusable suite itself. Do not encode assumptions
from one consuming repository into canonical skill logic. Capture examples in
eval fixtures or documentation instead.

Read `ROADMAP.md` and `CONTRIBUTING.md` for the remaining implementation work and acceptance
criteria.
