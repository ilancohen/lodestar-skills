# Step 0 — Confirm the repo is scannable

Count scannable files by extension across top-level source dirs, excluding
`node_modules` and `.git`. Use the base extension list (`.ts`, `.tsx`,
`.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`) plus any framework
extensions you already know apply (`.vue`, `.svelte`, …). Count only.
Tally other extensions (`.py`, `.go`, `.rs`, …) in the same pass.

- **Zero scannable files** → **stop**. Write nothing. Name the
  languages found with counts. Do not offer a partial setup.
- **Some scannable, some not** → continue; carry counts into Step 1.
