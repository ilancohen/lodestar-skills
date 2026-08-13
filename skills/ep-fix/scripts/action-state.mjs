#!/usr/bin/env node
/**
 * Atomic action-item status transitions for ep-fix.
 */
import fs from "node:fs";
import path from "node:path";
import { atomicWrite, fail, isMain, parseArgs } from "./runtime.mjs";

const ITEM_RE = /^\d{3}-[a-z0-9-]+\.md$/;
const CATEGORY_ORDER = [
  "imports",
  "types",
  "ssot",
  "soc-yagni",
  "boundaries",
  "errors",
  "testability",
  "dry",
  "styling",
];

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  return match ? match[1] : "";
}

function field(yaml, name) {
  const match = yaml.match(new RegExp(`^${name}:\\s*(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

function setField(text, name, value) {
  const yaml = frontmatter(text);
  if (!yaml) throw new Error("action item is missing YAML frontmatter");
  const line = `${name}: ${value}`;
  const nextYaml = new RegExp(`^${name}:\\s*.*$`, "m").test(yaml)
    ? yaml.replace(new RegExp(`^${name}:\\s*.*$`, "m"), line)
    : `${yaml.trimEnd()}\n${line}`;
  return text.replace(/^---\n[\s\S]*?\n---\n/, `---\n${nextYaml}\n---\n`);
}

function listItems(runDir) {
  return fs
    .readdirSync(runDir)
    .filter((name) => ITEM_RE.test(name))
    .map((name) => path.join(runDir, name));
}

function summarize(runDir) {
  const items = [];
  for (const file of listItems(runDir)) {
    const text = fs.readFileSync(file, "utf8");
    const yaml = frontmatter(text);
    items.push({
      file,
      id: field(yaml, "id") || path.basename(file).slice(0, 3),
      category: field(yaml, "category"),
      status: field(yaml, "status") || "unstarted",
      risk: field(yaml, "risk"),
      requires_decision: field(yaml, "requires_decision") === "true",
    });
  }
  items.sort((a, b) => {
    const cat = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    if (cat !== 0) return cat;
    return a.id.localeCompare(b.id);
  });
  return items;
}

function moveAtomic(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    fs.renameSync(from, to);
  } catch (error) {
    if (process.platform === "win32" && fs.existsSync(to)) {
      fs.rmSync(to);
      fs.renameSync(from, to);
    } else {
      fs.copyFileSync(from, to);
      fs.rmSync(from);
    }
  }
}

function cmdList(flags) {
  const runDir = flags["run-dir"];
  if (!runDir) fail("list requires --run-dir");
  process.stdout.write(`${JSON.stringify({ items: summarize(runDir) }, null, 2)}\n`);
}

function cmdSetStatus(flags) {
  const file = flags.file;
  const status = flags.status;
  if (!file || !status) fail("set-status requires --file and --status");
  const allowed = ["in_progress", "done", "skipped", "deferred"];
  if (!allowed.includes(status)) fail(`status must be one of ${allowed.join(", ")}`);
  const current = fs.readFileSync(file, "utf8");
  let next = setField(current, "status", status);
  if (flags.note) next = setField(next, "note", flags.note);
  if (flags["completed-at"]) next = setField(next, "completed_at", flags["completed-at"]);
  if (flags.commit) next = setField(next, "commit", flags.commit);
  atomicWrite(file, next);
  process.stdout.write(`${JSON.stringify({ ok: true, file, status }, null, 2)}\n`);
}

function cmdMoveDone(flags) {
  const file = flags.file;
  const runDir = flags["run-dir"];
  if (!file || !runDir) fail("move-done requires --file and --run-dir");
  const dest = path.join(runDir, "done", path.basename(file));
  moveAtomic(file, dest);
  process.stdout.write(`${JSON.stringify({ ok: true, from: file, to: dest }, null, 2)}\n`);
}

function cmdArchiveRun(flags) {
  const runDir = flags["run-dir"];
  if (!runDir) fail("archive-run requires --run-dir");
  const remaining = listItems(runDir);
  if (remaining.length) {
    fail(`cannot archive: ${remaining.length} action items remain in the run root`, 2);
  }
  const dest = path.join(path.dirname(runDir), "done", path.basename(runDir));
  moveAtomic(runDir, dest);
  process.stdout.write(`${JSON.stringify({ ok: true, to: dest }, null, 2)}\n`);
}

const COMMANDS = {
  list: cmdList,
  "set-status": cmdSetStatus,
  "move-done": cmdMoveDone,
  "archive-run": cmdArchiveRun,
};

function main(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const command = positionals[0];
  const handler = COMMANDS[command];
  if (!handler) fail("Usage: action-state list|set-status|move-done|archive-run");
  handler(flags);
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    fail(error.message || String(error), 2);
  }
}
