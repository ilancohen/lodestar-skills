#!/usr/bin/env node
/**
 * Deterministic audit-state helper. Installed with lodestar-audit.
 *
 * Subcommands: resolve-run, validate-input, check-freshness, derive-direction,
 * changed-files, merge-findings, validate-output, checkpoint, recover
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parsePkgManagerRow, resolvePkgManager } from "./pkg-manager.mjs";
import {
  atomicWrite,
  fail,
  isMain,
  parseArgs,
  printJson,
  utcDate,
} from "./runtime.mjs";
import { DEFAULT_INCLUDE, matchesGlob, walk } from "./source-scan.mjs";

export { detectPkgManager, resolvePkgManager } from "./pkg-manager.mjs";

export const CATEGORIES = [
  "imports",
  "types",
  "boundaries",
  "errors",
  "testability",
  "soc-yagni",
  "dry",
  "ssot",
  "styling",
];

export const PLACEHOLDER_RE =
  /<(typecheck|lint|test|pkg_root|pkg_alias|pkg_responsibility|all_pkg_roots|alias_prefix|pkg_manager|run|RUN_ID|output-root)>/;

export const FINDING_RE = /^### (F\d{4})\s*$/m;

function usage() {
  process.stderr.write(`Usage: audit-state <command> [options]

Commands:
  resolve-run --root DIR [--date YYYY-MM-DD] [--resume RUN_ID] [--drift JSON]
  validate-input --root DIR
  check-freshness --root DIR [--facts layout,commands]
  derive-direction --root DIR
  changed-files --root DIR --since REF
  merge-findings --in FILE [--in FILE ...] [--out FILE] [--changed-files JSON]
  validate-output --path FILE
  checkpoint --run-dir DIR --category NAME --status complete|partial --count N [--package NAME]
  recover --run-dir DIR
`);
}

export function padFindingId(index) {
  return `F${String(index).padStart(4, "0")}`;
}

export function nextRunId(existing, date) {
  const exact = date;
  const taken = new Set(existing);
  if (!taken.has(exact)) return exact;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${date}-${String(n).padStart(3, "0")}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`no free run id for ${date}`);
}

export function listRunIds(auditRoot) {
  if (!fs.existsSync(auditRoot)) return [];
  return fs
    .readdirSync(auditRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "done")
    .map((entry) => entry.name)
    .sort();
}

export function inProgressRuns(auditRoot, date) {
  return listRunIds(auditRoot)
    .filter((id) => id === date || id.startsWith(`${date}-`))
    .filter((id) => {
      const dir = path.join(auditRoot, id);
      const findings = path.join(dir, "findings.md");
      const index = path.join(dir, "INDEX.md");
      if (!fs.existsSync(findings)) return false;
      if (!fs.existsSync(index)) return true;
      const parsed = parseFindings(fs.readFileSync(findings, "utf8"));
      return parsed.incompleteCategories.length > 0;
    });
}

export function parsePackageLayout(contextText) {
  const tableStart = contextText.search(/^## Package Layout\s*$/m);
  if (tableStart === -1) {
    throw new Error(".agents/lodestar/context.md is missing ## Package Layout");
  }
  const rest = contextText.slice(tableStart);
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
    const scannableCell = parseScannableCell(cells[4]);
    rows.push({
      name: cells[0],
      path: cells[1],
      alias: cells[2],
      responsibility: cells[3],
      scannable: scannableCell.scannable,
      language: scannableCell.language,
      entryPoints: parseEntryPoints(cells[5]),
    });
  }
  if (!rows.length) {
    throw new Error("Package Layout table has no rows");
  }
  for (const row of rows) {
    const reason = responsibilityProblem(row);
    if (reason) {
      throw new Error(
        `Package \`${row.name}\` has no real Responsibility. ${reason} Re-run lodestar-setup and write a concrete one-sentence description. The audit relies on this column to judge boundary findings and won't run with a placeholder.`,
      );
    }
  }
  return rows;
}

function parseScannableCell(raw) {
  const stripped = String(raw ?? "")
    .replace(/^`+|`+$/g, "")
    .trim();
  if (!stripped) return { scannable: "yes", language: "" };
  const match = stripped.match(/^(yes|no)(?:\s*\(([^)]+)\))?$/);
  if (!match) {
    throw new Error(
      `Package Layout has an invalid Scannable value: \`${stripped}\`. Expected yes or no.`,
    );
  }
  return { scannable: match[1], language: (match[2] || "").trim() };
}

function parseEntryPoints(raw) {
  const stripped = String(raw ?? "")
    .replace(/^`+|`+$/g, "")
    .trim();
  if (!stripped) return ["index.ts"];
  const parts = stripped
    .split(",")
    .map((part) => part.replace(/^`+|`+$/g, "").trim())
    .filter(Boolean);
  return parts.length ? parts : ["index.ts"];
}

export function canonicalizeEntry(raw) {
  const stripped = String(raw ?? "")
    .replace(/^`+|`+$/g, "")
    .trim()
    .replace(/^\.\//, "");
  if (
    !stripped ||
    stripped === "." ||
    stripped === "index" ||
    stripped === "index.ts" ||
    stripped === "index.js" ||
    stripped === "index.mjs" ||
    stripped === "index.cjs"
  ) {
    return "index.ts";
  }
  return stripped;
}

export function isDeclaredEntryImport(specifier, alias, entryPoints) {
  if (!alias || alias === "n/a") return false;
  const prefix = String(alias).replace(/\/$/, "");
  const spec = String(specifier ?? "")
    .replace(/^['"]+|['"]+$/g, "")
    .trim();
  if (spec === prefix) return true;
  if (!spec.startsWith(`${prefix}/`)) return false;
  const subpath = canonicalizeEntry(spec.slice(prefix.length + 1));
  const entries = (entryPoints?.length ? entryPoints : ["index.ts"]).map(
    canonicalizeEntry,
  );
  return entries.includes(subpath);
}

export function countScannableFiles(repoRoot, pkgPath, excludedPaths = []) {
  let count = 0;
  for (const dir of packageDirs(repoRoot, pkgPath)) {
    count += walk(dir, DEFAULT_INCLUDE, false, [], {
      cwd: repoRoot,
      excludeGlobs: excludedPaths,
    }).length;
  }
  return count;
}

function packageDirs(repoRoot, pkgPath) {
  const normalized = String(pkgPath).replace(/\\/g, "/");
  const isGlob =
    normalized.includes("*") ||
    normalized.includes("?") ||
    normalized.includes("[");
  if (isGlob) {
    return fs
      .globSync(normalized, { cwd: repoRoot })
      .map((hit) => path.join(repoRoot, hit));
  }
  return [path.join(repoRoot, ...normalized.split("/").filter(Boolean))];
}

export function attachScannableCounts(repoRoot, packages, excludedPaths = []) {
  return packages.map((row) => {
    if (row.scannable === "no") {
      return { ...row, scannableCount: 0 };
    }
    const scannableCount = countScannableFiles(
      repoRoot,
      row.path,
      excludedPaths,
    );
    if (scannableCount === 0) {
      throw new Error(
        `Package \`${row.name}\` is marked Scannable: yes but contains no TypeScript or JavaScript files under \`${row.path}\`. The glob is stale or wrong — re-run lodestar-setup, or mark the row Scannable: no if it is not a TS/JS package.`,
      );
    }
    return { ...row, scannableCount };
  });
}

export function responsibilityProblem(row) {
  const text = row.responsibility.trim();
  if (text.length < 20) return "It is shorter than 20 characters.";
  if (/^\[.*\]$/.test(text) || /one sentence|TODO|TBD|\?\?\?/i.test(text)) {
    return "It is still a template placeholder.";
  }
  if (/^(core|shared|stuff|api|ui|infra|app|server)$/i.test(text)) {
    return "It is a single noun without a verb-like clause.";
  }
  return null;
}

export const COMMAND_NAMES = ["install", "build", "typecheck", "lint", "test"];

export function parseCommands(contextText) {
  const commands = {};
  for (const name of COMMAND_NAMES) {
    const match = contextText.match(
      new RegExp(`\\|\\s*${name}\\s*\\|\\s*([^|]+)\\|`, "i"),
    );
    if (match) commands[name] = match[1].trim();
  }
  return commands;
}

export function parseLayoutSource(contextText) {
  const heading = String(contextText).search(/^## Build & Test\s*$/m);
  if (heading === -1) return null;
  const rest = String(contextText).slice(heading);
  const next = rest.search(/\n## /);
  const section = next === -1 ? rest : rest.slice(0, next);
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const match = line.match(/\|\s*`?layout-source`?\s*\|\s*([^|]+)\|/i);
    if (!match) continue;
    const raw = match[1].replace(/^`+|`+$/g, "").trim();
    if (!raw || /^\[/.test(raw) || /omit this row/i.test(raw)) continue;
    return raw;
  }
  return null;
}

function posixPath(value) {
  return String(value).replace(/\\/g, "/").replace(/\/+$/, "");
}

export function pathSitsUnder(rowPath, memberDir) {
  const row = posixPath(rowPath);
  const member = posixPath(memberDir);
  return row === member || row.startsWith(`${member}/`);
}

function rowCoversMember(root, rowPath, memberDir) {
  const member = posixPath(memberDir);
  if (member === "." || member === "") return false;
  const paths = new Set([posixPath(rowPath)]);
  for (const abs of packageDirs(root, rowPath)) {
    const rel = posixPath(path.relative(root, abs));
    if (rel && !rel.startsWith("..")) paths.add(rel);
  }
  return [...paths].some((row) => pathSitsUnder(row, member));
}

function parsePnpmWorkspacePackages(text) {
  const jsonish = String(text).match(/packages:\s*\[([^\]]*)\]/);
  if (jsonish) {
    return jsonish[1]
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }
  const packages = [];
  let inPackages = false;
  for (const line of String(text).split(/\r?\n/)) {
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const item = line.match(/^\s+-\s+['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/);
    if (item) {
      packages.push(item[1].trim());
      continue;
    }
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (/^\S/.test(line)) break;
  }
  return packages;
}

function parseWorkspaceGlobs(fileName, text) {
  if (fileName === "pnpm-workspace.yaml") {
    return parsePnpmWorkspacePackages(text);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (fileName === "package.json") {
    if (Array.isArray(parsed.workspaces)) return parsed.workspaces;
    if (Array.isArray(parsed.workspaces?.packages)) {
      return parsed.workspaces.packages;
    }
    return [];
  }
  if (fileName === "lerna.json") {
    return Array.isArray(parsed.packages) ? parsed.packages : [];
  }
  if (fileName === "nx.json") {
    if (Array.isArray(parsed.projects)) return parsed.projects;
    if (parsed.projects && typeof parsed.projects === "object") {
      return Object.values(parsed.projects)
        .map((value) => (typeof value === "string" ? value : value?.root))
        .filter(Boolean);
    }
    return null;
  }
  return null;
}

function expandWorkspaceGlobs(root, globs) {
  const include = [];
  const exclude = [];
  for (const glob of globs) {
    if (String(glob).startsWith("!")) exclude.push(glob.slice(1));
    else include.push(glob);
  }
  const members = new Set();
  for (const glob of include) {
    const hits =
      /[*?\[]/.test(glob) && !glob.startsWith("!")
        ? fs.globSync(glob, { cwd: root })
        : fs.existsSync(path.join(root, glob))
          ? [glob]
          : [];
    for (const hit of hits) {
      const posix = posixPath(hit);
      const abs = path.join(root, posix);
      if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue;
      members.add(posix);
    }
  }
  return [...members]
    .filter((member) => !exclude.some((glob) => matchesGlob(member, glob)))
    .sort();
}

export function listDeclaredMembers(root, layoutSource) {
  const relative = posixPath(layoutSource);
  const abs = path.join(root, relative);
  if (!fs.existsSync(abs)) {
    return {
      members: [],
      skipReason: `layout-source file missing: ${relative}`,
    };
  }
  const fileName = path.basename(relative);
  const globs = parseWorkspaceGlobs(fileName, fs.readFileSync(abs, "utf8"));
  if (globs == null) {
    return {
      members: [],
      skipReason: `unrecognized layout-source: ${relative}`,
    };
  }
  if (!globs.length) {
    return {
      members: [],
      skipReason: `no workspace members in ${relative}`,
    };
  }
  return { members: expandWorkspaceGlobs(root, globs), skipReason: null };
}

function memberHasScannableSource(root, member) {
  return (
    walk(path.join(root, member), DEFAULT_INCLUDE, false, [], { cwd: root })
      .length > 0
  );
}

const NON_SCRIPT_BUILTINS = new Set([
  "install",
  "ci",
  "i",
  "add",
  "remove",
  "rm",
  "uninstall",
  "un",
  "dlx",
  "exec",
  "x",
  "publish",
  "pack",
  "link",
  "unlink",
  "update",
  "up",
  "outdated",
  "audit",
  "init",
  "create",
  "import",
  "config",
  "help",
  "why",
  "store",
  "fetch",
  "list",
  "ls",
]);

const SCRIPT_COMMAND_RE = {
  npm: /^npm(?:\s+(run))?\s+([A-Za-z0-9:_-]+)$/,
  pnpm: /^pnpm(?:\s+(run))?\s+([A-Za-z0-9:_-]+)$/,
  yarn: /^yarn(?:\s+(run))?\s+([A-Za-z0-9:_-]+)$/,
};

export function scriptNameFromCommand(command, pkgManager) {
  const trimmed = String(command || "")
    .trim()
    .replace(/^`+|`+$/g, "");
  if (!trimmed || /^n\/a$/i.test(trimmed)) return null;
  const regex = SCRIPT_COMMAND_RE[pkgManager];
  if (!regex) return null;
  const match = trimmed.match(regex);
  if (!match) return null;
  const usedRun = Boolean(match[1]);
  const token = match[2];
  if (!usedRun && NON_SCRIPT_BUILTINS.has(token)) return null;
  if (
    pkgManager === "npm" &&
    !usedRun &&
    !["test", "start", "stop", "restart"].includes(token)
  ) {
    return null;
  }
  return token;
}

function checkMissingPackages(root, packages, layoutSource) {
  if (!layoutSource) {
    return {
      skipped: [{ check: "missing-package", reason: "no layout-source row" }],
      drift: [],
    };
  }
  const listed = listDeclaredMembers(root, layoutSource);
  if (listed.skipReason) {
    return {
      skipped: [{ check: "missing-package", reason: listed.skipReason }],
      drift: [],
    };
  }
  const drift = [];
  for (const member of listed.members) {
    const posix = posixPath(member);
    if (posix === "." || posix === "") continue;
    if (!memberHasScannableSource(root, member)) continue;
    const covered = packages.some((row) =>
      rowCoversMember(root, row.path, member),
    );
    if (!covered) {
      drift.push({
        fact: "missing-package",
        recorded: "no matching row in ## Package Layout",
        observed: member,
        remedy: `Re-run lodestar-setup to add \`${member}\` to ## Package Layout.`,
      });
    }
  }
  return { skipped: [], drift };
}

function checkStaleCommands(root, commands, detected) {
  const skipped = [];
  const drift = [];
  const skipRemaining = (reason) => {
    for (const name of COMMAND_NAMES) {
      if (commands[name]) {
        skipped.push({ check: "stale-command", fact: name, reason });
      }
    }
    return { skipped, drift };
  };
  if (!fs.existsSync(path.join(root, "package.json"))) {
    return skipRemaining("no root package.json");
  }
  if (detected.provenance === "context.md") {
    return skipRemaining("pkg-manager row rather than a lockfile");
  }
  if (!detected.pkgManager || detected.ambiguous) {
    return skipRemaining("package manager not resolved from a lockfile");
  }
  if (detected.pkgManager === "bun") {
    return skipRemaining("bun commands are not decidable as scripts");
  }
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  } catch {
    return skipRemaining("root package.json is not valid JSON");
  }
  const scripts =
    pkg.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {};
  for (const name of COMMAND_NAMES) {
    const recorded = commands[name];
    if (!recorded) continue;
    if (/^n\/a$/i.test(recorded.trim())) {
      skipped.push({ check: "stale-command", fact: name, reason: "n/a" });
      continue;
    }
    const script = scriptNameFromCommand(recorded, detected.pkgManager);
    if (!script) {
      skipped.push({
        check: "stale-command",
        fact: name,
        reason: "not script-shaped",
      });
      continue;
    }
    if (!Object.hasOwn(scripts, script)) {
      drift.push({
        fact: "stale-command",
        name,
        recorded,
        observed: Object.keys(scripts).length
          ? `package.json has no \`${script}\` script`
          : "package.json has no scripts",
        remedy: `Re-run lodestar-setup to update the \`${name}\` command.`,
      });
    }
  }
  return { skipped, drift };
}

function parseFactsFlag(raw) {
  if (!raw || raw === true) return { layout: true, commands: true };
  const parts = String(raw)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) {
    throw new Error("check-freshness --facts requires layout and/or commands");
  }
  const facts = { layout: false, commands: false };
  for (const part of parts) {
    if (part === "layout" || part === "missing-package") facts.layout = true;
    else if (part === "commands" || part === "stale-command") {
      facts.commands = true;
    } else {
      throw new Error(`unknown --facts value: ${part}. Use layout, commands.`);
    }
  }
  return facts;
}

export function checkFreshness(root, options = {}) {
  const facts = options.facts || { layout: true, commands: true };
  const contextPath = path.join(root, ".agents", "lodestar", "context.md");
  if (!fs.existsSync(contextPath)) {
    throw new Error(
      ".agents/lodestar/context.md is missing. Run lodestar-setup first.",
    );
  }
  const contextText = fs.readFileSync(contextPath, "utf8");
  const commands = parseCommands(contextText);
  const layoutSource = parseLayoutSource(contextText);
  const detected = resolvePkgManager(root, parsePkgManagerRow(contextText));
  const skipped = [];
  const drift = [];
  if (facts.layout) {
    const packages = parsePackageLayout(contextText);
    const missing = checkMissingPackages(root, packages, layoutSource);
    skipped.push(...missing.skipped);
    drift.push(...missing.drift);
  }
  if (facts.commands) {
    const stale = checkStaleCommands(root, commands, detected);
    skipped.push(...stale.skipped);
    drift.push(...stale.drift);
  }
  return { fresh: drift.length === 0, layoutSource, drift, skipped };
}

function printDriftHuman(drift) {
  process.stderr.write(
    ".agents/lodestar/context.md no longer matches the repo:\n",
  );
  for (const item of drift) {
    if (item.fact === "missing-package") {
      process.stderr.write(`- missing package: ${item.observed}\n`);
    } else {
      process.stderr.write(
        `- stale command \`${item.name}\`: recorded \`${item.recorded}\` but ${item.observed}\n`,
      );
    }
  }
}

function packageForSpecifier(spec, packages) {
  const ranked = [...packages]
    .filter((row) => row.alias && row.alias !== "n/a")
    .sort((a, b) => b.alias.length - a.alias.length);
  for (const row of ranked) {
    if (spec === row.alias || spec.startsWith(`${row.alias}/`)) return row;
  }
  return null;
}

function collectImportEdges(root, packages, excludedPaths = []) {
  const counts = new Map();
  for (const from of packages) {
    for (const dir of packageDirs(root, from.path)) {
      const files = walk(dir, DEFAULT_INCLUDE, true, [], {
        cwd: root,
        excludeGlobs: excludedPaths,
      });
      for (const file of files) {
        const text = fs.readFileSync(file, "utf8");
        for (const match of text.matchAll(/from ['"]([^'"]+)['"]/g)) {
          const to = packageForSpecifier(match[1], packages);
          if (!to || to.name === from.name) continue;
          const key = `${from.name}\0${to.name}`;
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      }
    }
  }
  return [...counts].map(([key, count]) => {
    const [from, to] = key.split("\0");
    return { from, to, count };
  });
}

function topologicalChain(names, edges) {
  const incoming = new Map(names.map((name) => [name, 0]));
  const outgoing = new Map(names.map((name) => [name, []]));
  for (const edge of edges) {
    if (!incoming.has(edge.from) || !incoming.has(edge.to)) continue;
    incoming.set(edge.to, incoming.get(edge.to) + 1);
    outgoing.get(edge.from).push(edge.to);
  }
  const queue = names.filter((name) => incoming.get(name) === 0);
  const chain = [];
  while (queue.length) {
    const current = queue.shift();
    chain.push(current);
    for (const next of outgoing.get(current) || []) {
      incoming.set(next, incoming.get(next) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
  }
  return chain.length === names.length ? chain : null;
}

function importCountLabel(count) {
  return count === 1 ? "(1 import)" : `(${count} imports)`;
}

function renderDirectionMarkdown(result) {
  const lines = [`Basis: observed import graph, captured ${utcDate()}.`, ""];
  if (!result.edges.length) {
    return `${lines.join("\n").trimEnd()}\n`;
  }
  if (result.cyclic) {
    for (const edge of result.edges) {
      const tag = canReach(result.edges, edge.to, edge.from) ? " [cycle]" : "";
      lines.push(
        `- ${edge.from} → ${edge.to} ${importCountLabel(edge.count)}${tag}`,
      );
    }
    lines.push("");
    lines.push("The graph is cyclic — no single dependency order exists.");
    lines.push("");
    return lines.join("\n");
  }
  lines.push(result.chain.join(" → "));
  lines.push("");
  return lines.join("\n");
}

export function deriveDirection(root) {
  const contextPath = path.join(root, ".agents", "lodestar", "context.md");
  if (!fs.existsSync(contextPath)) {
    throw new Error(
      ".agents/lodestar/context.md is missing. Run lodestar-setup first.",
    );
  }
  const contextText = fs.readFileSync(contextPath, "utf8");
  const packages = parsePackageLayout(contextText);
  const names = packages.map((row) => row.name);
  const excluded = parseExcludedPaths(contextText);
  const edges = collectImportEdges(root, packages, excluded.excludedPaths);
  const cyclic = hasDirectedCycle(edges);
  const chain = cyclic ? null : topologicalChain(names, edges) || names;
  const result = { cyclic, chain, edges };
  return { ...result, markdown: renderDirectionMarkdown(result) };
}

export function parseDirection(contextText) {
  const heading = contextText.search(/^## Dependency Direction\s*$/m);
  if (heading === -1) {
    return {
      chain: [],
      edges: [],
      cyclic: false,
      reachability: {},
    };
  }
  const rest = contextText.slice(heading);
  const next = rest.search(/\n## /);
  const section = next === -1 ? rest : rest.slice(0, next);

  const bulletEdges = parseEdgeBullets(section);
  if (bulletEdges.length) {
    const packages = collectPackagesFromEdges(bulletEdges);
    const cyclic =
      bulletEdges.some((edge) => edge.cycle) || hasDirectedCycle(bulletEdges);
    return {
      chain: null,
      edges: bulletEdges,
      cyclic,
      reachability: buildReachabilityFromEdges(packages, bulletEdges),
    };
  }

  const chain = parseChain(section);
  if (chain.length) {
    const edges = chainToEdges(chain);
    return {
      chain,
      edges,
      cyclic: false,
      reachability: buildReachabilityFromChain(chain),
    };
  }

  return {
    chain: [],
    edges: [],
    cyclic: false,
    reachability: {},
  };
}

export const CONVENTION_DEFAULTS = {
  "result-types": "yes",
  "branded-types": "yes",
  "barrel-exports": "no",
  "design-tokens": "yes",
  "coverage-floor": 80,
};

const BOOLEAN_CONVENTIONS = new Set([
  "result-types",
  "branded-types",
  "barrel-exports",
  "design-tokens",
]);

function stripTicks(value) {
  return value.replace(/^`+|`+$/g, "").trim();
}

export function parseConventions(contextText) {
  const conventions = { ...CONVENTION_DEFAULTS };
  const heading = contextText.search(/^## Conventions\s*$/m);
  if (heading === -1) return conventions;

  const rest = contextText.slice(heading);
  const next = rest.search(/\n## /);
  const section = next === -1 ? rest : rest.slice(0, next);

  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;
    if (/^-+$/.test(cells[0].replace(/:/g, "-"))) continue;
    const key = stripTicks(cells[0]);
    if (!key || /^convention$/i.test(key)) continue;
    const raw = stripTicks(cells[1]);
    if (!Object.hasOwn(CONVENTION_DEFAULTS, key)) continue;
    conventions[key] = parseConventionValue(key, raw);
  }
  return conventions;
}

function parseConventionValue(key, raw) {
  if (BOOLEAN_CONVENTIONS.has(key)) {
    if (raw === "yes" || raw === "no") return raw;
    throw new Error(
      `## Conventions has an invalid value for \`${key}\`: \`${raw}\`. Expected yes or no.`,
    );
  }
  if (key === "coverage-floor") {
    if (raw === "none") return "none";
    if (/^[1-9]\d*$/.test(raw)) return Number(raw);
    throw new Error(
      `## Conventions has an invalid value for \`coverage-floor\`: \`${raw}\`. Expected a positive integer or none.`,
    );
  }
  throw new Error(`## Conventions has an unknown key \`${key}\`.`);
}

export const DEFAULT_OUTPUT_ROOT = "docs/audit";
export const DEFAULT_ARCHITECTURE_ROOT = "docs/architecture-review";

export function architectureOutputRoot(outputRoot) {
  const normalized = outputRoot.replace(/\/$/, "");
  if (normalized === DEFAULT_OUTPUT_ROOT) return DEFAULT_ARCHITECTURE_ROOT;
  return `${normalized}/architecture-review`;
}

export function parseAuditSettings(contextText) {
  const settings = {
    categories: [...CATEGORIES],
    outputRoot: DEFAULT_OUTPUT_ROOT,
    fallow: "required",
  };
  const heading = contextText.search(/^## Audit Settings\s*$/m);
  if (heading === -1) return settings;

  const rest = contextText.slice(heading);
  const next = rest.search(/\n## /);
  const section = next === -1 ? rest : rest.slice(0, next);

  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;
    if (/^-+$/.test(cells[0].replace(/:/g, "-"))) continue;
    const key = stripTicks(cells[0]);
    if (!key || /^setting$/i.test(key)) continue;
    const raw = stripTicks(cells[1]);
    if (key === "categories") {
      settings.categories = parseCategorySetting(raw);
    } else if (key === "output-root") {
      settings.outputRoot = parseOutputRootSetting(raw);
    } else if (key === "fallow") {
      settings.fallow = parseFallowSetting(raw);
    }
  }
  return settings;
}

export function parseExcludedPaths(contextText) {
  const result = { excludedPaths: [], testGlobs: [] };
  const heading = contextText.search(/^## Excluded Paths\s*$/m);
  if (heading === -1) return result;
  const rest = contextText.slice(heading);
  const next = rest.search(/\n## /);
  const section = next === -1 ? rest : rest.slice(0, next);
  let bucket = "excludedPaths";
  for (const line of section.split(/\r?\n/)) {
    const bullet = line.match(/^\s*[-*]\s+`([^`]+)`/);
    if (bullet) {
      result[bucket].push(bullet[1]);
      continue;
    }
    if (/^\s*\*\*Test files\b/i.test(line) || /^\s*Test files\b/i.test(line)) {
      bucket = "testGlobs";
      continue;
    }
    if (
      /^\s*\*\*Not audited\b/i.test(line) ||
      /^\s*Not audited\b/i.test(line)
    ) {
      bucket = "excludedPaths";
    }
  }
  return result;
}

function parseCategorySetting(raw) {
  if (!raw || raw === "all") return [...CATEGORIES];
  const names = raw
    .split(",")
    .map((part) => stripTicks(part.trim()))
    .filter(Boolean);
  if (!names.length) {
    throw new Error(
      "## Audit Settings has an empty `categories` value. Expected `all` or a comma-separated list of category names.",
    );
  }
  const unknown = names.filter((name) => !CATEGORIES.includes(name));
  if (unknown.length) {
    throw new Error(
      `## Audit Settings has unknown categor${unknown.length === 1 ? "y" : "ies"}: ${unknown
        .map((name) => `\`${name}\``)
        .join(", ")}.`,
    );
  }
  return [...new Set(names)];
}

function parseFallowSetting(raw) {
  if (raw === "required" || raw === "optional") return raw;
  throw new Error(
    `## Audit Settings has an invalid value for \`fallow\`: \`${raw}\`. Expected required or optional.`,
  );
}

function parseOutputRootSetting(raw) {
  if (!raw) {
    throw new Error("## Audit Settings has an empty `output-root`.");
  }
  const segments = raw.split(/[/\\]/);
  if (path.isAbsolute(raw) || raw.startsWith("~") || segments.includes("..")) {
    throw new Error(
      `## Audit Settings has an invalid \`output-root\`: \`${raw}\`. Expected a relative path with no \`..\`.`,
    );
  }
  return raw.replace(/\/$/, "");
}

export const GIT_DEFAULTS = {
  commits: "ask",
  subjectFormat: "<category>: <slug>",
  trailer: "Closes <item>.",
  protected: [],
  requireClean: "no",
};

const GIT_COMMITS = new Set(["ask", "per-item", "never"]);

export function parseGit(contextText) {
  const git = {
    commits: GIT_DEFAULTS.commits,
    subjectFormat: GIT_DEFAULTS.subjectFormat,
    trailer: GIT_DEFAULTS.trailer,
    protected: [...GIT_DEFAULTS.protected],
    requireClean: GIT_DEFAULTS.requireClean,
  };
  const heading = contextText.search(/^## Git\s*$/m);
  if (heading === -1) return git;

  const rest = contextText.slice(heading);
  const next = rest.search(/\n## /);
  const section = next === -1 ? rest : rest.slice(0, next);

  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;
    if (/^-+$/.test(cells[0].replace(/:/g, "-"))) continue;
    const key = stripTicks(cells[0]);
    if (!key || /^key$/i.test(key)) continue;
    const raw = stripTicks(cells[1]);
    if (key === "commits") git.commits = parseGitCommits(raw);
    else if (key === "subject-format") {
      git.subjectFormat = parseGitSubjectFormat(raw);
    } else if (key === "trailer") git.trailer = parseGitTrailer(raw);
    else if (key === "protected") git.protected = parseGitProtected(raw);
    else if (key === "require-clean") {
      git.requireClean = parseGitRequireClean(raw);
    }
  }
  return git;
}

export const SCOPE_DEFAULTS = { mode: "all" };

const SCOPE_MODES = new Set(["all", "changed-since"]);

export function parseAuditScope(contextText) {
  const scope = { mode: SCOPE_DEFAULTS.mode };
  const heading = contextText.search(/^## Audit Scope\s*$/m);
  if (heading === -1) return scope;

  const rest = contextText.slice(heading);
  const next = rest.search(/\n## /);
  const section = next === -1 ? rest : rest.slice(0, next);

  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 2) continue;
    if (/^-+$/.test(cells[0].replace(/:/g, "-"))) continue;
    const key = stripTicks(cells[0]);
    if (!key || /^key$/i.test(key)) continue;
    const raw = stripTicks(cells[1]);
    if (key === "mode") scope.mode = parseScopeMode(raw);
    else if (key === "baseline-ref") {
      const ref = parseOptionalScopeValue(raw);
      if (ref) scope.baselineRef = ref;
    } else if (key === "baseline-date") {
      const date = parseOptionalScopeValue(raw);
      if (date) scope.baselineDate = date;
    }
  }
  if (scope.mode === "changed-since" && !scope.baselineRef) {
    throw new Error(
      "## Audit Scope has `mode: changed-since` but no `baseline-ref`.",
    );
  }
  return scope;
}

function parseScopeMode(raw) {
  if (SCOPE_MODES.has(raw)) return raw;
  throw new Error(
    `## Audit Scope has an invalid value for \`mode\`: \`${raw}\`. Expected all or changed-since.`,
  );
}

function parseOptionalScopeValue(raw) {
  if (!raw || /^\[[^\]]+\]$/.test(raw)) return "";
  return raw;
}

function gitAt(root, args) {
  return spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
}

function resolveBaselineRef(root, ref) {
  const result = gitAt(root, ["rev-parse", "--verify", `${ref}^{commit}`]);
  if (result.status !== 0) {
    throw new Error(
      `## Audit Scope \`baseline-ref\` \`${ref}\` does not resolve. History was probably rewritten (force-push or rebase). Re-run lodestar-setup or edit the ref in context.md.`,
    );
  }
  return result.stdout.trim();
}

export function listChangedFiles(root, since, excludedPaths = []) {
  const diff = gitAt(root, [
    "diff",
    "--name-status",
    "--find-renames",
    `${since}...HEAD`,
  ]);
  if (diff.status !== 0) {
    throw new Error(diff.stderr.trim() || `git diff ${since}...HEAD failed`);
  }
  const untracked = gitAt(root, ["ls-files", "--others", "--exclude-standard"]);
  if (untracked.status !== 0) {
    throw new Error(untracked.stderr.trim() || "git ls-files failed");
  }
  const paths = new Set();
  for (const line of diff.stdout.split("\n").filter(Boolean)) {
    const parts = line.split("\t");
    const status = parts[0][0];
    if (status === "D") continue;
    const filePath = status === "R" || status === "C" ? parts[2] : parts[1];
    if (filePath) paths.add(filePath.replace(/\\/g, "/"));
  }
  for (const filePath of untracked.stdout.split("\n").filter(Boolean)) {
    paths.add(filePath.replace(/\\/g, "/"));
  }
  return [...paths]
    .filter(
      (filePath) => !excludedPaths.some((glob) => matchesGlob(filePath, glob)),
    )
    .sort();
}

function parseGitCommits(raw) {
  if (GIT_COMMITS.has(raw)) return raw;
  throw new Error(
    `## Git has an invalid value for \`commits\`: \`${raw}\`. Expected ask, per-item, or never.`,
  );
}

function parseGitSubjectFormat(raw) {
  if (!raw) {
    throw new Error("## Git has an empty `subject-format`.");
  }
  if (!raw.includes("<slug>")) {
    throw new Error(
      `## Git has an invalid \`subject-format\`: \`${raw}\`. It must contain \`<slug>\`.`,
    );
  }
  return raw;
}

function parseGitTrailer(raw) {
  if (!raw) {
    throw new Error(
      "## Git has an empty `trailer`. Use `none` for no trailer.",
    );
  }
  return raw;
}

function parseGitProtected(raw) {
  if (!raw || raw === "none") return [];
  const names = raw
    .split(",")
    .map((part) => stripTicks(part.trim()))
    .filter(Boolean)
    .filter((name) => name !== "none");
  return [...new Set(names)];
}

function parseGitRequireClean(raw) {
  if (raw === "yes" || raw === "no") return raw;
  throw new Error(
    `## Git has an invalid value for \`require-clean\`: \`${raw}\`. Expected yes or no.`,
  );
}

function parseEdgeBullets(section) {
  const edges = [];
  for (const line of section.split(/\r?\n/)) {
    const match = line.match(
      /^-\s+([A-Za-z0-9._/-]+)\s*→\s*([A-Za-z0-9._/-]+)/,
    );
    if (!match) continue;
    const from = match[1].trim();
    const to = match[2].trim();
    const countMatch = line.match(/\((\d+)\s+import/i);
    edges.push({
      from,
      to,
      count: countMatch ? Number(countMatch[1]) : undefined,
      cycle: /\[cycle\]/i.test(line),
    });
  }
  return edges;
}

function parseChain(section) {
  const fenceMatch = section.match(/```[^\n]*\n([^`]+)```/);
  if (fenceMatch) {
    const chainLine = fenceMatch[1].trim().split(/\r?\n/)[0];
    const chainMatch = chainLine.match(
      /^([A-Za-z0-9._/-]+(?:\s*→\s*[A-Za-z0-9._/-]+)+)\s*$/,
    );
    if (chainMatch) {
      return chainMatch[1].split(/\s*→\s*/).map((part) => part.trim());
    }
  }
  for (const line of section.split(/\r?\n/)) {
    if (line.startsWith("-")) continue;
    const chainMatch = line.match(
      /^([A-Za-z0-9._/-]+(?:\s*→\s*[A-Za-z0-9._/-]+)+)\s*$/,
    );
    if (chainMatch) {
      return chainMatch[1].split(/\s*→\s*/).map((part) => part.trim());
    }
  }
  return [];
}

