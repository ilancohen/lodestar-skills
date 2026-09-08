# Step 1 — Review what was observed

Present **one message** from the collect **stdout projection**. Do not
split across turns. Do not read the state file into chat.

If `layout.packagesTruncated` (or any truncated list): say
shown/total and offer the state path for inspection — do not open it.

Bold headings in this order. Skip a heading only when it cannot apply.
Always show **Layout**. When `hasAudit` is false, skip **Frameworks &
scan extensions**, **Fallow entry points**, **Excluded paths**,
**Audit scope**, and **Commit default**.

**Commands** — `pkgManager`, `commands`, and linter `tool` (or "none
configured").

**Layout** — `layout.source` and the package table (name, path, alias,
entry points, responsibility, Scannable). Prioritize rows the
projection already ordered (unscannable / cyclic first). Optional:
show capped `importEdges` as ephemeral evidence — never as recorded
policy. Do not ask whether the layout is "right".

**Dependency policy** — skip unless the user already stated an intended
order. If they want a policy and have not given one, ask once in plain
words — never propose today's edges as the answer.

**Docs** — skip when `docs.total === 0`. Else list each path in plain
words (harvest / sweep leftovers / in progress / not sure yet).

**Frameworks & scan extensions** — audit only. Skip when only default
TS/JS extensions.

**Fallow entry points** — audit only. Skip for a single-app repo when
auto-discovery should suffice. Otherwise list each distinct app surface
that exists on disk (`index.html`, `src/main.ts`, Next `app/**/page.tsx`,
…). Record the globs in corrections as `fallowEntry: { globs: [...],
minimum: N }`. Do not invent paths. These become `.fallowrc.json`
`entry` — not import-graph edges.

**Circular imports** — from `importEdges.cyclicPackages` (or edges).
Plain words. Do not record cycles as Dependency Policy. Skip when empty.

**Excluded paths** — audit only. Candidates with one-line reasons.
Empty allowed.

**Conventions** — one line each from `conventions.suggested` /
`evidenceHits` / `recorded`. Recorded values beat a miss. No evidence
paths on screen.

**Review rubric** — repo-owned extras only (`rubric.paths`). Empty →
"suite principles only". Never list bundled `principles.md`.

**Audit scope** — audit only. Skip when `auditScope.noGit` or existing
context already has `mode`. Else state the default from
`modeDefault` / fileCount / touched90d — no "churn" word, no raw git
log. "Only code you touch" → record `changed-since` with short sha +
today's date into corrections; "all of it" → `mode: all`.

**Commit default** — audit only. Fix will **ask each time**. Corrections:
`commits: ask` / `per-item` / `never`.

Default `ENFORCEMENT_MODE` to `skills-only`. The `AGENTS.md` permissions
row promotes it to `full`.

### Corrections (one round)

End with `ok` or corrections. Take at face value. Write a **small**
corrections JSON (only what changed), e.g.:

- `projectDescription`
- `packageResponsibilities`
- `dependencyPolicy`
- `docs` / `conventions` / `rubric` / `exclusions` / `commands` /
  `pkgManager` / `scanExtensions` / `fallowEntry` / audit scope / commits

Do not re-measure. Do not ask a second round.
