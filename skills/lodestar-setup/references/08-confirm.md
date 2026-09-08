# Step 5 — Completion summary

Write the summary for a person skimming it. Follow `SKILL.md`'s "How to
talk to the user": bullets, blank line between blocks, bold lead-ins, no
config keys unless you also say what they mean.

**Do not ask** "Does this look right?" or imply a rollback. This is a
completion summary only.

Group it under short bold headings, in this order.

**Files** — each file you wrote or changed, one bullet each (including
`.fallowrc.json` if the fallow procedure wrote it). Say plainly whether you
edited `AGENTS.md` or left it alone.

**Fallow** — **only when `lodestar-audit` is installed.** The version you
found, and whether it was already there or you just installed it. If
there is none, say up front that the audit cannot run without it, and
repeat the install command. When audit is absent, omit this block
entirely.

**Not checked** — which checks the audit will skip, and why. One bullet
each, in plain words, for every convention the user left off. Skip this
heading when audit is not installed.

- errors as values off → it won't flag functions that throw for expected
  failures
- distinct ID types off → it won't flag IDs typed as plain strings
- re-export-only files allowed → it won't flag them
- design tokens off → it skips all styling checks
- no coverage floor → it won't flag thin test coverage

If nothing is switched off, just say so.

**Settings** — when audit is installed: one bullet each for how
`lodestar-fix` will commit; any package you couldn't scan; and which
code the audit will write fixes for. If it's only code changed from
today on, warn them the first audit will look almost empty on purpose.
When audit is absent, omit audit-scope bullets; you may still note
unscannable packages if relevant.

**Next** — suggest from **installed siblings**, not a fixed list:

- audit + fix present → run `lodestar-audit`, then `lodestar-fix` for
  single-concern fixes
- architecture present → run `lodestar-architecture` for layout opinion
- plan + implement present → run `lodestar-plan` for multi-stage or
  cross-package redesign, then `lodestar-implement`
- docs present → run `lodestar-docs` when staging trees pile up

One outcome sentence: single-concern fixable violation → audit item;
multi-stage / cross-package redesign → `lodestar-plan`.

To check later whether `context.md` still matches the repo (when audit
is installed), run `check-freshness` — do not re-run this skill just to
find out.

Do not run the audit automatically. Do not run `lodestar-architecture`
or `lodestar-docs` automatically. Setup is descriptive — anything
evaluative is the other skill's job.
