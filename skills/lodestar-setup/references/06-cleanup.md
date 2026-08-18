# Step 6 — Clean up a pre-0.3 install

Older versions of this skill put the `## Build & Test`,
`## Dependency Direction`, `## Package Layout`, `## Skills`, and
`## Audit Output` sections in `AGENTS.md`. If you found any of them there
in Step 1, their values now live in `context.md`.

Honor the permissions-screen tick. If the cleanup row was ticked, remove
only those sections (plus the `## Lodestar` section if
`ENFORCEMENT_MODE` is `skills-only`) and leave the rest of `AGENTS.md`
untouched. If it was unticked or omitted, leave `AGENTS.md` as it is —
and if those sections are still there, tell them `AGENTS.md` now has an
out-of-date copy that nothing reads, and `context.md` is the one that
counts.
