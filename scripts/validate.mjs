#!/usr/bin/env node
/** Portable top-level package validation. */

import { isMain } from "./lib.mjs";
import { checkPackage } from "./check_package.mjs";

function main() {
  const { errors, warnings, version, skillCount } = checkPackage();
  for (const warning of warnings) process.stdout.write(`WARNING: ${warning}\n`);
  for (const error of errors) process.stderr.write(`ERROR: ${error}\n`);
  if (errors.length) process.exit(1);
  process.stdout.write(`Package checks passed for ${skillCount} skills at version ${version}.\n`);
}

if (isMain(import.meta.url)) main();
