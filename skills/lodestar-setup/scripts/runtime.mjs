import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function fail(message, code = 1) {
  process.stderr.write(`ERROR: ${message}\n`);
  process.exit(code);
}

export function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = true;
    } else if (Object.prototype.hasOwnProperty.call(flags, key)) {
      flags[key] = [].concat(flags[key], next);
      i += 1;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return { flags, positionals };
}

export function localBin(
  name,
  root = process.cwd(),
  platform = process.platform,
) {
  const local = path.join(root, "node_modules", ".bin", name);
  if (platform === "win32") {
    for (const ext of [".cmd", ".exe", ".bat"]) {
      const candidate = `${local}${ext}`;
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  if (fs.existsSync(local)) return local;
  return null;
}

export function which(name, root = process.cwd()) {
  const pinned = localBin(name, root);
  if (pinned) return pinned;
  const dirs = (process.env.PATH || "").split(path.delimiter);
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";").concat("")
      : [""];
  for (const dir of dirs) {
    for (const ext of extensions) {
      const candidate = path.join(dir, name + ext);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // keep looking
      }
    }
  }
  return null;
}

export function tempDir(prefix = "ep-skills") {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function isMain(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(path.resolve(entry)).href === metaUrl;
}
