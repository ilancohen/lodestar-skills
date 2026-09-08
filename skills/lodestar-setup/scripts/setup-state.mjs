#!/usr/bin/env node
/**
 * Bounded setup-state collector. Complete state stays in an OS-temp JSON file;
 * stdout is a capped review projection (or a small write/results summary).
 *
 * Subcommands:
 *   collect --root DIR --out FILE [--skill-dir DIR]
 *   permissions-projection --state FILE
 *   write-context --root DIR --state FILE --corrections FILE
 *   record-result --results FILE --op ID --status changed|skipped|failed [--path REL] [--remedy TEXT]
 *   summarize-results --results FILE [--state FILE]
 *   cleanup --state FILE --corrections FILE --results FILE
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectLinter, formatLintCell } from "./detect-linter.mjs";
import { observeDocsLayout, parseDocsLayout } from "./discover-docs.mjs";
import {
  installFallowCommand,
  parsePkgManagerRow,
  readRootPackageJson,
  resolvePkgManager,
} from "./pkg-manager.mjs";
import {
  atomicWrite,
  capText,
  cleanupCapture,
  fail,
  isMain,
  parseArgs,
  posixPath,
  printJson,
  sortKeysDeep,
  sortedJson,
  spawnCaptureToTemp,
} from "./runtime.mjs";
import { listDeclaredMembers } from "./workspace-layout.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SETUP_SKILL_DIR = path.resolve(HERE, "..");

export const STATE_VERSION = 1;
export const MAX_STDOUT_BYTES = 16 * 1024;
export const MAX_FAILURE_BYTES = 1024;
export const CAP_PACKAGES = 20;
export const CAP_LIST = 10;

const BASE_EXTS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
];
const FRAMEWORK_EXTS = [".vue", ".svelte"];
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".output",
  "coverage",
  ".turbo",
  ".cache",
]);

const PRE09_HEADINGS = [
  "Audit Settings",
  "Audit Scope",
  "Git",
  "Excluded Paths",
  "Principles",
  "Skills",
  "Audit Output",
];

const PRESERVE_AUDIT_KEYS = new Set([
  "categories",
  "output-root",
  "fallow",
  "scan-extensions",
  "mode",
  "baseline-ref",
  "baseline-date",
]);

const CONVENTION_KEYS = [
  "result-types",
  "branded-types",
  "barrel-exports",
  "design-tokens",
  "coverage-floor",
];

const SKILL_LABELS = {
  "lodestar-setup": "Setup",
  "lodestar-audit": "Audit",
  "lodestar-fix": "Fix audit items",
  "lodestar-architecture": "Review architecture",
  "lodestar-plan": "Write a plan",
  "lodestar-implement": "Implement a plan",
  "lodestar-docs": "Prune leftover docs",
};

const SKILL_WHEN = {
  "lodestar-setup": "Re-scaffold or refresh this file",
  "lodestar-audit":
    "Scan the codebase and emit action-item files under the `output-root` in Audit Configuration",
  "lodestar-fix": "Triage and apply fixes from an audit run",
  "lodestar-architecture":
    "Get an advisory second opinion on the layout above; optionally have it propose an alternative",
  "lodestar-plan":
    "Multi-stage or cross-package work that needs an implementable plan",
  "lodestar-implement": "Execute a plan one stage at a time",
  "lodestar-docs":
    "Harvest then delete leftover audit, architecture, and plan writeups; optional",
};

function usage() {
  process.stderr.write(`Usage: setup-state <command> [options]

Commands:
  collect --root DIR --out FILE [--skill-dir DIR]
  permissions-projection --state FILE
  write-context --root DIR --state FILE --corrections FILE
  record-result --results FILE --op ID --status changed|skipped|failed [--path REL] [--remedy TEXT]
  summarize-results --results FILE
  cleanup [--state FILE] [--corrections FILE] [--results FILE]
`);
}

function requireFlag(flags, name) {
  const value = flags[name];
  if (!value || value === true) fail(`${name} requires a path`, 2);
  return value;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  atomicWrite(filePath, sortedJson(value));
}

function existsFile(root, relative) {
  const full = path.join(root, relative);
  return fs.existsSync(full) && fs.statSync(full).isFile();
}

function existsDir(root, relative) {
  const full = path.join(root, relative);
  return fs.existsSync(full) && fs.statSync(full).isDirectory();
}

function discoverSiblings(skillDir) {
  const parent = path.dirname(path.resolve(skillDir));
  if (!fs.existsSync(parent)) return [];
  return fs
    .readdirSync(parent, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && entry.name.startsWith("lodestar-"),
    )
    .filter((entry) => fs.existsSync(path.join(parent, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

function siblingPath(skillDir, siblingName, ...parts) {
  return path.join(path.dirname(path.resolve(skillDir)), siblingName, ...parts);
}

function countScannable(root, extraExts = []) {
  const include = new Set([...BASE_EXTS, ...FRAMEWORK_EXTS, ...extraExts]);
  const counts = {};
  const other = {};
  let total = 0;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === "." || entry.name === "..") continue;
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!ext) continue;
      if (include.has(ext)) {
        counts[ext] = (counts[ext] || 0) + 1;
        total += 1;
      } else if (
        [".py", ".go", ".rs", ".java", ".kt", ".rb", ".php", ".cs"].includes(
          ext,
        )
      ) {
        other[ext] = (other[ext] || 0) + 1;
      }
    }
  }
  return {
    counts: sortKeysDeep(counts),
    other: sortKeysDeep(other),
    total,
  };
}

function pickScript(scripts, names) {
  for (const name of names) {
    if (typeof scripts?.[name] === "string" && scripts[name].trim()) {
      return { script: name, command: `run:${name}`, raw: scripts[name] };
    }
  }
  return null;
}

function collectCommands(root, pkg, pkgManager) {
  const scripts =
    pkg?.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};
  const manager = pkgManager?.pkgManager || pkgManager?.name || null;
  // Prefer conventional script names; store what a developer types.
  // Unresolved manager → n/a (never guess npm).
  const install =
    manager === "pnpm"
      ? "pnpm install"
      : manager === "yarn"
        ? "yarn install"
        : manager === "bun"
          ? "bun install"
          : manager === "npm"
            ? "npm install"
            : manager
              ? `${manager} install`
              : "n/a";
  const build = pickScript(scripts, ["build"]);
  const typecheck = pickScript(scripts, [
    "typecheck",
    "type-check",
    "tsc",
    "check:types",
  ]);
  const lint = pickScript(scripts, ["lint", "eslint", "lint:check", "lint:ci"]);
  const test = pickScript(scripts, ["test", "test:ci", "check"]);
  const fmt = (hit) => {
    if (!hit || !manager) return "n/a";
    if (manager === "npm") return `npm run ${hit.script}`;
    if (manager === "pnpm") return `pnpm ${hit.script}`;
    if (manager === "yarn") return `yarn ${hit.script}`;
    if (manager === "bun") return `bun run ${hit.script}`;
    return `${manager} run ${hit.script}`;
  };
  const layoutCandidates = [
    "pnpm-workspace.yaml",
    "package.json",
    "nx.json",
    "lerna.json",
    "turbo.json",
  ];
  let layoutSource = null;
  for (const candidate of layoutCandidates) {
    if (!existsFile(root, candidate)) continue;
    if (candidate === "package.json") {
      const workspaces = pkg?.workspaces;
      const has =
        Array.isArray(workspaces) || Array.isArray(workspaces?.packages);
      if (!has) continue;
    }
    if (candidate === "turbo.json") {
      // turbo often coexists; prefer true workspace declarations first
      continue;
    }
    layoutSource = candidate;
    break;
  }
  if (!layoutSource && existsFile(root, "turbo.json"))
    layoutSource = "turbo.json";
  return {
    install,
    build: fmt(build),
    typecheck: fmt(typecheck),
    lint: fmt(lint),
    test: fmt(test),
    layoutSource,
  };
}

function packageAlias(pkgJson) {
  if (!pkgJson || typeof pkgJson !== "object") return "n/a";
  if (typeof pkgJson.name === "string" && pkgJson.name.startsWith("@")) {
    return pkgJson.name;
  }
  return "n/a";
}

function packageEntryPoints(pkgJson) {
  if (!pkgJson || typeof pkgJson !== "object") return ["index.ts"];
  const entries = new Set();
  if (pkgJson.exports && typeof pkgJson.exports === "object") {
    for (const [key, value] of Object.entries(pkgJson.exports)) {
      if (key === "." || key === "./") {
        const target =
          typeof value === "string"
            ? value
            : value?.import || value?.require || value?.default;
        if (typeof target === "string") entries.add(posixPath(target));
      }
    }
  }
  if (typeof pkgJson.main === "string") entries.add(posixPath(pkgJson.main));
  if (typeof pkgJson.types === "string") entries.add(posixPath(pkgJson.types));
  if (!entries.size) entries.add("index.ts");
  return [...entries].sort();
}

function pathLooksScannable(root, relative) {
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) return { scannable: "yes", language: "" };
  const stack = [full];
  let seen = 0;
  while (stack.length && seen < 200) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(child);
        continue;
      }
      seen += 1;
      const ext = path.extname(entry.name).toLowerCase();
      if (BASE_EXTS.includes(ext) || FRAMEWORK_EXTS.includes(ext)) {
        return { scannable: "yes", language: "" };
      }
      if (ext === ".py") return { scannable: "no", language: "Python" };
      if (ext === ".go") return { scannable: "no", language: "Go" };
      if (ext === ".rs") return { scannable: "no", language: "Rust" };
    }
  }
  return { scannable: "yes", language: "" };
}

function collectPackages(root, layoutSource) {
  const packages = [];
  if (layoutSource) {
    const declared = listDeclaredMembers(root, layoutSource);
    if (declared.members?.length) {
      for (const member of declared.members) {
        const pkgJson = readRootPackageJson(path.join(root, member)) || {};
        const name =
          typeof pkgJson.name === "string"
            ? pkgJson.name.replace(/^@[^/]+\//, "")
            : path.basename(member);
        const srcRel = existsDir(root, `${member}/src`)
          ? `${member}/src`
          : member;
        const scan = pathLooksScannable(root, srcRel);
        packages.push({
          name,
          path: posixPath(srcRel),
          alias: packageAlias(pkgJson),
          responsibility: "",
          scannable: scan.scannable,
          language: scan.language,
          entryPoints: packageEntryPoints(pkgJson),
        });
      }
      return { source: layoutSource, packages: packages.sort(byName) };
    }
  }

  // Non-root package.json discovery (bounded depth).
  const found = [];
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    if (depth > 3) continue;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push({ dir: full, depth: depth + 1 });
        continue;
      }
      if (entry.name !== "package.json" || dir === root) continue;
      found.push(posixPath(path.relative(root, dir)));
    }
  }
  if (found.length) {
    for (const member of found.sort()) {
      const pkgJson = readRootPackageJson(path.join(root, member)) || {};
      const name =
        typeof pkgJson.name === "string"
          ? pkgJson.name.replace(/^@[^/]+\//, "")
          : path.basename(member);
      const srcRel = existsDir(root, `${member}/src`)
        ? `${member}/src`
        : member;
      const scan = pathLooksScannable(root, srcRel);
      packages.push({
        name,
        path: posixPath(srcRel),
        alias: packageAlias(pkgJson),
        responsibility: "",
        scannable: scan.scannable,
        language: scan.language,
        entryPoints: packageEntryPoints(pkgJson),
      });
    }
    return { source: layoutSource, packages: packages.sort(byName) };
  }

  // Single-package heuristics.
  const rootPkg = readRootPackageJson(root) || {};
  const name =
    typeof rootPkg.name === "string"
      ? rootPkg.name.replace(/^@[^/]+\//, "")
      : path.basename(root);
  if (existsDir(root, "src")) {
    const features = fs
      .readdirSync(path.join(root, "src"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !SKIP_DIRS.has(entry.name))
      .map((entry) => entry.name)
      .sort();
    if (features.length >= 2) {
      for (const feature of features) {
        const rel = `src/${feature}`;
        const scan = pathLooksScannable(root, rel);
        packages.push({
          name: feature,
          path: rel,
          alias: "n/a",
          responsibility: "",
          scannable: scan.scannable,
          language: scan.language,
          entryPoints: ["index.ts"],
        });
      }
      return { source: layoutSource, packages: packages.sort(byName) };
    }
    const scan = pathLooksScannable(root, "src");
    packages.push({
      name,
      path: "src",
      alias: packageAlias(rootPkg),
      responsibility: "",
      scannable: scan.scannable,
      language: scan.language,
      entryPoints: packageEntryPoints(rootPkg),
    });
    return { source: layoutSource, packages };
  }
  const scan = pathLooksScannable(root, ".");
  packages.push({
    name,
    path: ".",
    alias: packageAlias(rootPkg),
    responsibility: "",
    scannable: scan.scannable,
    language: scan.language,
    entryPoints: packageEntryPoints(rootPkg),
  });
  return { source: layoutSource, packages };
}

function byName(a, b) {
  return String(a.name).localeCompare(String(b.name), "en");
}

function firstHitFile(root, candidates) {
  for (const relative of candidates) {
    if (existsFile(root, relative)) return posixPath(relative);
  }
  return null;
}

function grepFirst(root, globs, pattern, maxFiles = 40) {
  const re = typeof pattern === "string" ? new RegExp(pattern) : pattern;
  const stack = [root];
  let checked = 0;
  while (stack.length && checked < maxFiles) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = posixPath(path.relative(root, full));
      if (globs && !globs.some((g) => rel.includes(g) || rel.endsWith(g))) {
        continue;
      }
      checked += 1;
      let text;
      try {
        text = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      if (re.test(text)) return rel;
    }
  }
  return null;
}

function collectConventionEvidence(root, packages) {
  const evidence = {};
  const pkgRoots = packages.map((row) =>
    row.path.endsWith("/src") ? row.path.slice(0, -4) : row.path,
  );

  // result-types
  let hit = null;
  for (const pkgRoot of pkgRoots) {
    for (const candidate of [
      `${pkgRoot}/src/result.ts`,
      `${pkgRoot}/result.ts`,
      `${pkgRoot}/src/either.ts`,
      `${pkgRoot}/either.ts`,
      `${pkgRoot}/src/index.ts`,
      `${pkgRoot}/index.ts`,
    ]) {
      if (!existsFile(root, candidate)) continue;
      const text = fs.readFileSync(path.join(root, candidate), "utf8");
      if (
        /\b(Result|Either)\b/.test(text) ||
        /\bok:\s*(true|false)/.test(text)
      ) {
        hit = posixPath(candidate);
        break;
      }
    }
    if (hit) break;
  }
  evidence["result-types"] = { path: hit, found: Boolean(hit) };

  hit = grepFirst(
    root,
    pkgRoots.length ? pkgRoots : ["src"],
    /readonly\s+__brand/,
  );
  evidence["branded-types"] = { path: hit, found: Boolean(hit) };

  hit = null;
  for (const pkgRoot of pkgRoots) {
    for (const candidate of [
      `${pkgRoot}/src/index.ts`,
      `${pkgRoot}/index.ts`,
    ]) {
      if (!existsFile(root, candidate)) continue;
      const text = fs.readFileSync(path.join(root, candidate), "utf8");
      if (/export\s+\*/.test(text)) {
        hit = posixPath(candidate);
        break;
      }
    }
    if (hit) break;
  }
  evidence["barrel-exports"] = { path: hit, found: Boolean(hit) };

  hit = firstHitFile(root, [
    "tokens.css",
    "theme.ts",
    "src/tokens.css",
    "src/theme.ts",
    ...pkgRoots.flatMap((p) => [`${p}/tokens.css`, `${p}/theme.ts`]),
  ]);
  if (!hit) {
    hit = grepFirst(root, [".css", "src"], /:root\s*\{[^}]*--/, 20);
  }
  evidence["design-tokens"] = { path: hit, found: Boolean(hit) };

  hit = null;
  for (const candidate of [
    "vitest.config.ts",
    "vitest.config.mjs",
    "vitest.config.js",
    "jest.config.js",
    "jest.config.ts",
    "jest.config.mjs",
    ".c8rc",
    ".c8rc.json",
  ]) {
    if (!existsFile(root, candidate)) continue;
    const text = fs.readFileSync(path.join(root, candidate), "utf8");
    if (/thresholds|coverageThreshold|lines\s*:/.test(text)) {
      hit = candidate;
      break;
    }
  }
  evidence["coverage-floor"] = { path: hit, found: Boolean(hit) };

  return evidence;
}

