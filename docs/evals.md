# Manual eval checklist

Update this file when skill behavior or triggering changes. No harness —
spot-check by prompting an agent with the phrases below.

All four skills set `disable-model-invocation: true`. They must load only
when the user names the skill (slash command, `$skill`, or the client's
skills UI). Ambient task language must not load them.

## lodestar-setup

Should trigger:

- "Run lodestar-setup in this repository."
- "Initialize lodestar-setup. Keep the deployment section already in AGENTS.md untouched."
- "You stopped after listing packages. Finish lodestar-setup and write the config files."
- `/lodestar-setup`

Near-miss (should not trigger):

- "We just installed the lodestar skills. Document our packages and agent guidance."
- "We added a billing package. Refresh the lodestar context file without auditing."
- "Is my lodestar context still accurate?"
- "We switched from npm to pnpm. Update the lodestar setup files."
- "Set up engineering principles but ask me to confirm package responsibilities before writing."
- "Wire up the agent engineering docs for this monorepo the way the principles suite expects."
- Audit / apply fixes / redesign layout / advice-only AGENTS.md questions / unrelated lint, README, commit, or CI work.

Expected outcomes (once explicitly invoked):

- Step procedures live one hop from `SKILL.md` under [`skills/lodestar-setup/references/`](../skills/lodestar-setup/references/00-confirm-scannable.md): [Step 0](../skills/lodestar-setup/references/00-confirm-scannable.md), [Step 1](../skills/lodestar-setup/references/01-collect-facts.md), [Step 2](../skills/lodestar-setup/references/02-review.md), [Step 3](../skills/lodestar-setup/references/03-permissions.md), [Step 4](../skills/lodestar-setup/references/04-write-files.md), [Step 5](../skills/lodestar-setup/references/08-confirm.md).
- `.agents/lodestar/context.md` is written when the repo has TypeScript or JavaScript to audit — it is the only file the other three skills read (Package Layout, Dependency Direction, Build & Test, Conventions, Audit Configuration). Step 0 counts scannable files first: zero TS/JS → stop, write nothing, name the languages found with counts. A mixed repo keeps unscannable packages as `Scannable: no` rows (with a language note), names them at the Step 2 confirmation and again in the Step 9 summary, and writes no Fallow zone for them. Layout discovery is open-ended: `pnpm-workspace.yaml`, `package.json` `workspaces`, `nx.json`, `turbo.json`, and `lerna.json` are hints, not a closed set — prefer the package manager's own declaration when several exist, and walk non-root `package.json` dirs only when nothing declares a workspace; else a single-package source root — offering feature/module dirs one level down when they exist, or one row for the source root. Directory rows are valid. Each row records Entry points from `exports` / `typesVersions` / `main` (default `index.ts`). The Dependency Direction section records the **observed** package import graph (acyclic chain or cyclic edge list with a `Basis:` date), never an inferred or target layout; when the graph is cyclic, setup shows the cycle to the user before writing and records it as-is (audit reports cycles under `imports` #3, not wrong-direction #6). An empty graph is valid for a single-package repo. Step 3 is one multi-select: which of five conventions the repo already follows, pre-checked from a bounded evidence sweep (Result/Either, branded helpers, `export *`, design tokens, coverage threshold). One round of feedback. The `## Conventions` table is written in both enforcement modes; absent means default (every convention on, coverage floor 80). No layout table, command table, or skills index may be written into `AGENTS.md`. Step 4 asks the full-suite-vs-skills-only question: `full` appends only a short `## Lodestar` pointer section to `AGENTS.md`, `skills-only` leaves `AGENTS.md` completely untouched. Neither answer may skip Package Layout, Conventions, commit policy, Fallow, or linter setup. If an older setup left lodestar sections in `AGENTS.md`, Step 6 asks once before removing them. `principles.md` itself is never copied or edited — `context.md` links to the fixed path `.agents/skills/lodestar-setup/principles.md`, which every install (via `scripts/install.mjs` or `npx skills add`) guarantees exists by always also requesting the CLI's `universal` target. Never edit `packages/**` / `src/**`. Do not write `CLAUDE.md` or `.github/copilot-instructions.md`. Step 7 asks before installing Fallow as a devDependency, asks where it goes when the repo has more than one package, and never installs over a copy that already resolves in range. A declined or failed install is not a setup failure — it prints the install command, says `lodestar-audit` needs a compatible Fallow, and still asks the `.fallowrc.json` question. Ask separately before adding `.audit-fallow-seed.json` / `.fallow/` to `.gitignore`; if declined, still write `.fallowrc.json` and note the skip. The install, `.fallowrc.json`, and the `.gitignore` edit are three independent consent gates. Setup does not ask about Audit Configuration keys; it writes defaults (`categories: all`, `output-root: docs/audit`, `fallow: required`).
- Refresh after structure or package-manager change without auditing or redesigning architecture.
- Layout discovery is open-ended: `pnpm-workspace.yaml` / `workspaces` / `nx.json` / `turbo.json` / `lerna.json` are hints, not a closed set; only with no declaration does setup walk `package.json` dirs. Commands come from `package.json` scripts or Makefile / justfile / Nx / Turbo / README; a missing check is `n/a`. Bun is detected from `bun.lock` / `bun.lockb` (both still count as Bun; Bun plus another manager is still ambiguous). An unrecognized manager is a `pkg-manager` row (`name; exec; add-dev <pkg>`) that wins over lockfile detection. Deno and Bazel are unsupported.
- Step 2's second confirmation is excluded-path candidates with evidence; setup writes `### Excluded Paths` under `## Audit Configuration` in both enforcement modes. The audit produces no findings from an excluded directory.
- Step 3a proposes a commit format from commitlint / git log, writes git keys in `## Audit Configuration` in both modes. `lodestar-fix` honors `commits: never` without asking; a protected branch stops the session and offers to continue without committing.
- Step 1 measures churn with four git/filesystem commands (no source reading). Step 2 asks one scope question in plain words — how many source files there are and how many changed in the last 90 days, then two named choices ("all of it" / "only code you touch from now on") and a recommendation with a one-line reason. It must not print the word "churn", a ratio, a threshold, or the keys `changed-since` / `all`. Recommend "only code you touch" when files ≥ 80 and 90-day churn < 0.30, else "all of it". On the former, record `changed-since` and capture `git rev-parse HEAD` and today's date. Not a git repo → `mode: all` without asking. Step 9 names the scope and, when scoped, says the next audit will look almost empty by design and that existing code is the `INDEX.md` backlog.
- All four skills phrase user-facing questions and summaries in plain language: one question at a time, each choice saying what it does, internal config keys and status values kept out of the prompt, counts rather than ratios, no threshold arithmetic left to the user, and a warning never trimmed or deferred. They are also laid out for skimming: point first, bullets over paragraphs, a blank line between blocks, bold lead-ins carrying the gist. Templated output — action items, `INDEX.md`, the architecture report, commit messages, the `lodestar-fix` session report — keeps its own shape. Each `SKILL.md` carries a "How to talk to the user" section; the setup step references point at it.
- A 0.8.x `context.md` (old section names) fails `validate-input` and names re-run `lodestar-setup`. A 0.9 file missing `## Audit Configuration` uses today's defaults. Missing `Scannable` / `Entry points` columns still default as before.
- Redirect redesign requests to `lodestar-architecture`.

