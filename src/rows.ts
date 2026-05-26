import { createHash } from "node:crypto";
import { basename } from "node:path";
import type { GitWorktree, RepoGroup, Row } from "./types";

export { filterRows } from "./filter";

export function buildRows(groups: RepoGroup[]): Row[] {
  const rows: Row[] = [];
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));

  for (const group of sortedGroups) {
    rows.push({
      label: group.name,
      filterText: group.name,
      depth: 0,
      branch: group.branch,
      id: group.id,
      target: {
        display: group.name,
        path: group.path,
        sessionName: sessionName(group.name),
        kind: "repo",
      },
    });

    const worktrees = [...group.worktrees].sort((a, b) =>
      worktreeLabel(a).localeCompare(worktreeLabel(b)),
    );

    worktrees.forEach((worktree, index) => {
      const label = worktreeLabel(worktree);
      const prefix = index === worktrees.length - 1 ? "└──" : "├──";
      rows.push({
        label: `${prefix} ${label}`,
        filterText: `${group.name} ${label}`,
        depth: 1,
        parentId: group.id,
        id: `${group.id}:${worktree.path}`,
        target: {
          display: `${group.name}/${label}`,
          path: worktree.path,
          sessionName: sessionName(`${group.name}_${label}`),
          kind: "repo",
        },
      });
    });
  }

  disambiguateSessionNames(rows);
  return rows;
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

function hashPath(path: string) {
  return createHash("sha1").update(path).digest("hex").slice(0, 6);
}
