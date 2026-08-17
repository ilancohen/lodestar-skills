#!/usr/bin/env node
/** Validate package-level invariants without third-party dependencies. */

import fs from "node:fs";
import path from "node:path";
import {
  ADAPTER_DIRS,
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

const SKIP_DIRS = new Set([".git", "node_modules"]);

function walkMarkdown(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(full, files);
    else if (entry.name.endsWith(".md")) files.push(full);
  }
  return files;
}

function validateManifestShape(relative, manifest, errors) {
  if (
    typeof manifest.description !== "string" ||
    !manifest.description.trim()
  ) {
    errors.push(`${relative}: description is required`);
  }
  if (
    relative === "plugin.json" &&
    manifest.$schema !==
      "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
  ) {
    errors.push(
      `${relative}: $schema must be the Agent Plugins 1.0 schema URL`,
    );
  }
  if (relative === ".codex-plugin/plugin.json") {
    if (manifest.skills !== "./skills/") {
      errors.push(`${relative}: skills must be ./skills/`);
    }
  }
}

function validateNoDuplicatedSkillBodies(root, errors) {
  for (const dir of ADAPTER_DIRS) {
    const base = path.join(root, dir);
    if (!fs.existsSync(base)) continue;
    const stack = [base];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (entry.name === "SKILL.md") {
          errors.push(
            `${path.relative(root, full)}: adapters must not contain SKILL.md copies`,
          );
        }
      }
    }
  }
}

function validateContributorGuidance(root, errors) {
  if (fs.existsSync(path.join(root, "CLAUDE.md"))) {
    errors.push(
      "CLAUDE.md: contributor guidance must live in CONTRIBUTING.md so it is not Claude plugin runtime context",
    );
  }
  if (!fs.existsSync(path.join(root, "CONTRIBUTING.md"))) {
    errors.push("CONTRIBUTING.md: missing contributor guidance");
  }
}

function validateLocalPackageManager(root, errors) {
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) {
    errors.push("package.json: missing; this suite defaults to pnpm");
    return;
  }
  let pkg;
  try {
    pkg = readJson(pkgPath);
  } catch (error) {
    errors.push(error.message);
    return;
  }
  if (
    typeof pkg.packageManager !== "string" ||
    !pkg.packageManager.startsWith("pnpm@")
  ) {
    errors.push("package.json: packageManager must pin pnpm");
  }
}

export function checkPackage(root = ROOT) {
  const errors = [];
  const warnings = [];
  const version = readVersion(root);
  const skillsDir = path.join(root, "skills");
  const discovered = fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md")),
    )
    .map((entry) => entry.name)
    .sort();
  const expected = [...SKILLS].sort();
  if (discovered.join(",") !== expected.join(",")) {
    errors.push(
      `skills/: expected ${JSON.stringify(expected)}, found ${JSON.stringify(discovered)}`,
    );
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
    if (manifest.name !== "lodestar") {
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
    validateManifestShape(relative, manifest, errors);
  }

  validateNoDuplicatedSkillBodies(root, errors);
  validateContributorGuidance(root, errors);
  validateLocalPackageManager(root, errors);

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
    if (scalar(yaml, "disable-model-invocation") !== "true") {
      errors.push(`${relativeSkill}: disable-model-invocation must be true`);
    }
    if (metadataVersion(yaml) !== version) {
      errors.push(`${relativeSkill}: metadata.version must be ${version}`);
    }
    const lines = text.split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    const lineCount = lines.length;
    const tokens = text.split(/\s+/).filter(Boolean).length;
    if (lineCount > 499) {
      errors.push(`${relativeSkill}: ${lineCount} lines; limit is 499`);
    }
    if (tokens > 8000) {
      errors.push(`${relativeSkill}: ~${tokens} tokens; hard limit is 8000`);
    } else if (tokens > 5000) {
      warnings.push(
        `${relativeSkill}: ~${tokens} tokens; target is about 5000`,
      );
    }
  }

  const setupText = fs.readFileSync(
    path.join(root, "skills/lodestar-setup/SKILL.md"),
    "utf8",
  );
  // principles.md is deliberately exempt: every install guarantees a real
  // copy at `.agents/skills/lodestar-setup/principles.md` (install always
  // also requests the skills CLI's `universal` target), so the generated
  // `.agents/lodestar/context.md` is meant to link to that fixed path. The
  // other bundled templates are setup-internal only and must stay
  // relative to this SKILL.md's own directory.
  if (
    /\.agents\/skills\/lodestar-setup\/(?:agents-md|context-md|skills-readme|fallowrc)\.md/.test(
      setupText,
    )
  ) {
    errors.push(
      "skills/lodestar-setup/SKILL.md: bundled resources must use relative paths",
    );
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
  process.stdout.write(
    `Package checks passed for ${skillCount} skills at version ${version}.\n`,
  );
}

const invoked = isMain(import.meta.url);
if (invoked) main();
