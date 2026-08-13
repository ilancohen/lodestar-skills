# Fallow envelope fixtures

Generated against `tests/fixtures/repos/fallow-contract`.

Supported schema: `7`.
Supported tool range: `3.10.0`–`3.14.0` (3.9.1 retained as below-min evidence; 3.15.0+ emits schema 10 and is out of range).

## Regeneration

```bash
FIXTURE=tests/fixtures/repos/fallow-contract
OUT=tests/fixtures/fallow-envelopes
cd "$FIXTURE"
npm install --save-dev fallow@<version>
./node_modules/.bin/fallow --format json --quiet > "$OLDPWD/$OUT/v<version>/combined.json"
./node_modules/.bin/fallow list --boundaries --format json --quiet > "$OLDPWD/$OUT/v<version>/list-boundaries.json"
./node_modules/.bin/fallow dupes --mode semantic --format json --quiet > "$OLDPWD/$OUT/v<version>/dupes-semantic.json"
./node_modules/.bin/fallow dead-code --trace 'src/index.ts:unusedExport' --format json --quiet > "$OLDPWD/$OUT/v<version>/dead-code-trace.json"
./node_modules/.bin/fallow dead-code --trace-file src/orphan.ts --format json --quiet > "$OLDPWD/$OUT/v<version>/dead-code-trace-file.json"
./node_modules/.bin/fallow dead-code --trace-dependency typescript --format json --quiet > "$OLDPWD/$OUT/v<version>/dead-code-trace-dependency.json"
```

Do not expand the supported range without regenerating both ends, updating
`skills/ep-audit/scripts/fallow-contract.json`, and human review.
