#!/usr/bin/env node
/**
 * Validate Fallow binaries and JSON envelopes before audit findings are written.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  atomicWrite,
  fail,
  findFallowDeclaration,
  installDepsCommand,
  installFallowCommand,
  isMain,
  localBin,
  parseArgs,
  parsePkgManagerRow,
  printJson,
  readRootPackageJson,
  resolvePkgManager,
  utcDate,
} from "./setup-modules.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = path.join(HERE, "fallow-contract.json");
const COMPAT_FILE = ".agents/lodestar/fallow-compat.json";

function resolvePkgManagerForRoot(root) {
  if (!root) {
    return {
      pkgManager: null,
      run: null,
      addDev: null,
      ambiguous: true,
      lockfiles: [],
      provenance: "none",
    };
  }
  const contextPath = path.join(root, ".agents", "lodestar", "context.md");
  let recorded = null;
  if (fs.existsSync(contextPath)) {
    recorded = parsePkgManagerRow(fs.readFileSync(contextPath, "utf8"));
  }
  return resolvePkgManager(root, recorded);
}

export function loadContract(filePath = CONTRACT_PATH) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function fallowInstallSpec(minVersion) {
  return `^${minVersion}`;
}

export function parseSemver(version) {
  const match = String(version)
    .trim()
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/** Same major as the floor, and not older than it (`^3.15.0`). */
export function compatibleFallowVersion(version, minVersion) {
  const got = parseSemver(version);
  const floor = parseSemver(minVersion);
  if (!got || !floor) return false;
  if (got.major !== floor.major) return false;
  if (got.minor !== floor.minor) return got.minor > floor.minor;
  return got.patch >= floor.patch;
}

/**
 * Read `.agents/lodestar/fallow-compat.json` from the target repo root.
 * Returns the parsed record, or null when the file is absent or unreadable.
 */
export function readCompatRecord(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, COMPAT_FILE), "utf8"));
  } catch {
    return null;
  }
}

/**
 * Write an updated fallow-compat.json. A write failure never blocks the
 * audit, but it is reported — otherwise the next run silently re-verifies
 * the same schema with no explanation.
 */
export function writeCompatRecord(root, record) {
  try {
    atomicWrite(
      path.join(root, COMPAT_FILE),
      `${JSON.stringify(record, null, 2)}\n`,
    );
    return true;
  } catch (error) {
    process.stderr.write(
      `[lodestar-audit] WARNING: could not write ${COMPAT_FILE}: ${error.message}.` +
        ` The audit continues; the next run will re-verify this Fallow schema.\n`,
    );
    return false;
  }
}

export function remediation(contract, details, extras = {}) {
  const installed = extras.installed || "unknown";
  const schema = extras.schema === undefined ? "n/a" : String(extras.schema);
  const kind = extras.kind || "n/a";
  const addDev = extras.addDev || null;

  if (extras.aboveBaseline) {
    // A newer Fallow schema dropped a field the audit reads — pin backwards.
    const goodVersion = contract.last_good_version || contract.tool_version;
    const install = installFallowCommand(
      `~${goodVersion}`,
      extras.manager,
      addDev,
    );
    return [
      details,
      `Installed Fallow: ${installed}.`,
      `Supported version: ^${contract.tool_version} (schema ${contract.schema_version} or newer, fields must be intact).`,
      `Received schema/kind: ${schema}/${kind}.`,
      `Fallow ${installed} changed fields the audit reads. Pin to the last known-good version with: ${install}`,
      "Or re-run lodestar-setup with lodestar-audit installed so setup prepares the declared local Fallow.",
    ].join(" ");
  }

  const range = fallowInstallSpec(contract.tool_version);
  const install = installFallowCommand(
    range,
    extras.manager,
    extras.addDev || null,
  );
  return [
    details,
    `Installed Fallow: ${installed}.`,
    `Supported version: ${range} (schema ${contract.schema_version} or newer).`,
    `Received schema/kind: ${schema}/${kind}.`,
    `Install a compatible version with: ${install}`,
    "Or re-run lodestar-setup with lodestar-audit installed so setup prepares the declared local Fallow.",
  ].join(" ");
}

