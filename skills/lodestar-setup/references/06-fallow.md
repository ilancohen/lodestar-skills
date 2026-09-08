# Fallow and `.fallowrc.json`

**Skip when `hasAudit` is false.** No Fallow check, download, or write.

Honor permissions ticks. Ask nothing. Use fallow status from the collect
state / permissions projection — do not re-narrate discovery.

### Install / upgrade (if ticked)

1. `resolve-bin` via sibling audit script:
   `node <lodestar-audit-skill>/scripts/fallow-contract.mjs resolve-bin --root <repo>`
2. In-range + declared + binary present → never install over it.
3. Else run the permissions-row add-dev / upgrade / plain install
   command, then re-run `resolve-bin`.
4. Unticked or failed → print commands; say audit will not run without
   fallow in `package.json` and `node_modules/.bin`; continue (not a
   setup failure).

`record-result` for the install op.

### `.fallowrc.json` (if ticked)

Write from `fallowrc.md` or merge `boundaries` / `ignorePatterns`.
Optional `entry`: take **only** from corrections `fallowEntry.globs`
(review-screen app surfaces that exist on disk). Do **not** invent
`entry` from import-graph edges. Single-app with empty `fallowEntry` →
omit `entry`. User said **replace** → full replace. Unticked → skip.

`record-result` for `.fallowrc.json`.

### `.gitignore` (if ticked)

Add `.audit-*.json` and `.fallow/` when missing. Never gitignore
`.agents/lodestar/fallow-compat.json`.

`record-result` for gitignore.

### Verify

When compatible fallow resolves, run boundaries + entry-point checks via
`fallow-contract.mjs run` with `--out` under the **OS temp** directory
(not the repo root when avoidable). Use `--minimum N` from
`fallowEntry.minimum` when set. Delete temp outs before reporting.
On failure, fix globs/`entry` and re-run; clean up each time.
`record-result` for verify failures with remedies.

Never echo raw fallow stdout into chat.
