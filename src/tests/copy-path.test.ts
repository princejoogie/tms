import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "bun:test";
import { copyableRepoPath } from "../copy-path";
import type { Row } from "../types";

test("returns an absolute path for repo rows", () => {
  expect(copyableRepoPath(row("relative/repo"))).toBe(resolve("relative/repo"));
});

test("returns an absolute path for worktree rows", () => {
  expect(copyableRepoPath({ ...row("relative/worktree"), depth: 1 })).toBe(resolve("relative/worktree"));
});

test("expands home-relative repo paths", () => {
  expect(copyableRepoPath(row("~/repo"))).toBe(join(homedir(), "repo"));
});

test("does not copy tmux session rows", () => {
  expect(
    copyableRepoPath({
      ...row(""),
      target: { display: "tms", path: "", sessionName: "tms", kind: "session" },
    }),
  ).toBeUndefined();
});

function row(path: string): Row {
  return {
    label: "repo",
    filterText: "repo",
    id: `repo:${path}`,
    depth: 0,
    target: {
      display: "repo",
      path,
      sessionName: "repo",
      kind: "repo",
    },
  };
}
