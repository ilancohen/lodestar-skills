# Step 9 — Confirm

Print a one-line summary of each file written or updated (including
`.fallowrc.json` if Step 7 ran), and which `ENFORCEMENT_MODE` was used —
say plainly whether `AGENTS.md` was edited (`full`) or left alone
(`skills-only`). Name the fallow version Step 7 resolved, whether it was
already there or just installed. If none resolved, say so, repeat the
install command, and say `lodestar-audit` needs it.
List any convention recorded at its skip value, so the user sees what
the audit will skip: `result-types: no` (errors #B), `branded-types: no`
(`boundaries` A, `types` #4), `barrel-exports: yes` (`imports` #4),
`design-tokens: no` (the whole `styling` category), `coverage-floor:
none` (the coverage floor). If every row is at its default, say so.
Name the commit policy. List every unscannable package by name and language (not scanned).
Name the audit scope. When `changed-since`, say the next audit will find
little by design (baseline is today's commit) and existing code shows
up as the `INDEX.md` backlog; widen for one run in the audit, not here.
Ask: "Does this look right? If so, run the `lodestar-audit`
skill to scan the codebase and produce action-item files in
`<output-root>/<run-id>/` (default `docs/audit/<run-id>/`). If the layout itself feels off, run
`lodestar-architecture` instead — it produces an advisory report and never
modifies source."

To check later whether `context.md` still matches the repo, run
`check-freshness` — do not re-run this skill just to find out.

Do not run the audit automatically. Do not run `lodestar-architecture`
automatically. Setup is descriptive — anything evaluative is the other
skill's job.
