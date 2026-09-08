# Write the files

Drive from state + corrections. Ask nothing. Do not announce each file;
completion lists them.

### context.md

```bash
node <setup-skill>/scripts/setup-state.mjs write-context \
  --root <repo> \
  --state <state.json> \
  --corrections <corrections.json>
```

Then immediately:

```bash
node <setup-skill>/scripts/setup-state.mjs record-result \
  --results <results.json> \
  --op context \
  --status changed|failed \
  --path .agents/lodestar/context.md \
  [--remedy <text>]
```

Do not echo raw write-context stdout into chat. Do not `Read` the state
file. Merge rules (fresh / current / legacy / preserve audit rows /
omit Resolved Decisions / Dependency Policy only when user-stated) live
in the collector — trust it.

### AGENTS.md — only in `full` mode

If `ENFORCEMENT_MODE` is `skills-only`: skip; `record-result` with
`--status skipped --op agents --remedy skills-only mode`.

If `full`: append or replace `## Lodestar` from `agents-md.md` only.
Create `# AGENTS.md` when missing. Then `record-result`
(`changed|failed` + path).

### .agents/skills/README.md

Write `skills-readme.md` verbatim when no other README exists there.
`record-result` for that op (`changed|skipped`).
