## Resuming

Re-running against the same run directory:

1. Files already moved to `<output-root>/<RUN_ID>/done/` are never
   re-touched.
2. Items with `status: in_progress` in the run root surface first. For
   each, print the item and the git diff (if any) and ask: "This one was
   half-finished last time. Start it over, keep what's there and call it
   done, or undo it and come back to it later? (start over / keep it /
   undo it)". "Start over" re-applies the fix from scratch (any partial
   diff must be reverted first); "keep it" trusts the existing diff and
   moves the file to `done/`; "undo it" rolls back and writes
   `status: deferred` (leaves the file in the run root).
3. Items with `status: deferred` in the run root surface next. Say what
   was blocking each one, then ask: "Is this sorted now? (yes, try again /
   no, drop it / leave it for later)".
4. Unstarted items follow as in a fresh session.
