import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, "..");
export const VERSION_PATH = path.join(ROOT, "VERSION");
export const SKILLS = [
  "ep-setup",
  "ep-audit",
  "ep-fix",
  "ep-review-architecture",
];
export const MANIFESTS = [
  "plugin.json",
  ".claude-plugin/plugin.json",
  ".codex-plugin/plugin.json",
  "gemini-extension.json",
];
export const KIRO_STEERING = [
  "ep-setup",
  "ep-audit",
  "ep-review-architecture",
];
export const KIRO_BLOCKED = ["ep-fix"];
export const ADAPTER_DIRS = [
  ".claude-plugin",
  ".codex-plugin",
  ".kiro",
];
export const SOURCE_MUTATING_SKILLS = ["ep-fix"];
export const REPO_URL = "https://github.com/ilancohen/engineering-principles-skills";
export const HOMEPAGE_URL = REPO_URL;
export const INSTALL_SPEC = "ilancohen/engineering-principles-skills";

export function readVersion(root = ROOT) {
  const text = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
  if (!text) throw new Error("VERSION is empty");
  return text;
}

export function readJson(filePath) {
  const relative = path.relative(ROOT, filePath);
  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${relative}: invalid JSON: ${error.message}`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${relative}: expected a JSON object`);
  }
  return value;
}

export function frontmatter(markdown, relativePath) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`${relativePath}: missing YAML frontmatter`);
  return match[1];
}

export function scalar(frontmatterText, field) {
  const match = frontmatterText.match(new RegExp(`^${field}:\\s*["']?([^"'\\n]+)`, "m"));
  return match ? match[1].trim() : null;
}

export function isMain(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(path.resolve(entry)).href === metaUrl;
}

export function metadataVersion(frontmatterText) {
  const match = frontmatterText.match(
    /^metadata:\s*\n(?:^[ \t]+.*\n)*?^[ \t]+version:\s*["']?([^"'\n]+)/m,
  );
  return match ? match[1].trim() : null;
}
