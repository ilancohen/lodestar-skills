/**
 * Detect npm / yarn / pnpm / bun from lockfiles. Never guess.
 * Multiple managers or zero lockfiles → ask the user.
 * A recorded `pkg-manager` row in context.md wins over detection.
 */
import fs from "node:fs";
import path from "node:path";

export const MANAGERS = {
  pnpm: {
    lockfile: "pnpm-lock.yaml",
    run: "pnpm dlx",
    addDev: (pkg) => `pnpm add -D ${pkg}`,
  },
  yarn: {
    lockfile: "yarn.lock",
    run: "yarn dlx",
    addDev: (pkg) => `yarn add -D ${pkg}`,
  },
  npm: {
    lockfile: "package-lock.json",
    run: "npx",
    addDev: (pkg) => `npm install --save-dev ${pkg}`,
  },
  bun: {
    lockfiles: ["bun.lock", "bun.lockb"],
    run: "bunx",
    addDev: (pkg) => `bun add -d ${pkg}`,
  },
};

export const MANAGER_ORDER = ["pnpm", "yarn", "npm", "bun"];

function lockfileNames(name) {
  const spec = MANAGERS[name];
  if (spec.lockfiles) return spec.lockfiles;
  return [spec.lockfile];
}

export function detectPkgManager(root) {
  const lockfiles = MANAGER_ORDER.filter((name) =>
    lockfileNames(name).some((file) => fs.existsSync(path.join(root, file))),
  );
  if (lockfiles.length === 1) {
    const pkgManager = lockfiles[0];
    return {
      pkgManager,
      run: MANAGERS[pkgManager].run,
      ambiguous: false,
      lockfiles,
    };
  }
  return {
    pkgManager: null,
    run: null,
    ambiguous: true,
    lockfiles,
  };
}

export function parsePkgManagerRow(contextText) {
  const heading = String(contextText).search(/^## Build & Test\s*$/m);
  if (heading === -1) return null;
  const rest = String(contextText).slice(heading);
  const next = rest.search(/\n## /);
  const section = next === -1 ? rest : rest.slice(0, next);
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const match = line.match(/\|\s*`?pkg-manager`?\s*\|\s*([^|]+)\|/i);
    if (!match) continue;
    const raw = match[1].replace(/^`+|`+$/g, "").trim();
    if (!raw) continue;
    const parts = raw.split(";").map((part) => part.trim());
    const name = parts[0];
    if (!name || /^\[/.test(name) || /omit this row/i.test(raw)) continue;
    const known = MANAGERS[name];
    const run = parts[1] || known?.run || null;
    const addDev = parts.slice(2).join("; ").trim() || null;
    return { name, run, addDev };
  }
  return null;
}

export function resolvePkgManager(root, recorded) {
  const detected = detectPkgManager(root);
  if (recorded?.name) {
    const known = MANAGERS[recorded.name];
    return {
      pkgManager: recorded.name,
      run: recorded.run || known?.run || null,
      addDev: recorded.addDev || null,
      ambiguous: false,
      lockfiles: detected.lockfiles,
      provenance: "context.md",
    };
  }
  return {
    ...detected,
    addDev: null,
    provenance: detected.pkgManager ? "lockfile" : "none",
  };
}

export function addDevDepCommand(pkg, manager) {
  return MANAGERS[manager]?.addDev(pkg) ?? null;
}

export function formatAddDev(template, pkg) {
  return String(template).replaceAll("<pkg>", pkg).replaceAll("${pkg}", pkg);
}

export function installFallowCommand(version, manager, addDevTemplate) {
  const pkg = `fallow@${version}`;
  if (addDevTemplate) return formatAddDev(addDevTemplate, pkg);
  const exact = addDevDepCommand(pkg, manager);
  if (exact) return exact;
  return (
    `pnpm add -D ${pkg} (or npm install --save-dev ${pkg} / yarn add -D ${pkg} / bun add -d ${pkg}; ` +
    `ask which package manager this repo uses)`
  );
}

export function readRootPackageJson(root) {
  const filePath = path.join(root, "package.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/** @returns {{ field: string, range: string } | null} */
export function findFallowDeclaration(pkg) {
  if (!pkg || typeof pkg !== "object") return null;
  for (const field of ["devDependencies", "dependencies"]) {
    const range = pkg[field]?.fallow;
    if (range) return { field, range: String(range) };
  }
  return null;
}

export function installDepsCommand(manager) {
  const commands = {
    pnpm: "pnpm install",
    yarn: "yarn install",
    npm: "npm install",
    bun: "bun install",
  };
  return commands[manager] ?? null;
}
