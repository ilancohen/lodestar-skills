import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ROOT,
  frontmatter,
  metadataVersion,
  readVersion,
  scalar,
} from "../scripts/lib.mjs";
import {
  checkPackage,
  measureSkillRunCost,
  packageMarkdownFiles,
} from "../scripts/check_package.mjs";
import { setVersion } from "../scripts/set_version.mjs";

function copyRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodestar-pkg-"));
  const walk = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (
        entry.name === ".git" ||
        entry.name === "node_modules" ||
        entry.name === ".cursor" ||
        entry.name === ".agents"
      ) {
        continue;
      }
      const src = path.join(from, entry.name);
      const out = path.join(to, entry.name);
      if (entry.isDirectory()) walk(src, out);
      else fs.copyFileSync(src, out);
    }
  };
  walk(ROOT, tmp);
  return tmp;
}

test("package checks pass against this repository", () => {
  const result = checkPackage(ROOT);
  assert.deepEqual(result.errors, []);
  assert.equal(result.version, readVersion());
  assert.equal(result.skillCount, 7);
});

test("package markdown set ignores plans and local installs", () => {
  const files = packageMarkdownFiles(ROOT).map((file) =>
    path.relative(ROOT, file).split(path.sep).join("/"),
  );
  assert.ok(files.includes("README.md"));
  assert.ok(files.includes("docs/evals.md"));
  assert.ok(files.some((file) => file.startsWith("skills/")));
  assert.equal(
    files.some(
      (file) =>
        file.startsWith("docs/plans/") ||
        file.startsWith(".agents/") ||
        file.startsWith("tests/"),
    ),
    false,
    files
      .filter(
        (file) =>
          file.startsWith("docs/plans/") ||
          file.startsWith(".agents/") ||
          file.startsWith("tests/"),
      )
      .join("\n"),
  );
});

