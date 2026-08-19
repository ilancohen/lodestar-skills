import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  compatibleFallowVersion,
  fallowProjectStatus,
  hasPath,
  loadContract,
  parseEnvelope,
  readCompatRecord,
  remediation,
  resolveFallow,
  runFallow,
  validateEnvelope,
} from "../skills/lodestar-audit/scripts/fallow-contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(
  ROOT,
  "skills/lodestar-audit/scripts/fallow-contract.mjs",
);
const CONTRACT = loadContract();
const FIX = path.join(ROOT, "tests/fixtures/fallow-envelopes");

function run(args, cwd = ROOT) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function spec(id) {
  return CONTRACT.commands.find((item) => item.id === id);
}

test("contract accepts Fallow ^3.15.0", () => {
  assert.equal(CONTRACT.schema_version, 10);
  assert.equal(CONTRACT.tool_version, "3.15.0");
  assert.equal(spec("combined").schema_version, 10);
  assert.equal(spec("dupes-semantic").schema_version, 8);
  assert.equal(true, compatibleFallowVersion("3.15.0", "3.15.0"));
  assert.equal(true, compatibleFallowVersion("3.15.1", "3.15.0"));
  assert.equal(true, compatibleFallowVersion("3.16.0", "3.15.0"));
  assert.equal(false, compatibleFallowVersion("3.14.0", "3.15.0"));
  assert.equal(false, compatibleFallowVersion("4.0.0", "3.15.0"));
});

test("fallowProjectStatus requires package.json declaration and node_modules bin", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-fallow-"));
  try {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "tmp", devDependencies: { fallow: "^3.15.0" } }),
    );
    const declaredOnly = fallowProjectStatus(tmp, CONTRACT);
    assert.equal(declaredOnly.declared, true);
    assert.equal(declaredOnly.needsInstall, true);
    assert.equal(declaredOnly.bin, null);

    fs.mkdirSync(path.join(tmp, "node_modules", ".bin"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "node_modules", ".bin", "fallow"),
      "#!/bin/sh\n",
    );
    fs.chmodSync(path.join(tmp, "node_modules", ".bin", "fallow"), 0o755);
    const withBin = fallowProjectStatus(tmp, CONTRACT);
    assert.equal(withBin.needsInstall, false);
    assert.ok(withBin.bin);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("resolve-bin fails when fallow is not declared in package.json", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-fallow-"));
  try {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "tmp" }),
    );
    const result = run(["resolve-bin", "--root", tmp]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /not declared in package\.json/i);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

function writeFakeFallow(tmp, script) {
  fs.mkdirSync(path.join(tmp, "node_modules", ".bin"), { recursive: true });
  const bin = path.join(tmp, "node_modules", ".bin", "fallow");
  fs.writeFileSync(bin, `#!/bin/sh\n${script}\n`);
  fs.chmodSync(bin, 0o755);
  return bin;
}

