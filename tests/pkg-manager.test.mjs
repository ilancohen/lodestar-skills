import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  detectPkgManager,
  installFallowCommand,
  parsePkgManagerRow,
  resolvePkgManager,
} from "../skills/lodestar-audit/scripts/pkg-manager.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("this suite repo is pnpm", () => {
  const detected = detectPkgManager(ROOT);
  assert.equal(detected.pkgManager, "pnpm");
  assert.equal(detected.ambiguous, false);
});

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-pm-"));
}

test("detects a single lockfile", () => {
  const cases = [
    ["pnpm-lock.yaml", "pnpm", "pnpm dlx"],
    ["yarn.lock", "yarn", "yarn dlx"],
    ["package-lock.json", "npm", "npx"],
    ["bun.lock", "bun", "bunx"],
    ["bun.lockb", "bun", "bunx"],
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

test("bun.lock and bun.lockb together are still bun", () => {
  const root = tempRoot();
  try {
    fs.writeFileSync(path.join(root, "bun.lock"), "");
    fs.writeFileSync(path.join(root, "bun.lockb"), "");
    const detected = detectPkgManager(root);
    assert.equal(detected.pkgManager, "bun");
    assert.equal(detected.ambiguous, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("bun plus another lockfile is still ambiguous", () => {
  const root = tempRoot();
  try {
    fs.writeFileSync(path.join(root, "bun.lock"), "");
    fs.writeFileSync(path.join(root, "package-lock.json"), "");
    const detected = detectPkgManager(root);
    assert.equal(detected.pkgManager, null);
    assert.equal(detected.ambiguous, true);
    assert.deepEqual(detected.lockfiles, ["npm", "bun"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
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

test("install command matches the detected manager", () => {
  assert.equal(
    installFallowCommand("^3.15.0", "pnpm"),
    "pnpm add -D fallow@^3.15.0",
  );
  assert.equal(
    installFallowCommand("^3.15.0", "npm"),
    "npm install --save-dev fallow@^3.15.0",
  );
  assert.equal(
    installFallowCommand("^3.15.0", "yarn"),
    "yarn add -D fallow@^3.15.0",
  );
  assert.equal(
    installFallowCommand("^3.15.0", "bun"),
    "bun add -d fallow@^3.15.0",
  );
});

test("unknown manager lists known add-dev commands and says to ask", () => {
  const command = installFallowCommand("^3.15.0", null);
  assert.match(command, /pnpm add -D fallow@\^3\.15\.0/);
  assert.match(command, /npm install --save-dev fallow@\^3\.15\.0/);
  assert.match(command, /yarn add -D fallow@\^3\.15\.0/);
  assert.match(command, /bun add -d fallow@\^3\.15\.0/);
  assert.match(command, /ask which package manager/);
});

test("parsePkgManagerRow reads name, run, and add-dev", () => {
  const parsed = parsePkgManagerRow(`## Build & Test

| Command | What it runs |
| pkg-manager | pixi; pixi run; pixi add --dev <pkg> |
`);
  assert.deepEqual(parsed, {
    name: "pixi",
    run: "pixi run",
    addDev: "pixi add --dev <pkg>",
  });
});

test("parsePkgManagerRow ignores a leftover template placeholder", () => {
  assert.equal(
    parsePkgManagerRow(
      "| pkg-manager | `[name; exec prefix; add-dev <pkg> — omit this row when the lockfile is enough]` |",
    ),
    null,
  );
});

test("parsePkgManagerRow ignores the shipped context-md.md template", () => {
  const template = fs.readFileSync(
    path.join(ROOT, "skills/lodestar-setup/context-md.md"),
    "utf8",
  );
  assert.equal(parsePkgManagerRow(template), null);
});

test("parsePkgManagerRow fills bun from the name alone", () => {
  const parsed = parsePkgManagerRow(`## Build & Test

| pkg-manager | bun |
`);
  assert.equal(parsed.name, "bun");
  assert.equal(parsed.run, "bunx");
  assert.equal(parsed.addDev, null);
});

test("recorded pkg-manager row wins over lockfile detection", () => {
  const root = tempRoot();
  try {
    fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), "");
    const resolved = resolvePkgManager(root, {
      name: "pixi",
      run: "pixi run",
      addDev: "pixi add --dev <pkg>",
    });
    assert.equal(resolved.pkgManager, "pixi");
    assert.equal(resolved.run, "pixi run");
    assert.equal(resolved.provenance, "context.md");
    assert.equal(resolved.ambiguous, false);
    assert.deepEqual(resolved.lockfiles, ["pnpm"]);
    assert.equal(
      installFallowCommand("^3.15.0", resolved.pkgManager, resolved.addDev),
      "pixi add --dev fallow@^3.15.0",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("absent pkg-manager row keeps lockfile provenance", () => {
  const resolved = resolvePkgManager(ROOT, null);
  assert.equal(resolved.pkgManager, "pnpm");
  assert.equal(resolved.provenance, "lockfile");
});