function collectRubricPaths(root, docsRows) {
  const paths = [];
  const add = (relative) => {
    const rel = posixPath(relative);
    if (!rel || paths.includes(rel)) return;
    if (existsFile(root, rel) || existsDir(root, rel)) paths.push(rel);
  };
  for (const name of ["CONTRIBUTING.md", "AGENTS.md", "CLAUDE.md"]) add(name);
  if (existsDir(root, ".cursor/rules")) {
    for (const name of fs
      .readdirSync(path.join(root, ".cursor/rules"))
      .sort()) {
      if (/\.(md|mdc)$/i.test(name)) add(`.cursor/rules/${name}`);
    }
  }
  if (existsDir(root, ".claude/rules")) {
    for (const name of fs
      .readdirSync(path.join(root, ".claude/rules"))
      .sort()) {
      if (/\.md$/i.test(name)) add(`.claude/rules/${name}`);
    }
  }
  add(".cursorrules");
  add(".github/copilot-instructions.md");
  for (const row of docsRows || []) {
    for (const name of ["CONTRIBUTING.md", "STYLE.md", "CONVENTIONS.md"]) {
      const candidate = `${row.path}/${name}`;
      if (existsFile(root, candidate)) {
        add(candidate);
        break;
      }
    }
    if (existsDir(root, row.path)) {
      try {
        const names = fs.readdirSync(path.join(root, row.path));
        const coding = names.find((n) => /coding.*standard/i.test(n));
        if (coding) add(`${row.path}/${coding}`);
      } catch {
        // ignore
      }
    }
  }
  return paths.sort();
}

