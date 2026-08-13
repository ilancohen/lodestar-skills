# Resume and run IDs

Load this file before creating or resuming a run.

## Run ID

`<RUN_ID>` is the UTC date `YYYY-MM-DD` for the first run that day.
Later same-day runs use `YYYY-MM-DD-NNN` starting at `002`.

```text
docs/audit/2026-05-15/
docs/audit/2026-05-15-002/
```

Resolve with:

```text
node scripts/audit-state.mjs resolve-run --root <repo>
```

That command never overwrites an existing run directory. To resume:

```text
node scripts/audit-state.mjs resolve-run --root <repo> --resume <RUN_ID>
```

If `--resume` is passed with no id, it picks the latest in-progress run
from today (findings exist, INDEX missing, or a category is incomplete).

## Recover

```text
node scripts/audit-state.mjs recover --run-dir docs/audit/<RUN_ID>
```

Returns:

- `restart-discover` — no `findings.md`
- `resume-discover` — incomplete categories remain
- `plan` — Discover complete, Plan not finished
- `done` — `INDEX.md` exists and Discover is complete

Findings are deduplicated and re-IDed. Partial work is kept.

## Checkpoints

After each category:

```text
node scripts/audit-state.mjs checkpoint --run-dir docs/audit/<RUN_ID> --category imports --status complete --count 4
```

Writes are atomic. A failed write must not corrupt the previous
`findings.md`. Retry the checkpoint; do not duplicate the category
marker.

Retry limit: three attempts per category command. Then stop and name
the failed category.

## Interrupted states

| When | What to do |
|---|---|
| Before any output | `resolve-run` without `--resume` |
| During finding merge | `recover`, then `merge-findings` again |
| After checkpoint | skip completed categories |
| During Plan | skip existing `NNN-*.md`, continue |

To re-run Plan after editing `findings.md`, delete `NNN-*.md` and
`INDEX.md` in that run directory only.
