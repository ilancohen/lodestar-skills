/**
 * Workspace declaration parsing and member enumeration.
 * Shared across the suite. Other skills reach this only through their own
 * scripts/setup-modules.mjs.
 */
import fs from "node:fs";
import path from "node:path";

function posixPath(value) {
  return String(value).replace(/\\/g, "/").replace(/\/+$/, "");
}

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(glob) {
  const pattern = String(glob).replace(/\\/g, "/");
  let i = 0;
  let re = "";
  while (i < pattern.length) {
    if (pattern.startsWith("**/", i)) {
      re += "(?:.*/)?";
      i += 3;
      continue;
    }
    if (pattern.startsWith("**", i)) {
      re += ".*";
      i += 2;
      continue;
    }
    const ch = pattern[i];
    if (ch === "*") {
      re += "[^/]*";
      i += 1;
      continue;
    }
    if (ch === "?") {
      re += "[^/]";
      i += 1;
      continue;
    }
    re += escapeRe(ch);
    i += 1;
  }
  if (pattern.endsWith("/")) re += ".*";
  return new RegExp(`^${re}$`);
}

function matchesGlob(relPath, glob) {
  const posix = String(relPath).replace(/\\/g, "/");
  const candidates = [glob];
  if (!glob.startsWith("**/") && !glob.startsWith("/")) {
    candidates.push(`**/${glob}`);
  }
  return candidates.some((pattern) => globToRegExp(pattern).test(posix));
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
