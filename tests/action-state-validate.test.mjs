import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ACTION = path.join(ROOT, "skills/lodestar-fix/scripts/action-state.mjs");

test("validate-returns command is removed with mutating fan-out", () => {
  const result = spawnSync(
    process.execPath,
    [ACTION, "validate-returns", "--run-dir", ".", "--json", "[]"],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: action-state/);
  assert.doesNotMatch(result.stderr, /validate-returns requires/);
});

test("action-state usage lists only serial state commands", () => {
  const result = spawnSync(process.execPath, [ACTION], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /list\|set-status\|move-done\|archive-run\|commit-message/,
  );
  assert.doesNotMatch(result.stderr, /validate-returns/);
});

test("fix skill and execute refs forbid fan-out and dirty-file edits", () => {
  const skill = fs.readFileSync(
    path.join(ROOT, "skills/lodestar-fix/SKILL.md"),
    "utf8",
  );
  const execute = fs.readFileSync(
    path.join(ROOT, "skills/lodestar-fix/references/execute.md"),
    "utf8",
  );
  const resume = fs.readFileSync(
    path.join(ROOT, "skills/lodestar-fix/references/resume.md"),
    "utf8",
  );
  assert.equal(
    fs.existsSync(path.join(ROOT, "skills/lodestar-fix/references/fan-out.md")),
    false,
  );
  assert.match(skill, /No mutating sub-agent fan-out/);
  assert.match(execute, /already has uncommitted changes/);
  assert.match(execute, /no usable acceptance method/);
  assert.match(resume, /rerun the item's/);
  assert.match(resume, /Acceptance check/);
});
