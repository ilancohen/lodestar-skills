// The only place lodestar-docs may reach into the base skill. The imports are
// dynamic so an absent lodestar-setup names itself here instead of surfacing as
// ERR_MODULE_NOT_FOUND for a path the user never chose.
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE_DIR = new URL("../../lodestar-setup/scripts/", import.meta.url);

function baseModule(name) {
  const url = new URL(name, BASE_DIR);
  if (fs.existsSync(fileURLToPath(url))) return import(url);
  process.stderr.write(
    `ERROR: lodestar-docs requires the lodestar-setup skill, which is not installed alongside it (looked for ${fileURLToPath(url)}).\n` +
      "The Lodestar suite installs as a unit. Reinstall every skill with:\n" +
      "  npx skills add ilancohen/lodestar-skills --skill '*' -y\n",
  );
  process.exit(1);
}

const runtime = await baseModule("runtime.mjs");
const discoverDocs = await baseModule("discover-docs.mjs");

export const isMain = runtime.isMain;
export const parseArgs = runtime.parseArgs;

export const DEFAULT_ARCHITECTURE_ROOT = discoverDocs.DEFAULT_ARCHITECTURE_ROOT;
export const DEFAULT_OUTPUT_ROOT = discoverDocs.DEFAULT_OUTPUT_ROOT;
export const architectureOutputRoot = discoverDocs.architectureOutputRoot;
export const observeDocsLayout = discoverDocs.observeDocsLayout;
export const parseDocsLayout = discoverDocs.parseDocsLayout;
