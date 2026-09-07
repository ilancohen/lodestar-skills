## Step 2 — Triage

Read `INDEX.md` and parse the frontmatter of every action-item file.
Build a summary:

- By category: count of items, broken down by status (`done` /
  `skipped` / `deferred` / `in_progress` / unstarted).
- By risk (`low` / `medium` / `high`).
- Count of `requires_decision: true` items.

Print the summary, then ask one question:

> What do you want to work on now?
>
> 1. **The safe ones** — every fix that hasn't been started and is
>    low-risk. Anything needing a judgement call from you is left out.
> 2. **By category** — you pick which types of fixes to work through.
> 3. **By area** — you pick which areas of the codebase to work through.
> 4. **Just the judgement calls** — only the fixes that need you to decide
>    something. I'll walk you through them one by one.
> 5. **Specific ones** — give me the numbers.

For (1), (2), and (3), order items by category in the suggested sequence
`imports → types → ssot → soc-yagni → boundaries → errors →
testability → dry → styling`, then by ID within each category.

### Step 2a — "By area"

On (3), suggest areas instead of asking the user to invent them from
scratch:

1. Read `## Package Layout` from `.agents/lodestar/context.md`. For each
   row, match its Path glob(s) against the `files:` lists of unstarted,
   non-`done`/`skipped` items to get a per-package item count.
2. If the table is missing or matches nothing, fall back to the
   top-level directory segment of each item's `files:` paths as the
   area instead.
3. Present the areas with non-zero counts (package/directory name plus
   count), and ask:

> Which areas? Pick any of these, or name your own (a path, a glob, or
> part of a filename):
>
> - `<area 1>` (N fixes)
> - `<area 2>` (N fixes)
> - ...

4. On a custom answer, match it against `files:` as a substring or glob
   — whatever the user typed. If nothing matches, say so and ask again.

Never re-touch `done` or `skipped` items.

### Step 2b — Name the files

After the batch is chosen and before Step 3, print the distinct `files:`
across those items — count first, then the list (group by directory when
long). Ask once: proceed, or pick again (back to Step 2). No per-item
prompt here; Step 3.2 still only asks when `requires_decision: true`.
On pick again, stop here and return to the Step 2 question — do not
ask about commits yet.

On proceed, set `AUTO_COMMIT` from `sessionCommits` (Step 1 override,
not raw `git.commits`):

- `per-item` → `AUTO_COMMIT = yes`. Say so: one commit per fix, no ask.
- `never` → `AUTO_COMMIT = no`. One line why (setup or protected branch);
  leave edits unstaged. Do not ask.
- `ask` → ask today's question:

> Should I commit each fix as I finish it, or leave everything for you to
> review and commit yourself? (commit each one / leave them to me)

Hold the answer for use in Step 3.6.
