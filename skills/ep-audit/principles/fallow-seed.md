# Pre-pass: `fallow`

[`fallow`](https://docs.fallow.tools) is a Rust-native codebase-intelligence
tool for TS/JS that builds a project-wide module graph in milliseconds. It is
**required** for this audit. Several detection categories have no viable
alternative — `imports.unused-file`, `imports.unused-dependency`, and
`imports.unresolved-import` are fallow-only, and the accuracy of several other
categories degrades significantly without it.

---

## When to use this seed

Run the seed **once** at the start of Phase 1 mechanical pass, after the
package-set resolution step (Step 1.0) and before iterating categories
(Step 1.2). Cache the JSON in memory; each category sub-doc consumes the
relevant slice.

```bash
# Resolve a pinned local install first, then a global install.
FALLOW_BIN=""
if [ -x node_modules/.bin/fallow ]; then
  FALLOW_BIN="node_modules/.bin/fallow"
elif command -v fallow >/dev/null 2>&1; then
  FALLOW_BIN="$(command -v fallow)"
fi

# If FALLOW_BIN is empty, stop immediately:
#   fallow is required for this audit.
#   Install the latest fallow as a root devDependency.
#   Then re-run.

# Run dead-code + duplication + health in one pass. Exit 1 means findings;
# exit 2 writes an ErrorOutput JSON envelope that validation catches.
"$FALLOW_BIN" --format json --quiet > .audit-fallow-seed.json 2>/dev/null || true

# Fallow v3 JSON is a typed envelope. Fail on runtime errors, an unexpected
# command shape, or a breaking output-schema version.
node -e '
  const d = JSON.parse(require("node:fs").readFileSync(".audit-fallow-seed.json", "utf8"));
  if (d.error === true) throw new Error(d.message);
  if (d.kind !== "combined") throw new Error(`Expected kind=combined, got ${d.kind}`);
  if (d.schema_version !== 7) throw new Error(`Expected schema_version=7, got ${d.schema_version}`);
'
```

`.audit-fallow-seed.json` is a temporary working file. Delete it after
Phase 1 completes; never commit it. (The audit skill is read-only outside
`docs/audit/`, but the seed is allowed in the repo root because it's
ephemeral and reproducible.)

If validation fails, or `check.entry_points.total` is zero, stop and report
the error to the user — do not proceed without a successful seed run.

---

## What the seed feeds where

| Fallow JSON field | Consuming category | Subtype | Notes |
|---|---|---|---|
| `check.boundary_violations[]` | `imports` | `wrong-direction` | Replaces `imports.md` #6 grep when `.fallowrc.json` is configured. Each entry already names `from_path`, `to_path`, `from_zone`, `to_zone`, `import_specifier`, `line`. |
| `check.circular_dependencies[]` | `imports` | `circular-import` | Replaces `imports.md` #3 detection. Graph-walked, exhaustive across re-export chains. |
| `check.unused_files[]` | `imports` | `unused-file` | Fallow-only subtype — see `imports.md` #7. |
| `check.unused_exports[]` | `imports` | `over-broad-index` | Replaces `imports.md` #5 per-symbol loop. Cross-reference with each row's `<pkg_root>/index.ts` to flag only the over-export subset. |
| `check.unused_dependencies[]` | `imports` | `unused-dependency` | Fallow-only subtype — see `imports.md` #8. |
| `check.unresolved_imports[]` | `imports` | `unresolved-import` | Fallow-only subtype. Almost always a typo or missing dependency. |
| `dupes.clone_groups[]` | `dry` | `exact-duplication` | Primary detector for `dry.A`. Each `instances[]` item provides `file`, `start_line`, and `end_line`. |
| `dupes.clone_groups[]` (run with `--mode semantic`) | `dry` | `structural-duplication` | Seeds `dry.B`. Catches renamed-variable and renamed-literal clones the mild mode misses. Confirm with eyes-on-code before flagging — semantic mode has more false positives than mild. |
| `health.findings[]` | `soc-yagni` | `responsibility-overload` | Every entry exceeded a configured complexity or unit-size threshold. Limit the semantic file walk to these parent files. |
| `health.targets[]` | `soc-yagni` | `responsibility-overload` | Ranked refactoring targets included in the combined seed. Prefer high-confidence targets when the findings set is large. |

Fields not listed above are not consumed. The harness does not act on
`unused-types`, `unused-enum-members`, or `unused-class-members` because
those overlap with TypeScript's own dead-code detection and are usually
better caught by `<typecheck>` or `<lint>`.

---

## Cross-tool deduplication

If both `pnpm check:deps` and fallow report the same import, prefer the
fallow finding (it carries `from_zone`/`to_zone` which makes the action-item
title cleaner). Dedupe by `(from_path, line, to_path)`.

Use `fallow dupes` for all duplication detection — do not run additional
clone detectors alongside it.

---

## Boundary configuration

For `check.boundary_violations` to fire, the repo must have a `.fallowrc.json`
whose zones match the `## Package Layout` table in `AGENTS.md`. The setup
skill writes this file (Step 4.5 of `ep-setup`) using the repo's
own package names as zone names — there is no canonical role mapping.

If `.fallowrc.json` is absent, fallow still produces useful output for
every other field above — `check.boundary_violations` is just empty. In that
case, `imports.md` #6 falls back to its grep heuristic.

To verify the boundary config matches what the audit expects, run:

```bash
"$FALLOW_BIN" list --boundaries --format json --quiet 2>/dev/null || true
```

The output should list one zone per row in the Package Layout table, with
file counts > 0 for every zone the repo actually has. A zone reporting
zero files almost always means the path glob is wrong.

---

## What fallow can't help with

The audit seed intentionally uses Fallow's default syntactic analysis. Fallow
v3 also offers opt-in type-aware analysis, but it does not replace these
grep- and domain-judgment detectors:

- `types` (any, branded primitives, redeclared fields)
- `boundaries.A` (branded primitives missing)
- `boundaries.B` (misplaced business logic — path-pattern heuristic plus
  AGENTS.md responsibilities)
- `boundaries.C` (CQS violations)
- `boundaries.D` (Tell Don't Ask getter chains)
- `boundaries.E` (validation deeper than the boundary)
- `errors` (swallowed errors, expected failures not modeled as `Result`)
- `testability.A` and `.B` (module-level side effects, mutable state) —
  fallow does not analyze module-level execution
- `soc-yagni.B` (boolean flag params) — signature inspection, not graph
- `soc-yagni.C` (optional param with no caller)

For these, the existing grep + per-package LLM walk in each sub-doc
remains the only detector.

---

## Performance note

A single `fallow --format json --quiet` invocation typically takes seconds on
mid-sized monorepos (vs. repeated graph and clone-detector passes).
The seed pays for itself even when only one or two of the categories
above produce findings.
