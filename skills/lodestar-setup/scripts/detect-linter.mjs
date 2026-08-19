#!/usr/bin/env node
/**
 * Detect the repo linter and the JSON probe command setup writes to context.
 */
import fs from "node:fs";
import path from "node:path";
import { fail, isMain, parseArgs, printJson } from "./runtime.mjs";

export const LINTER_PROBE_SUFFIX = "<all_pkg_roots>";

export const LINTER_PROBE_DEFAULTS = {
  eslint: `eslint --format json --max-warnings=999 ${LINTER_PROBE_SUFFIX}`,
  biome: `biome check --reporter=json ${LINTER_PROBE_SUFFIX}`,
  oxlint: `oxlint --format json ${LINTER_PROBE_SUFFIX}`,
  deno: `deno lint --json ${LINTER_PROBE_SUFFIX}`,
  ruff: `ruff check --output-format json ${LINTER_PROBE_SUFFIX}`,
  stylelint: `stylelint --formatter json ${LINTER_PROBE_SUFFIX}`,
  "golangci-lint": `golangci-lint run --out-format json ${LINTER_PROBE_SUFFIX}`,
};

const PACKAGE_TOOL_ALIASES = {
  "@biomejs/biome": "biome",
  "@eslint/js": "eslint",
};

const CONFIG_SIGNALS = [
  {
    tool: "biome",
    files: ["biome.json", "biome.jsonc"],
    packages: ["@biomejs/biome"],
  },
  {
    tool: "eslint",
    files: [
      "eslint.config.js",
      "eslint.config.mjs",
      "eslint.config.cjs",
      "eslint.config.ts",
      ".eslintrc",
      ".eslintrc.js",
      ".eslintrc.cjs",
      ".eslintrc.json",
      ".eslintrc.yaml",
      ".eslintrc.yml",
    ],
    packages: ["eslint"],
  },
  {
    tool: "oxlint",
    files: [".oxlintrc.json", "oxlint.json"],
    packages: ["oxlint"],
  },
  {
    tool: "deno",
    files: ["deno.json", "deno.jsonc"],
    packages: ["deno"],
  },
  {
    tool: "ruff",
    files: ["ruff.toml", ".ruff.toml"],
    packages: ["ruff"],
  },
  {
    tool: "stylelint",
    files: [
      "stylelint.config.js",
      "stylelint.config.cjs",
      "stylelint.config.mjs",
      ".stylelintrc",
      ".stylelintrc.json",
      ".stylelintrc.yml",
      ".stylelintrc.yaml",
    ],
    packages: ["stylelint"],
  },
  {
    tool: "golangci-lint",
    files: [".golangci.yml", ".golangci.yaml", ".golangci.toml"],
    packages: ["golangci-lint"],
  },
];

function readRootPackageJson(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

function depNames(pkg) {
  if (!pkg || typeof pkg !== "object") return new Set();
  const names = new Set();
  for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
    const block = pkg[key];
    if (!block || typeof block !== "object") continue;
    for (const name of Object.keys(block)) names.add(name);
  }
  return names;
}

function fileExists(root, ...candidates) {
  return candidates.some((name) => fs.existsSync(path.join(root, name)));
}

function lintScripts(pkg) {
  if (!pkg?.scripts || typeof pkg.scripts !== "object") return [];
  return ["lint", "eslint", "lint:check", "lint:ci"]
    .map((name) => pkg.scripts[name])
    .filter((value) => typeof value === "string" && value.trim());
}

function firstExecutableToken(script) {
  const token = String(script).trim().split(/\s+/)[0];
  return (
    token?.replace(/^pnpm\s+run\s+/, "").replace(/^npm\s+run\s+/, "") ?? ""
  );
}

export function inferProbeFromLintScript(root, tool) {
  const scripts = lintScripts(readRootPackageJson(root));
  for (const script of scripts) {
    const head = firstExecutableToken(script).toLowerCase();
    if (head === tool || head.endsWith(`/${tool}`)) {
      return LINTER_PROBE_DEFAULTS[tool] ?? null;
    }
    if (tool === "eslint" && /^eslint(\.cmd)?$/i.test(head)) {
      return LINTER_PROBE_DEFAULTS.eslint;
    }
    if (tool === "biome" && /^biome(\.cmd)?$/i.test(head)) {
      return LINTER_PROBE_DEFAULTS.biome;
    }
    if (tool === "oxlint" && /^oxlint(\.cmd)?$/i.test(head)) {
      return LINTER_PROBE_DEFAULTS.oxlint;
    }
  }
  return null;
}

export function formatLintCell(devCommand, detection) {
  const command = String(devCommand ?? "").trim();
  if (!command || /^n\/a$/i.test(command)) return "n/a";
  const tool = detection?.tool;
  const probe = detection?.probe;
  if (!tool || !probe) {
    throw new Error(
      "lint cell needs dev-command; tool; probe-command — run detect-linter.mjs or ask once for the JSON probe.",
    );
  }
  return `${command}; ${tool}; ${probe}`;
}

function matchConfiguredTool(root, deps) {
  for (const entry of CONFIG_SIGNALS) {
    const signals = [];
    if (entry.files.some((name) => fileExists(root, name))) {
      signals.push(`${entry.tool} config file`);
    }
    for (const pkg of entry.packages) {
      if (deps.has(pkg)) signals.push(`package.json dependency ${pkg}`);
    }
    if (!signals.length) continue;
    return {
      tool: entry.tool,
      probe: LINTER_PROBE_DEFAULTS[entry.tool],
      signals,
    };
  }
  return null;
}

export function detectLinter(root) {
  const deps = depNames(readRootPackageJson(root));
  const configured = matchConfiguredTool(root, deps);
  if (configured) return configured;

  for (const [pkg, tool] of Object.entries(PACKAGE_TOOL_ALIASES)) {
    if (!deps.has(pkg)) continue;
    return {
      tool,
      probe:
        LINTER_PROBE_DEFAULTS[tool] ?? inferProbeFromLintScript(root, tool),
      signals: [`package.json dependency ${pkg}`],
    };
  }

  for (const name of deps) {
    if (!/lint/i.test(name) || /eslint-plugin/i.test(name)) continue;
    const tool = PACKAGE_TOOL_ALIASES[name] ?? name;
    const probe =
      LINTER_PROBE_DEFAULTS[tool] ?? inferProbeFromLintScript(root, tool);
    if (probe) {
      return {
        tool,
        probe,
        signals: [`package.json dependency ${name}`],
      };
    }
    return {
      tool,
      probe: null,
      signals: [`package.json dependency ${name}`],
      needsProbe: true,
    };
  }
  return { tool: null, probe: null, signals: [] };
}

function main(argv = process.argv.slice(2)) {
  const { flags } = parseArgs(argv);
  const root = flags.root || process.cwd();
  printJson(detectLinter(root));
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    fail(error.message || String(error), 2);
  }
}
