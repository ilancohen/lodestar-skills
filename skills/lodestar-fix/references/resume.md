## Resuming

Re-running against the same run directory:

1. Files already moved to `<output-root>/<RUN_ID>/done/` are never
   re-touched.
2. Items with `status: in_progress` in the run root surface first. For
   each, print the item and the git diff (if any) and ask: "This one was
   half-finished last time. Start it over, keep what's there, or undo it
   and come back to it later? (start over / keep it / undo it)".

   - **Start over** — revert any partial diff first, then re-apply from
     Step 3.3 onward (including acceptance).
   - **Keep it** — do **not** trust prose or a prior sub-agent return.
     Observe the working tree and Git state, then rerun the item's
     **Acceptance check** (Step 3.5). Only if that passes may you mark
     done and move to `done/`. A failed check → `status: deferred` with
     the exact failure in `note:`; leave the file in the run root.
   - **Undo it** — roll back and write `status: deferred` (leave the
     file in the run root).
3. Items with `status: deferred` in the run root surface next. Say what
   was blocking each one, then ask: "Is this sorted now? (yes, try again /
   no, drop it / leave it for later)". "Yes, try again" re-enters Execute
   from Step 3.2 and still requires a passing acceptance check before
   done.
4. Unstarted items follow as in a fresh session.
