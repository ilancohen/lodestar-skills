# Step 3 — Confirm which conventions the repo already follows

Present one multi-select, pre-checked from the Step 1 sweep, with the
evidence shown per row. Say what each habit means in everyday terms, not
by its config key. Frame it as what the repo already does, not as what to
enforce:

> I looked for four coding habits in this repo and ticked the ones I
> think it already follows. Untick anything I got wrong. The audit only
> checks the ticked ones. One round of feedback.
>
> - [ ] Functions return errors as values instead of throwing
>       (I looked at `<path>` — found / not found)
> - [ ] IDs have their own distinct types, so a user ID can't be passed
>       where an order ID is expected
>       (I looked at `<path>` — found / not found)
> - [x] No files that only re-export other files (`export *`)
>       (found one at `<path>` / found none — found none, so ticked)
> - [ ] Styling uses named design tokens instead of raw colours and sizes
>       (I looked at `<path>` — found / not found)
> - Minimum test coverage to hold the repo to: `<N or none>`
>       (found `<N>` in `<path>` / not found, so suggesting 80)

Pre-check per row from evidence — do not apply one rule to every row:

- errors-as-values (`result-types`), distinct ID types (`branded-types`),
  design tokens (`design-tokens`): check when the signal was found; leave
  unchecked when not found.
- no re-export-only files (`barrel-exports`): check when **no** `export *`
  was found (the default); uncheck when one was. The quote above shows the
  default.
- coverage: pre-fill the number from the test config, or `80` when not
  found.

Record the answers as the `## Conventions` table values. The keys below go
in the file; do not put them in the question:

- errors as values → `result-types: yes` when ticked, `no` when not
- distinct ID types → `branded-types: yes` when ticked, `no` when not
- design tokens → `design-tokens: yes` when ticked, `no` when not
- no re-export-only files → `barrel-exports: no` when ticked; `yes` when
  not (re-export files are allowed)
- coverage floor → the confirmed integer or `none`

Do not ask a second question. Setup stays descriptive.
