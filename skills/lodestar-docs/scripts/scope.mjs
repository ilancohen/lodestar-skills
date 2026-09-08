#!/usr/bin/env node
/** Discover prune scope, canonical homes, and a file survey for lodestar-docs. */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_ARCHITECTURE_ROOT,
  DEFAULT_OUTPUT_ROOT,
  architectureOutputRoot,
  isMain,
  observeDocsLayout,
  parseArgs,
  parseDocsLayout,
} from "./setup-modules.mjs";

export {
  DEFAULT_ARCHITECTURE_ROOT,
  DEFAULT_OUTPUT_ROOT,
  architectureOutputRoot,
};

const SKIP_DIR_NAMES = new Set([".git", "node_modules", "dist"]);

function posixRel(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function readContext(root) {
  const contextPath = path.join(root, ".agents/lodestar/context.md");
  if (!fs.existsSync(contextPath)) {
    return { contextPath, missing: true };
  }
  const text = fs.readFileSync(contextPath, "utf8");
  const outputMatch = text.match(
    /^\|\s*`output-root`\s*\|\s*`?([^`|\n]+)`?/m,
  );
  const commitsMatch = text.match(/^\|\s*`commits`\s*\|\s*`?([^`|\n]+)`?/m);
  const outputRoot = outputMatch
    ? outputMatch[1].trim()
    : DEFAULT_OUTPUT_ROOT;
  return {
    contextPath,
    missing: false,
    text,
    outputRoot,
    architectureRoot: architectureOutputRoot(outputRoot),
    commits: commitsMatch ? commitsMatch[1].trim() : "ask",
    docsLayout: parseDocsLayout(text),
  };
}

function existsDir(root, relative) {
  const full = path.join(root, relative);
  return fs.existsSync(full) && fs.statSync(full).isDirectory();
}

export function isLiveAuditRun(dir) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
  const names = fs.readdirSync(dir);
  if (names.includes("findings.md")) return true;
  if (names.includes(".checkpoint.json")) return true;
  if (names.some((name) => /^\d{3}-.+\.md$/.test(name))) return true;
  return false;
}

function underPrefix(relative, prefix) {
  return relative === prefix || relative.startsWith(`${prefix}/`);
}

function auditStagingTrees(root, outputRoot) {
  const trees = [];
  for (const relative of [`${outputRoot}/done`, `${outputRoot}/abandoned`]) {
    if (existsDir(root, relative)) trees.push(relative);
  }
  const outputAbs = path.join(root, outputRoot);
  if (existsDir(root, outputRoot)) {
    for (const name of fs.readdirSync(outputAbs)) {
      if (name === "done" || name === "abandoned") continue;
      const full = path.join(outputAbs, name);
      if (!fs.statSync(full).isFile()) continue;
      trees.push(`${outputRoot}/${name}`);
    }
  }
  return trees;
}

export function defaultTrees(root, context) {
  const rows = resolveLayoutRows(root, context);
  const trees = [];
  const seen = new Set();
  const add = (relative) => {
    if (!relative || seen.has(relative)) return;
    if (!exists(root, relative) && !existsDir(root, relative)) return;
    seen.add(relative);
    trees.push(relative);
  };
  for (const row of rows) {
    if (row.role !== "staging") continue;
    if (row.path === context.outputRoot) {
      for (const tree of auditStagingTrees(root, context.outputRoot)) add(tree);
      continue;
    }
    add(row.path);
  }
  return trees;
}

function exists(root, relative) {
  return fs.existsSync(path.join(root, relative));
}

function resolveLayoutRows(root, context) {
  if (context.docsLayout) return context.docsLayout;
  return observeDocsLayout(root, {
    outputRoot: context.outputRoot,
    architectureRoot: context.architectureRoot,
  }).rows;
}

function walkFiles(absDir, files = []) {
  if (!fs.existsSync(absDir)) return files;
  const stat = fs.statSync(absDir);
  if (stat.isFile()) {
    files.push(absDir);
    return files;
  }
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = path.join(absDir, entry.name);
    if (entry.isDirectory()) walkFiles(full, files);
    else files.push(full);
  }
  return files;
}

export function discoverHomes(root, context) {
  const homes = [];
  for (const row of resolveLayoutRows(root, context)) {
    if (row.role !== "home") continue;
    const full = path.join(root, row.path);
    if (!fs.existsSync(full)) continue;
    if (fs.statSync(full).isFile()) {
      if (row.path.endsWith(".md") && !homes.includes(row.path)) {
        homes.push(row.path);
      }
      continue;
    }
    for (const file of walkFiles(full)) {
      if (!file.endsWith(".md")) continue;
      const relative = posixRel(root, file);
      if (!homes.includes(relative)) homes.push(relative);
    }
  }
  return homes;
}

