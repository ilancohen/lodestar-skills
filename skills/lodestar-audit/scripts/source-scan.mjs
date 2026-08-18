#!/usr/bin/env node
/**
 * Portable source search used by lodestar-audit detectors.
 * Replaces grep/awk/sort/uniq pipelines in principle docs.
 */
import fs from "node:fs";
import path from "node:path";
import { fail, isMain, parseArgs, printJson } from "./runtime.mjs";

const DEFAULT_INCLUDE = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const TEST_RE = /\.(spec|test)\./;
const DTS_RE = /\.d\.ts$/;

export { DEFAULT_INCLUDE };

function includeFile(filePath, include) {
  const name = path.basename(filePath);
  const ext = path.extname(name);
  if (!include.length) return true;
  return include.includes(ext) || include.includes(name);
}

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function globToRegExp(glob) {
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

export function matchesGlob(relPath, glob) {
  const posix = String(relPath).replace(/\\/g, "/");
  const candidates = [glob];
  if (!glob.startsWith("**/") && !glob.startsWith("/")) {
    candidates.push(`**/${glob}`);
  }
  return candidates.some((pattern) => globToRegExp(pattern).test(posix));
}

export function isExcluded(absPath, globs, cwd, isDir = false, walkRoot = cwd) {
  if (!globs.length) return false;
  const relToCwd = path.relative(cwd, absPath).replace(/\\/g, "/");
  const fromCwd = relToCwd && !relToCwd.startsWith("..");
  const rel = fromCwd
    ? relToCwd
    : path.relative(walkRoot, absPath).replace(/\\/g, "/");
  if (!rel || rel.startsWith("..")) return false;
  return globs.some((glob) => {
    if (matchesGlob(rel, glob)) return true;
    if (isDir && matchesGlob(`${rel}/dummy`, glob)) return true;
    return false;
  });
}

function flagList(value) {
  if (!value || value === true) return [];
  return Array.isArray(value) ? value : [value];
}

function isTestFile(filePath, testGlobs, cwd, walkRoot) {
  const name = path.basename(filePath);
  if (DTS_RE.test(name)) return true;
  if (testGlobs.length) return isExcluded(filePath, testGlobs, cwd, false, walkRoot);
  return TEST_RE.test(name);
}

export function walk(root, include, excludeTests, files = [], options = {}) {
  const cwd = options.cwd || process.cwd();
  const walkRoot = options.walkRoot || root;
  const opts = { ...options, cwd, walkRoot };
  const excludeGlobs = opts.excludeGlobs || [];
  const testGlobs = opts.testGlobs || [];
  if (!fs.existsSync(root)) return files;
  const stats = fs.statSync(root);
  if (stats.isFile()) {
    if (isExcluded(root, excludeGlobs, cwd, false, walkRoot)) return files;
    if (excludeTests && isTestFile(root, testGlobs, cwd, walkRoot)) return files;
    if (includeFile(root, include)) files.push(root);
    return files;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (isExcluded(full, excludeGlobs, cwd, true, walkRoot)) continue;
      if (
        excludeTests &&
        testGlobs.length &&
        isExcluded(full, testGlobs, cwd, true, walkRoot)
      )
        continue;
      walk(full, include, excludeTests, files, opts);
      continue;
    }
    if (isExcluded(full, excludeGlobs, cwd, false, walkRoot)) continue;
    if (!includeFile(full, include)) continue;
    if (excludeTests && isTestFile(full, testGlobs, cwd, walkRoot)) continue;
    files.push(full);
  }
  return files;
}

export function matchLines(filePath, regex) {
  const text = fs.readFileSync(filePath, "utf8");
  const hits = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (regex.test(line))
      hits.push({ file: filePath, line: index + 1, text: line });
  });
  return hits;
}

const RECIPES = {
  "cross-package-src": {
    include: [".ts", ".tsx"],
    build(flags) {
      const prefix = flags["alias-prefix"] || "";
      return new RegExp(`from ['"]${escapeRe(prefix)}[^'"]*\\/src\\/`);
    },
  },
  "barrel-reexport": {
    include: [],
    fileName: "index.ts",
    build() {
      return /^export \* from/;
    },
  },
  "explicit-any": {
    include: [".ts", ".tsx"],
    build() {
      return /: any\b|as any\b|<any>/;
    },
  },
  "inline-style": {
    include: [".tsx", ".jsx"],
    build() {
      return /style=\{\{/;
    },
  },
  placeholders: {
    include: [".md"],
    build() {
      return /<(typecheck|lint|test|pkg_root|pkg_alias|pkg_responsibility|all_pkg_roots|alias_prefix|pkg_manager|run|RUN_ID)>/;
    },
  },
};

function rootsFrom(flags) {
  const raw = flags.roots || flags.root;
  if (!raw) return [process.cwd()];
  return Array.isArray(raw) ? raw : [raw];
}

export function scan(argv = []) {
  const { flags, positionals } = parseArgs(argv);
  const recipeName = flags.recipe || positionals[0];
  const pattern = flags.pattern;
  const include = flags.include
    ? String(flags.include)
        .split(",")
        .map((item) =>
          item.startsWith(".") ? item : `.${item.replace(/^\*\./, "")}`,
        )
    : DEFAULT_INCLUDE;
  const excludeTests = flags["include-tests"] ? false : true;
  const options = {
    cwd: flags.cwd || process.cwd(),
    excludeGlobs: flagList(flags.exclude),
    testGlobs: flagList(flags["test-glob"]),
  };
  let regex;
  let fileFilter = null;
  let searchInclude = include;
  if (recipeName && RECIPES[recipeName]) {
    const recipe = RECIPES[recipeName];
    regex = recipe.build(flags);
    searchInclude = recipe.include.length ? recipe.include : include;
    if (recipe.fileName) fileFilter = recipe.fileName;
  } else if (pattern) {
    regex = new RegExp(pattern);
  } else {
    fail("source-scan requires --recipe NAME or --pattern REGEX", 1);
  }

  const hits = [];
  for (const root of rootsFrom(flags)) {
    for (const file of walk(root, searchInclude, excludeTests, [], options)) {
      if (fileFilter && path.basename(file) !== fileFilter) continue;
      hits.push(...matchLines(file, regex));
    }
  }
  return { count: hits.length, hits };
}

function main() {
  printJson(scan(process.argv.slice(2)));
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    fail(error.message || String(error), 2);
  }
}
