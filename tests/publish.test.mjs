import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { MANIFESTS, ROOT, SKILLS } from "../scripts/lib.mjs";
import { nextVersion, publish, versionedFiles } from "../scripts/publish.mjs";

function git(cwd, args) {
  return spawnSync(
    "git",
    [
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "tag.gpgsign=false",
      ...args,
    ],
    {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@example.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@example.com",
      },
    },
  );
}

function fixtureRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-publish-"));
  fs.writeFileSync(path.join(tmp, "VERSION"), "0.10.0\n");
  for (const relative of MANIFESTS) {
    const dest = path.join(tmp, relative);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(ROOT, relative), dest);
  }
  for (const skill of SKILLS) {
    const destDir = path.join(tmp, "skills", skill);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(
      path.join(ROOT, "skills", skill, "SKILL.md"),
      path.join(destDir, "SKILL.md"),
    );
  }
  const init = git(tmp, ["init", "-q"]);
  assert.equal(init.status, 0, init.stderr);
  git(tmp, ["config", "user.name", "Test"]);
  git(tmp, ["config", "user.email", "test@example.com"]);
  git(tmp, ["config", "commit.gpgsign", "false"]);
  git(tmp, ["config", "tag.gpgsign", "false"]);
  const add = git(tmp, ["add", "-A"]);
  assert.equal(add.status, 0, add.stderr);
  const commit = git(tmp, ["commit", "-q", "-m", "init"]);
  assert.equal(commit.status, 0, commit.stderr);
  return tmp;
}

test("nextVersion bumps patch, minor, and major", () => {
  assert.equal(nextVersion("0.10.0", "patch"), "0.10.1");
  assert.equal(nextVersion("0.10.1", "minor"), "0.11.0");
  assert.equal(nextVersion("0.11.0", "major"), "1.0.0");
  assert.equal(nextVersion("0.10.0", "0.12.0"), "0.12.0");
});

test("nextVersion rejects a non-increase or junk spec", () => {
  assert.throws(() => nextVersion("0.10.0", "0.10.0"), /greater than/);
  assert.throws(() => nextVersion("0.10.0", "0.9.9"), /greater than/);
  assert.throws(() => nextVersion("0.10.0", "v0.11.0"), /MAJOR\.MINOR\.PATCH/);
});

test("publish commits the bump and tags vX.Y.Z", () => {
  const tmp = fixtureRepo();
  try {
    const result = publish("patch", { root: tmp });
    assert.equal(result.version, "0.10.1");
    assert.equal(result.tag, "v0.10.1");
    assert.equal(
      fs.readFileSync(path.join(tmp, "VERSION"), "utf8").trim(),
      "0.10.1",
    );
    const plugin = JSON.parse(
      fs.readFileSync(path.join(tmp, "plugin.json"), "utf8"),
    );
    assert.equal(plugin.version, "0.10.1");
    const skill = fs.readFileSync(
      path.join(tmp, "skills/lodestar-audit/SKILL.md"),
      "utf8",
    );
    assert.match(skill, /version:\s*"0.10.1"/);
    const tag = git(tmp, [
      "rev-parse",
      "--verify",
      "--quiet",
      "refs/tags/v0.10.1",
    ]);
    assert.equal(tag.status, 0, tag.stderr);
    const message = git(tmp, ["log", "-1", "--pretty=%s"]);
    assert.equal(message.stdout.trim(), "Release 0.10.1");
    const status = git(tmp, ["status", "--porcelain"]);
    assert.equal(status.stdout.trim(), "");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("publish --dry-run does not write or tag", () => {
  const tmp = fixtureRepo();
  try {
    const result = publish("minor", { root: tmp, dryRun: true });
    assert.equal(result.version, "0.11.0");
    assert.equal(result.dryRun, true);
    assert.equal(
      fs.readFileSync(path.join(tmp, "VERSION"), "utf8").trim(),
      "0.10.0",
    );
    const tag = git(tmp, [
      "rev-parse",
      "--verify",
      "--quiet",
      "refs/tags/v0.11.0",
    ]);
    assert.notEqual(tag.status, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("publish refuses a dirty tree or an existing tag", () => {
  const tmp = fixtureRepo();
  try {
    fs.writeFileSync(path.join(tmp, "scratch.txt"), "dirty\n");
    assert.throws(() => publish("patch", { root: tmp }), /dirty/);
    fs.rmSync(path.join(tmp, "scratch.txt"));
    const tagged = git(tmp, ["tag", "v0.10.1"]);
    assert.equal(tagged.status, 0, tagged.stderr);
    assert.throws(() => publish("patch", { root: tmp }), /already exists/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("versionedFiles covers VERSION, manifests, and skills", () => {
  const files = versionedFiles();
  assert.ok(files.includes("VERSION"));
  for (const relative of MANIFESTS) assert.ok(files.includes(relative));
  for (const skill of SKILLS) {
    assert.ok(files.includes(path.join("skills", skill, "SKILL.md")));
  }
});
