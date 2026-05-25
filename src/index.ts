#!/usr/bin/env bun

import { DEFAULT_DEPTH, DEFAULT_EXCLUDED, CONFIG_FILE, defaultConfig, loadConfig, writeConfig } from "./config";
import { discoverRepos } from "./git";
import { expandPath, splitPathArg, unique } from "./path-utils";
import { pickTarget } from "./picker";
import { buildRows } from "./rows";
import { openTmuxSession } from "./tmux";
import type { Config } from "./types";
import { fail } from "./utils";

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});

async function main() {
  const [command, ...args] = process.argv.slice(2);

  try {
    switch (command) {
      case undefined:
        await openPicker();
        break;
      case "config":
        configure(args);
        break;
      case "help":
      case "--help":
      case "-h":
        printHelp();
        break;
      default:
        fail(`Unknown command: ${command}\nRun \`tms --help\` for usage.`);
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function configure(args: string[]) {
  if (args.includes("--help") || args.includes("-h")) {
    printConfigHelp();
    return;
  }

  const current = loadConfig(false) ?? defaultConfig();
  const next: Config = { ...current, excluded: [...current.excluded] };
  const pathInputs: string[] = [];
  let changed = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--show") {
      printConfig(current);
      return;
    }

    if (arg === "-p" || arg === "--paths") {
      index += 1;
      while (index < args.length && !args[index].startsWith("-")) {
        pathInputs.push(...splitPathArg(args[index]));
        index += 1;
      }
      index -= 1;
      changed = true;
      continue;
    }

    if (arg === "-d" || arg === "--depth") {
      const value = args[index + 1];
      const depth = Number(value);
      if (!Number.isInteger(depth) || depth < 0) {
        throw new Error("Depth must be a non-negative integer.");
      }
      next.depth = depth;
      index += 1;
      changed = true;
      continue;
    }

    if (arg === "--excluded") {
      const excluded: string[] = [];
      index += 1;
      while (index < args.length && !args[index].startsWith("-")) {
        excluded.push(...splitPathArg(args[index]));
        index += 1;
      }
      index -= 1;
      next.excluded = unique(excluded.length > 0 ? excluded : DEFAULT_EXCLUDED);
      changed = true;
      continue;
    }

    throw new Error(`Unknown config option: ${arg}`);
  }

  if (pathInputs.length > 0) {
    next.paths = unique(pathInputs.map(expandPath));
  }

  if (!changed) {
    printConfig(current);
    return;
  }

  writeConfig(next);
  printConfig(next);
}

async function openPicker() {
  const rows = buildRows(await discoverRepos(loadConfig(true)));
  if (rows.length === 0) {
    throw new Error("No Git repositories found in configured paths.");
  }

  const target = await pickTarget(rows);
  if (!target) {
    process.exit(0);
  }

  await openTmuxSession(target);
}

function printConfig(config: Config) {
  console.log(JSON.stringify(config, null, 2));
  console.log(`\nConfig: ${CONFIG_FILE}`);
}

function printHelp() {
  console.log(`Usage: tms [command]\n\nCommands:\n  config    Configure search paths and depth\n  help      Print this help\n\nRunning \`tms\` without a command opens the picker.`);
}

function printConfigHelp() {
  console.log(`Usage: tms config [options]\n\nOptions:\n  -p, --paths <paths>       Comma-separated or space-separated search paths\n  -d, --depth <number>      Maximum directory depth to search, default ${DEFAULT_DEPTH}\n      --excluded <names>    Directory names to skip while searching\n      --show                Print current config`);
}
