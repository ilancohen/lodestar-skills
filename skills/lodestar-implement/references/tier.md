# Tier

`rigor: light | standard | full` is the verification dial.

| Tier       | Review                              | Acceptance                                                         | Commits (consent on)                                      |
| ---------- | ----------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| `light`    | inline; `review-light.md` only      | one unscoped run at end of the single stage                        | one commit: code, done-mark, move                         |
| `standard` | once at end; `review-standard.md`   | scoped per stage; only affected integration checks at completion   | per earlier stage; final stage+move in one commit         |
| `full`     | per stage; `review-full.md`         | scoped per stage; whole-repo sweep only if plan crosses packages   | per earlier stage; final stage+move in one commit         |

Consent off: same acceptance and review; leave unstaged. Never a commit
whose only purpose is moving the plan.

`<typecheck>` and scoped `<test>` every tier (`light`: one unscoped end
run).

No `rigor:` → infer (pick-up `rigor` / `rigorSource`), announce, write
back:

```text
node <this-skill>/scripts/plan-state.mjs write-rigor --root <repo> --plan <slug> --rigor <tier> --reason <text>
```

Folder plans are never `light` — write `standard` if inferred `light`.

**Escalate automatically** (one line, no prompt) when the real diff is
bigger or riskier than the stage tier: public API / schema, migration,
auth / security / money / data-deletion, or non-mechanical work.
`escalateStage` in `plan-state.mjs` writes `rigor:` and
`escalated_from_trigger:` on that stage only.

**Stop and ask** — do not escalate — for out-of-scope files or unresolved
decisions.
