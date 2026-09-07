## Step 3a — (Optional) Sub-agent fan-out

When a sub-agent tool exists, spawn one per category with the item
paths, full item text, `<typecheck>` / `<test>`, `sessionCommits`,
`AUTO_COMMIT`, and `git` (`subjectFormat`, `trailer`). Constraints:
action item is the contract (scope rules stop the work); no edits
outside `files:`; no nested spawns; build commit messages with
`commit-message` (never `--no-verify`, never retry); hook reject →
`status: deferred` with hook output, leave edits, do not mark done;
`sessionCommits: never` → do not commit, leave unstaged. Return JSON
`[{item_id, status, files_modified, commit_sha, notes}]`.

Before marking any item, write the return to a temp JSON file and run:

```text
node <skill-dir>/scripts/action-state.mjs validate-returns --run-dir <output-root>/<RUN_ID> --json-file <temp>
```

Reject the whole return on failure — no `set-status` / `move-done`.
Re-run or fix the payload. Sub-agents run `<typecheck>` per batch;
orchestrator runs `<test>` once after all return, then prints Step 4.
