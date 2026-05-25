#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

type Config = {
  paths: string[];
  depth: number;
  excluded: string[];
};

type GitWorktree = {
  path: string;
  head?: string;
  branch?: string;
  bare: boolean;
  detached: boolean;
  prunable: boolean;
};

type RepoGroup = {
  id: string;
  name: string;
  path: string;
  branch?: string;
  worktrees: GitWorktree[];
};

type Target = {
  display: string;
  path: string;
  sessionName: string;
};

type Row = {
  display: string;
  search: string;
  target: Target;
};

type DirectoryIgnoreRule = {
  name: string;
  negated: boolean;
};

const DEFAULT_DEPTH = 5;
const DEFAULT_EXCLUDED = [
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "dist",
  "node_modules",
  "target",
];

const CONFIG_FILE =
  process.env.TMS_CONFIG_FILE ?? join(homedir(), ".config", "tms", "config.json");

main();

function main() {
  const [command, ...args] = process.argv.slice(2);

  try {
    switch (command) {
      case undefined:
        openPicker();
        break;
      case "config":
        configure(args);
        break;
      case "list":
        printList();
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

function printList() {
  const rows = buildRows(discoverRepos(loadConfig(true)));
  for (const row of rows) {
    console.log(row.display);
  }
}

function openPicker() {
  const rows = buildRows(discoverRepos(loadConfig(true)));
  if (rows.length === 0) {
    throw new Error("No Git repositories found in configured paths.");
  }

  const target = pickTarget(rows);
  if (!target) {
    process.exit(0);
  }

  openTmuxSession(target);
}

function buildRows(groups: RepoGroup[]): Row[] {
  const rows: Row[] = [];
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));

  for (const group of sortedGroups) {
    rows.push({
      display: group.name,
      search: group.name,
      target: {
        display: group.name,
        path: group.path,
        sessionName: sessionName(group.name),
      },
    });

    const worktrees = [...group.worktrees].sort((a, b) =>
      worktreeLabel(a).localeCompare(worktreeLabel(b)),
    );

    worktrees.forEach((worktree, index) => {
      const label = worktreeLabel(worktree);
      const prefix = index === worktrees.length - 1 ? "└──" : "├──";
      rows.push({
        display: `${prefix} ${label}`,
        search: `${group.name} ${label}`,
        target: {
          display: `${group.name}/${label}`,
          path: worktree.path,
          sessionName: sessionName(`${group.name}_${label}`),
        },
      });
    });
  }

  disambiguateSessionNames(rows);
  return rows;
}

function discoverRepos(config: Config): RepoGroup[] {
  const repoPaths = new Set<string>();

  for (const searchPath of config.paths) {
    walkForRepos(searchPath, config.depth, new Set(config.excluded), repoPaths);
  }

  const groups = new Map<string, RepoGroup>();

  for (const repoPath of repoPaths) {
    const worktrees = gitWorktrees(repoPath);
    const main = worktrees.find((worktree) => !worktree.bare && !worktree.prunable);

    if (!main || groups.has(main.path)) {
      continue;
    }

    groups.set(main.path, {
      id: main.path,
      name: basename(main.path),
      path: main.path,
      branch: main.branch,
      worktrees: worktrees.filter(
        (worktree) =>
          !worktree.bare && !worktree.prunable && realPath(worktree.path) !== realPath(main.path),
      ),
    });
  }

  return withUniqueRepoNames([...groups.values()]);
}

function walkForRepos(
  root: string,
  maxDepth: number,
  excluded: Set<string>,
  repoPaths: Set<string>,
) {
  if (!existsSync(root)) {
    console.warn(`Warning: configured path does not exist: ${root}`);
    return;
  }

  const queue: Array<{ path: string; depth: number; ignoredDirs: Set<string> }> = [
    { path: root, depth: 0, ignoredDirs: excluded },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (hasGitEntry(current.path)) {
      repoPaths.add(realPath(current.path));
      continue;
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    let entries;
    try {
      entries = readdirSync(current.path, { withFileTypes: true });
    } catch {
      continue;
    }

    const ignoredDirs = applyGitignoreDirectoryRules(current.path, current.ignoredDirs);

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || ignoredDirs.has(entry.name)) {
        continue;
      }

      queue.push({ path: join(current.path, entry.name), depth: current.depth + 1, ignoredDirs });
    }
  }
}

