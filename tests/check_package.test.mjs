import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ROOT } from "../scripts/lib.mjs";
import { checkPackage } from "../scripts/check_package.mjs";
import { setVersion } from "../scripts/set_version.mjs";

function copyRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ep-pkg-"));
  const walk = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (
        entry.name === ".git" ||
        entry.name === "node_modules" ||
        entry.name === ".cursor" ||
        entry.name === ".agents"
      ) {
        continue;
      }
      const src = path.join(from, entry.name);
      const out = path.join(to, entry.name);
      if (entry.isDirectory()) walk(src, out);
      else fs.copyFileSync(src, out);
    }
  };
  walk(ROOT, tmp);
  return tmp;
}

test("package checks pass against this repository", () => {
  const result = checkPackage(ROOT);
  assert.deepEqual(result.errors, []);
  assert.equal(result.version, "0.1.0");
  assert.equal(result.skillCount, 4);
});

test("set_version updates VERSION, manifests, and skill metadata", () => {
  const tmp = copyRepo();
  try {
    setVersion("0.1.1", tmp);
    assert.equal(fs.readFileSync(path.join(tmp, "VERSION"), "utf8").trim(), "0.1.1");
    const plugin = JSON.parse(fs.readFileSync(path.join(tmp, "plugin.json"), "utf8"));
    assert.equal(plugin.version, "0.1.1");
    const skill = fs.readFileSync(path.join(tmp, "skills/lodestar-audit/SKILL.md"), "utf8");
    assert.match(skill, /version:\s*"0.1.1"/);
    const result = checkPackage(tmp);
    assert.deepEqual(result.errors, []);
    assert.equal(result.version, "0.1.1");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("set_version rejects a non-semver value", () => {
  assert.throws(() => setVersion("v1", ROOT), /MAJOR\.MINOR\.PATCH/);
});
