# Locate the plan

Read `.agents/lodestar/context.md` when it exists and capture
`<typecheck>`, `<test>`, and `<lint>` from `## Build & Test`. `n/a` skips
that check.

A missing `context.md` is not a stop. Do not send the user to
`/lodestar-setup`. Find the same commands in the repo —
[discover-context.md](discover-context.md).

Read `## Review Rubric` when present. Absent means principles only —
`.agents/skills/lodestar-setup/principles.md`. That list is the review
rubric. Do not bake in repo-specific checklist items.

If the invocation names a plan (path, slug, or folder), use it. Else list
candidates from pick-up (every `.md` file and folder directly under the
plans root, excluding `done/`, `abandoned/`, `adr/`) and ask which one.

Run:

```text
node <this-skill>/scripts/plan-state.mjs pick-up --root <repo> --plan <slug>
```

If it errors with **prior incomplete move**, stop. Name both paths. Do
not re-execute.

Print: "Working on `<path>`. Single-file plan / Folder plan." Then the
stage list (`[ ]` / `[x]`). Ask whether to run all unfinished stages in
order, unless the user already said to implement the whole plan.

Resume: skip `status: done`. Print `deferred` reasons first and ask
retry / leave / skip. A dirty partial diff from a previous attempt is
shown, never overwritten — ask continue / revert / leave.
