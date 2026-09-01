# Operations

Exactly one applies to each in-scope, unprotected file.

### Delete

Nothing in it that tomorrow needs. Remove it.

Common cases: an implemented plan; a fixed audit item; a status snapshot
from mid-refactor; a findings file whose findings all became commits;
anything in a `done/` folder describing work that shipped.

### Rescue, then delete

Same as delete, but something passes the harvest bar. Write that into a
home from `homes`, then delete the file.

Common cases: an abandoned plan (why it was abandoned belongs in
`docs/rejected-approaches.md` **if that file exists**); a pilot writeup
with measured results; a design rationale that never made it into a spec.

### Merge

Several documents cover one topic and a reader has to bounce between
them. Combine them into the single most-authoritative **existing** file.
Preserve every distinct claim; drop only true duplication. Then delete
the extras.

### Strip

The document survives but parts of it do not. Cut change-history
sections (git is the change log), decisions that were all made,
future-work that never happened, and restated background now covered
elsewhere — replace that last one with a one-line pointer. Strip
surgically; do not rewrite the document's voice.

## Folder-specific

**`done/` staging** (audit or plans). Empty every run. Skim rather than
deep-read: work that shipped is visible in the code, so harvest yield is
usually zero.

**`abandoned/`.** Read fully. Negative results hide here. Harvest into
`docs/rejected-approaches.md` when that home exists, then empty the
folder.

**Architecture reports.** Each dated file is a completed opinion. Keep
it only if an agent would still use it. Superseded reviews are deletes
unless they hold a unique measurement or rejected approach.

**`docs/plans/README.md`.** If it is in scope (full-tree or `--tree`),
it tracks in-flight plans only. Delete Done and Abandoned tables. Do not
touch in-flight rows.

**ADRs.** Not retired by this suite. Run them through the keep-bar like
anything else. Do not delete an ADR folder on a blanket rule. Do not
write new ADRs.

**Non-markdown.** Delete checked-in build output and `.DS_Store` on
sight, without asking. Keep an image only when a surviving markdown file
links to it.

**Orphans.** A doc that nothing links to and nobody has touched in
months is a strong delete signal. Check with
`rg -n 'the-filename' --glob '!node_modules'` and the survey's
`lastCommit`.
