# Step 8 — (Optional) Linting rules for higher-accuracy audit findings

The lodestar-audit skill runs an opportunistic linter probe when detecting
`types` (#1, #3), `errors` (A, B), and `boundaries.B` violations. Enabling
the relevant rules in your existing linter config makes those findings
definitive rather than heuristic — no packages to install beyond what you
already use.

**Only do this if the project has a linter already configured.** Do not
set up a new linter or modify linter config without the user's consent.

Ask once, in plain words — name the linter they already have, say that
turning on a few of its rules lets the audit report real problems instead
of likely ones, and say nothing new gets installed:

> You already use `<ESLint | Biome>`. If I turn on a handful of its rules,
> the audit can report certain problems as definite rather than probable.
> Nothing new gets installed — it's a change to your existing config.
> Shall I? (yes / no)

If they decline, skip. If they opt in, read
[linters.md](../linters.md) and apply only the rules they confirm.
