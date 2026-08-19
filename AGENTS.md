# AGENTS.md

Suite contributors: also read `CONTRIBUTING.md` before changing this
skill package.

## Project

Portable Agent Skills for documenting, auditing, reviewing, and
improving software architecture.

This suite itself uses **pnpm**. When a skill runs in a target
repository, use that repo's package manager (npm, yarn, or pnpm) from
its lockfile. If none or more than one lockfile is present, ask which
to use — do not guess.

## Layout

| Path                            | Responsibility                                                            |
| ------------------------------- | ------------------------------------------------------------------------- |
| `skills/lodestar-setup/`        | Repository context and principles setup                                   |
| `skills/lodestar-audit/`        | Read-only violation discovery and action-item planning                    |
| `skills/lodestar-fix/`          | Scoped execution of audit action items                                    |
| `skills/lodestar-architecture/` | Advisory package-layout review                                            |
| `.agents/attention-kind/` etc.  | Local reply-style skills (not published; AGPL-3.0)                        |
| `.cursor/skills/`               | Cursor wrappers for local `.agents/` contributor skills                   |
| `.cursor/skills/create-plan/`   | Contributor planning skill; Cursor-only (no `.agents/` SSOT; intentional) |
| `scripts/`                      | Deterministic package-development validation                              |
| `package.json`                  | pnpm pin and suite scripts (`pnpm check`, `pnpm test`)                    |
| `plugin.json`                   | Portable Agent Plugins manifest                                           |
| `.claude-plugin/`               | Claude Code packaging adapter                                             |
| `.codex-plugin/`                | Codex packaging adapter                                                   |
| `gemini-extension.json`         | Gemini CLI packaging adapter                                              |

## Commands

```bash
pnpm check
pnpm test
pnpm dlx skills add . --list
pnpm run publish -- patch   # or minor / major / x.y.z; add --push to publish remotely
```

## Versioning

Do not hand-edit version fields. Add a `## [X.Y.Z]` section to
`CHANGELOG.md` first. Keep changelog entries concise: one bullet per
change, short bold lead-in, one or two sentences max — no
multi-paragraph bullets or mid-sentence line breaks. `pnpm run publish
-- patch` (or `minor` / `major` / `x.y.z`) bumps `VERSION`, manifests,
and skill metadata, commits, and tags `vX.Y.Z`. Push with `--push`, or
separately: `git push origin HEAD && git push origin vX.Y.Z`.

## Rules

- `skills/` is canonical. Never duplicate skill logic into adapters.
- Keep each skill focused on its documented responsibility.
- Use Agent Skills standard frontmatter in canonical skills.
- Reference bundled files relative to the skill directory.
- Keep target-repository output paths explicit.
- Describe all source mutation in the skill's discovery description.
- `lodestar-fix` remains the only skill that modifies application source.
- Preserve consent gates, scope limits, and restartability.
- Don't hand-edit versions; use `pnpm run publish`.
- Update `docs/evals.md` when behavior or triggering changes.
- Validate every skill and local package discovery before a version bump.

## Scope

This repository develops the reusable suite itself. Do not encode assumptions
from one consuming repository into canonical skill logic. Capture examples in
documentation or test fixtures instead.

The suite is not applied to this repository. There is no
`.agents/lodestar/context.md` and no installed copy under
`.agents/skills/` here — both paths are gitignored, so a local install for
smoke-testing stays uncommitted. Test suite behavior with the fixtures
under `tests/fixtures/repos/` instead.

Read `CONTRIBUTING.md` for the pre-commit checklist. In-flight work
lives under `docs/plans/` (see the `create-plan` / `implement-plan`
contributor skills).
