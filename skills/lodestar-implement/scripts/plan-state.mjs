#!/usr/bin/env node
/**
 * Plan stage enumeration, done-marks, rigor, and verified move-to-done.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  atomicWrite,
  fail,
  isMain,
  parseArgs,
  printJson,
  resolvePlansRoot,
  listPendingPlans,
} from "./setup-modules.mjs";

export const TIERS = ["light", "standard", "full"];
const STAGE_FILE_RE = /^\d{2}-.+\.md$/;
const PASS_RE = /^## (?:Pass|Gap|Step)\b.*$/gm;
const RISK_RE =
  /requires decision|rides d\d|public api|schema change|data migration|\bauth(?:entication|orization)?\b|security|money|data-deletion/i;

function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  return match ? match[1] : "";
}

function field(yaml, name) {
  const match = yaml.match(new RegExp(`^${name}:\\s*(.*)$`, "m"));
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
}

export function setField(text, name, value) {
  const yaml = frontmatter(text);
  const line = `${name}: ${value}`;
  if (!yaml) return `---\n${line}\n---\n\n${text}`;
  const nextYaml = new RegExp(`^${name}:\\s*.*$`, "m").test(yaml)
    ? yaml.replace(new RegExp(`^${name}:\\s*.*$`, "m"), line)
    : `${yaml.trimEnd()}\n${line}`;
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, `---\n${nextYaml}\n---\n`);
}

export function planKind(absPath) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`plan path does not exist: ${absPath}`);
  }
  return fs.statSync(absPath).isDirectory() ? "folder" : "file";
}

export function planSlug(absPath) {
  const base = path.basename(absPath);
  return fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()
    ? base
    : base.replace(/\.md$/i, "");
}

function exists(absPath) {
  return fs.existsSync(absPath);
}

export function assertExclusiveLocation(root, plansRoot, slug) {
  const candidates = [
    path.join(root, plansRoot, slug),
    path.join(root, plansRoot, `${slug}.md`),
  ];
  const doneCandidates = [
    path.join(root, plansRoot, "done", slug),
    path.join(root, plansRoot, "done", `${slug}.md`),
  ];
  const src = candidates.find(exists);
  const dest = doneCandidates.find(exists);
  if (src && dest) {
    throw new Error(
      `prior incomplete move: \`${path.relative(root, src)}\` and \`${path.relative(root, dest)}\` both exist. Resolve the leftover copy before re-running lodestar-implement.`,
    );
  }
  return { src: src || null, dest: dest || null };
}

function passStatus(section) {
  const match = section.match(/^Status:\s*(\w+)/m);
  return match ? match[1].toLowerCase() : "pending";
}

export function listStages(absPath) {
  const kind = planKind(absPath);
  if (kind === "folder") {
    const names = fs
      .readdirSync(absPath)
      .filter((name) => STAGE_FILE_RE.test(name))
      .sort();
    return names.map((name) => {
      const file = path.join(absPath, name);
      const text = fs.readFileSync(file, "utf8");
      const yaml = frontmatter(text);
      return {
        id: name.replace(/\.md$/i, ""),
        file,
        kind: "folder-stage",
        status: (field(yaml, "status") || "pending").toLowerCase(),
        rigor: field(yaml, "rigor") || "",
        sequencedAfter: field(yaml, "sequenced_after"),
      };
    });
  }
  const text = fs.readFileSync(absPath, "utf8");
  const headings = [...text.matchAll(PASS_RE)].map((match) => ({
    heading: match[0],
    index: match.index,
  }));
  if (!headings.length) {
    const yaml = frontmatter(text);
    return [
      {
        id: "body",
        file: absPath,
        kind: "file-body",
        status: (field(yaml, "status") || "pending").toLowerCase(),
        rigor: field(yaml, "rigor") || "",
        heading: null,
      },
    ];
  }
  return headings.map((item, i) => {
    const end = headings[i + 1] ? headings[i + 1].index : text.length;
    const section = text.slice(item.index, end);
    return {
      id: item.heading.replace(/^##\s+/, "").trim(),
      file: absPath,
      kind: "file-pass",
      status: passStatus(section),
      rigor: "",
      heading: item.heading,
    };
  });
}

export function inferRigor(absPath) {
  const kind = planKind(absPath);
  const stages = listStages(absPath);
  const readme = path.join(absPath, "README.md");
  const text =
    kind === "folder"
      ? fs.existsSync(readme)
        ? fs.readFileSync(readme, "utf8")
        : ""
      : fs.readFileSync(absPath, "utf8");
  if (
    RISK_RE.test(text) ||
    stages.some((stage) =>
      fs.existsSync(stage.file)
        ? RISK_RE.test(fs.readFileSync(stage.file, "utf8"))
        : false,
    )
  ) {
    return { rigor: "full", reason: "risk-signal" };
  }
  if (kind === "folder") {
    if (stages.length > 3) return { rigor: "full", reason: "many-stages" };
    return { rigor: "standard", reason: "folder-plan" };
  }
  if (stages.length === 1) return { rigor: "light", reason: "one-stage" };
  if (stages.length <= 3) return { rigor: "standard", reason: "few-stages" };
  return { rigor: "full", reason: "many-stages" };
}

export function declaredRigor(absPath) {
  const file =
    planKind(absPath) === "folder"
      ? path.join(absPath, "README.md")
      : absPath;
  const yaml = frontmatter(fs.readFileSync(file, "utf8"));
  const raw = field(yaml, "rigor");
  if (TIERS.includes(raw)) return raw;
  return "";
}

export function effectiveRigor(absPath) {
  const declared = declaredRigor(absPath);
  if (planKind(absPath) === "folder" && declared === "light") {
    return "standard";
  }
  return declared || inferRigor(absPath).rigor;
}

export function writeRigor(absPath, rigor, reason = "") {
  if (!TIERS.includes(rigor)) throw new Error(`invalid rigor: ${rigor}`);
  const file =
    planKind(absPath) === "folder"
      ? path.join(absPath, "README.md")
      : absPath;
  let text = setField(fs.readFileSync(file, "utf8"), "rigor", rigor);
  if (reason) text = setField(text, "rigor_reason", reason);
  atomicWrite(file, text);
  return { file, rigor, reason };
}

export function escalateStage(file, to, trigger) {
  if (!TIERS.includes(to)) throw new Error(`invalid rigor: ${to}`);
  let text = fs.readFileSync(file, "utf8");
  text = setField(text, "rigor", to);
  text = setField(text, "escalated_from_trigger", trigger);
  atomicWrite(file, text);
  return { file, rigor: to, trigger };
}

export function markStageDone(stage, { date, commit }) {
  let text = fs.readFileSync(stage.file, "utf8");
  if (stage.kind === "file-pass" && stage.heading) {
    const line = `Status: done — ${date}, commit ${commit}`;
    if (new RegExp(`^${escapeRe(stage.heading)}\\s*$`, "m").test(text)) {
      const already = new RegExp(
        `^${escapeRe(stage.heading)}\\s*\\nStatus:`,
        "m",
      );
      text = already.test(text)
        ? text.replace(
            new RegExp(
              `^(${escapeRe(stage.heading)}\\s*\\n)Status:.*$`,
              "m",
            ),
            `$1${line}`,
          )
        : text.replace(
            new RegExp(`^(${escapeRe(stage.heading)}\\s*)$`, "m"),
            `$1\n${line}`,
          );
    }
  } else {
    text = setField(text, "status", "done");
    if (date) text = setField(text, "completed_at", date);
    if (commit) text = setField(text, "commit", commit);
  }
  atomicWrite(stage.file, text);
  return { file: stage.file, status: "done", commit };
}

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function gitMv(root, fromAbs, toAbs) {
  fs.mkdirSync(path.dirname(toAbs), { recursive: true });
  const fromRel = path.relative(root, fromAbs);
  const toRel = path.relative(root, toAbs);
  const git = spawnSync("git", ["mv", fromRel, toRel], {
    cwd: root,
    encoding: "utf8",
  });
  if (git.status !== 0) {
    if (fs.statSync(fromAbs).isDirectory()) {
      fs.cpSync(fromAbs, toAbs, { recursive: true });
      fs.rmSync(fromAbs, { recursive: true, force: true });
    } else {
      fs.renameSync(fromAbs, toAbs);
    }
  }
}

export function moveDone(root, plansRoot, srcAbs) {
  const slugName = path.basename(srcAbs);
  const destAbs = path.join(root, plansRoot, "done", slugName);
  if (exists(srcAbs) && exists(destAbs)) {
    throw new Error(
      `move-done refused: both \`${path.relative(root, srcAbs)}\` and \`${path.relative(root, destAbs)}\` exist`,
    );
  }
  gitMv(root, srcAbs, destAbs);
  if (exists(srcAbs) || !exists(destAbs)) {
    throw new Error(
      `move-done post-condition failed: source ${exists(srcAbs) ? "still present" : "gone"}, destination ${exists(destAbs) ? "present" : "missing"}`,
    );
  }
  return {
    from: path.relative(root, srcAbs).split(path.sep).join("/"),
    to: path.relative(root, destAbs).split(path.sep).join("/"),
  };
}

export function resolvePrinciplesCandidates() {
  const candidates = [];
  try {
    const sibling = path.normalize(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "lodestar-setup",
        "principles.md",
      ),
    );
    if (fs.existsSync(sibling)) candidates.push(sibling);
  } catch {
    /* ignore */
  }
  candidates.push(
    ".agents/skills/lodestar-setup/principles.md",
    ".cursor/skills/lodestar-setup/principles.md",
    ".claude/skills/lodestar-setup/principles.md",
  );
  return candidates;
}

