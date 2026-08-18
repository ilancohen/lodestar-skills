import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assignIds,
  CONVENTION_DEFAULTS,
  dedupeFindings,
  findPlaceholders,
  isWrongDirectionImport,
  nextRunId,
  parseConventions,
  parseDirection,
  parseFindings,
  parsePackageLayout,
  sortFindings,
} from "../skills/lodestar-audit/scripts/audit-state.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "skills/lodestar-audit/scripts/audit-state.mjs");
const VALID = path.join(ROOT, "tests/fixtures/repos/valid");
const CYCLIC = path.join(ROOT, "tests/fixtures/repos/cyclic");
const PLACEHOLDER = path.join(ROOT, "tests/fixtures/repos/placeholder");
const CLEAN = path.join(ROOT, "tests/fixtures/audit-runs/clean/findings.md");
const HEAVY = path.join(
  ROOT,
  "tests/fixtures/audit-runs/finding-heavy/findings.md",
);
const MALFORMED = path.join(
  ROOT,
  "tests/fixtures/audit-runs/malformed/findings.md",
);
const INTERRUPTED = path.join(
  ROOT,
  "tests/fixtures/audit-runs/interrupted/findings.md",
);

function run(args, cwd = ROOT) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function sha(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

test("parseDirection acyclic chain preserves reachability", () => {
  const parsed = parseDirection(
    "## Dependency Direction\n\ncore → api → shared\n\n## Package Layout",
  );
  assert.deepEqual(parsed.chain, ["core", "api", "shared"]);
  assert.equal(parsed.cyclic, false);
  assert.deepEqual(parsed.reachability.core, ["core", "api", "shared"]);
  assert.deepEqual(parsed.reachability.api, ["api", "shared"]);
  assert.deepEqual(parsed.reachability.shared, ["shared"]);
});

test("parseDirection reads cyclic edge lists", () => {
  const parsed = parseDirection(
    "## Dependency Direction\n\n- core → api (2 imports) [cycle]\n- api → core (1 import) [cycle]\n\nThe graph is cyclic.\n\n## Package Layout",
  );
  assert.equal(parsed.chain, null);
  assert.equal(parsed.cyclic, true);
  assert.equal(parsed.edges.length, 2);
  assert.deepEqual(parsed.reachability.core, ["core", "api"]);
  assert.deepEqual(parsed.reachability.api, ["api", "core"]);
});

test("documented cycle edges are not wrong-direction imports", () => {
  const parsed = parseDirection(
    "## Dependency Direction\n\n- core → api (2 imports) [cycle]\n- api → core (1 import) [cycle]\n\n## Package Layout",
  );
  assert.equal(isWrongDirectionImport("core", "api", parsed), false);
  assert.equal(isWrongDirectionImport("api", "core", parsed), false);
});

test("acyclic upward imports are wrong-direction", () => {
  const parsed = parseDirection("## Dependency Direction\n\ncore → api\n\n## Package Layout");
  assert.equal(isWrongDirectionImport("api", "core", parsed), true);
  assert.equal(isWrongDirectionImport("core", "api", parsed), false);
});

test("validate-input returns directionGraph for cyclic fixture", () => {
  const result = run(["validate-input", "--root", CYCLIC]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.direction.length, 0);
  assert.equal(payload.directionGraph.cyclic, true);
  assert.equal(payload.directionGraph.edges.length, 2);
});

test("nextRunId skips taken dates", () => {
  assert.equal(nextRunId([], "2026-08-10"), "2026-08-10");
  assert.equal(nextRunId(["2026-08-10"], "2026-08-10"), "2026-08-10-002");
  assert.equal(
    nextRunId(["2026-08-10", "2026-08-10-002"], "2026-08-10"),
    "2026-08-10-003",
  );
});

test("validate-input accepts a real layout and does not touch source", () => {
  const source = path.join(VALID, "packages/core/src/index.ts");
  const before = sha(source);
  const result = run(["validate-input", "--root", VALID]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.packages.length, 2);
  assert.equal(payload.packages[0].name, "core");
  assert.equal(payload.pkgManager, null);
  assert.equal(payload.pkgManagerAmbiguous, true);
  assert.deepEqual(payload.conventions, CONVENTION_DEFAULTS);
  assert.equal(sha(source), before);
});

test("validate-input rejects placeholder responsibilities", () => {
  const result = run(["validate-input", "--root", PLACEHOLDER]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no real Responsibility/);
});

test("clean findings validate", () => {
  const result = run(["validate-output", "--path", CLEAN]);
  assert.equal(result.status, 0, result.stderr);
});

test("finding-heavy fixture round-trips through merge with stable ids", () => {
  const parsed = parseFindings(fs.readFileSync(HEAVY, "utf8"));
  assert.equal(parsed.findings.length, 2);
  const merged = assignIds(
    dedupeFindings(sortFindings(parsed.findings.concat(parsed.findings))),
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, "F0001");
  assert.equal(merged[1].id, "F0002");
});

test("malformed findings fail validate-output", () => {
  const result = run(["validate-output", "--path", MALFORMED]);
  assert.notEqual(result.status, 0);
});

test("placeholders are detected", () => {
  const hits = findPlaceholders("run <typecheck> in <pkg_root>");
  assert.equal(hits.length, 1);
});

test("interrupted recover resumes discover", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const runDir = path.join(tmp, "2026-08-10");
  fs.mkdirSync(runDir, { recursive: true });
  fs.copyFileSync(INTERRUPTED, path.join(runDir, "findings.md"));
  const result = run(["recover", "--run-dir", runDir]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.action, "resume-discover");
  assert.ok(payload.incompleteCategories.includes("types"));
  assert.ok(!payload.incompleteCategories.includes("imports"));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("checkpoint is atomic and recover does not duplicate findings", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const runDir = path.join(tmp, "2026-08-10");
  fs.mkdirSync(runDir, { recursive: true });
  fs.copyFileSync(HEAVY, path.join(runDir, "findings.md"));
  const first = run([
    "checkpoint",
    "--run-dir",
    runDir,
    "--category",
    "imports",
    "--status",
    "complete",
    "--count",
    "2",
  ]);
  assert.equal(first.status, 0, first.stderr);
  const second = run([
    "checkpoint",
    "--run-dir",
    runDir,
    "--category",
    "imports",
    "--status",
    "complete",
    "--count",
    "2",
  ]);
  assert.equal(second.status, 0, second.stderr);
  const recovered = JSON.parse(run(["recover", "--run-dir", runDir]).stdout);
  assert.equal(recovered.findings.length, 2);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("merge-findings rejects malformed json", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const bad = path.join(tmp, "bad.json");
  fs.writeFileSync(bad, "{not json");
  const result = run(["merge-findings", "--in", bad]);
  assert.equal(result.status, 2);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("recover after one category checkpoint stays in discover", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const runDir = path.join(tmp, "2026-08-10");
  fs.mkdirSync(runDir, { recursive: true });
  const first = run([
    "checkpoint",
    "--run-dir",
    runDir,
    "--category",
    "imports",
    "--status",
    "complete",
    "--count",
    "0",
  ]);
  assert.equal(first.status, 0, first.stderr);
  const recovered = JSON.parse(run(["recover", "--run-dir", runDir]).stdout);
  assert.equal(recovered.action, "resume-discover");
  assert.ok(recovered.incompleteCategories.includes("types"));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("partial checkpoint keeps recover in discover after all categories are marked", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const runDir = path.join(tmp, "2026-08-10");
  fs.mkdirSync(runDir, { recursive: true });
  fs.copyFileSync(CLEAN, path.join(runDir, "findings.md"));
  const partial = run([
    "checkpoint",
    "--run-dir",
    runDir,
    "--category",
    "dry",
    "--status",
    "partial",
    "--package",
    "core",
    "--count",
    "0",
  ]);
  assert.equal(partial.status, 0, partial.stderr);
  const recovered = JSON.parse(run(["recover", "--run-dir", runDir]).stdout);
  assert.equal(recovered.action, "resume-discover");
  assert.equal(recovered.checkpoint.package, "core");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("parsePackageLayout is used by validate-input", () => {
  const rows = parsePackageLayout(
    fs.readFileSync(path.join(VALID, ".agents/lodestar/context.md"), "utf8"),
  );
  assert.equal(rows[1].alias, "@repo/api");
});

test("validate-input stops when the context file is missing", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# AGENTS.md\n");
  const result = run(["validate-input", "--root", tmp]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /\.agents\/lodestar\/context\.md is missing/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

function conventionsMarkdown(rows) {
  const lines = [
    "## Conventions",
    "",
    "| Convention | Value | What it gates |",
    "| ---------- | ----- | ------------- |",
    ...rows.map(([key, value]) => `| \`${key}\` | \`${value}\` | x |`),
    "",
  ];
  return lines.join("\n");
}

test("parseConventions defaults when the section is absent", () => {
  assert.deepEqual(
    parseConventions("# Fixture\n\n## Package Layout\n"),
    CONVENTION_DEFAULTS,
  );
});

test("parseConventions parses each key", () => {
  const parsed = parseConventions(
    conventionsMarkdown([
      ["result-types", "no"],
      ["branded-types", "no"],
      ["barrel-exports", "yes"],
      ["design-tokens", "no"],
      ["coverage-floor", "none"],
    ]),
  );
  assert.deepEqual(parsed, {
    "result-types": "no",
    "branded-types": "no",
    "barrel-exports": "yes",
    "design-tokens": "no",
    "coverage-floor": "none",
  });
});

test("parseConventions fills missing rows from defaults", () => {
  const parsed = parseConventions(conventionsMarkdown([["result-types", "no"]]));
  assert.equal(parsed["result-types"], "no");
  assert.equal(parsed["branded-types"], "yes");
  assert.equal(parsed["barrel-exports"], "no");
  assert.equal(parsed["coverage-floor"], 80);
});

test("parseConventions parses coverage-floor as a number", () => {
  const parsed = parseConventions(
    conventionsMarkdown([["coverage-floor", "70"]]),
  );
  assert.equal(parsed["coverage-floor"], 70);
});

test("parseConventions ignores unknown keys", () => {
  const parsed = parseConventions(
    conventionsMarkdown([
      ["result-types", "no"],
      ["fallow", "optional"],
    ]),
  );
  assert.equal(parsed["result-types"], "no");
  assert.equal(parsed.fallow, undefined);
});

test("parseConventions rejects a bad boolean", () => {
  assert.throws(
    () => parseConventions(conventionsMarkdown([["result-types", "yeah"]])),
    /invalid value for `result-types`/,
  );
});

test("parseConventions rejects a bad coverage-floor", () => {
  assert.throws(
    () => parseConventions(conventionsMarkdown([["coverage-floor", "80%"]])),
    /invalid value for `coverage-floor`/,
  );
});

test("validate-input rejects a bad conventions value", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const contextDir = path.join(tmp, ".agents", "lodestar");
  fs.mkdirSync(contextDir, { recursive: true });
  const base = fs.readFileSync(
    path.join(VALID, ".agents/lodestar/context.md"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(contextDir, "context.md"),
    `${base}\n${conventionsMarkdown([["result-types", "yeah"]])}\n`,
  );
  const result = run(["validate-input", "--root", tmp]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid value for `result-types`/);
  fs.rmSync(tmp, { recursive: true, force: true });
});
