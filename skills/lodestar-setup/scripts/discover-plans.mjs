#!/usr/bin/env node
/** Resolve the plans root and read/write its ledger. */

import fs from "node:fs";
import path from "node:path";
import { parseDocsLayout } from "./discover-docs.mjs";
import { atomicWrite, parseArgs, printJson, fail, isMain } from "./runtime.mjs";

export const DEFAULT_PLANS_ROOT = "docs/plans";
export const LEDGER_NAME = "README.md";

function posixJoin(...parts) {
  return parts.join("/").replace(/\/{2,}/g, "/");
}

function stripTicks(value) {
  return String(value ?? "")
    .replace(/^`+|`+$/g, "")
    .trim();
}

function normalizePlansRoot(relative) {
  return String(relative || DEFAULT_PLANS_ROOT)
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
}

export function loadContext(root) {
  const filePath = path.join(root, ".agents", "lodestar", "context.md");
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  return fs.readFileSync(filePath, "utf8");
}

export function resolvePlansRoot(root, contextText = loadContext(root)) {
  if (!contextText) return DEFAULT_PLANS_ROOT;
  let rows;
  try {
    rows = parseDocsLayout(contextText);
  } catch {
    return DEFAULT_PLANS_ROOT;
  }
  if (!rows) return DEFAULT_PLANS_ROOT;
  const inflight = rows.filter(
    (row) =>
      row.role === "inflight" && !/\.[a-z0-9]+$/i.test(row.path),
  );
  const named = inflight.find((row) =>
    /(^|\/)plans$/.test(normalizePlansRoot(row.path)),
  );
  if (named) return normalizePlansRoot(named.path);
  if (inflight.length === 1) return normalizePlansRoot(inflight[0].path);
  return DEFAULT_PLANS_ROOT;
}

export function ledgerPath(plansRoot) {
  return posixJoin(normalizePlansRoot(plansRoot), LEDGER_NAME);
}

export function doneDir(plansRoot) {
  return posixJoin(normalizePlansRoot(plansRoot), "done");
}

export function emptyLedger() {
  return `# Plans ledger

In-flight plans live here. Completed work moves to \`done/\` via lodestar-implement.
Abandoned work moves to \`abandoned/\`.

## Awaiting Implementation

| Plan | Summary |
| ---- | ------- |

## Done

| Plan | Evidence |
| ---- | -------- |
`;
}

function headingSection(text, heading) {
  const re = new RegExp(`^## ${heading}\\s*$`, "m");
  const match = text.match(re);
  if (!match) return null;
  const start = match.index;
  const rest = text.slice(start);
  const next = rest.slice(match[0].length).search(/\n## /);
  const end =
    next === -1 ? text.length : start + match[0].length + next;
  return { start, end, body: text.slice(start, end) };
}

function parseLinkCell(cell) {
  const raw = stripTicks(cell);
  const linked = raw.match(/^\[([^\]]*)\]\(([^)]+)\)$/);
  if (linked) {
    return { label: linked[1].trim(), href: linked[2].trim() };
  }
  return { label: raw, href: raw };
}

function splitTableCells(line) {
  const inner = line.replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let current = "";
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] === "\\" && inner[i + 1] === "|") {
      current += "|";
      i += 1;
      continue;
    }
    if (inner[i] === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += inner[i];
  }
  cells.push(current.trim());
  return cells;
}

function parseTable(sectionBody) {
  const rows = [];
  for (const line of sectionBody.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = splitTableCells(line);
    if (cells.length < 2) continue;
    if (/^-+$/.test(cells[0].replace(/:/g, "-"))) continue;
    if (/^plan$/i.test(stripTicks(cells[0]))) continue;
    const { label, href } = parseLinkCell(cells[0]);
    if (!href) continue;
    rows.push({
      label,
      href,
      summary: cells.slice(1).join(" | ").trim(),
    });
  }
  return rows;
}

export function parseLedger(text) {
  const awaitingSection = headingSection(text, "Awaiting Implementation");
  const doneSection = headingSection(text, "Done");
  return {
    awaiting: awaitingSection ? parseTable(awaitingSection.body) : [],
    done: doneSection ? parseTable(doneSection.body) : [],
  };
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|");
}

function renderRow(row) {
  const label = row.label || row.href;
  const href = row.href;
  const cell = href ? `[${label}](${href})` : label;
  return `| ${cell} | ${escapeCell(row.summary)} |`;
}

function renderTable(heading, columns, rows) {
  const header = `| ${columns.join(" | ")} |`;
  const sep = `| ${columns.map(() => "----").join(" | ")} |`;
  const body = rows.map(renderRow).join("\n");
  return `## ${heading}\n\n${header}\n${sep}${body ? `\n${body}` : ""}\n`;
}

export function renderLedger(parsed) {
  return `# Plans ledger

In-flight plans live here. Completed work moves to \`done/\` via lodestar-implement.
Abandoned work moves to \`abandoned/\`.

${renderTable("Awaiting Implementation", ["Plan", "Summary"], parsed.awaiting)}
${renderTable("Done", ["Plan", "Evidence"], parsed.done)}`;
}

