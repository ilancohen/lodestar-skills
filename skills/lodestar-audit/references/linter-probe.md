# Linter probe

Load this before running linter probes in `types`, `errors`, or
`boundaries` B. Keep the read-only rule from `SKILL.md` — do not install
linter packages or modify config.

## When to run

Skip when `<lint>` is `n/a` or `validate-input` returns `linter: null`.
Otherwise run `linter.probe` from `validate-input` (written by setup).

## Probe command

Substitute `<all_pkg_roots>` in `linter.probe` before running. Cache JSON
in the platform temp directory (Node `os.tmpdir()`), never in the repo.
Delete the cached file after **each** probe command and at the end of
Phase 1 — whether the probe succeeded, failed, or the JSON could not be
parsed.

Run the probe through `fallow-contract.mjs run-liveness` so it stays
visibly alive (streamed stderr, sparse heartbeat, 10-minute timeout,
duration on completion) — same guarantees as Fallow. Do not redirect a
raw probe into a file with no timeout; quiet long ESLint/Biome runs hang
silently that way.

When the probe binary is not on `PATH`, prefix with the package manager
exec (`pnpm exec eslint …`, `npx eslint …`, …) the same way other local
devDependency binaries are invoked — put that full argv after `--`.

```bash
LINT_DIR="$(node -e "process.stdout.write(require('node:os').tmpdir())")"
OUT="$LINT_DIR/.audit-lint-<category>.json"
node <lodestar-audit-skill>/scripts/fallow-contract.mjs run-liveness \
  --out "$OUT" \
  --label lint-<category> \
  -- <probe-command-as-argv…>
# always:
rm -f "$OUT"
```

```powershell
$LINT_DIR = node -e "process.stdout.write(require('node:os').tmpdir())"
$OUT = Join-Path $LINT_DIR ".audit-lint-<category>.json"
node <lodestar-audit-skill>/scripts/fallow-contract.mjs run-liveness `
  --out $OUT `
  --label lint-<category> `
  -- <probe-command-as-argv…>
Remove-Item -Force $OUT -ErrorAction SilentlyContinue
```

Split `<probe-command>` into argv tokens after `--` (do not wrap the whole
command in `sh -c` unless the probe truly requires a shell).

## Rule → finding mapping

Extract violations from the cached JSON. Match by rule id or by normalized
message text when ids differ.

### `types`

| Finding           | Rule ids (any match)                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| #1 misplaced-type | `@typescript-eslint/consistent-type-imports`, `correctness/useImportType`, `import/consistent-type-specifier-style` |
| #3 unguarded-any  | `@typescript-eslint/no-explicit-any`, `suspicious/noExplicitAny`, `typescript/no-explicit-any`                      |

### `errors`

| Finding                   | Rule ids (any match)                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A swallowed-async         | `@typescript-eslint/no-floating-promises`, `correctness/noFloatingPromises`, `typescript/no-floating-promises`                                                     |
| B expected-failure-thrown | `@typescript-eslint/no-throw-literal`, `@typescript-eslint/prefer-promise-reject-errors`, `style/noThrowLiteral` (skip when `conventions["result-types"]` is `no`) |

Linter-sourced B findings do not require `requires_decision: true` by
default (unlike grep-sourced ones).

### `boundaries` B

Only when `linter.tool` is `eslint` and `eslint-plugin-boundaries` is
configured. Prefer `run-liveness` for the probe half; the
`--print-config` gate can stay a short sync check:

```bash
eslint --print-config <any-ts-file> 2>/dev/null | grep -q '"boundaries' \
  && node <lodestar-audit-skill>/scripts/fallow-contract.mjs run-liveness \
       --out "$OUT" --label lint-boundaries -- <probe-command-as-argv…>
```

Other linters: use grep fallback for B.

## Parsing notes

- **ESLint** — array of `{ filePath, messages: [{ ruleId, line, message }] }`.
- **Biome** — `{ diagnostics: [...] }` or CLI JSON array; map `code` to rule id.
- **oxlint** — `{ diagnostics: [...] }` with `code` field.
- **deno lint --json** — `{ diagnostics: [...] }` with `code`.

If parsing fails or the probe exits non-zero with no output, fall through
to grep heuristics silently.

## Disable comments

When suggesting an intentional `any`, use the disable syntax for
`linter.tool`:

| Tool     | Example                                                                |
| -------- | ---------------------------------------------------------------------- |
| `eslint` | `// eslint-disable-next-line @typescript-eslint/no-explicit-any`       |
| `biome`  | `// biome-ignore lint/suspicious/noExplicitAny: <reason>`              |
| other    | that tool's inline-ignore comment, or a plain comment when none exists |
