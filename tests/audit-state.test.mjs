import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  applyChangedFiles,
  assignIds,
  architectureOutputRoot,
  CATEGORIES,
  CONVENTION_DEFAULTS,
  DEFAULT_OUTPUT_ROOT,
  dedupeFindings,
  findPlaceholders,
  GIT_DEFAULTS,
  isDeclaredEntryImport,
  isWrongDirectionImport,
  nextRunId,
  parseAuditSettings,
  parseConventions,
  parseDirection,
  parseExcludedPaths,
  parseFindings,
  renderFindings,
  parseGit,
  parseAuditScope,
  rejectPre09Context,
  SCOPE_DEFAULTS,
  parsePackageLayout,
  parseLayoutSource,
  scriptNameFromCommand,
  checkFreshness,
  deriveDirection,
  sortFindings,
} from "../skills/lodestar-audit/scripts/audit-state.mjs";
import { formatCommitMessage } from "../skills/lodestar-fix/scripts/action-state.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "skills/lodestar-audit/scripts/audit-state.mjs");
const VALID = path.join(ROOT, "tests/fixtures/repos/valid");
const PRE09 = path.join(ROOT, "tests/fixtures/repos/pre-0.9");
const OPTED_OUT = path.join(ROOT, "tests/fixtures/repos/opted-out");
const CYCLIC = path.join(ROOT, "tests/fixtures/repos/cyclic");
const PLACEHOLDER = path.join(ROOT, "tests/fixtures/repos/placeholder");
const SINGLE = path.join(ROOT, "tests/fixtures/repos/single-package");
const POLYGLOT = path.join(ROOT, "tests/fixtures/repos/polyglot");
const EXCLUDED = path.join(ROOT, "tests/fixtures/repos/excluded");
const BUN = path.join(ROOT, "tests/fixtures/repos/bun");
const CHANGED_SINCE = path.join(ROOT, "tests/fixtures/repos/changed-since");
const FRESH = path.join(ROOT, "tests/fixtures/repos/fresh-workspace");
const DRIFT_PKG = path.join(ROOT, "tests/fixtures/repos/drift-missing-package");
const DRIFT_CMD = path.join(ROOT, "tests/fixtures/repos/drift-commands");
const DRIFT_EXCL = path.join(ROOT, "tests/fixtures/repos/drift-excluded");
const SCOPED = path.join(
  ROOT,
  "tests/fixtures/audit-runs/scoped-backlog/findings.md",
);
const CLEAN = path.join(ROOT, "tests/fixtures/audit-runs/clean/findings.md");
const HEAVY = path.join(
  ROOT,
  "tests/fixtures/audit-runs/finding-heavy/findings.md",
);
const MALFORMED = path.join(
  ROOT,
  "tests/fixtures/audit-runs/malformed/findings.md",
);
const INTERRUPTED = path.join(
  ROOT,
  "tests/fixtures/audit-runs/interrupted/findings.md",
);

function run(args, cwd = ROOT) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function sha(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

test("parseDirection acyclic chain preserves reachability", () => {
  const parsed = parseDirection(
    "## Dependency Direction\n\ncore → api → shared\n\n## Package Layout",
  );
  assert.deepEqual(parsed.chain, ["core", "api", "shared"]);
  assert.equal(parsed.cyclic, false);
  assert.deepEqual(parsed.reachability.core, ["core", "api", "shared"]);
  assert.deepEqual(parsed.reachability.api, ["api", "shared"]);
  assert.deepEqual(parsed.reachability.shared, ["shared"]);
});

test("parseDirection reads cyclic edge lists", () => {
  const parsed = parseDirection(
    "## Dependency Direction\n\n- core → api (2 imports) [cycle]\n- api → core (1 import) [cycle]\n\nThe graph is cyclic.\n\n## Package Layout",
  );
  assert.equal(parsed.chain, null);
  assert.equal(parsed.cyclic, true);
  assert.equal(parsed.edges.length, 2);
  assert.deepEqual(parsed.reachability.core, ["core", "api"]);
  assert.deepEqual(parsed.reachability.api, ["api", "core"]);
});

test("documented cycle edges are not wrong-direction imports", () => {
  const parsed = parseDirection(
    "## Dependency Direction\n\n- core → api (2 imports) [cycle]\n- api → core (1 import) [cycle]\n\n## Package Layout",
  );
  assert.equal(isWrongDirectionImport("core", "api", parsed), false);
  assert.equal(isWrongDirectionImport("api", "core", parsed), false);
});

test("acyclic upward imports are wrong-direction", () => {
  const parsed = parseDirection(
    "## Dependency Direction\n\ncore → api\n\n## Package Layout",
  );
  assert.equal(isWrongDirectionImport("api", "core", parsed), true);
  assert.equal(isWrongDirectionImport("core", "api", parsed), false);
});

test("validate-input returns directionGraph for cyclic fixture", () => {
  const result = run(["validate-input", "--root", CYCLIC]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.direction.length, 0);
  assert.equal(payload.directionGraph.cyclic, true);
  assert.equal(payload.directionGraph.edges.length, 2);
});

test("nextRunId skips taken dates", () => {
  assert.equal(nextRunId([], "2026-08-10"), "2026-08-10");
  assert.equal(nextRunId(["2026-08-10"], "2026-08-10"), "2026-08-10-002");
  assert.equal(
    nextRunId(["2026-08-10", "2026-08-10-002"], "2026-08-10"),
    "2026-08-10-003",
  );
});

test("validate-input accepts a real layout and does not touch source", () => {
  const source = path.join(VALID, "packages/core/src/index.ts");
  const before = sha(source);
  const result = run(["validate-input", "--root", VALID]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.packages.length, 2);
  assert.equal(payload.packages[0].name, "core");
  assert.equal(payload.pkgManager, null);
  assert.equal(payload.pkgManagerAmbiguous, true);
  assert.equal(payload.pkgManagerProvenance, "none");
  assert.deepEqual(payload.conventions, CONVENTION_DEFAULTS);
  assert.deepEqual(payload.categories, CATEGORIES);
  assert.equal(payload.outputRoot, DEFAULT_OUTPUT_ROOT);
  assert.equal(payload.architectureRoot, "docs/architecture-review");
  assert.equal(payload.fallow, "required");
  assert.deepEqual(payload.git, GIT_DEFAULTS);
  assert.deepEqual(payload.scope, SCOPE_DEFAULTS);
  assert.equal(sha(source), before);
});

test("validate-input rejects placeholder responsibilities", () => {
  const result = run(["validate-input", "--root", PLACEHOLDER]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no real Responsibility/);
});

test("validate-input rejects a 0.8.x context.md with a re-run-setup remedy", () => {
  const result = run(["validate-input", "--root", PRE09]);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /pre-0.9 section layout/);
  assert.match(result.stderr, /Re-run lodestar-setup/);
});

test("clean findings validate", () => {
  const result = run(["validate-output", "--path", CLEAN]);
  assert.equal(result.status, 0, result.stderr);
});

test("renderFindings without drift matches today's header", () => {
  const rendered = renderFindings(
    "2026-08-10",
    [],
    [...CATEGORIES.map((category) => ({ category, count: 0 }))],
  );
  assert.equal(rendered, fs.readFileSync(CLEAN, "utf8"));
});

