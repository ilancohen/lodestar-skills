#!/usr/bin/env node
/** Bump suite version files, commit, and tag vX.Y.Z. */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { MANIFESTS, ROOT, SKILLS, isMain, readVersion } from "./lib.mjs";
import { setVersion } from "./set_version.mjs";

const USAGE =
  "Usage: node scripts/publish.mjs <patch|minor|major|X.Y.Z> [--dry-run]\n";

export function versionedFiles() {
  return [
    "VERSION",
    ...MANIFESTS,
    ...SKILLS.map((skill) => path.join("skills", skill, "SKILL.md")),
  ];
}

export function nextVersion(current, spec) {
  if (!/^\d+\.\d+\.\d+$/.test(current)) {
    throw new Error(`${JSON.stringify(current)} is not MAJOR.MINOR.PATCH`);
  }
  if (spec === "major" || spec === "minor" || spec === "patch") {
    const [major, minor, patch] = current.split(".").map(Number);
    if (spec === "major") return `${major + 1}.0.0`;
    if (spec === "minor") return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
  }
  if (!/^\d+\.\d+\.\d+$/.test(spec)) {
    throw new Error(
      `${JSON.stringify(spec)} is not patch, minor, major, or MAJOR.MINOR.PATCH`,
    );
  }
  if (compareVersions(spec, current) <= 0) {
    throw new Error(`${spec} must be greater than ${current}`);
  }
  return spec;
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}

function git(root, args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

function requireGitOk(result, action) {
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(detail ? `${action}: ${detail}` : `${action} failed`);
  }
}

export function publish(spec, options = {}) {
  const root = options.root ?? ROOT;
  const dryRun = Boolean(options.dryRun);

  const status = git(root, ["status", "--porcelain"]);
  requireGitOk(status, "git status");
  if (status.stdout.trim()) throw new Error("working tree is dirty");

  const current = readVersion(root);
  const version = nextVersion(current, spec);
  const tag = `v${version}`;

  const existing = git(root, [
    "rev-parse",
    "--verify",
    "--quiet",
    `refs/tags/${tag}`,
  ]);
  if (existing.status === 0) throw new Error(`tag ${tag} already exists`);

  if (dryRun) {
    return { current, version, tag, dryRun: true, files: versionedFiles() };
  }

  setVersion(version, root);
  requireGitOk(git(root, ["add", "--", ...versionedFiles()]), "git add");
  requireGitOk(git(root, ["commit", "-m", `Release ${version}`]), "git commit");
  requireGitOk(
    git(root, ["tag", "-a", tag, "-m", `lodestar ${version}`]),
    "git tag",
  );
  return { current, version, tag, dryRun: false, files: versionedFiles() };
}

function parseArgs(argv) {
  const flags = { spec: null, dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg.startsWith("-")) {
      throw new Error(`unknown flag ${arg}`);
    } else if (flags.spec) {
      throw new Error(`unexpected argument ${JSON.stringify(arg)}`);
    } else flags.spec = arg;
  }
  return flags;
}

function main() {
  let flags;
  try {
    flags = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n${USAGE}`);
    process.exit(1);
  }
  if (!flags.spec) {
    process.stderr.write(USAGE);
    process.exit(1);
  }
  try {
    const result = publish(flags.spec, { dryRun: flags.dryRun });
    const verb = result.dryRun ? "Would release" : "Released";
    process.stdout.write(
      `${verb} ${result.current} → ${result.version} (tag ${result.tag}).\n`,
    );
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exit(1);
  }
}

if (isMain(import.meta.url)) main();
