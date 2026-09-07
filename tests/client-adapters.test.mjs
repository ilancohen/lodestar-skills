import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { MANIFESTS, ROOT, SKILLS } from "../scripts/lib.mjs";
import {
  assertExactSkillDiscovery,
  parseSkillsList,
} from "../scripts/smoke_install.mjs";

function cleanPackageTree() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-discover-"));
  const dest = path.join(tmp, "checkout");
  const clone = spawnSync("git", ["clone", "--local", ROOT, dest], {
    encoding: "utf8",
  });
  if (clone.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(clone.stderr || "git clone failed");
  }
  return { tmp, dest };
}

test("root skills/ holds exactly the canonical SKILL.md files", () => {
  const skillsRoot = path.join(ROOT, "skills");
  assert.ok(fs.statSync(skillsRoot).isDirectory());
  const entries = fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(entries, [...SKILLS].sort());
  for (const skill of SKILLS) {
    assert.ok(
      fs.existsSync(path.join(skillsRoot, skill, "SKILL.md")),
      `missing skills/${skill}/SKILL.md`,
    );
  }
});

test("manifests stay metadata-only and version-aligned", () => {
  const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
  for (const relative of MANIFESTS) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, relative), "utf8"),
    );
    assert.equal(manifest.version, version);
    assert.equal(manifest.name, "lodestar");
    assert.ok(!("instructions" in manifest));
    assert.ok(!("prompt" in manifest));
  }
});

test("contributor guidance is not a root CLAUDE.md runtime file", () => {
  assert.equal(fs.existsSync(path.join(ROOT, "CLAUDE.md")), false);
  assert.ok(fs.existsSync(path.join(ROOT, "CONTRIBUTING.md")));
});

test("skills CLI lists exactly seven skills from a clean package tree", () => {
  const { tmp, dest } = cleanPackageTree();
  try {
    const found = assertExactSkillDiscovery(dest);
    assert.deepEqual(found, [...SKILLS].sort());
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("parseSkillsList extracts equality-ready names", () => {
  const sample = `
◇  Found 8 skills
◇  Available Skills
│    lodestar-setup
│      Sets up the suite.
│    grill-me
│      Local only.
`;
  assert.deepEqual(parseSkillsList(sample), ["grill-me", "lodestar-setup"]);
});

test("no adapter auto-loads lodestar-fix", () => {
  for (const relative of MANIFESTS) {
    const text = fs.readFileSync(path.join(ROOT, relative), "utf8");
    assert.doesNotMatch(text, /lodestar-fix/);
  }
  assert.equal(fs.existsSync(path.join(ROOT, ".kiro")), false);
});

test("canonical skills disable model invocation", () => {
  for (const skill of SKILLS) {
    const text = fs.readFileSync(
      path.join(ROOT, "skills", skill, "SKILL.md"),
      "utf8",
    );
    assert.match(text, /^disable-model-invocation:\s*true$/m);
  }
});
