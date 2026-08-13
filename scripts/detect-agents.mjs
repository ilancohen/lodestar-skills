/** Detect coding agents and build `skills add` argv. No TTY. */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { INSTALL_SPEC, SKILLS } from "./lib.mjs";

export const SUPPORTED_AGENTS = [
  {
    id: "cursor",
    label: "Cursor",
    project: [".cursor"],
    home: [".cursor"],
    env: ["CURSOR_TRACE_ID", "CURSOR_AGENT"],
  },
  {
    id: "claude-code",
    label: "Claude Code",
    project: [".claude"],
    home: [".claude"],
    env: ["CLAUDE_CODE", "CLAUDECODE"],
  },
  {
    id: "codex",
    label: "Codex",
    project: [".codex"],
    home: [".codex"],
    env: ["CODEX_HOME", "CODEX_CLI"],
  },
  {
    id: "gemini-cli",
    label: "Gemini CLI",
    project: [".gemini"],
    home: [".gemini"],
    env: ["GEMINI_CLI"],
  },
  {
    id: "github-copilot",
    label: "GitHub Copilot",
    project: [".github/copilot-instructions.md", ".github/skills"],
    home: [".copilot"],
    env: ["COPILOT_CLI"],
  },
  {
    id: "kiro-cli",
    label: "Kiro CLI",
    project: [".kiro"],
    home: [".kiro"],
    env: ["KIRO_CLI"],
  },
];

const AGENT_IDS = SUPPORTED_AGENTS.map((agent) => agent.id);

function exists(filePath) {
  return fs.existsSync(filePath);
}

function anyMarker(root, markers) {
  return markers.some((marker) => exists(path.join(root, marker)));
}

export function detectAgents(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const home = options.home ?? os.homedir();
  const env = options.env ?? process.env;
  const found = [];
  for (const agent of SUPPORTED_AGENTS) {
    const inProject = anyMarker(cwd, agent.project);
    const inHome = anyMarker(home, agent.home);
    const inEnv = agent.env.some((name) => Boolean(env[name]));
    if (inProject || inHome || inEnv) found.push(agent.id);
  }
  return found;
}

export function defaultSelection(options = {}) {
  const detected = detectAgents(options);
  return {
    agents: detected.length ? detected : ["cursor"],
    skills: [...SKILLS],
    global: false,
    detected,
  };
}

function takeValues(argv, start) {
  const values = [];
  let index = start;
  while (index < argv.length && !argv[index].startsWith("-")) {
    values.push(argv[index]);
    index += 1;
  }
  return { values, index };
}

function expandList(values, all) {
  const expanded = [];
  for (const value of values.flatMap((item) => item.split(","))) {
    const id = value.trim();
    if (!id) continue;
    if (id === "*") {
      expanded.push(...all);
      continue;
    }
    expanded.push(id);
  }
  return [...new Set(expanded)];
}

export function parseInstallArgs(argv) {
  const result = {
    yes: false,
    help: false,
    global: false,
    copy: false,
    agents: null,
    skills: null,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    i += 1;
    switch (arg) {
      case "-y":
      case "--yes":
        result.yes = true;
        break;
      case "-h":
      case "--help":
        result.help = true;
        break;
      case "-g":
      case "--global":
        result.global = true;
        break;
      case "--copy":
        result.copy = true;
        break;
      case "-a":
      case "--agent": {
        const taken = takeValues(argv, i);
        i = taken.index;
        if (!taken.values.length) {
          throw new Error("select at least one agent");
        }
        result.agents = expandList(
          [...(result.agents || []), ...taken.values],
          AGENT_IDS,
        );
        break;
      }
      case "-s":
      case "--skill": {
        const taken = takeValues(argv, i);
        i = taken.index;
        if (!taken.values.length) {
          throw new Error("select at least one skill");
        }
        result.skills = expandList(
          [...(result.skills || []), ...taken.values],
          SKILLS,
        );
        break;
      }
      default:
        throw new Error(`unknown option: ${arg}`);
    }
  }
  if (result.agents) {
    for (const id of result.agents) {
      if (!AGENT_IDS.includes(id)) throw new Error(`unknown agent: ${id}`);
    }
    if (!result.agents.length) throw new Error("select at least one agent");
  }
  if (result.skills) {
    for (const name of result.skills) {
      if (!SKILLS.includes(name)) throw new Error(`unknown skill: ${name}`);
    }
    if (!result.skills.length) throw new Error("select at least one skill");
  }
  return result;
}

export function resolveSelection(args, detectOptions = {}) {
  const defaults = defaultSelection(detectOptions);
  const agents = args.agents ?? defaults.agents;
  const skills = args.skills ?? defaults.skills;
  if (!agents.length) throw new Error("select at least one agent");
  if (!skills.length) throw new Error("select at least one skill");
  return {
    agents,
    skills,
    global: Boolean(args.global),
    copy: Boolean(args.copy),
    detected: defaults.detected,
  };
}

export function isPackageRoot(dir) {
  return exists(path.join(dir, "skills", "ep-setup", "SKILL.md"));
}

export function resolveSource(cwd = process.cwd()) {
  return isPackageRoot(cwd) ? "." : INSTALL_SPEC;
}

export function buildSkillsAddArgs(selection) {
  const args = [
    "add",
    selection.source,
    "--skill",
    ...selection.skills,
    "-a",
    ...selection.agents,
    "-y",
  ];
  if (selection.global) args.push("-g");
  if (selection.copy) args.push("--copy");
  return args;
}
