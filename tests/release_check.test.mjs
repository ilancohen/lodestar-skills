import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { releaseCheck } from "../scripts/release_check.mjs";

// The package-check branch always validates the real ROOT (check_package.mjs
// resolves its own root from its file location, not cwd), so it isn't
// exercised here — it's covered by tests/check_package.test.mjs instead.
// These tests target the git-status/tag branches via an isolated fixture
// repo so the real checkout is never touched.

function git(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result;
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-release-check-"));
  git(["init", "-q"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  fs.writeFileSync(path.join(dir, "VERSION"), "1.2.3\n");
  git(["add", "."], dir);
  git(["commit", "-q", "-m", "init"], dir);
  return dir;
}

test("releaseCheck passes on a clean repo with no existing tag", () => {
  const dir = makeRepo();
  try {
    const { errors, tag, version } = releaseCheck({ root: dir });
    assert.deepEqual(
      errors.filter((error) => !error.startsWith("package checks")),
      [],
    );
    assert.equal(tag, "v1.2.3");
    assert.equal(version, "1.2.3");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("releaseCheck rejects a dirty tree unless --allow-dirty", () => {
  const dir = makeRepo();
  try {
    fs.writeFileSync(path.join(dir, "untracked.txt"), "dirty\n");
    const dirty = releaseCheck({ root: dir });
    assert.ok(dirty.errors.includes("working tree is dirty"));

    const allowed = releaseCheck({ root: dir, allowDirty: true });
    assert.ok(!allowed.errors.includes("working tree is dirty"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("releaseCheck rejects an existing tag unless --allow-existing-tag", () => {
  const dir = makeRepo();
  try {
    git(["tag", "v1.2.3"], dir);
    const blocked = releaseCheck({ root: dir });
    assert.ok(blocked.errors.includes("tag v1.2.3 already exists"));

    const allowed = releaseCheck({ root: dir, allowExistingTag: true });
    assert.ok(!allowed.errors.includes("tag v1.2.3 already exists"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("releaseCheck honors a custom --tag", () => {
  const dir = makeRepo();
  try {
    const { tag, errors } = releaseCheck({ root: dir, tag: "v9.9.9" });
    assert.equal(tag, "v9.9.9");
    assert.ok(!errors.includes("tag v9.9.9 already exists"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
