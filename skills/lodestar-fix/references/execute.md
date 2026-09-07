## Step 3 — Execute

For each selected item, in the order from Step 2:

### Step 3.1 — Read the item

Open the `NNN-<category>-<slug>.md` file. Read every section:
problem, suggested fix, scope rules, acceptance check, files list.

### Step 3.2 — Decision gate

If `requires_decision: true`, print the problem statement and the
suggested fix in plain words. Ask: "Shall I make this change? (yes / no,
drop it / not now, ask me again later)".

- "no, drop it" → write `status: skipped` with a one-line `note:`, move
  the file to `<output-root>/<RUN_ID>/done/` (create the subfolder if
  needed), and move on.
- "not now" → write `status: deferred` with a `note:` describing the
  open question, and move on.
- `yes` → proceed to Step 3.3.

`requires_decision: false` → proceed (no ask).

### Step 3.3 — Mark in_progress

Add `status: in_progress` to the item's frontmatter.

### Step 3.4 — Apply the fix

Before editing, run `git status --porcelain -- <files>`. If any listed
path already has uncommitted changes, **stop this item**. Name those
paths, ask the user to resolve them (commit, stash, or discard), and
leave the item `in_progress` or set `status: deferred` with
`note: dirty-files — <paths>` if they want to continue later. Never
edit into a dirty file, and never stage a whole dirty file that mixes
pre-existing edits with this fix.

Follow **Suggested fix** exactly. Honor **Scope rules** verbatim.

Do not edit files outside `files:`. If the fix needs one, stop, set
`status: deferred` with `note: scope-creep — <files outside list>`,
and move on.

### Step 3.5 — Acceptance check

Run the item's **Acceptance check** exactly as written. That may be
`<typecheck>`, `<test>`, `<lint>`, a targeted test command, a
deterministic inspection (file contents, script output), or a
combination. Skip a named context command only when that cell is `n/a`,
and say so on the item.

If the acceptance section names no usable method — no command and no
deterministic inspection — **stop**. Set `status: deferred` with
`note: no usable acceptance method` and move on. Do not refuse merely
because both `<typecheck>` and `<test>` are `n/a` when the item
declares another valid method.

**Batched mode (opt-in).** When every item in the category is
`<typecheck>`-only (typically `imports`, `types`, `ssot`), apply all
edits, run `<typecheck>` once, then finish item-by-item. On failure,
bisect per-item; mark the offender `deferred` with the failure;
revert only its diff. Never batch when acceptance includes `<test>`.

A failed acceptance check → `status: deferred` with the exact failure
in `note:`. Do **not** mark done or move to `done/`.

### Step 3.6 — Commit

If `sessionCommits` is `never`: do not `git add`. If any of the item's
files are already staged, unstage them with
`git restore --staged -- <those files>` without touching the working
tree. Continue.

If `AUTO_COMMIT == yes`:

Write stdout to a temp file, then:

```
git add <files from item>
git commit -F <temp>
```

```
node <lodestar-fix-skill>/scripts/action-state.mjs commit-message \
  --file <output-root>/<RUN_ID>/<NNN>-<category>-<slug>.md \
  --item <output-root>/<RUN_ID>/<NNN>-<category>-<slug>.md \
  --subject-format "<git.subjectFormat>" \
  --trailer "<git.trailer>"
```

Use only the files listed in the item's `files:`. Never `git add -A`.
Never `--no-verify`. Never retry with a different message.

If the commit fails — a rejecting hook is the expected case — **stop
this item**. Write `status: deferred` with the hook output in `note:`,
leave the changes in place, tell the user, and move on. Do not mark
the item done.

If `AUTO_COMMIT == no` (and `sessionCommits` is not `never`), leave the
diff staged or unstaged and continue.

### Step 3.7 — Mark done and move

Only after Step 3.5 passed. Update the item's frontmatter:

```
status: done
completed_at: <YYYY-MM-DD>
```

If a commit was created, write `commit: <short-sha>` **after** the
commit exists (working-tree edit of frontmatter). When commits are
disabled, omit `commit:`.

Then **move** the file into `done/`:

```text
node <skill-dir>/scripts/action-state.mjs move-done --file <output-root>/<RUN_ID>/<NNN>-<category>-<slug>.md --run-dir <output-root>/<RUN_ID>
```

Create `<output-root>/<RUN_ID>/done/` if it does not yet exist.
