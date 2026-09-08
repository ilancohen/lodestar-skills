# Step 0/1 — Collect once

Create OS-temp paths first (see `SKILL.md`). Then run **one** collector:

```bash
node <setup-skill>/scripts/setup-state.mjs collect \
  --root <repo> \
  --out <state.json> \
  --skill-dir <setup-skill>
```

- Read **stdout projection only**. Do **not** `Read` `<state.json>` into
  chat. Pass the path unchanged to later commands.
- Projection is capped (shown/total markers). Full package list stays in
  the state file.
- `siblings` / `hasAudit` gate Fallow, audit headings, and scan-extensions.
  Do not ask which workflows; do not infer from the prompt.

### Package manager needs input

If `needsInput` includes `pkg-manager` (ambiguous or no recognized
lockfile): ask **once** before the review screen — name, exec prefix,
and add-dev. Write into corrections JSON under `pkgManager` (and
optional `commands`). Do **not** re-run collect or invent npm/yarn/pnpm
when none of those lockfiles exist.

An unambiguous lockfile is not a question.

### Stop conditions

- `scannable.total === 0` → stop (see `00-confirm-scannable.md`).
- Collector failures appear under projection `failures` (command +
  remedy + capped detail). Surface them; do not dump raw child output.
