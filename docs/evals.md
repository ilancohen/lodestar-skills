# Manual eval checklist

Update when skill behavior or triggering changes. Full contracts live in
each skill's `SKILL.md` / `references/` and the unit tests — this file
lists executable scenarios and assertions only.

## Measured runs

```bash
node scripts/eval-run.mjs validate path/to/run.json
node scripts/eval-run.mjs summarize path/to/run.json
node scripts/eval-run.mjs compare --baseline tests/fixtures/evals/baseline.json path/to/run.json
node scripts/eval-run.mjs list-scenarios
node scripts/eval-run.mjs validate-baseline
node scripts/eval-run.mjs list-hosts
```

Scenarios: `tests/fixtures/evals/scenarios/`. Raw captures:
`tests/fixtures/evals/results/` (gitignored). Commit only the reviewed
aggregate in `tests/fixtures/evals/baseline.json`.

`pnpm check` gates each skill's aggregate `markdownWords` against that
baseline. A rise needs an explicit baseline update naming the quality
benefit. Unknown host metrics stay `null`. Host journeys are
`passed` / `failed` / `untested` — never mark an unavailable host passed.

After every workflow change, re-run the five stage-01 scenarios and
compare cost, precision, seeded recall, questions, artifact size, and
resume success to baseline. Explain accepted regressions in the
aggregate `notes`.

All seven skills set `disable-model-invocation: true`. Spot-check with
the phrases below; ambient task language must not load them.

## Scenarios

| Id | Skills | Assert |
| --- | --- | --- |
| `setup-architecture-no-fallow` | setup, architecture | No Fallow checks/writes on non-audit install |
| `single-package-setup-audit-fix` | setup, audit, fix | Setup → audit → fix; compact items; consent commits |
| `mixed-vue-scoped-audit-resume` | audit | Scoped/changed scan, interrupt, next-day resume |
| `plan-implement-dirty-no-commit` | plan, implement | Dirty files stop; no-commit choice; filesystem index |
| `architecture-docs-cleanup-safety` | architecture, docs | Advisory only; live audits protected |

## Triggering (exact name)

| Skill | Should trigger | Near-miss (must not) |
| --- | --- | --- |
| setup | "Run lodestar-setup…", `/lodestar-setup` | "Document our packages…", "Is my lodestar context still accurate?" |
| audit | "Run lodestar-audit…", "Is my lodestar context still accurate?", `/lodestar-audit` | "Find architecture violations…", "Produce the lodestar finding files…" |
| fix | "Run lodestar-fix…", `/lodestar-fix` | "Apply all unstarted low-risk items…", "Land the lodestar action items…" |
| architecture | "Run lodestar-architecture…", `/lodestar-architecture` | "Describe this repository's package architecture…", "Write the architecture-review report…" |
| docs | "Run lodestar-docs…", `/lodestar-docs` | "Clean up the docs folder.", "Delete the done plans." |
| plan | "Write a lodestar-plan…", `/lodestar-plan` | "Write a plan under docs/plans/…", "Create a plan for implement-plan." |
| implement | "Run lodestar-implement…", `/lodestar-implement` | "Execute the plan under docs/plans/.", "Land the remaining stages…" |

## Smoke / adapters

```bash
node scripts/smoke_install.mjs
pnpm test -- tests/smoke_install.test.mjs
pnpm dlx skills add . --list
```

Clean install/update/rollback, partial-install matrices, Fallow gating
(non-audit installs omit audit), and bundled `principles.md` beside
setup for cursor / claude-code / codex adapter shapes. Record full
agent journeys on Cursor and at least one other host in
`baseline.hostJourneys`; leave the rest `untested`.

## Conversation cost (setup)

Setup conversation cost is gated hermetically: `setup-state.mjs`
stdout caps, golden `write-context` fixtures, and unit tests that prove
large workspaces keep the same bounded projection while full state
retains every package. Informal Cursor figures (~44.8K context /
~21.7K conversation before the slimdown) are motivation only — do not
require a new Cursor journey to accept this work.
