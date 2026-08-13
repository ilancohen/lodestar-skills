import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  detectPkgManager,
  installFallowCommand,
} from "../skills/ep-audit/scripts/pkg-manager.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("this suite repo is pnpm", () => {
  const detected = detectPkgManager(ROOT);
  assert.equal(detected.pkgManager, "pnpm");
  assert.equal(detected.ambiguous, false);
});

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ep-pm-"));
}

test("detects a single lockfile", () => {
  const cases = [
    ["pnpm-lock.yaml", "pnpm", "pnpm dlx"],
    ["yarn.lock", "yarn", "yarn dlx"],
    ["package-lock.json", "npm", "npx"],
  ];
  for (const [file, manager, run] of cases) {
    const root = tempRoot();
    try {
      fs.writeFileSync(path.join(root, file), "");
      const detected = detectPkgManager(root);
      assert.equal(detected.pkgManager, manager);
      assert.equal(detected.run, run);
      assert.equal(detected.ambiguous, false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("asks when no lockfile is present", () => {
  const root = tempRoot();
  try {
    const detected = detectPkgManager(root);
    assert.equal(detected.pkgManager, null);
    assert.equal(detected.run, null);
    assert.equal(detected.ambiguous, true);
    assert.deepEqual(detected.lockfiles, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("asks when multiple lockfiles are present", () => {
  const root = tempRoot();
  try {
    fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), "");
    fs.writeFileSync(path.join(root, "package-lock.json"), "");
    const detected = detectPkgManager(root);
    assert.equal(detected.pkgManager, null);
    assert.equal(detected.ambiguous, true);
    assert.deepEqual(detected.lockfiles, ["pnpm", "npm"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ignores bun.lockb and still asks", () => {
  const root = tempRoot();
  try {
    fs.writeFileSync(path.join(root, "bun.lockb"), "");
    const detected = detectPkgManager(root);
    assert.equal(detected.pkgManager, null);
    assert.equal(detected.ambiguous, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("install command matches the detected manager", () => {
  assert.equal(
    installFallowCommand("3.15.0", "pnpm"),
    "pnpm add -D fallow@3.15.0",
  );
  assert.equal(
    installFallowCommand("3.15.0", "npm"),
    "npm install --save-dev fallow@3.15.0",
  );
  assert.equal(
    installFallowCommand("3.15.0", "yarn"),
    "yarn add -D fallow@3.15.0",
  );
});

test("unknown manager lists pnpm, npm, and yarn and says to ask", () => {
  const command = installFallowCommand("3.15.0", null);
  assert.match(command, /pnpm add -D fallow@3\.15\.0/);
  assert.match(command, /npm install --save-dev fallow@3\.15\.0/);
  assert.match(command, /yarn add -D fallow@3\.15\.0/);
  assert.match(command, /ask which package manager/);
});
