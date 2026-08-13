import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { scan } from "../skills/ep-audit/scripts/source-scan.mjs";
import {
  localBin,
  tempDir,
  which,
} from "../skills/ep-audit/scripts/runtime.mjs";
import { resolveBin } from "../skills/ep-setup/scripts/resolve-bin.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ACTION = path.join(ROOT, "skills/ep-fix/scripts/action-state.mjs");
const FIX_READY = path.join(
  ROOT,
  "tests/fixtures/audit-runs/fix-ready",
);

function run(script, args, cwd = ROOT) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
  });
}

test("source-scan finds explicit any and ignores tests", () => {
  const tmp = tempDir("ep-scan-");
  try {
    fs.mkdirSync(path.join(tmp, "src"));
    fs.writeFileSync(
      path.join(tmp, "src", "a.ts"),
      "export function f(): any { return 1 }\n",
    );
    fs.writeFileSync(
      path.join(tmp, "src", "a.test.ts"),
      "export function f(): any { return 1 }\n",
    );
    const result = scan(["--recipe", "explicit-any", "--root", tmp]);
    assert.equal(result.count, 1);
    assert.match(result.hits[0].file, /a\.ts$/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("source-scan handles paths with spaces and CRLF", () => {
  const parent = tempDir("ep-scan-");
  const tmp = path.join(parent, "my repo");
  try {
    fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "src", "a.ts"),
      "export const x: any = 1\r\nexport const y = 2\r\n",
    );
    const result = scan(["--recipe", "explicit-any", "--root", tmp]);
    assert.equal(result.count, 1);
    assert.equal(result.hits[0].line, 1);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("action-state lists items and move-done is atomic", () => {
  const tmp = tempDir("ep-fix-");
  try {
    const runDir = path.join(tmp, "2026-08-10");
    fs.cpSync(FIX_READY, runDir, { recursive: true });
    const listed = run(ACTION, ["list", "--run-dir", runDir]);
    assert.equal(listed.status, 0, listed.stderr);
    const payload = JSON.parse(listed.stdout);
    assert.equal(payload.items.length, 3);
    const file = payload.items[0].file;
    const moved = run(ACTION, [
      "move-done",
      "--file",
      file,
      "--run-dir",
      runDir,
    ]);
    assert.equal(moved.status, 0, moved.stderr);
    assert.equal(fs.existsSync(file), false);
    assert.ok(fs.existsSync(path.join(runDir, "done", path.basename(file))));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("action-state set-status writes frontmatter", () => {
  const tmp = tempDir("ep-fix-");
  try {
    const runDir = path.join(tmp, "2026-08-10");
    fs.cpSync(FIX_READY, runDir, { recursive: true });
    const file = path.join(runDir, "001-imports-cross-package.md");
    const result = run(ACTION, [
      "set-status",
      "--file",
      file,
      "--status",
      "in_progress",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(fs.readFileSync(file, "utf8"), /^status: in_progress$/m);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("resolve-bin finds node and fails closed on missing bins", () => {
  const nodeBin = resolveBin("node", ROOT);
  assert.ok(nodeBin);
  assert.ok(which("node", ROOT));
  const missing = run(
    path.join(ROOT, "skills/ep-setup/scripts/resolve-bin.mjs"),
    ["definitely-not-a-bin-ep-skills", "--root", ROOT],
  );
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /definitely-not-a-bin-ep-skills/);
});

test("tempDir uses the platform temporary directory", () => {
  const dir = tempDir("ep-tmp-");
  try {
    assert.equal(path.dirname(dir), os.tmpdir());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("localBin prefers .cmd over the POSIX shim on Windows", () => {
  const tmp = tempDir("ep-bin-");
  try {
    const binDir = path.join(tmp, "node_modules", ".bin");
    fs.mkdirSync(binDir, { recursive: true });
    const shim = path.join(binDir, "fallow");
    const cmd = path.join(binDir, "fallow.cmd");
    fs.writeFileSync(shim, "#!/bin/sh\n");
    fs.writeFileSync(cmd, "@echo off\n");
    assert.equal(localBin("fallow", tmp, "win32"), cmd);
    assert.equal(localBin("fallow", tmp, "darwin"), shim);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