function chainToEdges(chain) {
  const edges = [];
  for (let i = 0; i < chain.length - 1; i += 1) {
    edges.push({ from: chain[i], to: chain[i + 1] });
  }
  return edges;
}

function collectPackagesFromEdges(edges) {
  const names = new Set();
  for (const edge of edges) {
    names.add(edge.from);
    names.add(edge.to);
  }
  return [...names];
}

function buildReachabilityFromChain(chain) {
  const reachability = {};
  for (let i = 0; i < chain.length; i += 1) {
    reachability[chain[i]] = chain.slice(i);
  }
  return reachability;
}

function buildReachabilityFromEdges(packages, edges) {
  const reachability = {};
  for (const pkg of packages) {
    reachability[pkg] = reachableFrom(pkg, edges);
  }
  return reachability;
}

function reachableFrom(start, edges) {
  const allowed = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.pop();
    for (const edge of edges) {
      if (edge.from !== current || allowed.has(edge.to)) continue;
      allowed.add(edge.to);
      queue.push(edge.to);
    }
  }
  const rest = [...allowed].filter((name) => name !== start).sort();
  return [start, ...rest];
}

function hasDirectedCycle(edges) {
  const nodes = collectPackagesFromEdges(edges);
  const visiting = new Set();
  const visited = new Set();
  const adjacency = new Map(nodes.map((name) => [name, []]));
  for (const edge of edges) {
    adjacency.get(edge.from).push(edge.to);
  }
  function visit(node) {
    if (visited.has(node)) return false;
    if (visiting.has(node)) return true;
    visiting.add(node);
    for (const next of adjacency.get(node) || []) {
      if (visit(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }
  for (const node of nodes) {
    if (visit(node)) return true;
  }
  return false;
}

export function isDocumentedCycleEdge(from, to, edges) {
  return (
    edges.some((edge) => edge.from === from && edge.to === to) &&
    edges.some((edge) => edge.from === to && edge.to === from)
  );
}

export function isWrongDirectionImport(from, to, directionGraph) {
  if (!from || !to || from === to) return false;
  const edges = directionGraph.edges || [];
  if (isDocumentedCycleEdge(from, to, edges)) return false;
  return canReach(edges, to, from);
}

function canReach(edges, start, end) {
  if (start === end) return true;
  const visited = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.pop();
    for (const edge of edges) {
      if (edge.from !== current || visited.has(edge.to)) continue;
      if (edge.to === end) return true;
      visited.add(edge.to);
      queue.push(edge.to);
    }
  }
  return false;
}

export function aliasPrefix(packages) {
  const aliases = packages
    .map((row) => row.alias)
    .filter((alias) => alias && alias !== "n/a");
  if (aliases.length < 2) return aliases[0] || "";
  let prefix = aliases[0];
  for (const alias of aliases.slice(1)) {
    let i = 0;
    while (i < prefix.length && prefix[i] === alias[i]) i += 1;
    prefix = prefix.slice(0, i);
  }
  return prefix;
}

export function parseInScopeField(raw) {
  if (!raw) return true;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

export function findingPath(entry) {
  const text = String(entry).replace(/\\/g, "/");
  const match = text.match(/^(.*):(\d+)$/);
  return match ? match[1] : text;
}

export function findingInScope(finding, changedSet) {
  if (finding.scope_unit === "advisory") return true;
  return (finding.files || []).some((entry) =>
    changedSet.has(findingPath(entry)),
  );
}

export function applyChangedFiles(findings, changedFiles) {
  if (changedFiles == null) {
    return findings.map((finding) => ({ ...finding, in_scope: true }));
  }
  const changedSet = new Set(
    changedFiles.map((filePath) => String(filePath).replace(/\\/g, "/")),
  );
  return findings.map((finding) => ({
    ...finding,
    in_scope: findingInScope(finding, changedSet),
  }));
}

export function parseFindingBlock(block) {
  const idMatch = block.match(/^### (F\d{4})\s*$/m);
  if (!idMatch) return null;
  const field = (name) => {
    const match = block.match(new RegExp(`^- ${name}:\\s*(.*)$`, "m"));
    return match ? match[1].trim() : "";
  };
  const files = [];
  const filesMatch = block.match(/- files:\n((?:  - .+\n?)*)/);
  if (filesMatch) {
    for (const line of filesMatch[1].split(/\n/)) {
      const item = line.match(/^\s+- (.+)$/);
      if (item) files.push(item[1].trim());
    }
  }
  const evidenceMatch = block.match(/- evidence: \|\n((?:    .*\n?)*)/);
  const notesMatch = block.match(/- notes: \|\n((?:    .*\n?)*)/);
  return {
    id: idMatch[1],
    category: field("category"),
    subtype: field("subtype"),
    package: field("package") || null,
    files,
    evidence: evidenceMatch
      ? evidenceMatch[1].replace(/^    /gm, "").trimEnd()
      : field("evidence"),
    scope_unit: field("scope_unit"),
    requires_decision: field("requires_decision") === "true",
    in_scope: parseInScopeField(field("in_scope")),
    notes: notesMatch
      ? notesMatch[1].replace(/^    /gm, "").trimEnd()
      : field("notes"),
  };
}

export function parseFindings(text) {
  const findings = [];
  const complete = [];
  const incompleteCategories = [];
  const skipped = [];
  const parts = text.split(/^(?=### F\d{4}\s*$)/m);
  for (const part of parts) {
    const finding = parseFindingBlock(part);
    if (finding) findings.push(finding);
  }
  for (const category of CATEGORIES) {
    const marker = text.match(
      new RegExp(
        `^## category: ${category} — complete(?: \\((\\d+) findings\\))?\\s*$`,
        "m",
      ),
    );
    if (marker) {
      complete.push({
        category,
        count: Number(
          marker[1] ||
            findings.filter((item) => item.category === category).length,
        ),
      });
    } else {
      incompleteCategories.push(category);
    }
  }
  for (const match of text.matchAll(/^## skipped: (.+) — (.+)$/gm)) {
    skipped.push({ what: match[1], reason: match[2] });
  }
  return { findings, complete, incompleteCategories, skipped };
}

export function sortFindings(findings) {
  return [...findings].sort((a, b) => {
    const cat = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
    if (cat !== 0) return cat;
    const fileA = a.files[0] || "";
    const fileB = b.files[0] || "";
    if (fileA !== fileB) return fileA.localeCompare(fileB);
    return (a.subtype || "").localeCompare(b.subtype || "");
  });
}

export function dedupeFindings(findings) {
  const seen = new Set();
  const result = [];
  for (const finding of findings) {
    const key = [
      finding.category,
      finding.subtype,
      finding.package || "",
      (finding.files || []).join(","),
      (finding.evidence || "").trim(),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(finding);
  }
  return result;
}

export function assignIds(findings) {
  return findings.map((finding, index) => ({
    ...finding,
    id: padFindingId(index + 1),
  }));
}

function driftFacts(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.drift)) return payload.drift;
  if (Array.isArray(payload)) return payload;
  return [];
}

export function renderDriftLines(payload) {
  const facts = driftFacts(payload);
  if (!facts.length) return [];
  const lines = [
    "## Stale basis",
    "",
    "This run proceeded on a `.agents/lodestar/context.md` that no longer",
    "matches the repo. Findings below rest on that known-stale basis.",
    "",
  ];
  for (const item of facts) {
    if (item.fact === "missing-package") {
      lines.push(`- missing package: \`${item.observed}\``);
    } else {
      lines.push(
        `- stale command \`${item.name}\`: recorded \`${item.recorded}\` but ${item.observed}`,
      );
    }
  }
  lines.push("");
  lines.push(
    "Re-run `lodestar-setup`, then re-audit, to supersede this run.",
    "",
  );
  return lines;
}

export function renderFindings(runId, findings, complete = [], drift = null) {
  const lines = [
    `# Audit findings — ${runId}`,
    "",
    "Generated by lodestar-audit. One block per detected",
    "violation. Edit freely before Phase 2 — false positives can be removed",
    "by deleting the block.",
    "",
    ...renderDriftLines(drift),
  ];
  const byCategory = new Map(CATEGORIES.map((name) => [name, []]));
  for (const finding of findings) {
    if (!byCategory.has(finding.category)) {
      throw new Error(`unknown category ${finding.category}`);
    }
    byCategory.get(finding.category).push(finding);
  }
  const completeMap = new Map(
    complete.map((item) => [item.category, item.count]),
  );
  for (const category of CATEGORIES) {
    const items = byCategory.get(category);
    if (completeMap.has(category)) {
      const count = completeMap.get(category);
      lines.push(`## category: ${category} — complete (${count} findings)`);
      lines.push("");
    } else if (items.length) {
      lines.push(`## category: ${category}`);
      lines.push("");
    }
    for (const finding of items) {
      lines.push(`### ${finding.id}`);
      lines.push(`- category: ${finding.category}`);
      lines.push(`- subtype: ${finding.subtype}`);
      if (finding.package) lines.push(`- package: ${finding.package}`);
      lines.push("- files:");
      for (const file of finding.files || []) lines.push(`  - ${file}`);
      lines.push("- evidence: |");
      for (const line of String(finding.evidence || "").split("\n")) {
        lines.push(`    ${line}`);
      }
      lines.push(`- scope_unit: ${finding.scope_unit}`);
      lines.push(
        `- requires_decision: ${finding.requires_decision ? "true" : "false"}`,
      );
      lines.push(
        `- in_scope: ${finding.in_scope === false ? "false" : "true"}`,
      );
      lines.push("- notes: |");
      for (const line of String(finding.notes || "").split("\n")) {
        lines.push(`    ${line}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function findPlaceholders(text) {
  const hits = [];
  const lines = text.split(/\n/);
  lines.forEach((line, index) => {
    if (PLACEHOLDER_RE.test(line)) {
      hits.push({ line: index + 1, text: line.trim() });
    }
  });
  return hits;
}

export function validateFinding(finding) {
  const errors = [];
  if (!/^F\d{4}$/.test(finding.id || "")) errors.push("missing finding id");
  if (!CATEGORIES.includes(finding.category)) {
    errors.push(`invalid category ${finding.category}`);
  }
  if (!finding.subtype) errors.push("missing subtype");
  if (!finding.scope_unit) errors.push("missing scope_unit");
  if (finding.in_scope !== true && finding.in_scope !== false) {
    errors.push("invalid in_scope");
  }
  if (!Array.isArray(finding.files)) errors.push("files must be a list");
  return errors;
}

function loadFindingsInput(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  if (filePath.endsWith(".json")) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed.findings || [];
  }
  return parseFindings(text).findings;
}

function cmdResolveRun(flags) {
  const root = flags.root || process.cwd();
  const date = flags.date || utcDate();
  const outputRoot = readOutputRoot(root);
  const auditRoot = path.join(root, outputRoot);
  const existing = listRunIds(auditRoot);
  const resumeCandidates = inProgressRuns(auditRoot, date);
  const architectureRoot = architectureOutputRoot(outputRoot);
  if (flags.resume) {
    const runId =
      flags.resume === true ? resumeCandidates.at(-1) : flags.resume;
    if (!runId) fail("no in-progress run to resume", 2);
    const runDir = path.join(auditRoot, runId);
    printJson({
      runId,
      path: runDir,
      action: "resume",
      outputRoot,
      architectureRoot,
      inProgress: resumeCandidates,
    });
    return;
  }
  const runId = nextRunId(existing, date);
  const runDir = path.join(auditRoot, runId);
  let drift;
  try {
    drift = parseDriftFlag(flags.drift);
  } catch (error) {
    fail(error.message, 1);
  }
  fs.mkdirSync(runDir, { recursive: true });
  if (drift) {
    atomicWrite(
      path.join(runDir, ".checkpoint.json"),
      `${JSON.stringify({ drift }, null, 2)}\n`,
    );
  }
  printJson({
    runId,
    path: runDir,
    action: "create",
    outputRoot,
    architectureRoot,
    inProgress: resumeCandidates,
  });
}

function readOutputRoot(repoRoot) {
  const contextPath = path.join(repoRoot, ".agents", "lodestar", "context.md");
  if (!fs.existsSync(contextPath)) return DEFAULT_OUTPUT_ROOT;
  try {
    return parseAuditSettings(fs.readFileSync(contextPath, "utf8")).outputRoot;
  } catch (error) {
    fail(error.message, 2);
  }
}

function cmdCheckFreshness(flags) {
  const root = flags.root || process.cwd();
  let result;
  try {
    result = checkFreshness(root, { facts: parseFactsFlag(flags.facts) });
  } catch (error) {
    fail(error.message, 1);
  }
  if (result.drift.length) printDriftHuman(result.drift);
  printJson(result);
  if (result.drift.length) process.exit(2);
}

function cmdDeriveDirection(flags) {
  const root = flags.root || process.cwd();
  try {
    printJson(deriveDirection(root));
  } catch (error) {
    fail(error.message, 1);
  }
}

function cmdValidateInput(flags) {
  const root = flags.root || process.cwd();
  const contextPath = path.join(root, ".agents", "lodestar", "context.md");
  if (!fs.existsSync(contextPath)) {
    fail(
      ".agents/lodestar/context.md is missing. Run lodestar-setup first.",
      2,
    );
  }
  const contextText = fs.readFileSync(contextPath, "utf8");
  let packages;
  try {
    packages = parsePackageLayout(contextText);
  } catch (error) {
    fail(error.message, 2);
  }
  const commands = parseCommands(contextText);
  const directionGraph = parseDirection(contextText);
  let conventions;
  let auditSettings;
  let excluded;
  let git;
  let scope;
  try {
    conventions = parseConventions(contextText);
    auditSettings = parseAuditSettings(contextText);
    excluded = parseExcludedPaths(contextText);
    git = parseGit(contextText);
    scope = parseAuditScope(contextText);
    if (scope.mode === "changed-since") {
      scope = {
        ...scope,
        baselineRef: resolveBaselineRef(root, scope.baselineRef),
      };
    }
  } catch (error) {
    fail(error.message, 2);
  }
  try {
    packages = attachScannableCounts(root, packages, excluded.excludedPaths);
  } catch (error) {
    fail(error.message, 2);
  }
  const detected = resolvePkgManager(root, parsePkgManagerRow(contextText));
  const scannablePackages = packages.filter((row) => row.scannable !== "no");
  printJson({
    packages,
    direction: directionGraph.chain ?? [],
    directionGraph,
    conventions,
    categories: auditSettings.categories,
    outputRoot: auditSettings.outputRoot,
    architectureRoot: architectureOutputRoot(auditSettings.outputRoot),
    fallow: auditSettings.fallow,
    excludedPaths: excluded.excludedPaths,
    testGlobs: excluded.testGlobs,
    git,
    scope,
    commands,
    pkgManager: detected.pkgManager,
    run: detected.run,
    pkgManagerAmbiguous: detected.ambiguous,
    pkgManagerLockfiles: detected.lockfiles,
    pkgManagerProvenance: detected.provenance,
    allPkgRoots: scannablePackages.map((row) => row.path).join(" "),
    aliasPrefix: aliasPrefix(scannablePackages),
  });
}

function cmdChangedFiles(flags) {
  const root = flags.root || process.cwd();
  const since = flags.since;
  if (!since) fail("changed-files requires --since REF", 2);
  const contextPath = path.join(root, ".agents", "lodestar", "context.md");
  let excludedPaths = [];
  if (fs.existsSync(contextPath)) {
    try {
      excludedPaths = parseExcludedPaths(
        fs.readFileSync(contextPath, "utf8"),
      ).excludedPaths;
    } catch (error) {
      fail(error.message, 2);
    }
  }
  try {
    printJson(listChangedFiles(root, since, excludedPaths));
  } catch (error) {
    fail(error.message, 2);
  }
}

function cmdMergeFindings(flags) {
  const inputs = []
    .concat(flags.in || [])
    .concat(flags.input || [])
    .flat()
    .filter(Boolean);
  if (!inputs.length) fail("merge-findings requires --in FILE", 2);
  const files = Array.isArray(inputs) ? inputs : [inputs];
  let findings = [];
  for (const file of files) {
    try {
      findings = findings.concat(loadFindingsInput(file));
    } catch (error) {
      fail(`malformed findings in ${file}: ${error.message}`, 2);
    }
  }
  let changedFiles;
  try {
    changedFiles = parseChangedFilesFlag(flags["changed-files"]);
  } catch (error) {
    fail(error.message, 2);
  }
  const merged = applyChangedFiles(
    assignIds(dedupeFindings(sortFindings(findings))),
    changedFiles,
  );
  const runId = flags["run-id"] || "merged";
  const complete = [];
  if (flags.out && fs.existsSync(flags.out)) {
    complete.push(
      ...parseFindings(fs.readFileSync(flags.out, "utf8")).complete,
    );
  }
  for (const file of files) {
    if (!file.endsWith(".json") && fs.existsSync(file)) {
      complete.push(...parseFindings(fs.readFileSync(file, "utf8")).complete);
    }
  }
  const completeUnique = [];
  const seen = new Set();
  for (const item of complete) {
    if (seen.has(item.category)) continue;
    seen.add(item.category);
    completeUnique.push(item);
  }
  const drift = readDriftFromOut(flags.out);
  const rendered = renderFindings(runId, merged, completeUnique, drift);
  if (flags.out) atomicWrite(flags.out, rendered);
  printJson({ count: merged.length, findings: merged });
}

function readDriftFromOut(outPath) {
  if (!outPath) return null;
  const marker = path.join(path.dirname(outPath), ".checkpoint.json");
  if (!fs.existsSync(marker)) return null;
  try {
    return JSON.parse(fs.readFileSync(marker, "utf8")).drift || null;
  } catch {
    return null;
  }
}

function parseChangedFilesFlag(raw) {
  if (raw === undefined || raw === true) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("expected a JSON array");
    }
    return parsed.map(String);
  } catch (error) {
    throw new Error(`invalid --changed-files: ${error.message}`);
  }
}

function parseDriftFlag(raw) {
  if (raw === undefined || raw === true) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("expected a JSON object");
    }
    return parsed;
  } catch (error) {
    throw new Error(`invalid --drift: ${error.message}`);
  }
}

function cmdValidateOutput(flags) {
  const target = flags.path;
  if (!target) fail("validate-output requires --path FILE", 2);
  if (!fs.existsSync(target)) fail(`${target} does not exist`, 2);
  const text = fs.readFileSync(target, "utf8");
  const placeholders = findPlaceholders(text);
  if (placeholders.length) {
    fail(
      `unresolved placeholders at ${placeholders
        .map((hit) => `${target}:${hit.line}`)
        .join(", ")}`,
      2,
    );
  }
  const parsed = parseFindings(text);
  if (/^### /m.test(text) && parsed.findings.length === 0) {
    fail("malformed finding headings", 2);
  }
  const errors = [];
  parsed.findings.forEach((finding, index) => {
    const expected = padFindingId(index + 1);
    if (finding.id !== expected) {
      errors.push(
        `finding ids must be sequential; expected ${expected}, got ${finding.id}`,
      );
    }
    errors.push(
      ...validateFinding(finding).map((msg) => `${finding.id}: ${msg}`),
    );
  });
  if (errors.length) fail(errors.join("\n"), 2);
  printJson({
    ok: true,
    findings: parsed.findings.length,
    complete: parsed.complete,
  });
}

function cmdCheckpoint(flags) {
  const runDir = flags["run-dir"];
  const category = flags.category;
  const status = flags.status || "complete";
  const count = Number(flags.count || 0);
  if (!runDir || !category)
    fail("checkpoint requires --run-dir and --category", 2);
  if (!CATEGORIES.includes(category)) fail(`unknown category ${category}`, 2);
  fs.mkdirSync(runDir, { recursive: true });
  const findingsPath = path.join(runDir, "findings.md");
  const markerPath = path.join(runDir, ".checkpoint.json");
  let existing = "";
  if (fs.existsSync(findingsPath))
    existing = fs.readFileSync(findingsPath, "utf8");
  if (status === "complete") {
    const line = `## category: ${category} — complete (${count} findings)\n`;
    if (!existing.includes(`## category: ${category} — complete`)) {
      atomicWrite(findingsPath, `${existing.trimEnd()}\n\n${line}`);
    }
  }
  let previous = {};
  if (fs.existsSync(markerPath)) {
    try {
      previous = JSON.parse(fs.readFileSync(markerPath, "utf8"));
    } catch {
      previous = {};
    }
  }
  const checkpoint = {
    ...previous,
    category,
    status,
    count,
    updated_at: new Date().toISOString(),
  };
  if (flags.package) checkpoint.package = flags.package;
  if (status === "complete") delete checkpoint.package;
  atomicWrite(markerPath, `${JSON.stringify(checkpoint, null, 2)}\n`);
  printJson({ ok: true, ...checkpoint, path: findingsPath });
}

function cmdRecover(flags) {
  const runDir = flags["run-dir"];
  if (!runDir) fail("recover requires --run-dir", 2);
  const findingsPath = path.join(runDir, "findings.md");
  if (!fs.existsSync(findingsPath)) {
    printJson({
      action: "restart-discover",
      lastComplete: null,
      findings: [],
    });
    return;
  }
  const text = fs.readFileSync(findingsPath, "utf8");
  const parsed = parseFindings(text);
  const merged = assignIds(dedupeFindings(sortFindings(parsed.findings)));
  const lastComplete = parsed.complete.at(-1)?.category || null;
  const indexExists = fs.existsSync(path.join(runDir, "INDEX.md"));
  const markerPath = path.join(runDir, ".checkpoint.json");
  let checkpoint = null;
  if (fs.existsSync(markerPath)) {
    try {
      checkpoint = JSON.parse(fs.readFileSync(markerPath, "utf8"));
    } catch {
      checkpoint = null;
    }
  }
  const discoverDone =
    parsed.incompleteCategories.length === 0 &&
    checkpoint?.status !== "partial";
  printJson({
    action:
      indexExists && discoverDone
        ? "done"
        : discoverDone
          ? "plan"
          : "resume-discover",
    lastComplete,
    incompleteCategories: parsed.incompleteCategories,
    findings: merged,
    skipped: parsed.skipped,
    checkpoint,
  });
}

const COMMANDS = {
  "resolve-run": cmdResolveRun,
  "validate-input": cmdValidateInput,
  "check-freshness": cmdCheckFreshness,
  "derive-direction": cmdDeriveDirection,
  "changed-files": cmdChangedFiles,
  "merge-findings": cmdMergeFindings,
  "validate-output": cmdValidateOutput,
  checkpoint: cmdCheckpoint,
  recover: cmdRecover,
};

export function run(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const command = positionals[0];
  if (!command || command === "help" || flags.help) {
    usage();
    process.exit(command ? 0 : 1);
  }
  const handler = COMMANDS[command];
  if (!handler) fail(`unknown command ${command}`, 1);
  handler(flags);
}

if (isMain(import.meta.url)) {
  try {
    run();
  } catch (error) {
    fail(error.message || String(error), 2);
  }
}
