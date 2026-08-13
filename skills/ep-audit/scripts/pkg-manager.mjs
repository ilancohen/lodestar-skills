/**
 * Detect npm / yarn / pnpm from lockfiles. Never guess.
 * Multiple or zero lockfiles → ask the user.
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
};

export const MANAGER_ORDER = ["pnpm", "yarn", "npm"];

export function detectPkgManager(root) {
  const lockfiles = MANAGER_ORDER.filter((name) =>
    fs.existsSync(path.join(root, MANAGERS[name].lockfile)),
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

export function addDevDepCommand(pkg, manager) {
  return MANAGERS[manager]?.addDev(pkg) ?? null;
}

export function installFallowCommand(version, manager) {
  const pkg = `fallow@${version}`;
  const exact = addDevDepCommand(pkg, manager);
  if (exact) return exact;
  return (
    `pnpm add -D ${pkg} (or npm install --save-dev ${pkg} / yarn add -D ${pkg}; ` +
    `ask which package manager this repo uses)`
  );
}
