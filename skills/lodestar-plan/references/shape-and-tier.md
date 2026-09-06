# Shape and tier

## Shape

| Shape | When |
| --- | --- |
| `<plansRoot>/YYYY-MM-DD-<slug>.md` | Fits one session (prefer the date prefix) |
| `<plansRoot>/YYYY-MM-DD-<slug>/` or `<plansRoot>/<slug>/` | Too big for one session, or stages relatively independent |

Each folder sub-plan should be independently shippable when possible.
Prefer fewer coarse stages.

**`light` is always a single file with one stage. A folder plan is never
`light`.** If size says `light` but the work needs a folder, write
`standard` (or `full` if a risk trigger fires).

## Tier

Write `rigor: light | standard | full` in the plan's frontmatter. Size
sets the starting point; risk can only raise it.

| Starting point | When |
| --- | --- |
| `light` | One stage and a handful of files |
| `standard` | A few stages |
| `full` | Many stages, or work that crosses packages |

Any of these forces `full` regardless of size:

- A public API or schema change
- A data migration
- An auth / security / money / data-deletion surface
- An unresolved decision point (`Requires decision`, `Rides D<N>`)

A stage may declare a **lower** tier than the plan for genuinely
mechanical work — rename, file move, hoist, comment removal. Write that
on the stage (`rigor: light` in folder-sub-plan frontmatter, or a line
under a single-file pass heading). Do not lower a stage that is not
mechanical.

Say the chosen tier in one line before writing, with the size or risk
reason. Do not prompt to confirm it.