## lodestar-audit

Should trigger:

- "Run lodestar-audit on this TypeScript monorepo. Do not fix source."
- "I edited findings.md. Re-run only the plan phase of lodestar-audit."
- "Is my lodestar context still accurate?"
- `/lodestar-audit`

Near-miss: setup docs, applying fixes, architecture review, advice-only, security/coverage/format/perf tasks, and ambient discovery requests that do not name the skill:

- "Find architecture, boundary, and duplication violations and write action items under docs/audit/."
- "Only check imports and dry. Pause after findings.md."
- "Resume today's audit. findings.md is incomplete."
- "Scan for any, swallowed errors, and testability issues. Discovery only."
- "Audit inline styles and raw colour literals. Don't change components."
- "Produce the lodestar finding files for this repo."

Expected outcomes (once explicitly invoked):

- Discovery + plan under the configured `output-root` (default `docs/audit/`); no application source edits except an optional consented `## Audit Configuration` persist of a category subset.
- A missing `## Conventions` section is backward-compatible: every convention at its default, output identical to pre-0.5 aside from styling B now waiting for a third occurrence (aligned with `ssot` A). A missing `Scannable` column is likewise `yes` — pre-0.6 files audit as today. A missing `Entry points` column is `index.ts`. Missing `### Excluded Paths` or git keys in `## Audit Configuration` keeps today's skip rules and commit question. `Scannable: no` packages are listed in `INDEX.md` known-blind-spots (`<name>` — `<language>, not scanned`) and are not scanned. A `Scannable: yes` row with zero TS/JS files fails `validate-input`. A single-package repo (one scannable row, empty graph) lists `imports` #6 and `boundaries` B as not applicable in `INDEX.md`, not as a silent pass; other subtypes in those categories still run. Declared `exports` subpaths are not `imports` #1 findings. Excluded globs are skipped by every detector.
- Gated detectors skip and are listed in `INDEX.md` known-blind-spots: `result-types: no` → no `errors` #B; `design-tokens: no` → no `styling` findings; `barrel-exports: yes` → no `imports` #4; `branded-types: no` → no `boundaries` A / `types` #4. `coverage-floor: none` drops the coverage blind-spot line and does not add a skip. Gated-off categories still checkpoint complete with count 0.
- If `## Audit Configuration` `categories` is a subset, present it as the default; the user can widen for one run. Persist back to `context.md` only if they ask.
- If `mode` in `## Audit Configuration` is `changed-since`, present it as the default; the user can widen this run (all findings, or one category/package) without writing `context.md`. Two discovery runs at the same commit under `all` and `changed-since` produce `findings.md` files that differ only in `in_scope`. Phase 2 writes action items for `in_scope: true` only; `INDEX.md` `## Backlog` counts the rest. In-scope finding count + backlog count = `findings.md` total. Promoting a slice re-runs Phase 2 on the same `findings.md` and appends action items.
- A missing `mode` key is `mode: all`. An unresolvable `baseline-ref` fails `validate-input` (no fallback to `all`).
- `imports` subtype #6 (`wrong-direction`) means an import opposes a documented edge or path in `context.md`; documented cycle edges surface as #3 `circular-import` instead.
- Honor category subsets and pause after `findings.md` when asked. Read `output-root` rather than hardcoding `docs/audit`.
- Stop and point at `lodestar-setup` / Fallow when `.agents/lodestar/context.md` is missing or has no Package Layout. An `AGENTS.md` that still carries an old layout table must not be used as a fallback. Missing `CLAUDE.md` or `.agents/skills/README.md` is not a blocker.
- "Is my lodestar context still accurate?" runs `check-freshness` only — report drifted facts or that the file still matches. Do not start an audit run. Do not re-run `lodestar-setup` (that is "Refresh the lodestar context file without auditing").
- Fallow schema acceptance: a schema above the contract baseline passes when every required field is present. On the first encounter the contract script writes `.agents/lodestar/fallow-compat.json` and prints a one-line note to stderr; subsequent runs with that schema are silent. A schema above the baseline that dropped a required field fails with a "pin to last known-good version" message instead of the upgrade message. When `## Audit Configuration` has `fallow: optional` and Fallow is missing or invalid, the audit continues with grep-only detectors and lists `imports` #7–#9, `dry` A, and `soc-yagni` A ranking as not checked at all in `INDEX.md`. `boundaries` B still runs (grep). Default (absent or `required`) still stops.

