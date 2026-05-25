import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

const rows = [
  { display: "ai-landing-vue", search: "ai-landing-vue" },
  { display: "ai-retail-agent", search: "ai-retail-agent" },
  { display: "├── develop", search: "ai-retail-agent develop" },
  { display: "└── pjuguilon", search: "ai-retail-agent pjuguilon" },
  { display: "awesome-opentui", search: "awesome-opentui" },
];

const input = rows
  .map((row, index) => {
    const paddedDisplay = row.display.padEnd(800, " ");
    return `${paddedDisplay}${row.search}\t${index}`;
  })
  .join("\n");

function runFilter(query: string) {
  const result = spawnSync(
    "fzf",
    [
      "--reverse",
      "--no-sort",
      "--no-hscroll",
      "--delimiter",
      "\t",
      "--with-nth",
      "1",
      "-f",
      query,
    ],
    { input, encoding: "utf8" }
  );

  return result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => Number(line.split("\t").at(-1)));
}

test("fzf filter 'retail' matches parent and children", () => {
  expect(runFilter("retail")).toEqual([1, 2, 3]);
});

test("fzf filter 'develop' matches only child", () => {
  expect(runFilter("develop")).toEqual([2]);
});

test("fzf filter 'retail develop' matches only child", () => {
  expect(runFilter("retail develop")).toEqual([2]);
});

test("fzf filter 'awesome' matches correctly", () => {
  expect(runFilter("awesome")).toEqual([4]);
});