export function hasPath(value, dotted) {
  const parts = dotted.split(".");
  let current = value;
  for (const part of parts) {
    const array = part.endsWith("[]");
    const key = array ? part.slice(0, -2) : part;
    if (current == null || typeof current !== "object" || !(key in current)) {
      return false;
    }
    current = current[key];
    if (array && !Array.isArray(current)) return false;
  }
  return true;
}

export function parseEnvelope(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Fallow output is not JSON: ${error.message}`);
  }
  if (Array.isArray(parsed)) {
    throw new Error("Fallow output is a JSON array, not a typed envelope");
  }
  if (parsed && parsed.error === true) {
    throw new Error(parsed.message || "Fallow returned an error envelope");
  }
  return parsed;
}

function commandSpec(contract, kindOrId) {
  return (contract.commands || []).find(
    (item) => item.kind === kindOrId || item.id === kindOrId,
  );
}

/**
 * Validate a Fallow JSON envelope against a command spec and the contract.
 *
 * Schema check is a floor, not equality: a schema above the baseline passes
 * when every field the audit reads is still present. On the first encounter,
 * the accepted version/schema pair is recorded in the target repo's
 * `.agents/lodestar/fallow-compat.json` so subsequent runs treat it as
 * known-good. Pass `options.root` to enable recording; omit it for pure
 * validation without side effects.
 */
export function validateEnvelope(envelope, spec, contract, options = {}) {
  const { root } = options;
  let needsRecord = null;

  if (spec.require_schema) {
    const baseline =
      spec.schema_version !== undefined
        ? spec.schema_version
        : contract.schema_version;
    const got = envelope.schema_version;

    if (typeof got !== "number" || got < baseline) {
      throw new Error(
        `unsupported schema ${got}; expected ${baseline} or newer`,
      );
    }
    if (got > baseline) {
      const kind = spec.kind || envelope.kind;
      const fallowVersion = envelope.version;
      const compat = root ? readCompatRecord(root) : null;
      const isRecorded =
        compat &&
        compat.fallow_version === fallowVersion &&
        typeof compat.verified?.[kind] === "number" &&
        compat.verified[kind] >= got;
      if (!isRecorded) {
        needsRecord = { kind, schema: got, baseline, fallowVersion };
      }
    }
  }

  if (spec.kind && envelope.kind !== spec.kind) {
    throw new Error(`expected kind=${spec.kind}, got ${envelope.kind}`);
  }
  if (
    envelope.version &&
    !compatibleFallowVersion(envelope.version, contract.tool_version)
  ) {
    throw new Error(
      `unsupported Fallow ${envelope.version}; supported ${fallowInstallSpec(contract.tool_version)}`,
    );
  }
  for (const field of spec.required_fields || []) {
    if (!hasPath(envelope, field)) {
      if (needsRecord) {
        const err = new Error(
          `Fallow ${needsRecord.fallowVersion ?? "unknown"} (schema ${needsRecord.schema}) dropped required field ${field}`,
        );
        err.schemaTooNew = true;
        throw err;
      }
      throw new Error(`missing required field ${field}`);
    }
  }
  if (spec.kind === "combined") {
    const total = envelope.check?.entry_points?.total;
    if (total === 0) {
      throw new Error(
        "check.entry_points.total is 0; Fallow found no entry points",
      );
    }
  }
  if (spec.instance_fields?.length) {
    const groups = envelope.clone_groups || envelope.dupes?.clone_groups || [];
    for (const group of groups) {
      for (const instance of group.instances || []) {
        for (const field of spec.instance_fields) {
          if (!(field in instance)) {
            throw new Error(`clone instance missing field ${field}`);
          }
        }
      }
    }
  }
  if (spec.zone_fields?.length && envelope.boundaries?.zones) {
    for (const zone of envelope.boundaries.zones) {
      for (const field of spec.zone_fields) {
        if (!(field in zone)) {
          throw new Error(`boundary zone missing field ${field}`);
        }
      }
    }
  }
  if (spec.entry_point_fields?.length && envelope.entry_points) {
    for (const entry of envelope.entry_points) {
      for (const field of spec.entry_point_fields) {
        if (!(field in entry)) {
          throw new Error(`entry_points entry missing field ${field}`);
        }
      }
    }
  }
  if (spec.id === "list-entry-points" || spec.kind === "list-entry-points") {
    const total = envelope.entry_point_count;
    if (typeof total !== "number" || total <= 0) {
      throw new Error(
        "entry_point_count is 0; Fallow found no entry points — add an `entry` array to .fallowrc.json or fix package.json / framework detection",
      );
    }
    const minimum = options.minimum;
    if (typeof minimum === "number" && minimum > 0 && total < minimum) {
      throw new Error(
        `entry_point_count is ${total}; expected at least ${minimum} for this layout — add missing paths to the \`entry\` array in .fallowrc.json`,
      );
    }
  }
  if (spec.file_score_fields?.length && envelope.health?.file_scores) {
    for (const score of envelope.health.file_scores) {
      for (const field of spec.file_score_fields) {
        if (!(field in score)) {
          throw new Error(`file_scores entry missing field ${field}`);
        }
      }
    }
  }

  // All checks passed — record and announce the accepted schema if new.
  if (needsRecord && root) {
    const existing = readCompatRecord(root) ?? {};
    const baseline = { ...(existing.baseline ?? {}) };
    const verified = { ...(existing.verified ?? {}) };
    baseline[needsRecord.kind] = needsRecord.baseline;
    verified[needsRecord.kind] = needsRecord.schema;
    const recorded = writeCompatRecord(root, {
      fallow_version: needsRecord.fallowVersion,
      baseline,
      verified,
      verified_at: utcDate(),
      note: "Written by lodestar-audit: Fallow schema versions above the contract baseline that passed field validation. Commit this file. Delete it to force re-verification.",
    });
    process.stderr.write(
      `[lodestar-audit] Fallow ${needsRecord.fallowVersion ?? "unknown"} emits ${needsRecord.kind} schema ${needsRecord.schema}` +
        ` (baseline ${needsRecord.baseline}). Field validation passed — schema accepted` +
        (recorded
          ? ` and recorded in ${COMPAT_FILE}. Commit that file.\n`
          : ` but not recorded.\n`),
    );
  }

  return envelope;
}

