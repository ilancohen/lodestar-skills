#!/usr/bin/env node
/**
 * Atomic action-item status transitions for lodestar-fix.
 */
import fs from "node:fs";
import path from "node:path";
import { atomicWrite, fail, isMain, parseArgs } from "./setup-modules.mjs";

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
    const cat =
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
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
  process.stdout.write(
    `${JSON.stringify({ items: summarize(runDir) }, null, 2)}\n`,
  );
}

function cmdSetStatus(flags) {
  const file = flags.file;
  const status = flags.status;
  if (!file || !status) fail("set-status requires --file and --status");
  const allowed = ["in_progress", "done", "skipped", "deferred"];
  if (!allowed.includes(status))
    fail(`status must be one of ${allowed.join(", ")}`);
  const current = fs.readFileSync(file, "utf8");
  let next = setField(current, "status", status);
  if (flags.note) next = setField(next, "note", flags.note);
  if (flags["completed-at"])
    next = setField(next, "completed_at", flags["completed-at"]);
  if (flags.commit) next = setField(next, "commit", flags.commit);
  atomicWrite(file, next);
  process.stdout.write(
    `${JSON.stringify({ ok: true, file, status }, null, 2)}\n`,
  );
}

function cmdMoveDone(flags) {
  const file = flags.file;
  const runDir = flags["run-dir"];
  if (!file || !runDir) fail("move-done requires --file and --run-dir");
  const dest = path.join(runDir, "done", path.basename(file));
  moveAtomic(file, dest);
  process.stdout.write(
    `${JSON.stringify({ ok: true, from: file, to: dest }, null, 2)}\n`,
  );
}

function cmdArchiveRun(flags) {
  const runDir = flags["run-dir"];
  if (!runDir) fail("archive-run requires --run-dir");
  const remaining = listItems(runDir);
  if (remaining.length) {
    fail(
      `cannot archive: ${remaining.length} action items remain in the run root`,
      2,
    );
  }
  const dest = path.join(path.dirname(runDir), "done", path.basename(runDir));
  moveAtomic(runDir, dest);
  process.stdout.write(`${JSON.stringify({ ok: true, to: dest }, null, 2)}\n`);
}

// A commit subject or trailer is a single line. A newline in either would
// split the subject or forge a trailer in permanent git history, so reject
// rather than repair — the value comes from context.md and should be fixed
// there.
const MAX_COMMIT_LINE = 200;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function assertCommitLine(value, field, stage) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `## Audit Configuration \`${field}\` is empty (${stage}). Set a single-line value.`,
    );
  }
  if (CONTROL_CHARS.test(value)) {
    throw new Error(
      `## Audit Configuration \`${field}\` contains a newline or control character (${stage}). A commit ${field === "trailer" ? "trailer" : "subject"} must be a single line.`,
    );
  }
  if (value.length > MAX_COMMIT_LINE) {
    throw new Error(
      `## Audit Configuration \`${field}\` is ${value.length} characters (${stage}); the limit is ${MAX_COMMIT_LINE}.`,
    );
  }
  return value;
}

export function formatCommitMessage({
  subjectFormat,
  trailer,
  category,
  slug,
  item,
}) {
  const vars = { category, slug, item };
  const replace = (template) =>
    String(template).replaceAll(
      /<(category|slug|item)>/g,
      (_, name) => vars[name],
    );

  assertCommitLine(subjectFormat, "subject-format", "template");
  const subject = assertCommitLine(
    replace(subjectFormat),
    "subject-format",
    "after substitution",
  );

  if (!trailer || trailer === "none") return `${subject}\n`;

  assertCommitLine(trailer, "trailer", "template");
  const trailerLine = assertCommitLine(
    replace(trailer),
    "trailer",
    "after substitution",
  );
  return `${subject}\n\n${trailerLine}\n`;
}

function slugFromFilename(basename, category) {
  const match = basename.match(new RegExp(`^\\d{3}-${category}-(.+)\\.md$`));
  return match ? match[1] : "";
}

