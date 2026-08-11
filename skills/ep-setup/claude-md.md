# CLAUDE.md — Engineering Principles for This Monorepo

Read this before touching any code. Treat it as law, not suggestion.

For the full project context (build commands, package layout, skill index),
read `AGENTS.md`.

---

## Repository Layout

The authoritative layout — package names, paths, aliases, and the
one-sentence responsibility for each — lives in the `## Package Layout`
table in `AGENTS.md`. Read it before reasoning about where code should
live.

Packages may only import in the dependency direction declared in
`AGENTS.md`. Circular imports are forbidden. Cross-package imports go
through `index.ts` only — never from internal paths like `<alias>/src/...`.

If a change would put code in a package whose responsibility (per
`AGENTS.md`) doesn't match what the code is doing, the package boundary
is wrong, not the code — flag it. The `ep-review-architecture` skill exists
for cases where the layout itself needs a second look.

---

<!-- INSERT principles.md -->