function parseExistingContext(root) {
  const contextPath = ".agents/lodestar/context.md";
  const full = path.join(root, contextPath);
  const agentsPath = "AGENTS.md";
  const agentsFull = path.join(root, agentsPath);
  const result = {
    contextPath,
    contextExists: fs.existsSync(full),
    agentsExists: fs.existsSync(agentsFull),
    agentsHasLodestar: false,
    legacyAgentsSections: [],
    contextIsLegacy: false,
    conventions: null,
    docsLayout: null,
    packageLayout: null,
    rubricPaths: [],
    auditRows: {},
    projectDescription: null,
    dependencyPolicy: null,
  };
  if (result.agentsExists) {
    const text = fs.readFileSync(agentsFull, "utf8");
    result.agentsHasLodestar = /^## Lodestar\s*$/m.test(text);
    for (const name of [
      "Package Layout",
      "Build & Test",
      "Commands",
      "Skills",
    ]) {
      if (new RegExp(`^## ${name}\\s*$`, "m").test(text)) {
        result.legacyAgentsSections.push(name);
      }
    }
  }
  if (!result.contextExists) return result;
  const text = fs.readFileSync(full, "utf8");
  result.contextIsLegacy = PRE09_HEADINGS.some((name) =>
    new RegExp(`^## ${name}\\s*$`, "m").test(text),
  );
  result.conventions = parseConventionsTable(text);
  try {
    result.docsLayout = parseDocsLayout(text);
  } catch {
    result.docsLayout = null;
  }
  result.packageLayout = parsePackageLayoutSoft(text);
  result.rubricPaths = parseRubricBullets(text);
  result.auditRows = parseAuditRows(text);
  result.projectDescription = parseProjectBlurb(text);
  result.dependencyPolicy = parseDependencyPolicyBody(text);
  return result;
}

function parsePackageLayoutSoft(text) {
  const tableStart = String(text).search(/^## Package Layout\s*$/m);
  if (tableStart === -1) return null;
  const rest = String(text).slice(tableStart);
  const nextHeading = rest.search(/\n## /);
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
  const rows = [];
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 4) continue;
    if (/^-+$/.test(cells[0].replace(/:/g, "-"))) continue;
    if (/^package$/i.test(cells[0]) || /^name$/i.test(cells[0])) continue;
    rows.push({
      name: cells[0].replace(/^`+|`+$/g, ""),
      path: posixPath(cells[1].replace(/^`+|`+$/g, "")),
      alias: cells[2].replace(/^`+|`+$/g, ""),
      responsibility: cells[3].replace(/^`+|`+$/g, "").trim(),
      scannable: cells[4] || "yes",
      entryPoints: cells[5] || "index.ts",
    });
  }
  return rows.length ? rows : null;
}

function parseConventionsTable(text) {
  const heading = text.search(/^## Conventions\s*$/m);
  if (heading === -1) return null;
  const rest = text.slice(heading);
  const next = rest.search(/\n## /);
  const section = next === -1 ? rest : rest.slice(0, next);
  const values = {};
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/^`+|`+$/g, ""));
    if (cells.length < 2) continue;
    if (/^convention$/i.test(cells[0]) || /^-+$/.test(cells[0])) continue;
    if (CONVENTION_KEYS.includes(cells[0])) values[cells[0]] = cells[1];
  }
  return Object.keys(values).length ? values : null;
}

function parseRubricBullets(text) {
  const heading = text.search(/^## Review Rubric\s*$/m);
  if (heading === -1) return [];
  const rest = text.slice(heading);
  const next = rest.search(/\n## /);
  const section = next === -1 ? rest : rest.slice(0, next);
  const paths = [];
  for (const line of section.split(/\r?\n/)) {
    const match = line.match(/^\s*[-*]\s+`?([^`]+)`?\s*$/);
    if (!match) continue;
    const value = match[1].trim();
    if (!value || /^\[/.test(value)) continue;
    paths.push(posixPath(value));
  }
  return paths;
}

function parseAuditRows(text) {
  const heading = text.search(/^## Audit Configuration\s*$/m);
  if (heading === -1) return {};
  const rest = text.slice(heading);
  const next = rest.search(/\n## /);
  const section = next === -1 ? rest : rest.slice(0, next);
  const rows = {};
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;
    const key = cells[0].replace(/^`+|`+$/g, "");
    if (!key || /^key$/i.test(key) || /^-+$/.test(key.replace(/`/g, ""))) {
      continue;
    }
    rows[key] = {
      value: cells[1].replace(/^`+|`+$/g, ""),
      notes: (cells[2] || "").trim(),
    };
  }
  return rows;
}

