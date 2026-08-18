#!/usr/bin/env node
/**
 * Deterministic audit-state helper. Installed with lodestar-audit.
 *
 * Subcommands: resolve-run, validate-input, merge-findings,
 * validate-output, checkpoint, recover
 */
import fs from "node:fs";
import path from "node:path";
import { detectPkgManager } from "./pkg-manager.mjs";
import {
  atomicWrite,
  fail,
  isMain,
  parseArgs,
  printJson,
  utcDate,
} from "./runtime.mjs";

export { detectPkgManager } from "./pkg-manager.mjs";

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
  /<(typecheck|lint|test|pkg_root|pkg_alias|pkg_responsibility|all_pkg_roots|alias_prefix|pkg_manager|run|RUN_ID)>/;

export const FINDING_RE = /^### (F\d{4})\s*$/m;

function usage() {
  process.stderr.write(`Usage: audit-state <command> [options]

Commands:
  resolve-run --root DIR [--date YYYY-MM-DD] [--resume RUN_ID]
  validate-input --root DIR
  merge-findings --in FILE [--in FILE ...] [--out FILE]
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
    rows.push({
      name: cells[0],
      path: cells[1],
      alias: cells[2],
      responsibility: cells[3],
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

export function parseCommands(contextText) {
  const commands = {};
  for (const name of ["typecheck", "lint", "test"]) {
    const match = contextText.match(
      new RegExp(`\\|\\s*${name}\\s*\\|\\s*([^|]+)\\|`, "i"),
    );
    if (match) commands[name] = match[1].trim();
  }
  return commands;
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

export function renderFindings(runId, findings, complete = []) {
  const lines = [
    `# Audit findings — ${runId}`,
    "",
    "Generated by lodestar-audit. One block per detected",
    "violation. Edit freely before Phase 2 — false positives can be removed",
    "by deleting the block.",
    "",
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
  const auditRoot = path.join(root, "docs", "audit");
  const existing = listRunIds(auditRoot);
  const resumeCandidates = inProgressRuns(auditRoot, date);
  if (flags.resume) {
    const runId =
      flags.resume === true ? resumeCandidates.at(-1) : flags.resume;
    if (!runId) fail("no in-progress run to resume", 2);
    const runDir = path.join(auditRoot, runId);
    printJson({
      runId,
      path: runDir,
      action: "resume",
      inProgress: resumeCandidates,
    });
    return;
  }
  const runId = nextRunId(existing, date);
  const runDir = path.join(auditRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });
  printJson({
    runId,
    path: runDir,
    action: "create",
    inProgress: resumeCandidates,
  });
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
  try {
    conventions = parseConventions(contextText);
  } catch (error) {
    fail(error.message, 2);
  }
  const detected = detectPkgManager(root);
  printJson({
    packages,
    direction: directionGraph.chain ?? [],
    directionGraph,
    conventions,
    commands,
    pkgManager: detected.pkgManager,
    run: detected.run,
    pkgManagerAmbiguous: detected.ambiguous,
    pkgManagerLockfiles: detected.lockfiles,
    allPkgRoots: packages.map((row) => row.path).join(" "),
    aliasPrefix: aliasPrefix(packages),
  });
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
  const merged = assignIds(dedupeFindings(sortFindings(findings)));
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
  const rendered = renderFindings(runId, merged, completeUnique);
  if (flags.out) atomicWrite(flags.out, rendered);
  printJson({ count: merged.length, findings: merged });
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