## lodestar-fix

Should trigger:

- "Run lodestar-fix on the latest audit. Do not commit."
- "Fix only the imports and types action items from docs/audit/2026-08-10 with lodestar-fix."
- `/lodestar-fix`

Near-miss: discovery-only audit, setup, advisory review, unrelated refactors, advice, PR review, dep bumps, deleting audit files, and ambient fix requests that do not name the skill:

- "Apply all unstarted low-risk items. Stop on scope creep."
- "Work through requires_decision items in 2026-08-10. Ask before each source change."
- "Resume audit remediation. One item is in_progress with a partial diff."
- "Execute 003 and 004 from the current audit run. Verify before marking done."
- "Apply remaining items and auto-commit each one separately."
- "Land the lodestar action items that are still in the run root."

Expected outcomes (once explicitly invoked):

- Honor each item's file list; no `git add -A`; stop on scope creep.
- `n/a` for `<typecheck>` or `<test>` skips that check and is reported; stop only when both are `n/a` or missing.
- Ask before decision items and before overwriting `in_progress` work.
- Offer only runs that have both `INDEX.md` and at least one `NNN-*.md` in the run root; if none qualify, point at `lodestar-audit`'s Plan phase. Stop if `INDEX.md` is missing after selection.
- Commit policy comes from git keys in `## Audit Configuration` (defaults if absent): skip the auto-commit question when `per-item` or `never`; `never` leaves edits unstaged; a protected branch stops and offers to continue without committing; a rejecting hook defers the item with the hook output and does not `--no-verify`.

## lodestar-architecture

Should trigger:

- "Run lodestar-architecture. Describe only."
- "You asked describe vs suggest and I said 2. Continue lodestar-architecture."
- `/lodestar-architecture`

Near-miss: violation hunt, applying audit items, documenting current layout, starting a refactor, generic architecture advice, ADRs, component/API review, load tests, and ambient review requests that do not name the skill:

- "Describe this repository's package architecture for a new engineer. Do not suggest changes."
- "Review the package layout before a large refactor and propose at most two alternatives."
- "The architecture feels wrong. Review the documented layout with evidence."
- "Review the architecture. The lodestar context file has no Package Layout table."
- "Does our dependency direction still match the code? Advisory only."
- "Write the architecture-review report for this monorepo."

Expected outcomes (once explicitly invoked):

- Ask describe vs suggest once; write under the derived architecture root (`docs/architecture-review` when `output-root` is `docs/audit`, otherwise `<output-root>/architecture-review`); never edit application source.
- At most two evidence-mapped alternatives with trade-offs when asked to suggest.
- Stop and point at `lodestar-setup` when Package Layout / Dependency Direction is missing from `.agents/lodestar/context.md`. Missing `AGENTS.md`, `CLAUDE.md`, or `.agents/skills/README.md` is not a blocker.
