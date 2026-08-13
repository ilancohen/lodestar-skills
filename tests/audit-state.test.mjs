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
  dedupeFindings,
  findPlaceholders,
  nextRunId,
  parseFindings,
  parsePackageLayout,
  sortFindings,
} from "../skills/ep-audit/scripts/audit-state.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "skills/ep-audit/scripts/audit-state.mjs");
const VALID = path.join(ROOT, "tests/fixtures/repos/valid");
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ep-audit-"));
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ep-audit-"));
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ep-audit-"));
  const bad = path.join(tmp, "bad.json");
  fs.writeFileSync(bad, "{not json");
  const result = run(["merge-findings", "--in", bad]);
  assert.equal(result.status, 2);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("recover after one category checkpoint stays in discover", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ep-audit-"));
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ep-audit-"));
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
    fs.readFileSync(path.join(VALID, "AGENTS.md"), "utf8"),
  );
  assert.equal(rows[1].alias, "@repo/api");
});
