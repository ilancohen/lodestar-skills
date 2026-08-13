#!/usr/bin/env node
/** Validate package-level invariants without third-party dependencies. */

import fs from "node:fs";
import path from "node:path";
import {
  ADAPTER_DIRS,
  HOMEPAGE_URL,
  KIRO_BLOCKED,
  KIRO_STEERING,
  MANIFESTS,
  REPO_URL,
  ROOT,
  SKILLS,
  SOURCE_MUTATING_SKILLS,
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

function validateKiroAdapters(root, errors) {
  const steeringDir = path.join(root, ".kiro", "steering");
  if (!fs.existsSync(steeringDir)) {
    errors.push(".kiro/steering/: missing Kiro adapter directory");
    return;
  }
  const found = fs
    .readdirSync(steeringDir)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .map((name) => name.replace(/\.md$/, ""))
    .sort();
  const expected = [...KIRO_STEERING].sort();
  if (found.join(",") !== expected.join(",")) {
    errors.push(
      `.kiro/steering/: expected ${JSON.stringify(expected)}, found ${JSON.stringify(found)}`,
    );
  }
  for (const skill of KIRO_STEERING) {
    const relative = `.kiro/steering/${skill}.md`;
    const text = fs.readFileSync(path.join(root, relative), "utf8");
    const yaml = frontmatter(text, relative);
    const inclusion = scalar(yaml, "inclusion");
    if (inclusion !== "manual") {
      errors.push(`${relative}: inclusion must be manual (got ${inclusion})`);
    }
    if (/inclusion:\s*(always|auto|fileMatch)/.test(text)) {
      errors.push(
        `${relative}: must not declare always/auto/fileMatch inclusion`,
      );
    }
    const canonical = `skills/${skill}/SKILL.md`;
    if (!text.includes(`#[[file:${canonical}]]`) && !text.includes(canonical)) {
      errors.push(`${relative}: must reference canonical ${canonical}`);
    }
    if (text.split(/\r?\n/).length > 40) {
      errors.push(
        `${relative}: adapter is too long; keep a thin reference only`,
      );
    }
  }
  for (const skill of KIRO_BLOCKED) {
    const blocked = path.join(steeringDir, `${skill}.md`);
    if (fs.existsSync(blocked)) {
      errors.push(
        `.kiro/steering/${skill}.md: must not ship; Kiro CLI loads all steering files and ignores inclusion modes`,
      );
    }
  }
  const kiroSkills = path.join(root, ".kiro", "skills");
  if (fs.existsSync(kiroSkills)) {
    errors.push(
      ".kiro/skills/: do not ship Kiro Agent Skills copies; use manual steering references only",
    );
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

function validateSourceMutatingLoadPolicy(root, errors) {
  for (const skill of SOURCE_MUTATING_SKILLS) {
    const steering = path.join(root, ".kiro", "steering", `${skill}.md`);
    if (fs.existsSync(steering)) {
      errors.push(
        `.kiro/steering/${skill}.md: source-mutating skill must not ship as Kiro steering (CLI auto-loads all steering files)`,
      );
    }
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
    validateManifestShape(relative, manifest, errors);
  }

  validateKiroAdapters(root, errors);
  validateNoDuplicatedSkillBodies(root, errors);
  validateContributorGuidance(root, errors);
  validateLocalPackageManager(root, errors);
  validateSourceMutatingLoadPolicy(root, errors);

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
    path.join(root, "skills/ep-setup/SKILL.md"),
    "utf8",
  );
  if (
    /\.agents\/skills\/ep-setup\/(?:principles|agents-md|skills-readme|claude-md|copilot-instructions|fallowrc)\.md/.test(
      setupText,
    )
  ) {
    errors.push(
      "skills/ep-setup/SKILL.md: bundled resources must use relative paths",
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
