#!/usr/bin/env node
/** Observe documentation trees for lodestar-setup to record in context.md. */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_OUTPUT_ROOT = "docs/audit";
export const DEFAULT_ARCHITECTURE_ROOT = "docs/architecture-review";
export const DOCS_ROLES = ["home", "staging", "inflight", "unknown"];

const MAP_NAMES = new Set(["README.md", "INDEX.md"]);

export function architectureOutputRoot(outputRoot) {
  const normalized = outputRoot.replace(/\/$/, "");
  if (normalized === DEFAULT_OUTPUT_ROOT) return DEFAULT_ARCHITECTURE_ROOT;
  return `${normalized}/architecture-review`;
}

function posixRel(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function exists(root, relative) {
  return fs.existsSync(path.join(root, relative));
}

function isDir(root, relative) {
  const full = path.join(root, relative);
  return fs.existsSync(full) && fs.statSync(full).isDirectory();
}

function isFile(root, relative) {
  const full = path.join(root, relative);
  return fs.existsSync(full) && fs.statSync(full).isFile();
}

function underPrefix(relative, prefix) {
  return relative === prefix || relative.startsWith(`${prefix}/`);
}

function stripTicks(value) {
  return String(value ?? "")
    .replace(/^`+|`+$/g, "")
    .trim();
}

export function parseDocsLayout(contextText) {
  const tableStart = contextText.search(/^## Docs Layout\s*$/m);
  if (tableStart === -1) return null;
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
    if (cells.length < 3) continue;
    if (/^-+$/.test(cells[0].replace(/:/g, "-"))) continue;
    if (/^path$/i.test(cells[0])) continue;
    const role = stripTicks(cells[1]).toLowerCase();
    if (!DOCS_ROLES.includes(role)) {
      throw new Error(
        `Docs Layout has an invalid Role \`${stripTicks(cells[1])}\`. Expected home, staging, inflight, or unknown. Re-run lodestar-setup.`,
      );
    }
    const docPath = stripTicks(cells[0]);
    if (!docPath) continue;
    rows.push({
      path: docPath,
      role,
      responsibility: stripTicks(cells[2]),
    });
  }
  return rows;
}

function markdownHrefs(text) {
  const hrefs = [];
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1].split("#", 1)[0].split("?", 1)[0].trim();
    if (!href || /^(https?:|mailto:)/i.test(href)) continue;
    hrefs.push(href);
  }
  return hrefs;
}

function linkedDocsPaths(root) {
  const linked = new Set();
  const seeds = ["AGENTS.md", "docs/README.md", "docs/INDEX.md"];
  for (const seed of seeds) {
    const full = path.join(root, seed);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const href of markdownHrefs(text)) {
      const resolved = path.resolve(path.dirname(full), href);
      if (!resolved.startsWith(path.resolve(root))) continue;
      const relative = posixRel(root, resolved);
      if (relative.startsWith("docs/") || relative === "docs") {
        linked.add(relative);
      }
    }
  }
  return linked;
}

function suggestRole(relative, outputRoot, architectureRoot, linked) {
  if (relative === `${outputRoot}/done` || relative === `${outputRoot}/abandoned`) {
    return "staging";
  }
  if (relative === outputRoot) return "staging";
  if (relative === architectureRoot) return "staging";
  if (relative === "docs/plans/done" || relative === "docs/plans/abandoned") {
    return "staging";
  }
  if (relative === "docs/plans") return "inflight";
  if (linked.has(relative)) return "home";
  if (
    relative === "docs/spec" ||
    /(^|\/)spec$/.test(relative) ||
    relative.endsWith("rejected-approaches.md")
  ) {
    return "home";
  }
  if (
    /(^|\/)(adr|adrs|rfcs?)$/.test(relative) &&
    relative !== architectureRoot
  ) {
    return "home";
  }
  return "unknown";
}

function responsibilityFor(relative, role, outputRoot, architectureRoot) {
  if (relative === outputRoot) {
    return "Audit runs. Sweep done/ and abandoned/ only; leave live runs.";
  }
  if (relative === architectureRoot) {
    return "Completed architecture reviews.";
  }
  if (relative === "docs/plans") {
    return "In-flight plans. Nested done/ and abandoned/ are leftovers.";
  }
  if (role === "home") {
    return "Durable docs. Harvest rescued facts here.";
  }
  if (role === "staging") {
    return "Leftover writeups. Default sweep.";
  }
  if (role === "inflight") {
    return "Work in progress. Do not delete.";
  }
  return "Unclassified. Out of scope until you say what it is.";
}

