#!/usr/bin/env node
import { fail, isMain, parseArgs, which } from "./runtime.mjs";

export function resolveBin(name, root = process.cwd()) {
  return which(name, root);
}

function main(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const name = positionals[0] || "fallow";
  const root = flags.root || process.cwd();
  const bin = resolveBin(name, root);
  if (!bin) {
    fail(
      `${name} is required for lodestar-audit. Install the latest version as a devDependency at the workspace root.`,
      2,
    );
  }
  if (flags["print-path"]) process.stdout.write(`${bin}\n`);
  else process.stdout.write(`${JSON.stringify({ bin, name }, null, 2)}\n`);
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    fail(error.message || String(error), 2);
  }
}
