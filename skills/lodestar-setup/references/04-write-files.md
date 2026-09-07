# Write the files

Use the templates beside `SKILL.md`. Fill every `[bracketed
placeholder]` with real values. Do not announce each file; the Step 5
summary lists them.

`principles.md` (beside `SKILL.md`) is the SSOT for principles.
The install always lands a copy at
`.agents/skills/lodestar-setup/principles.md`. Do not copy, inline, or
edit it, and do not write agent-specific files (`CLAUDE.md`, Copilot
instructions). It references `context.md` tables by name, so it needs
no placeholder substitution.

### .agents/lodestar/context.md

This is the load-bearing file. Start from `context-md.md`. Fill in:

- One-sentence project description.
- The exact commands in the Build & Test table. When lint exists, write
  the `lint` cell as `dev-command; tool; probe-command` from
  `detect-linter.mjs` (or `n/a`).
- The observed import graph in whichever form applies (acyclic chain or
  cyclic edge list), plus a `Basis:` line with the capture date.
- The Package Layout table — one row per package discovered in Step 1,
  using the repo's own names. Fill Responsibility, `Scannable`, and
  Entry points (`index.ts` if undeclared).
- The Docs Layout table — one row per documentation tree from
  `discover-docs.mjs` plus review-screen corrections. Roles: `home`,
  `staging`, `inflight`, `unknown`. Omit the whole `## Docs Layout`
  section when there are no rows. Do not create docs folders.
- The Conventions table — the five keys from the review screen, with the
  confirmed values. Use the skip-value polarity from the template
  (`barrel-exports: yes` means barrels are allowed).
- The Review Rubric list — always
  `.agents/skills/lodestar-setup/principles.md` first, then the
  confirmed extra paths from the review screen, each as a repo-relative
  bullet. Write the section even when the extras list is empty
  (principles alone).
- The Audit Configuration table — defaults (`categories: all`,
  `output-root: docs/audit`, `fallow: required`, `scan-extensions` from
  Step 1 framework signals) plus review-screen
  scope (`mode: all` with no baseline rows, or `mode: changed-since` plus
  `baseline-ref` and `baseline-date`) and review-screen git keys. Do not
  ask about categories, output-root, or fallow. If the user later
  persists a category subset from `lodestar-audit`, leave that row as
  they wrote it on a re-run unless they ask to reset it. If `mode` rows
  already exist, leave them — the baseline does not move on a re-run.
- Excluded Paths — review-screen globs as `### Excluded Paths` under
  Audit Configuration; replace wholesale.

Do **not** write `## Resolved Decisions`. Detector gates and blind spots
are derived in memory by `lodestar-audit` `validate-input` from
Conventions, Package Layout, Dependency Direction, and the linter cell.
If an older `context.md` still has `## Resolved Decisions`, delete that
section on this re-run.

Leave `## Reference` as the template has it — principles link stays at
`.agents/skills/lodestar-setup/principles.md`.

If the file already exists and still has pre-0.9 headings (`## Audit
Settings`, `## Audit Scope`, `## Git`, `## Excluded Paths`,
`## Principles`, `## Skills`, `## Audit Output`), rewrite from the
template — those files fail the parser until regenerated. If it is
already the 0.9 shape, replace `## Build & Test`,
`## Dependency Direction`, `## Package Layout`, `## Docs Layout`,
`## Conventions`, and `## Review Rubric`; remove a leftover
`## Resolved Decisions` if present;
leave other user content. Do **not** replace `## Audit Configuration`
wholesale: refresh git keys (`commits`, `subject-format`, `trailer`,
`protected`, `require-clean`) and `### Excluded Paths` from this run;
leave `categories`, `output-root`, `fallow`, `scan-extensions`, `mode`, `baseline-ref`,
and `baseline-date` if those rows are present (unless the user asks to
reset them). Missing `## Docs Layout` → insert between `## Package Layout`
and `## Conventions` when Step 1 found docs rows; omit the section when
the list is empty (and delete a leftover empty section). Missing
`## Conventions` → insert between
`## Package Layout` (or `## Docs Layout`) and `## Review Rubric` (or
`## Audit Configuration`). Missing `## Review Rubric` → insert between
`## Conventions` and `## Audit Configuration` (after inserting
Conventions if that was also missing). Missing
`## Audit Configuration` → insert after `## Review Rubric` (or
`## Conventions`, or `## Package Layout`) with the defaults above.

Create the `.agents/lodestar/` directory if needed, and write to
`.agents/lodestar/context.md`. Write it in both enforcement modes —
Conventions, Review Rubric, and Audit Configuration included.

### AGENTS.md — only in `full` mode

If `ENFORCEMENT_MODE` is `skills-only`, **do not touch `AGENTS.md`**. Skip
to cleanup.

If it is `full`, take the `## Lodestar` section from `agents-md.md` and
append it to `AGENTS.md`, or replace an existing `## Lodestar` section with
it. Change nothing else in the file. Do not add a layout table, a command
table, or a skills index to `AGENTS.md` — those live in `context.md`, and
duplicating them there would guarantee drift.

If `AGENTS.md` does not exist, create it with a `# AGENTS.md` heading and
that one section.

### .agents/skills/README.md

Write `skills-readme.md` verbatim to `.agents/skills/README.md`. It has no
placeholders: it is a signpost to `.agents/lodestar/context.md` and
`principles.md` for anyone browsing `.agents/skills/`. No skill reads it.
Skip it if a README already exists there with other content.
