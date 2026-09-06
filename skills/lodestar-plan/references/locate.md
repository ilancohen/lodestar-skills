# Locate the plans root

Confirm `.agents/lodestar/context.md` if it exists. Missing context is not
a stop — fall back to `docs/plans/`. Do not read `AGENTS.md` for the
plans path.

Run:

```text
node <this-skill>/scripts/setup-modules.mjs resolve --root <repo>
```

The JSON names `<plansRoot>`, `<ledgerPath>`, and `<doneDir>`. Then:

```text
node <this-skill>/scripts/setup-modules.mjs bootstrap --root <repo>
```

Bootstrap is lazy and idempotent. It creates `<plansRoot>`,
`<plansRoot>/done/`, and a ledger at `<ledgerPath>` with empty Awaiting
and Done tables when those are absent. It does not overwrite an existing
ledger. A repo that never plans gets no empty scaffolding until this
skill runs.

If resolve and bootstrap disagree about the root, stop and ask.
