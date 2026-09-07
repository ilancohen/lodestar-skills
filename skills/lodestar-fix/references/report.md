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

### Step 4b — Refresh `## Dependency Direction` after a cycle fix

If this session completed ≥1 `imports` #3 item (cycle in subtype,
title, or problem), ask **once after the last item**, never per item,
never silently:

> Two of your packages used to import each other, and this session broke
> that loop. The setup notes still describe the old arrangement. Shall I
> update them to match the code as it is now? (yes / no)

On no, change nothing. On yes, run:

```text
node <lodestar-audit-skill>/scripts/audit-state.mjs derive-direction --root <repo>
```

If `cyclic` is still true, report and change nothing. If acyclic,
replace **only** `## Dependency Direction`, with a fresh `Basis:` date.

Own commit, `context.md` only — not an item's commit. Honor session
commit policy: `never`, or `ask` when auto-commit was declined → write
unstaged. `per-item` or `AUTO_COMMIT=yes` → commit. No #3 items → never
ask. `#6` (wrong-direction) does not trigger this.
