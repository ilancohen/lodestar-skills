# Step 5 — Write the files

Use the templates beside `SKILL.md`. Fill every `[bracketed
placeholder]` with real values. Announce each file before writing it.

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
- The Conventions table — the five keys from Step 3, with the confirmed
  values. Use the skip-value polarity from the template (`barrel-exports:
yes` means barrels are allowed).
- The Audit Settings table — defaults (`categories: all`, `output-root:
docs/audit`, `fallow: required`). Do not ask about these. If the user later persists a
  category subset from `lodestar-audit`, leave that row as they wrote it
  on a re-run unless they ask to reset it.
- The Audit Scope table — Step 2. `mode: all` with no baseline rows, or
  `mode: changed-since` plus `baseline-ref` (the captured sha) and
  `baseline-date` (today). If the section already exists, leave it.
- Excluded Paths — Step 2 globs; replace wholesale; insert between
  Package Layout and Conventions if missing. Git table — Step 3a.

Leave the `## Principles` and `## Skills` sections as the template has
them — the principles link must stay pointed at
`.agents/skills/lodestar-setup/principles.md`.

If the file already exists, replace `## Build & Test`,
`## Dependency Direction`, `## Package Layout`, `## Conventions`,
`## Excluded Paths`, and `## Git`; leave other user content. If
`## Conventions` is missing (a pre-0.5 file), insert it between
`## Package Layout` and `## Principles`. If `## Audit Settings` is
missing, insert it between `## Conventions` and `## Principles` with
the defaults above. If it already exists, leave it — a stored category
subset or output-root must survive a setup re-run. Missing `## Audit
Scope` → insert between `## Audit Settings` and `## Git` (or
`## Principles`); if present, leave it. Missing `## Git` → insert after
`## Audit Scope` when present, else between `## Audit Settings` and
`## Principles`.

Create the `.agents/lodestar/` directory if needed, and write to
`.agents/lodestar/context.md`. Write it in both enforcement modes —
Conventions, Audit Scope, and Git included.

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
