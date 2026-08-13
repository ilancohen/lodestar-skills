#!/usr/bin/env node
/**
 * Eval runner. Records prompt, model, skill version, platform, run number,
 * result, tools, duration, and tokens. Live model runs require EVAL_MODEL.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ROOT,
  SKILLS,
  isMain,
  readJson,
  readVersion,
} from "../scripts/lib.mjs";

function emptyRun(kind, skill, prompt, runNumber, version) {
  return {
    kind,
    skill,
    prompt_id: prompt.id || prompt.prompt_id,
    eval_id: prompt.eval_id ?? null,
    prompt: prompt.prompt,
    model: process.env.EVAL_MODEL || null,
    skill_version: version,
    platform: `${os.platform()}-${os.release()}`,
    seed: process.env.EVAL_SEED || null,
    run: runNumber,
    result: "skipped",
    reason: process.env.EVAL_MODEL
      ? "runner has no live client in this environment"
      : "EVAL_MODEL is unset; live runs are skipped",
    trace: [],
    tools: [],
    duration_ms: 0,
    tokens: 0,
    correctness: null,
  };
}

export function planRuns(root = ROOT) {
  const version = readVersion(root);
  const runs = [];
  for (const skill of SKILLS) {
    const triggers = readJson(
      path.join(root, "skills", skill, "evals/triggers.json"),
    );
    for (const prompt of triggers.prompts) {
      for (let run = 1; run <= 3; run += 1) {
        runs.push(emptyRun("trigger", skill, prompt, run, version));
      }
    }
    const evals = readJson(
      path.join(root, "skills", skill, "evals/evals.json"),
    );
    for (const item of evals.evals) {
      const prompt = {
        prompt: item.prompt,
        prompt_id: `e2e-${item.id}`,
        eval_id: item.id,
      };
      runs.push(emptyRun("e2e-skill", skill, prompt, 1, version));
      if (item.baseline) {
        runs.push(emptyRun("e2e-baseline", skill, prompt, 1, version));
      }
    }
  }
  return runs;
}

export function writePlannedResults({ root = ROOT, outDir } = {}) {
  const version = readVersion(root);
  const target = outDir || path.join(root, "evals/results", version);
  fs.mkdirSync(target, { recursive: true });
  const runs = planRuns(root);
  fs.writeFileSync(
    path.join(target, "raw.json"),
    `${JSON.stringify(runs, null, 2)}\n`,
  );
  const triggerRuns = runs.filter((run) => run.kind === "trigger");
  const summary = {
    version,
    generated_at: new Date().toISOString(),
    runs: runs.length,
    skipped: runs.filter((run) => run.result === "skipped").length,
    completed: runs.filter((run) => run.result === "completed").length,
    comparisons: {
      correctness: "deferred-until-EVAL_MODEL",
      tools: "deferred-until-EVAL_MODEL",
      duration: "deferred-until-EVAL_MODEL",
      tokens: "deferred-until-EVAL_MODEL",
    },
  };
  fs.writeFileSync(
    path.join(target, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(target, "triggers.json"),
    `${JSON.stringify(
      {
        status: process.env.EVAL_MODEL ? "planned" : "skipped-no-model",
        runs: triggerRuns.length,
        queries: triggerRuns.length / 3,
        threshold: {
          positive_overall: 0.9,
          positive_per_query: "2/3",
          negative_overall: 0.1,
          negative_per_query: "1/3",
        },
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    path.join(target, "review-status.json"),
    `${JSON.stringify(
      {
        status: "pending",
        template: "evals/reviews/TEMPLATE.md",
        traces_reviewed: false,
      },
      null,
      2,
    )}\n`,
  );
  return { outDir: target, runs, version };
}

function main() {
  const { outDir, runs } = writePlannedResults();
  process.stdout.write(
    `Wrote ${runs.length} planned eval runs to ${path.relative(ROOT, outDir)}. Live execution skipped without EVAL_MODEL.\n`,
  );
}

if (isMain(import.meta.url)) main();
