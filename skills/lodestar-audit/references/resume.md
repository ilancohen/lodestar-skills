# Resume and run IDs

Load this file before creating or resuming a run.

## Run ID

`<RUN_ID>` is the UTC date `YYYY-MM-DD` for the first run that day.
Later same-day runs use `YYYY-MM-DD-NNN` starting at `002`.

```text
node scripts/audit-state.mjs resolve-run --root <repo>
```

That command never overwrites an existing run directory. It reads
`output-root` from `context.md` `## Audit Settings` (default
`docs/audit`) and returns `outputRoot`, `architectureRoot`, and `path`.
Examples below use `<output-root>` for that value.

```text
<output-root>/2026-05-15/
<output-root>/2026-05-15-002/
```

To resume:

```text
node scripts/audit-state.mjs resolve-run --root <repo> --resume <RUN_ID>
```

If `--resume` is passed with no id, it picks the latest in-progress run
from today (findings exist, INDEX missing, or a category is incomplete).

## Recover

```text
node scripts/audit-state.mjs recover --run-dir <output-root>/<RUN_ID>
```

Returns:

- `restart-discover` — no `findings.md`
- `resume-discover` — incomplete categories remain
- `plan` — Discover complete, Plan not finished
- `plan` — Discover complete, Plan not finished
- `done` — `INDEX.md` exists and Discover is complete. If `findings.md`
  still has `in_scope: false` findings, Phase 2 may run again to
  promote a slice — do not treat `done` as a stop when the user asked
  to promote.

Findings are deduplicated and re-IDed. Partial work is kept.

## Checkpoints

After each category:

```text
node scripts/audit-state.mjs checkpoint --run-dir <output-root>/<RUN_ID> --category imports --status complete --count 4
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
| Done, backlog remains | flip the slice's `in_scope`, Plan only — do not Discover |

To re-run Plan from scratch after editing `findings.md`, delete
`NNN-*.md` and `INDEX.md` in that run directory only. To promote a
backlog slice, do **not** delete them — see below.

## Promote a backlog slice

Do not re-run Discover. Keep `findings.md`. Flip `in_scope: true` on
the slice to promote (one category, one package, or every finding),
then re-run Phase 2. Existing `NNN-*.md` files are skipped, so
promotion is additive. Numbering continues from the highest existing
ID (`003` on disk → next file is `004`). Rewrite `INDEX.md` so the
Backlog table matches what remains out of scope.

This is how old code is chipped away: cheap, no second scan.
