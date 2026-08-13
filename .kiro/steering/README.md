---
inclusion: manual
---

# Kiro adapter policy

Kiro IDE honors `inclusion: manual` for the non-mutating skills in this
directory (`ep-setup`, `ep-audit`, `ep-review-architecture`).

**Kiro CLI currently loads every `.kiro/steering/*.md` file and ignores
inclusion modes.** Therefore `ep-fix` is intentionally **not** shipped as
Kiro steering — it would otherwise enter context without invocation.

Invoke `ep-fix` through a skills-compatible client that keeps source-
mutating skills on-demand (Agent Plugins / `npx skills add`, Claude,
Codex, or Gemini), not via Kiro steering.