export function listDocsAnchors(root, outputRoot, architectureRoot) {
  const anchors = [];
  const seen = new Set();
  const add = (relative) => {
    if (!relative || seen.has(relative) || !exists(root, relative)) return;
    seen.add(relative);
    anchors.push(relative);
  };
  if (isDir(root, "docs")) {
    for (const name of fs.readdirSync(path.join(root, "docs"))) {
      if (MAP_NAMES.has(name)) continue;
      add(`docs/${name}`);
    }
  }
  if (isDir(root, "docs/plans")) {
    add("docs/plans");
    add("docs/plans/done");
    add("docs/plans/abandoned");
  }
  add(outputRoot);
  if (isDir(root, `${outputRoot}/done`)) add(`${outputRoot}/done`);
  if (isDir(root, `${outputRoot}/abandoned`)) add(`${outputRoot}/abandoned`);
  add(architectureRoot);
  return anchors.sort();
}

export function observeDocsLayout(root, options = {}) {
  const outputRoot = options.outputRoot || DEFAULT_OUTPUT_ROOT;
  const architectureRoot =
    options.architectureRoot || architectureOutputRoot(outputRoot);
  const linked = linkedDocsPaths(root);
  const anchors = listDocsAnchors(root, outputRoot, architectureRoot);
  const skipNested = new Set();
  if (anchors.includes(outputRoot)) {
    skipNested.add(`${outputRoot}/done`);
    skipNested.add(`${outputRoot}/abandoned`);
  }
  const rows = [];
  for (const relative of anchors) {
    if (skipNested.has(relative)) continue;
    const role = suggestRole(relative, outputRoot, architectureRoot, linked);
    rows.push({
      path: relative,
      role,
      responsibility: responsibilityFor(
        relative,
        role,
        outputRoot,
        architectureRoot,
      ),
    });
  }
  return {
    outputRoot,
    architectureRoot,
    rows,
  };
}

function rowCovers(rowPath, observed) {
  return underPrefix(observed, rowPath) || underPrefix(rowPath, observed);
}

export function checkDocsLayoutDrift(root, contextText, options = {}) {
  const rows = parseDocsLayout(contextText);
  if (rows === null) {
    return {
      skipped: [
        {
          check: "docs-layout",
          reason: "## Docs Layout is absent; lodestar-docs will discover homes",
        },
      ],
      drift: [],
    };
  }
  const outputRoot = options.outputRoot || DEFAULT_OUTPUT_ROOT;
  const architectureRoot =
    options.architectureRoot || architectureOutputRoot(outputRoot);
  const drift = [];
  for (const row of rows) {
    if (!exists(root, row.path)) {
      drift.push({
        fact: "missing-docs-path",
        recorded: row.path,
        observed: "path is gone",
        remedy: `Re-run lodestar-setup to drop \`${row.path}\` from ## Docs Layout.`,
      });
    }
  }
  const anchors = listDocsAnchors(root, outputRoot, architectureRoot);
  const skipNested = new Set();
  if (anchors.includes(outputRoot)) {
    skipNested.add(`${outputRoot}/done`);
    skipNested.add(`${outputRoot}/abandoned`);
  }
  for (const observed of anchors) {
    if (skipNested.has(observed)) continue;
    const covered = rows.some((row) => rowCovers(row.path, observed));
    if (!covered) {
      drift.push({
        fact: "extra-docs-path",
        recorded: "no matching row in ## Docs Layout",
        observed,
        remedy: `Re-run lodestar-setup to add \`${observed}\` to ## Docs Layout.`,
      });
    }
  }
  return { skipped: [], drift };
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else {
      flags[key] = next;
      i += 1;
    }
  }
  return flags;
}

export function run(argv = process.argv.slice(2)) {
  const flags = parseArgs(argv);
  const root = path.resolve(flags.root || ".");
  const result = observeDocsLayout(root, {
    outputRoot: flags["output-root"],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

function isMain(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(path.resolve(entry)).href === metaUrl;
}

if (isMain(import.meta.url)) process.exit(run());
