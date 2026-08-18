# Step 5 — Confirm

Write the summary for a person skimming it. Follow `SKILL.md`'s "How to
talk to the user": bullets, blank line between blocks, bold lead-ins, no
config keys unless you also say what they mean.

Group it under short bold headings, in this order.

**Files** — each file you wrote or changed, one bullet each (including
`.fallowrc.json` if the fallow procedure wrote it). Say plainly whether you edited
`AGENTS.md` or left it alone.

**Fallow** — the version you found, and whether it was already there or
you just installed it. If there is none, say up front that the audit
cannot run without it, and repeat the install command.

**Not checked** — which checks the audit will skip, and why. One bullet
each, in plain words, for every convention the user left off:

- errors as values off → it won't flag functions that throw for expected
  failures
- distinct ID types off → it won't flag IDs typed as plain strings
- re-export-only files allowed → it won't flag them
- design tokens off → it skips all styling checks
- no coverage floor → it won't flag thin test coverage

If nothing is switched off, just say so.

**Settings** — one bullet each: how `lodestar-fix` will commit, in the
same words as the review screen; any package you couldn't scan, by name
and language; and which code the audit will write fixes for. If it's only
code changed from today on, warn them the first audit will look almost
empty on purpose, that older problems appear as a backlog list in
`INDEX.md`, and that they can widen a single audit run when they run it —
not here.

**Next** — then ask: "Does this look right? If so, run `lodestar-audit`
next — it reads the codebase and writes one file per problem, with fix
instructions, into `<output-root>/<run-id>/` (default
`docs/audit/<run-id>/`). If it's the overall shape of the project you're
unsure about, run `lodestar-architecture` instead — it writes an opinion,
and never changes your code."

To check later whether `context.md` still matches the repo, run
`check-freshness` — do not re-run this skill just to find out.

Do not run the audit automatically. Do not run `lodestar-architecture`
automatically. Setup is descriptive — anything evaluative is the other
skill's job.
