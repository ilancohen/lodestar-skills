# Linter rules for higher-accuracy audit findings

Read this only when the linter row was ticked. Enabling these rules
in an **existing** linter config makes opportunistic probes in
`lodestar-audit` definitive rather than heuristic. Do not install a new
linter or write config without consent.

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
