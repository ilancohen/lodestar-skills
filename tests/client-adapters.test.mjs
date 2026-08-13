import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  KIRO_BLOCKED,
  KIRO_STEERING,
  MANIFESTS,
  ROOT,
  SKILLS,
} from "../scripts/lib.mjs";
import { checkPackage } from "../scripts/check_package.mjs";
import { runSkillsCli } from "../scripts/skills-cli.mjs";

test("adapters and manifests discover exactly four canonical skills", () => {
  const result = checkPackage(ROOT);
  assert.deepEqual(result.errors, [], result.errors.join("\n"));
  assert.equal(result.skillCount, 4);
});

test("every shipped Kiro steering entry is manual and thin", () => {
  for (const skill of KIRO_STEERING) {
    const text = fs.readFileSync(
      path.join(ROOT, ".kiro", "steering", `${skill}.md`),
      "utf8",
    );
    assert.match(text, /^---\ninclusion: manual\n---/m);
    assert.doesNotMatch(text, /inclusion:\s*(always|auto|fileMatch)/);
    assert.match(text, new RegExp(`skills/${skill}/SKILL\\.md`));
  }
});

test("ep-fix is not shipped as Kiro steering (CLI auto-loads all steering)", () => {
  for (const skill of KIRO_BLOCKED) {
    assert.equal(
      fs.existsSync(path.join(ROOT, ".kiro", "steering", `${skill}.md`)),
      false,
    );
  }
  assert.equal(fs.existsSync(path.join(ROOT, ".kiro", "skills")), false);
  const policy = fs.readFileSync(
    path.join(ROOT, ".kiro", "steering", "README.md"),
    "utf8",
  );
  assert.match(policy, /ep-fix/);
  assert.match(policy, /CLI/);
});

test("manifests stay metadata-only and version-aligned", () => {
  const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();
  for (const relative of MANIFESTS) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(ROOT, relative), "utf8"),
    );
    assert.equal(manifest.version, version);
    assert.equal(manifest.name, "engineering-principles");
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
