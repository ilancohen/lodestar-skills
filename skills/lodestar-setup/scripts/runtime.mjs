// Shared across the suite. Other skills must reach this through their own
// scripts/setup-modules.mjs, never by importing this path directly.
import { spawnSync } from "node:child_process";
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

export function tempDir(prefix = "lodestar-skills") {
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

/** Normalize to repo-relative `/` paths (no trailing slash except root). */
export function posixPath(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
}

export function capText(text, maxBytes) {
  const raw = String(text ?? "");
  const buf = Buffer.from(raw, "utf8");
  if (buf.length <= maxBytes) return raw;
  const sliced = buf.subarray(0, Math.max(0, maxBytes - 1)).toString("utf8");
  return `${sliced}…`;
}

/**
 * Spawn with argv (no shell). Stream stdout to an OS temp file (not held in
 * memory). Never returns raw stdout to the caller — only the path + metadata.
 */
export function spawnCaptureToTemp(bin, argv, options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    prefix = "lodestar-capture",
    timeoutMs = 120_000,
    stderrCap = 1024,
  } = options;
  const dir = tempDir(prefix);
  const outPath = path.join(dir, "stdout.txt");
  const started = Date.now();
  let status = null;
  let signal = null;
  let stderr = "";
  let error = null;
  let outFd = null;
  try {
    outFd = fs.openSync(outPath, "w");
    const result = spawnSync(bin, argv, {
      cwd,
      env,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      stdio: ["ignore", outFd, "pipe"],
    });
    status = result.status;
    signal = result.signal ?? null;
    stderr = result.stderr ?? "";
    if (result.error) error = result.error.message;
  } catch (err) {
    error = err.message || String(err);
    try {
      if (!fs.existsSync(outPath)) fs.writeFileSync(outPath, "", "utf8");
    } catch {
      // best-effort
    }
  } finally {
    if (outFd != null) {
      try {
        fs.closeSync(outFd);
      } catch {
        // best-effort
      }
    }
  }
  return {
    outPath,
    captureDir: dir,
    status,
    signal,
    durationMs: Date.now() - started,
    stderr: capText(stderr, stderrCap),
    error,
  };
}

export function cleanupCapture(capture) {
  if (!capture?.captureDir) return;
  try {
    fs.rmSync(capture.captureDir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

export function sortedJson(value) {
  return `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;
}

export function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeysDeep(value[key]);
    }
    return out;
  }
  return value;
}
