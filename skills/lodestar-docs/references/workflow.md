# Propose, harvest, delete

## Survey

Use the JSON from `scope.mjs`. Read any `README.md` / `INDEX.md` in
scope — they tell you what a folder thinks of itself.

Triage by header. Most files declare their own state in the first 20
lines (`status:`, "Superseded by", "FAILED"). That is enough to file
them as delete. Reserve full reads for abandoned files, for files the
header does not settle, and for anything you will merge or strip.

For a large folder, farm reads to parallel subagents. Each returns only
facts that clear the harvest bar.

## Propose

One written proposal, before anything destructive. Match length to
information density:

- Delete and keep: one table row each — filename, one-line reason,
  verdict. No paragraphs. Include every deletion, including build
  output and `.DS_Store` — nothing is deleted outside this list.
- Rescues: what gets harvested, and into which **existing** home.
- Merges and strips: prose, since the reasoning is what the reader is
  checking.
- Spec-vs-code divergences: a separate **needs decision** list with full
  citations. Never compress these.
- Harvest with no home: a separate **needs a home** list. Do not invent
  a path.

If `agentsMdHasDocsMap` is true, end with one unticked row: refresh the
existing Docs map after deletes.

End with: "Reply OK to proceed, or tell me what to change."

Do not mutate until they reply.

## Honor commit policy

Read `<commits>` from the survey (`ask`, `per-item`, or `never`; missing
means `ask`).

- **`never`** — make the edits; leave them unstaged; do not commit.
- **`ask`** — after they OK the proposal, ask whether to commit. Default
  to two commits when they say yes: harvest first, then delete.
- **`per-item`** — two commits, no extra ask: harvest, then delete.

The harvest commit is the safety mechanism. The worst case must be that
a file was kept unnecessarily, never that a fact was lost.

A protected branch in `context.md` stops the commit and offers to
continue without committing. A rejecting hook is not bypassed.

## After approval

1. Write every rescued fact into its home. Show the diff. Commit this
   first when commits are allowed.
2. Delete, merge, and strip. Update every ledger and index that pointed
   at a removed file. Grep for the removed paths.
3. If the user ticked the Docs map, rewrite only that existing section:
   one line per surviving canonical doc.
4. Commit deletes separately when commits are allowed.

Report: N deleted, N harvested into which files, N merged, N stripped,
any skill files whose assumptions this run invalidated, and whether
commits ran.
