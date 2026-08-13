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

export function which(name, root = process.cwd()) {
  const local = path.join(root, "node_modules", ".bin", name);
  const localCmd = `${local}.cmd`;
  if (fs.existsSync(local)) return local;
  if (process.platform === "win32" && fs.existsSync(localCmd)) return localCmd;
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

export function atomicWrite(filePath, contents) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const temp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(temp, contents, { encoding: "utf8" });
  try {
    fs.renameSync(temp, filePath);
  } catch (error) {
    if (process.platform === "win32" && fs.existsSync(filePath)) {
      fs.rmSync(filePath);
      fs.renameSync(temp, filePath);
    } else {
      fs.rmSync(temp, { force: true });
      throw error;
    }
  }
}

export function tempDir(prefix = "ep-skills") {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}

export function utcDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function isMain(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(path.resolve(entry)).href === metaUrl;
}
