import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SKILLS } from "../scripts/lib.mjs";
import { assertInstalled, installedSkills } from "../scripts/smoke_install.mjs";

// The full smokeInstall() flow (git clone + `pnpm dlx skills add` x3) is
// already exercised end-to-end by .github/workflows/release.yml's
// "Clean-checkout smoke" step. These tests cover the validation logic it
// relies on — installedSkills/assertInstalled — without the network access
// and multi-second git/pnpm round trips that flow requires.

function makeConsumer() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-smoke-unit-"));
}

function writeSkill(consumer, parent, skill, version) {
  const dir = path.join(consumer, parent, skill);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "SKILL.md"),
    `---\nname: ${skill}\nmetadata:\n  version: "${version}"\n---\nBody\n`,
  );
}

test("installedSkills finds nothing under an empty consumer", () => {
  const consumer = makeConsumer();
  try {
    assert.deepEqual(installedSkills(consumer), []);
  } finally {
    fs.rmSync(consumer, { recursive: true, force: true });
  }
});

test("installedSkills discovers skills across multiple agent parents", () => {
  const consumer = makeConsumer();
  try {
    for (const skill of SKILLS)
      writeSkill(consumer, ".cursor/skills", skill, "0.1.0");
    const found = installedSkills(consumer);
    assert.equal(found.length, SKILLS.length);
    assert.deepEqual(
      found.map((item) => item.skill).sort(),
      [...SKILLS].sort(),
    );
    for (const item of found) assert.equal(item.parent, ".cursor/skills");
  } finally {
    fs.rmSync(consumer, { recursive: true, force: true });
  }
});

test("assertInstalled passes when all four skills are present at the expected version", () => {
  const consumer = makeConsumer();
  try {
    for (const skill of SKILLS)
      writeSkill(consumer, ".agents/skills", skill, "0.2.0");
    const names = assertInstalled(consumer, "0.2.0");
    assert.deepEqual(names, [...SKILLS].sort());
  } finally {
    fs.rmSync(consumer, { recursive: true, force: true });
  }
});

test("assertInstalled throws when a skill is missing", () => {
  const consumer = makeConsumer();
  try {
    for (const skill of SKILLS.slice(1))
      writeSkill(consumer, ".agents/skills", skill, "0.2.0");
    assert.throws(
      () => assertInstalled(consumer, "0.2.0"),
      /expected four installed skills/,
    );
  } finally {
    fs.rmSync(consumer, { recursive: true, force: true });
  }
});

test("assertInstalled throws when an installed skill is the wrong version", () => {
  const consumer = makeConsumer();
  try {
    for (const skill of SKILLS)
      writeSkill(consumer, ".agents/skills", skill, "0.1.0");
    assert.throws(
      () => assertInstalled(consumer, "0.2.0"),
      /is not version 0\.2\.0/,
    );
  } finally {
    fs.rmSync(consumer, { recursive: true, force: true });
  }
});

test("assertInstalled dedupes a skill installed under two agent parents", () => {
  const consumer = makeConsumer();
  try {
    for (const skill of SKILLS) {
      writeSkill(consumer, ".agents/skills", skill, "0.3.0");
      writeSkill(consumer, ".cursor/skills", skill, "0.3.0");
    }
    const names = assertInstalled(consumer, "0.3.0");
    assert.deepEqual(names, [...SKILLS].sort());
  } finally {
    fs.rmSync(consumer, { recursive: true, force: true });
  }
});