export function detectVersion(bin) {
  const result = spawnSync(bin, ["--version"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`could not read Fallow version from ${bin}`);
  }
  const text = `${result.stdout || ""} ${result.stderr || ""}`.trim();
  const match = text.match(/(\d+\.\d+\.\d+)/);
  if (!match) throw new Error(`unrecognized Fallow version output: ${text}`);
  return match[1];
}

export function fallowProjectStatus(root, contract = loadContract()) {
  const resolved = resolvePkgManagerForRoot(root);
  const declared = findFallowDeclaration(readRootPackageJson(root));
  const bin = localBin("fallow", root);
  let version = null;
  if (bin) {
    try {
      version = detectVersion(bin);
    } catch {
      version = null;
    }
  }
  const compatible = version
    ? compatibleFallowVersion(version, contract.tool_version)
    : false;
  return {
    declared: Boolean(declared),
    declaredField: declared?.field ?? null,
    declaredRange: declared?.range ?? null,
    bin,
    version,
    compatible,
    needsDeclare: !declared,
    needsInstall: Boolean(declared && !bin),
    needsUpgrade: Boolean(bin && version && !compatible),
    manager: resolved.pkgManager,
    addDev: resolved.addDev,
  };
}

export function resolveFallow(root, contract = loadContract()) {
  const status = fallowProjectStatus(root, contract);
  const manager = status.manager;
  const range = fallowInstallSpec(contract.tool_version);
  const addDev = installFallowCommand(range, manager, status.addDev);

  if (!status.declared && !status.bin) {
    throw new Error(
      remediation(
        contract,
        "fallow is not declared in package.json and was not found in node_modules/.bin.",
        {
          installed: "none",
          manager,
          addDev: status.addDev,
        },
      ),
    );
  }
  if (!status.declared) {
    throw new Error(
      [
        "fallow is present in node_modules/.bin but not declared in package.json devDependencies or dependencies.",
        `Declare and pin it with: ${addDev}`,
      ].join(" "),
    );
  }
  if (!status.bin) {
    const install =
      installDepsCommand(manager) ??
      "install dependencies (pnpm install / npm install / yarn install / bun install)";
    throw new Error(
      [
        `fallow is declared in package.json (${status.declaredField}: ${status.declaredRange}) but node_modules/.bin/fallow is missing.`,
        `Install dependencies with: ${install}`,
        `If it is still missing, add or upgrade with: ${addDev}`,
      ].join(" "),
    );
  }
  if (!status.compatible) {
    throw new Error(
      remediation(contract, `unsupported Fallow installed ${status.version}.`, {
        installed: status.version,
        manager,
        addDev: status.addDev,
      }),
    );
  }
  return {
    bin: status.bin,
    version: status.version,
    contract,
    manager,
    declaredField: status.declaredField,
    declaredRange: status.declaredRange,
  };
}

