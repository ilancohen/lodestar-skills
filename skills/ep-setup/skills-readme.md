# Engineering Principles

Single source of truth for engineering standards in this repo. Any agent
completing a task should check this before submitting work.

---

<!-- INSERT principles.md -->

---

## Package Dependency Direction

```
[e.g. web → server → core → shared — use the actual package names from
AGENTS.md, not generic role names]
```

See the `## Package Layout` table in `AGENTS.md` for the path → import
alias → responsibility mapping the audit skill uses.

---

## Skills Index

| Skill | File | When to use |
|---|---|---|
| Setup | `.agents/skills/ep-setup/SKILL.md` | Re-scaffold or refresh this config |
| Audit | `.agents/skills/ep-audit/SKILL.md` | Scan the codebase and emit action-item files into `docs/audit/<run-id>/` |
| Fix audit items | `.agents/skills/ep-fix/SKILL.md` | Triage and apply fixes from an audit run |
| Review architecture | `.agents/skills/ep-review-architecture/SKILL.md` | Advisory layout review; can propose an alternative architecture on request |

The audit skill is **discovery only** — it produces one self-contained
markdown file per violation. Each file is designed to be handed
independently to a human or LLM as a fix task.

The ep-review-architecture skill is **advisory only** — it never modifies
source and never writes audit-style action items. It produces a single
report comparing the documented layout to recognised architectural
patterns and, on request, a candidate alternative layout to discuss with
the team.
