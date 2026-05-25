import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Config } from "./types";
import { expandPath } from "./path-utils";

export const DEFAULT_DEPTH = 3;
export const DEFAULT_EXCLUDED = [
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "dist",
  "node_modules",
  "target",
];

export const CONFIG_FILE =
  process.env.TMS_CONFIG_FILE ?? join(homedir(), ".config", "tms", "config.json");

export function loadConfig(required: true): Config;
export function loadConfig(required: false): Config | undefined;
export function loadConfig(required: boolean): Config | undefined {
  if (!existsSync(CONFIG_FILE)) {
    if (required) {
      throw new Error(
        `No config found at ${CONFIG_FILE}.\nRun \`tms config -p ~/dotfiles,~/Documents/codes/personal\` first.`,
      );
    }
    return undefined;
  }

  const parsed = JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as Partial<Config>;
  const depth = parsed.depth;
  return {
    paths: Array.isArray(parsed.paths) ? parsed.paths.map(expandPath) : [],
    depth: typeof depth === "number" && Number.isInteger(depth) ? depth : DEFAULT_DEPTH,
    excluded: Array.isArray(parsed.excluded) ? parsed.excluded : DEFAULT_EXCLUDED,
  };
}

export function writeConfig(config: Config) {
  mkdirSync(dirname(CONFIG_FILE), { recursive: true });
  writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);
}

export function defaultConfig(): Config {
  return {
    paths: [],
    depth: DEFAULT_DEPTH,
    excluded: DEFAULT_EXCLUDED,
  };
}
