# AGENTS.md section (opt-in only)

The lodestar skills never read `AGENTS.md`. This snippet exists for one
purpose: when the user wants the principles applied to _every_ task (not
only when a lodestar skill is invoked), `AGENTS.md` is where every agent
already looks, so the instruction has to live there.

Append the section below to the repo's `AGENTS.md` (or replace an existing
`## Lodestar` section). Change nothing else in the file. If the user
declined, do not touch `AGENTS.md` at all.

```markdown
## Lodestar

This repo enforces the principles in
`.agents/skills/lodestar-setup/principles.md`. Before completing any task,
check the pre-commit checklist there.

Repo facts those principles refer to — package layout, dependency
direction, and the build / typecheck / lint / test commands — live in
`.agents/lodestar/context.md`, along with the lodestar skills index.
```
