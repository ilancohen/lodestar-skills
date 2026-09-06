# Tier

`rigor: light | standard | full` is the verification dial.

| Tier       | Review                                      | Acceptance                                      | Commits                                      |
| ---------- | ------------------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| `light`    | inline; load `review-light.md` only         | one unscoped run at the end of the single stage | one commit: code, done-mark, move, ledger    |
| `standard` | once at plan end; load `review-standard.md` | scoped per stage; full sweep at plan end        | per stage, plus housekeeping                 |
| `full`     | per stage; load `review-full.md`            | scoped per stage; full sweep at plan end        | per stage, plus housekeeping                 |

`<typecheck>` and scoped `<test>` run in every tier.

If the plan has no `rigor:` key, infer it (pick-up JSON `rigor` /
`rigorSource`), announce it in one line, and write it back:

```text
node <this-skill>/scripts/plan-state.mjs write-rigor --root <repo> --plan <slug> --rigor <tier> --reason <text>
```

A folder plan is never `light`. If inference says `light` on a folder,
write `standard`.

**Escalate automatically** (one-line announcement, no prompt) when the
real diff is bigger or riskier than the stage's tier: public API or
schema, a migration, auth / security / money / data-deletion, or a
stage that is no longer mechanical. Record it on that stage only:

The script `escalateStage` in `plan-state.mjs` writes `rigor:` and
`escalated_from_trigger:` on that stage file. Later stages keep the plan
tier.

Do **not** escalate — stop and ask — when a stage needs a file outside
its scope list, or an unresolved decision surfaces.
