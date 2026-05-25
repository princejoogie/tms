import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function expandPath(path: string) {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }

  return resolve(path);
}

export function realPath(path: string) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

export function splitPathArg(value: string) {
  return value
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean);
}

export function unique(values: string[]) {
  return [...new Set(values)];
}
