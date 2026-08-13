import { helper } from "./helper.ts";

export function main(): string {
  return helper("ok");
}

export function unusedExport(): number {
  return 42;
}
