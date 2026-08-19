---
name: lodestar-audit
description: >-
  Audits a codebase against the engineering principles documented by lodestar-setup
  and writes self-contained findings and action items under the
  output-root in context.md (default docs/audit/).
  Discovery only; never modifies application source. Restartable from
  findings.md. Do not load unless the user explicitly invokes lodestar-audit
  by name.
disable-model-invocation: true
license: MIT
compatibility: >-
  Requires git, a POSIX-compatible shell, Node.js, and Fallow ^3.15.0
  (combined schema 10 or newer) declared in root package.json and
  installed under node_modules/.bin unless Audit Configuration records
  fallow optional.
  Designed for JavaScript/TypeScript repositories. npm, pnpm, yarn, and
  Bun are detected from lockfiles; any other manager works when recorded
  in context.md. Deno and Bazel are not supported.
metadata:
  author: Ilan Cohen
  version: "0.12.0"
---

You are running a lodestar audit. **Discover** and
**document** violations as self-contained action items. Do not fix them.

Each action-item file must stand alone: an agent reading only that file
should have everything needed to land the fix.

Scripts live beside this `SKILL.md` under `scripts/`. Run them with
`node scripts/<name>.mjs` from this skill directory, or with an absolute
path to that file.

---

## How to talk to the user

Anything you print or ask is read by a person who is skimming.

What you say:

- Ask one clear question at a time. Say what happens for each answer.
- Name a thing by what it does, not by its internal key — "how files
  import each other", not `imports` #7.
- Keep run ids, config keys, and file paths to where they are genuinely
  needed.
- Give counts, not ratios. Never ask the user to compare a number to a
  threshold; give your recommendation and a one-line reason.
- Never trim or postpone a warning. A blind spot, a stale basis, or a
  skipped category stays in, however short the message.
- Short sentences. No unexplained abbreviations. No filler openers.

How you lay it out:

- Put the point first. No wind-up, no restating it at the end.
- Bullets, not paragraphs. One idea per bullet, one or two sentences.
- Blank line between blocks. Never one dense block of text.
- Bold the first few words of each bullet, plus any count, file name, or
  recommendation, so reading only the bold still gives the gist.
- Say the least that fully answers, then stop.

Findings and action-item files are written to a template and are not
covered by the layout rules above. Their prose still follows the
plain-language rules.

---

## Structure model

This audit is **structure-agnostic**. It does not assume roles like
`core`, `api`, or `ui`. It uses four things from
`.agents/lodestar/context.md`:

1. `## Package Layout` — package names, paths, aliases, a one-sentence
   responsibility per package, and optional `Scannable` (`yes` / `no`;
   absent means `yes`). Rows marked `no` are not scanned.
2. The declared dependency direction — allowed import direction.
3. `## Conventions` — which style conventions the repo follows. Detectors
   skip at a row's skip value (see the Categories table). A missing
   section means every default.
4. `## Audit Configuration` — optional category subset, `output-root`
   (default `docs/audit`), and `fallow` (default `required`).

Detectors run package-by-package. Kind-of-code rules use the
Responsibility column and path patterns, never the package name alone.

---

## Two-phase structure

```
Phase 1 — DISCOVER     →  <output-root>/<RUN_ID>/findings.md
Phase 2 — PLAN         →  <output-root>/<RUN_ID>/INDEX.md + NNN-….md files
```

`findings.md` is the seam. Discover writes finding blocks only — the
same set under every scope. Plan expands in-scope findings into action
items. A human may edit `findings.md` between phases, including flipping
`in_scope`. Both phases are restartable with the same `<RUN_ID>`. The first run
under a scope is the working set; `INDEX.md`'s Backlog says how much is
left and where; a later session promotes one category or package at a
time without re-discovering.

Never overwrite a previous run. Output stays under
`<output-root>/<RUN_ID>/` (`outputRoot` from `validate-input` /
`resolve-run`; default `docs/audit`).

---

## Preconditions

