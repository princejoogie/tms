export type Config = {
  paths: string[];
  depth: number;
  excluded: string[];
};

export type GitWorktree = {
  path: string;
  head?: string;
  branch?: string;
  bare: boolean;
  detached: boolean;
  prunable: boolean;
};

export type RepoGroup = {
  id: string;
  name: string;
  path: string;
  branch?: string;
  worktrees: GitWorktree[];
};

export type Target = {
  display: string;
  path: string;
  sessionName: string;
};

export type Row = {
  label: string;
  filterText: string;
  target: Target;
  depth: number;
  branch?: string;
  parentId?: string;
  id: string;
};
