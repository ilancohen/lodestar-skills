#!/usr/bin/env node
/** Validate trigger sets and eval assertions. Live run artifacts are optional. */

import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  SKILLS,
  isMain,
  readJson,
  readVersion,
} from "../scripts/lib.mjs";

const TRIGGER_MIN = 8;
const TRIGGER_MAX = 10;
const REQUIRED_ASSERTION_TYPES = new Set([
  "consent_asked",
  "allowed_write",
  "forbidden_write",
  "stop_message",
  "status",
  "no_source_edit",
  "no_git_add_all",
  "forbidden_skill",
  "advisory",
  "writes_only_declared_files",
  "note",
]);
const REQUIRED_RESULT_FILES = [
  "summary.json",
  "triggers.json",
  "review-status.json",
  "raw.json",
];

export function validateTriggers(skill, payload, errors, relative) {
  const file = relative || `skills/${skill}/evals/triggers.json`;
  if (payload.skill_name !== skill) {
    errors.push(`${file}: skill_name must be ${skill}`);
  }
  const prompts = payload.prompts;
  if (!Array.isArray(prompts)) {
    errors.push(`${file}: prompts must be a list`);
    return;
  }
  const ids = new Set();
  let positives = 0;
  let negatives = 0;
  for (const item of prompts) {
    if (!item?.id || ids.has(item.id)) {
      errors.push(`${file}: missing or duplicate id ${item?.id}`);
    }
    ids.add(item.id);
    if (!item.prompt || !item.label) {
      errors.push(`${file}: ${item.id} needs prompt and label`);
    }
    if (item.should_trigger === true) positives += 1;
    else if (item.should_trigger === false) negatives += 1;
    else errors.push(`${file}: ${item.id} needs should_trigger bool`);
  }
  if (positives < TRIGGER_MIN || positives > TRIGGER_MAX) {
    errors.push(
      `${file}: expected ${TRIGGER_MIN}-${TRIGGER_MAX} positives, found ${positives}`,
    );
  }
  if (negatives < TRIGGER_MIN || negatives > TRIGGER_MAX) {
    errors.push(
      `${file}: expected ${TRIGGER_MIN}-${TRIGGER_MAX} negatives, found ${negatives}`,
    );
  }
}

export function validateEvals(skill, payload, errors, relative, root = ROOT) {
  const file = relative || `skills/${skill}/evals/evals.json`;
  if (payload.skill_name !== skill) {
    errors.push(`${file}: skill_name must be ${skill}`);
  }
  if (!Array.isArray(payload.evals) || payload.evals.length < 3) {
    errors.push(`${file}: expected at least 3 evals`);
    return;
  }
  for (const item of payload.evals) {
    if (!Array.isArray(item.assertions) || item.assertions.length === 0) {
      errors.push(`${file}: eval ${item.id} needs assertions`);
    } else {
      for (const assertion of item.assertions) {
        if (!REQUIRED_ASSERTION_TYPES.has(assertion?.type)) {
          errors.push(
            `${file}: eval ${item.id} has unknown assertion type ${assertion?.type}`,
          );
        }
      }
    }
    if (item.baseline !== true) {
      errors.push(`${file}: eval ${item.id} needs a no-skill baseline flag`);
    }
    if (!item.fixture) {
      errors.push(`${file}: eval ${item.id} needs a fixture`);
    } else {
      const fixturePath = path.join(root, item.fixture);
      if (!fs.existsSync(fixturePath)) {
        errors.push(
          `${file}: eval ${item.id} fixture missing: ${item.fixture}`,
        );
      }
    }
  }
}

export function validateEvalPackage({
  root = ROOT,
  requireResults = false,
} = {}) {
  const errors = [];
  for (const skill of SKILLS) {
    const triggerPath = path.join(root, "skills", skill, "evals/triggers.json");
    const evalPath = path.join(root, "skills", skill, "evals/evals.json");
    const triggerRel = path.relative(root, triggerPath);
    const evalRel = path.relative(root, evalPath);
    if (!fs.existsSync(triggerPath)) {
      errors.push(`${triggerRel}: missing`);
    } else {
      try {
        validateTriggers(skill, readJson(triggerPath), errors, triggerRel);
      } catch (error) {
        errors.push(error.message);
      }
    }
    if (!fs.existsSync(evalPath)) {
      errors.push(`${evalRel}: missing`);
    } else {
      try {
        validateEvals(skill, readJson(evalPath), errors, evalRel, root);
      } catch (error) {
        errors.push(error.message);
      }
    }
  }
  if (requireResults) {
    const version = readVersion(root);
    const evalRoot = path.join(root, "evals/results", version);
    for (const name of REQUIRED_RESULT_FILES) {
      if (!fs.existsSync(path.join(evalRoot, name))) {
        errors.push(`missing eval artifact evals/results/${version}/${name}`);
      }
    }
    const rawPath = path.join(evalRoot, "raw.json");
    if (fs.existsSync(rawPath)) {
      let runs;
      try {
        runs = JSON.parse(fs.readFileSync(rawPath, "utf8"));
      } catch (error) {
        errors.push(
          `evals/results/${version}/raw.json: invalid JSON: ${error.message}`,
        );
        runs = null;
      }
      if (runs !== null && !Array.isArray(runs)) {
        errors.push(`evals/results/${version}/raw.json: expected a JSON array`);
      } else if (Array.isArray(runs)) {
        for (const skill of SKILLS) {
          const triggerPath = path.join(
            root,
            "skills",
            skill,
            "evals/triggers.json",
          );
          if (!fs.existsSync(triggerPath)) continue;
          const triggers = readJson(triggerPath);
          for (const prompt of triggers.prompts || []) {
            const count = runs.filter(
              (run) =>
                run.kind === "trigger" &&
                run.skill === skill &&
                run.prompt_id === prompt.id,
            ).length;
            if (count !== 3) {
              errors.push(
                `evals/results/${version}/raw.json: ${skill} ${prompt.id} needs 3 trigger runs, found ${count}`,
              );
            }
          }
        }
      }
    }
  }
  return errors;
}

function main() {
  const requireResults = process.argv.includes("--require-results");
  const errors = validateEvalPackage({ requireResults });
  if (errors.length) {
    for (const error of errors) process.stderr.write(`ERROR: ${error}\n`);
    process.exit(1);
  }
  process.stdout.write("Eval case validation passed.\n");
}

if (isMain(import.meta.url)) main();
