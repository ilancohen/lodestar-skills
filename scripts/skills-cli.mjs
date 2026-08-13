/** Run the `skills` CLI through this repo's package manager (pnpm). */
import { spawnSync } from "node:child_process";

export function runSkillsCli(args, cwd) {
  return spawnSync("pnpm", ["dlx", "skills", ...args], {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}
