---
name: publish-release
description: >-
  Commit uncommitted lodestar-skills work, update CHANGELOG.md, run pnpm run
  publish to bump versions and tag, then push. Use when shipping a release,
  bumping the suite version, updating the changelog, tagging vX.Y.Z, or
  committing and pushing pending suite changes.
disable-model-invocation: true
---

# Publish Release

Ship suite changes: **validate → commit → changelog → publish → push**.

Read `AGENTS.md` and `CONTRIBUTING.md` for repo rules. Never hand-edit
`VERSION`, manifests, or skill `version:` fields — `pnpm run publish` owns
those.

## Preconditions

1. Run `git status` and `git diff` (staged and unstaged). Understand every
   change before committing.
2. If the user did not specify a bump (`patch` / `minor` / `major` / `X.Y.Z`),
   infer from changes or ask once. Default to `patch` for fixes and small
   tweaks; `minor` for new capabilities; `major` for breaking changes.
3. Read current version from `VERSION`.

## Validate

Run before any commit:

```bash
pnpm check
pnpm test
```

If skill discovery, adapters, or frontmatter changed, also run:

```bash
pnpm dlx skills add . --list
```

Fix failures before committing. Do not skip hooks (`--no-verify`) unless the
user explicitly asks.

## Commit work (one or more commits)

Split unrelated changes into separate commits. Prefer short, informative
subjects (imperative mood, ~50 chars when possible):

| Change kind       | Subject pattern         |
| ----------------- | ----------------------- |
| Feature           | `Add …` / `Support …`   |
| Fix               | `Fix …`                 |
| Refactor          | `Refactor …`            |
| Docs / skill text | `Docs: …` / `Clarify …` |
| Tests             | `Test …`                |

**Do not** commit version bumps — publish creates the `Release X.Y.Z` commit.

For each commit:

1. Stage only files that belong together (`git add …`).
2. Commit with a HEREDOC message:

```bash
git commit -m "$(cat <<'EOF'
Short subject line.

Optional one-line why if the subject alone is unclear.
EOF
)"
```

3. Run `git status` after each commit to confirm a clean staging area.

If behavior or skill triggering changed, include `docs/evals.md` updates in
the relevant commit (not in the release bump commit).

## Changelog

Add a `## [X.Y.Z]` section at the top of `CHANGELOG.md` (below the title
block) for the **next** version — the one `publish` will produce.

Format (match existing entries):

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added | Changed | Fixed | Removed

- **Bold lead-in.** One or two sentences max. One bullet per change.
```

Rules from `AGENTS.md`: concise bullets, no multi-paragraph entries, no
mid-sentence line breaks inside bullets.

Commit the changelog on its own or with the last content commit — but the
tree must be **clean** before `publish` runs.

## Publish (version bump + tag)

Dry-run first when unsure:

```bash
pnpm run publish -- patch --dry-run
```

Replace `patch` with the chosen bump. Then release:

```bash
pnpm run publish -- patch
```

`publish` requires:

- Clean working tree
- `## [X.Y.Z]` present in `CHANGELOG.md` for the target version
- Tag `vX.Y.Z` must not already exist

It bumps `VERSION`, manifests, and skill metadata; commits `Release X.Y.Z`;
creates annotated tag `vX.Y.Z`.

## Push

Prefer pushing in the same step:

```bash
pnpm run publish -- patch --push
```

Or, after a local publish without `--push`:

```bash
git push origin HEAD && git push origin vX.Y.Z
```

Use the actual version/tag from `VERSION` after publish. Never force-push
`main`/`master`.

## Git safety

- Never update git config
- Never run destructive git commands unless explicitly requested
- Never amend unless the user asks and HEAD is unpushed work you created
- If a pre-commit hook fails, fix the issue and create a **new** commit —
  do not amend a failed commit
- Do not push unless the user asked (this skill implies push when invoked
  end-to-end; confirm if they only wanted commits)

## Done

Report:

- Commits created (subjects)
- Released version and tag
- Whether branch and tag were pushed
- Any validation commands run
