# Step 2 — Confirm one thing

Present a single short summary:

- The package manager you detected (or that you could not tell), and
  where commands came from (`package.json` scripts, Makefile, …).
- The commands you found (`n/a` if a check does not exist).
- The observed package import graph — acyclic chain or cyclic edge list,
  using the repo's actual package names.
- How the layout was found, and the table — name, path, alias, entry
  points, responsibility, Scannable. Name unscannable rows. An empty
  graph is valid for a single-package repo.
- The four churn numbers (or "not a git repository").

When the graph is cyclic, state plainly that it is cyclic, show the cycle
edges, and say they will be recorded as-is and reported by the audit as
circular dependencies. Ask the user to correct the graph only if the
_observation_ is wrong — do not ask them to declare a target layout.

If the manager is unclear, ask here. When none of npm / yarn / pnpm /
Bun was detected, ask name, exec prefix, and add-dev — not a closed
list. Do not proceed with install prefixes until that is answered.

Ask the user to correct anything wrong. One round of feedback only.
Do not ask about conventions (Step 3) or commit policy (Step 3a) here.
Do not ask whether the layout is "right" — that's
`lodestar-architecture`'s job, not setup's.
Then a second confirmation: excluded-path candidates with evidence,
one round to add/remove (empty allowed). Write `### Excluded Paths`
under `## Audit Configuration` from that answer in both enforcement modes.

Then the audit-scope question. Show the four numbers. Skip the question
when the repo is not git (`mode: all`) or `## Audit Configuration` already
has `mode` (leave it — the baseline does not move on a re-run).
Recommend `changed-since` when files ≥ 80 **and** churn < 0.30;
otherwise `all`. Always show the numbers.

> This repo has N commits since <date>, M source files, and K of them
> were touched in the last 90 days. Scope the audit to code changed
> since today's commit, keeping the rest as a reported backlog? Or
> expand every finding into an action item? Recommended:
> **<changed-since | all>** (threshold: 80 files and 30% churn).

On `changed-since`, capture `git rev-parse HEAD` and today's
`YYYY-MM-DD`; name the sha and say older-code findings are counted, not
expanded. On `all`, write `mode: all` with no baseline rows.
