import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// runtime.mjs lives once, in the base skill. Dependent skills reach it
// through their own scripts/setup-modules.mjs, so these tests cover the
// one copy plus the gateway's missing-base-skill message.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME_PATH = path.join(
  ROOT,
  "skills/lodestar-setup/scripts/runtime.mjs",
);

const EXPECTED_EXPORTS = [
  "fail",
  "parseArgs",
  "localBin",
  "atomicWrite",
  "tempDir",
  "utcDate",
  "printJson",
  "isMain",
  "posixPath",
  "capText",
  "spawnCaptureToTemp",
  "cleanupCapture",
  "sortedJson",
  "sortKeysDeep",
];

// Each gateway re-exports only what its own skill uses. This map documents that
// shape so an accidental addition or removal is caught here.
const GATEWAYS = [
  [
    "lodestar-audit",
    "skills/lodestar-audit/scripts/setup-modules.mjs",
    [
      "atomicWrite",
      "checkDocsLayoutDrift",
      "detectLinter",
      "detectPkgManager",
      "fail",
      "findFallowDeclaration",
      "inferProbeFromLintScript",
      "installDepsCommand",
      "installFallowCommand",
      "isMain",
      "listDeclaredMembers",
      "localBin",
      "parseArgs",
      "parsePkgManagerRow",
      "printJson",
      "readRootPackageJson",
      "resolvePkgManager",
      "tempDir",
      "utcDate",
    ],
  ],
  [
    "lodestar-fix",
    "skills/lodestar-fix/scripts/setup-modules.mjs",
    ["atomicWrite", "fail", "isMain", "parseArgs", "printJson"],
  ],
  [
    "lodestar-docs",
    "skills/lodestar-docs/scripts/setup-modules.mjs",
    [
      "DEFAULT_ARCHITECTURE_ROOT",
      "DEFAULT_OUTPUT_ROOT",
      "architectureOutputRoot",
      "isMain",
      "observeDocsLayout",
      "parseArgs",
      "parseDocsLayout",
    ],
  ],
  [
    "lodestar-plan",
    "skills/lodestar-plan/scripts/setup-modules.mjs",
    [
      "DEFAULT_PLANS_ROOT",
      "abandonedDir",
      "atomicWrite",
      "bootstrapPlansRoot",
      "discoverPlansState",
      "doneDir",
      "ensurePlansRoot",
      "fail",
      "isMain",
      "listAbandonedPlans",
      "listDonePlans",
      "listPendingPlans",
      "parseArgs",
      "printJson",
      "resolvePlansRoot",
      "run",
    ],
  ],
  [
    "lodestar-implement",
    "skills/lodestar-implement/scripts/setup-modules.mjs",
    [
      "DEFAULT_PLANS_ROOT",
      "abandonedDir",
      "atomicWrite",
      "discoverPlansState",
      "doneDir",
      "fail",
      "isMain",
      "listAbandonedPlans",
      "listDonePlans",
      "listPendingPlans",
      "parseArgs",
      "printJson",
      "resolvePlansRoot",
    ],
  ],
];

const runtime = await import(pathToFileURL(RUNTIME_PATH).href);

