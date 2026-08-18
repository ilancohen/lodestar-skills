# Step 3a — Confirm how lodestar-fix commits

Ask once, pre-filled from Step 1 / `context-md.md` `## Audit Configuration`:

> Later, `lodestar-fix` will change code for you. When it finishes a fix,
> what should it do with the change?
>
> - **Ask me each time** (suggested) — it checks with you before every
>   commit.
> - **Commit each fix on its own** — one commit per fix, no questions.
> - **Never commit** — it leaves the changes in your working copy for you
>   to commit yourself.
>
> I'll also use these, changed them if they're wrong: commit messages look
> like `<subject-format>`, <trailer or "no extra line at the end">, it
> won't commit on `<protected branches>`, and it <will / won't> insist on
> a clean working copy first.
>
> You have `<husky | lefthook | plain git hooks | no>` commit hooks. They
> always run — nothing here skips them.

Record the choice as `commits: ask` / `per-item` / `never`. `never` means
no ask, no commit, edits stay unstaged. Write git keys in
`## Audit Configuration` in both enforcement modes.
