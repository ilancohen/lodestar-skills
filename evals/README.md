# Evaluations

Each skill has `evals/triggers.json` (8–10 positive, 8–10 near-miss) and
`evals/evals.json` with machine-checkable assertions plus a no-skill
baseline flag.

## Commands

```bash
node evals/validate.mjs
node evals/runner.mjs
```

`runner.mjs` writes `evals/results/<version>/`. Live model runs need
`EVAL_MODEL`. Without it, the runner records skipped runs with the
prompt, skill version, and platform so CI can still attach a plan.
Release still requires `--require-results` plus a filled review.

Fixtures: [fixtures/README.md](fixtures/README.md).

Thresholds for a release:

- positive activation ≥ 90% overall, no query below 2/3
- negative activation ≤ 10% overall, no query above 1/3

Human review uses [reviews/TEMPLATE.md](reviews/TEMPLATE.md).