function samePlan(row, href) {
  const left = normalizePlansRoot(row.href);
  const right = normalizePlansRoot(href);
  return left === right;
}

export function addAwaitingRow(ledgerText, href, summary, label = href) {
  const parsed = parseLedger(ledgerText);
  if (parsed.awaiting.some((row) => samePlan(row, href))) {
    return { text: ledgerText, added: false };
  }
  const section = headingSection(ledgerText, "Awaiting Implementation");
  if (!section) {
    parsed.awaiting.push({ href, label, summary });
    return { text: renderLedger(parsed), added: true };
  }
  const lines = section.body.split(/\r?\n/);
  let lastTableLine = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith("|")) lastTableLine = i;
  }
  const row = renderRow({ href, label, summary });
  if (lastTableLine === -1) {
    lines.push("", "| Plan | Summary |", "| ---- | ------- |", row);
  } else {
    lines.splice(lastTableLine + 1, 0, row);
  }
  const newBody = lines.join("\n");
  return {
    text: ledgerText.slice(0, section.start) + newBody + ledgerText.slice(section.end),
    added: true,
  };
}

function removeMatchingRow(sectionBody, href) {
  const lines = sectionBody.split(/\r?\n/);
  const next = lines.filter((line) => {
    if (!line.startsWith("|")) return true;
    const cells = splitTableCells(line);
    if (cells.length < 2) return true;
    const parsed = parseLinkCell(cells[0]);
    return !parsed.href || !samePlan(parsed, href);
  });
  return { body: next.join("\n"), removed: next.length !== lines.length };
}

export function moveAwaitingToDone(ledgerText, href, evidence, label) {
  const parsed = parseLedger(ledgerText);
  const row = parsed.awaiting.find((item) => samePlan(item, href));
  if (!row) return { text: ledgerText, moved: false };
  const awaiting = headingSection(ledgerText, "Awaiting Implementation");
  if (!awaiting) return { text: ledgerText, moved: false };
  const stripped = removeMatchingRow(awaiting.body, href);
  let text =
    ledgerText.slice(0, awaiting.start) +
    stripped.body +
    ledgerText.slice(awaiting.end);
  const doneHref = href.startsWith("done/") ? href : `done/${href.replace(/\/$/, "")}${href.endsWith("/") ? "/" : ""}`;
  const doneRow = {
    href: doneHref,
    label: label || row.label || href,
    summary: evidence,
  };
  const done = headingSection(text, "Done");
  if (!done) {
    text = `${text.trimEnd()}\n\n${renderTable("Done", ["Plan", "Evidence"], [doneRow])}`;
    return { text, moved: true };
  }
  const lines = done.body.split(/\r?\n/);
  let lastTableLine = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith("|")) lastTableLine = i;
  }
  const rendered = renderRow(doneRow);
  if (lastTableLine === -1) {
    lines.push("", "| Plan | Evidence |", "| ---- | -------- |", rendered);
  } else {
    lines.splice(lastTableLine + 1, 0, rendered);
  }
  return {
    text: text.slice(0, done.start) + lines.join("\n") + text.slice(done.end),
    moved: true,
  };
}

export function bootstrapPlansRoot(root, plansRoot = resolvePlansRoot(root)) {
  const relative = normalizePlansRoot(plansRoot);
  const abs = path.join(root, relative);
  const doneAbs = path.join(root, doneDir(relative));
  const ledgerAbs = path.join(root, ledgerPath(relative));
  const createdRoot = !fs.existsSync(abs);
  fs.mkdirSync(abs, { recursive: true });
  fs.mkdirSync(doneAbs, { recursive: true });
  let createdLedger = false;
  if (!fs.existsSync(ledgerAbs)) {
    atomicWrite(ledgerAbs, emptyLedger());
    createdLedger = true;
  }
  return {
    plansRoot: relative,
    ledgerPath: ledgerPath(relative),
    doneDir: doneDir(relative),
    createdRoot,
    createdLedger,
  };
}

export function run(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const command = positionals[0];
  const root = path.resolve(flags.root || ".");
  if (!command || command === "resolve") {
    const plansRoot = resolvePlansRoot(root);
    printJson({
      plansRoot,
      ledgerPath: ledgerPath(plansRoot),
      doneDir: doneDir(plansRoot),
      context: loadContext(root) ? "present" : "absent",
    });
    return 0;
  }
  if (command === "bootstrap") {
    printJson(bootstrapPlansRoot(root, flags["plans-root"]));
    return 0;
  }
  if (command === "add-awaiting") {
    const href = flags.plan;
    const summary = flags.summary;
    if (!href || !summary) {
      fail("add-awaiting requires --plan and --summary");
    }
    const boot = bootstrapPlansRoot(root, flags["plans-root"]);
    const abs = path.join(root, boot.ledgerPath);
    const current = fs.readFileSync(abs, "utf8");
    const result = addAwaitingRow(
      current,
      href,
      summary,
      flags.label || href,
    );
    if (result.added) atomicWrite(abs, result.text);
    printJson({ ...boot, added: result.added, plan: href });
    return 0;
  }
  fail(`unknown command: ${command}`);
  return 1;
}

if (isMain(import.meta.url)) process.exit(run());
