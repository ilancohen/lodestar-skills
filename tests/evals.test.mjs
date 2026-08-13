import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ROOT, SKILLS } from "../scripts/lib.mjs";
import { checkPackage } from "../scripts/check_package.mjs";
import { planRuns, writePlannedResults } from "../evals/runner.mjs";
import {
  validateEvals,
  validateEvalPackage,
  validateTriggers,
} from "../evals/validate.mjs";

test("eval package validation passes", () => {
  assert.deepEqual(validateEvalPackage({ root: ROOT }), []);
});

test("package checks require trigger sets", () => {
  const result = checkPackage(ROOT);
  assert.deepEqual(result.errors, []);
});

test("validateTriggers rejects too few positives", () => {
  const errors = [];
  validateTriggers(
    "ep-setup",
    {
      skill_name: "ep-setup",
      prompts: [
        {
          id: "pos",
          label: "one",
          should_trigger: true,
          prompt: "run ep-setup",
        },
        {
          id: "neg",
          label: "two",
          should_trigger: false,
          prompt: "advice only",
        },
      ],
    },
    errors,
  );
  assert.ok(errors.some((error) => error.includes("positives")));
});

test("validateTriggers rejects duplicate ids", () => {
  const prompts = [];
  for (let i = 0; i < 8; i += 1) {
    prompts.push({
      id: "dup",
      label: "x",
      should_trigger: true,
      prompt: `p${i}`,
    });
  }
  for (let i = 0; i < 8; i += 1) {
    prompts.push({
      id: `neg-${i}`,
      label: "n",
      should_trigger: false,
      prompt: `n${i}`,
    });
  }
  const errors = [];
  validateTriggers("ep-setup", { skill_name: "ep-setup", prompts }, errors);
  assert.ok(errors.some((error) => error.includes("duplicate")));
});

test("validateEvals requires assertions, baseline, and fixture", () => {
  const errors = [];
  validateEvals(
    "ep-setup",
    {
      skill_name: "ep-setup",
      evals: [
        { id: 1, prompt: "x" },
        { id: 2, prompt: "y" },
        { id: 3, prompt: "z" },
      ],
    },
    errors,
    "skills/ep-setup/evals/evals.json",
    ROOT,
  );
  assert.ok(errors.some((error) => error.includes("assertions")));
  assert.ok(errors.some((error) => error.includes("baseline")));
  assert.ok(errors.some((error) => error.includes("fixture")));
});

test("validateEvalPackage --require-results fails without artifacts", () => {
  const errors = validateEvalPackage({ root: ROOT, requireResults: true });
  assert.ok(errors.some((error) => error.includes("missing eval artifact")));
});

test("planRuns records three trigger runs per query plus skill and baseline e2e", () => {
  const runs = planRuns(ROOT);
  for (const skill of SKILLS) {
    const triggers = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "skills", skill, "evals/triggers.json"),
        "utf8",
      ),
    );
    const evals = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, "skills", skill, "evals/evals.json"),
        "utf8",
      ),
    );
    const triggerRuns = runs.filter(
      (run) => run.skill === skill && run.kind === "trigger",
    );
    assert.equal(triggerRuns.length, triggers.prompts.length * 3);
    assert.equal(
      runs.filter((run) => run.skill === skill && run.kind === "e2e-skill")
        .length,
      evals.evals.length,
    );
    assert.equal(
      runs.filter((run) => run.skill === skill && run.kind === "e2e-baseline")
        .length,
      evals.evals.length,
    );
  }
  const sample = runs[0];
  for (const field of [
    "prompt",
    "model",
    "skill_version",
    "platform",
    "run",
    "result",
    "trace",
    "tools",
    "duration_ms",
    "tokens",
  ]) {
    assert.ok(field in sample, field);
  }
  assert.equal(sample.result, "skipped");
});

test("writePlannedResults emits raw, summary, triggers, and review-status", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ep-eval-"));
  try {
    const { outDir, runs } = writePlannedResults({ root: ROOT, outDir: tmp });
    assert.ok(runs.length > 0);
    for (const name of [
      "raw.json",
      "summary.json",
      "triggers.json",
      "review-status.json",
    ]) {
      assert.ok(fs.existsSync(path.join(outDir, name)), name);
    }
    const summary = JSON.parse(
      fs.readFileSync(path.join(outDir, "summary.json"), "utf8"),
    );
    assert.equal(summary.version, "0.1.0");
    assert.ok(summary.comparisons.correctness);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("validateEvalPackage --require-results accepts a planned runner output", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ep-eval-root-"));
  try {
    const copy = (from, to) => {
      fs.mkdirSync(to, { recursive: true });
      for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        if (entry.name === ".git" || entry.name === "node_modules") continue;
        const src = path.join(from, entry.name);
        const dest = path.join(to, entry.name);
        if (entry.isDirectory()) copy(src, dest);
        else fs.copyFileSync(src, dest);
      }
    };
    copy(ROOT, tmp);
    fs.cpSync(path.join(ROOT, "evals"), path.join(tmp, "evals"), {
      recursive: true,
    });
    writePlannedResults({ root: tmp });
    assert.deepEqual(
      validateEvalPackage({ root: tmp, requireResults: true }),
      [],
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("ep-fix e2e fixtures include INDEX, action items, and source", () => {
  const evals = JSON.parse(
    fs.readFileSync(path.join(ROOT, "skills/ep-fix/evals/evals.json"), "utf8"),
  );
  for (const item of evals.evals) {
    const fixture = path.join(ROOT, item.fixture);
    assert.ok(
      fs.existsSync(path.join(fixture, "AGENTS.md")),
      `${item.id} AGENTS.md`,
    );
    assert.ok(
      fs.existsSync(path.join(fixture, "package.json")),
      `${item.id} package.json`,
    );
    assert.match(
      fs.readFileSync(path.join(fixture, "packages/core/src/index.ts"), "utf8"),
      /userService/,
    );
    const auditDirs = fs
      .readdirSync(path.join(fixture, "docs/audit"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(fixture, "docs/audit", entry.name));
    assert.ok(auditDirs.length, `${item.id} audit run`);
    if (item.id === 4) {
      for (const runDir of auditDirs) {
        assert.equal(fs.existsSync(path.join(runDir, "INDEX.md")), false);
      }
      continue;
    }
    const runDir = auditDirs[0];
    assert.ok(fs.existsSync(path.join(runDir, "INDEX.md")), `${item.id} INDEX`);
    const items = fs
      .readdirSync(runDir)
      .filter((name) => /^\d{3}-.+\.md$/.test(name));
    assert.ok(items.length >= 1, `${item.id} action items`);
    const first = fs.readFileSync(path.join(runDir, items[0]), "utf8");
    assert.match(first, /^files:\n  - /m);
    const fileLine = first.match(/^  - (.+)$/m)[1];
    assert.ok(fs.existsSync(path.join(fixture, fileLine)), fileLine);
  }
});
