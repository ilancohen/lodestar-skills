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

/** Parse `skills add … --list` stdout/stderr into sorted skill names. */
export function parseSkillsList(output) {
  const text = String(output ?? "");
  const section = text.split(/Available Skills/i)[1] ?? "";
  const names = new Set();
  for (const line of section.split(/\r?\n/)) {
    // Box line with a skill name: "│    lodestar-setup" (not the longer description indent).
    const match = line.match(/^[│|]\s{4}([a-z][a-z0-9-]*)\s*$/i);
    if (match) names.add(match[1]);
  }
  return [...names].sort();
}

/**
 * Discover skills from a source tree via the skills CLI.
 * Callers must pass a clean package tree — a polluted working copy that
 * also has `.agents/skills/*` will list extras.
 */
export function listDiscoveredSkills(source) {
  const result = runSkillsCli(["add", source, "--list"], source);
  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || "skills add --list failed",
    );
  }
  return parseSkillsList(`${result.stdout}\n${result.stderr}`);
}

export function assertExactSkillDiscovery(source, expected = SKILLS) {
  const found = listDiscoveredSkills(source);
  const want = [...expected].sort();
  if (found.join(",") !== want.join(",")) {
    throw new Error(
      `expected exactly ${want.length} skills ${JSON.stringify(want)}, found ${JSON.stringify(found)}`,
    );
  }
  return found;
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

export function assertInstalled(consumer, version, expected = SKILLS) {
  const found = installedSkills(consumer);
  const names = [...new Set(found.map((item) => item.skill))].sort();
  const want = [...expected].sort();
  if (names.join(",") !== want.join(",")) {
    throw new Error(
      `expected ${want.length} installed skills, found ${names.join(", ") || "none"}`,
    );
  }
  for (const item of found) {
    if (!want.includes(item.skill)) continue;
    const text = fs.readFileSync(item.path, "utf8");
    if (!text.includes(`version: "${version}"`)) {
      throw new Error(
        `${item.skill} at ${item.parent} is not version ${version}`,
      );
    }
  }
  return names;
}

export function assertInstalledSubset(consumer, version, expected) {
  return assertInstalled(consumer, version, expected);
}

function addSkills(source, consumer, skills = SKILLS) {
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
      ...skills,
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

/** Done-when partial-install matrices from stage 05. */
export const PARTIAL_INSTALL_MATRICES = [
  ["lodestar-setup"],
  ["lodestar-setup", "lodestar-architecture"],
  ["lodestar-setup", "lodestar-plan", "lodestar-implement"],
  ["lodestar-setup", "lodestar-audit", "lodestar-fix"],
];

/**
 * Adapter shapes exercised for bundled-principles access.
 * `parent` is where `skills add --agent <agent>` lands skills.
 * Unavailable hosts stay `untested` in eval baseline — never recorded as passed.
 */
export const ADAPTER_SHAPES = [
  { agent: "cursor", parent: ".cursor/skills" },
  { agent: "claude-code", parent: ".claude/skills" },
  { agent: "codex", parent: ".agents/skills" },
];

/** Matrices that must not imply audit/Fallow preparation. */
export const NON_AUDIT_MATRICES = PARTIAL_INSTALL_MATRICES.filter(
  (subset) => !subset.includes("lodestar-audit"),
);

export function assertPrinciplesBesideSetup(consumer, parents) {
  const checked = [];
  for (const parent of parents) {
    const principles = path.join(
      consumer,
      parent,
      "lodestar-setup",
      "principles.md",
    );
    if (!fs.existsSync(principles)) {
      throw new Error(
        `bundled principles missing at ${parent}/lodestar-setup/principles.md`,
      );
    }
    const text = fs.readFileSync(principles, "utf8");
    if (!/Separation of Concerns/i.test(text)) {
      throw new Error(
        `principles.md at ${parent}/lodestar-setup looks empty or truncated`,
      );
    }
    checked.push(path.join(parent, "lodestar-setup", "principles.md"));
  }
  return checked;
}

/**
 * Install each adapter shape and assert setup principles resolve beside SKILL.md.
 */
export function smokeAdapterPrinciples(source, version = readVersion(source)) {
  const results = [];
  for (const shape of ADAPTER_SHAPES) {
    const consumer = fs.mkdtempSync(
      path.join(os.tmpdir(), "lodestar-smoke-adapter-"),
    );
    try {
      fs.writeFileSync(path.join(consumer, "README.md"), "consumer\n");
      const result = runSkillsCli(
        [
          "add",
          source,
          "--skill",
          "lodestar-setup",
          "--agent",
          shape.agent,
          "-y",
          "-p",
          "--copy",
        ],
        consumer,
      );
      if (result.status !== 0) {
        throw new Error(
          result.stderr ||
            result.stdout ||
            `skills add --agent ${shape.agent} failed`,
        );
      }
      assertInstalledSubset(consumer, version, ["lodestar-setup"]);
      const principles = assertPrinciplesBesideSetup(consumer, [shape.parent]);
      results.push({ ...shape, principles });
    } finally {
      fs.rmSync(consumer, { recursive: true, force: true });
    }
  }
  return results;
}

/**
 * Assert non-audit partial installs do not ship lodestar-audit (Fallow gating).
 */
export function assertFallowGatingMatrices() {
  for (const subset of NON_AUDIT_MATRICES) {
    if (subset.includes("lodestar-audit") || subset.includes("lodestar-fix")) {
      throw new Error(
        `non-audit matrix unexpectedly includes audit/fix: ${subset.join(",")}`,
      );
    }
  }
  return NON_AUDIT_MATRICES;
}
/**
 * Install each partial matrix into its own consumer and assert exact set.
 * Used by unit tests (when CLI available) and optional smoke extension.
 */
export function smokePartialInstalls(source, version = readVersion(source)) {
  const results = [];
  for (const subset of PARTIAL_INSTALL_MATRICES) {
    const consumer = fs.mkdtempSync(
      path.join(os.tmpdir(), "lodestar-smoke-partial-"),
    );
    try {
      fs.writeFileSync(path.join(consumer, "README.md"), "consumer\n");
      addSkills(source, consumer, subset);
      const installed = assertInstalledSubset(consumer, version, subset);
      results.push({ subset, installed });
    } finally {
      fs.rmSync(consumer, { recursive: true, force: true });
    }
  }
  return results;
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
    // Discovery must run on this clean clone — never the contributor's
    // polluted working copy (local `.agents/skills/*` would inflate the list).
    assertExactSkillDiscovery(dest);
    fs.mkdirSync(consumer, { recursive: true });
    fs.writeFileSync(path.join(consumer, "README.md"), "consumer\n");
    addSkills(dest, consumer);
    const installed = assertInstalled(consumer, version);
    assertPrinciplesBesideSetup(
      consumer,
      [...new Set(installedSkills(consumer).map((item) => item.parent))],
    );

    // Partial-install Done-when matrices (separate consumers).
    smokePartialInstalls(dest, version);
    assertFallowGatingMatrices();
    smokeAdapterPrinciples(dest, version);

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
