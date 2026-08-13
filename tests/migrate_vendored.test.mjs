import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ROOT, SKILLS } from "../scripts/lib.mjs";
import {
  compareCopy,
  detectCopies,
  migrate,
} from "../scripts/migrate_vendored.mjs";

const SOURCE_SETUP = path.join(ROOT, "skills", "lodestar-setup");

function makeTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-migrate-"));
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const out = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, out);
    else fs.copyFileSync(src, out);
  }
}

function writeLegacyStub(dest, name = "ep-setup") {
  const dir = path.join(dest, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    `---\nname: ${name}\nlicense: MIT\nmetadata:\n  version: "0.0.1"\n---\n\n# stub\n`,
  );
  return dir;
}

test("clean Lodestar tree is reported clean", () => {
  const tmp = makeTemp();
  const copyDir = path.join(tmp, ".agents/skills/lodestar-setup");
  copyTree(SOURCE_SETUP, copyDir);
  const report = compareCopy(
    { path: copyDir, dirName: "lodestar-setup", skill: "lodestar-setup", legacy: false },
    ROOT,
    "0.1.0",
  );
  assert.equal(report.clean, true);
  assert.equal(report.legacy, false);
  assert.deepEqual(report.modified, []);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("legacy ep-* tree is detected and maps to Lodestar IDs", () => {
  const tmp = makeTemp();
  writeLegacyStub(path.join(tmp, ".agents/skills"), "ep-setup");
  writeLegacyStub(path.join(tmp, ".agents/skills"), "ep-audit");
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src/app.ts"), "export const x = 1;\n");
  const copies = detectCopies(tmp);
  assert.equal(copies.length, 2);
  assert.deepEqual(
    copies.map((c) => [c.dirName, c.skill, c.legacy]).sort(),
    [
      ["ep-audit", "lodestar-audit", true],
      ["ep-setup", "lodestar-setup", true],
    ],
  );
  assert.equal(fs.readFileSync(path.join(tmp, "src/app.ts"), "utf8"), "export const x = 1;\n");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("mixed tree reports both legacy and Lodestar copies", () => {
  const tmp = makeTemp();
  writeLegacyStub(path.join(tmp, ".agents/skills"), "ep-fix");
  copyTree(SOURCE_SETUP, path.join(tmp, ".cursor/skills/lodestar-setup"));
  const copies = detectCopies(tmp);
  assert.equal(copies.length, 2);
  const byDir = Object.fromEntries(copies.map((c) => [c.dirName, c]));
  assert.equal(byDir["ep-fix"].skill, "lodestar-fix");
  assert.equal(byDir["ep-fix"].legacy, true);
  assert.equal(byDir["lodestar-setup"].legacy, false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("legacy apply renames ep-* to lodestar-* and writes marker", () => {
  const tmp = makeTemp();
  const legacy = writeLegacyStub(path.join(tmp, ".agents/skills"), "ep-setup");
  const applied = migrate({
    target: tmp,
    source: ROOT,
    apply: true,
    check: false,
    force: true,
  });
  assert.equal(applied.exitCode, 0);
  assert.equal(fs.existsSync(legacy), false);
  const dest = path.join(tmp, ".agents/skills/lodestar-setup");
  assert.ok(fs.existsSync(path.join(dest, "SKILL.md")));
  assert.ok(fs.existsSync(path.join(dest, ".lodestar-source.json")));
  const marker = JSON.parse(
    fs.readFileSync(path.join(dest, ".lodestar-source.json"), "utf8"),
  );
  assert.equal(marker.source_version, "0.1.0");
  assert.ok(fs.existsSync(path.join(tmp, ".lodestar-backup")));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("already-migrated Lodestar rerun is idempotent", () => {
  const tmp = makeTemp();
  const copyDir = path.join(tmp, ".agents/skills/lodestar-setup");
  copyTree(SOURCE_SETUP, copyDir);
  const first = migrate({
    target: tmp,
    source: ROOT,
    apply: true,
    check: false,
    force: false,
  });
  assert.equal(first.exitCode, 0);
  const markerPath = path.join(copyDir, ".lodestar-source.json");
  const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
  const second = migrate({
    target: tmp,
    source: ROOT,
    apply: true,
    check: false,
    force: false,
  });
  assert.equal(second.exitCode, 0);
  assert.equal(
    fs.readFileSync(markerPath, "utf8"),
    `${JSON.stringify(marker, null, 2)}\n`,
  );
  const check = migrate({
    target: tmp,
    source: ROOT,
    apply: false,
    check: true,
    force: false,
  });
  assert.equal(check.exitCode, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("modified files are not overwritten without --force", () => {
  const tmp = makeTemp();
  const copyDir = path.join(tmp, ".agents/skills/lodestar-setup");
  copyTree(SOURCE_SETUP, copyDir);
  fs.appendFileSync(path.join(copyDir, "SKILL.md"), "\n# local edit\n");
  const dry = migrate({
    target: tmp,
    source: ROOT,
    apply: false,
    check: false,
    force: false,
  });
  assert.equal(dry.exitCode, 1);
  assert.ok(dry.copies[0].modified.includes("SKILL.md"));
  const blocked = migrate({
    target: tmp,
    source: ROOT,
    apply: true,
    check: false,
    force: false,
  });
  assert.equal(blocked.exitCode, 2);
  assert.ok(
    fs.readFileSync(path.join(copyDir, "SKILL.md"), "utf8").includes("# local edit"),
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("--check passes when the target has no vendored copies", () => {
  const tmp = makeTemp();
  const result = migrate({
    target: tmp,
    source: ROOT,
    apply: false,
    check: true,
    force: false,
  });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.copies, []);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("canonical skill list remains the four Lodestar IDs", () => {
  assert.deepEqual([...SKILLS].sort(), [
    "lodestar-architecture",
    "lodestar-audit",
    "lodestar-fix",
    "lodestar-setup",
  ]);
});

test("same-parent legacy+Lodestar --force backs up the Lodestar dest", () => {
  const tmp = makeTemp();
  writeLegacyStub(path.join(tmp, ".agents/skills"), "ep-setup");
  const dest = path.join(tmp, ".agents/skills/lodestar-setup");
  copyTree(SOURCE_SETUP, dest);
  fs.writeFileSync(path.join(dest, "local-only.md"), "# keep me\n");
  fs.appendFileSync(path.join(dest, "SKILL.md"), "\n# lodestar local edit\n");
  const result = migrate({
    target: tmp,
    source: ROOT,
    apply: true,
    check: false,
    force: true,
  });
  assert.equal(result.exitCode, 0);
  assert.equal(fs.existsSync(path.join(tmp, ".agents/skills/ep-setup")), false);
  assert.ok(fs.existsSync(path.join(dest, "SKILL.md")));
  assert.ok(fs.existsSync(path.join(dest, ".lodestar-source.json")));
  const backupRoot = path.join(tmp, ".lodestar-backup");
  const stamps = fs.readdirSync(backupRoot);
  const precious = stamps
    .map((stamp) => path.join(backupRoot, stamp, ".agents/skills/lodestar-setup/local-only.md"))
    .find((file) => fs.existsSync(file));
  assert.ok(precious, "expected lodestar dest backup with local-only.md");
  assert.equal(fs.readFileSync(precious, "utf8"), "# keep me\n");
  fs.rmSync(tmp, { recursive: true, force: true });
});
