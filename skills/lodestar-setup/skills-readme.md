# Lodestar

Repo facts for the lodestar skills — package layout, optional dependency
policy, build commands, and the skills index — live in
`.agents/lodestar/context.md` (relative to the repo root). That file is
the one the skills read when present.

The principles themselves live in `./lodestar-setup/principles.md`
(relative to this file, when both skills are installed under the same
parent). Principles resolve from the installed setup skill on every
install path — do not hardcode `.agents/skills/…`. That file is the
single source of truth — do not copy its content here or anywhere else.

This README is a signpost only. Nothing reads it, so nothing here needs
keeping in sync.
