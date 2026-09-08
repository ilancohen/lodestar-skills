## Step 4 — Report

Print a session summary:

```
Finished this session on <output-root>/<RUN_ID>/.

  fixed:            N
  left for later:   N
  dropped:          N
  not started yet:  N

Changes were <committed one per fix | left in your working copy for you
to commit>.

Of the N left for later: M turned out to need bigger changes than the fix
allowed, N were blocked by a commit hook, and P are waiting on a decision
from you. Each one says why in its file.
(List the hook-blocked ones separately — those edits are already on disk
and can be picked up again.)

What you can do next:
  - Run `lodestar-fix` again.
  - Clear blockers on anything left for later, then run again.
```

### Step 4a — Promote a finished run

After the report, if the run root has no action-item files left
(`INDEX.md`, `done/`, and other non-items ok), the run is resolved:

```text
node <skill-dir>/scripts/action-state.mjs archive-run --run-dir <output-root>/<RUN_ID>
```

Create `<output-root>/done/` if it does not exist. Print:

```
Nothing left in this batch. Moved it to <output-root>/done/<RUN_ID>/.
```

If action-item files remain, skip this step.

### Step 4b — Do not overwrite Dependency Policy from observation

After cycle fixes (`imports` #3), do **not** refresh `context.md` from
the live import graph. `## Dependency Policy` is user-stated intent
only — never replace it with today's edges or a topological sort.

If the user asks to change policy, point them at `lodestar-setup` (or
edit the Policy section themselves). `#6` (wrong-direction) does not
trigger any context rewrite either.

Own commit of observed direction into context is retired.