/** Default cap for Fallow / long probe child processes (10 minutes). */
export const LIVENESS_TIMEOUT_MS = 10 * 60 * 1000;
/** Sparse heartbeat while a child is silent (15 seconds). */
export const LIVENESS_HEARTBEAT_MS = 15_000;

/**
 * Run a child with streamed stderr, sparse heartbeats, and a hard timeout.
 * Collects stdout for the caller; does not write persistent run logs.
 * Returns `{ stdout, stderr, status, durationMs }`.
 */
export function runWithLiveness(bin, argv, options = {}) {
  const {
    cwd,
    timeoutMs = LIVENESS_TIMEOUT_MS,
    heartbeatMs = LIVENESS_HEARTBEAT_MS,
    label = path.basename(bin),
    env = process.env,
    stream = true,
  } = options;

  return new Promise((resolve, reject) => {
    const started = Date.now();
    let stdout = "";
    let stderr = "";
    let settled = false;
    let lastOutputAt = started;
    let timedOut = false;

    const child = spawn(bin, argv, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearInterval(heartbeat);
      clearTimeout(timer);
      fn(value);
    };

    const heartbeat = setInterval(() => {
      const silentFor = Date.now() - lastOutputAt;
      if (silentFor < heartbeatMs) return;
      if (stream) {
        process.stderr.write(
          `[${label}] still running (${Math.round((Date.now() - started) / 1000)}s)…\n`,
        );
      }
      lastOutputAt = Date.now();
    }, Math.min(heartbeatMs, 5_000));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!settled) child.kill("SIGKILL");
      }, 2_000).unref?.();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      lastOutputAt = Date.now();
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      lastOutputAt = Date.now();
      if (stream) process.stderr.write(text);
    });

    child.on("error", (error) => {
      error.durationMs = Date.now() - started;
      finish(reject, error);
    });

    child.on("close", (status) => {
      const durationMs = Date.now() - started;
      if (stream) {
        process.stderr.write(
          `[${label}] finished in ${(durationMs / 1000).toFixed(1)}s (exit ${status ?? "?"})\n`,
        );
      }
      if (timedOut) {
        const error = new Error(
          `${label} timed out after ${Math.round(timeoutMs / 1000)}s`,
        );
        error.exitCode = null;
        error.stdout = stdout;
        error.stderr = stderr;
        error.durationMs = durationMs;
        finish(reject, error);
        return;
      }
      finish(resolve, { stdout, stderr, status, durationMs });
    });
  });
}

/**
 * Run Fallow (sync). Exit 0 = clean, 1 = findings — both succeed.
 * Uses a hard timeout. For streamed stderr + heartbeat during long runs,
 * use `runFallowAsync` (CLI `run` command does).
 */
export function runFallow(bin, argv, options = {}) {
  const { cwd, timeoutMs = LIVENESS_TIMEOUT_MS } = options;
  const started = Date.now();
  const result = spawnSync(bin, argv, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: timeoutMs,
  });
  const durationMs = Date.now() - started;
  const stdout = result.stdout || "";
  if (result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM") {
    const error = new Error(
      `fallow timed out after ${Math.round(timeoutMs / 1000)}s`,
    );
    error.exitCode = null;
    error.stdout = stdout;
    error.durationMs = durationMs;
    throw error;
  }
  if (result.status !== 0 && result.status !== 1) {
    let message = result.stderr?.trim() || `fallow exited ${result.status}`;
    try {
      const envelope = JSON.parse(stdout);
      if (envelope?.error) message = envelope.message || message;
    } catch {
      // keep stderr message
    }
    const error = new Error(message);
    error.exitCode = result.status;
    error.stdout = stdout;
    error.durationMs = durationMs;
    throw error;
  }
  return stdout;
}

