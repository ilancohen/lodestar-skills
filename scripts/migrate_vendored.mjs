#!/usr/bin/env node
/**
 * Detect and re-sync vendored copies of this skill suite against the
 * canonical source: drift checksums, back up, and reapply from `skills/`.
 *
 * Also the hook for any *future* skill ID rename: populate RENAME_MAP
 * (old dir name -> current skill id) when a rename ships, the same way
 * detectCopies/compareCopy/applyCopy already re-home a renamed directory
 * to its canonical name. Empty today — no rename is in flight.
 *
 * Never scans or modifies application source. Defaults to dry-run.
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT, SKILLS, isMain, readVersion } from "./lib.mjs";

const KNOWN_PARENTS = [".agents/skills", ".claude/skills", ".cursor/skills"];
const MARKER_NAME = ".lodestar-source.json";
const BACKUP_ROOT = ".lodestar-backup";

/** @type {Record<string, string>} old vendored dir name -> current skill id */
export const RENAME_MAP = {};

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

function isMarker(relative) {
  return relative === MARKER_NAME;
}

export function canonicalSkillId(dirName) {
  if (SKILLS.includes(dirName)) return dirName;
  return RENAME_MAP[dirName] || null;
}

export function checksumMap(skillDir) {
  const mapping = {};
  for (const filePath of skillFiles(skillDir)) {
    const relative = path.relative(skillDir, filePath).split(path.sep).join("/");
    if (isMarker(relative)) continue;
    mapping[relative] = sha256(filePath);
  }
  return mapping;
}

/**
 * @returns {{ path: string, dirName: string, skill: string, renamed: boolean }[]}
 */
export function detectCopies(target) {
  const found = [];
  const seen = new Set();
  for (const parent of KNOWN_PARENTS) {
    const parentDir = path.join(target, parent);
    if (!fs.existsSync(parentDir)) continue;
    for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skill = canonicalSkillId(entry.name);
      if (!skill) continue;
      const candidate = path.join(parentDir, entry.name);
      if (!fs.existsSync(path.join(candidate, "SKILL.md"))) continue;
      const key = candidate;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        path: candidate,
        dirName: entry.name,
        skill,
        renamed: Boolean(RENAME_MAP[entry.name]),
      });
    }
  }
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

function readMarker(copyDir) {
  const markerPath = path.join(copyDir, MARKER_NAME);
  if (!fs.existsSync(markerPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(markerPath, "utf8"));
  } catch {
    return null;
  }
}

export function compareCopy(copy, canonicalRoot, version) {
  const copyDir = typeof copy === "string" ? copy : copy.path;
  const skill =
    typeof copy === "string"
      ? canonicalSkillId(path.basename(copyDir))
      : copy.skill;
  const renamed =
    typeof copy === "string"
      ? Boolean(RENAME_MAP[path.basename(copyDir)])
      : copy.renamed;
  const canonical = path.join(canonicalRoot, "skills", skill);
  const local = checksumMap(copyDir);
  const source = checksumMap(canonical);
  const localKeys = new Set(Object.keys(local));
  const sourceKeys = new Set(Object.keys(source));
  const modified = [...localKeys]
    .filter((key) => sourceKeys.has(key) && local[key] !== source[key])
    .sort();
  const extra = [...localKeys].filter((key) => !sourceKeys.has(key)).sort();
  const missing = [...sourceKeys].filter((key) => !localKeys.has(key)).sort();
  const payload = readMarker(copyDir);
  const migrated = Boolean(payload && payload.source_version === version && !renamed);
  const sourceTag = payload?.source_tag || payload?.source_version || null;
  return {
    path: copyDir,
    dirName: path.basename(copyDir),
    skill,
    renamed,
    modified,
    extra,
    missing,
    clean: modified.length === 0 && extra.length === 0 && missing.length === 0 && !renamed,
    already_migrated:
      migrated &&
      !renamed &&
      modified.length === 0 &&
      extra.length === 0 &&
      missing.length === 0,
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

function destinationPath(target, copyDir, skill) {
  const parent = path.dirname(copyDir);
  return path.join(parent, skill);
}

function applyCopy(target, report, sourceRoot, version, tag) {
  const canonical = path.join(sourceRoot, "skills", report.skill);
  const dest = destinationPath(target, report.path, report.skill);
  backupCopy(target, report.path);
  if (dest !== report.path && fs.existsSync(dest)) {
    backupCopy(target, dest);
    fs.rmSync(dest, { recursive: true, force: true });
  }
  if (dest !== report.path) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const filePath of skillFiles(canonical)) {
    const out = path.join(dest, path.relative(canonical, filePath));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(filePath, out);
  }
  writeMarker(dest, version, tag);
  if (dest !== report.path) {
    fs.rmSync(report.path, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const flags = {
    target: ".",
    source: ROOT,
    tag: null,
    apply: false,
    check: false,
    force: false,
  };
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
  const reports = copies.map((copy) => compareCopy(copy, source, version));
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
  // Renamed dirs go first: when a renamed copy and its already-current-named
  // sibling collide on the same dest, the rename must win so the old dir
  // gets removed rather than silently left behind because its dest was
  // already claimed by the sibling.
  const applyOrder = [...reports].sort((a, b) => Number(b.renamed) - Number(a.renamed));
  const written = new Set();
  for (const report of applyOrder) {
    if (report.already_migrated) continue;
    const dest = destinationPath(target, report.path, report.skill);
    if (written.has(dest)) continue;
    applyCopy(target, report, source, version, tag);
    written.add(dest);
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