function isPrinciplesPath(p) {
  return /(?:^|\/)lodestar-setup\/principles\.md$/.test(
    String(p).replace(/\\/g, "/"),
  );
}

export function parseReviewRubric(contextText) {
  const principles = resolvePrinciplesCandidates()[0];
  const extras = [];
  const heading = contextText.search(/^## Review Rubric\s*$/m);
  if (heading !== -1) {
    const rest = contextText.slice(heading);
    const next = rest.search(/\n## /);
    const section = next === -1 ? rest : rest.slice(0, next);
    for (const line of section.split(/\r?\n/)) {
      const bullet = line.match(/^\s*-\s+`?([^`\s]+)`?/);
      if (!bullet) continue;
      if (isPrinciplesPath(bullet[1])) continue;
      extras.push(bullet[1]);
    }
  }
  return [principles, ...extras];
}

function resolvePlanAbs(root, plansRoot, plan) {
  if (path.isAbsolute(plan)) return plan;
  const direct = path.join(root, plan);
  if (exists(direct)) return direct;
  const under = path.join(root, plansRoot, plan);
  if (exists(under)) return under;
  const md = path.join(root, plansRoot, `${plan}.md`);
  if (exists(md)) return md;
  throw new Error(`plan not found: ${plan}`);
}

export function pickUp(root, plan) {
  const plansRoot = resolvePlansRoot(root);
  const abs = resolvePlanAbs(root, plansRoot, plan);
  const slug = planSlug(abs);
  const exclusive = assertExclusiveLocation(root, plansRoot, slug);
  if (!exclusive.src) {
    throw new Error(`plan not in the plans root: ${slug}`);
  }
  const declared = declaredRigor(abs);
  const inferred = inferRigor(abs);
  const kind = planKind(abs);
  let rigor = declared || inferred.rigor;
  let rigorSource = declared ? "declared" : inferred.reason;
  if (kind === "folder" && rigor === "light") {
    rigor = "standard";
    rigorSource = "folder-not-light";
  }
  return {
    plansRoot,
    kind,
    slug,
    path: path.relative(root, abs).split(path.sep).join("/"),
    rigor,
    rigorSource,
    stages: listStages(abs),
  };
}

/** Pending plans at the root, excluding README.md and reserved dirs. */
export function listCandidates(root) {
  const plansRoot = resolvePlansRoot(root);
  return {
    plansRoot,
    pending: listPendingPlans(root, plansRoot),
  };
}

export function run(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const command = positionals[0];
  const root = path.resolve(flags.root || ".");
  if (command === "pick-up") {
    if (!flags.plan) fail("pick-up requires --plan");
    printJson(pickUp(root, flags.plan));
    return 0;
  }
  if (command === "list") {
    printJson(listCandidates(root));
    return 0;
  }
  if (command === "move-done") {
    if (!flags.plan) fail("move-done requires --plan");
    const plansRoot = flags["plans-root"] || resolvePlansRoot(root);
    const abs = resolvePlanAbs(root, plansRoot, flags.plan);
    printJson(moveDone(root, plansRoot, abs));
    return 0;
  }
  if (command === "write-rigor") {
    if (!flags.plan || !flags.rigor) fail("write-rigor requires --plan and --rigor");
    const plansRoot = resolvePlansRoot(root);
    const abs = resolvePlanAbs(root, plansRoot, flags.plan);
    printJson(writeRigor(abs, flags.rigor, flags.reason || ""));
    return 0;
  }
  fail(`unknown command: ${command || "(none)"}`);
  return 1;
}

if (isMain(import.meta.url)) process.exit(run());
