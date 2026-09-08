# Step 2 — Review what was observed

Present **one message**. Do not split this across turns. Bold headings,
in this order. Skip a heading only when it cannot apply. Always show
**Layout**. When `lodestar-audit` is not among the installed siblings,
skip **Frameworks & scan extensions**, **Fallow entry points**,
**Excluded paths**, **Audit scope**, and **Commit default**.

**Commands** — the package manager you detected, where commands came
from (`package.json` scripts, Makefile, …), and the commands you found
(`n/a` if a check does not exist). Name the linter you detected, or
"none configured".

**Layout** — how the layout was found, and the table: name, path, alias,
entry points, responsibility, Scannable. Name any package that cannot be
scanned. You may show which package imports which today as ephemeral
evidence — not as recorded policy. A single-package repo has an empty
import graph; still show the table. Do not ask whether the layout is
"right" — that's `lodestar-architecture`'s job, not setup's. Do not
offer to write the observed graph into `context.md`.

**Dependency policy** — skip when the user has not stated an intended
order. Otherwise show the chain or edges they confirmed. If they want a
policy and have not given one, ask once in plain words what may import
what — never propose today's topological sort as the answer.

**Docs** — skip when Step 1 found no documentation trees. Otherwise list
each path with what you will treat it as, in plain words — not the
file's Role key:

- harvest rescued facts into it
- sweep leftovers here
- in progress, leave it
- not sure yet

One line of what it is for. Corrections at face value (move a path
between those four, or drop it). Do not create folders to fill gaps.

**Frameworks & scan extensions** — only when audit is installed. Name
the UI frameworks you believe are in use (or "none beyond TS/JS"), and
the file extensions the audit will scan. Skip when the repo is plain
TS/JS with no extra extensions beyond the default list.

**Fallow entry points** — only when audit is installed. Skip when the
repo is a single app and you expect auto-discovery to suffice.
Otherwise list each app surface and say you will write them to
`.fallowrc.json` `entry` and verify with `--minimum N`.

**Circular imports** — if two packages import each other today, say so
in plain words — "`a` imports `b`, and `b` imports `a` back". The audit
(when installed) will report that as a circular dependency from live
evidence. Do not say you will record the observed cycle as Dependency
Policy. Ask the user to correct only if what you observed is wrong. Skip
when there are no cycles.

**Excluded paths** — only when audit is installed. Candidates with a
one-line reason each. Empty is allowed. Write `### Excluded Paths`
under `## Audit Configuration` from the confirmed list.

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

- harvest → `home`
- sweep leftovers → `staging`
- in progress → `inflight`
- not sure yet → `unknown`

- errors as values → `result-types: yes` when yes, `no` when not
- distinct ID types → `branded-types: yes` when yes, `no` when not
- design tokens → `design-tokens: yes` when yes, `no` when not
- no re-export-only files → `barrel-exports: no` when yes (none found);
  `yes` when not (re-export files are allowed)
- coverage floor → the confirmed integer or `none`

**Review rubric** — the **extra** repo files a later review should read
on top of the suite principles (principles are implicit from the
installed setup skill; do not list them here and do not offer to drop
them). List each discovered path in plain words, one bullet. Empty
extras is allowed — then say "suite principles only". Corrections at
face value (add a path, drop a path). Do not invent files.

**Audit scope** — only when audit is installed. Skip when the repo is
not git (`mode: all`) or `## Audit Configuration` already has `mode`
(leave it — the baseline does not move on a re-run).

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
sha, and that the audit will **scan only files changed since that
baseline** — older code is listed in `INDEX.md` as not scanned, not as a
whole-repo backlog count. They can widen a later audit run to include
more files. Record "all of it" as `mode: all` with no baseline rows.

**Commit default** — only when audit is installed. `lodestar-fix` will
**ask each time** before it commits. Do not show commit-message format,
trailer, protected branches, or hooks on this screen; still write those
keys to `## Audit Configuration` from the Step 1 detection (defaults:
`commits: ask`, trailer `Closes <item>.`, `require-clean: no`). Record a
correction as `commits: ask` / `per-item` / `never`. `never` means no
ask, no commit, edits stay unstaged. When audit is absent, skip this
heading and do not write commit keys.

Do not ask about enforcement here. Default `ENFORCEMENT_MODE` to
`skills-only`. The `AGENTS.md` row on the permissions screen is what
promotes it to `full`.

End with one round of feedback — `ok`, or corrections. Take corrections
at face value. Do not re-measure. Do not ask a second round.
