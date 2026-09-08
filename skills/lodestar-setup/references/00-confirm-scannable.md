# Step 0 — Confirm the repo is scannable

Scannability comes from the collector projection (`scannable.total` /
`counts` / `other`). Do not re-walk the tree.

- **`scannable.total === 0`** → **stop**. Write nothing. Name languages
  from `other` (and empty `counts`). Do not offer a partial setup.
- **Some scannable** → continue with the same collect stdout; do not
  re-run discovery.