If `.agents/lodestar/context.md` is missing, **stop** and tell the user to
run `lodestar-setup`. That file is the only repo context this skill reads;
do not fall back to `AGENTS.md` even if it happens to hold a layout table
from an older setup.

Then run:

```text
node scripts/audit-state.mjs validate-input --root <repo>
```

If that command exits non-zero, print its error and stop. It rejects a
missing Package Layout, placeholder Responsibilities (shorter than 20
characters, `TODO`/`TBD`/`???`/`one sentence`, or a bare noun like
`core`), a `Scannable: yes` row with zero TypeScript or JavaScript
files, an unparseable `## Conventions` value, and an unparseable
`## Audit Configuration` value.

Then, unless the user is resuming an existing run, run:

```text
node scripts/audit-state.mjs check-freshness --root <repo>
```

Exit 0: continue. Exit 2: print the stderr list and ask once:

> The repo has changed since setup ran, so what I know about it is out of
> date: [list, in plain words]. I can audit anyway — findings may be off
> where the notes are wrong — or stop so you can re-run `lodestar-setup`
> first. (carry on / stop)

On stop, create no run directory. Do not run `lodestar-setup` inline.
On proceed, pass the stdout JSON to `resolve-run` as `--drift`. A
resumed run does not re-run `check-freshness`; it inherits the `drift`
key recorded at creation.

A package marked `Scannable: no` is listed in `INDEX.md`'s
known-blind-spots by name and reason (`worker` — Python, not scanned).
It is excluded from `allPkgRoots` and from every detector. In a
single-package repo (one scannable row, empty graph), list `imports`
#6 and `boundaries` B as not applicable there too.

A category or subtype gated off by `conventions` is reported as skipped
in `INDEX.md`'s known-blind-spots, not silently absent. Discover still
checkpoints it complete with count 0. Exception: `coverage-floor: none`
drops the coverage-floor line from known-blind-spots and does not add a
skip row — there is nothing to check.

If `pkgManager` is null, ask for the manager, its exec prefix, and its
add-dev command before any install or `dlx`/`npx`/`bunx` command. Do
not offer only npm / yarn / pnpm when none of those lockfiles is
present. Do not guess. `pkgManagerProvenance` is `lockfile`,
`context.md`, or `none`. If `<lint>` is `n/a`, skip linter probes and
use grep heuristics — do not error. Otherwise use `validate-input`
`linter.probe` (see [references/linter-probe.md](references/linter-probe.md)).

Read `.agents/lodestar/context.md` for commands, direction, conventions,
and the layout table, then follow its link to
`.agents/skills/lodestar-setup/principles.md` for the principles content.

---

## Categories

Read the category sub-doc before scanning that category. Read
`categories/fallow-seed.md` once before Discover. A category doc names
sibling categories in prose; it does not load them, and it does not
load `references/`.

| Category      | Sub-doc                     | Risk        | Detection style               | Gated by                                                 |
| ------------- | --------------------------- | ----------- | ----------------------------- | -------------------------------------------------------- |
| `imports`     | `categories/imports.md`     | low         | mechanical (Fallow preferred) | `#4` when `barrel-exports` is `yes`                      |
| `types`       | `categories/types.md`       | low         | mechanical                    | `#4` when `branded-types` is `no`                        |
| `boundaries`  | `categories/boundaries.md`  | medium–high | mechanical                    | `A` when `branded-types` is `no`                         |
| `errors`      | `categories/errors.md`      | high        | mechanical                    | `#B` when `result-types` is `no`                         |
| `testability` | `categories/testability.md` | high        | mechanical                    | drop coverage blind-spot when `coverage-floor` is `none` |
| `soc-yagni`   | `categories/soc-yagni.md`   | low–high    | mixed                         | —                                                        |
| `dry`         | `categories/dry.md`         | low–medium  | mixed                         | —                                                        |
| `ssot`        | `categories/ssot.md`        | low–medium  | mechanical                    | —                                                        |
| `styling`     | `categories/styling.md`     | low–medium  | mechanical                    | whole category when `design-tokens` is `no`              |

