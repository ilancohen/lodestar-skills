# Step 4 — Completion summary

```bash
node <setup-skill>/scripts/setup-state.mjs summarize-results \
  --results <results.json> \
  --state <state.json>
```

(`--state` is only for `siblings` / `next` tips — do not print the rest
of the state file.)

Present **only** what that JSON says:

- **Files** — `changed` paths this run actually recorded
- **Skipped / failed** — with remedies
- **Next** — `next` tips (from installed siblings)

Omit: unchanged `AGENTS.md` noise, convention/audit setting recaps,
facts already accepted on the review screen, raw child stdout, and any
path not in the results file (never rebuild from dirty git).

Do **not** ask "does this look right?". Do not auto-run audit,
architecture, or docs.

Then always:

```bash
node <setup-skill>/scripts/setup-state.mjs cleanup \
  --state <state.json> \
  --corrections <corrections.json> \
  --results <results.json>
```

Run cleanup after success or after recording failures. Interrupted
OS-temp files outside the repo are safe to discard.
