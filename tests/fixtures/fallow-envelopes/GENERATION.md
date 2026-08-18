# Fallow envelope fixtures

Generated against `tests/fixtures/repos/fallow-contract`.

## Schema policy

`schema_version` values in `fallow-contract.json` are **floors**, not exact
targets. A newer Fallow schema passes validation when every field the audit
reads is still present. On the first encounter the contract script records the
accepted version/schema pair in `.agents/lodestar/fallow-compat.json` in the
target repo.

| Fixture set | Tool version | combined schema | dupes schema |
| ----------- | ------------ | --------------- | ------------ |
| `v3.15.0/`  | 3.15.0       | 10 (baseline)   | 8 (baseline) |
| `v3.17.0/`  | 3.17.0       | 11              | 9            |

`v3.15.0/` is the **baseline** — it matches the exact floor values in the
contract. The live `FALLOW_CONTRACT_LIVE=1` test runs against this version.
`v3.17.0/` exercises the schema-floor path (schema above baseline, all fields
present).

The `negative/` directory also contains:

- `schema-above-baseline-missing-field.json` — schema 11, `check.unused_files`
  removed. Exercises the "above-baseline dropped a field" failure path that
  produces a pin-to-last-known-good remediation message.
- `unsupported-schema.json` — schema 99 with all required fields present. Now
  accepted (schema floor passes). Used by the positive "schema-99 passes" test.

## Regeneration

### Baseline (v3.15.0)

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
npm install --save-dev fallow@3.15.0  # restore
```

### Current (v3.17.0)

```bash
FIXTURE=tests/fixtures/repos/fallow-contract
OUT=tests/fixtures/fallow-envelopes
cd "$FIXTURE"
npm install --save-dev fallow@3.17.0
./node_modules/.bin/fallow --format json --quiet > "$OLDPWD/$OUT/v3.17.0/combined.json"
./node_modules/.bin/fallow list --boundaries --format json --quiet > "$OLDPWD/$OUT/v3.17.0/list-boundaries.json"
./node_modules/.bin/fallow dupes --mode semantic --format json --quiet > "$OLDPWD/$OUT/v3.17.0/dupes-semantic.json"
./node_modules/.bin/fallow dead-code --trace 'src/index.ts:unusedExport' --format json --quiet > "$OLDPWD/$OUT/v3.17.0/dead-code-trace.json"
./node_modules/.bin/fallow dead-code --trace-file src/orphan.ts --format json --quiet > "$OLDPWD/$OUT/v3.17.0/dead-code-trace-file.json"
./node_modules/.bin/fallow dead-code --trace-dependency typescript --format json --quiet > "$OLDPWD/$OUT/v3.17.0/dead-code-trace-dependency.json"
npm install --save-dev fallow@3.15.0  # restore baseline
node -e "
  const e = JSON.parse(require('fs').readFileSync('$OLDPWD/$OUT/v3.17.0/combined.json','utf8'));
  delete e.check.unused_files;
  require('fs').writeFileSync('$OLDPWD/$OUT/negative/schema-above-baseline-missing-field.json', JSON.stringify(e)+'\n');
"
```

Do not raise the floor or change the supported major without regenerating
fixtures, updating `skills/lodestar-audit/scripts/fallow-contract.json`, and
human review.
