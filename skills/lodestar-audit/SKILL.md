---
name: lodestar-audit
description: >-
  Audits a codebase against the engineering principles documented by lodestar-setup
  and writes self-contained findings and action items under docs/audit/. Use
  when asked to find architecture, boundary, duplication, type, error-handling,
  testability, or styling violations. Discovery only; never modifies
  application source. Restartable from findings.md.
license: MIT
compatibility: Requires git, a POSIX-compatible shell, Node.js, and Fallow 3.15.0 (combined schema 10) installed in the target project or available on PATH. Designed for JavaScript/TypeScript repositories.
metadata:
  author: Ilan Cohen
  version: "0.1.0"
---

You are running an lodestar audit. **Discover** and
**document** violations as self-contained action items. Do not fix them.

Each action-item file must stand alone: an agent reading only that file
should have everything needed to land the fix.

Scripts live beside this `SKILL.md` under `scripts/`. Run them with
`node scripts/<name>.mjs` from this skill directory, or with an absolute
path to that file.

---

## Structure model

This audit is **structure-agnostic**. It does not assume roles like
`core`, `api`, or `ui`. It uses two things from `AGENTS.md`:

1. `## Package Layout` — package names, paths, aliases, and a one-sentence
   responsibility per package.
2. The declared dependency direction — allowed import direction.

Detectors run package-by-package. Kind-of-code rules use the
Responsibility column and path patterns, never the package name alone.

---

## Two-phase structure

```
Phase 1 — DISCOVER     →  docs/audit/<RUN_ID>/findings.md
Phase 2 — PLAN         →  docs/audit/<RUN_ID>/INDEX.md + NNN-….md files
```

`findings.md` is the seam. Discover writes finding blocks only. Plan
expands them into action items. A human may edit `findings.md` between
phases. Both phases are restartable with the same `<RUN_ID>`.

Never overwrite a previous run. Output stays under `docs/audit/<RUN_ID>/`.

---

## Preconditions

If any of these is missing, **stop** and tell the user to run `lodestar-setup`:

- `AGENTS.md`
- `CLAUDE.md`
- `.agents/skills/README.md`

Then run:

```text
node scripts/audit-state.mjs validate-input --root <repo>
```

If that command exits non-zero, print its error and stop. It rejects a
missing Package Layout and placeholder Responsibilities (shorter than 20
characters, `TODO`/`TBD`/`???`/`one sentence`, or a bare noun like
`core`).

If `pkgManager` is null, ask which of npm, yarn, or pnpm this repository
uses before any install or `dlx`/`npx` command. Do not guess.

Read `.agents/skills/README.md` for project-specific principles. Read
`AGENTS.md` for commands, direction, and the layout table.

---

## Categories

Read the category sub-doc before scanning that category. Read
`principles/fallow-seed.md` once before Discover.

| Category      | Sub-doc                     | Risk        | Detection style               |
| ------------- | --------------------------- | ----------- | ----------------------------- |
| `imports`     | `principles/imports.md`     | low         | mechanical (Fallow preferred) |
| `types`       | `principles/types.md`       | low         | mechanical                    |
| `boundaries`  | `principles/boundaries.md`  | medium–high | mechanical                    |
| `errors`      | `principles/errors.md`      | high        | mechanical                    |
| `testability` | `principles/testability.md` | high        | mechanical                    |
| `soc-yagni`   | `principles/soc-yagni.md`   | low–high    | mixed                         |
| `dry`         | `principles/dry.md`         | low–medium  | mixed                         |
| `ssot`        | `principles/ssot.md`        | low–medium  | mechanical                    |
| `styling`     | `principles/styling.md`     | low–medium  | mechanical                    |

Known blind spots (copy into `INDEX.md`): coverage floor unless `<test>`
emits coverage; wide-diff DRY as `dry.C` advisory only; Rule of Three
beyond `soc-yagni.D`; whether the documented layout is the right one
(`lodestar-architecture`).

---

## Consent and phase selection

Load [references/resume.md](references/resume.md) before resolving or
creating a run. Load [references/discover.md](references/discover.md)
before any detector. Load [references/plan.md](references/plan.md)
before writing action items. Load
[references/output-contracts.md](references/output-contracts.md) before
writing or merging `findings.md`.

1. Run `node scripts/audit-state.mjs resolve-run --root <repo>`.
2. If `inProgress` is non-empty, ask: "Resume that run? (yes / start a
   fresh run)". Resume with
   `resolve-run --root <repo> --resume <RUN_ID>`.
3. Print: "Output → `docs/audit/<RUN_ID>/`."
4. List categories. Ask: "Proceed? (yes / pick a subset)". Wait.
5. After Discover, ask: "Proceed to Phase 2 now? (yes / pause)". If
   pause, stop. The run stays resumable.

Do not scan before those confirmations.

---

## Discover (Phase 1)

Follow [references/discover.md](references/discover.md). Summary:

1. Resolve the package set from `validate-input` JSON.
2. Run the Fallow seed from `principles/fallow-seed.md`. If Fallow is
   missing or invalid, **stop**. Do not write findings.
3. Mechanical pass in category order, then semantic pass.
4. Merge with `node scripts/audit-state.mjs merge-findings`.
5. Validate with `node scripts/audit-state.mjs validate-output --path
docs/audit/<RUN_ID>/findings.md`.
6. Checkpoint a category as complete only after it is finished for every
   package, including the semantic pass for `soc-yagni` and `dry`. During
   a package loop use `checkpoint --status partial --package <name>`.

Discovery never modifies application source. The only filesystem writes
are `docs/audit/<RUN_ID>/` and the transient `.audit-fallow-seed.json`
(delete it after Phase 1).

---

## Plan (Phase 2)

Follow [references/plan.md](references/plan.md). Summary:

1. Recover with `node scripts/audit-state.mjs recover --run-dir
docs/audit/<RUN_ID>`.
2. Group findings by `scope_unit`. Write
   `docs/audit/<RUN_ID>/<NNN>-<category>-<slug>.md` from
   `templates/action-item.md`. Skip files that already exist.
3. Validate each file for placeholder leaks.
4. Write `INDEX.md` from `templates/index.md`.
5. Align category order with `lodestar-fix`:
   `imports → types → ssot → soc-yagni → boundaries → errors →
testability → dry → styling`.

---

## Rules

- **Read-only.** Never modify application source. Writes: `docs/audit/`
  plus transient `.audit-fallow-seed.json`.
- **Consent first.** Category subset and Phase 2 start are questions.
  Wait for answers.
- **Stop conditions:** missing setup files; `validate-input` failure;
  Fallow missing or invalid; zero files in documented package paths;
  required commands missing; the user says stop.
- **One concern per action item.** Split "and also…".
- **Self-contained.** No "see the audit skill" in generated files.
- **No placeholder leaks.** Treat any `<typecheck>`-style leftover as a
  bug; `validate-output` must pass.
- **`requires_decision: true`** is the default for semantic findings.
- **Don't fix.** Don't propose layout changes; mention
  `lodestar-architecture` in `notes:` if needed.
- **Restartable.** Interrupted runs resume from checkpoints. Past runs
  are never modified.

---

## Re-running

Load [references/resume.md](references/resume.md). Invoke again; resume
from the last checkpoint. To re-run Plan only, keep `findings.md` and
delete `NNN-….md` plus `INDEX.md` first.
