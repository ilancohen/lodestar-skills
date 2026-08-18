# Step 2 — Review what was observed

Everything you show the user here is read by a person, not a machine.
Follow `SKILL.md`'s "How to talk to the user": point first, bullets not
paragraphs, blank line between blocks, bold lead-ins, no jargon they did
not use first, and no thresholds or ratios they would have to do
arithmetic on. Where a term is unavoidable, say what it means in the same
breath.

Present **one message**. Do not split this across turns. Bold headings,
in this order. Skip a heading only when it cannot apply (no cycles, not
a git repo, or `mode` already recorded). Always show **Layout**.

**Commands** — the package manager you detected, where commands came
from (`package.json` scripts, Makefile, …), and the commands you found
(`n/a` if a check does not exist).

**Layout** — how the layout was found, and the table: name, path, alias,
entry points, responsibility, Scannable. Name any package that cannot be
scanned. Show which package imports which, using the repo's actual
package names — no per-package import counts. A single-package repo has
an empty import graph; still show the table. Do not ask whether the
layout is "right" — that's `lodestar-architecture`'s job, not setup's.

**Circular imports** — if two packages import each other, say so in
plain words — "`a` imports `b`, and `b` imports `a` back" — and say you
will record it as it is, and that the audit will report it as a circular
dependency. Ask the user to correct this only if what you observed is
wrong. Do not ask them what the imports _should_ look like. Skip this
heading when there are no cycles.

**Excluded paths** — candidates with a one-line reason each. Empty is
allowed. Write `### Excluded Paths` under `## Audit Configuration` from
the confirmed list in both enforcement modes.

**Conventions** — one line each, no evidence paths. Frame as what the
repo already does, not as what to enforce. Pre-check per row from the
Step 1 sweep — do not apply one rule to every row. A value already in
`## Conventions` beats a sweep that misses it: show the recorded value;
do not flip it to the miss. Corrections still at face value.

- errors as values (`result-types`): yes when the signal was found; no
  when not
- distinct ID types (`branded-types`): yes when found; no when not
- no re-export-only files (`barrel-exports`): yes when **no** `export *`
  was found (the default); no when one was
- named design tokens (`design-tokens`): yes when found; no when not
- minimum test coverage: the number from the test config, or `80` when
  not found

The keys below go in the file; do not put them on screen:

- errors as values → `result-types: yes` when yes, `no` when not
- distinct ID types → `branded-types: yes` when yes, `no` when not
- design tokens → `design-tokens: yes` when yes, `no` when not
- no re-export-only files → `barrel-exports: no` when yes (none found);
  `yes` when not (re-export files are allowed)
- coverage floor → the confirmed integer or `none`

**Audit scope** — skip this heading when the repo is not git (`mode:
all`) or `## Audit Configuration` already has `mode` (leave it — the
baseline does not move on a re-run).

Otherwise state the default, not a question. Give the two numbers that
matter, then the default and the reason in one sentence. Do not use the
word "churn" or show a percentage; say how many files changed recently
out of how many there are. Do not print the keys `changed-since` or
`all`.

Pick the default this way: "only code you touch from now on" when there
are ≥ 80 source files **and** fewer than 30% of them changed recently —
reason: most of this code is not being worked on, so a full list would be
mostly things nobody is about to touch. Otherwise "all of it" — reason:
the codebase is small enough, or most of it is actively changing, so the
full list stays useful.

> This repo has **M** source files, and **K** of them changed in the last
> 90 days. The audit will write fix instructions for **<All of it | Only
> code you touch from now on>**, because <reason>.

Record "only code you touch" as `changed-since`: capture
`git rev-parse HEAD` and today's `YYYY-MM-DD`. Tell the user the short
sha, and that older-code problems are still counted, just not written up
as fixes. Record "all of it" as `mode: all` with no baseline rows.

**Commit default** — `lodestar-fix` will **ask each time** before it
commits. Do not show commit-message format, trailer, protected branches,
or hooks on this screen; still write those keys to `## Audit
Configuration` from the Step 1 detection (defaults: `commits: ask`,
trailer `Closes <item>.`, `require-clean: no`). Record a correction as
`commits: ask` / `per-item` / `never`. `never` means no ask, no commit,
edits stay unstaged. Write git keys in `## Audit Configuration` in both
enforcement modes.

Do not ask about enforcement here. Default `ENFORCEMENT_MODE` to
`skills-only`. The `AGENTS.md` row on the permissions screen is what
promotes it to `full`.

End with one round of feedback — `ok`, or corrections. Take corrections
at face value. Do not re-measure. Do not ask a second round.
