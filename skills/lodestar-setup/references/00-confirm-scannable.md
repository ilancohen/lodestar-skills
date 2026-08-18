# Step 0 — Confirm the repo is scannable

Count TS/JS files (`source-scan` include list) by extension across
top-level source dirs, excluding `node_modules` and `.git`. Count
only. Tally other extensions (`.py`, `.go`, `.rs`, …) in the same pass.

- **Zero scannable files** → **stop**. Write nothing. Name the
  languages found with counts. Do not offer a partial setup.
- **Some scannable, some not** → continue; carry counts into Step 1.
