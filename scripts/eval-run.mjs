#!/usr/bin/env node
/**
 * Validate and summarize manually captured skill-run evaluation records.
 * Does not invoke an agent or emit runtime telemetry.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, SKILLS, isMain } from "./lib.mjs";

export const USAGE_FIELDS = [
  "modelCalls",
  "inputTokens",
  "outputTokens",
  "elapsedMs",
  "shellCommands",
  "questions",
  "retries",
  "artifactBytes",
  "resume",
];

export const QUALITY_FIELDS = [
  "seededFound",
  "seededMissed",
  "falsePositives",
  "usefulness",
  "evidence",
];

export const HOST_JOURNEY_STATUSES = new Set([
  "passed",
  "failed",
  "untested",
]);

/** Default host matrix — unavailable hosts stay untested, never passed. */
export const DEFAULT_HOST_JOURNEYS = {
  cursor: "untested",
  "claude-code": "untested",
  codex: "untested",
  "gemini-cli": "untested",
  "github-copilot": "untested",
};
const RESUME_VALUES = new Set([null, "success", "failed", "n/a"]);
const USEFULNESS_VALUES = new Set([
  "high",
  "medium",
  "low",
  "none",
  null,
]);

function isNullOrNumber(value) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Validate one run record. Unknown telemetry must be null, never 0-as-guess.
 */
