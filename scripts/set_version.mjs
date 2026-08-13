#!/usr/bin/env node
/** Set the suite version in VERSION, manifests, and skill frontmatter. */

import fs from "node:fs";
import path from "node:path";
import { MANIFESTS, ROOT, SKILLS, isMain, readJson } from "./lib.mjs";

function replaceMetadataVersion(text, version, relativePath) {
  let count = 0;
  const updated = text.replace(
    /^metadata:\s*\n(?:^[ \t]+.*\n)*?^[ \t]+version:\s*["']?[^"'\n]+["']?/m,
    (block) => {
      count += 1;
      return block.replace(
        /version:\s*["']?[^"'\n]+["']?/,
        `version: "${version}"`,
      );
    },
  );
  if (count !== 1) {
    throw new Error(`${relativePath}: could not update metadata.version`);
  }
  return updated;
}

export function setVersion(version, root = ROOT) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`${JSON.stringify(version)} is not MAJOR.MINOR.PATCH`);
  }
  fs.writeFileSync(path.join(root, "VERSION"), `${version}\n`, "utf8");
  for (const relative of MANIFESTS) {
    const manifestPath = path.join(root, relative);
    const manifest = readJson(manifestPath);
    manifest.version = version;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  for (const skill of SKILLS) {
    const skillPath = path.join(root, "skills", skill, "SKILL.md");
    const text = fs.readFileSync(skillPath, "utf8");
    fs.writeFileSync(
      skillPath,
      replaceMetadataVersion(text, version, path.relative(root, skillPath)),
      "utf8",
    );
  }
}

function main() {
  const version = process.argv[2];
  if (!version) {
    process.stderr.write("Usage: node scripts/set_version.mjs <MAJOR.MINOR.PATCH>\n");
    process.exit(1);
  }
  try {
    setVersion(version);
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    process.exit(1);
  }
  process.stdout.write(
    `Set version ${version} in VERSION, manifests, and skill metadata.\n`,
  );
}

if (isMain(import.meta.url)) main();
