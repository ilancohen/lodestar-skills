import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  architectureOutputRoot,
  isLiveAuditRun,
  survey,
} from "../skills/lodestar-docs/scripts/scope.mjs";
import { observeDocsLayout } from "../skills/lodestar-setup/scripts/discover-docs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = path.join(ROOT, "tests/fixtures/repos/docs-hygiene");
const SCRIPT = path.join(ROOT, "skills/lodestar-docs/scripts/scope.mjs");

function paths(result) {
  return result.files.map((file) => file.path).sort();
}

function byPath(result, relative) {
  return result.files.find((file) => file.path === relative);
}

test("architectureOutputRoot matches audit derivation", () => {
  assert.equal(
    architectureOutputRoot("docs/audit"),
    "docs/architecture-review",
  );
  assert.equal(
    architectureOutputRoot("notes/audit"),
    "notes/audit/architecture-review",
  );
});

test("isLiveAuditRun protects findings, checkpoints, or action items without INDEX", () => {
  const live = path.join(FIXTURE, "docs/audit/2026-08-10");
  const done = path.join(FIXTURE, "docs/audit/done");
  assert.equal(isLiveAuditRun(live), true);
  assert.equal(isLiveAuditRun(done), false);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-live-audit-"));
  try {
    const findingsOnly = path.join(tmp, "findings-only");
    fs.mkdirSync(findingsOnly);
    fs.writeFileSync(path.join(findingsOnly, "findings.md"), "# findings\n");
    assert.equal(isLiveAuditRun(findingsOnly), true);

    const checkpointOnly = path.join(tmp, "checkpoint-only");
    fs.mkdirSync(checkpointOnly);
    fs.writeFileSync(path.join(checkpointOnly, ".checkpoint.json"), "{}\n");
    assert.equal(isLiveAuditRun(checkpointOnly), true);

    const itemsOnly = path.join(tmp, "items-only");
    fs.mkdirSync(itemsOnly);
    fs.writeFileSync(path.join(itemsOnly, "001-imports-x.md"), "item\n");
    assert.equal(isLiveAuditRun(itemsOnly), true);

    const empty = path.join(tmp, "empty");
    fs.mkdirSync(empty);
    assert.equal(isLiveAuditRun(empty), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("default survey covers staging trees and skips live runs and inflight plans", () => {
  const result = survey(FIXTURE);
  assert.equal(result.ok, true);
  assert.equal(result.commits, "never");
  assert.equal(result.agentsMdHasDocsMap, true);
  assert.deepEqual(result.homes.sort(), [
    "docs/rejected-approaches.md",
    "docs/spec/architecture.md",
  ]);
  const listed = paths(result);
  assert.ok(listed.includes("docs/audit/done/old-finding.md"));
  assert.ok(listed.includes("docs/plans/done/shipped.md"));
  assert.ok(listed.includes("docs/plans/abandoned/failed-pilot.md"));
  assert.ok(listed.includes("docs/architecture-review/2026-07-01.md"));
  assert.equal(listed.includes("docs/orphan.md"), false);
  assert.equal(listed.includes("docs/spec/architecture.md"), false);
  assert.equal(listed.includes("docs/plans/inflight.md"), false);
  const liveItem = byPath(
    result,
    "docs/audit/2026-08-10/001-imports-cross-package.md",
  );
  assert.equal(liveItem, undefined);
});

test("full survey lists the whole docs tree but protects live work", () => {
  const result = survey(FIXTURE, { full: true });
  assert.equal(result.ok, true);
  const live = byPath(
    result,
    "docs/audit/2026-08-10/001-imports-cross-package.md",
  );
  assert.equal(live.protected, true);
  assert.equal(live.reason, "live-audit-run");
  const inflight = byPath(result, "docs/plans/inflight.md");
  assert.equal(inflight.protected, true);
  assert.equal(inflight.reason, "inflight-plan");
  const orphan = byPath(result, "docs/orphan.md");
  assert.equal(orphan.protected, false);
});

test("survey without context.md fails unless the user names a tree", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-docs-"));
  try {
    fs.mkdirSync(path.join(tmp, "docs/plans/done"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "docs/plans/done/x.md"), "done\n");
    const blocked = survey(tmp);
    assert.equal(blocked.ok, false);
    const named = survey(tmp, { trees: ["docs/plans/done"] });
    assert.equal(named.ok, true);
    assert.deepEqual(paths(named), ["docs/plans/done/x.md"]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("CLI survey --root prints JSON", () => {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, "survey", "--root", FIXTURE],
    {
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.outputRoot, "docs/audit");
});

test("observeDocsLayout classifies the docs-hygiene fixture", () => {
  const { rows } = observeDocsLayout(FIXTURE);
  const byPath = Object.fromEntries(rows.map((row) => [row.path, row.role]));
  assert.equal(byPath["docs/spec"], "home");
  assert.equal(byPath["docs/rejected-approaches.md"], "home");
  assert.equal(byPath["docs/audit"], "staging");
  assert.equal(byPath["docs/architecture-review"], "staging");
  assert.equal(byPath["docs/plans"], "inflight");
  assert.equal(byPath["docs/plans/done"], "staging");
  assert.equal(byPath["docs/orphan.md"], "unknown");
  assert.equal(byPath["docs/audit/done"], undefined);
});