test("resolveFallow fails when declared but node_modules/.bin/fallow is missing", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-fallow-"));
  try {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "tmp", devDependencies: { fallow: "^3.15.0" } }),
    );
    assert.throws(
      () => resolveFallow(tmp, CONTRACT),
      (error) => {
        assert.match(error.message, /node_modules\/\.bin\/fallow is missing/);
        assert.match(error.message, /Install dependencies with:/);
        return true;
      },
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("resolveFallow fails when the installed Fallow version is incompatible", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-fallow-"));
  try {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "tmp", devDependencies: { fallow: "^3.15.0" } }),
    );
    writeFakeFallow(tmp, "echo '3.1.0'");
    assert.throws(
      () => resolveFallow(tmp, CONTRACT),
      (error) => {
        assert.match(error.message, /unsupported Fallow installed 3\.1\.0/);
        assert.match(error.message, /Supported version: \^3\.15\.0/);
        return true;
      },
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("resolveFallow succeeds when declared, installed, and compatible", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-fallow-"));
  try {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "tmp", devDependencies: { fallow: "^3.15.0" } }),
    );
    writeFakeFallow(tmp, "echo '3.15.0'");
    const resolved = resolveFallow(tmp, CONTRACT);
    assert.equal(resolved.version, "3.15.0");
    assert.ok(
      resolved.bin.endsWith(path.join("node_modules", ".bin", "fallow")),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("resolve-bin CLI fails when the installed Fallow version is incompatible", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-fallow-"));
  try {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "tmp", devDependencies: { fallow: "^3.15.0" } }),
    );
    writeFakeFallow(tmp, "echo '2.0.0'");
    const result = run(["resolve-bin", "--root", tmp]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unsupported Fallow installed 2\.0\.0/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("runFallow treats exit 0 and exit 1 as successful runs", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-fallow-"));
  try {
    const clean = writeFakeFallow(tmp, 'echo \'{"kind":"combined"}\'; exit 0');
    assert.equal(runFallow(clean, []).trim(), '{"kind":"combined"}');

    const findings = writeFakeFallow(
      tmp,
      'echo \'{"kind":"combined"}\'; exit 1',
    );
    assert.equal(runFallow(findings, []).trim(), '{"kind":"combined"}');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("runFallow throws on a real failure, preferring an error envelope's message", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-fallow-"));
  try {
    const stderrOnly = writeFakeFallow(tmp, "echo 'boom' >&2; exit 2");
    assert.throws(
      () => runFallow(stderrOnly, []),
      (error) => {
        assert.match(error.message, /boom/);
        assert.equal(error.exitCode, 2);
        return true;
      },
    );

    const errorEnvelope = writeFakeFallow(
      tmp,
      'echo \'{"error":true,"message":"custom failure"}\'; exit 3',
    );
    assert.throws(
      () => runFallow(errorEnvelope, []),
      (error) => {
        assert.match(error.message, /custom failure/);
        assert.equal(error.exitCode, 3);
        return true;
      },
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("list-entry-points fixture satisfies contract", () => {
  const envelope = parseEnvelope(
    fs.readFileSync(
      path.join(FIX, "v3.15.0", "list-entry-points.json"),
      "utf8",
    ),
  );
  validateEnvelope(envelope, spec("list-entry-points"), CONTRACT);
});

test("list-entry-points rejects zero entry_point_count", () => {
  const envelope = parseEnvelope(
    fs.readFileSync(
      path.join(FIX, "negative", "zero-list-entry-points.json"),
      "utf8",
    ),
  );
  assert.throws(
    () => validateEnvelope(envelope, spec("list-entry-points"), CONTRACT),
    /entry_point_count is 0/,
  );
});

test("list-entry-points honors --minimum when validating", () => {
  const envelope = parseEnvelope(
    fs.readFileSync(
      path.join(FIX, "v3.15.0", "list-entry-points.json"),
      "utf8",
    ),
  );
  assert.throws(
    () =>
      validateEnvelope(envelope, spec("list-entry-points"), CONTRACT, {
        minimum: 2,
      }),
    /expected at least 2/,
  );
});

test("baseline fixtures (v3.15.0) satisfy every command contract", () => {
  for (const command of CONTRACT.commands) {
    const file = path.join(FIX, "v3.15.0", `${command.id}.json`);
    const envelope = parseEnvelope(fs.readFileSync(file, "utf8"));
    validateEnvelope(envelope, command, CONTRACT);
    for (const field of command.required_fields) {
      assert.ok(
        hasPath(envelope, field),
        `v3.15.0 ${command.id} missing ${field}`,
      );
    }
  }
});

test("current fixtures (v3.17.0) satisfy every command contract (schema floor)", () => {
  for (const command of CONTRACT.commands) {
    const file = path.join(FIX, "v3.17.0", `${command.id}.json`);
    if (!fs.existsSync(file)) continue;
    const envelope = parseEnvelope(fs.readFileSync(file, "utf8"));
    validateEnvelope(envelope, command, CONTRACT);
    for (const field of command.required_fields) {
      assert.ok(
        hasPath(envelope, field),
        `v3.17.0 ${command.id} missing ${field}`,
      );
    }
  }
});

test("schema-99 envelope with complete fields passes (above baseline, no root)", () => {
  const result = run([
    "validate",
    "--file",
    path.join(FIX, "negative", "unsupported-schema.json"),
    "--kind",
    "combined",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const out = JSON.parse(result.stdout);
  assert.equal(out.schema_version, 99);
});

test("clone instances expose file/start_line/end_line", () => {
  const file = path.join(FIX, "v3.15.0", "dupes-semantic.json");
  const envelope = parseEnvelope(fs.readFileSync(file, "utf8"));
  assert.ok(envelope.clone_groups.length >= 1);
  const instance = envelope.clone_groups[0].instances[0];
  assert.equal(typeof instance.file, "string");
  assert.equal(typeof instance.start_line, "number");
  assert.equal(typeof instance.end_line, "number");
});

test("boundary zones expose name/patterns/file_count", () => {
  const file = path.join(FIX, "v3.15.0", "list-boundaries.json");
  const envelope = parseEnvelope(fs.readFileSync(file, "utf8"));
  const zone = envelope.boundaries.zones[0];
  assert.equal(zone.name, "app");
  assert.ok(Array.isArray(zone.patterns));
  assert.ok(zone.file_count > 0);
});

test("negative fixtures fail closed with remediation", () => {
  const cases = [
    ["malformed.json", "combined", /not JSON|Fallow output is not JSON/i],
    ["command-error.json", "combined", /boom|error/i],
    ["wrong-kind.json", "combined", /expected kind=combined/i],
    [
      "unsupported-version.json",
      "combined",
      /unsupported Fallow|Supported version/i,
    ],
    ["missing-field.json", "combined", /missing required field/i],
    ["zero-entry-points.json", "combined", /entry_points\.total is 0/i],
  ];
  for (const [name, kind, pattern] of cases) {
    const result = run([
      "validate",
      "--file",
      path.join(FIX, "negative", name),
      "--kind",
      kind,
    ]);
    assert.equal(result.status, 2, name);
    assert.match(result.stderr, pattern, name);
    assert.match(result.stderr, /Supported version: \^3\.15\.0/);
    assert.match(result.stderr, /pnpm add -D fallow@\^3\.15\.0/);
    assert.match(result.stderr, /npm install --save-dev fallow@\^3\.15\.0/);
  }
});

test("above-baseline schema with a missing field fails with pin-to-last-good message", () => {
  const result = run([
    "validate",
    "--file",
    path.join(FIX, "negative", "schema-above-baseline-missing-field.json"),
    "--kind",
    "combined",
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /dropped required field/i);
  assert.match(result.stderr, /Pin to the last known-good version/i);
  assert.match(result.stderr, /fallow@~3\.16\.0/);
});

test("empty successful combined envelope validates", () => {
  const result = run([
    "validate",
    "--file",
    path.join(FIX, "negative", "empty-ok.json"),
    "--kind",
    "combined",
  ]);
  assert.equal(result.status, 0, result.stderr);
});

test("combined fixtures expose contracted file_score fields", () => {
  const envelope = parseEnvelope(
    fs.readFileSync(path.join(FIX, "v3.15.0", "combined.json"), "utf8"),
  );
  assert.ok(envelope.health.file_scores.length >= 1);
  const score = envelope.health.file_scores[0];
  for (const field of spec("combined").file_score_fields) {
    assert.ok(field in score, `missing ${field}`);
  }
});

test("newer same-major envelope version is accepted", () => {
  const file = path.join(FIX, "v3.15.0", "combined.json");
  const envelope = parseEnvelope(fs.readFileSync(file, "utf8"));
  envelope.version = "3.16.0";
  validateEnvelope(envelope, spec("combined"), CONTRACT);
});

test("remediation names installed version, range, schema/kind, and install command", () => {
  const message = remediation(CONTRACT, "unsupported schema 9.", {
    installed: "3.14.0",
    schema: 9,
    kind: "combined",
    manager: "npm",
  });
  assert.match(message, /Installed Fallow: 3\.14\.0/);
  assert.match(message, /Supported version: \^3\.15\.0 \(schema 10 or newer\)/);
  assert.match(message, /Received schema\/kind: 9\/combined/);
  assert.match(message, /npm install --save-dev fallow@\^3\.15\.0/);
  assert.doesNotMatch(message, /ask which package manager/);
});

test("remediation aboveBaseline suggests pinning to last-known-good version", () => {
  const message = remediation(CONTRACT, "schema 11 dropped field.", {
    installed: "3.17.0",
    schema: 11,
    kind: "combined",
    manager: "pnpm",
    aboveBaseline: true,
  });
  assert.match(message, /Installed Fallow: 3\.17\.0/);
  assert.match(message, /schema 10 or newer, fields must be intact/);
  assert.match(message, /Received schema\/kind: 11\/combined/);
  assert.match(message, /pnpm add -D fallow@~3\.16\.0/);
  assert.match(message, /changed fields the audit reads/);
});

test("higher schema with complete fields passes without root (no compat write)", () => {
  const result = run([
    "validate",
    "--file",
    path.join(FIX, "v3.17.0", "combined.json"),
    "--kind",
    "combined",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const out = JSON.parse(result.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.schema_version, 11);
});

test("higher schema with complete fields writes compat record when root is given", () => {
  const tmp = fs.mkdtempSync(path.join(ROOT, "tests/fixtures/.tmp-compat-"));
  try {
    fs.mkdirSync(path.join(tmp, ".agents/lodestar"), { recursive: true });
    const result = run([
      "validate",
      "--file",
      path.join(FIX, "v3.17.0", "combined.json"),
      "--kind",
      "combined",
      "--root",
      tmp,
    ]);
    assert.equal(result.status, 0, result.stderr);
    const record = readCompatRecord(tmp);
    assert.ok(record, "compat record should be written");
    assert.equal(record.fallow_version, "3.17.0");
    assert.equal(record.verified.combined, 11);
    assert.equal(record.baseline.combined, 10);
    assert.match(result.stderr, /schema accepted and recorded/i);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("second run with recorded schema passes silently (no re-note)", () => {
  const tmp = fs.mkdtempSync(path.join(ROOT, "tests/fixtures/.tmp-compat-"));
  try {
    fs.mkdirSync(path.join(tmp, ".agents/lodestar"), { recursive: true });
    const file = path.join(FIX, "v3.17.0", "combined.json");
    // First run — records
    run(["validate", "--file", file, "--kind", "combined", "--root", tmp]);
    // Second run — already recorded
    const result = run([
      "validate",
      "--file",
      file,
      "--kind",
      "combined",
      "--root",
      tmp,
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stderr, /schema accepted and recorded/i);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("compat write failure does not fail the audit", () => {
  // Pass a root whose .agents/lodestar is a file (not a dir) so atomicWrite fails.
  const tmp = fs.mkdtempSync(path.join(ROOT, "tests/fixtures/.tmp-compat-"));
  try {
    fs.mkdirSync(path.join(tmp, ".agents"), { recursive: true });
    // Make .agents/lodestar a file — directory creation inside it will fail
    fs.writeFileSync(path.join(tmp, ".agents/lodestar"), "not-a-dir");
    const result = run([
      "validate",
      "--file",
      path.join(FIX, "v3.17.0", "combined.json"),
      "--kind",
      "combined",
      "--root",
      tmp,
    ]);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("live fallow matrix validates every consumed command when enabled", async (t) => {
  if (process.env.FALLOW_CONTRACT_LIVE !== "1") {
    t.skip(
      "set FALLOW_CONTRACT_LIVE=1 with fallow installed in the fixture repo",
    );
    return;
  }
  const fixture = path.join(ROOT, "tests/fixtures/repos/fallow-contract");
  for (const command of CONTRACT.commands) {
    const args = ["run", "--root", fixture, "--id", command.id];
    if (command.id === "dead-code-trace") {
      args.push("--trace", "src/index.ts:unusedExport");
    } else if (command.id === "dead-code-trace-file") {
      args.push("--file", "src/orphan.ts");
    } else if (command.id === "dead-code-trace-dependency") {
      args.push("--dependency", "typescript");
    }
    const result = run(args);
    assert.equal(result.status, 0, `${command.id}: ${result.stderr}`);
    const payload = JSON.parse(result.stdout);
    if (payload.version) {
      assert.equal(
        true,
        compatibleFallowVersion(payload.version, CONTRACT.tool_version),
        payload.version,
      );
    }
    if (command.require_schema) {
      assert.ok(
        payload.schema_version >= command.schema_version,
        `${command.id} schema ${payload.schema_version} should be >= baseline ${command.schema_version}`,
      );
    }
    assert.equal(payload.kind, command.kind);
  }
});

test("run without --out prints the envelope; with --out writes the file", async (t) => {
  if (process.env.FALLOW_CONTRACT_LIVE !== "1") {
    t.skip("live only");
    return;
  }
  const fixture = path.join(ROOT, "tests/fixtures/repos/fallow-contract");
  const printed = run([
    "run",
    "--root",
    fixture,
    "--id",
    "dead-code-trace-file",
    "--file",
    "src/orphan.ts",
  ]);
  assert.equal(printed.status, 0, printed.stderr);
  const envelope = JSON.parse(printed.stdout);
  assert.equal(envelope.kind, "trace");
  assert.equal(envelope.file, "src/orphan.ts");

  const out = path.join(fixture, ".audit-fallow-boundaries.json");
  try {
    const written = run([
      "run",
      "--root",
      fixture,
      "--id",
      "list-boundaries",
      "--out",
      ".audit-fallow-boundaries.json",
    ]);
    assert.equal(written.status, 0, written.stderr);
    const meta = JSON.parse(written.stdout);
    assert.equal(meta.ok, true);
    assert.equal(meta.kind, "list-boundaries");
    assert.ok(fs.existsSync(out));
    assert.equal(
      JSON.parse(fs.readFileSync(out, "utf8")).kind,
      "list-boundaries",
    );
  } finally {
    fs.rmSync(out, { force: true });
  }
});
