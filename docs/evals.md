# Manual eval checklist

Update this file when skill behavior or triggering changes. No harness —
spot-check by prompting an agent with the phrases below.

All four skills set `disable-model-invocation: true`. They must load only
when the user names the skill (slash command, `$skill`, or the client's
skills UI). Ambient task language must not load them.

## lodestar-setup

Should trigger:

- "Run lodestar-setup in this repository."
- "Initialize lodestar-setup. Keep the deployment section already in AGENTS.md."
- "You stopped after listing packages. Finish lodestar-setup and write the config files."
- `/lodestar-setup`

Near-miss (should not trigger):

- "We just installed the lodestar skills. Document our packages and agent guidance."
- "We added a billing package. Refresh AGENTS.md and the skill README without auditing."
- "We switched from npm to pnpm. Update the lodestar setup files."
- "Set up engineering principles but ask me to confirm package responsibilities before writing."
- "Wire up the agent engineering docs for this monorepo the way the principles suite expects."
- Audit / apply fixes / redesign layout / advice-only AGENTS.md questions / unrelated lint, README, commit, or CI work.

Expected outcomes (once explicitly invoked):

- Consent before writes; touch only `AGENTS.md` and `.agents/skills/README.md` (plus optional Fallow/linter with consent); never edit `packages/**` / `src/**`. Do not write `CLAUDE.md` or `.github/copilot-instructions.md`. Ask separately before adding `.audit-fallow-seed.json` / `.fallow/` to `.gitignore`; if declined, still write `.fallowrc.json` and note the skip.
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
- Honor category subsets and pause after `findings.md` when asked.
- Stop and point at `lodestar-setup` / Fallow when `AGENTS.md` (Package Layout) or `.agents/skills/README.md` is missing. Missing `CLAUDE.md` is not a blocker.

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
- "Review the architecture. AGENTS.md has no Package Layout table."
- "Does our dependency direction still match the code? Advisory only."
- "Write the architecture-review report for this monorepo."

Expected outcomes (once explicitly invoked):

- Ask describe vs suggest once; write under `docs/architecture-review/`; never edit application source.
- At most two evidence-mapped alternatives with trade-offs when asked to suggest.
- Stop and point at `lodestar-setup` when Package Layout / Dependency Direction is missing from `AGENTS.md`. Missing `CLAUDE.md` or `.agents/skills/README.md` is not a blocker.
