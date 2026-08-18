# Step 6 — Clean up a pre-0.3 install

Older versions of this skill put the `## Build & Test`,
`## Dependency Direction`, `## Package Layout`, `## Skills`, and
`## Audit Output` sections in `AGENTS.md`. If you found any of them there
in Step 1, their values now live in `context.md`, so ask once:

> `AGENTS.md` still has the lodestar sections from an older setup. The
> skills now read `.agents/lodestar/context.md` instead. Remove those
> sections from `AGENTS.md`? (yes / leave them)

If yes, remove only those sections (plus the `## Lodestar` section if
`ENFORCEMENT_MODE` is `skills-only`) and leave the rest of `AGENTS.md`
untouched. If they decline, say that `AGENTS.md` now holds a second,
unread copy of the layout and that `context.md` is the one that counts.