test("ignored broken plan does not fail package checks", () => {
  const tmp = copyRepo();
  try {
    const planDir = path.join(tmp, "docs/plans/broken-local");
    fs.mkdirSync(planDir, { recursive: true });
    fs.writeFileSync(
      path.join(planDir, "README.md"),
      "# Broken\n\nSee [missing](./no-such-file.md).\n",
    );
    const result = checkPackage(tmp);
    assert.deepEqual(result.errors, []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("ignored local skill does not change package discovery", () => {
  const tmp = copyRepo();
  try {
    const before = checkPackage(tmp);
    assert.deepEqual(before.errors, []);
    assert.equal(before.skillCount, 7);
    const local = path.join(tmp, ".agents/skills/grill-me");
    fs.mkdirSync(local, { recursive: true });
    fs.writeFileSync(
      path.join(local, "SKILL.md"),
      "---\nname: grill-me\n---\nLocal only.\n\n[broken](./missing.md)\n",
    );
    const after = checkPackage(tmp);
    assert.deepEqual(after.errors, []);
    assert.equal(after.skillCount, 7);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("broken canonical skill link still fails package checks", () => {
  const tmp = copyRepo();
  try {
    const skillPath = path.join(tmp, "skills/lodestar-setup/SKILL.md");
    fs.appendFileSync(skillPath, "\nSee [missing](./no-such-bundled.md).\n");
    const { errors } = checkPackage(tmp);
    assert.ok(
      errors.some((error) => /no-such-bundled\.md/.test(error)),
      errors.join("\n"),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("eighth canonical skill still fails package checks", () => {
  const tmp = copyRepo();
  try {
    const extra = path.join(tmp, "skills/lodestar-extra");
    fs.mkdirSync(extra, { recursive: true });
    fs.writeFileSync(
      path.join(extra, "SKILL.md"),
      '---\nname: lodestar-extra\nlicense: MIT\ndisable-model-invocation: true\nmetadata:\n  version: "0.0.1"\n---\nExtra.\n',
    );
    const { errors } = checkPackage(tmp);
    assert.ok(
      errors.some((error) => /skills\/: expected/.test(error)),
      errors.join("\n"),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("set_version updates VERSION, manifests, and skill metadata", () => {
  const tmp = copyRepo();
  try {
    setVersion("0.1.1", tmp);
    assert.equal(
      fs.readFileSync(path.join(tmp, "VERSION"), "utf8").trim(),
      "0.1.1",
    );
    const plugin = JSON.parse(
      fs.readFileSync(path.join(tmp, "plugin.json"), "utf8"),
    );
    assert.equal(plugin.version, "0.1.1");
    const skill = fs.readFileSync(
      path.join(tmp, "skills/lodestar-audit/SKILL.md"),
      "utf8",
    );
    assert.match(skill, /version:\s*"0.1.1"/);
    const result = checkPackage(tmp);
    assert.deepEqual(result.errors, []);
    assert.equal(result.version, "0.1.1");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("set_version rejects a non-semver value", () => {
  assert.throws(() => setVersion("v1", ROOT), /MAJOR\.MINOR\.PATCH/);
});

test("package checks reject a cross-skill import outside the gateway", () => {
  const tmp = copyRepo();
  try {
    const target = path.join(
      tmp,
      "skills/lodestar-fix/scripts/action-state.mjs",
    );
    fs.writeFileSync(
      target,
      fs
        .readFileSync(target, "utf8")
        .replace(
          './setup-modules.mjs"',
          '../../lodestar-setup/scripts/runtime.mjs"',
        ),
    );
    const { errors } = checkPackage(tmp);
    assert.ok(
      errors.some((error) => /cross-skill import/.test(error)),
      errors.join("\n"),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("package checks reject a second runtime.mjs outside the base skill", () => {
  const tmp = copyRepo();
  try {
    fs.copyFileSync(
      path.join(tmp, "skills/lodestar-setup/scripts/runtime.mjs"),
      path.join(tmp, "skills/lodestar-fix/scripts/runtime.mjs"),
    );
    const { errors } = checkPackage(tmp);
    assert.ok(
      errors.some((error) => /runtime\.mjs lives only in/.test(error)),
      errors.join("\n"),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("package checks reject a gateway that drops its missing-base-skill guard", () => {
  const tmp = copyRepo();
  try {
    const gateway = path.join(
      tmp,
      "skills/lodestar-fix/scripts/setup-modules.mjs",
    );
    fs.writeFileSync(
      gateway,
      'export { atomicWrite, fail, isMain, parseArgs, printJson } from "../../lodestar-setup/scripts/runtime.mjs";\n',
    );
    const { errors } = checkPackage(tmp);
    assert.ok(
      errors.some((error) =>
        /must check the lodestar-setup module exists/.test(error),
      ),
      errors.join("\n"),
    );
    assert.ok(
      errors.some((error) => /must be dynamic/.test(error)),
      errors.join("\n"),
    );
    assert.ok(
      errors.some((error) => /must name the lodestar-setup skill/.test(error)),
      errors.join("\n"),
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("frontmatter tolerates CRLF line endings (Windows checkout without .gitattributes)", () => {
  const crlf =
    '---\r\nname: example\r\nlicense: MIT\r\nmetadata:\r\n  version: "1.2.3"\r\n---\r\n\r\nBody\r\n';
  const yaml = frontmatter(crlf, "example.md");
  assert.equal(scalar(yaml, "name"), "example");
  assert.equal(scalar(yaml, "license"), "MIT");
  assert.equal(metadataVersion(yaml), "1.2.3");
});

test("worst-case run cost counts references and ignores scripts", () => {
  const cost = measureSkillRunCost(ROOT, "lodestar-plan");
  assert.ok(
    cost.files.includes("skills/lodestar-plan/SKILL.md"),
    cost.files.join("\n"),
  );
  assert.ok(
    cost.files.includes("skills/lodestar-plan/references/locate.md"),
    cost.files.join("\n"),
  );
  assert.ok(
    cost.files.every((file) => !file.includes("/scripts/")),
    cost.files.join("\n"),
  );
  const locateWords = fs
    .readFileSync(
      path.join(ROOT, "skills/lodestar-plan/references/locate.md"),
      "utf8",
    )
    .split(/\s+/)
    .filter(Boolean).length;
  assert.ok(
    cost.markdownWords >= locateWords,
    `run cost ${cost.markdownWords} should include locate.md (~${locateWords})`,
  );

  const audit = measureSkillRunCost(ROOT, "lodestar-audit");
  const categoryDocs = audit.files.filter((file) =>
    file.startsWith("skills/lodestar-audit/categories/"),
  );
  assert.ok(categoryDocs.length >= 9, categoryDocs.join("\n"));
  // Principles resolve from the installed setup skill at run time — not
  // via a fixed `.agents/skills/…` link counted into audit's markdown load.
  assert.ok(
    !audit.files.includes("skills/lodestar-setup/principles.md"),
    audit.files.join("\n"),
  );

  const setup = measureSkillRunCost(ROOT, "lodestar-setup");
  assert.ok(
    setup.files.includes("skills/lodestar-setup/principles.md"),
    setup.files.join("\n"),
  );
});