function applyGitignoreDirectoryRules(directory: string, inherited: Set<string>) {
  const rules = readGitignoreDirectoryRules(directory);
  if (rules.length === 0) {
    return inherited;
  }

  const ignoredDirs = new Set(inherited);
  for (const rule of rules) {
    if (rule.negated) {
      ignoredDirs.delete(rule.name);
    } else {
      ignoredDirs.add(rule.name);
    }
  }

  return ignoredDirs;
}

function readGitignoreDirectoryRules(directory: string): DirectoryIgnoreRule[] {
  const gitignorePath = join(directory, ".gitignore");
  if (!existsSync(gitignorePath)) {
    return [];
  }

  try {
    return readFileSync(gitignorePath, "utf8")
      .split(/\r?\n/)
      .map(parseGitignoreDirectoryRule)
      .filter((rule): rule is DirectoryIgnoreRule => rule !== undefined);
  } catch {
    return [];
  }
}

function parseGitignoreDirectoryRule(line: string): DirectoryIgnoreRule | undefined {
  let pattern = line.trim();
  if (!pattern || pattern.startsWith("#")) {
    return undefined;
  }

  const negated = pattern.startsWith("!");
  if (negated) {
    pattern = pattern.slice(1).trim();
  }

  if (!pattern || hasGitignoreGlob(pattern)) {
    return undefined;
  }

  pattern = pattern.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!pattern || pattern.includes("/")) {
    return undefined;
  }

  return { name: pattern, negated };
}

function hasGitignoreGlob(pattern: string) {
  return /[*?[\]]/.test(pattern);
}

function gitWorktrees(repoPath: string): GitWorktree[] {
  const result = spawnSync("git", ["-C", repoPath, "worktree", "list", "--porcelain"], {
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    return [];
  }

  const worktrees: GitWorktree[] = [];
  let current: GitWorktree | undefined;

  const flush = () => {
    if (current) {
      current.path = realPath(current.path);
      worktrees.push(current);
      current = undefined;
    }
  };

  for (const line of result.stdout.split("\n")) {
    if (line.trim() === "") {
      flush();
      continue;
    }

    if (line.startsWith("worktree ")) {
      flush();
      current = {
        path: line.slice("worktree ".length),
        bare: false,
        detached: false,
        prunable: false,
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length);
    } else if (line.startsWith("branch ")) {
      current.branch = shortBranch(line.slice("branch ".length));
    } else if (line === "bare") {
      current.bare = true;
    } else if (line === "detached") {
      current.detached = true;
    } else if (line.startsWith("prunable")) {
      current.prunable = true;
    }
  }

  flush();
  return worktrees;
}

function pickTarget(rows: Row[]): Target | undefined {
  const input = rows
    .map((row, index) => {
      // Pad display to 800 chars so the search text is pushed off-screen.
      // This is necessary because fzf cannot search hidden columns, and we
      // don't want to visually clutter the UI with the parent repo name on every worktree.
      const paddedDisplay = row.display.padEnd(800, " ");
      return `${paddedDisplay}${row.search}\t${index}`;
    })
    .join("\n");

  const result = spawnSync(
    "fzf",
    [
      "--reverse",
      "--tiebreak=index",
      "--no-hscroll",
      "--prompt",
      "tms> ",
      "--delimiter",
      "\t",
      "--with-nth",
      "1", // Hide the index column from display and search
    ],
    {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "inherit"],
    },
  );

  if (result.error) {
    if (isMissingCommand(result.error)) {
      throw new Error("fzf is required to use the picker.");
    }
    throw result.error;
  }

  if (result.status !== 0) {
    return undefined;
  }

  const selected = result.stdout.trimEnd();
  const index = Number(selected.split("\t").at(-1));
  return rows[index]?.target;
}

