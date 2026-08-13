import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  hasPath,
  loadContract,
  parseEnvelope,
  remediation,
  validateEnvelope,
} from "../skills/ep-audit/scripts/fallow-contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "skills/ep-audit/scripts/fallow-contract.mjs");
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

test("contract pins Fallow 3.15.0", () => {
  assert.equal(CONTRACT.schema_version, 10);
  assert.equal(CONTRACT.tool_version, "3.15.0");
  assert.equal(spec("combined").schema_version, 10);
  assert.equal(spec("dupes-semantic").schema_version, 8);
});

test("current fixtures satisfy every command contract", () => {
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
    ["unsupported-schema.json", "combined", /unsupported schema/i],
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
    assert.match(result.stderr, /Supported version: 3\.15\.0/);
    assert.match(result.stderr, /pnpm add -D fallow@3\.15\.0/);
    assert.match(result.stderr, /npm install --save-dev fallow@3\.15\.0/);
  }
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

test("remediation names installed version, pin, schema/kind, and install command", () => {
  const message = remediation(CONTRACT, "unsupported schema 99.", {
    installed: "3.14.0",
    schema: 99,
    kind: "combined",
    manager: "npm",
  });
  assert.match(message, /Installed Fallow: 3\.14\.0/);
  assert.match(message, /Supported version: 3\.15\.0 \(schema 10\)/);
  assert.match(message, /Received schema\/kind: 99\/combined/);
  assert.match(message, /npm install --save-dev fallow@3\.15\.0/);
  assert.doesNotMatch(message, /ask which package manager/);
});

test("live fallow matrix validates every consumed command when enabled", async (t) => {
  if (process.env.FALLOW_CONTRACT_LIVE !== "1") {
    t.skip(
      "set FALLOW_CONTRACT_LIVE=1 with fallow installed in the fixture repo",
    );
    return;
  }
  const fixture = path.join(ROOT, "tests/fixtures/repos/fallow-contract");
  const version = process.env.FALLOW_CONTRACT_VERSION || CONTRACT.tool_version;
  assert.ok(version, "FALLOW_CONTRACT_VERSION is required for live runs");
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
    assert.equal(payload.version || version, version);
    if (command.require_schema) {
      assert.equal(payload.schema_version, command.schema_version);
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