Known blind spots (copy into `INDEX.md`): if this run skipped the Fallow
seed (`fallow: optional` and Fallow missing or invalid), put this first
and prominently: **not checked at all** — `imports` #7–#9, `dry` A,
`soc-yagni` A ranking. Then: coverage floor when it is a
number and `<test>` does not emit coverage; wide-diff DRY as `dry.C`
advisory only; Rule of Three beyond `soc-yagni.D`; whether the documented
layout is the right one (`lodestar-architecture`). Append any
convention-gated detector this run skipped (name the category, subtype,
and key). Do not list `coverage-floor: none` as a skip — omit that
line entirely. Append every `Scannable: no` package by name and
reason (`worker` — Python, not scanned). In a single-package repo,
append `imports` #6 and `boundaries` B as not applicable.

---

## Consent and phase selection

Load [references/resume.md](references/resume.md) before resolving or
creating a run. Load [references/discover.md](references/discover.md)
before any detector. Load [references/plan.md](references/plan.md)
before writing action items. Load
[references/output-contracts.md](references/output-contracts.md) before
writing or merging `findings.md`.

1. Run `node scripts/audit-state.mjs resolve-run --root <repo>`
   (add `--drift '<json>'` when Preconditions chose proceed).
   Capture `outputRoot` and `path` from the JSON.
2. If `inProgress` is non-empty, ask: "There's an unfinished audit from
   `<date>`. Pick up where it left off, or start over? (pick up / start
   over)". Resume with
   `resolve-run --root <repo> --resume <RUN_ID>`.
   If `inProgress` is empty, look at the latest run directory under
   `outputRoot` (not only today's date). When `INDEX.md` exists and
   `findings.md` has any `in_scope: false` (or `## Backlog` total >
   0), offer: "The last audit left `<N>` problems in its backlog without
   fix instructions. Want me to write those up now, instead of scanning
   again? (write them up / scan again)". On the first: `--resume` that id,
   **skip Discover**, flip `in_scope: true` on the chosen slice (one
   category, one package, or all), re-run Plan only. Do not re-merge. Do
   not ask the Discover consent questions.
3. Print: "I'll put the results in `<output-root>/<RUN_ID>/`."
4. List the categories in plain words, not as bare keys — e.g. "imports
   (how files depend on each other)", "errors (how failures are handled)".
   If `validate-input`'s `categories` is a subset of the nine, present
   that subset as the default: "Setup says to check these: `<list>`.
   Go ahead? (yes / choose different ones / check everything)". The user
   can widen this run without editing `context.md`. If `categories` is all
   nine, ask: "I'll check all nine areas. Go ahead? (yes / choose a
   smaller set)". Wait.
   After they pick a subset (this run, or confirming a stored subset),
   ask once: "Should future audits default to this same set? (yes / no —
   either way, this run uses it)". On yes, replace the `categories` row;
   do not change `output-root`. Do not ask when they chose all nine, or
   when the stored subset already matches. This edits `context.md`, not
   application source.
5. If `validate-input` `scope.mode` is `changed-since`, say in plain words
   that setup limited fix instructions to code changed since `<date>`, and
   that everything else is still found but only listed. Then offer, for
   **this run only** (do not write the answer to `context.md`): keep it
   that way / write up everything / write up the backlog for one area /
   write up the backlog for one package. Widen-all → omit
   `--changed-files`. One category or package → after merge, flip those
   findings to `in_scope: true` before Phase 2. Say that widening here
   changes this run only, not the setting.
6. After Discover, ask: "Want me to write up fix instructions for these
   now, or stop here? (write them up / stop)". If they stop, stop. The run
   stays resumable.

Skip steps 4–6 and Discover when step 2 chose promote.

Do not scan before those confirmations.

---

## Discover (Phase 1)

Follow [references/discover.md](references/discover.md). Summary:

