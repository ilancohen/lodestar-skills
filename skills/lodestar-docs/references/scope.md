# Scope

Default trees are every `staging` row that exists. For the audit
output-root, that means `done/` and `abandoned/` plus loose files — not
live run directories. It is not the whole `docs/` tree.

`unknown` rows are out of scope until setup classifies them. `home` rows
are harvest targets, not sweep targets.

Widen only when the user asks:

- A named folder → `scope.mjs survey --root <repo> --tree <relative>`
- The whole `docs/` tree → add `--full`

`--tree` and `--full` still honor protected paths from the survey.

## Protected (never propose delete)

- `.agents/lodestar/context.md`
- Skill definition files
- Live audit runs — a directory under `<output-root>` that still has
  resumable state: `findings.md`, `.checkpoint.json`, and/or
  `NNN-*.md` action items in that directory (not inside its `done/`),
  even when `INDEX.md` is absent or the user widened scope
- In-flight rows from `## Docs Layout` (and nested files except nested
  `staging` paths such as `docs/plans/done/`)

If the survey flags a path `protected: true`, skip it. Mention the count
in the opening so the user knows you left live work alone.

## Missing context

No `.agents/lodestar/context.md`: observe docs trees (same discovery
setup uses) and continue when staging paths exist. A named `--tree` or
`--full` also proceeds. If nothing is observed and the user named no
folder, say so and stop. Do not invent `docs/audit` as a fallback.

## Size the run

Say up front which trees you are covering. On a tree that has never been
swept this may be one folder; on a maintained tree, the default set.

If every in-scope file earns its place, say so and stop. A skill that
always finds work invents work.