export function agentsMdHasDocsMap(root) {
  const agentsPath = path.join(root, "AGENTS.md");
  if (!fs.existsSync(agentsPath)) return false;
  const text = fs.readFileSync(agentsPath, "utf8");
  return /^##\s+(Docs map|Docs)\s*$/m.test(text);
}

function lastCommitDate(root, relative) {
  const result = spawnSync(
    "git",
    ["log", "-1", "--format=%ad", "--date=short", "--", relative],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status !== 0) return null;
  const value = result.stdout.trim();
  return value || null;
}

function liveRunPrefixes(root, outputRoot) {
  const prefixes = [];
  const abs = path.join(root, outputRoot);
  if (!existsDir(root, outputRoot)) return prefixes;
  for (const name of fs.readdirSync(abs)) {
    const full = path.join(abs, name);
    if (!fs.statSync(full).isDirectory()) continue;
    if (name === "done" || name === "abandoned") continue;
    if (isLiveAuditRun(full)) prefixes.push(`${outputRoot}/${name}`);
  }
  return prefixes;
}

function inflightPrefixes(root, context) {
  const prefixes = [];
  const staging = new Set(
    resolveLayoutRows(root, context)
      .filter((row) => row.role === "staging")
      .map((row) => row.path),
  );
  for (const row of resolveLayoutRows(root, context)) {
    if (row.role !== "inflight") continue;
    prefixes.push(row.path);
  }
  return { prefixes, staging };
}

function classify(relative, liveRuns, inflight, stagingPaths) {
  if (relative === ".agents/lodestar/context.md") {
    return { protected: true, reason: "lodestar-context" };
  }
  if (
    /(^|\/)\.agents\/skills\//.test(relative) ||
    /(^|\/)\.cursor\/skills\//.test(relative) ||
    /(^|\/)\.claude\/skills\//.test(relative)
  ) {
    return { protected: true, reason: "skill-definition" };
  }
  if (liveRuns.some((prefix) => underPrefix(relative, prefix))) {
    return { protected: true, reason: "live-audit-run" };
  }
  const underStaging = stagingPaths.some((prefix) =>
    underPrefix(relative, prefix),
  );
  if (
    inflight.some((prefix) => underPrefix(relative, prefix)) &&
    !underStaging
  ) {
    return { protected: true, reason: "inflight-plan" };
  }
  return { protected: false, reason: null };
}

export function survey(root, options = {}) {
  let context = readContext(root);
  const contextWasMissing = context.missing;
  const widened = Boolean(options.full || options.trees?.length);
  if (context.missing) {
    context = {
      contextPath: context.contextPath,
      missing: false,
      outputRoot: DEFAULT_OUTPUT_ROOT,
      architectureRoot: DEFAULT_ARCHITECTURE_ROOT,
      commits: "ask",
      docsLayout: null,
    };
  }
  const liveRuns = liveRunPrefixes(root, context.outputRoot);
  const inflight = inflightPrefixes(root, context);
  let trees;
  if (options.full) {
    trees = existsDir(root, "docs") ? ["docs"] : [];
  } else if (options.trees?.length) {
    trees = options.trees;
  } else {
    trees = defaultTrees(root, context);
  }
  if (contextWasMissing && !widened && trees.length === 0) {
    return {
      ok: false,
      error:
        "No docs staging trees found. Name a folder with --tree, pass --full, or run lodestar-setup to record Docs Layout.",
    };
  }
  const seen = new Set();
  const files = [];
  for (const tree of trees) {
    const abs = path.join(root, tree);
    if (!fs.existsSync(abs)) continue;
    for (const file of walkFiles(abs)) {
      const relative = posixRel(root, file);
      if (seen.has(relative)) continue;
      seen.add(relative);
      const { protected: isProtected, reason } = classify(
        relative,
        liveRuns,
        inflight.prefixes,
        [...inflight.staging],
      );
      const stat = fs.statSync(file);
      files.push({
        path: relative,
        bytes: stat.size,
        lastCommit: lastCommitDate(root, relative),
        protected: isProtected,
        reason,
      });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    ok: true,
    outputRoot: context.outputRoot,
    architectureRoot: context.architectureRoot,
    commits: context.commits,
    agentsMdHasDocsMap: agentsMdHasDocsMap(root),
    docsLayout: resolveLayoutRows(root, context),
    homes: discoverHomes(root, context),
    trees,
    liveAuditRuns: liveRuns,
    files,
  };
}

function flagList(flags, key) {
  const value = flags[key];
  if (value === undefined || value === true) return [];
  return [].concat(value);
}

export function run(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const command = positionals[0];
  if (command !== "survey") {
    process.stderr.write("ERROR: usage: scope.mjs survey --root <repo>\n");
    return 1;
  }
  const root = path.resolve(flags.root || ".");
  const result = survey(root, {
    full: Boolean(flags.full),
    trees: flagList(flags, "tree"),
  });
  if (!result.ok) {
    process.stderr.write(`ERROR: ${result.error}\n`);
    return 2;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

if (isMain(import.meta.url)) process.exit(run());
