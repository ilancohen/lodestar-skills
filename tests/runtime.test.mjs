import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

// runtime.mjs is deliberately vendored once per skill (lodestar-audit,
// lodestar-fix, lodestar-setup) so each skill stays a self-contained,
// portable install. Only the audit copy used to be directly tested — this
// file exercises every copy's exported behavior and guards against the
// sibling copies silently drifting apart.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Each skill only vendors the exports it actually uses: lodestar-audit needs
// utcDate (fallow-contract's compat-record writer) and atomicWrite;
// lodestar-fix needs atomicWrite (action-state) but not utcDate;
// lodestar-setup needs neither. This map documents that shape so an
// accidental addition/removal is caught here instead of silently drifting.
const MODULES = [
  [
    "lodestar-audit",
    "skills/lodestar-audit/scripts/runtime.mjs",
    [
      "fail",
      "parseArgs",
      "localBin",
      "which",
      "atomicWrite",
      "tempDir",
      "utcDate",
      "printJson",
      "isMain",
    ],
  ],
  [
    "lodestar-fix",
    "skills/lodestar-fix/scripts/runtime.mjs",
    [
      "fail",
      "parseArgs",
      "atomicWrite",
      "localBin",
      "which",
      "tempDir",
      "printJson",
      "isMain",
    ],
  ],
  [
    "lodestar-setup",
    "skills/lodestar-setup/scripts/runtime.mjs",
    [
      "fail",
      "parseArgs",
      "localBin",
      "which",
      "tempDir",
      "printJson",
      "isMain",
    ],
  ],
];

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

for (const [skill, relative, expectedExports] of MODULES) {
  const modulePath = path.join(ROOT, relative);
  const runtime = await import(pathToFileURL(modulePath).href);

  test(`${skill}/runtime: exports exactly the expected function set`, () => {
    assert.deepEqual(Object.keys(runtime).sort(), [...expectedExports].sort());
  });

  test(`${skill}/runtime: parseArgs collects flags, repeats, and positionals`, () => {
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

  test(`${skill}/runtime: parseArgs treats a trailing flag with no value as boolean`, () => {
    const { flags } = runtime.parseArgs(["--force"]);
    assert.equal(flags.force, true);
  });

  if (expectedExports.includes("atomicWrite")) {
    test(`${skill}/runtime: atomicWrite creates parent dirs, replaces existing content, and leaves no temp file`, () => {
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
  }

  test(`${skill}/runtime: localBin finds a pinned node_modules/.bin entry and returns null otherwise`, () => {
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

  test(`${skill}/runtime: which prefers a pinned local bin over PATH and fails closed`, () => {
    assert.ok(runtime.which("node", ROOT));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-runtime-"));
    try {
      const binDir = path.join(tmp, "node_modules", ".bin");
      fs.mkdirSync(binDir, { recursive: true });
      const pinned = path.join(binDir, "made-up-tool-lodestar");
      fs.writeFileSync(pinned, "#!/bin/sh\n");
      fs.chmodSync(pinned, 0o755);
      assert.equal(runtime.which("made-up-tool-lodestar", tmp), pinned);
      assert.equal(
        runtime.which("definitely-not-a-real-binary-xyz", tmp),
        null,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test(`${skill}/runtime: tempDir returns a fresh directory under the OS temp root`, () => {
    const dir = runtime.tempDir("lodestar-runtime-check-");
    try {
      assert.equal(path.dirname(dir), os.tmpdir());
      assert.ok(fs.statSync(dir).isDirectory());
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test(`${skill}/runtime: isMain is false when this test process is the entry point`, () => {
    assert.equal(runtime.isMain(pathToFileURL(modulePath).href), false);
  });

  test(`${skill}/runtime: printJson writes pretty-printed JSON to stdout`, () => {
    const result = evalModule(modulePath, `m.printJson({ a: 1, b: [2, 3] });`);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { a: 1, b: [2, 3] });
    assert.match(result.stdout, /\n {2}"a": 1/);
  });

  test(`${skill}/runtime: fail writes "ERROR: <message>" to stderr and exits with the given code`, () => {
    const result = evalModule(modulePath, `m.fail("boom", 3);`);
    assert.equal(result.status, 3);
    assert.equal(result.stderr, "ERROR: boom\n");
  });

  test(`${skill}/runtime: fail defaults to exit code 1`, () => {
    const result = evalModule(modulePath, `m.fail("boom");`);
    assert.equal(result.status, 1);
  });
}

test("lodestar-audit/runtime: utcDate formats a fixed date as YYYY-MM-DD", async () => {
  const { utcDate } = await import(
    pathToFileURL(path.join(ROOT, "skills/lodestar-audit/scripts/runtime.mjs"))
      .href
  );
  assert.equal(utcDate(new Date("2026-01-05T23:59:59Z")), "2026-01-05");
  assert.match(utcDate(), /^\d{4}-\d{2}-\d{2}$/);
});

test("lodestar-fix and lodestar-setup runtime.mjs export the same function bodies as lodestar-audit's copy, wherever they overlap", async () => {
  // Compare by function source (via .toString()), not raw file text, since
  // the sibling copies declare shared functions in a different order and
  // each vendors only the subset of functions it actually uses.
  const modules = await Promise.all(
    MODULES.map(async ([skill, relative]) => [
      skill,
      await import(pathToFileURL(path.join(ROOT, relative)).href),
    ]),
  );
  const [, audit] = modules[0];
  for (const [skill, runtime] of modules.slice(1)) {
    for (const name of Object.keys(runtime)) {
      if (!(name in audit)) continue;
      assert.equal(
        runtime[name].toString(),
        audit[name].toString(),
        `${skill}/runtime.mjs's ${name} has drifted from the lodestar-audit copy`,
      );
    }
  }
});