const SAMPLE_DRIFT = {
  fresh: false,
  layoutSource: "pnpm-workspace.yaml",
  drift: [
    {
      fact: "missing-package",
      recorded: "no matching row in ## Package Layout",
      observed: "packages/worker",
      remedy: "re-run setup",
    },
  ],
  skipped: [],
};

test("stale-basis block round-trips through parse and validate-output", () => {
  const first = renderFindings(
    "2026-08-10",
    [
      sampleFinding({
        id: "F0001",
        files: ["packages/api/src/routes/users.ts:12"],
      }),
    ],
    [{ category: "imports", count: 1 }],
    SAMPLE_DRIFT,
  );
  assert.match(first, /## Stale basis/);
  assert.match(first, /missing package: `packages\/worker`/);
  const parsed = parseFindings(first);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].id, "F0001");
  const second = renderFindings(
    "2026-08-10",
    parsed.findings,
    parsed.complete,
    SAMPLE_DRIFT,
  );
  assert.equal(parseFindings(second).findings[0].id, "F0001");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const findingsPath = path.join(tmp, "findings.md");
  fs.writeFileSync(findingsPath, first);
  const validated = run(["validate-output", "--path", findingsPath]);
  assert.equal(validated.status, 0, validated.stderr);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("merge-findings re-emits stale basis from the checkpoint", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const runDir = path.join(tmp, "2026-08-10");
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(
    path.join(runDir, ".checkpoint.json"),
    `${JSON.stringify({ drift: SAMPLE_DRIFT }, null, 2)}\n`,
  );
  const input = path.join(tmp, "in.json");
  fs.writeFileSync(
    input,
    JSON.stringify([
      sampleFinding({ files: ["packages/api/src/routes/users.ts:12"] }),
    ]),
  );
  const out = path.join(runDir, "findings.md");
  const merged = run([
    "merge-findings",
    "--in",
    input,
    "--out",
    out,
    "--run-id",
    "2026-08-10",
  ]);
  assert.equal(merged.status, 0, merged.stderr);
  const text = fs.readFileSync(out, "utf8");
  assert.match(text, /## Stale basis/);
  const recovered = JSON.parse(run(["recover", "--run-dir", runDir]).stdout);
  assert.equal(recovered.findings.length, 1);
  const validated = run(["validate-output", "--path", out]);
  assert.equal(validated.status, 0, validated.stderr);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("finding-heavy fixture round-trips through merge with stable ids", () => {
  const parsed = parseFindings(fs.readFileSync(HEAVY, "utf8"));
  assert.equal(parsed.findings.length, 2);
  const merged = assignIds(
    dedupeFindings(sortFindings(parsed.findings.concat(parsed.findings))),
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, "F0001");
  assert.equal(merged[1].id, "F0002");
});

test("malformed findings fail validate-output", () => {
  const result = run(["validate-output", "--path", MALFORMED]);
  assert.notEqual(result.status, 0);
});

test("placeholders are detected", () => {
  const hits = findPlaceholders("run <typecheck> in <pkg_root>");
  assert.equal(hits.length, 1);
});

test("interrupted recover resumes discover", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const runDir = path.join(tmp, "2026-08-10");
  fs.mkdirSync(runDir, { recursive: true });
  fs.copyFileSync(INTERRUPTED, path.join(runDir, "findings.md"));
  const result = run(["recover", "--run-dir", runDir]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.action, "resume-discover");
  assert.ok(payload.incompleteCategories.includes("types"));
  assert.ok(!payload.incompleteCategories.includes("imports"));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("checkpoint is atomic and recover does not duplicate findings", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const runDir = path.join(tmp, "2026-08-10");
  fs.mkdirSync(runDir, { recursive: true });
  fs.copyFileSync(HEAVY, path.join(runDir, "findings.md"));
  const first = run([
    "checkpoint",
    "--run-dir",
    runDir,
    "--category",
    "imports",
    "--status",
    "complete",
    "--count",
    "2",
  ]);
  assert.equal(first.status, 0, first.stderr);
  const second = run([
    "checkpoint",
    "--run-dir",
    runDir,
    "--category",
    "imports",
    "--status",
    "complete",
    "--count",
    "2",
  ]);
  assert.equal(second.status, 0, second.stderr);
  const recovered = JSON.parse(run(["recover", "--run-dir", runDir]).stdout);
  assert.equal(recovered.findings.length, 2);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("merge-findings rejects malformed json", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const bad = path.join(tmp, "bad.json");
  fs.writeFileSync(bad, "{not json");
  const result = run(["merge-findings", "--in", bad]);
  assert.equal(result.status, 2);
  fs.rmSync(tmp, { recursive: true, force: true });
});

function sampleFinding(overrides) {
  return {
    category: "imports",
    subtype: "cross-package-src",
    package: "api",
    files: ["packages/api/src/routes/users.ts:12"],
    evidence: "import",
    scope_unit: "one-file",
    requires_decision: false,
    notes: "",
    ...overrides,
  };
}

test("applyChangedFiles marks only overlapping files in scope", () => {
  const findings = applyChangedFiles(
    [
      sampleFinding({ files: ["packages/api/src/new.ts:1"] }),
      sampleFinding({
        files: ["packages/core/src/old.ts:1"],
        subtype: "wrong-direction",
      }),
    ],
    ["packages/api/src/new.ts"],
  );
  assert.equal(findings[0].in_scope, true);
  assert.equal(findings[1].in_scope, false);
});

test("applyChangedFiles keeps advisory findings in scope", () => {
  const findings = applyChangedFiles(
    [
      sampleFinding({
        scope_unit: "advisory",
        files: ["packages/core/src/old.ts:1"],
      }),
    ],
    ["packages/api/src/new.ts"],
  );
  assert.equal(findings[0].in_scope, true);
});

test("applyChangedFiles without a changed set marks every finding in scope", () => {
  const findings = applyChangedFiles(
    [sampleFinding({ in_scope: false })],
    null,
  );
  assert.equal(findings[0].in_scope, true);
});

test("missing in_scope in findings.md defaults to true and still validates", () => {
  const result = run(["validate-output", "--path", HEAVY]);
  assert.equal(result.status, 0, result.stderr);
  const parsed = parseFindings(fs.readFileSync(HEAVY, "utf8"));
  assert.equal(parsed.findings[0].in_scope, true);
});

test("merge-findings --changed-files partitions findings", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const input = path.join(tmp, "in.json");
  fs.writeFileSync(
    input,
    JSON.stringify([
      sampleFinding({ files: ["src/new.ts:1"] }),
      sampleFinding({
        files: ["src/old.ts:1"],
        subtype: "wrong-direction",
      }),
    ]),
  );
  const result = run([
    "merge-findings",
    "--in",
    input,
    "--changed-files",
    JSON.stringify(["src/new.ts"]),
  ]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.findings[0].in_scope, true);
  assert.equal(payload.findings[1].in_scope, false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("recover after one category checkpoint stays in discover", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const runDir = path.join(tmp, "2026-08-10");
  fs.mkdirSync(runDir, { recursive: true });
  const first = run([
    "checkpoint",
    "--run-dir",
    runDir,
    "--category",
    "imports",
    "--status",
    "complete",
    "--count",
    "0",
  ]);
  assert.equal(first.status, 0, first.stderr);
  const recovered = JSON.parse(run(["recover", "--run-dir", runDir]).stdout);
  assert.equal(recovered.action, "resume-discover");
  assert.ok(recovered.incompleteCategories.includes("types"));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("partial checkpoint keeps recover in discover after all categories are marked", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const runDir = path.join(tmp, "2026-08-10");
  fs.mkdirSync(runDir, { recursive: true });
  fs.copyFileSync(CLEAN, path.join(runDir, "findings.md"));
  const partial = run([
    "checkpoint",
    "--run-dir",
    runDir,
    "--category",
    "dry",
    "--status",
    "partial",
    "--package",
    "core",
    "--count",
    "0",
  ]);
  assert.equal(partial.status, 0, partial.stderr);
  const recovered = JSON.parse(run(["recover", "--run-dir", runDir]).stdout);
  assert.equal(recovered.action, "resume-discover");
  assert.equal(recovered.checkpoint.package, "core");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("parsePackageLayout is used by validate-input", () => {
  const rows = parsePackageLayout(
    fs.readFileSync(path.join(VALID, ".agents/lodestar/context.md"), "utf8"),
  );
  assert.equal(rows[1].alias, "@repo/api");
});

test("parsePackageLayout defaults Scannable to yes when the column is absent", () => {
  const rows = parsePackageLayout(
    fs.readFileSync(path.join(VALID, ".agents/lodestar/context.md"), "utf8"),
  );
  assert.equal(rows[0].scannable, "yes");
  assert.equal(rows[1].scannable, "yes");
  assert.equal(rows[0].language, "");
});

test("parsePackageLayout reads the Scannable column", () => {
  const rows = parsePackageLayout(`## Package Layout

| Package | Path | Alias | Responsibility | Scannable |
| ------- | ---- | ----- | -------------- | --------- |
| core | packages/core/src | @repo/core | Domain entities and use cases for billing | yes |
| worker | services/worker | n/a | Background jobs and queue consumers | no (Go) |
`);
  assert.equal(rows[0].scannable, "yes");
  assert.equal(rows[1].scannable, "no");
  assert.equal(rows[1].language, "Go");
});

test("parsePackageLayout defaults Entry points to index.ts when the column is absent", () => {
  const rows = parsePackageLayout(
    fs.readFileSync(path.join(VALID, ".agents/lodestar/context.md"), "utf8"),
  );
  assert.deepEqual(rows[0].entryPoints, ["index.ts"]);
  assert.deepEqual(rows[1].entryPoints, ["index.ts"]);
});

test("parsePackageLayout reads the Entry points column", () => {
  const rows = parsePackageLayout(`## Package Layout

| Package | Path | Alias | Responsibility | Scannable | Entry points |
| ------- | ---- | ----- | -------------- | --------- | ------------ |
| core | packages/core/src | @repo/core | Domain entities and use cases for billing | yes | index.ts, server |
`);
  assert.equal(rows[0].scannable, "yes");
  assert.deepEqual(rows[0].entryPoints, ["index.ts", "server"]);
});

test("isDeclaredEntryImport matches package root and declared subpaths", () => {
  const entries = ["index.ts", "./server", "client"];
  assert.equal(
    isDeclaredEntryImport("@repo/core", "@repo/core", entries),
    true,
  );
  assert.equal(
    isDeclaredEntryImport("@repo/core/server", "@repo/core", entries),
    true,
  );
  assert.equal(
    isDeclaredEntryImport("@repo/core/client", "@repo/core", entries),
    true,
  );
  assert.equal(
    isDeclaredEntryImport("@repo/core/src/user", "@repo/core", entries),
    false,
  );
  assert.equal(
    isDeclaredEntryImport("@repo/core/internal", "@repo/core", ["index.ts"]),
    false,
  );
});

test("validate-input accepts one package with an empty dependency graph", () => {
  const tmp = writeLayoutRepo(
    `## Package Layout

| Package | Path | Alias | Responsibility |
| ------- | ---- | ----- | -------------- |
| app | src | n/a | HTTP routes and request validation |
`,
    { "src/index.ts": "export const value = 1;\n" },
  );
  const contextPath = path.join(tmp, ".agents/lodestar/context.md");
  fs.writeFileSync(
    contextPath,
    fs
      .readFileSync(contextPath, "utf8")
      .replace(
        /## Dependency Direction[\s\S]*?(?=\n## Package Layout)/,
        "## Dependency Direction\n\n",
      ),
  );
  const result = run(["validate-input", "--root", tmp]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.packages.length, 1);
  assert.deepEqual(payload.packages[0].entryPoints, ["index.ts"]);
  assert.deepEqual(payload.direction, []);
  assert.deepEqual(payload.directionGraph.edges, []);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("validate-input reports context.md provenance from a pkg-manager row", () => {
  const tmp = writeLayoutRepo(
    `## Package Layout

| Package | Path | Alias | Responsibility |
| ------- | ---- | ----- | -------------- |
| app | src | n/a | HTTP routes and request validation |
`,
    { "src/index.ts": "export const value = 1;\n" },
  );
  const contextPath = path.join(tmp, ".agents/lodestar/context.md");
  fs.writeFileSync(
    contextPath,
    fs
      .readFileSync(contextPath, "utf8")
      .replace(
        /\| test\s+\|[^|]+\|/,
        "| test | npm test |\n| pkg-manager | pixi; pixi run; pixi add --dev <pkg> |",
      ),
  );
  fs.writeFileSync(path.join(tmp, "pnpm-lock.yaml"), "");
  const result = run(["validate-input", "--root", tmp]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.pkgManager, "pixi");
  assert.equal(payload.run, "pixi run");
  assert.equal(payload.pkgManagerProvenance, "context.md");
  assert.equal(payload.pkgManagerAmbiguous, false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeLayoutRepo(layoutMarkdown, files = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const contextDir = path.join(tmp, ".agents", "lodestar");
  fs.mkdirSync(contextDir, { recursive: true });
  const base = fs.readFileSync(
    path.join(VALID, ".agents/lodestar/context.md"),
    "utf8",
  );
  const replaced = base.replace(
    /## Package Layout[\s\S]*$/,
    `${layoutMarkdown.trim()}\n`,
  );
  fs.writeFileSync(path.join(contextDir, "context.md"), replaced);
  for (const [rel, contents] of Object.entries(files)) {
    const full = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  }
  return tmp;
}

test("validate-input fails when a Scannable yes row has no scannable files", () => {
  const tmp = writeLayoutRepo(`## Package Layout

| Package | Path | Alias | Responsibility |
| ------- | ---- | ----- | -------------- |
| core | packages/core/src | @repo/core | Domain entities and use cases for billing |
`);
  const result = run(["validate-input", "--root", tmp]);
  assert.equal(result.status, 2);
  assert.match(
    result.stderr,
    /Scannable: yes but contains no TypeScript or JavaScript/,
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("validate-input omits Scannable no rows from allPkgRoots", () => {
  const tmp = writeLayoutRepo(
    `## Package Layout

| Package | Path | Alias | Responsibility | Scannable |
| ------- | ---- | ----- | -------------- | --------- |
| core | packages/core/src | @repo/core | Domain entities and use cases for billing | yes |
| worker | services/worker | n/a | Background jobs and queue consumers | no (Go) |
`,
    {
      "packages/core/src/index.ts": "export const value = 1;\n",
      "services/worker/main.go": "package main\n",
    },
  );
  const result = run(["validate-input", "--root", tmp]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.packages.length, 2);
  assert.equal(payload.packages[1].scannable, "no");
  assert.equal(payload.packages[1].language, "Go");
  assert.equal(payload.packages[1].scannableCount, 0);
  assert.equal(payload.allPkgRoots, "packages/core/src");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("validate-input does not count non-scannable files matched by a glob", () => {
  const tmp = writeLayoutRepo(
    `## Package Layout

| Package | Path | Alias | Responsibility |
| ------- | ---- | ----- | -------------- |
| docs | notes/* | n/a | Operator runbooks and incident notes |
`,
    { "notes/README.md": "# notes\n" },
  );
  const result = run(["validate-input", "--root", tmp]);
  assert.equal(result.status, 2);
  assert.match(
    result.stderr,
    /Scannable: yes but contains no TypeScript or JavaScript/,
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("parseExcludedPaths defaults to empty lists when the section is absent", () => {
  assert.deepEqual(parseExcludedPaths("# Fixture\n\n## Package Layout\n"), {
    excludedPaths: [],
    testGlobs: [],
  });
});

test("parseExcludedPaths reads both glob lists", () => {
  const parsed = parseExcludedPaths(`## Audit Configuration

### Excluded Paths

**Not audited** — generated output.

- \`packages/db/generated/**\` — Prisma client
- \`**/*.gen.ts\` — GraphQL codegen

**Test files** — skipped by default.

- \`**/*.test.ts\` — vitest
- \`**/__tests__/**\` — colocated tests
`);
  assert.deepEqual(parsed.excludedPaths, [
    "packages/db/generated/**",
    "**/*.gen.ts",
  ]);
  assert.deepEqual(parsed.testGlobs, ["**/*.test.ts", "**/__tests__/**"]);
});

test("parseExcludedPaths does not treat bullet reasons as headings", () => {
  const parsed = parseExcludedPaths(`## Audit Configuration

### Excluded Paths

**Not audited** — generated output.

- \`packages/db/generated/**\` — Prisma generated test files
- \`**/*.gen.ts\` — GraphQL codegen

**Test files** — skipped by default.

- \`**/*.test.ts\` — vitest test files
`);
  assert.deepEqual(parsed.excludedPaths, [
    "packages/db/generated/**",
    "**/*.gen.ts",
  ]);
  assert.deepEqual(parsed.testGlobs, ["**/*.test.ts"]);
});

test("validate-input fails when a yes row is entirely excluded generated code", () => {
  const tmp = writeLayoutRepo(
    `## Package Layout

| Package | Path | Alias | Responsibility |
| ------- | ---- | ----- | -------------- |
| db | packages/db/src | @repo/db | Database client and generated Prisma types |

## Audit Configuration

### Excluded Paths

**Not audited**

- \`packages/db/src/generated/**\` — Prisma client
`,
    { "packages/db/src/generated/client.ts": "export const value = 1;\n" },
  );
  const generated = run(["validate-input", "--root", tmp]);
  assert.equal(generated.status, 2);
  assert.match(
    generated.stderr,
    /Scannable: yes but contains no TypeScript or JavaScript/,
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("validate-input emits excludedPaths and testGlobs", () => {
  const tmp = writeLayoutRepo(
    `## Package Layout

| Package | Path | Alias | Responsibility |
| ------- | ---- | ----- | -------------- |
| core | packages/core/src | @repo/core | Domain entities and use cases for billing |

## Audit Configuration

### Excluded Paths

**Not audited**

- \`**/generated/**\` — codegen

**Test files**

- \`**/__tests__/**\` — colocated tests
`,
    { "packages/core/src/index.ts": "export const value = 1;\n" },
  );
  const listed = run(["validate-input", "--root", tmp]);
  assert.equal(listed.status, 0, listed.stderr);
  const payload = JSON.parse(listed.stdout);
  assert.deepEqual(payload.excludedPaths, ["**/generated/**"]);
  assert.deepEqual(payload.testGlobs, ["**/__tests__/**"]);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("validate-input stops when the context file is missing", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# AGENTS.md\n");
  const result = run(["validate-input", "--root", tmp]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /\.agents\/lodestar\/context\.md is missing/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

function conventionsMarkdown(rows) {
  const lines = [
    "## Conventions",
    "",
    "| Convention | Value | What it gates |",
    "| ---------- | ----- | ------------- |",
    ...rows.map(([key, value]) => `| \`${key}\` | \`${value}\` | x |`),
    "",
  ];
  return lines.join("\n");
}

test("parseConventions defaults when the section is absent", () => {
  assert.deepEqual(
    parseConventions("# Fixture\n\n## Package Layout\n"),
    CONVENTION_DEFAULTS,
  );
});

test("parseConventions parses each key", () => {
  const parsed = parseConventions(
    conventionsMarkdown([
      ["result-types", "no"],
      ["branded-types", "no"],
      ["barrel-exports", "yes"],
      ["design-tokens", "no"],
      ["coverage-floor", "none"],
    ]),
  );
  assert.deepEqual(parsed, {
    "result-types": "no",
    "branded-types": "no",
    "barrel-exports": "yes",
    "design-tokens": "no",
    "coverage-floor": "none",
  });
});

test("parseConventions fills missing rows from defaults", () => {
  const parsed = parseConventions(
    conventionsMarkdown([["result-types", "no"]]),
  );
  assert.equal(parsed["result-types"], "no");
  assert.equal(parsed["branded-types"], "yes");
  assert.equal(parsed["barrel-exports"], "no");
  assert.equal(parsed["coverage-floor"], 80);
});

test("parseConventions parses coverage-floor as a number", () => {
  const parsed = parseConventions(
    conventionsMarkdown([["coverage-floor", "70"]]),
  );
  assert.equal(parsed["coverage-floor"], 70);
});

test("parseConventions ignores unknown keys", () => {
  const parsed = parseConventions(
    conventionsMarkdown([
      ["result-types", "no"],
      ["fallow", "optional"],
    ]),
  );
  assert.equal(parsed["result-types"], "no");
  assert.equal(parsed.fallow, undefined);
});

test("parseConventions rejects a bad boolean", () => {
  assert.throws(
    () => parseConventions(conventionsMarkdown([["result-types", "yeah"]])),
    /invalid value for `result-types`/,
  );
});

test("parseConventions rejects a bad coverage-floor", () => {
  assert.throws(
    () => parseConventions(conventionsMarkdown([["coverage-floor", "80%"]])),
    /invalid value for `coverage-floor`/,
  );
});

test("validate-input rejects a bad conventions value", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const contextDir = path.join(tmp, ".agents", "lodestar");
  fs.mkdirSync(contextDir, { recursive: true });
  const base = fs.readFileSync(
    path.join(VALID, ".agents/lodestar/context.md"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(contextDir, "context.md"),
    `${base}\n${conventionsMarkdown([["result-types", "yeah"]])}\n`,
  );
  const result = run(["validate-input", "--root", tmp]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid value for `result-types`/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

function auditSettingsMarkdown(rows) {
  const lines = [
    "## Audit Configuration",
    "",
    "| Setting | Value | Notes |",
    "| ------- | ----- | ----- |",
    ...rows.map(([key, value]) => `| \`${key}\` | \`${value}\` | x |`),
    "",
  ];
  return lines.join("\n");
}

test("parseAuditSettings defaults when the section is absent", () => {
  const parsed = parseAuditSettings("# Fixture\n");
  assert.deepEqual(parsed.categories, CATEGORIES);
  assert.equal(parsed.outputRoot, DEFAULT_OUTPUT_ROOT);
  assert.equal(parsed.fallow, "required");
});

test("pre-0.9 section names fail closed with a re-run-setup remedy", () => {
  assert.throws(
    () => parseAuditSettings("## Audit Settings\n\n| Setting | Value |\n"),
    /pre-0.9 section layout.*## Audit Settings.*Re-run lodestar-setup/,
  );
  assert.throws(
    () => rejectPre09Context("## Principles\n\nSee principles.md.\n"),
    /no migration/,
  );
});

test("parseAuditSettings parses fallow optional", () => {
  const parsed = parseAuditSettings(
    auditSettingsMarkdown([["fallow", "optional"]]),
  );
  assert.equal(parsed.fallow, "optional");
});

test("parseAuditSettings rejects a bad fallow value", () => {
  assert.throws(
    () => parseAuditSettings(auditSettingsMarkdown([["fallow", "maybe"]])),
    /invalid value for `fallow`/,
  );
});

test("parseAuditSettings honors a custom output-root and category subset", () => {
  const parsed = parseAuditSettings(
    auditSettingsMarkdown([
      ["categories", "imports, types, ssot"],
      ["output-root", "docs/qa"],
    ]),
  );
  assert.deepEqual(parsed.categories, ["imports", "types", "ssot"]);
  assert.equal(parsed.outputRoot, "docs/qa");
  assert.equal(
    architectureOutputRoot(parsed.outputRoot),
    "docs/qa/architecture-review",
  );
});

test("parseAuditSettings rejects an unknown category", () => {
  assert.throws(
    () =>
      parseAuditSettings(
        auditSettingsMarkdown([["categories", "imports, nope"]]),
      ),
    /unknown category/,
  );
});

test("parseAuditSettings rejects a path with ..", () => {
  assert.throws(
    () =>
      parseAuditSettings(
        auditSettingsMarkdown([["output-root", "docs/../secret"]]),
      ),
    /invalid `output-root`/,
  );
});

test("resolve-run uses docs/audit when Audit Configuration is absent", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const result = run(["resolve-run", "--root", tmp, "--date", "2026-08-18"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.outputRoot, DEFAULT_OUTPUT_ROOT);
  assert.ok(payload.path.endsWith(path.join("docs", "audit", "2026-08-18")));
  assert.equal(fs.existsSync(payload.path), true);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("resolve-run honors a custom output-root", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const contextDir = path.join(tmp, ".agents", "lodestar");
  fs.mkdirSync(contextDir, { recursive: true });
  fs.writeFileSync(
    path.join(contextDir, "context.md"),
    `# Fixture\n\n${auditSettingsMarkdown([["output-root", "docs/qa"]])}\n`,
  );
  const result = run(["resolve-run", "--root", tmp, "--date", "2026-08-18"]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.outputRoot, "docs/qa");
  assert.equal(payload.architectureRoot, "docs/qa/architecture-review");
  assert.ok(payload.path.endsWith(path.join("docs", "qa", "2026-08-18")));
  assert.equal(fs.existsSync(payload.path), true);
  assert.equal(fs.existsSync(path.join(tmp, "docs", "audit")), false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("resolve-run --drift writes the payload and checkpoint keeps it", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const drift = {
    fresh: false,
    layoutSource: "pnpm-workspace.yaml",
    drift: [
      {
        fact: "missing-package",
        recorded: "no matching row in ## Package Layout",
        observed: "packages/worker",
        remedy:
          "Re-run lodestar-setup to add `packages/worker` to ## Package Layout.",
      },
    ],
    skipped: [],
  };
  const created = run([
    "resolve-run",
    "--root",
    tmp,
    "--date",
    "2026-08-18",
    "--drift",
    JSON.stringify(drift),
  ]);
  assert.equal(created.status, 0, created.stderr);
  const payload = JSON.parse(created.stdout);
  const marker = path.join(payload.path, ".checkpoint.json");
  assert.deepEqual(JSON.parse(fs.readFileSync(marker, "utf8")).drift, drift);
  const checkpoint = run([
    "checkpoint",
    "--run-dir",
    payload.path,
    "--category",
    "imports",
    "--status",
    "complete",
    "--count",
    "0",
  ]);
  assert.equal(checkpoint.status, 0, checkpoint.stderr);
  const after = JSON.parse(fs.readFileSync(marker, "utf8"));
  assert.deepEqual(after.drift, drift);
  assert.equal(after.category, "imports");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("resolve-run without --drift creates no drift key", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const created = run(["resolve-run", "--root", tmp, "--date", "2026-08-18"]);
  assert.equal(created.status, 0, created.stderr);
  const payload = JSON.parse(created.stdout);
  assert.equal(
    fs.existsSync(path.join(payload.path, ".checkpoint.json")),
    false,
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("resolve-run rejects malformed --drift", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const result = run([
    "resolve-run",
    "--root",
    tmp,
    "--date",
    "2026-08-18",
    "--drift",
    "[1]",
  ]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /invalid --drift/);
  assert.equal(fs.existsSync(path.join(tmp, "docs")), false);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("validate-input reports opted-out conventions and custom output-root", () => {
  const result = run(["validate-input", "--root", OPTED_OUT]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.conventions["result-types"], "no");
  assert.equal(payload.conventions["design-tokens"], "no");
  assert.equal(payload.conventions["coverage-floor"], "none");
  assert.equal(payload.conventions["branded-types"], "yes");
  assert.equal(payload.outputRoot, "docs/qa");
  assert.equal(payload.architectureRoot, "docs/qa/architecture-review");
});

function gitMarkdown(rows) {
  const lines = [
    "## Audit Configuration",
    "",
    "| Key | Value | Notes |",
    "| --- | ----- | ----- |",
    ...rows.map(([key, value]) => `| \`${key}\` | \`${value}\` | x |`),
    "",
  ];
  return lines.join("\n");
}

test("parseGit defaults when the section is absent", () => {
  assert.deepEqual(parseGit("# Fixture\n"), GIT_DEFAULTS);
});

test("parseGit parses each key", () => {
  const parsed = parseGit(
    gitMarkdown([
      ["commits", "never"],
      ["subject-format", "fix(<category>): <slug>"],
      ["trailer", "none"],
      ["protected", "main, master"],
      ["require-clean", "yes"],
    ]),
  );
  assert.deepEqual(parsed, {
    commits: "never",
    subjectFormat: "fix(<category>): <slug>",
    trailer: "none",
    protected: ["main", "master"],
    requireClean: "yes",
  });
});

test("parseGit treats protected none as an empty list", () => {
  const parsed = parseGit(gitMarkdown([["protected", "none"]]));
  assert.deepEqual(parsed.protected, []);
});

test("parseGit fills missing rows from defaults", () => {
  const parsed = parseGit(gitMarkdown([["commits", "per-item"]]));
  assert.equal(parsed.commits, "per-item");
  assert.equal(parsed.subjectFormat, GIT_DEFAULTS.subjectFormat);
  assert.equal(parsed.trailer, GIT_DEFAULTS.trailer);
  assert.deepEqual(parsed.protected, []);
  assert.equal(parsed.requireClean, "no");
});

test("parseGit ignores unknown keys", () => {
  const parsed = parseGit(
    gitMarkdown([
      ["commits", "never"],
      ["signoff", "yes"],
    ]),
  );
  assert.equal(parsed.commits, "never");
  assert.equal(parsed.signoff, undefined);
});

test("parseGit rejects a bad commits value", () => {
  assert.throws(
    () => parseGit(gitMarkdown([["commits", "sometimes"]])),
    /invalid value for `commits`/,
  );
});

test("parseGit rejects a subject-format with no slug placeholder", () => {
  assert.throws(
    () => parseGit(gitMarkdown([["subject-format", "fix: something"]])),
    /must contain `<slug>`/,
  );
});

test("parseGit rejects a bad require-clean value", () => {
  assert.throws(
    () => parseGit(gitMarkdown([["require-clean", "maybe"]])),
    /invalid value for `require-clean`/,
  );
});

test("validate-input rejects a bad git value", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const contextDir = path.join(tmp, ".agents", "lodestar");
  fs.mkdirSync(contextDir, { recursive: true });
  const base = fs.readFileSync(
    path.join(VALID, ".agents/lodestar/context.md"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(contextDir, "context.md"),
    `${base}\n${gitMarkdown([["commits", "sometimes"]])}\n`,
  );
  const result = run(["validate-input", "--root", tmp]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /invalid value for `commits`/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("validate-input emits a fully populated git object", () => {
  const tmp = writeLayoutRepo(
    `## Package Layout

| Package | Path | Alias | Responsibility |
| ------- | ---- | ----- | -------------- |
| app | src | n/a | HTTP routes and request validation |

${gitMarkdown([
  ["commits", "per-item"],
  ["subject-format", "fix(<category>): <slug>"],
  ["trailer", "Closes <item>."],
  ["protected", "main"],
  ["require-clean", "yes"],
])}
`,
    { "src/index.ts": "export const value = 1;\n" },
  );
  const result = run(["validate-input", "--root", tmp]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.git, {
    commits: "per-item",
    subjectFormat: "fix(<category>): <slug>",
    trailer: "Closes <item>.",
    protected: ["main"],
    requireClean: "yes",
  });
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("formatCommitMessage substitutes placeholders", () => {
  assert.equal(
    formatCommitMessage({
      subjectFormat: "<category>: <slug>",
      trailer: "Closes <item>.",
      category: "imports",
      slug: "cross-package",
      item: "docs/audit/2026-08-18/001-imports-cross-package.md",
    }),
    "imports: cross-package\n\nCloses docs/audit/2026-08-18/001-imports-cross-package.md.\n",
  );
});

test("formatCommitMessage omits the body when trailer is none", () => {
  assert.equal(
    formatCommitMessage({
      subjectFormat: "fix(<category>): <slug>",
      trailer: "none",
      category: "types",
      slug: "explicit-any",
      item: "docs/audit/run/002-types-explicit-any.md",
    }),
    "fix(types): explicit-any\n",
  );
});

test("commit-message prints today's default from an action item", () => {
  const file = path.join(
    ROOT,
    "tests/fixtures/audit-runs/fix-ready/001-imports-cross-package.md",
  );
  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, "skills/lodestar-fix/scripts/action-state.mjs"),
      "commit-message",
      "--file",
      file,
      "--item",
      "docs/audit/2026-08-18/001-imports-cross-package.md",
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    "imports: cross-package\n\nCloses docs/audit/2026-08-18/001-imports-cross-package.md.\n",
  );
});

test("validate-input single-package fixture: empty graph, entries, git, pkg-manager", () => {
  const result = run(["validate-input", "--root", SINGLE]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.packages.length, 1);
  assert.deepEqual(payload.packages[0].entryPoints, ["index.ts", "server"]);
  assert.deepEqual(payload.direction, []);
  assert.deepEqual(payload.directionGraph.edges, []);
  assert.equal(payload.pkgManager, "pixi");
  assert.equal(payload.pkgManagerProvenance, "context.md");
  assert.equal(payload.git.commits, "never");
  assert.equal(payload.git.subjectFormat, "fix(<category>): <slug>");
  assert.equal(payload.git.trailer, "none");
  assert.deepEqual(payload.git.protected, ["main"]);
  assert.equal(payload.git.requireClean, "yes");
});

test("validate-input polyglot fixture omits the Go package from allPkgRoots", () => {
  const result = run(["validate-input", "--root", POLYGLOT]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.packages.length, 2);
  assert.equal(payload.packages[1].scannable, "no");
  assert.equal(payload.packages[1].language, "Go");
  assert.equal(payload.allPkgRoots, "packages/core/src");
});

test("validate-input excluded fixture emits globs and still finds hand-written source", () => {
  const result = run(["validate-input", "--root", EXCLUDED]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload.excludedPaths, ["**/generated/**"]);
  assert.deepEqual(payload.testGlobs, ["**/__tests__/**"]);
  assert.ok(payload.packages[0].scannableCount >= 1);
});

test("validate-input bun fixture detects bun from the lockfile", () => {
  const result = run(["validate-input", "--root", BUN]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.pkgManager, "bun");
  assert.equal(payload.run, "bunx");
  assert.equal(payload.pkgManagerProvenance, "lockfile");
  assert.deepEqual(payload.git, GIT_DEFAULTS);
});

function scopeMarkdown(rows) {
  const lines = [
    "## Audit Configuration",
    "",
    "| Key | Value | Notes |",
    "| --- | ----- | ----- |",
    ...rows.map(([key, value]) => `| \`${key}\` | \`${value}\` | x |`),
    "",
  ];
  return lines.join("\n");
}

function gitOk(cwd, args) {
  const result = spawnSync(
    "git",
    ["-C", cwd, "-c", "core.hooksPath=/dev/null", ...args],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  return result;
}

test("parseAuditScope defaults when the section is absent", () => {
  assert.deepEqual(parseAuditScope("# Fixture\n\n## Package Layout\n"), {
    mode: "all",
  });
});

test("parseAuditScope parses changed-since", () => {
  const parsed = parseAuditScope(
    scopeMarkdown([
      ["mode", "changed-since"],
      ["baseline-ref", "abc1234"],
      ["baseline-date", "2026-08-18"],
    ]),
  );
  assert.deepEqual(parsed, {
    mode: "changed-since",
    baselineRef: "abc1234",
    baselineDate: "2026-08-18",
  });
});

test("parseAuditScope ignores unknown keys", () => {
  const parsed = parseAuditScope(
    scopeMarkdown([
      ["mode", "all"],
      ["extra", "nope"],
    ]),
  );
  assert.deepEqual(parsed, { mode: "all" });
});

test("parseAuditScope rejects a bad mode", () => {
  assert.throws(
    () => parseAuditScope(scopeMarkdown([["mode", "new-only"]])),
    /invalid value for `mode`/,
  );
});

test("parseAuditScope rejects changed-since without a baseline-ref", () => {
  assert.throws(
    () => parseAuditScope(scopeMarkdown([["mode", "changed-since"]])),
    /no `baseline-ref`/,
  );
});

test("validate-input rejects an unresolvable baseline-ref", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-audit-"));
  const contextDir = path.join(tmp, ".agents", "lodestar");
  fs.mkdirSync(contextDir, { recursive: true });
  const base = fs.readFileSync(
    path.join(VALID, ".agents/lodestar/context.md"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(contextDir, "context.md"),
    `${base}\n${scopeMarkdown([
      ["mode", "changed-since"],
      ["baseline-ref", "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"],
    ])}\n`,
  );
  const result = run(["validate-input", "--root", tmp]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /does not resolve/);
  assert.match(result.stderr, /deadbeefdeadbeefdeadbeefdeadbeefdeadbeef/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("changed-files includes rename and untracked, excludes deletion", () => {
  const tmp = fs.mkdtempSync(path.join(ROOT, "tests/fixtures/.tmp-changed-"));
  gitOk(tmp, ["init", "-b", "main"]);
  gitOk(tmp, ["config", "user.email", "test@example.com"]);
  gitOk(tmp, ["config", "user.name", "Test"]);
  const contextDir = path.join(tmp, ".agents", "lodestar");
  fs.mkdirSync(contextDir, { recursive: true });
  const base = fs.readFileSync(
    path.join(VALID, ".agents/lodestar/context.md"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(contextDir, "context.md"),
    `${base}\n## Audit Configuration\n\n### Excluded Paths\n\n- \`**/generated/**\` — generated\n`,
  );
  fs.writeFileSync(path.join(tmp, "kept.ts"), "a\n");
  fs.writeFileSync(path.join(tmp, "renamed-from.ts"), "b\n");
  fs.writeFileSync(path.join(tmp, "deleted.ts"), "c\n");
  gitOk(tmp, ["add", "."]);
  gitOk(tmp, ["commit", "-m", "base"]);
  const since = gitOk(tmp, ["rev-parse", "HEAD"]).stdout.trim();
  gitOk(tmp, ["mv", "renamed-from.ts", "renamed-to.ts"]);
  fs.unlinkSync(path.join(tmp, "deleted.ts"));
  fs.writeFileSync(path.join(tmp, "untracked.ts"), "d\n");
  fs.mkdirSync(path.join(tmp, "generated"));
  fs.writeFileSync(path.join(tmp, "generated", "skip.ts"), "e\n");
  gitOk(tmp, ["add", "-u"]);
  gitOk(tmp, ["commit", "-m", "change"]);
  const result = run(["changed-files", "--root", tmp, "--since", since]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(payload, ["renamed-to.ts", "untracked.ts"]);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("changed-since fixture parses mode and baseline", () => {
  const parsed = parseAuditScope(
    fs.readFileSync(
      path.join(CHANGED_SINCE, ".agents/lodestar/context.md"),
      "utf8",
    ),
  );
  assert.equal(parsed.mode, "changed-since");
  assert.equal(parsed.baselineRef, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.equal(parsed.baselineDate, "2026-08-18");
});

test("scoped-backlog fixture mixes in_scope and still validates", () => {
  const result = run(["validate-output", "--path", SCOPED]);
  assert.equal(result.status, 0, result.stderr);
  const parsed = parseFindings(fs.readFileSync(SCOPED, "utf8"));
  assert.equal(parsed.findings.length, 2);
  assert.equal(parsed.findings[0].in_scope, true);
  assert.equal(parsed.findings[1].in_scope, false);
  const inScope = parsed.findings.filter((item) => item.in_scope).length;
  const backlog = parsed.findings.filter((item) => !item.in_scope).length;
  assert.equal(inScope + backlog, parsed.findings.length);
});

test("scriptNameFromCommand accepts manager run forms and skips the rest", () => {
  assert.equal(
    scriptNameFromCommand("pnpm run typecheck", "pnpm"),
    "typecheck",
  );
  assert.equal(scriptNameFromCommand("pnpm test", "pnpm"), "test");
  assert.equal(scriptNameFromCommand("npm run lint", "npm"), "lint");
  assert.equal(scriptNameFromCommand("npm test", "npm"), "test");
  assert.equal(scriptNameFromCommand("pnpm install", "pnpm"), null);
  assert.equal(scriptNameFromCommand("pnpm -r test", "pnpm"), null);
  assert.equal(scriptNameFromCommand("make test", "pnpm"), null);
  assert.equal(scriptNameFromCommand("n/a", "pnpm"), null);
  assert.equal(scriptNameFromCommand("bun test", "bun"), null);
  assert.equal(scriptNameFromCommand("npm lint", "npm"), null);
});

test("parseLayoutSource reads the Build & Test row and ignores absence", () => {
  assert.equal(
    parseLayoutSource(
      "## Build & Test\n\n| Command | Run |\n| --- | --- |\n| layout-source | pnpm-workspace.yaml |\n\n## Package Layout\n",
    ),
    "pnpm-workspace.yaml",
  );
  assert.equal(
    parseLayoutSource("## Build & Test\n\n| test | pnpm test |\n"),
    null,
  );
});

test("check-freshness fresh-workspace exits 0 and skips install", () => {
  const result = run(["check-freshness", "--root", FRESH]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.fresh, true);
  assert.equal(payload.layoutSource, "pnpm-workspace.yaml");
  assert.equal(payload.drift.length, 0);
  assert.equal(
    payload.skipped.some(
      (item) => item.fact === "install" && item.reason === "not script-shaped",
    ),
    true,
  );
});

test("check-freshness names a workspace package missing from the layout table", () => {
  const result = run(["check-freshness", "--root", DRIFT_PKG]);
  assert.equal(result.status, 2, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.fresh, false);
  const missing = payload.drift.filter(
    (item) => item.fact === "missing-package",
  );
  assert.equal(missing.length, 1);
  assert.equal(missing[0].observed, "packages/worker");
  assert.match(result.stderr, /missing package: packages\/worker/);
});

test("check-freshness reports a renamed root script as stale", () => {
  const result = run(["check-freshness", "--root", DRIFT_CMD]);
  assert.equal(result.status, 2, result.stderr);
  const payload = JSON.parse(result.stdout);
  const stale = payload.drift.filter((item) => item.fact === "stale-command");
  assert.equal(stale.length, 1);
  assert.equal(stale[0].name, "test");
  assert.equal(stale[0].recorded, "pnpm test");
  assert.match(result.stderr, /stale command `test`/);
});

test("check-freshness skips n/a, make, and Scannable no", () => {
  const result = run(["check-freshness", "--root", DRIFT_EXCL]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.fresh, true);
  assert.equal(payload.drift.length, 0);
  const reasons = payload.skipped.map((item) => `${item.fact}:${item.reason}`);
  assert.equal(reasons.includes("typecheck:n/a"), true);
  assert.equal(reasons.includes("test:not script-shaped"), true);
});

test("check-freshness valid fixture skips both checks and exits 0", () => {
  const result = run(["check-freshness", "--root", VALID]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.fresh, true);
  assert.equal(payload.layoutSource, null);
  assert.equal(
    payload.skipped.some(
      (item) =>
        item.check === "missing-package" &&
        item.reason === "no layout-source row",
    ),
    true,
  );
  assert.equal(
    payload.skipped.some((item) => item.reason === "no root package.json"),
    true,
  );
});

test("check-freshness bun fixture skips command facts", () => {
  const result = run(["check-freshness", "--root", BUN]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.fresh, true);
  assert.equal(
    payload.skipped.some((item) => item.reason === "no root package.json"),
    true,
  );
});

test("check-freshness pkg-manager row skips command facts", () => {
  const result = run(["check-freshness", "--root", SINGLE]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(
    payload.skipped.some(
      (item) => item.reason === "pkg-manager row rather than a lockfile",
    ),
    true,
  );
});

test("checkFreshness --facts commands ignores layout drift", () => {
  const full = checkFreshness(DRIFT_PKG);
  const commandsOnly = checkFreshness(DRIFT_PKG, {
    facts: { layout: false, commands: true },
  });
  assert.equal(full.fresh, false);
  assert.equal(commandsOnly.fresh, true);
});

test("check-freshness --facts commands does not parse Package Layout", () => {
  const result = run([
    "check-freshness",
    "--root",
    PLACEHOLDER,
    "--facts",
    "commands",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.fresh, true);
});

test("check-freshness unknown --facts exits 1", () => {
  const result = run(["check-freshness", "--root", FRESH, "--facts", "nope"]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /unknown --facts value: nope/);
});

test("check-freshness glob layout rows cover matching members", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-fresh-glob-"));
  fs.writeFileSync(path.join(tmp, "pnpm-lock.yaml"), "");
  fs.writeFileSync(
    path.join(tmp, "pnpm-workspace.yaml"),
    'packages:\n  - "apps/*"\n',
  );
  fs.writeFileSync(
    path.join(tmp, "package.json"),
    JSON.stringify({ private: true, scripts: { test: "echo" } }),
  );
  fs.mkdirSync(path.join(tmp, "apps/web/src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "apps/web/src/index.ts"), "export {};\n");
  fs.mkdirSync(path.join(tmp, ".agents/lodestar"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, ".agents/lodestar/context.md"),
    `# Fixture

## Build & Test

| Command       | Run                 |
| ------------- | ------------------- |
| test          | pnpm test           |
| layout-source | pnpm-workspace.yaml |

## Package Layout

| Package | Path        | Alias | Responsibility                     |
| ------- | ----------- | ----- | ---------------------------------- |
| web     | apps/*/src  | n/a   | HTTP routes and request validation |
`,
  );
  const result = run(["check-freshness", "--root", tmp]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).fresh, true);
});

test("check-freshness skips the root workspace member .", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-fresh-dot-"));
  fs.writeFileSync(path.join(tmp, "pnpm-lock.yaml"), "");
  fs.writeFileSync(
    path.join(tmp, "pnpm-workspace.yaml"),
    'packages:\n  - "."\n  - "packages/*"\n',
  );
  fs.writeFileSync(
    path.join(tmp, "package.json"),
    JSON.stringify({ private: true, scripts: { test: "echo" } }),
  );
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src/index.ts"), "export {};\n");
  fs.mkdirSync(path.join(tmp, "packages/core/src"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "packages/core/src/index.ts"),
    "export {};\n",
  );
  fs.mkdirSync(path.join(tmp, ".agents/lodestar"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, ".agents/lodestar/context.md"),
    `# Fixture

## Build & Test

| Command       | Run                 |
| ------------- | ------------------- |
| test          | pnpm test           |
| layout-source | pnpm-workspace.yaml |

## Package Layout

| Package | Path              | Alias      | Responsibility                            |
| ------- | ----------------- | ---------- | ----------------------------------------- |
| app     | src               | n/a        | HTTP routes and request validation        |
| core    | packages/core/src | @repo/core | Domain entities and use cases for billing |
`,
  );
  const result = run(["check-freshness", "--root", tmp]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.fresh, true);
  assert.equal(
    payload.drift.some((item) => item.observed === "."),
    false,
  );
});

test("derive-direction round-trips the cyclic fixture", () => {
  const result = run(["derive-direction", "--root", CYCLIC]);
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.cyclic, true);
  assert.equal(payload.chain, null);
  assert.equal(payload.edges.length, 2);
  const parsed = parseDirection(
    `## Dependency Direction\n\n${payload.markdown}\n## Package Layout\n`,
  );
  assert.equal(parsed.cyclic, true);
  assert.equal(parsed.chain, null);
  assert.equal(parsed.edges.length, 2);
});

test("derive-direction round-trips an acyclic import graph", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-dir-"));
  fs.mkdirSync(path.join(tmp, "packages/core/src"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "packages/api/src"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "packages/core/src/index.ts"),
    "export const value = 1;\n",
  );
  fs.writeFileSync(
    path.join(tmp, "packages/api/src/index.ts"),
    'import { value } from "@repo/core";\nexport const route = value;\n',
  );
  fs.mkdirSync(path.join(tmp, ".agents/lodestar"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, ".agents/lodestar/context.md"),
    `# Fixture

## Package Layout

| Package | Path              | Alias      | Responsibility                            |
| ------- | ----------------- | ---------- | ----------------------------------------- |
| core    | packages/core/src | @repo/core | Domain entities and use cases for billing |
| api     | packages/api/src  | @repo/api  | HTTP routes and request validation        |
`,
  );
  const derived = deriveDirection(tmp);
  assert.equal(derived.cyclic, false);
  assert.deepEqual(derived.chain, ["api", "core"]);
  const parsed = parseDirection(
    `## Dependency Direction\n\n${derived.markdown}\n## Package Layout\n`,
  );
  assert.equal(parsed.cyclic, false);
  assert.deepEqual(parsed.chain, ["api", "core"]);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("derive-direction honors Excluded Paths", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-dir-ex-"));
  fs.mkdirSync(path.join(tmp, "packages/core/src"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "packages/api/src/generated"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(tmp, "packages/core/src/index.ts"),
    "export const value = 1;\n",
  );
  fs.writeFileSync(
    path.join(tmp, "packages/api/src/generated/client.ts"),
    'import { value } from "@repo/core";\nexport const route = value;\n',
  );
  fs.mkdirSync(path.join(tmp, ".agents/lodestar"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, ".agents/lodestar/context.md"),
    `# Fixture

## Package Layout

| Package | Path              | Alias      | Responsibility                            |
| ------- | ----------------- | ---------- | ----------------------------------------- |
| core    | packages/core/src | @repo/core | Domain entities and use cases for billing |
| api     | packages/api/src  | @repo/api  | HTTP routes and request validation        |

## Audit Configuration

### Excluded Paths

**Not audited**

- \`**/generated/**\` — codegen
`,
  );
  const derived = deriveDirection(tmp);
  assert.equal(derived.edges.length, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});