function cmdCommitMessage(flags) {
  const file = flags.file;
  if (!file) fail("commit-message requires --file");
  if (flags["subject-format"] === true || flags.trailer === true) {
    fail("commit-message --subject-format and --trailer need a value");
  }
  const text = fs.readFileSync(file, "utf8");
  const yaml = frontmatter(text);
  const category = field(yaml, "category");
  const slug = slugFromFilename(path.basename(file), category);
  if (!category || !slug) {
    fail("commit-message could not parse category and slug from the item");
  }
  process.stdout.write(
    formatCommitMessage({
      subjectFormat: flags["subject-format"] || "<category>: <slug>",
      trailer: flags.trailer === undefined ? "Closes <item>." : flags.trailer,
      category,
      slug,
      item: flags.item || path.basename(file),
    }),
  );
}

const COMMANDS = {
  list: cmdList,
  "set-status": cmdSetStatus,
  "move-done": cmdMoveDone,
  "archive-run": cmdArchiveRun,
  "commit-message": cmdCommitMessage,
  "validate-returns": cmdValidateReturns,
};

const RETURN_STATUSES = new Set([
  "in_progress",
  "done",
  "skipped",
  "deferred",
]);
const COMMIT_SHA_RE = /^[0-9a-f]{7,40}$/i;

export function validateReturns(runDir, payload) {
  if (!Array.isArray(payload)) {
    throw new Error("validate-returns: expected a JSON array of return entries");
  }
  const knownIds = new Set(summarize(runDir).map((item) => item.id));
  payload.forEach((entry, index) => {
    const where = `entry[${index}]`;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`validate-returns: ${where} must be an object`);
    }
    if (!Object.prototype.hasOwnProperty.call(entry, "item_id")) {
      throw new Error(`validate-returns: ${where}.item_id is required`);
    }
    if (typeof entry.item_id !== "string" || entry.item_id.trim() === "") {
      throw new Error(`validate-returns: ${where}.item_id must be a non-empty string`);
    }
    if (!knownIds.has(entry.item_id)) {
      throw new Error(
        `validate-returns: ${where}.item_id '${entry.item_id}' is not an open item in ${runDir}`,
      );
    }
    if (!Object.prototype.hasOwnProperty.call(entry, "status")) {
      throw new Error(`validate-returns: ${where}.status is required`);
    }
    if (!RETURN_STATUSES.has(entry.status)) {
      throw new Error(
        `validate-returns: ${where}.status '${entry.status}' is not one of ${[...RETURN_STATUSES].join(", ")}`,
      );
    }
    if (!Object.prototype.hasOwnProperty.call(entry, "files_modified")) {
      throw new Error(`validate-returns: ${where}.files_modified is required`);
    }
    if (!Array.isArray(entry.files_modified)) {
      throw new Error(`validate-returns: ${where}.files_modified must be an array`);
    }
    for (let i = 0; i < entry.files_modified.length; i += 1) {
      if (typeof entry.files_modified[i] !== "string") {
        throw new Error(
          `validate-returns: ${where}.files_modified[${i}] must be a string`,
        );
      }
    }
    if (!Object.prototype.hasOwnProperty.call(entry, "commit_sha")) {
      throw new Error(`validate-returns: ${where}.commit_sha is required`);
    }
    if (
      entry.commit_sha !== null &&
      (typeof entry.commit_sha !== "string" ||
        !COMMIT_SHA_RE.test(entry.commit_sha))
    ) {
      throw new Error(
        `validate-returns: ${where}.commit_sha must be a hex git sha or null`,
      );
    }
  });
  return { ok: true, count: payload.length };
}

function cmdValidateReturns(flags) {
  const runDir = flags["run-dir"];
  if (!runDir) fail("validate-returns requires --run-dir");
  const hasJson = flags.json !== undefined && flags.json !== true;
  const hasFile = flags["json-file"] !== undefined && flags["json-file"] !== true;
  if (hasJson === hasFile) {
    fail("validate-returns requires exactly one of --json '<array>' or --json-file <path>");
  }
  let raw;
  if (hasFile) {
    raw = fs.readFileSync(flags["json-file"], "utf8");
  } else {
    raw = flags.json;
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    fail(`validate-returns: JSON is not valid (${error.message})`);
  }
  const result = validateReturns(runDir, payload);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function main(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const command = positionals[0];
  const handler = COMMANDS[command];
  if (!handler)
    fail(
      "Usage: action-state list|set-status|move-done|archive-run|commit-message|validate-returns",
    );
  handler(flags);
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    fail(error.message || String(error), 2);
  }
}
