#!/usr/bin/env node
/**
 * Detect and migrate known vendored copies of this skill suite.
 * Never scans or modifies application source. Defaults to dry-run.
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT, SKILLS, isMain, readVersion } from "./lib.mjs";

const KNOWN_PARENTS = [".agents/skills", ".claude/skills", ".cursor/skills"];
const MARKER_NAME = ".ep-skills-source.json";
const BACKUP_ROOT = ".ep-skills-backup";

function resolveSourceTag(source, explicit) {
  if (explicit) return explicit;
  const described = spawnSync("git", ["describe", "--tags", "--always"], {
    cwd: source,
    encoding: "utf8",
  });
  if (described.status === 0 && described.stdout.trim()) {
    return described.stdout.trim();
  }
  return readVersion(source);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function skillFiles(skillDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(skillDir);
  return files.sort();
}

export function checksumMap(skillDir) {
  const mapping = {};
  for (const filePath of skillFiles(skillDir)) {
    const relative = path.relative(skillDir, filePath).split(path.sep).join("/");
    if (relative === MARKER_NAME) continue;
    mapping[relative] = sha256(filePath);
  }
  return mapping;
}

export function detectCopies(target) {
  const found = [];
  for (const parent of KNOWN_PARENTS) {
    for (const skill of SKILLS) {
      const candidate = path.join(target, parent, skill);
      if (fs.existsSync(path.join(candidate, "SKILL.md"))) found.push(candidate);
    }
  }
  return found;
}

export function compareCopy(copyDir, canonical, version) {
  const local = checksumMap(copyDir);
  const source = checksumMap(canonical);
  const localKeys = new Set(Object.keys(local));
  const sourceKeys = new Set(Object.keys(source));
  const modified = [...localKeys]
    .filter((key) => sourceKeys.has(key) && local[key] !== source[key])
    .sort();
  const extra = [...localKeys].filter((key) => !sourceKeys.has(key)).sort();
  const missing = [...sourceKeys].filter((key) => !localKeys.has(key)).sort();
  const markerPath = path.join(copyDir, MARKER_NAME);
  let migrated = false;
  let sourceTag = null;
  if (fs.existsSync(markerPath)) {
    try {
      const payload = JSON.parse(fs.readFileSync(markerPath, "utf8"));
      migrated = payload.source_version === version;
      sourceTag = payload.source_tag || payload.source_version || null;
    } catch {
      migrated = false;
    }
  }
  return {
    path: copyDir,
    skill: path.basename(copyDir),
    modified,
    extra,
    missing,
    clean: modified.length === 0 && extra.length === 0 && missing.length === 0,
    already_migrated:
      migrated && modified.length === 0 && extra.length === 0 && missing.length === 0,
    source_tag: sourceTag,
  };
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const filePath of skillFiles(from)) {
    const dest = path.join(to, path.relative(from, filePath));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(filePath, dest);
  }
}

function writeMarker(copyDir, version, tag) {
  const payload = {
    source_version: version,
    source_tag: tag,
    migrated_at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
  };
  fs.writeFileSync(
    path.join(copyDir, MARKER_NAME),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

function backupCopy(target, copyDir) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const relative = path.relative(target, copyDir);
  const dest = path.join(target, BACKUP_ROOT, stamp, relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  copyTree(copyDir, dest);
  return dest;
}

function applyCopy(copyDir, canonical, version, tag) {
  for (const filePath of skillFiles(canonical)) {
    const dest = path.join(copyDir, path.relative(canonical, filePath));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(filePath, dest);
  }
  writeMarker(copyDir, version, tag);
}

function parseArgs(argv) {
  const flags = { target: ".", source: ROOT, tag: null, apply: false, check: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") flags.apply = true;
    else if (token === "--check") flags.check = true;
    else if (token === "--force") flags.force = true;
    else if (token === "--target") flags.target = argv[++i];
    else if (token === "--source") flags.source = argv[++i];
    else if (token === "--tag") flags.tag = argv[++i];
  }
  return flags;
}

export function migrate(flags) {
  const target = path.resolve(flags.target);
  const source = path.resolve(flags.source);
  const version = readVersion(source);
  const tag = resolveSourceTag(source, flags.tag);
  const copies = detectCopies(target);
  const reports = copies.map((copyDir) =>
    compareCopy(copyDir, path.join(source, "skills", path.basename(copyDir)), version),
  );
  const result = {
    target,
    source_version: version,
    source_tag: tag,
    dry_run: !flags.apply,
    copies: reports,
  };

  if (!copies.length) return { ...result, exitCode: 0 };

  const blocked = reports.filter(
    (report) => (report.modified.length || report.extra.length) && !flags.force,
  );
  if (flags.check) {
    const drifted = reports.filter((report) => !report.already_migrated);
    return { ...result, exitCode: drifted.length ? 1 : 0 };
  }
  if (!flags.apply) {
    const pending = reports.some((report) => !report.already_migrated);
    return { ...result, exitCode: pending ? 1 : 0 };
  }
  if (blocked.length) {
    result.error =
      "local edits found; pass --force to replace after backup, or copy the modified files aside first.";
    return { ...result, exitCode: 2 };
  }
  for (const report of reports) {
    if (report.already_migrated) continue;
    backupCopy(target, report.path);
    applyCopy(report.path, path.join(source, "skills", report.skill), version, tag);
  }
  return { ...result, dry_run: false, exitCode: 0 };
}

function main() {
  const result = migrate(parseArgs(process.argv.slice(2)));
  const { exitCode, error, ...payload } = result;
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (error) process.stderr.write(`ERROR: ${error}\n`);
  process.exit(exitCode);
}

if (isMain(import.meta.url)) main();
