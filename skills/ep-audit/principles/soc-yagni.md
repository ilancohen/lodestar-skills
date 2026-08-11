# Category: `soc-yagni`

Single-responsibility (file/class level) and YAGNI / Rule-of-Three signals.
Mix of **mechanical** and **semantic** detectors — the semantic ones produce
findings a human or LLM must judge.

Fallow is the required detector — it **narrows** the semantic A pass
to complexity hotspots and confirms per-symbol reference traces in D.

## What counts as a violation

### A. File or class with multiple unrelated responsibilities — semantic
A module whose responsibility you can't name in one sentence without "and",
or whose methods cluster into two or more unrelated groups. Example:
`UserService` that both handles auth flow *and* renders email templates.

When checking this, compare the file's apparent responsibility against
the **package's** Responsibility (AGENTS.md `## Package Layout`):
- If the file does something its package isn't supposed to own, that's a
  responsibility-misplacement finding — flag it.
- If the file does two things and both fit the package's responsibility,
  it's still a within-package SoC issue — flag it as
  `responsibility-overload`.

Risk: high. Splitting a misnamed module touches many call sites.

### B. Boolean flag parameters — mechanical
Functions exposing two or more `boolean` parameters, or call sites passing
adjacent boolean literals (`process(x, true, false, true)`). Almost always
a sign of conflated responsibilities; usually fixed by splitting the
function or accepting an options object with named fields.

Risk: medium.

### C. Optional parameter with no caller — mechanical
An exported function declares an optional parameter (`(x: T, opts?: O)`)
that no current caller passes. Speculative API surface — YAGNI.

Risk: low.

### D. Single-call-site export — mechanical (Rule of Three)
An exported symbol from a package is imported from exactly **one** site
outside the package. This is a YAGNI / Rule-of-Three candidate: the
abstraction isn't proven yet. Two call sites = note for review. Three+ =
keep as-is.

Risk: low. Caveat: don't flag exports consumed by tests, by build tools,
or by a public package contract.

## Detection

All commands below use placeholders resolved from the `## Package Layout`
table in `AGENTS.md` (see SKILL.md Step 1.0). Substitute before running.

### A — file/class with multiple responsibilities (semantic)

**Preferred (with fallow seed):** narrow the LLM-driven walk to files
flagged as complexity hotspots.

1. From `.audit-fallow-seed.json`, take `health.findings[]` and collect
   unique `path` values. Every entry already exceeded a configured
   complexity or unit-size threshold. Use `health.targets[]` from the same
   combined envelope to prioritize high-confidence refactoring targets when
   this set is large.

2. For each file in that set, summarize its responsibility in one
   sentence. Compare to the owning package's Responsibility column in
   AGENTS.md. Flag any that:
   - Need "and" / describe two unrelated nouns; or
   - Describe work outside the package's stated responsibility.

   Skip the same exclusions as the fallback (under 30 lines, index /
   re-export, type-only).

3. After the seed-driven set is processed, extend with any files in
   `<all_pkg_roots>` over 200 lines that fallow didn't flag — large files
   often hide responsibility overload even when no individual function is
   over the complexity threshold.

### B, C — signature inspection (mechanical, fallow not applicable)

Always grep — fallow does not analyze signatures.

```bash
# B — boolean flag params
#   Two-or-more boolean parameters in a signature:
grep -rEn "\([^)]*: *boolean[^)]*: *boolean" <all_pkg_roots> \
  --include="*.ts" --include="*.tsx"
#   Adjacent boolean literals at call sites (heuristic — check context):
grep -rEn "\((true|false), *(true|false)" <all_pkg_roots> \
  --include="*.ts" --include="*.tsx" | grep -v "\.spec\.\|\.test\."

# C — optional params with no caller (per function; needs a per-function loop)
#   1. Find candidates: `grep -rEn "\?: " <all_pkg_roots> --include="*.ts"`
#      filtered to exported function signatures.
#   2. For each candidate fn `f` with optional param `p`, grep all call
#      sites of `f` across the monorepo. If none pass enough positional
#      args to fill `p`, or none reference `p:` in an options object,
#      flag it.
```

### D — single-call-site exports

`check.unused_exports[]` contains only zero-reference exports, so it cannot
seed this detector. Those entries belong to `imports.md` #5. For D, use a
per-package, per-symbol import-count loop, then confirm one-reference
candidates with Fallow's trace envelope (`kind: "trace"`).

```bash
# D — single-call-site exports (per package P, per symbol)
#   1. For each `^export` in <pkg_root>/index.ts, capture symbol names.
#   2. For each symbol, count call sites:
#        grep -rEn "from '<pkg_alias>'" <all_pkg_roots> \
#          --include="*.ts" --include="*.tsx" \
#          | rg "\b<symbol>\b" | wc -l
#   3. For a symbol with exactly one external call site, confirm with:
#        "$FALLOW_BIN" dead-code --trace <path>:<symbol> \
#          --format json --quiet 2>/dev/null || true
#      Parse only a `kind: "trace"` envelope.
#   4. Confirmed symbols with exactly one external call site → flag.
#      Symbols with zero external call sites → already covered by
#      `imports.md` #5 (over-broad index).
```

## Action-item granularity

- **A** — one file or one class per item. If the proposed split would
  produce 3+ new files, mark `requires_decision: true` and describe the
  split rather than prescribing it.
- **B** — one function per item.
- **C** — one parameter per item.
- **D** — one symbol per item.

## Suggested fix shape

- **A** — name the two (or more) responsibilities in plain language;
  propose the split (new file names, what each owns); list affected
  call sites; defer execution to a human if the split spans bounded
  contexts or would move code between packages.

- **B** — pick exactly one based on what the booleans mean:
  - Split into two functions (e.g. `processSync` / `processAsync`).
  - Replace the booleans with an options object: `process(x, { dryRun, verbose })`.
  - Replace with an enum or discriminated union when the booleans represent
    mutually-exclusive modes.

- **C** — delete the optional param and any code branches gated on it.
  If keeping is intentional (planned imminent caller), add a `// TODO(<ticket>)`
  comment and skip the action item.

- **D** — either:
  - Remove the export and inline the symbol at the single call site
    (when the single user is in the same logical layer); or
  - Move the implementation closer to the single caller and keep it
    unexported.

## Scope rules (must appear verbatim in generated action items)

- **A** — describe the responsibilities and the proposed split. Do **not**
  execute the split inside the action item if it touches more than 3 files;
  mark `requires_decision: true` and produce a plan only. If the split
  would move code between packages, also mark `requires_decision: true`
  and add a note suggesting `ep-review-architecture`.
- **B**, **C**, **D** — update every call site in the same commit.
- For **D**: do not remove the export if any test outside the package
  imports it. Move the test or revisit.
- Run `<typecheck>` and `<test>` after every commit.

## Acceptance check

- `<typecheck>` passes.
- `<test>` full suite passes.
- For **B**: re-run the detection grep; no remaining adjacent boolean
  literals at the touched call sites.
- For **C**: re-run the detection grep; the named optional param no
  longer appears.
- For **D**: the symbol is gone from the package's `index.ts`, or the
  symbol now has ≥ 2 external call sites because the work surfaced more.
