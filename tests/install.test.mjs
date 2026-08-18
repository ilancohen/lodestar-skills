import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { INSTALL_SPEC, ROOT, SKILLS } from "../scripts/lib.mjs";
import {
  buildSkillsAddArgs,
  defaultSelection,
  detectAgents,
  parseInstallArgs,
  resolveSelection,
  resolveSource,
} from "../scripts/detect-agents.mjs";
import { runInstall } from "../scripts/install.mjs";

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function emptyEnv() {
  return {};
}

test("cwd marker detects cursor", () => {
  const cwd = tempDir("lodestar-install-cwd-");
  const home = tempDir("lodestar-install-home-");
  try {
    fs.mkdirSync(path.join(cwd, ".cursor"));
    assert.deepEqual(detectAgents({ cwd, home, env: emptyEnv() }), ["cursor"]);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("env-only detection", () => {
  const cwd = tempDir("lodestar-install-cwd-");
  const home = tempDir("lodestar-install-home-");
  try {
    assert.deepEqual(
      detectAgents({
        cwd,
        home,
        env: { CLAUDECODE: "1" },
      }),
      ["claude-code"],
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("home-only detection", () => {
  const cwd = tempDir("lodestar-install-cwd-");
  const home = tempDir("lodestar-install-home-");
  try {
    fs.mkdirSync(path.join(home, ".codex"));
    assert.deepEqual(detectAgents({ cwd, home, env: emptyEnv() }), ["codex"]);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("union of cwd, home, and env", () => {
  const cwd = tempDir("lodestar-install-cwd-");
  const home = tempDir("lodestar-install-home-");
  try {
    fs.mkdirSync(path.join(cwd, ".claude"));
    fs.mkdirSync(path.join(home, ".cursor"));
    assert.deepEqual(
      detectAgents({
        cwd,
        home,
        env: { GEMINI_CLI: "1" },
      }),
      ["cursor", "claude-code", "gemini-cli"],
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("defaultSelection pre-selects all four skills", () => {
  const cwd = tempDir("lodestar-install-cwd-");
  const home = tempDir("lodestar-install-home-");
  try {
    const selection = defaultSelection({ cwd, home, env: emptyEnv() });
    assert.deepEqual(selection.skills, [
      "lodestar-setup",
      "lodestar-audit",
      "lodestar-fix",
      "lodestar-architecture",
    ]);
    assert.equal(selection.skills.length, 4);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("defaultSelection falls back to cursor when nothing is detected", () => {
  const cwd = tempDir("lodestar-install-cwd-");
  const home = tempDir("lodestar-install-home-");
  try {
    const selection = defaultSelection({ cwd, home, env: emptyEnv() });
    assert.deepEqual(selection.agents, ["cursor"]);
    assert.deepEqual(selection.skills, [...SKILLS]);
    assert.equal(selection.global, false);
    assert.deepEqual(selection.detected, []);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("-y argv uses defaults", () => {
  const cwd = tempDir("lodestar-install-cwd-");
  const home = tempDir("lodestar-install-home-");
  try {
    fs.mkdirSync(path.join(cwd, ".kiro"));
    const args = parseInstallArgs(["-y"]);
    const selection = resolveSelection(args, { cwd, home, env: emptyEnv() });
    assert.equal(args.yes, true);
    assert.deepEqual(selection.agents, ["kiro-cli"]);
    assert.deepEqual(selection.skills, [...SKILLS]);
    assert.deepEqual(
      buildSkillsAddArgs({
        source: ".",
        ...selection,
      }),
      ["add", ".", "--skill", ...SKILLS, "-a", "kiro-cli", "universal", "-y"],
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("--agent and --skill override defaults", () => {
  const args = parseInstallArgs([
    "-y",
    "--agent",
    "claude-code",
    "--skill",
    "lodestar-setup",
    "lodestar-audit",
  ]);
  const cwd = tempDir("lodestar-install-cwd-");
  const home = tempDir("lodestar-install-home-");
  try {
    fs.mkdirSync(path.join(cwd, ".cursor"));
    const selection = resolveSelection(args, { cwd, home, env: emptyEnv() });
    assert.deepEqual(selection.agents, ["claude-code"]);
    assert.deepEqual(selection.skills, ["lodestar-setup", "lodestar-audit"]);
    assert.deepEqual(
      buildSkillsAddArgs({ source: INSTALL_SPEC, ...selection, copy: true }),
      [
        "add",
        INSTALL_SPEC,
        "--skill",
        "lodestar-setup",
        "lodestar-audit",
        "-a",
        "claude-code",
        "universal",
        "-y",
        "--copy",
      ],
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("empty selection is rejected", () => {
  assert.throws(() => parseInstallArgs(["--agent"]), /at least one agent/);
  assert.throws(() => parseInstallArgs(["--skill"]), /at least one skill/);
  assert.throws(
    () =>
      resolveSelection({
        agents: [],
        skills: [...SKILLS],
        global: false,
        copy: false,
      }),
    /at least one agent/,
  );
  assert.throws(
    () =>
      resolveSelection({
        agents: ["cursor"],
        skills: [],
        global: false,
        copy: false,
      }),
    /at least one skill/,
  );
});

test("resolveSource is . inside this package and the install spec elsewhere", () => {
  assert.equal(resolveSource(ROOT), ".");
  const cwd = tempDir("lodestar-install-cwd-");
  try {
    assert.equal(resolveSource(cwd), INSTALL_SPEC);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("runInstall -y does not need a TTY", async () => {
  const cwd = tempDir("lodestar-install-cwd-");
  const home = tempDir("lodestar-install-home-");
  try {
    fs.mkdirSync(path.join(cwd, ".cursor"));
    const calls = [];
    const code = await runInstall(["-y", "--copy"], {
      cwd,
      home,
      env: emptyEnv(),
      stdinIsTTY: false,
      runSkillsCli(cliArgs, runCwd) {
        calls.push({ cliArgs, runCwd });
        return { status: 0, stdout: "ok\n", stderr: "" };
      },
    });
    assert.equal(code, 0);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].cliArgs, [
      "add",
      INSTALL_SPEC,
      "--skill",
      ...SKILLS,
      "-a",
      "cursor",
      "universal",
      "-y",
      "--copy",
    ]);
    assert.equal(calls[0].runCwd, cwd);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});
