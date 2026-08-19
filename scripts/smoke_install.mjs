#!/usr/bin/env node
/** Clone the candidate commit and prove a clean install, update, and rollback. */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT, SKILLS, isMain, readVersion } from "./lib.mjs";
import { setVersion } from "./set_version.mjs";
import { runSkillsCli } from "./skills-cli.mjs";

function run(command, args, cwd, env = process.env) {
  return spawnSync(command, args, { cwd, encoding: "utf8", env });
}

export function installedSkills(consumer) {
  const found = [];
  for (const parent of [".agents/skills", ".cursor/skills", ".claude/skills"]) {
    const root = path.join(consumer, parent);
    if (!fs.existsSync(root)) continue;
    for (const skill of SKILLS) {
      const skillMd = path.join(root, skill, "SKILL.md");
      if (fs.existsSync(skillMd)) found.push({ skill, path: skillMd, parent });
    }
  }
  return found;
}

export function assertInstalled(consumer, version) {
  const found = installedSkills(consumer);
  const names = [...new Set(found.map((item) => item.skill))].sort();
  if (names.join(",") !== [...SKILLS].sort().join(",")) {
    throw new Error(
      `expected four installed skills, found ${names.join(", ") || "none"}`,
    );
  }
  for (const item of found) {
    const text = fs.readFileSync(item.path, "utf8");
    if (!text.includes(`version: "${version}"`)) {
      throw new Error(
        `${item.skill} at ${item.parent} is not version ${version}`,
      );
    }
  }
  return names;
}

function addSkills(source, consumer) {
  // Pin the agent explicitly: the upstream `skills` CLI's own auto-detection
  // is environment-dependent (it can pick different agent directories on a
  // CI runner than locally), which made this smoke test flaky. This test is
  // about install/update/rollback correctness, not agent detection, so a
  // fixed target keeps it deterministic.
  const result = runSkillsCli(
    [
      "add",
      source,
      "--skill",
      ...SKILLS,
      "--agent",
      "cursor",
      "-y",
      "-p",
      "--copy",
    ],
    consumer,
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "skills add failed");
  }
  return result.stdout;
}

export function smokeInstall(root = ROOT, options = {}) {
  const version = readVersion(root);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-smoke-"));
  const dest = path.join(tmp, "checkout");
  const older = path.join(tmp, "older");
  const consumer = path.join(tmp, "consumer");
  try {
    const clone = run("git", ["clone", root, dest], root);
    if (clone.status !== 0) {
      return { ok: false, error: clone.stderr || "git clone failed" };
    }
    const check = run(process.execPath, ["scripts/check_package.mjs"], dest);
    if (check.status !== 0) {
      return {
        ok: false,
        error:
          `${check.stdout || ""}${check.stderr || ""}`.trim() ||
          "package checks failed",
      };
    }
    fs.mkdirSync(consumer, { recursive: true });
    fs.writeFileSync(path.join(consumer, "README.md"), "consumer\n");
    addSkills(dest, consumer);
    const installed = assertInstalled(consumer, version);

    fs.cpSync(dest, older, { recursive: true });
    setVersion("0.0.9", older);
    addSkills(older, consumer);
    assertInstalled(consumer, "0.0.9");
    addSkills(dest, consumer);
    assertInstalled(consumer, version);

    return { ok: true, version, skills: installed };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  } finally {
    if (!options.keep) fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  const result = smokeInstall();
  if (!result.ok) {
    process.stderr.write(`ERROR: ${result.error}\n`);
    process.exit(1);
  }
  process.stdout.write(
    `Clean checkout installed ${result.skills.length} skills at ${result.version}, then rolled back and updated.\n`,
  );
}

if (isMain(import.meta.url)) main();
