import { $ } from "bun";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import type { Config, GitWorktree, RepoGroup } from "./types";
import { realPath } from "./utils";

type DirectoryIgnoreRule = {
  name: string;
  negated: boolean;
};

export async function discoverRepos(config: Config): Promise<RepoGroup[]> {
  const repoPaths = new Set<string>();

  for (const searchPath of config.paths) {
    walkForRepos(searchPath, config.depth, new Set(config.excluded), repoPaths);
  }

  const groups = new Map<string, RepoGroup>();
  const discoveredGroups = await Promise.all(
    [...repoPaths].map(async (repoPath) => {
      const worktrees = await gitWorktrees(repoPath);
      const main = worktrees.find((worktree) => !worktree.bare && !worktree.prunable);

      if (!main) {
        return undefined;
      }

      return {
        id: main.path,
        name: basename(main.path),
        path: main.path,
        branch: main.branch,
        worktrees: worktrees.filter(
          (worktree) =>
            !worktree.bare && !worktree.prunable && realPath(worktree.path) !== realPath(main.path),
        ),
      } satisfies RepoGroup;
    }),
  );

  for (const group of discoveredGroups) {
    if (group && !groups.has(group.id)) {
      groups.set(group.id, group);
    }
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

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
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

async function gitWorktrees(repoPath: string): Promise<GitWorktree[]> {
  const result = await $`git -C ${repoPath} worktree list --porcelain`.quiet().nothrow();

  if (result.exitCode !== 0) {
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

  for (const line of result.stdout.toString().split("\n")) {
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

function hasGitEntry(path: string) {
  return existsSync(join(path, ".git"));
}

function shortBranch(branch: string) {
  return branch.replace(/^refs\/heads\//, "").replace(/^refs\/remotes\//, "");
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