function evalModule(modulePath, source) {
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import * as m from ${JSON.stringify(pathToFileURL(modulePath).href)};\n${source}`,
    ],
    { encoding: "utf8" },
  );
}

test("runtime: exports exactly the expected function set", () => {
  assert.deepEqual(Object.keys(runtime).sort(), [...EXPECTED_EXPORTS].sort());
});

test("runtime: parseArgs collects flags, repeats, and positionals", () => {
  const { flags, positionals } = runtime.parseArgs([
    "list",
    "--run-dir",
    "/tmp/foo",
    "--tag",
    "a",
    "--tag",
    "b",
    "--verbose",
  ]);
  assert.deepEqual(positionals, ["list"]);
  assert.equal(flags["run-dir"], "/tmp/foo");
  assert.deepEqual(flags.tag, ["a", "b"]);
  assert.equal(flags.verbose, true);
});

test("runtime: parseArgs treats a trailing flag with no value as boolean", () => {
  const { flags } = runtime.parseArgs(["--force"]);
  assert.equal(flags.force, true);
});

test("runtime: atomicWrite creates parent dirs, replaces existing content, and leaves no temp file", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-runtime-"));
  try {
    const target = path.join(tmp, "nested", "dir", "file.txt");
    runtime.atomicWrite(target, "first\n");
    assert.equal(fs.readFileSync(target, "utf8"), "first\n");
    runtime.atomicWrite(target, "second\n");
    assert.equal(fs.readFileSync(target, "utf8"), "second\n");
    assert.deepEqual(fs.readdirSync(path.dirname(target)), ["file.txt"]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("runtime: localBin finds a pinned node_modules/.bin entry and returns null otherwise", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-runtime-"));
  try {
    const binDir = path.join(tmp, "node_modules", ".bin");
    fs.mkdirSync(binDir, { recursive: true });
    const shim = path.join(binDir, "made-up-tool");
    fs.writeFileSync(shim, "#!/bin/sh\n");
    assert.equal(runtime.localBin("made-up-tool", tmp, "darwin"), shim);
    assert.equal(runtime.localBin("missing-tool", tmp, "darwin"), null);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("runtime: resolves binaries from node_modules/.bin only, never PATH", () => {
  assert.doesNotMatch(
    fs.readFileSync(RUNTIME_PATH, "utf8"),
    /process\.env\.(PATH|PATHEXT)/,
  );
});

test("runtime: tempDir returns a fresh directory under the OS temp root", () => {
  const dir = runtime.tempDir("lodestar-runtime-check-");
  try {
    assert.equal(path.dirname(dir), os.tmpdir());
    assert.ok(fs.statSync(dir).isDirectory());
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("runtime: utcDate formats a fixed date as YYYY-MM-DD", () => {
  assert.equal(
    runtime.utcDate(new Date("2026-01-05T23:59:59Z")),
    "2026-01-05",
  );
  assert.match(runtime.utcDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test("runtime: isMain is false when this test process is the entry point", () => {
  assert.equal(runtime.isMain(pathToFileURL(RUNTIME_PATH).href), false);
});

test("runtime: printJson writes pretty-printed JSON to stdout", () => {
  const result = evalModule(RUNTIME_PATH, `m.printJson({ a: 1, b: [2, 3] });`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { a: 1, b: [2, 3] });
  assert.match(result.stdout, /\n {2}"a": 1/);
});

test("runtime: fail writes \"ERROR: <message>\" to stderr and exits with the given code", () => {
  const result = evalModule(RUNTIME_PATH, `m.fail("boom", 3);`);
  assert.equal(result.status, 3);
  assert.equal(result.stderr, "ERROR: boom\n");
});

test("runtime: fail defaults to exit code 1", () => {
  const result = evalModule(RUNTIME_PATH, `m.fail("boom");`);
  assert.equal(result.status, 1);
});

for (const [skill, relative, expectedExports] of GATEWAYS) {
  const gatewayPath = path.join(ROOT, relative);
  const gateway = await import(pathToFileURL(gatewayPath).href);

  test(`${skill}: setup-modules re-exports exactly what the skill uses`, () => {
    assert.deepEqual(Object.keys(gateway).sort(), [...expectedExports].sort());
  });

  test(`${skill}: setup-modules re-exports the base skill's own bindings`, async () => {
    for (const name of expectedExports) {
      assert.ok(gateway[name] !== undefined, `${name} is undefined`);
    }
    if ("parseArgs" in gateway) {
      assert.equal(gateway.parseArgs, runtime.parseArgs);
    }
  });

  test(`${skill}: setup-modules names the missing base skill instead of throwing ERR_MODULE_NOT_FOUND`, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-partial-"));
    try {
      const isolated = path.join(tmp, "skills", skill);
      fs.mkdirSync(path.dirname(isolated), { recursive: true });
      fs.cpSync(path.join(ROOT, "skills", skill), isolated, {
        recursive: true,
      });
      const result = spawnSync(
        process.execPath,
        [path.join(isolated, "scripts", path.basename(relative))],
        { encoding: "utf8" },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /requires the lodestar-setup skill/);
      assert.match(result.stderr, /Reinstall lodestar-setup/);
      assert.match(result.stderr, /npx skills add/);
      assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
}
