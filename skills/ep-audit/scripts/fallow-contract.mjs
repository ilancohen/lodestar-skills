#!/usr/bin/env node
/**
 * Validate Fallow binaries and JSON envelopes before audit findings are written.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fail, isMain, parseArgs, printJson, which } from "./runtime.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = path.join(HERE, "fallow-contract.json");

export function loadContract(filePath = CONTRACT_PATH) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function compareVersions(a, b) {
  const pa = String(a)
    .split(".")
    .map((part) => Number(part) || 0);
  const pb = String(b)
    .split(".")
    .map((part) => Number(part) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export function inRange(version, min, max) {
  return (
    compareVersions(version, min) >= 0 && compareVersions(version, max) <= 0
  );
}

export function remediation(contract, details, extras = {}) {
  const installed = extras.installed || "unknown";
  const schema = extras.schema === undefined ? "n/a" : String(extras.schema);
  const kind = extras.kind || "n/a";
  const install =
    contract.install_current ||
    `npm install --save-dev fallow@${contract.tool_version_current}`;
  return [
    details,
    `Installed Fallow: ${installed}.`,
    `Supported range: ${contract.tool_version_min}–${contract.tool_version_current} (schema ${contract.schema_version}).`,
    `Received schema/kind: ${schema}/${kind}.`,
    `Install the supported current version with: ${install}`,
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

export function validateEnvelope(envelope, spec, contract) {
  if (spec.require_schema) {
    const expectedSchema =
      spec.schema_version !== undefined
        ? spec.schema_version
        : contract.schema_version;
    if (envelope.schema_version !== expectedSchema) {
      throw new Error(
        `unsupported schema ${envelope.schema_version}; expected ${expectedSchema}`,
      );
    }
  }
  if (spec.kind && envelope.kind !== spec.kind) {
    throw new Error(`expected kind=${spec.kind}, got ${envelope.kind}`);
  }
  if (
    envelope.version &&
    contract.status === "tested" &&
    !inRange(
      envelope.version,
      contract.tool_version_min,
      contract.tool_version_current,
    )
  ) {
    throw new Error(
      `unsupported Fallow ${envelope.version}; supported ${contract.tool_version_min}–${contract.tool_version_current}`,
    );
  }
  for (const field of spec.required_fields || []) {
    if (!hasPath(envelope, field)) {
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
  const bin = which("fallow", root);
  if (!bin) {
    throw new Error(
      remediation(contract, "fallow is required for this audit.", {
        installed: "none",
      }),
    );
  }
  const version = detectVersion(bin);
  if (
    contract.status === "tested" &&
    !inRange(version, contract.tool_version_min, contract.tool_version_current)
  ) {
    throw new Error(
      remediation(contract, `unsupported Fallow installed ${version}.`, {
        installed: version,
      }),
    );
  }
  return { bin, version, contract };
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
  try {
    const envelope = parseEnvelope(fs.readFileSync(filePath, "utf8"));
    validateEnvelope(envelope, spec, contract);
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
      }),
      2,
    );
  }
  try {
    validateEnvelope(envelope, spec, contract);
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
