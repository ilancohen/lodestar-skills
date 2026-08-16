import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { MANIFESTS, ROOT, SKILLS } from "../scripts/lib.mjs";
import { checkPackage } from "../scripts/check_package.mjs";
import { runSkillsCli } from "../scripts/skills-cli.mjs";

test("adapters and manifests discover exactly four canonical skills", () => {
  const result = checkPackage(ROOT);
  assert.deepEqual(result.errors, [], result.errors.join("\n"));
  assert.equal(result.skillCount, 4);
});

test("root skills/ holds exactly the four canonical SKILL.md files", () => {
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

test("skills CLI lists exactly four skills from this package", () => {
  const result = runSkillsCli(["add", ".", "--list"], ROOT);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const out = `${result.stdout}\n${result.stderr}`;
  for (const skill of SKILLS) {
    assert.match(out, new RegExp(skill));
  }
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
