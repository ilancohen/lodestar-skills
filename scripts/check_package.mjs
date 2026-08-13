#!/usr/bin/env node
/** Validate package-level invariants without third-party dependencies. */

import fs from "node:fs";
import path from "node:path";
import {
  HOMEPAGE_URL,
  MANIFESTS,
  REPO_URL,
  ROOT,
  SKILLS,
  frontmatter,
  isMain,
  metadataVersion,
  readJson,
  readVersion,
  scalar,
} from "./lib.mjs";

function checkLinks(filePath, errors) {
  const text = fs.readFileSync(filePath, "utf8");
  const relative = path.relative(ROOT, filePath);
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const targetPath = target.split("#", 1)[0];
    if (!targetPath || /[<>*…]/.test(targetPath)) continue;
    const resolved = path.resolve(path.dirname(filePath), targetPath);
    if (!fs.existsSync(resolved)) {
      errors.push(`${relative}: broken local link '${target}'`);
    }
  }
}

const SKIP_DIRS = new Set([".git", "node_modules", ".agents", ".cursor"]);

function walkMarkdown(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(full, files);
    else if (entry.name.endsWith(".md")) files.push(full);
  }
  return files;
}

export function checkPackage(root = ROOT) {
  const errors = [];
  const warnings = [];
  const version = readVersion(root);
  const skillsDir = path.join(root, "skills");
  const discovered = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
  const expected = [...SKILLS].sort();
  if (discovered.join(",") !== expected.join(",")) {
    errors.push(`skills/: expected ${JSON.stringify(expected)}, found ${JSON.stringify(discovered)}`);
  }

  for (const relative of MANIFESTS) {
    const manifestPath = path.join(root, relative);
    let manifest;
    try {
      manifest = readJson(manifestPath);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    if (manifest.name !== "engineering-principles") {
      errors.push(`${relative}: unexpected plugin name`);
    }
    if (manifest.version !== version) {
      errors.push(`${relative}: version must be ${version}`);
    }
    if (manifest.homepage && manifest.homepage !== HOMEPAGE_URL) {
      errors.push(`${relative}: homepage must be ${HOMEPAGE_URL}`);
    }
    if (typeof manifest.repository === "string") {
      const allowed = new Set([REPO_URL, `${REPO_URL}.git`]);
      if (!allowed.has(manifest.repository)) {
        errors.push(`${relative}: repository must be ${REPO_URL}`);
      }
    }
  }

  for (const skill of SKILLS) {
    const skillDir = path.join(root, "skills", skill);
    const skillPath = path.join(skillDir, "SKILL.md");
    const relativeSkill = path.relative(root, skillPath);
    const text = fs.readFileSync(skillPath, "utf8");
    let yaml;
    try {
      yaml = frontmatter(text, relativeSkill);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    if (scalar(yaml, "name") !== skill) {
      errors.push(`${relativeSkill}: name must match directory`);
    }
    if (scalar(yaml, "license") !== "MIT") {
      errors.push(`${relativeSkill}: license must be MIT`);
    }
    if (metadataVersion(yaml) !== version) {
      errors.push(`${relativeSkill}: metadata.version must be ${version}`);
    }
    const evalPath = path.join(skillDir, "evals", "evals.json");
    const relativeEval = path.relative(root, evalPath);
    if (!fs.existsSync(evalPath)) {
      errors.push(`${path.relative(root, skillDir)}: missing evals/evals.json`);
    } else {
      try {
        const evalSet = readJson(evalPath);
        if (evalSet.skill_name !== skill) {
          errors.push(`${relativeEval}: skill_name must be ${skill}`);
        }
        if (!Array.isArray(evalSet.evals) || evalSet.evals.length < 3) {
          errors.push(`${relativeEval}: expected at least 3 evals`);
        }
      } catch (error) {
        errors.push(error.message);
      }
    }
    const lines = text.split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    const lineCount = lines.length;
    const tokens = text.split(/\s+/).filter(Boolean).length;
    if (lineCount > 499) {
      errors.push(
        `${relativeSkill}: ${lineCount} lines; limit is 499`,
      );
    }
    if (tokens > 8000) {
      errors.push(`${relativeSkill}: ~${tokens} tokens; hard limit is 8000`);
    } else if (tokens > 5000) {
      warnings.push(
        `${relativeSkill}: ~${tokens} tokens; target is about 5000`,
      );
    }
  }

  const setupText = fs.readFileSync(path.join(root, "skills/ep-setup/SKILL.md"), "utf8");
  if (
    /\.agents\/skills\/ep-setup\/(?:principles|agents-md|skills-readme|claude-md|copilot-instructions|fallowrc)\.md/.test(
      setupText,
    )
  ) {
    errors.push("skills/ep-setup/SKILL.md: bundled resources must use relative paths");
  }

  for (const markdownPath of walkMarkdown(root)) {
    checkLinks(markdownPath, errors);
  }

  return { errors, warnings, version, skillCount: SKILLS.length };
}

function main() {
  const { errors, warnings, version, skillCount } = checkPackage();
  for (const warning of warnings) process.stdout.write(`WARNING: ${warning}\n`);
  for (const error of errors) process.stderr.write(`ERROR: ${error}\n`);
  if (errors.length) process.exit(1);
  process.stdout.write(`Package checks passed for ${skillCount} skills at version ${version}.\n`);
}

const invoked = isMain(import.meta.url);
if (invoked) main();
