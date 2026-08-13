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

export function walk(root, include, excludeTests, files = []) {
  if (!fs.existsSync(root)) return files;
  const stats = fs.statSync(root);
  if (stats.isFile()) {
    files.push(root);
    return files;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walk(full, include, excludeTests, files);
      continue;
    }
    const ext = path.extname(entry.name);
    if (
      include.length &&
      !include.includes(ext) &&
      !include.includes(entry.name)
    ) {
      continue;
    }
    if (excludeTests && (TEST_RE.test(entry.name) || DTS_RE.test(entry.name)))
      continue;
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

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
    for (const file of walk(root, searchInclude, excludeTests)) {
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
