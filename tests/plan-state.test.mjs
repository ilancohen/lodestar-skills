import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertExclusiveLocation,
  effectiveRigor,
  escalateStage,
  inferRigor,
  listCandidates,
  listStages,
  moveDone,
  parseReviewRubric,
  pickUp,
  writeRigor,
} from "../skills/lodestar-implement/scripts/plan-state.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(
  ROOT,
  "skills/lodestar-implement/scripts/plan-state.mjs",
);
const LIGHT = path.join(ROOT, "tests/fixtures/plans/light-repo");
const ORPHAN = path.join(ROOT, "tests/fixtures/plans/orphan-repo");
const UNDECLARED = path.join(ROOT, "tests/fixtures/plans/undeclared-repo");
const FOLDER = path.join(ROOT, "tests/fixtures/plans/folder-repo");
const RUBRIC = path.join(
  ROOT,
  "tests/fixtures/repos/review-rubric/.agents/lodestar/context.md",
);

function tmpCopy(fixture) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-plan-state-"));
  fs.cpSync(fixture, tmp, { recursive: true });
  return tmp;
}

test("pick-up reads a light single-file plan", () => {
  const result = pickUp(LIGHT, "tiny.md");
  assert.equal(result.kind, "file");
  assert.equal(result.slug, "tiny");
  assert.equal(result.rigor, "light");
  assert.equal(result.rigorSource, "declared");
  assert.equal(result.stages.length, 1);
  assert.equal(result.stages[0].kind, "file-pass");
  assert.equal(result.stages[0].status, "pending");
});

test("pick-up stops when the slug exists in root and done/", () => {
  assert.throws(
    () => pickUp(ORPHAN, "dup.md"),
    /prior incomplete move/,
  );
  assert.throws(
    () => assertExclusiveLocation(ORPHAN, "docs/plans", "dup"),
    /prior incomplete move/,
  );
});

test("inferRigor writes back an undeclared two-pass plan as standard", () => {
  const abs = path.join(UNDECLARED, "docs/plans/wide.md");
  const inferred = inferRigor(abs);
  assert.equal(inferred.rigor, "standard");
  assert.equal(inferred.reason, "few-stages");
  const tmp = tmpCopy(UNDECLARED);
  try {
    const plan = path.join(tmp, "docs/plans/wide.md");
    writeRigor(plan, inferred.rigor, inferred.reason);
    assert.equal(effectiveRigor(plan), "standard");
    assert.match(fs.readFileSync(plan, "utf8"), /rigor: standard/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("listStages enumerates folder sub-plans", () => {
  const stages = listStages(path.join(FOLDER, "docs/plans/work"));
  assert.deepEqual(
    stages.map((stage) => stage.id),
    ["00-first", "01-second"],
  );
  assert.equal(effectiveRigor(path.join(FOLDER, "docs/plans/work")), "standard");
});

test("a folder plan declared light is coerced to standard", () => {
  const tmp = tmpCopy(FOLDER);
  try {
    const readme = path.join(tmp, "docs/plans/work/README.md");
    writeRigor(path.join(tmp, "docs/plans/work"), "light", "test");
    assert.equal(effectiveRigor(path.join(tmp, "docs/plans/work")), "standard");
    const result = pickUp(tmp, "work");
    assert.equal(result.rigor, "standard");
    assert.equal(result.rigorSource, "folder-not-light");
    assert.match(fs.readFileSync(readme, "utf8"), /rigor: light/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("can-autosquash command is removed", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "can-autosquash", "--root", ROOT], {
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown command: can-autosquash/);
});

test("escalateStage records a stage-local trigger", () => {
  const tmp = tmpCopy(FOLDER);
  try {
    const file = path.join(tmp, "docs/plans/work/00-first.md");
    escalateStage(file, "full", "diff-exceeded-light");
    const text = fs.readFileSync(file, "utf8");
    assert.match(text, /rigor: full/);
    assert.match(text, /escalated_from_trigger: diff-exceeded-light/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("move-done leaves the plan at exactly one path", () => {
  const tmp = tmpCopy(LIGHT);
  try {
    const src = path.join(tmp, "docs/plans/tiny.md");
    const moved = moveDone(tmp, "docs/plans", src);
    assert.equal(moved.from, "docs/plans/tiny.md");
    assert.equal(moved.to, "docs/plans/done/tiny.md");
    assert.equal(fs.existsSync(src), false);
    assert.equal(fs.existsSync(path.join(tmp, moved.to)), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("move-done refuses when both copies already exist", () => {
  assert.throws(
    () =>
      moveDone(
        ORPHAN,
        "docs/plans",
        path.join(ORPHAN, "docs/plans/dup.md"),
      ),
    /move-done refused/,
  );
});

test("listCandidates ignores README and reserved dirs", () => {
  const listed = listCandidates(LIGHT);
  assert.equal(listed.plansRoot, "docs/plans");
  assert.deepEqual(
    listed.pending.map((entry) => entry.slug),
    ["tiny"],
  );
});

test("complete-ledger command is removed", () => {
  const result = spawnSync(
    process.execPath,
    [
      SCRIPT,
      "complete-ledger",
      "--root",
      LIGHT,
      "--plan",
      "tiny",
      "--evidence",
      "gone",
    ],
    { encoding: "utf8" },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown command: complete-ledger/);
});

test("inferRigor reads risk wording in a folder stage file", () => {
  const tmp = tmpCopy(FOLDER);
  try {
    const stage = path.join(tmp, "docs/plans/work/00-first.md");
    fs.appendFileSync(stage, "\nThis stage is a data migration.\n");
    const inferred = inferRigor(path.join(tmp, "docs/plans/work"));
    assert.equal(inferred.rigor, "full");
    assert.equal(inferred.reason, "risk-signal");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("parseReviewRubric reads bullets and falls back to principles", () => {
  const withSection = fs.readFileSync(RUBRIC, "utf8");
  const paths = parseReviewRubric(withSection);
  assert.ok(paths.some((p) => /lodestar-setup\/principles\.md$/.test(p)));
  assert.ok(paths.includes("CONTRIBUTING.md"));
  const fallback = parseReviewRubric("# Fixture\n");
  assert.equal(fallback.length, 1);
  assert.match(fallback[0], /lodestar-setup\/principles\.md$/);
});

test("CLI pick-up and move-done round-trip", () => {
  const tmp = tmpCopy(LIGHT);
  try {
    const listed = spawnSync(
      process.execPath,
      [SCRIPT, "pick-up", "--root", tmp, "--plan", "tiny.md"],
      { encoding: "utf8" },
    );
    assert.equal(listed.status, 0, listed.stderr);
    const payload = JSON.parse(listed.stdout);
    assert.equal(payload.rigor, "light");
    const moved = spawnSync(
      process.execPath,
      [SCRIPT, "move-done", "--root", tmp, "--plan", "tiny.md"],
      { encoding: "utf8" },
    );
    assert.equal(moved.status, 0, moved.stderr);
    const result = JSON.parse(moved.stdout);
    assert.equal(fs.existsSync(path.join(tmp, result.from)), false);
    assert.equal(fs.existsSync(path.join(tmp, result.to)), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
