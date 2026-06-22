import { basename } from "node:path";
import type { GitWorktree, RepoGroup } from "./types";

export function formatRepoList(groups: RepoGroup[]) {
  const lines: string[] = [];
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));

  sortedGroups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      lines.push("");
    }

    lines.push(group.name);
    lines.push(`  directory: ${group.path}`);

    const worktrees = [...group.worktrees].sort((a, b) =>
      worktreeLabel(a).localeCompare(worktreeLabel(b)),
    );

    if (worktrees.length > 0) {
      lines.push("  worktrees:");
      for (const worktree of worktrees) {
        lines.push(`    ${worktreeLabel(worktree)}: ${worktree.path}`);
      }
    }
  });

  return lines.join("\n");
}

function worktreeLabel(worktree: GitWorktree) {
  return worktree.branch ?? worktree.head?.slice(0, 8) ?? basename(worktree.path);
}