function parseProjectBlurb(text) {
  const heading = text.search(/^## Project\s*$/m);
  if (heading === -1) return null;
  const rest = text.slice(heading + "## Project".length);
  const next = rest.search(/\n## /);
  const body = (next === -1 ? rest : rest.slice(0, next)).trim();
  if (!body || /^\[/.test(body)) return null;
  return body;
}

function parseDependencyPolicyBody(text) {
  const heading = text.search(/^## Dependency Policy\s*$/m);
  if (heading === -1) return null;
  const rest = text.slice(heading);
  const next = rest.search(/\n## /);
  return next === -1 ? rest : rest.slice(0, next);
}

function collectFrameworkSignals(root, packages) {
  const frameworks = new Set();
  const signals = [];
  const pkgFiles = [
    path.join(root, "package.json"),
    ...packages.map((row) => {
      const base = row.path.endsWith("/src") ? row.path.slice(0, -4) : row.path;
      return path.join(root, base, "package.json");
    }),
  ];
  const deps = new Set();
  for (const file of pkgFiles) {
    if (!fs.existsSync(file)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
      for (const field of ["dependencies", "devDependencies"]) {
        for (const name of Object.keys(pkg[field] || {})) deps.add(name);
      }
    } catch {
      // ignore
    }
  }
  const depMap = [
    ["vue", "vue"],
    ["nuxt", "vue"],
    ["react", "react"],
    ["next", "react"],
    ["svelte", "svelte"],
    ["@sveltejs/kit", "svelte"],
    ["solid-js", "solid"],
    ["@angular/core", "angular"],
  ];
  for (const [dep, framework] of depMap) {
    if (!deps.has(dep)) continue;
    frameworks.add(framework);
    signals.push(`dependency ${dep}`);
  }
  const configs = [
    ["vite.config", "vite"],
    ["nuxt.config", "vue"],
    ["svelte.config", "svelte"],
    ["angular.json", "angular"],
    ["next.config", "react"],
  ];
  for (const [stem, framework] of configs) {
    const hit = fs
      .readdirSync(root)
      .some((name) => name === stem || name.startsWith(`${stem}.`));
    if (!hit) continue;
    frameworks.add(framework);
    signals.push(`config ${stem}`);
  }
  const extFor = {
    vue: ".vue",
    svelte: ".svelte",
    react: ".tsx",
    solid: ".tsx",
    angular: ".ts",
  };
  const scanExtensions = [...BASE_EXTS];
  for (const framework of [...frameworks].sort()) {
    const ext = extFor[framework];
    if (ext && !scanExtensions.includes(ext)) scanExtensions.push(ext);
  }
  if (frameworks.has("vue") && !scanExtensions.includes(".vue")) {
    scanExtensions.push(".vue");
  }
  if (frameworks.has("svelte") && !scanExtensions.includes(".svelte")) {
    scanExtensions.push(".svelte");
  }
  return {
    frameworks: [...frameworks].sort(),
    signals: signals.sort(),
    scanExtensions,
  };
}

function collectExclusions(root) {
  const rows = [];
  const add = (glob, reason, bucket = "excluded") => {
    rows.push({ glob, reason, bucket });
  };
  const markers = [
    ["prisma/schema.prisma", "packages/**/generated/**", "Prisma client"],
    ["codegen.yml", "**/*.gen.ts", "GraphQL codegen"],
    ["codegen.ts", "**/*.gen.ts", "GraphQL codegen"],
    ["codegen.js", "**/*.gen.ts", "GraphQL codegen"],
  ];
  for (const [marker, glob, reason] of markers) {
    if (existsFile(root, marker)) add(glob, reason);
  }
  for (const dir of [
    "generated",
    "__generated__",
    "dist",
    "build",
    ".next",
    ".output",
  ]) {
    if (existsDir(root, dir)) add(`**/${dir}/**`, `${dir} output`);
  }
  add("**/*.test.*", "tests", "tests");
  add("**/*.spec.*", "tests", "tests");
  add("**/__tests__/**", "colocated tests", "tests");
  add("**/tests/**", "tests directory", "tests");
  return rows;
}

function collectCommitPolicy(root) {
  const evidence = {
    commitlint: null,
    hooks: [],
    branch: null,
    recentSubjects: { count: 0, sample: [] },
  };
  for (const name of [
    "commitlint.config.js",
    "commitlint.config.cjs",
    "commitlint.config.mjs",
    "commitlint.config.ts",
    ".commitlintrc",
    ".commitlintrc.js",
    ".commitlintrc.cjs",
    ".commitlintrc.json",
    ".commitlintrc.yml",
    ".commitlintrc.yaml",
  ]) {
    if (existsFile(root, name)) {
      evidence.commitlint = name;
      break;
    }
  }
  const pkg = readRootPackageJson(root);
  if (!evidence.commitlint && pkg?.commitlint)
    evidence.commitlint = "package.json";
  if (existsDir(root, ".husky")) evidence.hooks.push(".husky/");
  for (const name of ["lefthook.yml", "lefthook.yaml"]) {
    if (existsFile(root, name)) evidence.hooks.push(name);
  }
  if (existsDir(root, ".git/hooks")) {
    try {
      const hooks = fs
        .readdirSync(path.join(root, ".git/hooks"))
        .filter((name) => !name.endsWith(".sample"))
        .sort();
      if (hooks.length)
        evidence.hooks.push(...hooks.map((h) => `.git/hooks/${h}`));
    } catch {
      // ignore
    }
  }
  evidence.hooks = [...new Set(evidence.hooks)].sort();

  const captures = [];
  const branchCap = spawnCaptureToTemp(
    "git",
    ["rev-parse", "--abbrev-ref", "HEAD"],
    { cwd: root, prefix: "lodestar-git-branch" },
  );
  captures.push(branchCap);
  if (branchCap.status === 0) {
    evidence.branch = fs.readFileSync(branchCap.outPath, "utf8").trim() || null;
  }

  const logCap = spawnCaptureToTemp("git", ["log", "-n", "20", "--format=%s"], {
    cwd: root,
    prefix: "lodestar-git-subjects",
  });
  captures.push(logCap);
  if (logCap.status === 0) {
    const lines = fs
      .readFileSync(logCap.outPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    evidence.recentSubjects = {
      count: lines.length,
      sample: lines.slice(0, 5),
    };
  }
  for (const cap of captures) cleanupCapture(cap);

  const protectedBranches = [];
  if (evidence.branch === "main" || evidence.branch === "master") {
    protectedBranches.push(evidence.branch);
  }
  return {
    evidence,
    suggested: {
      commits: "ask",
      subjectFormat: evidence.commitlint
        ? "fix(<category>): <slug>"
        : "<category>: <slug>",
      trailer: "Closes <item>.",
      protected: protectedBranches.length ? protectedBranches : ["none"],
      requireClean: "no",
    },
  };
}

function collectAuditScope(root, packages, scanExtensions, failures) {
  if (!fs.existsSync(path.join(root, ".git"))) {
    return {
      noGit: true,
      commitCount: 0,
      firstCommit: null,
      fileCount: 0,
      touched90d: 0,
      churn: 0,
      modeDefault: "all",
    };
  }
  const caps = [];
  const failCmd = (id, remedy, detail) => {
    failures.push({
      command: id,
      remedy,
      detail: capText(detail || "", MAX_FAILURE_BYTES),
    });
  };

  const countCap = spawnCaptureToTemp("git", ["rev-list", "--count", "HEAD"], {
    cwd: root,
    prefix: "lodestar-git-count",
  });
  caps.push(countCap);
  let commitCount = 0;
  if (countCap.status === 0) {
    commitCount = Number(fs.readFileSync(countCap.outPath, "utf8").trim()) || 0;
  } else {
    failCmd(
      "git rev-list --count HEAD",
      "Ensure the repo has at least one commit, or set mode: all.",
      countCap.stderr || countCap.error,
    );
  }

  // Bound history: root commits only, then format the oldest. Do not dump
  // `git log --reverse` (git applies `-n` before `--reverse`).
  const rootsCap = spawnCaptureToTemp(
    "git",
    ["rev-list", "--max-parents=0", "HEAD"],
    { cwd: root, prefix: "lodestar-git-roots" },
  );
  caps.push(rootsCap);
  let firstCommit = null;
  if (rootsCap.status === 0) {
    const rootShas = fs
      .readFileSync(rootsCap.outPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const oldest = rootShas[rootShas.length - 1] || rootShas[0];
    if (oldest) {
      const dateCap = spawnCaptureToTemp(
        "git",
        ["log", "-1", "--format=%ad", "--date=short", oldest],
        { cwd: root, prefix: "lodestar-git-first" },
      );
      caps.push(dateCap);
      if (dateCap.status === 0) {
        firstCommit =
          fs.readFileSync(dateCap.outPath, "utf8").trim().split(/\r?\n/)[0] ||
          null;
      } else {
        failCmd(
          `git log -1 --format=%ad --date=short ${oldest}`,
          "Check git history is readable.",
          dateCap.stderr || dateCap.error,
        );
      }
    }
  } else {
    failCmd(
      "git rev-list --max-parents=0 HEAD",
      "Check git history is readable.",
      rootsCap.stderr || rootsCap.error,
    );
  }

  const lsCap = spawnCaptureToTemp("git", ["ls-files"], {
    cwd: root,
    prefix: "lodestar-git-ls",
  });
  caps.push(lsCap);
  const extSet = new Set(scanExtensions);
  const layoutPrefixes = packages.map((row) => posixPath(row.path));
  let fileCount = 0;
  if (lsCap.status === 0) {
    const tracked = fs
      .readFileSync(lsCap.outPath, "utf8")
      .split(/\r?\n/)
      .map((line) => posixPath(line.trim()))
      .filter(Boolean);
    fileCount = tracked.filter((rel) => {
      const ext = path.posix.extname(rel).toLowerCase();
      if (!extSet.has(ext)) return false;
      if (!layoutPrefixes.length) return true;
      return layoutPrefixes.some(
        (prefix) =>
          prefix === "." || rel === prefix || rel.startsWith(`${prefix}/`),
      );
    }).length;
  } else {
    failCmd(
      "git ls-files",
      "Ensure git index is readable.",
      lsCap.stderr || lsCap.error,
    );
  }

  const churnCap = spawnCaptureToTemp(
    "git",
    ["log", "--since=90.days", "--name-only", "--pretty=format:"],
    { cwd: root, prefix: "lodestar-git-churn" },
  );
  caps.push(churnCap);
  let touched90d = 0;
  if (churnCap.status === 0) {
    const touched = new Set(
      fs
        .readFileSync(churnCap.outPath, "utf8")
        .split(/\r?\n/)
        .map((line) => posixPath(line.trim()))
        .filter(Boolean)
        .filter((rel) => {
          const ext = path.posix.extname(rel).toLowerCase();
          if (!extSet.has(ext)) return false;
          if (!layoutPrefixes.length) return true;
          return layoutPrefixes.some(
            (prefix) =>
              prefix === "." || rel === prefix || rel.startsWith(`${prefix}/`),
          );
        }),
    );
    touched90d = touched.size;
  } else {
    failCmd(
      "git log --since=90.days --name-only --pretty=format:",
      "Ensure git history is readable for churn measurement.",
      churnCap.stderr || churnCap.error,
    );
  }

  for (const cap of caps) cleanupCapture(cap);
  const churn = fileCount === 0 ? 0 : touched90d / fileCount;
  const modeDefault = fileCount >= 80 && churn < 0.3 ? "changed-since" : "all";
  return {
    noGit: false,
    commitCount,
    firstCommit,
    fileCount,
    touched90d,
    churn: Number(churn.toFixed(4)),
    modeDefault,
  };
}

function collectImportEdges(root, packages) {
  const byName = new Map();
  for (const row of packages) {
    byName.set(row.name, row);
    // Also index scoped package.json names when present.
    const memberRoot = path.join(
      root,
      posixPath(row.path).replace(/\/src$/, "") === "."
        ? "."
        : posixPath(row.path).replace(/\/src$/, ""),
    );
    const pkg = readRootPackageJson(memberRoot);
    if (typeof pkg?.name === "string") byName.set(pkg.name, row);
  }
  const edges = [];
  const seen = new Set();
  for (const row of packages) {
    const memberRoot = path.join(
      root,
      posixPath(row.path).replace(/\/src$/, "") === "."
        ? "."
        : posixPath(row.path).replace(/\/src$/, ""),
    );
    const pkg = readRootPackageJson(memberRoot);
    if (!pkg) continue;
    const deps = new Set([
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ]);
    for (const dep of [...deps].sort()) {
      const target = byName.get(dep);
      if (!target || target.name === row.name) continue;
      const key = `${row.name}->${target.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: row.name, to: target.name, via: dep });
    }
  }
  return edges.sort((a, b) =>
    `${a.from}->${a.to}`.localeCompare(`${b.from}->${b.to}`),
  );
}

function collectFallowStatus(skillDir, root, hasAudit, failures) {
  if (!hasAudit) return { attempted: false, status: null };
  const script = siblingPath(
    skillDir,
    "lodestar-audit",
    "scripts",
    "fallow-contract.mjs",
  );
  if (!fs.existsSync(script)) {
    return { attempted: false, status: null, missingScript: true };
  }
  const cap = spawnCaptureToTemp(
    process.execPath,
    [script, "status", "--root", root],
    { cwd: root, prefix: "lodestar-fallow-status" },
  );
  try {
    if (cap.status !== 0) {
      failures.push({
        command: "fallow-contract status",
        remedy:
          "Re-run with lodestar-audit installed, or install a compatible local fallow.",
        detail: capText(
          cap.stderr || cap.error || `exit ${cap.status}`,
          MAX_FAILURE_BYTES,
        ),
      });
      return { attempted: true, status: null };
    }
    const raw = fs.readFileSync(cap.outPath, "utf8");
    try {
      return { attempted: true, status: JSON.parse(raw) };
    } catch (error) {
      failures.push({
        command: "fallow-contract status",
        remedy: "Ensure fallow-contract status prints JSON.",
        detail: capText(error.message, MAX_FAILURE_BYTES),
      });
      return { attempted: true, status: null };
    }
  } finally {
    cleanupCapture(cap);
  }
}

function truncateList(items, limit) {
  const list = Array.isArray(items) ? items : [];
  return {
    items: list.slice(0, limit),
    shown: Math.min(list.length, limit),
    total: list.length,
    truncated: list.length > limit,
  };
}

/** Packages that participate in a bidirectional import edge. */
export function packagesInCycles(importEdges = []) {
  const edgeSet = new Set(
    (importEdges || []).map((edge) => `${edge.from}->${edge.to}`),
  );
  const cyclic = new Set();
  for (const edge of importEdges || []) {
    if (edgeSet.has(`${edge.to}->${edge.from}`)) {
      cyclic.add(edge.from);
      cyclic.add(edge.to);
    }
  }
  return cyclic;
}

/**
 * Review order: unscannable / warning language, then cyclic, then alpha.
 * Full state keeps its own sort; this only affects the projection slice.
 */
export function prioritizePackagesForReview(packages = [], importEdges = []) {
  const cyclic = packagesInCycles(importEdges);
  const rank = (pkg) => {
    if (pkg.scannable === "no" || pkg.language) return 0;
    if (cyclic.has(pkg.name)) return 1;
    return 2;
  };
  return [...packages].sort((a, b) => {
    const delta = rank(a) - rank(b);
    if (delta !== 0) return delta;
    return String(a.name).localeCompare(String(b.name), "en");
  });
}

function gitignoreCoversFallowScratch(root) {
  const full = path.join(root, ".gitignore");
  if (!fs.existsSync(full)) return false;
  let text;
  try {
    text = fs.readFileSync(full, "utf8");
  } catch {
    return false;
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const coversAudit = lines.some(
    (line) =>
      line === ".audit-*.json" ||
      line === "**/.audit-*.json" ||
      line === ".audit-*",
  );
  const coversFallow = lines.some(
    (line) =>
      line === ".fallow/" || line === ".fallow" || line === "**/.fallow/",
  );
  return coversAudit && coversFallow;
}

function readSiblingFallowToolVersion(skillDir) {
  const contractPath = siblingPath(
    skillDir,
    "lodestar-audit",
    "scripts",
    "fallow-contract.json",
  );
  if (!fs.existsSync(contractPath)) return "3.15.0";
  try {
    const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
    return String(contract.tool_version || "3.15.0");
  } catch {
    return "3.15.0";
  }
}

/** Pin-based add-dev command — never append a bare semver range. */
export function composeFallowAddDev(status, pkgManager, toolVersion = "3.15.0") {
  const manager =
    status?.manager || pkgManager?.pkgManager || pkgManager?.name || null;
  const addDevTemplate = status?.addDev || pkgManager?.addDev || null;
  const pin = `^${String(toolVersion).replace(/^\^/, "")}`;
  return installFallowCommand(pin, manager, addDevTemplate);
}

/**
 * Consent rows only — no layout, commands, conventions, or scope recap.
 * Never intentionally truncate the rows list for chat budget.
 */
export function projectPermissions(state) {
  const root = state.root ? path.resolve(String(state.root)) : process.cwd();
  const rows = [];
  const fallowStatus = state.fallow?.status || null;
  const skillDir = state.skillDir
    ? path.resolve(String(state.skillDir))
    : SETUP_SKILL_DIR;
  const toolVersion = readSiblingFallowToolVersion(skillDir);

  if (state.hasAudit) {
    const statusFailed = Boolean(state.fallow?.attempted && !fallowStatus);
    const alreadyOk = Boolean(
      fallowStatus?.declared &&
        fallowStatus?.bin &&
        fallowStatus?.compatible,
    );
    if (!alreadyOk) {
      const verb = fallowStatus?.needsUpgrade ? "upgrade" : "install";
      const command = composeFallowAddDev(
        fallowStatus,
        {
          pkgManager: fallowStatus?.manager || state.pkgManager?.pkgManager,
          addDev: fallowStatus?.addDev || state.pkgManager?.addDev,
        },
        toolVersion,
      );
      rows.push({
        id: "fallow-install",
        defaultTicked: true,
        verb,
        path: "package.json",
        command,
        plainInstall:
          fallowStatus?.needsInstall && !fallowStatus?.needsDeclare
            ? state.commands?.install || null
            : null,
        version: fallowStatus?.version || null,
        consequence: statusFailed || !fallowStatus
          ? "Fallow status could not be read; install/declare a compatible pin before audit can run."
          : "The audit will not run without fallow declared and present in node_modules/.bin.",
      });
    }

    const fallowrcExists = existsFile(root, ".fallowrc.json");
    rows.push({
      id: "fallowrc",
      defaultTicked: true,
      verb: fallowrcExists ? "merge" : "write",
      path: ".fallowrc.json",
      alternative: fallowrcExists ? "replace" : null,
      consequence:
        "Describes which package may import which for Fallow zones (not Dependency Policy in context.md).",
    });

    if (!gitignoreCoversFallowScratch(root)) {
      rows.push({
        id: "gitignore-fallow",
        defaultTicked: true,
        verb: "add",
        path: ".gitignore",
        patterns: [".audit-*.json", ".fallow/"],
        consequence:
          "Scratch files from audit/fallow verify stay uncommitted after an interrupted run.",
      });
    }
  }

  rows.push({
    id: "agents-lodestar",
    defaultTicked: false,
    verb: "add",
    path: "AGENTS.md",
    consequence:
      "Any agent checks the principles before it finishes. Unticked leaves AGENTS.md alone (skills-only).",
  });

  if (state.hasAudit && state.linter?.tool) {
    rows.push({
      id: "linter-tighten",
      defaultTicked: false,
      verb: "tighten",
      path: state.linter.tool,
      consequence:
        "Existing linter rules only — nothing new installed. Audit can report some findings as definite.",
    });
  }

  const legacy = state.existing?.legacyAgentsSections || [];
  if (legacy.length) {
    rows.push({
      id: "agents-cleanup",
      defaultTicked: false,
      verb: "remove",
      path: "AGENTS.md",
      sections: legacy,
      consequence:
        "Strip pre-0.3 lodestar sections whose values now live in context.md. Everything else stays.",
    });
  }

  const projection = {
    stateVersion: state.stateVersion,
    hasAudit: Boolean(state.hasAudit),
    rows,
  };
  const text = `${JSON.stringify(sortKeysDeep(projection), null, 2)}\n`;
  // Consent rows must never be truncated or stripped of consequences.
  if (Buffer.byteLength(text, "utf8") > MAX_STDOUT_BYTES) {
    throw new Error(
      `permissions projection is ${Buffer.byteLength(text, "utf8")} bytes (> ${MAX_STDOUT_BYTES}). ` +
        `Consent rows cannot be truncated — shorten legacyAgentsSections or split the run.`,
    );
  }
  return text;
}

export function projectReview(state) {
  const orderedPackages = prioritizePackagesForReview(
    state.layout?.packages,
    state.importEdges,
  );
  const packages = truncateList(orderedPackages, CAP_PACKAGES);
  const docs = truncateList(state.docs?.rows, CAP_LIST);
  const exclusions = truncateList(state.exclusions, CAP_LIST);
  const rubric = truncateList(state.rubric?.paths, CAP_LIST);
  const importEdges = truncateList(state.importEdges, CAP_LIST);
  const failures = (state.failures || []).map((item) => ({
    command: item.command,
    remedy: item.remedy,
    detail: capText(item.detail || "", MAX_FAILURE_BYTES),
  }));

  const projection = {
    stateVersion: state.stateVersion,
    siblings: state.siblings,
    hasAudit: state.hasAudit,
    scannable: {
      total: state.scannable?.total ?? 0,
      counts: state.scannable?.counts ?? {},
      other: state.scannable?.other ?? {},
    },
    pkgManager: {
      pkgManager: state.pkgManager?.pkgManager ?? null,
      ambiguous: Boolean(state.pkgManager?.ambiguous),
      lockfiles: state.pkgManager?.lockfiles ?? [],
      provenance: state.pkgManager?.provenance ?? "none",
    },
    needsInput: state.needsInput || [],
    commands: state.commands,
    linter: {
      tool: state.linter?.tool ?? null,
      probe: state.linter?.probe ?? null,
      needsProbe: Boolean(state.linter?.needsProbe),
      signalCount: Array.isArray(state.linter?.signals)
        ? state.linter.signals.length
        : 0,
    },
    layout: {
      source: state.layout?.source ?? null,
      packages: packages.items,
      packagesShown: packages.shown,
      packagesTotal: packages.total,
      packagesTruncated: packages.truncated,
    },
    docs: {
      rows: docs.items,
      shown: docs.shown,
      total: docs.total,
      truncated: docs.truncated,
    },
    conventions: {
      suggested: state.conventions?.suggested ?? {},
      recorded: state.conventions?.recorded ?? null,
      evidenceHits: Object.fromEntries(
        Object.entries(state.conventions?.evidence || {}).map(
          ([key, value]) => [
            key,
            Boolean(value && typeof value === "object" ? value.found : value),
          ],
        ),
      ),
    },
    rubric: {
      paths: rubric.items,
      shown: rubric.shown,
      total: rubric.total,
      truncated: rubric.truncated,
    },
    existing: {
      contextExists: state.existing?.contextExists ?? false,
      contextIsLegacy: state.existing?.contextIsLegacy ?? false,
      agentsExists: state.existing?.agentsExists ?? false,
      agentsHasLodestar: state.existing?.agentsHasLodestar ?? false,
      legacyAgentsSections: state.existing?.legacyAgentsSections ?? [],
    },
    failures,
  };

  if (state.hasAudit) {
    projection.frameworks = {
      frameworks: state.frameworks?.frameworks ?? [],
      scanExtensions: state.frameworks?.scanExtensions ?? [],
    };
    projection.exclusions = {
      rows: exclusions.items,
      shown: exclusions.shown,
      total: exclusions.total,
      truncated: exclusions.truncated,
    };
    projection.commitPolicy = {
      suggested: state.commitPolicy?.suggested ?? null,
      evidence: {
        commitlint: state.commitPolicy?.evidence?.commitlint ?? null,
        hooks: state.commitPolicy?.evidence?.hooks ?? [],
        branch: state.commitPolicy?.evidence?.branch ?? null,
        recentSubjectCount:
          state.commitPolicy?.evidence?.recentSubjects?.count ?? 0,
      },
    };
    projection.auditScope = state.auditScope
      ? {
          noGit: Boolean(state.auditScope.noGit),
          fileCount: state.auditScope.fileCount ?? 0,
          touched90d: state.auditScope.touched90d ?? 0,
          modeDefault: state.auditScope.modeDefault ?? null,
        }
      : null;
    projection.fallow = state.fallow?.status
      ? {
          declared: state.fallow.status.declared,
          compatible: state.fallow.status.compatible,
          needsDeclare: state.fallow.status.needsDeclare,
          needsInstall: state.fallow.status.needsInstall,
          needsUpgrade: state.fallow.status.needsUpgrade,
          version: state.fallow.status.version,
          manager: state.fallow.status.manager ?? null,
        }
      : { attempted: Boolean(state.fallow?.attempted), status: null };
    projection.importEdges = {
      edges: importEdges.items,
      shown: importEdges.shown,
      total: importEdges.total,
      truncated: importEdges.truncated,
      cyclicPackages: [...packagesInCycles(state.importEdges)].sort(),
    };
  }

  let text = `${JSON.stringify(sortKeysDeep(projection), null, 2)}\n`;
  const within = (value) =>
    Buffer.byteLength(value, "utf8") <= MAX_STDOUT_BYTES;
  if (!within(text)) {
    delete projection.commitPolicy?.evidence;
    delete projection.frameworks?.signals;
    text = `${JSON.stringify(sortKeysDeep(projection), null, 2)}\n`;
  }
  if (!within(text)) {
    const capped = {
      stateVersion: projection.stateVersion,
      truncatedStdout: true,
      needsInput: projection.needsInput,
      scannable: projection.scannable,
      pkgManager: projection.pkgManager,
      layout: {
        packagesShown: projection.layout.packagesShown,
        packagesTotal: projection.layout.packagesTotal,
      },
      failures: projection.failures,
    };
    text = `${JSON.stringify(sortKeysDeep(capped), null, 2)}\n`;
  }
  if (!within(text)) {
    // Reserve one byte for the trailing newline.
    text = `${capText(text.replace(/\n$/, ""), MAX_STDOUT_BYTES - 1)}\n`;
  }
  return text;
}

export function collectState(root, options = {}) {
  const skillDir = path.resolve(options.skillDir || SETUP_SKILL_DIR);
  const failures = [];
  const siblings = discoverSiblings(skillDir);
  const hasAudit = siblings.includes("lodestar-audit");
  const existing = parseExistingContext(root);
  const recorded = existing.contextExists
    ? parsePkgManagerRow(
        fs.readFileSync(path.join(root, existing.contextPath), "utf8"),
      )
    : null;
  const pkgManager = resolvePkgManager(root, recorded);
  const needsInput = [];
  if (pkgManager.ambiguous || !pkgManager.pkgManager) {
    needsInput.push({
      id: "pkg-manager",
      reason:
        pkgManager.lockfiles?.length > 1
          ? "multiple lockfiles"
          : "no recognized lockfile",
      lockfiles: pkgManager.lockfiles || [],
    });
  }

  const pkg = readRootPackageJson(root);
  let commands = collectCommands(root, pkg, pkgManager);
  const linter = detectLinter(root);
  let layout = collectPackages(root, commands.layoutSource);
  // Preserve recorded package responsibilities when present.
  if (existing.packageLayout?.length) {
    const byName = new Map(
      existing.packageLayout.map((row) => [row.name, row]),
    );
    const byPath = new Map(
      existing.packageLayout.map((row) => [posixPath(row.path), row]),
    );
    layout = {
      ...layout,
      packages: layout.packages.map((row) => {
        const prev = byName.get(row.name) || byPath.get(posixPath(row.path));
        if (!prev?.responsibility) return row;
        return { ...row, responsibility: prev.responsibility };
      }),
    };
  }
  const docsObserved = observeDocsLayout(root);
  // Preserve recorded docs roles when present.
  let docsRows = docsObserved.rows;
  if (existing.docsLayout?.length) {
    const byPath = new Map(existing.docsLayout.map((row) => [row.path, row]));
    docsRows = docsObserved.rows.map((row) => {
      const prev = byPath.get(row.path);
      return prev
        ? {
            path: row.path,
            role: prev.role,
            responsibility: prev.responsibility,
          }
        : row;
    });
  }
  const conventionsEvidence = collectConventionEvidence(root, layout.packages);
  const conventions = {
    evidence: conventionsEvidence,
    recorded: existing.conventions,
    suggested: {
      "result-types": existing.conventions?.["result-types"] ?? "yes",
      "branded-types": existing.conventions?.["branded-types"] ?? "yes",
      "barrel-exports": existing.conventions?.["barrel-exports"] ?? "no",
      "design-tokens": existing.conventions?.["design-tokens"] ?? "yes",
      "coverage-floor": existing.conventions?.["coverage-floor"] ?? "80",
    },
  };
  const rubricPaths = [
    ...new Set([
      ...(existing.rubricPaths || []),
      ...collectRubricPaths(root, docsRows),
    ]),
  ].sort();

  const scannable = countScannable(root);
  const state = {
    stateVersion: STATE_VERSION,
    root: posixPath(root),
    skillDir: posixPath(skillDir),
    siblings,
    hasAudit,
    scannable,
    pkgManager,
    needsInput,
    commands,
    linter,
    layout,
    docs: {
      outputRoot: docsObserved.outputRoot,
      architectureRoot: docsObserved.architectureRoot,
      rows: docsRows,
    },
    conventions,
    rubric: { paths: rubricPaths },
    existing,
    failures,
    importEdges: [],
  };

  if (hasAudit) {
    state.frameworks = collectFrameworkSignals(root, layout.packages);
    state.exclusions = collectExclusions(root);
    state.commitPolicy = collectCommitPolicy(root);
    state.auditScope = collectAuditScope(
      root,
      layout.packages,
      state.frameworks.scanExtensions,
      failures,
    );
    state.fallow = collectFallowStatus(skillDir, root, hasAudit, failures);
    state.importEdges = collectImportEdges(root, layout.packages);
  }

  return sortKeysDeep(state);
}

function cmdCollect(flags) {
  const root = path.resolve(requireFlag(flags, "root"));
  const out = path.resolve(requireFlag(flags, "out"));
  const skillDir = flags["skill-dir"]
    ? path.resolve(flags["skill-dir"])
    : SETUP_SKILL_DIR;
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    fail(`root is not a directory: ${root}`, 2);
  }
  const state = collectState(root, { skillDir });
  writeJson(out, state);
  process.stdout.write(projectReview(state));
  return 0;
}

function cmdPermissionsProjection(flags) {
  const statePath = path.resolve(requireFlag(flags, "state"));
  const state = readJson(statePath);
  process.stdout.write(projectPermissions(state));
  return 0;
}

function sectionBody(text, heading) {
  const re = new RegExp(`^## ${heading}\\s*$`, "m");
  const match = text.match(re);
  if (!match) return null;
  const start = match.index;
  const rest = text.slice(start);
  const next = rest.search(/\n## /);
  const end = next === -1 ? text.length : start + next;
  return { start, end, text: text.slice(start, end) };
}

function replaceOrInsertSection(text, heading, body, afterHeadings) {
  const existing = sectionBody(text, heading);
  const block = body.trimEnd() + "\n";
  if (existing) {
    return text.slice(0, existing.start) + block + text.slice(existing.end);
  }
  for (const after of afterHeadings || []) {
    const anchor = sectionBody(text, after);
    if (!anchor) continue;
    return text.slice(0, anchor.end) + "\n" + block + text.slice(anchor.end);
  }
  return `${text.trimEnd()}\n\n${block}`;
}

function removeSection(text, heading) {
  const existing = sectionBody(text, heading);
  if (!existing) return text;
  return (
    `${text.slice(0, existing.start).trimEnd()}\n\n${text.slice(existing.end).trimStart()}`.trimEnd() +
    "\n"
  );
}

function renderBuildTest(state, corrections) {
  let commands = { ...state.commands, ...(corrections.commands || {}) };
  if (corrections.pkgManager && !corrections.commands) {
    const mgr = {
      pkgManager:
        corrections.pkgManager.pkgManager ||
        corrections.pkgManager.name ||
        null,
      run: corrections.pkgManager.run || null,
      addDev: corrections.pkgManager.addDev || null,
    };
    if (mgr.pkgManager) {
      const root = state.root
        ? path.resolve(String(state.root))
        : process.cwd();
      const pkg = readRootPackageJson(root);
      const rebuilt = collectCommands(root, pkg, mgr);
      commands = {
        ...rebuilt,
        layoutSource: state.commands?.layoutSource || rebuilt.layoutSource,
        ...(corrections.commands || {}),
      };
    }
  }
  let lintCell = "n/a";
  try {
    lintCell = formatLintCell(commands.lint, state.linter);
  } catch {
    lintCell = commands.lint || "n/a";
  }
  const rows = [
    ["install", commands.install || "n/a"],
    ["build", commands.build || "n/a"],
    ["typecheck", commands.typecheck || "n/a"],
    ["lint", lintCell],
    ["test", commands.test || "n/a"],
  ];
  if (state.pkgManager?.provenance === "context.md" || corrections.pkgManager) {
    const pm = corrections.pkgManager || state.pkgManager;
    const cell = [pm.pkgManager || pm.name, pm.run, pm.addDev]
      .filter(Boolean)
      .join("; ");
    if (cell) rows.push(["pkg-manager", cell]);
  } else if (state.needsInput?.length) {
    // leave detection to lockfile; no guessed row
  }
  if (state.layout?.source) {
    rows.push(["layout-source", state.layout.source]);
  }
  const lines = [
    "## Build & Test",
    "",
    "| Command       | What it runs                                    |",
    "| ------------- | ----------------------------------------------- |",
    ...rows.map(
      ([cmd, value]) =>
        `| \`${cmd}\`${" ".repeat(Math.max(0, 11 - cmd.length))}| ${value} |`,
    ),
  ];
  return lines.join("\n");
}

function renderPackageLayout(state, corrections) {
  const responsibilities = corrections.packageResponsibilities || {};
  const recorded = new Map(
    (state.existing?.packageLayout || []).map((row) => [row.name, row]),
  );
  const packages = (corrections.packages || state.layout?.packages || []).map(
    (row) => ({
      ...row,
      responsibility:
        responsibilities[row.name] ||
        row.responsibility ||
        recorded.get(row.name)?.responsibility ||
        "Application package",
    }),
  );
  const lines = [
    "## Package Layout",
    "",
    "| Package         | Path glob(s)                 | Import alias          | Responsibility   | Scannable | Entry points       |",
    "| --------------- | ---------------------------- | --------------------- | ---------------- | --------- | ------------------ |",
  ];
  for (const row of packages) {
    const scannable =
      row.scannable === "no"
        ? row.language
          ? `no (${row.language})`
          : "no"
        : "yes";
    const entries = Array.isArray(row.entryPoints)
      ? row.entryPoints.join(", ")
      : row.entryPoints || "index.ts";
    lines.push(
      `| ${row.name} | ${row.path} | ${row.alias || "n/a"} | ${row.responsibility} | ${scannable} | ${entries} |`,
    );
  }
  return lines.join("\n");
}

function renderDocsLayout(state, corrections) {
  const recorded = new Map(
    (state.existing?.docsLayout || []).map((row) => [posixPath(row.path), row]),
  );
  const source = corrections.docs || state.docs?.rows || [];
  const rows = source.map((row) => {
    const prev = recorded.get(posixPath(row.path));
    if (!prev) return row;
    return {
      ...row,
      role: prev.role || row.role,
      responsibility: prev.responsibility || row.responsibility,
    };
  });
  if (!rows.length) return null;
  const lines = [
    "## Docs Layout",
    "",
    "| Path                                 | Role       | Responsibility                                                |",
    "| ------------------------------------ | ---------- | ------------------------------------------------------------- |",
    ...rows.map(
      (row) => `| \`${row.path}\` | \`${row.role}\` | ${row.responsibility} |`,
    ),
  ];
  return lines.join("\n");
}

function renderConventions(state, corrections) {
  const values = {
    ...(state.conventions?.suggested || {}),
    ...(state.conventions?.recorded || {}),
    ...(corrections.conventions || {}),
  };
  const gates = {
    "result-types": "`errors` #B (expected failures return `Result<T, E>`)",
    "branded-types": "`boundaries` A, `types` #4",
    "barrel-exports":
      "`imports` #4 (`export *`) — `yes` means barrels are allowed",
    "design-tokens": "the whole `styling` category",
    "coverage-floor":
      "the Testability coverage floor and the pre-commit checklist",
  };
  const lines = [
    "## Conventions",
    "",
    "| Convention       | Value | What it gates                                               |",
    "| ---------------- | ----- | ----------------------------------------------------------- |",
  ];
  for (const key of CONVENTION_KEYS) {
    lines.push(`| \`${key}\` | \`${values[key]}\` | ${gates[key]} |`);
  }
  return lines.join("\n");
}

function renderRubric(state, corrections) {
  const paths = (
    corrections.rubric ||
    (state.existing?.rubricPaths?.length
      ? state.existing.rubricPaths
      : state.rubric?.paths) ||
    []
  )
    .map((item) => posixPath(item))
    .filter(Boolean)
    .sort();
  const lines = ["## Review Rubric", ""];
  if (!paths.length) {
    lines.push("_No repo-owned extras._");
  } else {
    for (const item of [...new Set(paths)]) lines.push(`- \`${item}\``);
  }
  return lines.join("\n");
}

function renderAuditConfiguration(state, corrections, existingRows = {}) {
  const suggested = state.commitPolicy?.suggested || {
    commits: "ask",
    subjectFormat: "<category>: <slug>",
    trailer: "Closes <item>.",
    protected: ["none"],
    requireClean: "no",
  };
  const scan =
    corrections.scanExtensions ||
    state.frameworks?.scanExtensions?.join(", ") ||
    BASE_EXTS.join(", ");
  const defaults = {
    categories: "all",
    "output-root": "docs/audit",
    fallow: "required",
    "scan-extensions": scan,
    mode: "all",
    commits: suggested.commits,
    "subject-format": suggested.subjectFormat,
    trailer: suggested.trailer,
    protected: Array.isArray(suggested.protected)
      ? suggested.protected.join(", ")
      : suggested.protected,
    "require-clean": suggested.requireClean,
  };
  const rows = { ...defaults };
  for (const key of PRESERVE_AUDIT_KEYS) {
    if (existingRows[key]?.value) rows[key] = existingRows[key].value;
  }
  // Always refresh git keys from this run unless corrections override.
  Object.assign(rows, {
    commits: corrections.commits || defaults.commits,
    "subject-format": corrections.subjectFormat || defaults["subject-format"],
    trailer: corrections.trailer || defaults.trailer,
    protected: corrections.protected || defaults.protected,
    "require-clean": corrections.requireClean || defaults["require-clean"],
  });
  // Re-apply preserved non-git keys after git refresh.
  for (const key of PRESERVE_AUDIT_KEYS) {
    if (existingRows[key]?.value) rows[key] = existingRows[key].value;
  }
  if (corrections.scanExtensions)
    rows["scan-extensions"] = corrections.scanExtensions;

  const lines = [
    "## Audit Configuration",
    "",
    "| Key               | Value                | Notes |",
    "| ----------------- | -------------------- | ----- |",
  ];
  for (const [key, value] of Object.entries(rows)) {
    lines.push(`| \`${key}\` | \`${value}\` | |`);
  }

  const exclusions = corrections.exclusions || state.exclusions || [];
  if (exclusions.length) {
    lines.push("", "### Excluded Paths", "");
    lines.push("**Not audited** — generated, vendored, and build output.", "");
    for (const row of exclusions.filter((item) => item.bucket !== "tests")) {
      lines.push(`- \`${row.glob}\` — ${row.reason}`);
    }
    lines.push("", "**Test files** — skipped by default.", "");
    for (const row of exclusions.filter((item) => item.bucket === "tests")) {
      lines.push(`- \`${row.glob}\` — ${row.reason}`);
    }
  }
  return lines.join("\n");
}

function renderReference(state) {
  const parent = "<setup-skill-parent>";
  const order = [
    "lodestar-setup",
    "lodestar-audit",
    "lodestar-fix",
    "lodestar-architecture",
    "lodestar-plan",
    "lodestar-implement",
    "lodestar-docs",
  ];
  const lines = [
    "## Reference",
    "",
    "Principles (TypeScript rules, testability, error handling, anti-pattern",
    "reference, pre-commit checklist) live in `principles.md` beside the",
    "installed `lodestar-setup` `SKILL.md`. Resolve that path from the setup",
    "skill directory — do not hardcode `.agents/skills/…`. Do not copy its",
    "content here.",
    "",
    "The following skills are installed beside setup.",
    "",
    "| Skill               | File                                                  | When to use |",
    "| ------------------- | ----------------------------------------------------- | ----------- |",
  ];
  for (const name of order) {
    if (name !== "lodestar-setup" && !state.siblings.includes(name)) continue;
    lines.push(
      `| ${SKILL_LABELS[name]} | \`${parent}/${name}/SKILL.md\` | ${SKILL_WHEN[name]} |`,
    );
  }
  lines.push(
    "",
    "One outcome sentence: a **single-concern, fixable violation** → an",
    "audit action item; a **multi-stage or cross-package redesign** →",
    "`lodestar-plan`.",
  );
  return lines.join("\n");
}

function renderDependencyPolicy(corrections, existingBody) {
  const policy = corrections.dependencyPolicy;
  if (policy === null) return null;
  if (policy === undefined) {
    return existingBody && !/^## Dependency Direction\s*$/m.test(existingBody)
      ? existingBody.trimEnd()
      : null;
  }
  if (!String(policy).trim()) return null;
  if (String(policy).startsWith("## ")) return String(policy).trimEnd();
  return `## Dependency Policy\n\n${String(policy).trim()}`;
}

export function renderContext(state, corrections = {}) {
  const project =
    corrections.projectDescription ||
    state.existing?.projectDescription ||
    "Project description pending review.";
  const parts = [
    "# Lodestar Context",
    "",
    "Written by `lodestar-setup` to `.agents/lodestar/context.md`.",
    "",
    "## Project",
    "",
    project,
    "",
    renderBuildTest(state, corrections),
    "",
  ];
  const dep = renderDependencyPolicy(
    corrections,
    state.existing?.dependencyPolicy,
  );
  if (dep) {
    parts.push(dep, "");
  }
  parts.push(renderPackageLayout(state, corrections), "");
  const docs = renderDocsLayout(state, corrections);
  if (docs) parts.push(docs, "");
  parts.push(renderConventions(state, corrections), "");
  parts.push(renderRubric(state, corrections), "");
  if (state.hasAudit) {
    parts.push(
      renderAuditConfiguration(
        state,
        corrections,
        state.existing?.auditRows || {},
      ),
      "",
    );
  }
  parts.push(renderReference(state), "");
  return `${parts
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

export function mergeContext(existingText, state, corrections = {}) {
  if (!existingText || state.existing?.contextIsLegacy) {
    return renderContext(state, corrections);
  }
  let text = existingText.replace(/\r\n/g, "\n");
  text = removeSection(text, "Resolved Decisions");
  text = removeSection(text, "Dependency Direction");
  text = replaceOrInsertSection(
    text,
    "Build & Test",
    renderBuildTest(state, corrections),
    ["Project"],
  );
  const dep = renderDependencyPolicy(
    corrections,
    state.existing?.dependencyPolicy,
  );
  if (dep) {
    text = replaceOrInsertSection(text, "Dependency Policy", dep, [
      "Build & Test",
    ]);
  } else {
    text = removeSection(text, "Dependency Policy");
  }
  text = replaceOrInsertSection(
    text,
    "Package Layout",
    renderPackageLayout(state, corrections),
    ["Dependency Policy", "Build & Test"],
  );
  const docs = renderDocsLayout(state, corrections);
  if (docs) {
    text = replaceOrInsertSection(text, "Docs Layout", docs, [
      "Package Layout",
    ]);
  } else {
    text = removeSection(text, "Docs Layout");
  }
  text = replaceOrInsertSection(
    text,
    "Conventions",
    renderConventions(state, corrections),
    ["Docs Layout", "Package Layout"],
  );
  text = replaceOrInsertSection(
    text,
    "Review Rubric",
    renderRubric(state, corrections),
    ["Conventions"],
  );
  if (state.hasAudit) {
    const audit = renderAuditConfiguration(
      state,
      corrections,
      state.existing?.auditRows || {},
    );
    // Preserve selected rows already handled inside renderAuditConfiguration.
    text = replaceOrInsertSection(text, "Audit Configuration", audit, [
      "Review Rubric",
    ]);
  } else {
    text = removeSection(text, "Audit Configuration");
  }
  // Keep Reference sibling rows in sync, but leave prose around it.
  text = replaceOrInsertSection(text, "Reference", renderReference(state), [
    "Audit Configuration",
    "Review Rubric",
  ]);
  if (corrections.projectDescription) {
    text = replaceOrInsertSection(
      text,
      "Project",
      `## Project\n\n${corrections.projectDescription}`,
      [],
    );
  }
  return `${text.replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

function cmdWriteContext(flags) {
  const root = path.resolve(requireFlag(flags, "root"));
  const statePath = path.resolve(requireFlag(flags, "state"));
  const correctionsPath = path.resolve(requireFlag(flags, "corrections"));
  const state = readJson(statePath);
  const corrections = fs.existsSync(correctionsPath)
    ? readJson(correctionsPath)
    : {};
  const target = path.join(root, ".agents", "lodestar", "context.md");
  const existing = fs.existsSync(target)
    ? fs.readFileSync(target, "utf8")
    : null;
  // Refresh merge inputs from disk so a second write without re-collect
  // still preserves repo-owned layout/docs content.
  state.existing = {
    ...(state.existing || {}),
    contextExists: Boolean(existing),
    contextIsLegacy: existing
      ? PRE09_HEADINGS.some((name) =>
          new RegExp(`^## ${name}\\s*$`, "m").test(existing),
        )
      : false,
    auditRows: existing ? parseAuditRows(existing) : state.existing?.auditRows,
    dependencyPolicy: existing
      ? parseDependencyPolicyBody(existing)
      : state.existing?.dependencyPolicy,
    projectDescription: existing
      ? parseProjectBlurb(existing)
      : state.existing?.projectDescription,
    packageLayout: existing
      ? parsePackageLayoutSoft(existing)
      : state.existing?.packageLayout,
    docsLayout: existing
      ? (() => {
          try {
            return parseDocsLayout(existing);
          } catch {
            return state.existing?.docsLayout ?? null;
          }
        })()
      : state.existing?.docsLayout,
    rubricPaths: existing
      ? parseRubricBullets(existing)
      : state.existing?.rubricPaths,
  };
  const next = mergeContext(existing, state, corrections);
  atomicWrite(target, next);
  printJson({
    ok: true,
    path: ".agents/lodestar/context.md",
    bytes: Buffer.byteLength(next, "utf8"),
  });
  return 0;
}

function ensureResults(filePath) {
  if (fs.existsSync(filePath)) return readJson(filePath);
  return { version: 1, operations: [] };
}

function cmdRecordResult(flags) {
  const resultsPath = path.resolve(requireFlag(flags, "results"));
  const op = requireFlag(flags, "op");
  const status = requireFlag(flags, "status");
  if (!["changed", "skipped", "failed"].includes(status)) {
    fail("--status must be changed|skipped|failed", 2);
  }
  const results = ensureResults(resultsPath);
  const entry = {
    op,
    status,
    path: flags.path && flags.path !== true ? posixPath(flags.path) : null,
    remedy:
      flags.remedy && flags.remedy !== true
        ? capText(String(flags.remedy), MAX_FAILURE_BYTES)
        : null,
  };
  results.operations.push(entry);
  writeJson(resultsPath, results);
  printJson({ ok: true, recorded: entry });
  return 0;
}

function cmdSummarizeResults(flags) {
  const resultsPath = path.resolve(requireFlag(flags, "results"));
  const results = ensureResults(resultsPath);
  const changed = [];
  const skipped = [];
  const failed = [];
  for (const op of results.operations || []) {
    if (op.status === "changed" && op.path) changed.push(op.path);
    if (op.status === "skipped") {
      skipped.push({
        op: op.op,
        path: op.path,
        remedy: capText(op.remedy || "skipped", MAX_FAILURE_BYTES),
      });
    }
    if (op.status === "failed") {
      failed.push({
        op: op.op,
        path: op.path,
        remedy: capText(op.remedy || "failed", MAX_FAILURE_BYTES),
      });
    }
  }
  let siblings = [];
  if (flags.state && flags.state !== true) {
    try {
      const state = readJson(path.resolve(flags.state));
      siblings = Array.isArray(state.siblings)
        ? [...state.siblings].sort()
        : [];
    } catch {
      siblings = [];
    }
  }
  const next = suggestNextSkills(siblings);
  printJson(
    sortKeysDeep({
      changed: [...new Set(changed)].sort(),
      skipped,
      failed,
      siblings,
      next,
    }),
  );
  return 0;
}

function suggestNextSkills(siblings) {
  const set = new Set(siblings || []);
  const tips = [];
  if (set.has("lodestar-audit") && set.has("lodestar-fix")) {
    tips.push(
      "Run lodestar-audit, then lodestar-fix for single-concern fixes.",
    );
  }
  if (set.has("lodestar-architecture")) {
    tips.push(
      "Run lodestar-architecture for a second opinion on package layout.",
    );
  }
  if (set.has("lodestar-plan") && set.has("lodestar-implement")) {
    tips.push(
      "Run lodestar-plan for multi-stage or cross-package redesign, then lodestar-implement.",
    );
  }
  if (set.has("lodestar-docs")) {
    tips.push("Run lodestar-docs when staging trees pile up.");
  }
  return tips;
}

function cmdCleanup(flags) {
  const removed = [];
  for (const key of ["state", "corrections", "results"]) {
    const value = flags[key];
    if (!value || value === true) continue;
    const full = path.resolve(value);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { force: true });
      removed.push(posixPath(full));
    }
  }
  printJson({ ok: true, removed });
  return 0;
}

const COMMANDS = {
  collect: cmdCollect,
  "permissions-projection": cmdPermissionsProjection,
  "write-context": cmdWriteContext,
  "record-result": cmdRecordResult,
  "summarize-results": cmdSummarizeResults,
  cleanup: cmdCleanup,
};

export function main(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const command = positionals[0];
  if (!command) {
    usage();
    process.exit(1);
  }
  const handler = COMMANDS[command];
  if (!handler) fail(`unknown command ${command}`, 1);
  return handler(flags);
}

if (isMain(import.meta.url)) {
  try {
    process.exit(main() ?? 0);
  } catch (error) {
    fail(error.message || String(error), 2);
  }
}
