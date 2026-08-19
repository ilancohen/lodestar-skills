# Linter rules for higher-accuracy audit findings

Read this only when the linter permissions row was ticked. Enabling these rules
in an **existing** linter config makes opportunistic probes in
`lodestar-audit` definitive rather than heuristic. Do not install a new
linter or write config without consent.

The sections below document **ESLint** and **Biome** because they are
common and have stable rule IDs the audit maps directly. For any other
linter recorded in `context.md` (`oxlint`, `deno`, `ruff`, …), enable
the closest equivalent rules that tool exposes — the audit reads the
linter recorded in the `lint` cell and maps violations by rule id or message when possible.

## ESLint with `@typescript-eslint`

Recommend enabling (in `eslint.config.*` or `.eslintrc.*`):

```js
// @typescript-eslint rules that map directly to lodestar-audit categories
'@typescript-eslint/no-explicit-any': 'error',          // types #3
'@typescript-eslint/consistent-type-imports': 'error',  // types #1
'@typescript-eslint/no-floating-promises': 'error',     // errors A
'@typescript-eslint/no-throw-literal': 'error',         // errors B
'@typescript-eslint/prefer-promise-reject-errors': 'error', // errors B
```

These rules are already assumed by lodestar-audit's fix recipes (e.g. the
`any` fix recipe references
`eslint-disable-next-line @typescript-eslint/no-explicit-any`).

For `boundaries.B` (misplaced business logic), also recommend adding
`eslint-plugin-boundaries`. Once configured, lodestar-audit uses its
output directly and produces definitive findings with no
`requires_decision` overhead. Use the zone structure already written to
`.fallowrc.json` as the source — each zone becomes an element type:

```js
// eslint-plugin-boundaries element-types rule
// (derived from .fallowrc.json zones — one entry per package)
'boundaries/element-types': ['error', {
  default: 'disallow',
  rules: [
    // Mirror the dependency direction from .agents/lodestar/context.md:
    // e.g. { from: 'web', allow: ['server'] },
    //       { from: 'server', allow: ['core'] }, ...
  ]
}]
```

## Biome

Biome covers the equivalent rules via its `correctness` and `suspicious`
groups. Check that these are enabled:

- `correctness/noFloatingPromises` → errors A
- `suspicious/noExplicitAny` → types #3
- `correctness/useImportType` → types #1

Biome does not have a boundaries/layer enforcement rule. The grep fallback
in lodestar-audit handles `boundaries.B` when Biome is the only linter.

## Other linters

When the recorded tool is not ESLint or Biome, look up that linter's
docs for rules equivalent to the mappings in
[`lodestar-audit/references/linter-probe.md`](../lodestar-audit/references/linter-probe.md)
(`types` #1/#3, `errors` A/B). Enable them in the existing config only
— do not install packages. If the tool has no JSON reporter or no
matching rule, skip; the audit falls back to grep heuristics.
