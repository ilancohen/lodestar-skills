<!--
Template for a single action-item file.
Replace every <PLACEHOLDER>. Omit ## Decision unless requires_decision is
true. Omit ## Scope exceptions when resident lodestar-fix rules suffice.
The file must be understandable alone, without copying whole category docs.
-->

---
id: <NNN>
category: <imports | types | boundaries | errors | testability | soc-yagni | dry | ssot | styling>
subtype: <e.g. cross-package-src | branded-primitive-missing | cqs-violation | responsibility-overload | duplication>
risk: <low | medium | high>
requires_decision: <true | false>
files:
  - <path/to/file>
  - <path/to/file>
scope: <one-line description of the smallest landable unit>
findings: <comma-separated F-IDs this action item absorbs, e.g. F0007, F0008>
---

# <NNN> — <Imperative title, e.g. "Move `User` type to shared/types/domain.ts">

## Problem

<2–4 sentences. Concrete evidence: what is wrong, where (paths / short
excerpt), and which principle it violates by name from `## Review Rubric`
or installed `lodestar-setup/principles.md`.>

## Suggested fix

<Step-by-step, numbered. The requested change only — concrete enough to
execute. Reference real paths. One concern; no multi-stage redesign.>

## Decision

<Required when `requires_decision: true`. State the open choice and what
yes / no / defer means. Omit this section when `requires_decision: false`.>

## Scope exceptions

<Only item-specific overrides beyond resident lodestar-fix rules (e.g.
"also update the generated barrel in packages/api/index.ts"). Omit this
section when there are none.>

## Acceptance check

<item-specific checks with `<typecheck>` / `<lint>` / `<test>` substituted
from `.agents/lodestar/context.md`. lodestar-fix also applies its resident
generic checks unless this section overrides them.>
