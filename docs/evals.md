# Manual eval checklist

Update this file when skill behavior or triggering changes. No harness —
spot-check by prompting an agent with the phrases below.

## ep-setup

Should trigger:

- "Run ep-setup in this repository."
- "We just installed the engineering-principles skills. Document our packages and agent guidance."
- "We added a billing package. Refresh AGENTS.md and the skill README without auditing."
- "We switched from npm to pnpm. Update the engineering-principles setup files."
- "Set up engineering principles but ask me to confirm package responsibilities before writing."
- "Initialize ep-setup. Keep the deployment section already in AGENTS.md."
- "You stopped after listing packages. Finish ep-setup and write the config files."
- "Wire up the agent engineering docs for this monorepo the way the principles suite expects."

Near-miss (should not trigger):

- Audit / apply fixes / redesign layout / advice-only AGENTS.md questions / unrelated lint, README, commit, or CI work.

Expected outcomes:

- Consent before writes; touch only owned guidance files; never edit `packages/**` / `src/**`.
- Refresh after structure or package-manager change without auditing or redesigning architecture.
- Redirect redesign requests to `ep-review-architecture`.

## ep-audit

Should trigger:

- "Run ep-audit on this TypeScript monorepo. Do not fix source."
- "Find architecture, boundary, and duplication violations and write action items under docs/audit/."
- "Only check imports and dry. Pause after findings.md."
- "Resume today's audit. findings.md is incomplete."
- "I edited findings.md. Re-run only the plan phase of ep-audit."
- "Scan for any, swallowed errors, and testability issues. Discovery only."
- "Audit inline styles and raw colour literals. Don't change components."
- "Produce the engineering-principles finding files for this repo."

Near-miss: setup docs, applying fixes, architecture review, advice-only, security/coverage/format/perf tasks.

Expected outcomes:

- Discovery + plan under `docs/audit/`; no application source edits.
- Honor category subsets and pause after `findings.md` when asked.
- Stop and point at `ep-setup` / Fallow when prerequisites are missing.

## ep-fix

Should trigger:

- "Run ep-fix on the latest audit. Do not commit."
- "Apply all unstarted low-risk items. Stop on scope creep."
- "Work through requires_decision items in 2026-08-10. Ask before each source change."
- "Resume audit remediation. One item is in_progress with a partial diff."
- "Fix only the imports and types action items from docs/audit/2026-08-10."
- "Execute 003 and 004 from the current audit run. Verify before marking done."
- "Apply remaining items and auto-commit each one separately."
- "Land the engineering-principles action items that are still in the run root."

Near-miss: discovery-only audit, setup, advisory review, unrelated refactors, advice, PR review, dep bumps, deleting audit files.

Expected outcomes:

- Honor each item's file list; no `git add -A`; stop on scope creep.
- Ask before decision items and before overwriting `in_progress` work.
- Stop and ask for `ep-audit` when `INDEX.md` is missing.

## ep-review-architecture

Should trigger:

- "Run ep-review-architecture. Describe only."
- "Describe this repository's package architecture for a new engineer. Do not suggest changes."
- "Review the package layout before a large refactor and propose at most two alternatives."
- "The architecture feels wrong. Review the documented layout with evidence."
- "Review the architecture. AGENTS.md has no Package Layout table."
- "Does our dependency direction still match the code? Advisory only."
- "You asked describe vs suggest and I said 2. Continue the architecture review."
- "Write the architecture-review report for this monorepo."

Near-miss: violation hunt, applying audit items, documenting current layout, starting a refactor, generic architecture advice, ADRs, component/API review, load tests.

Expected outcomes:

- Ask describe vs suggest once; write under `docs/architecture-review/`; never edit source.
- At most two evidence-mapped alternatives with trade-offs when asked to suggest.
- Stop and point at `ep-setup` when Package Layout / Dependency Direction is missing.
