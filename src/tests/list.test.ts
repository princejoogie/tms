import { expect, test } from "bun:test";
import { formatRepoList } from "../list";
import type { RepoGroup } from "../types";

test("formats repos with directories and worktree directories", () => {
  const groups: RepoGroup[] = [
    {
      id: "/repos/zeta",
      name: "zeta",
      path: "/repos/zeta",
      branch: "main",
      worktrees: [],
    },
    {
      id: "/repos/alpha",
      name: "alpha",
      path: "/repos/alpha",
      branch: "main",
      worktrees: [
        {
          path: "/worktrees/alpha-feature",
          branch: "feature",
          bare: false,
          detached: false,
          prunable: false,
        },
        {
          path: "/worktrees/alpha-detached",
          head: "1234567890abcdef",
          bare: false,
          detached: true,
          prunable: false,
        },
      ],
    },
  ];

  expect(formatRepoList(groups)).toBe(
    [
      "alpha",
      "  directory: /repos/alpha",
      "  worktrees:",
      "    12345678: /worktrees/alpha-detached",
      "    feature: /worktrees/alpha-feature",
      "",
      "zeta",
      "  directory: /repos/zeta",
    ].join("\n"),
  );
});
