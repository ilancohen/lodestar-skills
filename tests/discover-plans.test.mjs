import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_PLANS_ROOT,
  addAwaitingRow,
  bootstrapPlansRoot,
  emptyLedger,
  parseLedger,
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

test("bootstrapPlansRoot creates the root, done/, and an empty ledger", () => {
  const tmp = tmpRoot();
  try {
    const result = bootstrapPlansRoot(tmp);
    assert.equal(result.plansRoot, DEFAULT_PLANS_ROOT);
    assert.equal(result.createdRoot, true);
    assert.equal(result.createdLedger, true);
    assert.equal(fs.existsSync(path.join(tmp, result.plansRoot)), true);
    assert.equal(fs.existsSync(path.join(tmp, result.doneDir)), true);
    const text = fs.readFileSync(path.join(tmp, result.ledgerPath), "utf8");
    const parsed = parseLedger(text);
    assert.deepEqual(parsed.awaiting, []);
    assert.deepEqual(parsed.done, []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("bootstrapPlansRoot does not overwrite an existing ledger", () => {
  const tmp = tmpRoot();
  try {
    const first = bootstrapPlansRoot(tmp);
    const ledgerAbs = path.join(tmp, first.ledgerPath);
    fs.writeFileSync(ledgerAbs, `${emptyLedger()}\n<!-- keep -->\n`, "utf8");
    const second = bootstrapPlansRoot(tmp);
    assert.equal(second.createdRoot, false);
    assert.equal(second.createdLedger, false);
    assert.match(fs.readFileSync(ledgerAbs, "utf8"), /keep/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("addAwaitingRow appends a linked row and is idempotent", () => {
  const added = addAwaitingRow(
    emptyLedger(),
    "demo.md",
    "A short plan.",
    "demo.md",
  );
  assert.equal(added.added, true);
  const parsed = parseLedger(added.text);
  assert.equal(parsed.awaiting.length, 1);
  assert.equal(parsed.awaiting[0].href, "demo.md");
  assert.equal(parsed.awaiting[0].summary, "A short plan.");
  const again = addAwaitingRow(added.text, "demo.md", "ignored");
  assert.equal(again.added, false);
  assert.equal(parseLedger(again.text).awaiting.length, 1);
});

test("addAwaitingRow keeps escaped pipes and does not rewrite Done", () => {
  const ledger = `# Plans ledger

## Awaiting Implementation

| Plan | Summary |
| ---- | ------- |
| [old.md](old.md) | light \\| standard \\| full |

## Done

| Plan | Evidence |
| ---- | -------- |
| [shipped.md](done/shipped.md) | landed at \`abc1234\`. |
`;
  const doneSlice = ledger.slice(ledger.indexOf("## Done"));
  const added = addAwaitingRow(ledger, "new.md", "uses a | in the summary");
  assert.equal(added.added, true);
  assert.equal(added.text.slice(added.text.indexOf("## Done")), doneSlice);
  assert.match(added.text, /\| \[old\.md\]\(old\.md\) \| light \\\| standard \\\| full \|/);
  assert.match(added.text, /\| \[new\.md\]\(new\.md\) \| uses a \\\| in the summary \|/);
  const parsed = parseLedger(added.text);
  assert.equal(parsed.awaiting.length, 2);
  assert.equal(parsed.awaiting[0].summary, "light | standard | full");
  assert.equal(parsed.awaiting[1].href, "new.md");
  assert.equal(parsed.awaiting[1].summary, "uses a | in the summary");
  assert.equal(parsed.done.length, 1);
  assert.equal(parsed.done[0].href, "done/shipped.md");
});

test("CLI resolve and add-awaiting round-trip through the gateway", () => {
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

    const added = spawnSync(
      process.execPath,
      [
        GATEWAY,
        "add-awaiting",
        "--root",
        tmp,
        "--plan",
        "one.md",
        "--summary",
        "First plan.",
      ],
      { encoding: "utf8" },
    );
    assert.equal(added.status, 0, added.stderr);
    const result = JSON.parse(added.stdout);
    assert.equal(result.added, true);
    const ledger = fs.readFileSync(path.join(tmp, result.ledgerPath), "utf8");
    assert.match(ledger, /\[one\.md\]\(one\.md\)/);
    assert.match(ledger, /First plan\./);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
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

test("CLI rejects an unknown command", () => {
  const tmp = tmpRoot();
  try {
    const result = spawnSync(process.execPath, [SCRIPT, "nope", "--root", tmp], {
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unknown command: nope/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