/** Async Fallow run with streamed stderr, sparse heartbeat, and duration. */
export async function runFallowAsync(bin, argv, options = {}) {
  const result = await runWithLiveness(bin, argv, {
    cwd: options.cwd,
    timeoutMs: options.timeoutMs ?? LIVENESS_TIMEOUT_MS,
    heartbeatMs: options.heartbeatMs ?? LIVENESS_HEARTBEAT_MS,
    label: "fallow",
    stream: options.stream !== false,
  });
  const stdout = result.stdout || "";
  if (result.status !== 0 && result.status !== 1) {
    let message = result.stderr?.trim() || `fallow exited ${result.status}`;
    try {
      const envelope = JSON.parse(stdout);
      if (envelope?.error) message = envelope.message || message;
    } catch {
      // keep stderr message
    }
    const error = new Error(message);
    error.exitCode = result.status;
    error.stdout = stdout;
    error.durationMs = result.durationMs;
    throw error;
  }
  return stdout;
}

function cmdResolveBin(flags, contract) {
  const root = flags.root || process.cwd();
  try {
    printJson(resolveFallow(root, contract));
  } catch (error) {
    fail(error.message, 2);
  }
}

function cmdValidate(flags, contract) {
  const filePath = flags.file || flags.path;
  const kind = flags.kind || flags.id;
  if (!filePath) fail("validate requires --file", 2);
  if (!kind) fail("validate requires --kind", 2);
  if (!fs.existsSync(filePath)) fail(`${filePath} does not exist`, 2);
  const spec = commandSpec(contract, kind) || {
    kind,
    required_fields: [],
  };
  const root = flags.root || undefined;
  try {
    const envelope = parseEnvelope(fs.readFileSync(filePath, "utf8"));
    validateEnvelope(envelope, spec, contract, { root });
    printJson({
      ok: true,
      kind: envelope.kind,
      version: envelope.version,
      schema_version: envelope.schema_version,
    });
  } catch (error) {
    let schema = "n/a";
    let receivedKind = "n/a";
    let installed = "unknown";
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      schema = raw.schema_version ?? schema;
      receivedKind = raw.kind ?? receivedKind;
      installed = raw.version ?? installed;
    } catch {
      // ignore
    }
    const resolved = root ? resolvePkgManagerForRoot(root) : null;
    fail(
      remediation(contract, `${error.message}.`, {
        installed,
        schema,
        kind: receivedKind,
        manager: resolved?.pkgManager ?? null,
        addDev: resolved?.addDev ?? null,
        aboveBaseline: error.schemaTooNew,
      }),
      2,
    );
  }
}

/**
 * A substituted placeholder must reach Fallow as a positional. `parseArgs`
 * yields boolean `true` for a valueless flag, and a `-`-leading value would
 * be absorbed by Fallow as a flag of its own.
 */
function positionalValue(value, flagName) {
  if (typeof value !== "string" || value === "") {
    fail(`run --${flagName} requires a single non-empty value`, 2);
  }
  if (value.startsWith("-")) {
    fail(
      `run --${flagName} value must not start with "-" (got ${value}); Fallow would read it as a flag`,
      2,
    );
  }
  return value;
}

function substituteArgv(argv, flags) {
  return argv.map((token) => {
    if (token === "<file:export>") {
      if (!flags.trace) fail("run --id dead-code-trace requires --trace", 2);
      return positionalValue(flags.trace, "trace");
    }
    if (token === "<file>") {
      if (!flags.file && !flags["trace-file"]) {
        fail("run requires --file for this command", 2);
      }
      return flags.file
        ? positionalValue(flags.file, "file")
        : positionalValue(flags["trace-file"], "trace-file");
    }
    if (token === "<name>") {
      if (!flags.dependency && !flags["trace-dependency"]) {
        fail("run requires --dependency for this command", 2);
      }
      return flags.dependency
        ? positionalValue(flags.dependency, "dependency")
        : positionalValue(flags["trace-dependency"], "trace-dependency");
    }
    return token;
  });
}

