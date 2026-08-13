import { userService } from "@repo/core"; // partial: still named userService

export function listUsers(): any {
  return userService.list();
}
