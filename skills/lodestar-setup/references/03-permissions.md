# Step 2 — Permissions for writes outside `.agents/`

Present **one tick list**. Do not split across turns. One round of
feedback. Later steps honor ticks and ask nothing.

**Do not repeat** layout, commands, conventions, scope, or evidence from
the review screen.

### Build the list

Prefer:

```bash
node <setup-skill>/scripts/setup-state.mjs permissions-projection \
  --state <state.json>
```

Read that stdout only. It lists consent rows (cost + consequences) from
state — fallow status, linter, legacy `AGENTS.md` sections — without
re-stating package layout.

If you must derive rows without the helper: use projection/state-backed
`fallow` + `linter` + `existing.legacyAgentsSections` only. Do not
re-run discovery narrative. Never truncate consent rows.

### Gating

- `hasAudit` false → omit every Fallow row (install, `.fallowrc.json`,
  fallow gitignore patterns).
- Omit install when fallow is already declared, in-range, and present
  under `node_modules/.bin`.
- Omit linter row when no linter / audit absent.
- Omit cleanup row when no pre-0.3 sections.
- Omit gitignore row when both patterns already covered.

### Present

> These writes go outside `.agents/`. Ticked ones run; untick anything
> you don't want. One round.

Pre-tick per `defaultTicked` on each row. Always eligible (when present):

- Fallow install / upgrade (audit) — command + consequence
- `.fallowrc.json` write or merge (audit)
- `.gitignore` scratch patterns (audit)
- `## Lodestar` on `AGENTS.md` (unticked → skills-only)
- Tighten existing linter (audit + linter configured)
- Remove listed pre-0.3 `AGENTS.md` sections

Record the ticks. `ENFORCEMENT_MODE` stays `skills-only` unless the
`AGENTS.md` Lodestar row is ticked.

Declined or failed fallow install is not a setup failure —
print the command, say audit will not run without it, continue.
`.fallowrc.json` still follows its own tick.
