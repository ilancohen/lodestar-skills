import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ROOT } from "../scripts/lib.mjs";
import { compareCopy, detectCopies, migrate } from "../scripts/migrate_vendored.mjs";

const SOURCE_SKILL = path.join(ROOT, "skills", "ep-setup");

function makeTemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ep-migrate-"));
}

function copySkill(dest) {
  fs.mkdirSync(dest, { recursive: true });
  const walk = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const src = path.join(from, entry.name);
      const out = path.join(to, entry.name);
      if (entry.isDirectory()) walk(src, out);
      else fs.copyFileSync(src, out);
    }
  };
  walk(SOURCE_SKILL, dest);
}

test("detects known copies and ignores application source", () => {
  const tmp = makeTemp();
  copySkill(path.join(tmp, ".agents/skills/ep-setup"));
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src/app.ts"), "export const x = 1;\n");
  const copies = detectCopies(tmp);
  assert.equal(copies.length, 1);
  assert.ok(copies[0].endsWith(`${path.sep}ep-setup`));
  assert.equal(fs.readFileSync(path.join(tmp, "src/app.ts"), "utf8"), "export const x = 1;\n");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("clean copy is reported clean", () => {
  const tmp = makeTemp();
  const copyDir = path.join(tmp, ".agents/skills/ep-setup");
  copySkill(copyDir);
  const report = compareCopy(copyDir, SOURCE_SKILL, "0.1.0");
  assert.equal(report.clean, true);
  assert.deepEqual(report.modified, []);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("modified files are reported and not overwritten without --force", () => {
  const tmp = makeTemp();
  const copyDir = path.join(tmp, ".agents/skills/ep-setup");
  copySkill(copyDir);
  const skillPath = path.join(copyDir, "SKILL.md");
  fs.appendFileSync(skillPath, "\n# local edit\n");
  const dry = migrate({ target: tmp, source: ROOT, apply: false, check: false, force: false });
  assert.equal(dry.exitCode, 1);
  assert.ok(dry.copies[0].modified.includes("SKILL.md"));
  const blocked = migrate({ target: tmp, source: ROOT, apply: true, check: false, force: false });
  assert.equal(blocked.exitCode, 2);
  assert.ok(fs.readFileSync(skillPath, "utf8").includes("# local edit"));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("missing files are restored on apply", () => {
  const tmp = makeTemp();
  const copyDir = path.join(tmp, ".agents/skills/ep-setup");
  copySkill(copyDir);
  fs.rmSync(path.join(copyDir, "principles.md"));
  const before = compareCopy(copyDir, SOURCE_SKILL, "0.1.0");
  assert.ok(before.missing.includes("principles.md"));
  const applied = migrate({ target: tmp, source: ROOT, apply: true, check: false, force: false });
  assert.equal(applied.exitCode, 0);
  assert.ok(fs.existsSync(path.join(copyDir, "principles.md")));
  assert.ok(fs.existsSync(path.join(copyDir, ".ep-skills-source.json")));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("partial copies are detected", () => {
  const tmp = makeTemp();
  const copyDir = path.join(tmp, ".claude/skills/ep-audit");
  fs.mkdirSync(copyDir, { recursive: true });
  fs.writeFileSync(path.join(copyDir, "SKILL.md"), "# stub\n");
  const report = compareCopy(copyDir, path.join(ROOT, "skills/ep-audit"), "0.1.0");
  assert.equal(report.clean, false);
  assert.ok(report.missing.length > 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("already-migrated rerun is idempotent", () => {
  const tmp = makeTemp();
  const copyDir = path.join(tmp, ".agents/skills/ep-setup");
  copySkill(copyDir);
  const first = migrate({ target: tmp, source: ROOT, apply: true, check: false, force: false });
  assert.equal(first.exitCode, 0);
  const marker = JSON.parse(fs.readFileSync(path.join(copyDir, ".ep-skills-source.json"), "utf8"));
  assert.equal(marker.source_version, "0.1.0");
  assert.ok(marker.source_tag);
  const second = migrate({ target: tmp, source: ROOT, apply: true, check: false, force: false });
  assert.equal(second.exitCode, 0);
  assert.equal(
    fs.readFileSync(path.join(copyDir, ".ep-skills-source.json"), "utf8"),
    `${JSON.stringify(marker, null, 2)}\n`,
  );
  const check = migrate({ target: tmp, source: ROOT, apply: false, check: true, force: false });
  assert.equal(check.exitCode, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("dry-run fails when a migrated copy is missing files", () => {
  const tmp = makeTemp();
  const copyDir = path.join(tmp, ".agents/skills/ep-setup");
  copySkill(copyDir);
  assert.equal(
    migrate({ target: tmp, source: ROOT, apply: true, check: false, force: false }).exitCode,
    0,
  );
  fs.rmSync(path.join(copyDir, "principles.md"));
  const dry = migrate({ target: tmp, source: ROOT, apply: false, check: false, force: false });
  assert.equal(dry.exitCode, 1);
  assert.equal(dry.copies[0].already_migrated, false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("backups keep the parent path so two copies do not collide", () => {
  const tmp = makeTemp();
  const agents = path.join(tmp, ".agents/skills/ep-setup");
  const cursor = path.join(tmp, ".cursor/skills/ep-setup");
  copySkill(agents);
  copySkill(cursor);
  fs.appendFileSync(path.join(agents, "SKILL.md"), "\n# agents edit\n");
  fs.appendFileSync(path.join(cursor, "SKILL.md"), "\n# cursor edit\n");
  const result = migrate({
    target: tmp,
    source: ROOT,
    apply: true,
    check: false,
    force: true,
  });
  assert.equal(result.exitCode, 0);
  const backupRoot = path.join(tmp, ".ep-skills-backup");
  const backups = fs.readdirSync(backupRoot);
  assert.ok(backups.length >= 1);
  const agentsBackup = backups
    .map((stamp) => path.join(backupRoot, stamp, ".agents/skills/ep-setup/SKILL.md"))
    .find((file) => fs.existsSync(file));
  const cursorBackup = backups
    .map((stamp) => path.join(backupRoot, stamp, ".cursor/skills/ep-setup/SKILL.md"))
    .find((file) => fs.existsSync(file));
  assert.ok(agentsBackup);
  assert.ok(cursorBackup);
  assert.ok(fs.readFileSync(agentsBackup, "utf8").includes("# agents edit"));
  assert.ok(fs.readFileSync(cursorBackup, "utf8").includes("# cursor edit"));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("--check passes when the target has no vendored copies", () => {
  const tmp = makeTemp();
  const result = migrate({ target: tmp, source: ROOT, apply: false, check: true, force: false });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.copies, []);
  fs.rmSync(tmp, { recursive: true, force: true });
});
