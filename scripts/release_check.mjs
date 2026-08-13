#!/usr/bin/env node
/** Reject a release that is dirty, mismatched, or missing evidence. */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, isMain, readVersion } from "./lib.mjs";

function run(command, args) {
  return spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
}

export function releaseCheck(options = {}) {
  const errors = [];
  const version = readVersion();
  const tag = options.tag || `v${version}`;
  const status = run("git", ["status", "--porcelain"]);
  if (status.status !== 0) errors.push("git status failed");
  else if (status.stdout.trim() && !options.allowDirty) errors.push("working tree is dirty");

  const existing = run("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`]);
  if (existing.status === 0 && !options.allowExistingTag) {
    errors.push(`tag ${tag} already exists`);
  }

  const pack = run(process.execPath, [path.join(ROOT, "scripts/check_package.mjs")]);
  const output = `${pack.stdout || ""}${pack.stderr || ""}`;
  if (pack.status !== 0) errors.push("package checks failed");
  if (output.includes("WARNING:")) errors.push("package checks emitted warnings");

  if (!options.allowMissingEvals) {
    const evalRoot = path.join(ROOT, "evals/results", version);
    for (const name of ["summary.json", "triggers.json", "review-status.json"]) {
      const filePath = path.join(evalRoot, name);
      if (!fs.existsSync(filePath)) {
        errors.push(`missing eval artifact ${path.relative(ROOT, filePath)}`);
      }
    }
  }
  return { errors, tag, version };
}

function parseArgs(argv) {
  const flags = {
    tag: null,
    allowDirty: false,
    allowMissingEvals: false,
    allowExistingTag: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--tag") flags.tag = argv[++i];
    else if (argv[i] === "--allow-dirty") flags.allowDirty = true;
    else if (argv[i] === "--allow-missing-evals") flags.allowMissingEvals = true;
    else if (argv[i] === "--allow-existing-tag") flags.allowExistingTag = true;
  }
  return flags;
}

function main() {
  const { errors, tag } = releaseCheck(parseArgs(process.argv.slice(2)));
  if (errors.length) {
    for (const error of errors) process.stderr.write(`ERROR: ${error}\n`);
    process.exit(1);
  }
  process.stdout.write(`Release checks passed for ${tag}.\n`);
}

if (isMain(import.meta.url)) main();