export function validateRunRecord(record, options = {}) {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { ok: false, errors: ["record must be a JSON object"] };
  }
  if (typeof record.scenario !== "string" || !record.scenario.trim()) {
    errors.push("scenario is required");
  }
  if (typeof record.skill !== "string" || !record.skill.trim()) {
    errors.push("skill is required");
  } else if (
    options.requireKnownSkill !== false &&
    !SKILLS.includes(record.skill) &&
    record.skill !== "workflow"
  ) {
    errors.push(`skill must be one of ${SKILLS.join(", ")} or workflow`);
  }
  if (typeof record.capturedAt !== "string" || !record.capturedAt.trim()) {
    errors.push("capturedAt is required");
  }

  const usage = record.usage;
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
    errors.push("usage object is required");
  } else {
    for (const field of USAGE_FIELDS) {
      if (!(field in usage)) {
        errors.push(`usage.${field} is required (use null when unknown)`);
        continue;
      }
      const value = usage[field];
      if (field === "resume") {
        if (!RESUME_VALUES.has(value)) {
          errors.push(
            `usage.resume must be null | success | failed | n/a (got ${JSON.stringify(value)})`,
          );
        }
        continue;
      }
      if (!isNullOrNumber(value)) {
        errors.push(`usage.${field} must be a number or null`);
      } else if (value === 0 && options.warnZeroAsUnknown) {
        // zeros are allowed when genuinely observed; callers may warn
      }
    }
  }

  const quality = record.quality;
  if (!quality || typeof quality !== "object" || Array.isArray(quality)) {
    errors.push("quality object is required");
  } else {
    for (const field of ["seededFound", "seededMissed", "falsePositives"]) {
      if (!isStringArray(quality[field])) {
        errors.push(`quality.${field} must be an array of strings`);
      }
    }
    if (!USEFULNESS_VALUES.has(quality.usefulness)) {
      errors.push(
        `quality.usefulness must be high|medium|low|none|null (got ${JSON.stringify(quality.usefulness)})`,
      );
    }
    if (!isStringArray(quality.evidence)) {
      errors.push("quality.evidence must be an array of paths");
    } else if (
      quality.usefulness &&
      quality.usefulness !== "none" &&
      quality.evidence.length === 0
    ) {
      errors.push("quality.evidence requires at least one path for a usefulness judgment");
    }
    const judged =
      (quality.seededFound?.length || 0) +
      (quality.seededMissed?.length || 0) +
      (quality.falsePositives?.length || 0);
    if (judged > 0 && (!quality.evidence || quality.evidence.length === 0)) {
      errors.push(
        "quality.evidence requires at least one path when seeded/false-positive judgments are present",
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function loadScenario(filePath) {
  const scenario = loadJson(filePath);
  const errors = [];
  if (typeof scenario.id !== "string" || !scenario.id.trim()) {
    errors.push("id is required");
  }
  if (typeof scenario.title !== "string" || !scenario.title.trim()) {
    errors.push("title is required");
  }
  if (!Array.isArray(scenario.skills) || scenario.skills.length === 0) {
    errors.push("skills must be a non-empty array");
  } else {
    for (const skill of scenario.skills) {
      if (!SKILLS.includes(skill)) {
        errors.push(`unknown skill: ${skill}`);
      }
    }
  }
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
    errors.push("steps must be a non-empty array");
  }
  return { scenario, ok: errors.length === 0, errors };
}

export function summarizeRuns(records) {
  const byScenario = new Map();
  for (const record of records) {
    const key = record.scenario;
    if (!byScenario.has(key)) byScenario.set(key, []);
    byScenario.get(key).push(record);
  }
  const rows = [];
  for (const [scenario, items] of [...byScenario.entries()].sort()) {
    const numeric = (field) =>
      items
        .map((item) => item.usage?.[field])
        .filter((value) => typeof value === "number");
    const avg = (field) => {
      const values = numeric(field);
      if (!values.length) return null;
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    };
    rows.push({
      scenario,
      runs: items.length,
      modelCalls: avg("modelCalls"),
      inputTokens: avg("inputTokens"),
      outputTokens: avg("outputTokens"),
      elapsedMs: avg("elapsedMs"),
      shellCommands: avg("shellCommands"),
      questions: avg("questions"),
      retries: avg("retries"),
      artifactBytes: avg("artifactBytes"),
      resumeSuccess: items.filter((item) => item.usage?.resume === "success")
        .length,
      seededFound: items.reduce(
        (n, item) => n + (item.quality?.seededFound?.length || 0),
        0,
      ),
      seededMissed: items.reduce(
        (n, item) => n + (item.quality?.seededMissed?.length || 0),
        0,
      ),
      falsePositives: items.reduce(
        (n, item) => n + (item.quality?.falsePositives?.length || 0),
        0,
      ),
    });
  }
  return rows;
}

export function compareToBaseline(baseline, records) {
  const summary = summarizeRuns(records);
  const prior = new Map(
    (baseline.runs || []).map((row) => [row.scenario, row]),
  );
  return summary.map((row) => {
    const before = prior.get(row.scenario) || null;
    const delta = (field) => {
      if (row[field] === null || !before || before[field] === null) {
        return null;
      }
      return row[field] - before[field];
    };
    return {
      scenario: row.scenario,
      after: row,
      before,
      delta: {
        modelCalls: delta("modelCalls"),
        inputTokens: delta("inputTokens"),
        outputTokens: delta("outputTokens"),
        elapsedMs: delta("elapsedMs"),
        shellCommands: delta("shellCommands"),
        questions: delta("questions"),
        retries: delta("retries"),
        artifactBytes: delta("artifactBytes"),
        seededFound: delta("seededFound"),
        seededMissed: delta("seededMissed"),
        falsePositives: delta("falsePositives"),
      },
    };
  });
}

/**
 * Validate baseline hostJourneys: only passed|failed|untested;
 * never invent a pass for an unavailable host.
 */
export function validateHostJourneys(hostJourneys) {
  const errors = [];
  if (
    !hostJourneys ||
    typeof hostJourneys !== "object" ||
    Array.isArray(hostJourneys)
  ) {
    return { ok: false, errors: ["hostJourneys must be an object"] };
  }
  for (const [host, status] of Object.entries(hostJourneys)) {
    if (!HOST_JOURNEY_STATUSES.has(status)) {
      errors.push(
        `hostJourneys.${host} must be passed|failed|untested (got ${JSON.stringify(status)})`,
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateBaseline(baseline) {
  const errors = [];
  if (!baseline || typeof baseline !== "object") {
    return { ok: false, errors: ["baseline must be a JSON object"] };
  }
  if (!Array.isArray(baseline.scenarioIds) || baseline.scenarioIds.length === 0) {
    errors.push("scenarioIds must be a non-empty array");
  }
  if (
    !baseline.markdownWords ||
    typeof baseline.markdownWords !== "object"
  ) {
    errors.push("markdownWords is required");
  }
  if (baseline.hostJourneys) {
    const hosts = validateHostJourneys(baseline.hostJourneys);
    errors.push(...hosts.errors);
  }
  return { ok: errors.length === 0, errors };
}

export function listScenarioFiles(dir = path.join(ROOT, "tests/fixtures/evals/scenarios")) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(dir, name))
    .sort();
}

function printUsage() {
  process.stdout.write(`Usage:
  node scripts/eval-run.mjs validate <run.json>
  node scripts/eval-run.mjs summarize <run.json|dir>
  node scripts/eval-run.mjs compare --baseline <baseline.json> <run.json|dir>
  node scripts/eval-run.mjs list-scenarios
  node scripts/eval-run.mjs validate-baseline [baseline.json]
  node scripts/eval-run.mjs list-hosts [baseline.json]
`);
}

function collectRecords(target) {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) throw new Error(`not found: ${target}`);
  if (fs.statSync(abs).isDirectory()) {
    return fs
      .readdirSync(abs)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => loadJson(path.join(abs, name)));
  }
  const value = loadJson(abs);
  return Array.isArray(value) ? value : [value];
}

function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(command ? 0 : 1);
  }

  if (command === "list-scenarios") {
    for (const file of listScenarioFiles()) {
      const { scenario, ok, errors } = loadScenario(file);
      if (!ok) {
        process.stderr.write(`ERROR: ${file}: ${errors.join("; ")}\n`);
        process.exit(1);
      }
      process.stdout.write(
        `${scenario.id}\t${scenario.skills.join(",")}\t${scenario.title}\n`,
      );
    }
    return;
  }

  if (command === "validate-baseline") {
    const file =
      rest[0] || path.join(ROOT, "tests/fixtures/evals/baseline.json");
    const baseline = loadJson(file);
    const result = validateBaseline(baseline);
    if (!result.ok) {
      for (const error of result.errors) {
        process.stderr.write(`ERROR: ${error}\n`);
      }
      process.exit(1);
    }
    process.stdout.write(`OK ${file}\n`);
    return;
  }

  if (command === "list-hosts") {
    const file =
      rest[0] || path.join(ROOT, "tests/fixtures/evals/baseline.json");
    const baseline = loadJson(file);
    const hosts = baseline.hostJourneys || DEFAULT_HOST_JOURNEYS;
    const result = validateHostJourneys(hosts);
    if (!result.ok) {
      for (const error of result.errors) {
        process.stderr.write(`ERROR: ${error}\n`);
      }
      process.exit(1);
    }
    for (const [host, status] of Object.entries(hosts).sort()) {
      process.stdout.write(`${host}\t${status}\n`);
    }
    return;
  }

  if (command === "validate") {
    const file = rest[0];
    if (!file) {
      printUsage();
      process.exit(1);
    }
    const records = collectRecords(file);
    let failed = false;
    for (const [index, record] of records.entries()) {
      const result = validateRunRecord(record);
      const label = records.length > 1 ? `${file}[${index}]` : file;
      if (!result.ok) {
        failed = true;
        for (const error of result.errors) {
          process.stderr.write(`ERROR: ${label}: ${error}\n`);
        }
      } else {
        process.stdout.write(`OK ${label} scenario=${record.scenario}\n`);
      }
    }
    process.exit(failed ? 1 : 0);
  }

  if (command === "summarize") {
    const file = rest[0];
    if (!file) {
      printUsage();
      process.exit(1);
    }
    const records = collectRecords(file);
    for (const [index, record] of records.entries()) {
      const result = validateRunRecord(record);
      if (!result.ok) {
        for (const error of result.errors) {
          process.stderr.write(`ERROR: [${index}]: ${error}\n`);
        }
        process.exit(1);
      }
    }
    process.stdout.write(`${JSON.stringify(summarizeRuns(records), null, 2)}\n`);
    return;
  }

  if (command === "compare") {
    let baselinePath = path.join(ROOT, "tests/fixtures/evals/baseline.json");
    const args = [...rest];
    const baselineFlag = args.indexOf("--baseline");
    if (baselineFlag >= 0) {
      baselinePath = args[baselineFlag + 1];
      args.splice(baselineFlag, 2);
    }
    const target = args[0];
    if (!target) {
      printUsage();
      process.exit(1);
    }
    const baseline = loadJson(baselinePath);
    const records = collectRecords(target);
    for (const record of records) {
      const result = validateRunRecord(record);
      if (!result.ok) {
        for (const error of result.errors) {
          process.stderr.write(`ERROR: ${error}\n`);
        }
        process.exit(1);
      }
    }
    process.stdout.write(
      `${JSON.stringify(compareToBaseline(baseline, records), null, 2)}\n`,
    );
    return;
  }

  process.stderr.write(`ERROR: unknown command: ${command}\n`);
  printUsage();
  process.exit(1);
}

if (isMain(import.meta.url)) main();
