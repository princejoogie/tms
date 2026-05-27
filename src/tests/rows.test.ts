import { expect, test } from "bun:test";
import { filterRows } from "../rows";
import type { Row } from "../types";

const target = { display: "", path: "", sessionName: "" };

const rows: Row[] = [
  { label: "ai-landing-vue", filterText: "ai-landing-vue", id: "ai-landing-vue", depth: 0, target },
  { label: "ai-retail-agent", filterText: "ai-retail-agent", id: "ai-retail-agent", depth: 0, target },
  {
    label: "├── develop",
    filterText: "ai-retail-agent develop",
    id: "ai-retail-agent:develop",
    parentId: "ai-retail-agent",
    depth: 1,
    target,
  },
  {
    label: "└── pjuguilon",
    filterText: "ai-retail-agent pjuguilon",
    id: "ai-retail-agent:pjuguilon",
    parentId: "ai-retail-agent",
    depth: 1,
    target,
  },
  { label: "awesome-opentui", filterText: "awesome-opentui", id: "awesome-opentui", depth: 0, target },
];

function runFilter(query: string) {
  return filterRows(rows, query).map((row) => rows.indexOf(row));
}

test("filter 'retail' matches parent and children", () => {
  expect(runFilter("retail")).toEqual([1, 2, 3]);
});

test("filter 'develop' includes parent context before child", () => {
  expect(runFilter("develop")).toEqual([1, 2]);
});

test("filter 'retail develop' includes parent context before child", () => {
  expect(runFilter("retail develop")).toEqual([1, 2]);
});

test("filter 'awesome' matches correctly", () => {
  expect(runFilter("awesome")).toEqual([4]);
});

test("filter fuzzily matches repo names", () => {
  expect(runFilter("lngvue")).toEqual([0]);
});

test("filter fuzzily matches child rows with parent context", () => {
  expect(runFilter("rtdev")).toEqual([1, 2]);
});
