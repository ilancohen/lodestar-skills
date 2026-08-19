# Linter probe

Load this before running linter probes in `types`, `errors`, or
`boundaries` B. Keep the read-only rule from `SKILL.md` — do not install
linter packages or modify config.

## When to run

Skip when `<lint>` is `n/a` or `validate-input` returns `linter: null`.
Otherwise run `linter.probe` from `validate-input` (written by setup).

## Probe command

Substitute `<all_pkg_roots>` in `linter.probe` before running. Cache JSON
in the platform temp directory (Node `os.tmpdir()`), not a fixed path
like `/tmp`. Delete the cached file at the end of Phase 1.

When the probe binary is not on `PATH`, prefix with the package manager
exec (`<run> eslint …`, `npx eslint …`, …) the same way Fallow install
commands are composed.

```bash
LINT_DIR="$(node -e "process.stdout.write(require('node:os').tmpdir())")"
<probe-command> > "$LINT_DIR/.audit-lint-<category>.json"
```

```powershell
$LINT_DIR = node -e "process.stdout.write(require('node:os').tmpdir())"
<probe-command> | node -e "require('node:fs').writeFileSync(process.argv[1], require('node:fs').readFileSync(0))" "$LINT_DIR/.audit-lint-<category>.json"
```

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
configured:

```bash
eslint --print-config <any-ts-file> 2>/dev/null | grep -q '"boundaries' \
  && <probe-command> 2>/dev/null | node -e "
      const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
      (Array.isArray(d)?d:[d]).forEach(f=>(f.messages||[]).filter(m=>m.ruleId&&m.ruleId.startsWith('boundaries/')).forEach(m=>console.log((f.filePath||f.file)+':'+m.line+': '+m.message)))
    "
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
