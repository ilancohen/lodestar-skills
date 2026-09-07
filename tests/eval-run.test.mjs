import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ROOT, SKILLS } from "../scripts/lib.mjs";
import {
  compareToBaseline,
  listScenarioFiles,
  loadScenario,
  summarizeRuns,
  validateRunRecord,
} from "../scripts/eval-run.mjs";
import { measureSkillRunCost } from "../scripts/check_package.mjs";

const BASELINE = path.join(ROOT, "tests/fixtures/evals/baseline.json");
const EXAMPLE = path.join(ROOT, "tests/fixtures/evals/example-run.json");

function validRecord(overrides = {}) {
  return {
    scenario: "setup-architecture-no-fallow",
    skill: "lodestar-setup",
    capturedAt: "2026-09-07T12:00:00Z",
    usage: {
      modelCalls: null,
      inputTokens: null,
      outputTokens: null,
      elapsedMs: 12000,
      shellCommands: 4,
      questions: 2,
      retries: null,
      artifactBytes: 2048,
      resume: "n/a",
    },
    quality: {
      seededFound: [],
      seededMissed: [],
      falsePositives: [],
      usefulness: "medium",
      evidence: ["notes/setup-run.md"],
    },
    ...overrides,
  };
}

test("scenarios cover every public skill and both mutation workflows", () => {
  const files = listScenarioFiles();
  assert.equal(files.length, 5, files.join("\n"));
  const skills = new Set();
  const mutations = new Set();
  for (const file of files) {
    const { scenario, ok, errors } = loadScenario(file);
    assert.equal(ok, true, errors.join("; "));
    for (const skill of scenario.skills) skills.add(skill);
    if (scenario.asserts?.mutationWorkflow) {
      mutations.add(scenario.asserts.mutationWorkflow);
    }
  }
  assert.deepEqual([...skills].sort(), [...SKILLS].sort());
  assert.deepEqual([...mutations].sort(), [
    "lodestar-fix",
    "lodestar-implement",
  ]);
});

test("baseline lists every scenario and markdownWords for each skill", () => {
  const baseline = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  assert.deepEqual(
    [...baseline.scenarioIds].sort(),
    listScenarioFiles()
      .map((file) => loadScenario(file).scenario.id)
      .sort(),
  );
  for (const skill of SKILLS) {
    assert.equal(typeof baseline.markdownWords[skill].words, "number");
    const cost = measureSkillRunCost(ROOT, skill);
    assert.ok(
      cost.markdownWords <= baseline.markdownWords[skill].words,
      `${skill}: ${cost.markdownWords} > baseline ${baseline.markdownWords[skill].words}`,
    );
  }
});

test("validateRunRecord accepts null telemetry and rejects missing usage fields", () => {
  assert.equal(validateRunRecord(validRecord()).ok, true);
  const example = JSON.parse(fs.readFileSync(EXAMPLE, "utf8"));
  assert.equal(validateRunRecord(example).ok, true);

  const zeroOk = validRecord({
    usage: {
      ...validRecord().usage,
      modelCalls: 0,
      questions: 0,
    },
  });
  assert.equal(validateRunRecord(zeroOk).ok, true);

  const missing = validRecord();
  delete missing.usage.inputTokens;
  const result = validateRunRecord(missing);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /usage\.inputTokens/.test(error)));
});

test("validateRunRecord requires evidence for quality judgments", () => {
  const result = validateRunRecord(
    validRecord({
      quality: {
        seededFound: ["imports-cross-package"],
        seededMissed: [],
        falsePositives: [],
        usefulness: "high",
        evidence: [],
      },
    }),
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /evidence/.test(error)));
});

test("summarize and compare keep nulls instead of inventing zeros", () => {
  const records = [
    validRecord({
      usage: {
        ...validRecord().usage,
        modelCalls: null,
        inputTokens: null,
        elapsedMs: 10000,
      },
    }),
    validRecord({
      scenario: "setup-architecture-no-fallow",
      usage: {
        ...validRecord().usage,
        modelCalls: null,
        inputTokens: 100,
        elapsedMs: 20000,
      },
    }),
  ];
  const summary = summarizeRuns(records);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].modelCalls, null);
  assert.equal(summary[0].inputTokens, 100);
  assert.equal(summary[0].elapsedMs, 15000);

  const baseline = {
    runs: [
      {
        scenario: "setup-architecture-no-fallow",
        modelCalls: null,
        inputTokens: 80,
        outputTokens: null,
        elapsedMs: 18000,
        shellCommands: 4,
        questions: 2,
        retries: null,
        artifactBytes: 2048,
      },
    ],
  };
  const compared = compareToBaseline(baseline, records);
  assert.equal(compared[0].delta.modelCalls, null);
  assert.equal(compared[0].delta.inputTokens, 20);
  assert.equal(compared[0].delta.elapsedMs, -3000);
});

test("raw result files stay out of the committed tree", () => {
  const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  assert.match(gitignore, /tests\/fixtures\/evals\/results\//);
  const resultsDir = path.join(ROOT, "tests/fixtures/evals/results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const committedNoise = fs
    .readdirSync(resultsDir)
    .filter((name) => name.endsWith(".json"));
  assert.deepEqual(committedNoise, []);
});

test("CLI validate accepts the example run record", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/eval-run.mjs", "validate", EXAMPLE],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OK/);
});
