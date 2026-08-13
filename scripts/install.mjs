#!/usr/bin/env node
/** Interactive installer. Defaults = detected agents + all skills + project. */

import { SKILLS, isMain } from "./lib.mjs";
import { runSkillsCli } from "./skills-cli.mjs";
import {
  SUPPORTED_AGENTS,
  buildSkillsAddArgs,
  defaultSelection,
  parseInstallArgs,
  resolveSelection,
  resolveSource,
} from "./detect-agents.mjs";

export const HELP = `Usage: node scripts/install.mjs [options]

  -y, --yes            Skip prompts; detected agents and all skills
  -a, --agent <id>     Target agent (repeatable; '*' for all)
  -s, --skill <name>   Skill to install (repeatable; '*' for all)
  -g, --global         Install to user directories
  --copy               Copy files instead of symlinking
  -h, --help           Show this help

Enter keeps the pre-selected defaults. Space toggles.
`;

async function promptSelection(defaults, args) {
  const { cancel, confirm, intro, isCancel, multiselect, outro, select } =
    await import("@clack/prompts");
  const quit = (value) => {
    if (!isCancel(value)) return;
    cancel("Install cancelled.");
    process.exit(0);
  };

  intro("Engineering Principles skills");
  const detected = new Set(defaults.detected);
  const agents = await multiselect({
    message: "Agents",
    options: SUPPORTED_AGENTS.map((agent) => ({
      value: agent.id,
      label: agent.label,
      hint: detected.has(agent.id) ? "detected" : undefined,
    })),
    initialValues: args.agents ?? defaults.agents,
    required: true,
  });
  quit(agents);
  const skills = await multiselect({
    message: "Skills",
    options: SKILLS.map((name) => ({ value: name, label: name })),
    initialValues: args.skills ?? defaults.skills,
    required: true,
  });
  quit(skills);
  const scope = await select({
    message: "Scope",
    options: [
      { value: "project", label: "Project" },
      { value: "global", label: "Global (user directories)" },
    ],
    initialValue: args.global ? "global" : "project",
  });
  quit(scope);
  const ok = await confirm({
    message: "Install with these choices?",
    initialValue: true,
  });
  if (isCancel(ok) || !ok) {
    cancel("Install cancelled.");
    process.exit(0);
  }
  outro("Installing");
  return { agents, skills, global: scope === "global" };
}

export async function runInstall(argv = process.argv.slice(2), options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const stdinIsTTY = options.stdinIsTTY ?? Boolean(process.stdin.isTTY);
  let args;
  try {
    args = parseInstallArgs(argv);
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    return 1;
  }
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }

  let selection;
  try {
    if (args.yes || !stdinIsTTY) {
      selection = resolveSelection(args, {
        cwd,
        home: options.home,
        env: options.env,
      });
    } else {
      const defaults = defaultSelection({
        cwd,
        home: options.home,
        env: options.env,
      });
      const prompted = await promptSelection(defaults, args);
      selection = {
        agents: prompted.agents,
        skills: prompted.skills,
        global: prompted.global,
        copy: args.copy,
        detected: defaults.detected,
      };
    }
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n`);
    return 1;
  }

  const cliArgs = buildSkillsAddArgs({
    source: resolveSource(cwd),
    skills: selection.skills,
    agents: selection.agents,
    global: selection.global,
    copy: args.copy,
  });
  const add = options.runSkillsCli ?? runSkillsCli;
  const result = add(cliArgs, cwd);
  if (result.status !== 0) {
    process.stderr.write(
      result.stderr || result.stdout || "skills add failed\n",
    );
    return 1;
  }
  if (result.stdout) process.stdout.write(result.stdout);
  return 0;
}

async function main() {
  process.exit(await runInstall());
}

if (isMain(import.meta.url)) {
  main();
}
