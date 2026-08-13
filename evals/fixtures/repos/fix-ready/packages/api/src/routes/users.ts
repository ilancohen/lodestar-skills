import { userService } from "@repo/core/src/user/user.service";

export function listUsers(): any {
  return userService.list();
}
