# Canonical homes

Route harvested knowledge by kind. **Never create a new home.** Fewer
places to look, not more.

The survey's `homes` array is the allow-list. Prefer `## Docs Layout`
rows with role `home` from `context.md`. If that section is absent,
observe the same way `lodestar-setup` would (`discover-docs.mjs`).

Never create a new home. Never treat `unknown` or `staging` rows as
harvest targets.

| Kind of knowledge | Home, when it already exists |
| --- | --- |
| How the system is built, what talks to what, why | matching `docs/spec/*.md` |
| Behaviour of a specific subsystem | matching `docs/spec/*.md` |
| **Tried it, didn't work, don't retry** | `docs/rejected-approaches.md` |
| Cross-cutting convention with no spec file | an existing `docs/*.md` topic doc |

If nothing in `homes` fits, **do not invent a path**. On the proposal,
list the fact under **needs a home** and either keep the source file or
ask where it should go.

`docs/rejected-approaches.md` is append-only when it exists. One entry
per dead end, a few lines: what was tried, what happened (numbers if
measured), why it stopped, the date.

## Harvest bar

Harvest anything **expensive to rediscover**, even when it is technically
derivable from the code. A calibration that took a week of pilots is
worth a line in a spec.

Do not harvest what a grep would answer in ten seconds. Restating the
code in prose is how the tree grew.

## AGENTS.md

Do not read `AGENTS.md` for repo facts. Do not create a Docs map.

If the survey has `agentsMdHasDocsMap: true`, offer one unticked row on
the proposal: refresh the existing map after deletes. Only edit that
section if the user ticks it. A surviving canonical doc that cannot earn
a line in that map is evidence you should have deleted it.

## Spec vs code

If a spec states a live value and the code says something different, you
cannot tell from outside which one is the bug. **Stop and ask.** Quote
both with `file:line`. Never silently update the spec to match the code.

Exception: a spec names a symbol, path, or step that exists nowhere in
the code. Fixing or cutting that dead reference is a strip, not a
decision.
