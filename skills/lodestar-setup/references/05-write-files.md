# Step 5 — Write the files

Use the templates beside `SKILL.md`. Fill every `[bracketed
placeholder]` with real values. Do not announce each file; the Step 9
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
- The exact commands in the Build & Test table.
- The observed import graph in whichever form applies (acyclic chain or
  cyclic edge list), plus a `Basis:` line with the capture date.
- The Package Layout table — one row per package discovered in Step 1,
  using the repo's own names. Fill Responsibility, `Scannable`, and
  Entry points (`index.ts` if undeclared).
- The Conventions table — the five keys from the review screen, with the
  confirmed values. Use the skip-value polarity from the template
  (`barrel-exports: yes` means barrels are allowed).
- The Audit Configuration table — defaults (`categories: all`,
  `output-root: docs/audit`, `fallow: required`) plus review-screen
  scope (`mode: all` with no baseline rows, or `mode: changed-since` plus
  `baseline-ref` and `baseline-date`) and review-screen git keys. Do not
  ask about categories, output-root, or fallow. If the user later
  persists a category subset from `lodestar-audit`, leave that row as
  they wrote it on a re-run unless they ask to reset it. If `mode` rows
  already exist, leave them — the baseline does not move on a re-run.
- Excluded Paths — review-screen globs as `### Excluded Paths` under
  Audit Configuration; replace wholesale.

Leave the `## Reference` section as the template has it — the principles
link must stay pointed at `.agents/skills/lodestar-setup/principles.md`.

If the file already exists and still has pre-0.9 headings (`## Audit
Settings`, `## Audit Scope`, `## Git`, `## Excluded Paths`,
`## Principles`, `## Skills`, `## Audit Output`), rewrite from the
template — those files fail the parser until regenerated. If it is
already the 0.9 shape, replace `## Build & Test`,
`## Dependency Direction`, `## Package Layout`, and `## Conventions`;
leave other user content. Do **not** replace `## Audit Configuration`
wholesale: refresh git keys (`commits`, `subject-format`, `trailer`,
`protected`, `require-clean`) and `### Excluded Paths` from this run;
leave `categories`, `output-root`, `fallow`, `mode`, `baseline-ref`,
and `baseline-date` if those rows are present (unless the user asks to
reset them). Missing `## Conventions` → insert between
`## Package Layout` and `## Audit Configuration`. Missing
`## Audit Configuration` → insert after `## Conventions` (or
`## Package Layout`) with the defaults above.

Create the `.agents/lodestar/` directory if needed, and write to
`.agents/lodestar/context.md`. Write it in both enforcement modes —
Conventions and Audit Configuration included.

### AGENTS.md — only in `full` mode

If `ENFORCEMENT_MODE` is `skills-only`, **do not touch `AGENTS.md`**. Skip
to Step 6.

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
