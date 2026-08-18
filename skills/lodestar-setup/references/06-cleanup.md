# Step 6 — Clean up a pre-0.3 install

Older versions of this skill put the `## Build & Test`,
`## Dependency Direction`, `## Package Layout`, `## Skills`, and
`## Audit Output` sections in `AGENTS.md`. If you found any of them there
in Step 1, their values now live in `context.md`, so ask once:

> An older version of this setup put some lodestar sections in
> `AGENTS.md`: `<list them>`. The skills don't read those any more — that
> information now lives in `.agents/lodestar/context.md`. Shall I delete
> them from `AGENTS.md`? Everything else in the file stays.
> (yes / leave them)

If yes, remove only those sections (plus the `## Lodestar` section if
`ENFORCEMENT_MODE` is `skills-only`) and leave the rest of `AGENTS.md`
untouched. If they decline, tell them `AGENTS.md` now has an out-of-date
copy that nothing reads, and `context.md` is the one that counts.
