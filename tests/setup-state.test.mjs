import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  MAX_FAILURE_BYTES,
  MAX_STDOUT_BYTES,
  STATE_VERSION,
  collectState,
  mergeContext,
  projectReview,
  renderContext,
} from "../skills/lodestar-setup/scripts/setup-state.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "skills/lodestar-setup/scripts/setup-state.mjs");
const SETUP_SKILL = path.join(ROOT, "skills/lodestar-setup");

function run(args, cwd = ROOT) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function makeRepo(prefix, files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  for (const [relative, contents] of Object.entries(files)) {
    const full = path.join(dir, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return dir;
}

function writeSkillsTree(base, names) {
  for (const name of names) {
    const skill = path.join(base, name);
    fs.mkdirSync(skill, { recursive: true });
    fs.writeFileSync(path.join(skill, "SKILL.md"), `# ${name}\n`);
  }
}

test("collect writes full state and bounded projection", () => {
  const repo = makeRepo("lodestar-setup-state-", {
    "package.json": JSON.stringify({
      name: "tiny",
      scripts: { test: 'node -e "console.log(1)"' },
    }),
    "pnpm-lock.yaml": "lockfileVersion: 9\n",
    "src/index.ts": "export const ok = true;\n",
  });
  const out = path.join(os.tmpdir(), `setup-state-${process.pid}.json`);
  try {
    const result = run([
      "collect",
      "--root",
      repo,
      "--out",
      out,
      "--skill-dir",
      SETUP_SKILL,
    ]);
    assert.equal(result.status, 0, result.stderr);
    const state = JSON.parse(fs.readFileSync(out, "utf8"));
    assert.equal(state.stateVersion, STATE_VERSION);
    assert.equal(state.pkgManager.pkgManager, "pnpm");
    assert.ok(state.layout.packages.length >= 1);
    const projection = JSON.parse(result.stdout);
    assert.equal(projection.stateVersion, STATE_VERSION);
    assert.ok(Buffer.byteLength(result.stdout, "utf8") <= MAX_STDOUT_BYTES);
    assert.ok(!/"fallow"\s*:/.test(result.stdout) || projection.hasAudit);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(out, { force: true });
  }
});

test("large package list caps projection but full state retains all", () => {
  const files = {
    "package.json": JSON.stringify({
      name: "mono",
      private: true,
      workspaces: ["packages/*"],
    }),
    "pnpm-lock.yaml": "lockfileVersion: 9\n",
    "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
  };
  for (let i = 0; i < 25; i += 1) {
    files[`packages/pkg${String(i).padStart(2, "0")}/package.json`] =
      JSON.stringify({ name: `@repo/pkg${i}` });
    files[`packages/pkg${String(i).padStart(2, "0")}/src/index.ts`] =
      "export {};\n";
  }
  const repo = makeRepo("lodestar-setup-many-", files);
  const out = path.join(os.tmpdir(), `setup-state-many-${process.pid}.json`);
  try {
    const result = run([
      "collect",
      "--root",
      repo,
      "--out",
      out,
      "--skill-dir",
      SETUP_SKILL,
    ]);
    assert.equal(result.status, 0, result.stderr);
    const state = JSON.parse(fs.readFileSync(out, "utf8"));
    assert.ok(state.layout.packages.length >= 25);
    const projection = JSON.parse(result.stdout);
    assert.equal(projection.layout.packages.length, 20);
    assert.equal(projection.layout.packagesTotal, state.layout.packages.length);
    assert.equal(projection.layout.packagesTruncated, true);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(out, { force: true });
  }
});

test("ambiguous lockfiles yield needsInput and do not guess", () => {
  const repo = makeRepo("lodestar-setup-ambig-", {
    "package.json": JSON.stringify({ name: "ambig" }),
    "pnpm-lock.yaml": "lockfileVersion: 9\n",
    "yarn.lock": "# yarn\n",
    "src/index.ts": "export {};\n",
  });
  const out = path.join(os.tmpdir(), `setup-state-ambig-${process.pid}.json`);
  try {
    const result = run([
      "collect",
      "--root",
      repo,
      "--out",
      out,
      "--skill-dir",
      SETUP_SKILL,
    ]);
    assert.equal(result.status, 0, result.stderr);
    const projection = JSON.parse(result.stdout);
    assert.equal(projection.pkgManager.pkgManager, null);
    assert.equal(projection.pkgManager.ambiguous, true);
    assert.ok(projection.needsInput.some((item) => item.id === "pkg-manager"));
    const state = JSON.parse(fs.readFileSync(out, "utf8"));
    assert.equal(state.commands.install, "n/a");
    assert.equal(state.commands.test, "n/a");
    assert.doesNotMatch(state.commands.test || "", /npm/);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(out, { force: true });
  }
});

test("base-only sibling set does not attempt fallow", () => {
  const tree = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-skills-tree-"));
  const repo = makeRepo("lodestar-setup-base-", {
    "package.json": JSON.stringify({ name: "base" }),
    "pnpm-lock.yaml": "lockfileVersion: 9\n",
    "src/index.ts": "export {};\n",
  });
  writeSkillsTree(tree, ["lodestar-setup", "lodestar-architecture"]);
  const skillDir = path.join(tree, "lodestar-setup");
  const out = path.join(os.tmpdir(), `setup-state-base-${process.pid}.json`);
  try {
    const result = run([
      "collect",
      "--root",
      repo,
      "--out",
      out,
      "--skill-dir",
      skillDir,
    ]);
    assert.equal(result.status, 0, result.stderr);
    const state = JSON.parse(fs.readFileSync(out, "utf8"));
    assert.equal(state.hasAudit, false);
    assert.equal(state.fallow, undefined);
    const projection = JSON.parse(result.stdout);
    assert.equal(projection.hasAudit, false);
    assert.equal(projection.fallow, undefined);
  } finally {
    fs.rmSync(tree, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(out, { force: true });
  }
});

test("base+audit attempts fallow status via sibling path", () => {
  const tree = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-skills-audit-"));
  const repo = makeRepo("lodestar-setup-audit-", {
    "package.json": JSON.stringify({ name: "with-audit" }),
    "pnpm-lock.yaml": "lockfileVersion: 9\n",
    "src/index.ts": "export {};\n",
  });
  writeSkillsTree(tree, ["lodestar-setup", "lodestar-audit", "lodestar-fix"]);
  const auditScripts = path.join(tree, "lodestar-audit", "scripts");
  fs.mkdirSync(auditScripts, { recursive: true });
  const marker = path.join(os.tmpdir(), `fallow-status-hit-${process.pid}`);
  fs.writeFileSync(
    path.join(auditScripts, "fallow-contract.mjs"),
    `#!/usr/bin/env node
import fs from "node:fs";
fs.writeFileSync(${JSON.stringify(marker)}, "hit\\n");
process.stdout.write(JSON.stringify({
  declared: false,
  bin: null,
  version: null,
  compatible: false,
  needsDeclare: true,
  needsInstall: false,
  needsUpgrade: false,
  manager: "pnpm",
  addDev: null
}) + "\\n");
`,
  );
  const skillDir = path.join(tree, "lodestar-setup");
  const out = path.join(os.tmpdir(), `setup-state-audit-${process.pid}.json`);
  try {
    const result = run([
      "collect",
      "--root",
      repo,
      "--out",
      out,
      "--skill-dir",
      skillDir,
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(marker), "fallow status script should run");
    const state = JSON.parse(fs.readFileSync(out, "utf8"));
    assert.equal(state.hasAudit, true);
    assert.equal(state.fallow.attempted, true);
    assert.equal(state.fallow.status.needsDeclare, true);
  } finally {
    fs.rmSync(tree, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(out, { force: true });
    fs.rmSync(marker, { force: true });
  }
});

test("write-context fresh, merge preserves audit rows, legacy rewrite, idempotent", () => {
  const tree = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-write-skills-"));
  writeSkillsTree(tree, ["lodestar-setup"]);
  const skillDir = path.join(tree, "lodestar-setup");
  // Seed scripts so write-context can still resolve relative imports when
  // invoked via SCRIPT; collect uses --skill-dir for sibling gating only.
  const repo = makeRepo("lodestar-setup-write-", {
    "package.json": JSON.stringify({ name: "write-me" }),
    "pnpm-lock.yaml": "lockfileVersion: 9\n",
    "src/index.ts": "export {};\n",
  });
  const statePath = path.join(os.tmpdir(), `state-write-${process.pid}.json`);
  const correctionsPath = path.join(
    os.tmpdir(),
    `corr-write-${process.pid}.json`,
  );
  try {
    const collect = run([
      "collect",
      "--root",
      repo,
      "--out",
      statePath,
      "--skill-dir",
      skillDir,
    ]);
    assert.equal(collect.status, 0, collect.stderr);
    fs.writeFileSync(
      correctionsPath,
      JSON.stringify({
        projectDescription: "A tiny fixture repo for setup-state.",
        packageResponsibilities: { "write-me": "Demo app sources" },
      }),
    );
    const first = run([
      "write-context",
      "--root",
      repo,
      "--state",
      statePath,
      "--corrections",
      correctionsPath,
    ]);
    assert.equal(first.status, 0, first.stderr);
    const contextPath = path.join(repo, ".agents/lodestar/context.md");
    const fresh = fs.readFileSync(contextPath, "utf8");
    assert.match(fresh, /A tiny fixture repo/);
    assert.match(fresh, /## Package Layout/);
    assert.match(fresh, /Demo app sources/);
    assert.doesNotMatch(fresh, /## Audit Configuration/);
    assert.doesNotMatch(fresh, /## Resolved Decisions/);

    // Re-collect then write without responsibility corrections — preserve prior.
    const recollect = run([
      "collect",
      "--root",
      repo,
      "--out",
      statePath,
      "--skill-dir",
      skillDir,
    ]);
    assert.equal(recollect.status, 0, recollect.stderr);
    const emptyCorr = path.join(os.tmpdir(), `corr-empty-${process.pid}.json`);
    fs.writeFileSync(emptyCorr, JSON.stringify({}));
    const preserveRun = run([
      "write-context",
      "--root",
      repo,
      "--state",
      statePath,
      "--corrections",
      emptyCorr,
    ]);
    assert.equal(preserveRun.status, 0, preserveRun.stderr);
    assert.match(fs.readFileSync(contextPath, "utf8"), /Demo app sources/);
    fs.rmSync(emptyCorr, { force: true });

    // Second write without re-collect must also preserve responsibilities.
    const emptyCorr2 = path.join(
      os.tmpdir(),
      `corr-empty2-${process.pid}.json`,
    );
    fs.writeFileSync(emptyCorr2, JSON.stringify({}));
    const preserveAgain = run([
      "write-context",
      "--root",
      repo,
      "--state",
      statePath,
      "--corrections",
      emptyCorr2,
    ]);
    assert.equal(preserveAgain.status, 0, preserveAgain.stderr);
    assert.match(fs.readFileSync(contextPath, "utf8"), /Demo app sources/);
    fs.rmSync(emptyCorr2, { force: true });

    // Hand-edited docs role + rubric path survive a second write without re-collect.
    const handEdited = fs.readFileSync(contextPath, "utf8");
    const withDocs = handEdited.includes("## Docs Layout")
      ? handEdited.replace(
          /\| `docs\/plans` \| `[^`]+` \|/,
          "| `docs/plans` | `home` |",
        )
      : `${handEdited.trimEnd()}

## Docs Layout

| Path | Role | Responsibility |
| ---- | ---- | -------------- |
| \`docs/plans\` | \`home\` | KEEP DOCS ROLE |
`;
    const withRubric = withDocs.includes("## Review Rubric")
      ? withDocs.replace(
          /## Review Rubric\n\n[\s\S]*?(?=\n## |\n*$)/,
          "## Review Rubric\n\n- `CONTRIBUTING.md`\n- `KEEP-RUBRIC.md`\n",
        )
      : `${withDocs.trimEnd()}

## Review Rubric

- \`CONTRIBUTING.md\`
- \`KEEP-RUBRIC.md\`
`;
    fs.writeFileSync(contextPath, withRubric);
    // Force stale discovered docs/rubric in the state file.
    const stale = JSON.parse(fs.readFileSync(statePath, "utf8"));
    stale.docs = {
      outputRoot: "docs/audit",
      architectureRoot: "docs/architecture-review",
      rows: [
        {
          path: "docs/plans",
          role: "inflight",
          responsibility: "STALE DOCS",
        },
      ],
    };
    stale.rubric = { paths: ["AGENTS.md"] };
    fs.writeFileSync(statePath, JSON.stringify(stale));
    const emptyCorr3 = path.join(
      os.tmpdir(),
      `corr-empty3-${process.pid}.json`,
    );
    fs.writeFileSync(emptyCorr3, JSON.stringify({}));
    const docsPreserve = run([
      "write-context",
      "--root",
      repo,
      "--state",
      statePath,
      "--corrections",
      emptyCorr3,
    ]);
    assert.equal(docsPreserve.status, 0, docsPreserve.stderr);
    const afterDocs = fs.readFileSync(contextPath, "utf8");
    assert.match(afterDocs, /`docs\/plans`\s*\|\s*`home`/);
    assert.match(afterDocs, /KEEP-RUBRIC\.md/);
    assert.doesNotMatch(afterDocs, /STALE DOCS/);
    fs.rmSync(emptyCorr3, { force: true });

    // Current-shape merge with audit sibling + preserved rows.
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    state.hasAudit = true;
    state.siblings = ["lodestar-setup", "lodestar-audit"];
    state.frameworks = {
      frameworks: [],
      signals: [],
      scanExtensions: [".ts", ".tsx"],
    };
    state.exclusions = [];
    state.commitPolicy = {
      suggested: {
        commits: "ask",
        subjectFormat: "<category>: <slug>",
        trailer: "Closes <item>.",
        protected: ["none"],
        requireClean: "no",
      },
    };
    fs.writeFileSync(statePath, JSON.stringify(state));
    fs.writeFileSync(
      contextPath,
      `${fresh}
## Audit Configuration

| Key | Value | Notes |
| --- | --- | --- |
| \`categories\` | \`imports,types\` | kept |
| \`output-root\` | \`docs/qa\` | kept |
| \`fallow\` | \`required\` | |
| \`commits\` | \`never\` | |
`,
    );
    const mergedRun = run([
      "write-context",
      "--root",
      repo,
      "--state",
      statePath,
      "--corrections",
      correctionsPath,
    ]);
    assert.equal(mergedRun.status, 0, mergedRun.stderr);
    const merged = fs.readFileSync(contextPath, "utf8");
    assert.match(merged, /`categories`\s*\|\s*`imports,types`/);
    assert.match(merged, /`output-root`\s*\|\s*`docs\/qa`/);
    assert.doesNotMatch(merged, /## Resolved Decisions/);

    const again = run([
      "write-context",
      "--root",
      repo,
      "--state",
      statePath,
      "--corrections",
      correctionsPath,
    ]);
    assert.equal(again.status, 0, again.stderr);
    assert.equal(fs.readFileSync(contextPath, "utf8"), merged);

    // Legacy pre-0.9 rewrite.
    fs.writeFileSync(
      contextPath,
      `# Old

## Build & Test

| Command | Run |
| --- | --- |
| test | npm test |

## Audit Settings

| Setting | Value | Notes |
| --- | --- | --- |
| categories | all | |
`,
    );
    const legacy = run([
      "write-context",
      "--root",
      repo,
      "--state",
      statePath,
      "--corrections",
      correctionsPath,
    ]);
    assert.equal(legacy.status, 0, legacy.stderr);
    const rewritten = fs.readFileSync(contextPath, "utf8");
    assert.doesNotMatch(rewritten, /## Audit Settings/);
    assert.match(rewritten, /## Audit Configuration/);
  } finally {
    fs.rmSync(tree, { recursive: true, force: true });
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(statePath, { force: true });
    fs.rmSync(correctionsPath, { force: true });
  }
});

test("record-result and summarize-results keep setup provenance only", () => {
  const resultsPath = path.join(os.tmpdir(), `results-${process.pid}.json`);
  try {
    let result = run([
      "record-result",
      "--results",
      resultsPath,
      "--op",
      "context",
      "--status",
      "changed",
      "--path",
      ".agents/lodestar/context.md",
    ]);
    assert.equal(result.status, 0, result.stderr);
    result = run([
      "record-result",
      "--results",
      resultsPath,
      "--op",
      "agents",
      "--status",
      "skipped",
      "--remedy",
      "skills-only mode",
    ]);
    assert.equal(result.status, 0, result.stderr);
    result = run([
      "record-result",
      "--results",
      resultsPath,
      "--op",
      "fallowrc",
      "--status",
      "failed",
      "--path",
      ".fallowrc.json",
      "--remedy",
      "permission denied",
    ]);
    assert.equal(result.status, 0, result.stderr);
    result = run(["summarize-results", "--results", resultsPath]);
    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.deepEqual(summary.changed, [".agents/lodestar/context.md"]);
    assert.equal(summary.skipped.length, 1);
    assert.equal(summary.failed.length, 1);
    assert.match(summary.failed[0].remedy, /permission denied/);
    assert.ok(!JSON.stringify(summary).includes("package-lock.json"));
  } finally {
    fs.rmSync(resultsPath, { force: true });
  }
});

test("cleanup removes temp state files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-cleanup-"));
  const state = path.join(dir, "state.json");
  const corrections = path.join(dir, "corrections.json");
  const results = path.join(dir, "results.json");
  fs.writeFileSync(state, "{}\n");
  fs.writeFileSync(corrections, "{}\n");
  fs.writeFileSync(results, "{}\n");
  const result = run([
    "cleanup",
    "--state",
    state,
    "--corrections",
    corrections,
    "--results",
    results,
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(state), false);
  assert.equal(fs.existsSync(corrections), false);
  assert.equal(fs.existsSync(results), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("failure detail and stdout caps hold", () => {
  const huge = "x".repeat(MAX_FAILURE_BYTES + 200);
  const packages = Array.from({ length: 30 }, (_, i) => ({
    name: `pkg${i}`,
    path: `packages/pkg${i}/src`,
    alias: `n/a`,
    responsibility: "x".repeat(80),
    scannable: "yes",
    entryPoints: ["index.ts"],
  }));
  const state = {
    stateVersion: 1,
    siblings: ["lodestar-setup"],
    hasAudit: false,
    scannable: { total: 1, counts: { ".ts": 1 }, other: {} },
    pkgManager: { pkgManager: "pnpm", ambiguous: false, lockfiles: ["pnpm"] },
    needsInput: [],
    commands: {},
    linter: { tool: null, probe: null, signals: [] },
    layout: { source: null, packages },
    docs: { rows: [] },
    conventions: { suggested: {} },
    rubric: { paths: [] },
    existing: {},
    failures: [{ command: "git ls-files", remedy: "fix git", detail: huge }],
  };
  const text = projectReview(state);
  assert.ok(Buffer.byteLength(text, "utf8") <= MAX_STDOUT_BYTES);
  // Hard-capped stdout may not be valid JSON; failure detail must still be capped
  // when the projection remains parseable.
  try {
    const projection = JSON.parse(text);
    assert.ok(
      Buffer.byteLength(projection.failures[0].detail, "utf8") <=
        MAX_FAILURE_BYTES,
    );
    assert.ok(projection.layout.packages.length <= 20);
  } catch {
    assert.match(text, /git ls-files|truncatedStdout|…/);
  }
});

test("paths with spaces / CRLF / backslash normalize to /", () => {
  const repo = makeRepo("lodestar-setup-space-", {
    "package.json": JSON.stringify({ name: "spaced" }),
    "pnpm-lock.yaml": "lockfileVersion: 9\n",
  });
  const spaced = path.join(repo, "src dir");
  fs.mkdirSync(spaced, { recursive: true });
  fs.writeFileSync(path.join(spaced, "index.ts"), "export {};\r\n");
  const out = path.join(os.tmpdir(), `setup-state-space-${process.pid}.json`);
  try {
    const result = run([
      "collect",
      "--root",
      repo,
      "--out",
      out,
      "--skill-dir",
      SETUP_SKILL,
    ]);
    assert.equal(result.status, 0, result.stderr);
    const state = JSON.parse(fs.readFileSync(out, "utf8"));
    const blob = JSON.stringify(state);
    assert.ok(!blob.includes("\\\\"));
    assert.ok(state.layout.packages.every((row) => !row.path.includes("\\")));
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(out, { force: true });
  }
});

test("renderContext/mergeContext helpers are deterministic", () => {
  const repo = makeRepo("lodestar-setup-det-", {
    "package.json": JSON.stringify({ name: "det", scripts: { test: "true" } }),
    "pnpm-lock.yaml": "lockfileVersion: 9\n",
    "src/index.ts": "export {};\n",
  });
  try {
    const state = collectState(repo, { skillDir: SETUP_SKILL });
    const corrections = {
      projectDescription: "Deterministic fixture.",
      packageResponsibilities: { det: "Demo" },
    };
    const a = renderContext(state, corrections);
    const b = renderContext(state, corrections);
    assert.equal(a, b);
    const merged = mergeContext(a, state, corrections);
    assert.equal(mergeContext(merged, state, corrections), merged);
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
