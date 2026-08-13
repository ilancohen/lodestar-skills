# Fallow envelope fixtures

Generated against `tests/fixtures/repos/fallow-contract`.

Supported tool range: `3.15.0` (combined `schema_version` 10; dupes `schema_version` 8).
`v3.14.0/` is retained as below-min / historical evidence only.

## Regeneration

```bash
FIXTURE=tests/fixtures/repos/fallow-contract
OUT=tests/fixtures/fallow-envelopes
cd "$FIXTURE"
npm install --save-dev fallow@3.15.0
./node_modules/.bin/fallow --format json --quiet > "$OLDPWD/$OUT/v3.15.0/combined.json"
./node_modules/.bin/fallow list --boundaries --format json --quiet > "$OLDPWD/$OUT/v3.15.0/list-boundaries.json"
./node_modules/.bin/fallow dupes --mode semantic --format json --quiet > "$OLDPWD/$OUT/v3.15.0/dupes-semantic.json"
./node_modules/.bin/fallow dead-code --trace 'src/index.ts:unusedExport' --format json --quiet > "$OLDPWD/$OUT/v3.15.0/dead-code-trace.json"
./node_modules/.bin/fallow dead-code --trace-file src/orphan.ts --format json --quiet > "$OLDPWD/$OUT/v3.15.0/dead-code-trace-file.json"
./node_modules/.bin/fallow dead-code --trace-dependency typescript --format json --quiet > "$OLDPWD/$OUT/v3.15.0/dead-code-trace-dependency.json"
```

Do not expand the supported range without regenerating fixtures, updating
`skills/ep-audit/scripts/fallow-contract.json`, and human review.
