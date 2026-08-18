#!/usr/bin/env node
/**
 * Validate Fallow binaries and JSON envelopes before audit findings are written.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { detectPkgManager, installFallowCommand } from "./pkg-manager.mjs";
import {
  atomicWrite,
  fail,
  isMain,
  parseArgs,
  printJson,
  utcDate,
  which,
} from "./runtime.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = path.join(HERE, "fallow-contract.json");
const COMPAT_FILE = ".agents/lodestar/fallow-compat.json";

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
 * Write an updated fallow-compat.json. Errors are swallowed — a write
 * failure must never block the audit.
 */
export function writeCompatRecord(root, record) {
  try {
    atomicWrite(
      path.join(root, COMPAT_FILE),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  } catch {
    // intentionally swallowed
  }
}

export function remediation(contract, details, extras = {}) {
  const installed = extras.installed || "unknown";
  const schema = extras.schema === undefined ? "n/a" : String(extras.schema);
  const kind = extras.kind || "n/a";

  if (extras.aboveBaseline) {
    // A newer Fallow schema dropped a field the audit reads — pin backwards.
    const goodVersion = contract.last_good_version || contract.tool_version;
    const install = installFallowCommand(`~${goodVersion}`, extras.manager);
    return [
      details,
      `Installed Fallow: ${installed}.`,
      `Supported version: ^${contract.tool_version} (schema ${contract.schema_version} or newer, fields must be intact).`,
      `Received schema/kind: ${schema}/${kind}.`,
      `Fallow ${installed} changed fields the audit reads. Pin to the last known-good version with: ${install}`,
    ].join(" ");
  }

  const range = fallowInstallSpec(contract.tool_version);
  const install = installFallowCommand(range, extras.manager);
  return [
    details,
    `Installed Fallow: ${installed}.`,
    `Supported version: ${range} (schema ${contract.schema_version} or newer).`,
    `Received schema/kind: ${schema}/${kind}.`,
    `Install a compatible version with: ${install}`,
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
    writeCompatRecord(root, {
      fallow_version: needsRecord.fallowVersion,
      baseline,
      verified,
      verified_at: utcDate(),
      note: "Written by lodestar-audit: Fallow schema versions above the contract baseline that passed field validation. Commit this file. Delete it to force re-verification.",
    });
    process.stderr.write(
      `[lodestar-audit] Fallow ${needsRecord.fallowVersion ?? "unknown"} emits ${needsRecord.kind} schema ${needsRecord.schema}` +
        ` (baseline ${needsRecord.baseline}). Field validation passed — schema accepted and recorded in` +
        ` ${COMPAT_FILE}. Commit that file.\n`,
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

export function resolveFallow(root, contract = loadContract()) {
  const manager = detectPkgManager(root).pkgManager;
  const bin = which("fallow", root);
  if (!bin) {
    throw new Error(
      remediation(contract, "fallow is required for this audit.", {
        installed: "none",
        manager,
      }),
    );
  }
  const version = detectVersion(bin);
  if (!compatibleFallowVersion(version, contract.tool_version)) {
    throw new Error(
      remediation(contract, `unsupported Fallow installed ${version}.`, {
        installed: version,
        manager,
      }),
    );
  }
  return { bin, version, contract, manager };
}

export function runFallow(bin, argv, { cwd } = {}) {
  const result = spawnSync(bin, argv, {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const stdout = result.stdout || "";
  // Exit 0 = clean, 1 = findings — both are successful runs.
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
    fail(
      remediation(contract, `${error.message}.`, {
        installed,
        schema,
        kind: receivedKind,
        manager: root ? detectPkgManager(root).pkgManager : null,
        aboveBaseline: error.schemaTooNew,
      }),
      2,
    );
  }
}

function substituteArgv(argv, flags) {
  return argv.map((token) => {
    if (token === "<file:export>") {
      if (!flags.trace) fail("run --id dead-code-trace requires --trace", 2);
      return flags.trace;
    }
    if (token === "<file>") {
      if (!flags.file && !flags["trace-file"]) {
        fail("run requires --file for this command", 2);
      }
      return flags.file || flags["trace-file"];
    }
    if (token === "<name>") {
      if (!flags.dependency && !flags["trace-dependency"]) {
        fail("run requires --dependency for this command", 2);
      }
      return flags.dependency || flags["trace-dependency"];
    }
    return token;
  });
}

function cmdRun(flags, contract) {
  const root = flags.root || process.cwd();
  const id = flags.id || flags.kind || "combined";
  const spec = commandSpec(contract, id);
  if (!spec) fail(`unknown command id/kind ${id}`, 2);
  let resolved;
  try {
    resolved = resolveFallow(root, contract);
  } catch (error) {
    fail(error.message, 2);
  }
  const argv = substituteArgv(spec.argv, flags);
  let stdout;
  try {
    stdout = runFallow(resolved.bin, argv, { cwd: root });
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
    validateEnvelope(envelope, spec, contract, { root });
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

const COMMANDS = {
  "resolve-bin": cmdResolveBin,
  validate: cmdValidate,
  run: cmdRun,
};

export function main(argv = process.argv.slice(2)) {
  const contract = loadContract();
  const { flags, positionals } = parseArgs(argv);
  const command = positionals[0];
  if (!command) {
    process.stderr.write(
      "Usage: fallow-contract resolve-bin|validate|run [options]\n",
    );
    process.exit(1);
  }
  const handler = COMMANDS[command];
  if (!handler) fail(`unknown command ${command}`, 1);
  handler(flags, contract);
}

if (isMain(import.meta.url)) {
  try {
    main();
  } catch (error) {
    fail(error.message || String(error), 2);
  }
}
