# Implementation roadmap

## 1. Publish the standalone package

- Create the remote repository and set it as `origin`.
- Add the final repository and homepage URLs to every manifest that supports
  them.
- Decide how consuming repositories receive updates instead of retaining
  unsynchronized vendored copies.
- Add an automated sync or migration path for copies currently embedded in
  consuming repositories.
- Create the initial commit, tag `v0.1.0`, and publish the first release.

Acceptance:

- A clean checkout installs all four skills with one documented command.
- Installed files report `0.1.0`.
- Consuming repositories have a documented, repeatable upgrade path.

## 2. Reduce `ep-audit` below the progressive-disclosure limit

- Move detailed phase orchestration from `SKILL.md` into focused reference
  files until the main file is under 500 lines and approximately 5,000 tokens.
- Preserve all safety rules, stop conditions, output contracts, and
  restartability in content loaded before the relevant action.
- Replace repeated run-ID resolution, frontmatter parsing, placeholder checks,
  finding merges, and status bookkeeping with deterministic scripts.
- Add tests for each extracted script, including malformed and interrupted
  states.

Acceptance:

- `skills/ep-audit/SKILL.md` is under 500 lines.
- Script tests cover success, retry, malformed input, and partial-run recovery.
- Existing audit fixtures produce equivalent findings and action items.

## 3. Complete trigger and output evaluations

For each skill:

- Add 8–10 realistic should-trigger prompts.
- Add 8–10 realistic near-miss prompts that should not trigger.
- Add objective assertions to the end-to-end evals.
- Run each trigger query three times and record activation rates.
- Run end-to-end cases both with the skill and against a no-skill baseline.
- Compare correctness, tool calls, duration, and token use.
- Review execution traces and revise instructions that cause wasted work.

Acceptance:

- Every skill has measured positive and negative trigger behavior.
- Every end-to-end case has assertions and baseline results.
- Results and human review are retained as release artifacts.

## 4. Add cross-platform command support

- Replace POSIX-only multi-step shell recipes with portable scripts where
  practical.
- Add tested PowerShell alternatives for commands that remain shell-specific.
- Add Windows CI coverage.
- Update each skill's `compatibility` field after Windows support passes.

Acceptance:

- Package validation and representative skill runs pass on Linux, macOS, and
  Windows.
- No skill claims Windows support before those checks pass.

## 5. Define and test Fallow compatibility

- Declare the supported Fallow version range.
- Add a fixture for the expected schema-version-7 envelopes consumed by
  `ep-audit`.
- Add compatibility tests for every consumed Fallow command and field.
- Produce a clear upgrade error when the installed Fallow version or schema is
  unsupported.

Acceptance:

- CI verifies the minimum and current supported Fallow versions.
- A schema change fails with a precise remediation message.

## 6. Finish client adapters and validation

- Add a Kiro adapter whose setup, audit, and architecture-review entries are
  manual and whose source-modifying `ep-fix` entry can never be always-loaded.
- Add schema or native CLI validation for Agent Plugin, Claude, Codex, and
  Gemini manifests in CI.
- Test local installation and discovery in each supported client.
- Resolve the Claude plugin validator warning for contributor-only
  `CLAUDE.md` without making development guidance runtime plugin context.

Acceptance:

- Every supported client discovers exactly four skills from canonical
  `skills/` content.
- No adapter duplicates skill logic.
- No source-mutating workflow is automatically loaded by an adapter.
- All client validators pass without warnings.