1. Resolve the package set from `validate-input` JSON.
2. Run the Fallow seed from `categories/fallow-seed.md`. If Fallow is
   missing or invalid: stop when `fallow` is `required` (the default);
   when `optional`, continue with grep-only detectors and list the
   unchecked subtypes in `INDEX.md` (`imports` #7–#9, `dry` A,
   `soc-yagni` A ranking).
3. Mechanical pass in category order, then semantic pass.
4. Merge with `node scripts/audit-state.mjs merge-findings`. When
   `scope.mode` is `changed-since`, pass `--changed-files` from
   `changed-files --root <repo> --since <baselineRef>`. Detectors still
   ran repo-wide; this only sets `in_scope`.
5. Validate with `node scripts/audit-state.mjs validate-output --path
<output-root>/<RUN_ID>/findings.md`.
6. Checkpoint a category as complete only after it is finished for every
   package, including the semantic pass for `soc-yagni` and `dry`. During
   a package loop use `checkpoint --status partial --package <name>`.

Discovery never modifies application source. The only filesystem writes
are `<output-root>/<RUN_ID>/`, an optional consented edit of
`.agents/lodestar/context.md` `## Audit Configuration`, and the transient
`.audit-fallow-seed.json`
(delete it after Phase 1).

---

## Plan (Phase 2)

Follow [references/plan.md](references/plan.md) — grouping, numbering,
and INDEX wording; not a hop to category docs. Summary:

1. Recover with `node scripts/audit-state.mjs recover --run-dir
<output-root>/<RUN_ID>`.
2. Group **in-scope** findings (`in_scope: true`) by `scope_unit`. Write
   `<output-root>/<RUN_ID>/<NNN>-<category>-<slug>.md` from
   `templates/action-item.md`. First Plan: number `001…0NN` with no
   gaps. Promotion: skip any finding that already has a
   `*-<category>-<slug>.md`; new files take IDs from `max(NNN)+1`.
   Out-of-scope findings are counted in `INDEX.md` Backlog, never
   dropped.
3. Validate each file for placeholder leaks.
4. Write `INDEX.md` from `templates/index.md`. Fill Known blind spots
   from the list in Categories above, plus this run's gated skips,
   plus every `Scannable: no` package (`<name>` — `<language>, not
scanned`). Drop the coverage-floor line when
   `conventions["coverage-floor"]` is `none`. Fill `## Backlog` even
   when empty.
5. Align category order with `lodestar-fix`:
   `imports → types → ssot → soc-yagni → boundaries → errors →
testability → dry → styling`.

---

## Rules

- **Read-only.** Never modify application source. Writes: `<output-root>/`,
  an optional consented `## Audit Configuration` edit, plus transient
  `.audit-fallow-seed.json`.
- **Consent first.** Category subset and Phase 2 start are questions.
  Wait for answers.
- **Stop conditions:** missing setup files; `validate-input` failure
  (including a `Scannable: yes` package with zero scannable files);
  freshness drift when the user chooses stop; Fallow missing or invalid
  when `fallow` is `required`; required commands missing; the user says
  stop.
- **In-scope only.** Write an action item only for `in_scope: true`.
  The backlog is reported in `INDEX.md`, never silently dropped.
- **One concern per action item.** Split "and also…".
- **Self-contained.** No "see the audit skill" in generated files.
- **No placeholder leaks.** Treat any `<typecheck>`-style leftover as a
  bug; `validate-output` must pass.
- **`requires_decision: true`** is the default for semantic findings.
- **Don't fix.** Don't propose layout changes; mention
  `lodestar-architecture` in `notes:` if needed.
- **Restartable.** Interrupted runs resume from checkpoints. Past run
  directories are never replaced. Promoting a backlog slice may append
  `NNN-*.md` files and rewrite `INDEX.md` in that same run.

---

## Re-running

Load [references/resume.md](references/resume.md). Invoke again; resume
from the last checkpoint. To re-run Plan from scratch after editing
`findings.md`, delete `NNN-….md` plus `INDEX.md` first. To **promote a
backlog slice**, keep those files: skip Discover, flip `in_scope` on
the slice, re-run Plan so new files append and `INDEX.md` is rewritten.
