import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PLANS_ROOT,
  discoverPlans,
  ensurePlansRoot,
  listPendingPlans,
  resolvePlansRoot,
} from "../skills/lodestar-setup/scripts/discover-plans.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(
  ROOT,
  "skills/lodestar-setup/scripts/discover-plans.mjs",
);
const GATEWAY = path.join(
  ROOT,
  "skills/lodestar-plan/scripts/setup-modules.mjs",
);
const DOCS_HYGIENE = path.join(ROOT, "tests/fixtures/repos/docs-hygiene");
const VALID = path.join(ROOT, "tests/fixtures/repos/valid");
const LIGHT = path.join(ROOT, "tests/fixtures/plans/light-repo");
const ORPHAN = path.join(ROOT, "tests/fixtures/plans/orphan-repo");

function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-plans-"));
}

function writeContext(root, extras = "") {
  const dir = path.join(root, ".agents", "lodestar");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "context.md"),
    `# Fixture\n\n## Package Layout\n\n${extras}`,
    "utf8",
  );
}

test("resolvePlansRoot defaults when context.md is missing", () => {
  const tmp = tmpRoot();
  try {
    assert.equal(resolvePlansRoot(tmp), DEFAULT_PLANS_ROOT);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("resolvePlansRoot defaults when Docs Layout is absent", () => {
  assert.equal(resolvePlansRoot(VALID), DEFAULT_PLANS_ROOT);
});

test("resolvePlansRoot reads the inflight plans row", () => {
  assert.equal(resolvePlansRoot(DOCS_HYGIENE), "docs/plans");
});

test("resolvePlansRoot honors a custom inflight path", () => {
  const tmp = tmpRoot();
  try {
    writeContext(
      tmp,
      `## Docs Layout

| Path | Role | Responsibility |
| ---- | ---- | -------------- |
| notes/work | inflight | In-flight plans. |
`,
    );
    assert.equal(resolvePlansRoot(tmp), "notes/work");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("ensurePlansRoot creates only the plans root", () => {
  const tmp = tmpRoot();
  try {
    const result = ensurePlansRoot(tmp);
    assert.equal(result.plansRoot, DEFAULT_PLANS_ROOT);
    assert.equal(result.createdRoot, true);
    assert.equal(fs.existsSync(path.join(tmp, result.plansRoot)), true);
    assert.equal(fs.existsSync(path.join(tmp, result.doneDir)), false);
    assert.equal(fs.existsSync(path.join(tmp, result.abandonedDir)), false);
    assert.equal(
      fs.existsSync(path.join(tmp, result.plansRoot, "README.md")),
      false,
    );
    const again = ensurePlansRoot(tmp);
    assert.equal(again.createdRoot, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("listPendingPlans ignores README and reserved dirs", () => {
  const pending = listPendingPlans(LIGHT);
  assert.deepEqual(
    pending.map((entry) => entry.slug),
    ["tiny"],
  );
  assert.equal(pending[0].kind, "file");
  assert.equal(pending[0].href, "tiny.md");
});

test("discoverPlans reports duplicate root/done copies", () => {
  const found = discoverPlans(ORPHAN);
  assert.equal(found.duplicates.length, 1);
  assert.equal(found.duplicates[0].slug, "dup");
  assert.equal(found.duplicates[0].pending, "docs/plans/dup.md");
  assert.equal(found.duplicates[0].done, "docs/plans/done/dup.md");
});

test("CLI resolve and ensure-root round-trip through the gateway", () => {
  const tmp = tmpRoot();
  try {
    const resolved = spawnSync(
      process.execPath,
      [GATEWAY, "resolve", "--root", tmp],
      { encoding: "utf8" },
    );
    assert.equal(resolved.status, 0, resolved.stderr);
    const payload = JSON.parse(resolved.stdout);
    assert.equal(payload.plansRoot, DEFAULT_PLANS_ROOT);
    assert.equal(payload.context, "absent");
    assert.equal(payload.doneDir, "docs/plans/done");
    assert.equal(payload.abandonedDir, "docs/plans/abandoned");
    assert.equal(payload.ledgerPath, undefined);

    const ensured = spawnSync(
      process.execPath,
      [GATEWAY, "ensure-root", "--root", tmp],
      { encoding: "utf8" },
    );
    assert.equal(ensured.status, 0, ensured.stderr);
    const result = JSON.parse(ensured.stdout);
    assert.equal(result.createdRoot, true);
    assert.equal(fs.existsSync(path.join(tmp, result.plansRoot)), true);
    assert.equal(fs.existsSync(path.join(tmp, result.doneDir)), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("CLI list reports filesystem state", () => {
  const listed = spawnSync(
    process.execPath,
    [GATEWAY, "list", "--root", LIGHT],
    { encoding: "utf8" },
  );
  assert.equal(listed.status, 0, listed.stderr);
  const payload = JSON.parse(listed.stdout);
  assert.equal(payload.pending.length, 1);
  assert.equal(payload.pending[0].slug, "tiny");
  assert.equal(payload.duplicates.length, 0);
});

test("CLI discover-plans.mjs resolve matches the gateway", () => {
  const viaScript = spawnSync(
    process.execPath,
    [SCRIPT, "resolve", "--root", DOCS_HYGIENE],
    { encoding: "utf8" },
  );
  assert.equal(viaScript.status, 0, viaScript.stderr);
  const viaGateway = spawnSync(
    process.execPath,
    [GATEWAY, "resolve", "--root", DOCS_HYGIENE],
    { encoding: "utf8" },
  );
  assert.equal(viaGateway.status, 0, viaGateway.stderr);
  assert.deepEqual(JSON.parse(viaScript.stdout), JSON.parse(viaGateway.stdout));
  assert.equal(JSON.parse(viaScript.stdout).plansRoot, "docs/plans");
});

test("CLI rejects add-awaiting and unknown commands", () => {
  const tmp = tmpRoot();
  try {
    const awaiting = spawnSync(
      process.execPath,
      [SCRIPT, "add-awaiting", "--root", tmp, "--plan", "x.md", "--summary", "y"],
      { encoding: "utf8" },
    );
    assert.equal(awaiting.status, 1);
    assert.match(awaiting.stderr, /unknown command: add-awaiting/);

    const result = spawnSync(process.execPath, [SCRIPT, "nope", "--root", tmp], {
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unknown command: nope/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
