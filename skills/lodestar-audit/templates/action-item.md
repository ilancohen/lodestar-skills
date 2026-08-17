<!--
Template for a single action-item file.
Replace every <PLACEHOLDER>. Delete sections that don't apply except where
marked "required". The generated file must be self-contained — assume the
executor has access only to this file and the repo.
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

<2–4 sentences. What's wrong, where, and the principle it violates. Cite the
principle by name as it appears in
`.agents/skills/lodestar-setup/principles.md`
(e.g. "Centralize types", "Parse Don't Validate", "CQS"). Include the exact
file path(s) and, where useful, a short code excerpt.>

## Why this matters

<1–3 sentences linking the violation to a concrete cost: tests that can't
run in isolation, a duplicated type drifting out of sync, an error that
crosses a boundary unhandled, etc. No hand-waving — name the failure mode.>

## Suggested fix

<Step-by-step, numbered. Concrete enough that an agent can execute without
asking follow-up questions. Reference real file paths. If a new file needs
to be created, name it and describe its content shape.>

## Scope rules

<Copy verbatim from the matching categories/<category>.md sub-doc. These
rules constrain the executor and define stop conditions.>

## Acceptance check

<Copy verbatim from the matching categories/<category>.md sub-doc, with
`<typecheck>`, `<lint>`, `<test>` substituted with the real commands from
`.agents/lodestar/context.md`.>

## Depends on

<Optional. List of action item IDs that must land first. Omit the section
entirely if there are no dependencies.>

## Prompt for an agent

<A ready-to-paste prompt the user can drop into an LLM. Should reference
this file's path. Example:

> Read `docs/audit/<RUN_ID>/<this-file>.md`. Implement the fix exactly as
> specified. Do not modify files outside the `files:` list. Run
> `<typecheck>` and `<test>` before committing. If any scope rule is hit,
> stop and report rather than guessing.>
