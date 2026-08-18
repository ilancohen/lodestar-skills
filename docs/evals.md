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
- "We switched from npm to pnpm. Update the lodestar setup files."
- "Set up engineering principles but ask me to confirm package responsibilities before writing."
- "Wire up the agent engineering docs for this monorepo the way the principles suite expects."
- Audit / apply fixes / redesign layout / advice-only AGENTS.md questions / unrelated lint, README, commit, or CI work.

Expected outcomes (once explicitly invoked):

- `.agents/lodestar/context.md` is always written — it is the only file the other three skills read (Package Layout, Dependency Direction, Build & Test). The Dependency Direction section records the **observed** package import graph (acyclic chain or cyclic edge list with a `Basis:` date), never an inferred or target layout; when the graph is cyclic, setup shows the cycle to the user before writing and records it as-is (audit reports cycles under `imports` #3, not wrong-direction #6). No layout table, command table, or skills index may be written into `AGENTS.md`. Step 3 asks the full-suite-vs-skills-only question: `full` appends only a short `## Lodestar` pointer section to `AGENTS.md`, `skills-only` leaves `AGENTS.md` completely untouched. Neither answer may skip Package Layout, Fallow, or linter setup. If an older setup left lodestar sections in `AGENTS.md`, Step 5 asks once before removing them. `principles.md` itself is never copied or edited — `context.md` links to the fixed path `.agents/skills/lodestar-setup/principles.md`, which every install (via `scripts/install.mjs` or `npx skills add`) guarantees exists by always also requesting the CLI's `universal` target. Never edit `packages/**` / `src/**`. Do not write `CLAUDE.md` or `.github/copilot-instructions.md`. Ask separately before adding `.audit-fallow-seed.json` / `.fallow/` to `.gitignore`; if declined, still write `.fallowrc.json` and note the skip.
- Refresh after structure or package-manager change without auditing or redesigning architecture.
- Redirect redesign requests to `lodestar-architecture`.

## lodestar-audit

Should trigger:

- "Run lodestar-audit on this TypeScript monorepo. Do not fix source."
- "I edited findings.md. Re-run only the plan phase of lodestar-audit."
- `/lodestar-audit`

Near-miss: setup docs, applying fixes, architecture review, advice-only, security/coverage/format/perf tasks, and ambient discovery requests that do not name the skill:

- "Find architecture, boundary, and duplication violations and write action items under docs/audit/."
- "Only check imports and dry. Pause after findings.md."
- "Resume today's audit. findings.md is incomplete."
- "Scan for any, swallowed errors, and testability issues. Discovery only."
- "Audit inline styles and raw colour literals. Don't change components."
- "Produce the lodestar finding files for this repo."

Expected outcomes (once explicitly invoked):

- Discovery + plan under `docs/audit/`; no application source edits.
- `imports` subtype #6 (`wrong-direction`) means an import opposes a documented edge or path in `context.md`; documented cycle edges surface as #3 `circular-import` instead.
- Honor category subsets and pause after `findings.md` when asked.
- Stop and point at `lodestar-setup` / Fallow when `.agents/lodestar/context.md` is missing or has no Package Layout. An `AGENTS.md` that still carries an old layout table must not be used as a fallback. Missing `CLAUDE.md` or `.agents/skills/README.md` is not a blocker.
- Fallow schema acceptance: a schema above the contract baseline passes when every required field is present. On the first encounter the contract script writes `.agents/lodestar/fallow-compat.json` and prints a one-line note to stderr; subsequent runs with that schema are silent. A schema above the baseline that dropped a required field fails with a "pin to last known-good version" message instead of the upgrade message.

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
- Ask before decision items and before overwriting `in_progress` work.
- Offer only runs that have both `INDEX.md` and at least one `NNN-*.md` in the run root; if none qualify, point at `lodestar-audit`'s Plan phase. Stop if `INDEX.md` is missing after selection.

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

- Ask describe vs suggest once; write under `docs/architecture-review/`; never edit application source.
- At most two evidence-mapped alternatives with trade-offs when asked to suggest.
- Stop and point at `lodestar-setup` when Package Layout / Dependency Direction is missing from `.agents/lodestar/context.md`. Missing `AGENTS.md`, `CLAUDE.md`, or `.agents/skills/README.md` is not a blocker.
