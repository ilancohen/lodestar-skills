import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  detectLinter,
  formatLintCell,
  inferProbeFromLintScript,
} from "../skills/lodestar-setup/scripts/detect-linter.mjs";

test("detectLinter finds eslint from config file", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-detect-linter-"));
  fs.writeFileSync(path.join(tmp, "eslint.config.js"), "export default [];\n");
  const result = detectLinter(tmp);
  assert.equal(result.tool, "eslint");
  assert.match(result.probe, /--format json/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("detectLinter finds biome from biome.json", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-detect-linter-"));
  fs.writeFileSync(path.join(tmp, "biome.json"), "{}\n");
  const result = detectLinter(tmp);
  assert.equal(result.tool, "biome");
  assert.match(result.probe, /reporter=json/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("detectLinter finds ruff from ruff.toml", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-detect-linter-"));
  fs.writeFileSync(path.join(tmp, "ruff.toml"), "[lint]\n");
  const result = detectLinter(tmp);
  assert.equal(result.tool, "ruff");
  assert.match(result.probe, /output-format json/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("inferProbeFromLintScript reads the lint script executable", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-detect-linter-"));
  fs.writeFileSync(
    path.join(tmp, "package.json"),
    JSON.stringify({ scripts: { lint: "eslint ." } }),
  );
  assert.match(inferProbeFromLintScript(tmp, "eslint"), /--format json/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("formatLintCell combines dev command, tool, and probe", () => {
  assert.equal(formatLintCell("n/a", { tool: null, probe: null }), "n/a");
  assert.equal(
    formatLintCell("npm run lint", {
      tool: "eslint",
      probe: "eslint --format json .",
    }),
    "npm run lint; eslint; eslint --format json .",
  );
});

test("detectLinter returns null tool when nothing is configured", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-detect-linter-"));
  const result = detectLinter(tmp);
  assert.equal(result.tool, null);
  assert.equal(result.probe, null);
  fs.rmSync(tmp, { recursive: true, force: true });
});
