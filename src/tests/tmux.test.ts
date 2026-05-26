import { expect, test } from "bun:test";
import { parseTmuxSessionRows } from "../tmux";

test("parses tmux sessions without leaking field metadata", () => {
  const rows = parseTmuxSessionRows("tms\norch\n");

  expect(rows.map((row) => row.label)).toEqual(["tms", "orch"]);
  expect(rows.map((row) => row.target.sessionName)).toEqual(["tms", "orch"]);
});
