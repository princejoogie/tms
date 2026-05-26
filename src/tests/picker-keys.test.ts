import { expect, test } from "bun:test";
import { parseKeys } from "../picker-keys";

test("parses picker navigation keys", () => {
  expect(parseKeys("\x1b[A\x1b[B\x0e\x0a\x10\r\x7f")).toEqual([
    "up",
    "down",
    "ctrl-n",
    "ctrl-j",
    "ctrl-p",
    "enter",
    "backspace",
  ]);
});

test("ignores tmux and terminal capability replies", () => {
  const replies =
    "\x1b]10;rgb:cdcd/d6d6/f4f4\x07" +
    "\x1b]11;rgb:0000/0000/0000\x07" +
    "\x1bP>|tmux 3.6b\x1b\\" +
    "\x1b[11;1R" +
    "\x1b[1;1R" +
    "\x1b[?1016;2$y" +
    "\x1b[?2027;0$y" +
    "\x1b[?2031;1$y" +
    "\x1b[?1004;1$y" +
    "\x1b[?2004;1$y" +
    "\x1b[?2026;2$y";

  expect(parseKeys(`${replies}abc\x1b`)).toEqual(["a", "b", "c", "escape"]);
});
