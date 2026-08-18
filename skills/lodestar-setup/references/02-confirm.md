# Step 2 — Confirm one thing

Everything you show the user here is read by a person, not a machine.
Follow `SKILL.md`'s "How to talk to the user": point first, bullets not
paragraphs, blank line between blocks, bold lead-ins, no jargon they did
not use first, and no thresholds or ratios they would have to do
arithmetic on. Where a term is unavoidable, say what it means in the same
breath.

Present a single short summary:

- The package manager you detected (or that you could not tell), and
  where commands came from (`package.json` scripts, Makefile, …).
- The commands you found (`n/a` if a check does not exist).
- Which package imports which, using the repo's actual package names.
- How the layout was found, and the table — name, path, alias, entry
  points, responsibility, Scannable. Name any package that cannot be
  scanned. A single-package repo has nothing to show here, which is fine.
- How old the repo is, how many source files it has, and how many of them
  changed in the last 90 days (or "this is not a git repository").

If two packages import each other, say so in plain words — "`a` imports
`b`, and `b` imports `a` back" — and say you will record it as it is, and
that the audit will report it as a circular dependency. Ask the user to
correct this only if what you observed is wrong. Do not ask them what the
imports _should_ look like.

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

Then the audit-scope question. Skip it when the repo is not git
(`mode: all`) or `## Audit Configuration` already has `mode` (leave it —
the baseline does not move on a re-run).

Ask which code the audit should write fix instructions for. Give the two
numbers that matter, then the two choices in plain words, then your
recommendation and the reason for it in one sentence. Do not use the word
"churn" or show a percentage; say how many files changed recently out of
how many there are.

> This repo has M source files, and K of them changed in the last 90
> days. Which code should the audit write fix instructions for?
>
> - **All of it** — every problem it finds becomes a fix you can act on.
>   Nothing is held back, but the first audit can be a long list.
> - **Only code you touch from now on** — problems in code you change
>   after today become fixes. Problems in older code are still found and
>   listed, but only as a backlog you can pull from later.
>
> Recommended: **<All of it | Only code you touch from now on>**,
> because <reason>.

Pick the recommendation this way: "only code you touch" when there are
≥ 80 source files **and** fewer than 30% of them changed recently —
reason: most of this code is not being worked on, so a full list would be
mostly things nobody is about to touch. Otherwise "all of it" — reason:
the codebase is small enough, or most of it is actively changing, so the
full list stays useful.

Record "only code you touch" as `changed-since`: capture
`git rev-parse HEAD` and today's `YYYY-MM-DD`. Tell the user the short
sha, and that older-code problems are still counted, just not written up
as fixes. Record "all of it" as `mode: all` with no baseline rows.
