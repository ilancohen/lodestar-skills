# Ground before writing

A bounded verification pass, not research. Do this after the shape is
clear enough to name files and commands, and before creating the plan
file.

Check, in this order:

1. **Files.** Every path in Scope / files that is not marked `(new)` must
   exist on disk. A path marked `(new)` may be absent. Do not invent a
   file to make the list look complete.
2. **Commands.** Every command the plan names must appear in the
   `package.json` `scripts` of the relevant package, or in `context.md`
   `## Build & Test`. A command that is neither is not real.
3. **Direction.** If the plan assumes package A may import package B,
   that edge must match `context.md` `## Dependency Direction`. An empty
   graph is valid for a single-package repo.

On a hit: **stop**. Name the missing file or command, or the direction
contradiction. Do not write the plan. Trace callers only when this pass
turns up a contradiction — not as a default survey.

Unresolved decisions belong in the plan as `Requires decision` / `Rides
D<N>`. They do not fail this pass; they force `rigor: full` in the next
step.