function openTmuxSession(target: Target) {
  if (!tmuxHasSession(target.sessionName)) {
    runTmux(["new-session", "-d", "-s", target.sessionName, "-c", target.path]);
  }

  if (process.env.TMUX) {
    runTmux(["switch-client", "-t", target.sessionName], true);
  } else {
    runTmux(["attach-session", "-t", target.sessionName], true);
  }
}

function tmuxHasSession(name: string) {
  const result = spawnSync("tmux", ["has-session", "-t", name], { stdio: "ignore" });
  if (result.error && isMissingCommand(result.error)) {
    throw new Error("tmux is required to open sessions.");
  }
  return result.status === 0;
}

function runTmux(args: string[], inherit = false) {
  const result = spawnSync("tmux", args, { stdio: inherit ? "inherit" : "pipe" });
  if (result.error) {
    if (isMissingCommand(result.error)) {
      throw new Error("tmux is required to open sessions.");
    }
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`tmux ${args.join(" ")} failed.`);
  }
}

function hasGitEntry(path: string) {
  return existsSync(join(path, ".git"));
}

function loadConfig(required: true): Config;
function loadConfig(required: false): Config | undefined;
function loadConfig(required: boolean): Config | undefined {
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

function writeConfig(config: Config) {
  mkdirSync(dirname(CONFIG_FILE), { recursive: true });
  writeFileSync(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`);
}

function defaultConfig(): Config {
  return {
    paths: [],
    depth: DEFAULT_DEPTH,
    excluded: DEFAULT_EXCLUDED,
  };
}

function printConfig(config: Config) {
  console.log(JSON.stringify(config, null, 2));
  console.log(`\nConfig: ${CONFIG_FILE}`);
}

function printHelp() {
  console.log(`Usage: tms [command]\n\nCommands:\n  config    Configure search paths and depth\n  list      Print discovered repositories and worktrees\n  help      Print this help\n\nRunning \`tms\` without a command opens the picker.`);
}

function printConfigHelp() {
  console.log(`Usage: tms config [options]\n\nOptions:\n  -p, --paths <paths>       Comma-separated or space-separated search paths\n  -d, --depth <number>      Maximum directory depth to search, default ${DEFAULT_DEPTH}\n      --excluded <names>    Directory names to skip while searching\n      --show                Print current config`);
}

function splitPathArg(value: string) {
  return value
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean);
}

function expandPath(path: string) {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }

  return resolve(path);
}

function realPath(path: string) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function shortBranch(branch: string) {
  return branch.replace(/^refs\/heads\//, "").replace(/^refs\/remotes\//, "");
}

function worktreeLabel(worktree: GitWorktree) {
  return worktree.branch ?? worktree.head?.slice(0, 8) ?? basename(worktree.path);
}

function sessionName(value: string) {
  const sanitized = value
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized || "tms";
}

function disambiguateSessionNames(rows: Row[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.target.sessionName, (counts.get(row.target.sessionName) ?? 0) + 1);
  }

  for (const row of rows) {
    if ((counts.get(row.target.sessionName) ?? 0) > 1) {
      row.target.sessionName = `${row.target.sessionName}_${hashPath(row.target.path)}`;
    }
  }
}

function withUniqueRepoNames(groups: RepoGroup[]) {
  const counts = new Map<string, number>();
  for (const group of groups) {
    counts.set(group.name, (counts.get(group.name) ?? 0) + 1);
  }

  return groups.map((group) => {
    if ((counts.get(group.name) ?? 0) === 1) {
      return group;
    }

    return {
      ...group,
      name: uniquePathSuffix(
        group.path,
        groups.filter((other) => other.name === group.name).map((other) => other.path),
      ),
    };
  });
}

function uniquePathSuffix(path: string, paths: string[]) {
  const parts = path.split("/").filter(Boolean);

  for (let depth = 1; depth <= parts.length; depth += 1) {
    const suffix = parts.slice(-depth).join("/");
    const duplicates = paths.filter((other) => other.endsWith(suffix));
    if (duplicates.length === 1) {
      return suffix;
    }
  }

  return path;
}

function hashPath(path: string) {
  return createHash("sha1").update(path).digest("hex").slice(0, 6);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function isMissingCommand(error: Error) {
  return "code" in error && error.code === "ENOENT";
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