async function cmdRun(flags, contract) {
  const root = flags.root || process.cwd();
  const id = flags.id || flags.kind || "combined";
  const spec = commandSpec(contract, id);
  if (!spec) fail(`unknown command id/kind ${id}`, 2);
  const argv = substituteArgv(spec.argv, flags);
  let resolved;
  try {
    resolved = resolveFallow(root, contract);
  } catch (error) {
    fail(error.message, 2);
  }
  let stdout;
  try {
    stdout = await runFallowAsync(resolved.bin, argv, { cwd: root });
  } catch (error) {
    fail(
      remediation(contract, error.message, {
        installed: resolved.version,
        manager: resolved.manager,
      }),
      2,
    );
  }
  let envelope;
  try {
    envelope = parseEnvelope(stdout);
  } catch (error) {
    fail(
      remediation(contract, error.message, {
        installed: resolved.version,
        manager: resolved.manager,
      }),
      2,
    );
  }
  try {
    validateEnvelope(envelope, spec, contract, {
      root,
      minimum: flags.minimum ? Number(flags.minimum) : undefined,
    });
    if (flags.out) {
      const outPath = path.isAbsolute(flags.out)
        ? flags.out
        : path.resolve(root, flags.out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, `${JSON.stringify(envelope)}\n`, "utf8");
      printJson({
        ok: true,
        bin: resolved.bin,
        version: resolved.version,
        kind: envelope.kind,
        out: outPath,
      });
      return;
    }
    // No --out: emit the validated envelope so callers can inspect fields.
    printJson(envelope);
  } catch (error) {
    fail(
      remediation(contract, error.message, {
        installed: resolved.version || envelope.version || "unknown",
        schema: envelope.schema_version,
        kind: envelope.kind,
        manager: resolved.manager,
        aboveBaseline: error.schemaTooNew,
      }),
      2,
    );
  }
}

/**
 * Soft pre-consent status. Prints fallowProjectStatus JSON; never throws for
 * missing/out-of-range fallow (unlike resolve-bin).
 *
 * Usage: node fallow-contract.mjs status --root DIR
 */
function cmdStatus(flags, contract) {
  const root = flags.root || process.cwd();
  printJson(fallowProjectStatus(root, contract));
}

const COMMANDS = {
  status: cmdStatus,
  "resolve-bin": cmdResolveBin,
  validate: cmdValidate,
  run: cmdRun,
  "run-liveness": cmdRunLiveness,
};

/**
 * Run an arbitrary long child (e.g. linter probe) with the same liveness
 * guarantees as Fallow: streamed stderr, sparse heartbeat, hard timeout,
 * duration on completion. Writes stdout to --out. Exit status mirrors the
 * child (timeout → exit 2).
 *
 * Usage:
 *   node fallow-contract.mjs run-liveness --out PATH [--root DIR] [--label NAME] -- <bin> [args…]
 */
async function cmdRunLiveness(flags, _contract, restArgv = []) {
  const root = flags.root || process.cwd();
  const outRaw = flags.out;
  if (!outRaw || outRaw === true) {
    fail("run-liveness requires --out PATH", 2);
  }
  if (!restArgv.length) {
    fail("run-liveness requires a command after -- (bin and args)", 2);
  }
  const [bin, ...argv] = restArgv;
  const outPath = path.isAbsolute(outRaw) ? outRaw : path.resolve(root, outRaw);
  try {
    const result = await runWithLiveness(bin, argv, {
      cwd: root,
      label: typeof flags.label === "string" ? flags.label : "probe",
      timeoutMs: flags.timeout
        ? Number(flags.timeout)
        : LIVENESS_TIMEOUT_MS,
      heartbeatMs: flags.heartbeat
        ? Number(flags.heartbeat)
        : LIVENESS_HEARTBEAT_MS,
    });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, result.stdout ?? "", "utf8");
    process.exit(result.status ?? 0);
  } catch (error) {
    if (error.stdout != null) {
      try {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, error.stdout, "utf8");
      } catch {
        // best-effort
      }
    }
    fail(error.message || String(error), 2);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const contract = loadContract();
  const dd = argv.indexOf("--");
  const before = dd === -1 ? argv : argv.slice(0, dd);
  const after = dd === -1 ? [] : argv.slice(dd + 1);
  const { flags, positionals } = parseArgs(before);
  const command = positionals[0];
  if (!command) {
    process.stderr.write(
      "Usage: fallow-contract status|resolve-bin|validate|run|run-liveness [options]\n",
    );
    process.exit(1);
  }
  const handler = COMMANDS[command];
  if (!handler) fail(`unknown command ${command}`, 1);
  if (command === "run-liveness") {
    await handler(flags, contract, after);
    return;
  }
  await handler(flags, contract);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    fail(error.message || String(error), 2);
  });
}
