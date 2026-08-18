import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  matchesGlob,
  scan,
  walk,
} from "../skills/lodestar-audit/scripts/source-scan.mjs";
import { tempDir } from "../skills/lodestar-audit/scripts/runtime.mjs";

test("matchesGlob covers generated trees and bare file globs", () => {
  assert.equal(
    matchesGlob("packages/db/src/generated/client.ts", "**/generated/**"),
    true,
  );
  assert.equal(matchesGlob("src/foo.test.ts", "**/*.test.ts"), true);
  assert.equal(matchesGlob("src/foo.spec.ts", "*.spec.ts"), true);
  assert.equal(matchesGlob("src/foo.ts", "**/*.test.ts"), false);
});

test("source-scan --exclude skips generated files", () => {
  const tmp = tempDir("lodestar-scan-exclude-");
  try {
    fs.mkdirSync(path.join(tmp, "src", "generated"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "src", "a.ts"),
      "export function f(): any { return 1 }\n",
    );
    fs.writeFileSync(
      path.join(tmp, "src", "generated", "client.ts"),
      "export function f(): any { return 1 }\n",
    );
    const result = scan([
      "--recipe",
      "explicit-any",
      "--root",
      tmp,
      "--cwd",
      tmp,
      "--exclude",
      "**/generated/**",
    ]);
    assert.equal(result.count, 1);
    assert.match(result.hits[0].file, /a\.ts$/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("source-scan --test-glob replaces the hardcoded spec/test match", () => {
  const tmp = tempDir("lodestar-scan-testglob-");
  try {
    fs.mkdirSync(path.join(tmp, "src", "__tests__"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "src", "a.ts"),
      "export function f(): any { return 1 }\n",
    );
    fs.writeFileSync(
      path.join(tmp, "src", "__tests__", "a.ts"),
      "export function f(): any { return 1 }\n",
    );
    const hidden = scan([
      "--recipe",
      "explicit-any",
      "--root",
      tmp,
      "--cwd",
      tmp,
      "--test-glob",
      "**/__tests__/**",
    ]);
    assert.equal(hidden.count, 1);
    const included = scan([
      "--recipe",
      "explicit-any",
      "--root",
      tmp,
      "--cwd",
      tmp,
      "--test-glob",
      "**/__tests__/**",
      "--include-tests",
    ]);
    assert.equal(included.count, 2);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("source-scan --exclude applies when --root is outside process.cwd", () => {
  const tmp = tempDir("lodestar-scan-absroot-");
  try {
    fs.mkdirSync(path.join(tmp, "src", "generated"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "src", "a.ts"),
      "export function f(): any { return 1 }\n",
    );
    fs.writeFileSync(
      path.join(tmp, "src", "generated", "client.ts"),
      "export function f(): any { return 1 }\n",
    );
    const result = scan([
      "--recipe",
      "explicit-any",
      "--root",
      tmp,
      "--exclude",
      "**/generated/**",
    ]);
    assert.equal(result.count, 1);
    assert.match(result.hits[0].file, /a\.ts$/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("source-scan --exclude does not match ancestor dirs outside --cwd", () => {
  const parent = tempDir("lodestar-scan-anc-");
  const repo = path.join(parent, "build", "myapp");
  try {
    fs.mkdirSync(path.join(repo, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(repo, "src", "a.ts"),
      "export function f(): any { return 1 }\n",
    );
    const result = scan([
      "--recipe",
      "explicit-any",
      "--root",
      repo,
      "--cwd",
      repo,
      "--exclude",
      "**/build/**",
    ]);
    assert.equal(result.count, 1);
    assert.match(result.hits[0].file, /a\.ts$/);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("walk still skips node_modules and .git", () => {
  const tmp = tempDir("lodestar-scan-floor-");
  try {
    fs.mkdirSync(path.join(tmp, "node_modules", "pkg"), { recursive: true });
    fs.mkdirSync(path.join(tmp, ".git"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src", "a.ts"), "export const x = 1\n");
    fs.writeFileSync(
      path.join(tmp, "node_modules", "pkg", "a.ts"),
      "export const x = 1\n",
    );
    const files = walk(tmp, [".ts"], false, [], { cwd: tmp });
    assert.equal(files.length, 1);
    assert.match(files[0], /src[/\\]a\.ts$/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
