#!/usr/bin/env node
/** Resolve the plans root and list plans from the filesystem. */

import fs from "node:fs";
import path from "node:path";
import { parseDocsLayout } from "./discover-docs.mjs";
import { parseArgs, printJson, fail, isMain } from "./runtime.mjs";

export const DEFAULT_PLANS_ROOT = "docs/plans";
export const RESERVED_NAMES = new Set(["done", "abandoned", "adr"]);
export const OPTIONAL_README = "README.md";

function posixJoin(...parts) {
  return parts.join("/").replace(/\/{2,}/g, "/");
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

export function doneDir(plansRoot) {
  return posixJoin(normalizePlansRoot(plansRoot), "done");
}

export function abandonedDir(plansRoot) {
  return posixJoin(normalizePlansRoot(plansRoot), "abandoned");
}

function isPlanEntry(name, absPath) {
  if (RESERVED_NAMES.has(name)) return false;
  if (name === OPTIONAL_README) return false;
  if (name.startsWith(".")) return false;
  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) return true;
  return stat.isFile() && /\.md$/i.test(name);
}

function entryKind(absPath) {
  return fs.statSync(absPath).isDirectory() ? "folder" : "file";
}

function entryHref(name, kind) {
  if (kind === "folder") return name.endsWith("/") ? name : `${name}/`;
  return name;
}

function entrySlug(name, kind) {
  return kind === "folder" ? name : name.replace(/\.md$/i, "");
}

function listDirPlans(root, relativeDir) {
  const abs = path.join(root, relativeDir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return [];
  const names = fs.readdirSync(abs).sort((a, b) => a.localeCompare(b));
  const entries = [];
  for (const name of names) {
    const absPath = path.join(abs, name);
    if (!isPlanEntry(name, absPath)) continue;
    const kind = entryKind(absPath);
    const rel = posixJoin(relativeDir, name);
    entries.push({
      name,
      slug: entrySlug(name, kind),
      kind,
      path: rel,
      href: entryHref(name, kind),
    });
  }
  return entries;
}

/** Pending plans at the plans root. README.md is never a plan. */
export function listPendingPlans(root, plansRoot = resolvePlansRoot(root)) {
  return listDirPlans(root, normalizePlansRoot(plansRoot));
}

export function listDonePlans(root, plansRoot = resolvePlansRoot(root)) {
  return listDirPlans(root, doneDir(plansRoot));
}

export function listAbandonedPlans(root, plansRoot = resolvePlansRoot(root)) {
  return listDirPlans(root, abandonedDir(plansRoot));
}

/**
 * Create only the plans root. Never creates done/, abandoned/, or a README.
 * Call only when writing a valid plan after grounding succeeds.
 */
export function ensurePlansRoot(root, plansRoot = resolvePlansRoot(root)) {
  const relative = normalizePlansRoot(plansRoot);
  const abs = path.join(root, relative);
  const createdRoot = !fs.existsSync(abs);
  fs.mkdirSync(abs, { recursive: true });
  return {
    plansRoot: relative,
    doneDir: doneDir(relative),
    abandonedDir: abandonedDir(relative),
    createdRoot,
  };
}

/** @deprecated Prefer ensurePlansRoot — same behavior, no ledger. */
export function bootstrapPlansRoot(root, plansRoot = resolvePlansRoot(root)) {
  return ensurePlansRoot(root, plansRoot);
}

export function discoverPlans(root, plansRoot = resolvePlansRoot(root)) {
  const relative = normalizePlansRoot(plansRoot);
  const pending = listPendingPlans(root, relative);
  const done = listDonePlans(root, relative);
  const abandoned = listAbandonedPlans(root, relative);
  const bySlug = new Map();
  for (const entry of pending) {
    bySlug.set(entry.slug, { ...(bySlug.get(entry.slug) || {}), pending: entry });
  }
  for (const entry of done) {
    bySlug.set(entry.slug, { ...(bySlug.get(entry.slug) || {}), done: entry });
  }
  const duplicates = [...bySlug.entries()]
    .filter(([, locs]) => locs.pending && locs.done)
    .map(([slug, locs]) => ({
      slug,
      pending: locs.pending.path,
      done: locs.done.path,
    }));
  return {
    plansRoot: relative,
    doneDir: doneDir(relative),
    abandonedDir: abandonedDir(relative),
    pending,
    done,
    abandoned,
    duplicates,
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
      doneDir: doneDir(plansRoot),
      abandonedDir: abandonedDir(plansRoot),
      context: loadContext(root) ? "present" : "absent",
    });
    return 0;
  }
  if (command === "ensure-root" || command === "bootstrap") {
    printJson(ensurePlansRoot(root, flags["plans-root"]));
    return 0;
  }
  if (command === "list") {
    printJson(discoverPlans(root, flags["plans-root"]));
    return 0;
  }
  fail(`unknown command: ${command}`);
  return 1;
}

if (isMain(import.meta.url)) process.exit(run());
