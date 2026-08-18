# Step 3 — Confirm which conventions the repo already follows

Present one multi-select, pre-checked from the Step 1 sweep, with the
evidence shown per row. Frame it as what the repo already does, not as
what to enforce:

> Which of these does this repo already follow? Pre-checked from a
> short evidence sweep — uncheck anything that doesn't match. One
> round of feedback.
>
> - [ ] `result-types` — expected failures return `Result<T, E>`
>       (evidence: `<path>` / not found)
> - [ ] `branded-types` — domain identifiers are branded types
>       (evidence: `<path>` / not found)
> - [x] no `export *` barrels (`barrel-exports: no`)
>       (evidence: `export *` found at `<path>` / none — none → checked)
> - [ ] `design-tokens` — styling uses design tokens
>       (evidence: `<path>` / not found)
> - coverage floor: `<N or none>` (evidence: `<path>: <N>` / not found;
>   default 80)

Pre-check per row from evidence — do not apply one rule to every row:

- `result-types` / `branded-types` / `design-tokens`: check when the
  signal was found; leave unchecked when not found.
- no `export *` barrels: check when **no** `export *` was found (the
  default); uncheck when one was. The quote above shows the default.
- coverage: pre-fill the number from the test config, or `80` when not
  found.

Record the answers as the `## Conventions` table values:

- checked `result-types` / `branded-types` / `design-tokens` → `yes`;
  unchecked → `no`
- checked "no `export *`" → `barrel-exports: no`; unchecked → `yes`
  (barrels allowed)
- coverage floor → the confirmed integer or `none`

Do not ask a second question. Setup stays descriptive.
