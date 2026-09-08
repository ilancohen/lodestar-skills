// The only place lodestar-plan may reach into the base skill. The imports are
// dynamic so an absent lodestar-setup names itself here instead of surfacing as
// ERR_MODULE_NOT_FOUND for a path the user never chose.
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE_DIR = new URL("../../lodestar-setup/scripts/", import.meta.url);

function baseModule(name) {
  const url = new URL(name, BASE_DIR);
  if (fs.existsSync(fileURLToPath(url))) return import(url);
  process.stderr.write(
    `ERROR: lodestar-plan requires the lodestar-setup skill, which is not installed alongside it (looked for ${fileURLToPath(url)}).\n` +
      "Reinstall lodestar-setup (the base skill) alongside this skill with:\n" +
      "  npx skills add ilancohen/lodestar-skills --skill '*' -y\n",
  );
  process.exit(1);
}

const runtime = await baseModule("runtime.mjs");
const discoverPlans = await baseModule("discover-plans.mjs");

export const atomicWrite = runtime.atomicWrite;
export const fail = runtime.fail;
export const isMain = runtime.isMain;
export const parseArgs = runtime.parseArgs;
export const printJson = runtime.printJson;

export const DEFAULT_PLANS_ROOT = discoverPlans.DEFAULT_PLANS_ROOT;
export const abandonedDir = discoverPlans.abandonedDir;
export const bootstrapPlansRoot = discoverPlans.bootstrapPlansRoot;
export const discoverPlansState = discoverPlans.discoverPlans;
export const doneDir = discoverPlans.doneDir;
export const ensurePlansRoot = discoverPlans.ensurePlansRoot;
export const listAbandonedPlans = discoverPlans.listAbandonedPlans;
export const listDonePlans = discoverPlans.listDonePlans;
export const listPendingPlans = discoverPlans.listPendingPlans;
export const resolvePlansRoot = discoverPlans.resolvePlansRoot;
export const run = discoverPlans.run;

if (isMain(import.meta.url)) process.exit(run(process.argv.slice(2)));
