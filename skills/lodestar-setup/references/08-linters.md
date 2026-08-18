# Step 8 — (Optional) Linting rules for higher-accuracy audit findings

The lodestar-audit skill runs an opportunistic linter probe when detecting
`types` (#1, #3), `errors` (A, B), and `boundaries.B` violations. Enabling
the relevant rules in your existing linter config makes those findings
definitive rather than heuristic — no packages to install beyond what you
already use.

**Only do this if the project has a linter already configured.** Do not
set up a new linter.

Honor the permissions-screen tick. If the linter row was omitted or
unticked, skip. If it was ticked, read [linters.md](../linters.md) and
enable only the in-place ESLint / Biome rules it names. Do not add
plugins or packages — `eslint-plugin-boundaries` stays advisory, not
part of this tick.
