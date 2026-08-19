#!/usr/bin/env node
/** Reject a release that is dirty, mismatched, or missing evidence. */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { ROOT, isMain, readVersion } from "./lib.mjs";

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8" });
}

export function releaseCheck(options = {}) {
  // `root` is injectable so tests can exercise the git-status/tag branches
  // against an isolated fixture repo instead of this checkout. The package
  // check always validates the real ROOT (check_package.mjs resolves its
  // own root from its file location, not cwd).
  const root = options.root || ROOT;
  const errors = [];
  const version = readVersion(root);
  const tag = options.tag || `v${version}`;
  const status = run("git", ["status", "--porcelain"], root);
  if (status.status !== 0) errors.push("git status failed");
  else if (status.stdout.trim() && !options.allowDirty)
    errors.push("working tree is dirty");

  const existing = run(
    "git",
    ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`],
    root,
  );
  if (existing.status === 0 && !options.allowExistingTag) {
    errors.push(`tag ${tag} already exists`);
  }

  const pack = run(
    process.execPath,
    [path.join(ROOT, "scripts/check_package.mjs")],
    root,
  );
  const output = `${pack.stdout || ""}${pack.stderr || ""}`;
  if (pack.status !== 0) errors.push("package checks failed");
  if (output.includes("WARNING:"))
    errors.push("package checks emitted warnings");

  return { errors, tag, version };
}

function parseArgs(argv) {
  const flags = {
    tag: null,
    allowDirty: false,
    allowExistingTag: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--tag") flags.tag = argv[++i];
    else if (argv[i] === "--allow-dirty") flags.allowDirty = true;
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
