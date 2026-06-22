#!/usr/bin/env bun

import { DEFAULT_DEPTH, DEFAULT_EXCLUDED, CONFIG_FILE, defaultConfig, loadConfig, writeConfig } from "./config";
import packageJson from "../package.json" with { type: "json" };
import type { Config, PickerTab } from "./types";
import { expandPath, fail, splitPathArg, unique } from "./utils";

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});

async function main() {
  const cliArgs = process.argv.slice(2);
  const [command, ...args] = cliArgs;

  try {
    if (isPickerCommand(cliArgs)) {
      await openPicker(parsePickerTab(cliArgs));
      return;
    }

    switch (command) {
      case undefined:
        await openPicker("repos");
        break;
      case "config":
        configure(args);
        break;
      case "list":
        await listRepos();
        break;
      case "help":
      case "--help":
      case "-h":
        printHelp();
        break;
      case "--version":
      case "-v":
        console.log(packageJson.version);
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

async function openPicker(defaultTab: PickerTab) {
  const { pickTarget } = await import("./picker");
  const target = await pickTarget(loadRows, loadSessionRows, defaultTab);

  if (!target) {
    process.exit(0);
  }

  const { openTmuxSession } = await import("./tmux");
  await openTmuxSession(target);
}

async function loadRows() {
  const config = loadConfig(true);
  const [{ discoverRepos }, { buildRows }] = await Promise.all([import("./git"), import("./rows")]);
  const rows = buildRows(await discoverRepos(config));

  if (rows.length === 0) {
    throw new Error("No Git repositories found in configured paths.");
  }

  return rows;
}

async function listRepos() {
  const config = loadConfig(true);
  const [{ discoverRepos }, { formatRepoList }] = await Promise.all([
    import("./git"),
    import("./list"),
  ]);
  const groups = await discoverRepos(config);

  if (groups.length === 0) {
    throw new Error("No Git repositories found in configured paths.");
  }

  console.log(formatRepoList(groups));
}

async function loadSessionRows() {
  const { listTmuxSessionRows } = await import("./tmux");
  return listTmuxSessionRows();
}

function isPickerCommand(args: string[]) {
  return args.length > 0 && args[0].startsWith("--tab");
}

function parsePickerTab(args: string[]): PickerTab {
  let tab: PickerTab = "repos";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--tab") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --tab. Expected repos or sessions.");
      }
      tab = parseTabValue(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--tab=")) {
      tab = parseTabValue(arg.slice("--tab=".length));
      continue;
    }

    throw new Error(`Unknown picker option: ${arg}`);
  }

  return tab;
}

function parseTabValue(value: string): PickerTab {
  const normalized = value.toLowerCase();
  if (normalized === "repos" || normalized === "sessions") {
    return normalized;
  }

  throw new Error("Invalid value for --tab. Expected repos or sessions.");
}

function printConfig(config: Config) {
  console.log(JSON.stringify(config, null, 2));
  console.log(`\nConfig: ${CONFIG_FILE}`);
}

function printHelp() {
  console.log(`Usage: tms [--tab repos|sessions] [command]\n\nCommands:\n  config    Configure search paths and depth\n  list      List repositories and worktree directories\n  help      Print this help\n\nRunning \`tms\` without a command opens the picker.`);
}

function printConfigHelp() {
  console.log(`Usage: tms config [options]\n\nOptions:\n  -p, --paths <paths>       Comma-separated or space-separated search paths\n  -d, --depth <number>      Maximum directory depth to search, default ${DEFAULT_DEPTH}\n      --excluded <names>    Directory names to skip while searching\n      --show                Print current config`);
}
