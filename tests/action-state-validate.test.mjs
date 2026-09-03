import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { tempDir } from "../skills/lodestar-setup/scripts/runtime.mjs";
import { validateReturns } from "../skills/lodestar-fix/scripts/action-state.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ACTION = path.join(ROOT, "skills/lodestar-fix/scripts/action-state.mjs");
const FIX_READY = path.join(ROOT, "tests/fixtures/audit-runs/fix-ready");

function run(args) {
  return spawnSync(process.execPath, [ACTION, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function validEntry(overrides = {}) {
  return {
    item_id: "001",
    status: "done",
    files_modified: ["packages/api/src/routes/users.ts"],
    commit_sha: "abc1234",
    notes: "ok",
    ...overrides,
  };
}

test("validateReturns accepts a well-formed sub-agent return", () => {
  const result = validateReturns(FIX_READY, [validEntry()]);
  assert.deepEqual(result, { ok: true, count: 1 });
});

test("validateReturns accepts commit_sha null", () => {
  const result = validateReturns(FIX_READY, [
    validEntry({ commit_sha: null, status: "deferred" }),
  ]);
  assert.equal(result.ok, true);
});

test("validateReturns rejects an unknown status with the field named", () => {
  assert.throws(
    () => validateReturns(FIX_READY, [validEntry({ status: "finished" })]),
    /entry\[0\]\.status 'finished'/,
  );
});

test("validateReturns rejects an unrecognized item_id", () => {
  assert.throws(
    () => validateReturns(FIX_READY, [validEntry({ item_id: "999" })]),
    /entry\[0\]\.item_id '999' is not an open item/,
  );
});

test("validateReturns rejects a non-array payload", () => {
  assert.throws(
    () => validateReturns(FIX_READY, { item_id: "001" }),
    /expected a JSON array/,
  );
});

test("validateReturns rejects a non-object entry", () => {
  assert.throws(
    () => validateReturns(FIX_READY, ["prose"]),
    /entry\[0\] must be an object/,
  );
});

test("validateReturns rejects a non-array files_modified", () => {
  assert.throws(
    () =>
      validateReturns(FIX_READY, [
        validEntry({ files_modified: "packages/api/src/routes/users.ts" }),
      ]),
    /entry\[0\]\.files_modified must be an array/,
  );
});

test("validateReturns rejects a bad commit_sha", () => {
  assert.throws(
    () => validateReturns(FIX_READY, [validEntry({ commit_sha: "not a sha" })]),
    /entry\[0\]\.commit_sha must be a hex git sha or null/,
  );
});

test("validate-returns CLI rejects a bad batch and prints the field", () => {
  const tmp = tempDir("lodestar-validate-");
  try {
    const runDir = path.join(tmp, "2026-08-10");
    fs.cpSync(FIX_READY, runDir, { recursive: true });
    const result = run([
      "validate-returns",
      "--run-dir",
      runDir,
      "--json",
      JSON.stringify([validEntry({ status: "complete", item_id: "001" })]),
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /entry\[0\]\.status 'complete'/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("validate-returns CLI accepts a good batch via --json-file", () => {
  const tmp = tempDir("lodestar-validate-");
  try {
    const runDir = path.join(tmp, "2026-08-10");
    fs.cpSync(FIX_READY, runDir, { recursive: true });
    const jsonFile = path.join(tmp, "return.json");
    fs.writeFileSync(
      jsonFile,
      JSON.stringify([
        validEntry({ notes: "don't touch other files" }),
        validEntry({ item_id: "002" }),
      ]),
    );
    const result = run([
      "validate-returns",
      "--run-dir",
      runDir,
      "--json-file",
      jsonFile,
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { ok: true, count: 2 });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
