// The only place lodestar-audit may reach into the base skill. The imports are
// dynamic so an absent lodestar-setup names itself here instead of surfacing as
// ERR_MODULE_NOT_FOUND for a path the user never chose.
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE_DIR = new URL("../../lodestar-setup/scripts/", import.meta.url);

function baseModule(name) {
  const url = new URL(name, BASE_DIR);
  if (fs.existsSync(fileURLToPath(url))) return import(url);
  process.stderr.write(
    `ERROR: lodestar-audit requires the lodestar-setup skill, which is not installed alongside it (looked for ${fileURLToPath(url)}).\n` +
      "Reinstall lodestar-setup (the base skill) alongside this skill with:\n" +
      "  npx skills add ilancohen/lodestar-skills --skill '*' -y\n",
  );
  process.exit(1);
}

const runtime = await baseModule("runtime.mjs");
const detectLinterModule = await baseModule("detect-linter.mjs");
const discoverDocs = await baseModule("discover-docs.mjs");
const pkgManager = await baseModule("pkg-manager.mjs");
const workspaceLayout = await baseModule("workspace-layout.mjs");

export const atomicWrite = runtime.atomicWrite;
export const fail = runtime.fail;
export const isMain = runtime.isMain;
export const localBin = runtime.localBin;
export const parseArgs = runtime.parseArgs;
export const printJson = runtime.printJson;
export const tempDir = runtime.tempDir;
export const utcDate = runtime.utcDate;

export const detectLinter = detectLinterModule.detectLinter;
export const inferProbeFromLintScript =
  detectLinterModule.inferProbeFromLintScript;

export const checkDocsLayoutDrift = discoverDocs.checkDocsLayoutDrift;

export const detectPkgManager = pkgManager.detectPkgManager;
export const findFallowDeclaration = pkgManager.findFallowDeclaration;
export const installDepsCommand = pkgManager.installDepsCommand;
export const installFallowCommand = pkgManager.installFallowCommand;
export const parsePkgManagerRow = pkgManager.parsePkgManagerRow;
export const readRootPackageJson = pkgManager.readRootPackageJson;
export const resolvePkgManager = pkgManager.resolvePkgManager;

export const listDeclaredMembers = workspaceLayout.listDeclaredMembers;
