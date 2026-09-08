# Locate the plans root

Confirm `.agents/lodestar/context.md` if it exists. Missing context is not
a stop and not a reason to send the user to `lodestar-setup` — fall back
to `docs/plans/` and pick up the rest of the facts in
[discover-context.md](discover-context.md). Do not read `AGENTS.md` for
the plans path.

Run:

```text
node <this-skill>/scripts/setup-modules.mjs resolve --root <repo>
```

The JSON names `<plansRoot>`, `<doneDir>`, and `<abandonedDir>`. Do
**not** create the root here. Grounding must finish first. A failed plan
leaves no scaffold.

An optional human `README.md` under the plans root is never parsed and is
never a plan.
