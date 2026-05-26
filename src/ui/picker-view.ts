import type { Row } from "../types";
import { type NativeRenderer, positionCursor, rgba } from "./opentui";

export const ROWS_TOP = 4;

const THEME = {
  text: rgba("#eeeeee"),
  textMuted: rgba("#808080"),
  background: rgba("#000000"),
  backgroundElement: rgba("#1e1e1e"),
  borderActive: rgba("#606060"),
};

export function drawPicker(input: {
  renderer: NativeRenderer;
  query: string;
  visibleRows: Row[];
  selectedIndex: number;
  scrollOffset: number;
  loading: boolean;
}) {
  const { renderer, query, visibleRows, selectedIndex, scrollOffset, loading } = input;
  const visibleHeight = listHeight(renderer.height);
  renderer.clear(THEME.background);
  drawInput(renderer, query);
  drawRows(renderer, visibleHeight, visibleRows, selectedIndex, scrollOffset, loading);
  drawFooter(renderer);
  renderer.render();
  positionInputCursor(renderer.width, query);
}

export function listHeight(height: number) {
  return Math.max(1, height - ROWS_TOP - 1);
}

export function fit(text: string, width: number) {
  if (width <= 0) return "";

  if (text.length <= width) {
    return text;
  }

  const chars = Array.from(text);
  if (chars.length <= width) {
    return text;
  }

  if (width === 1) {
    return "…";
  }

  return `${chars.slice(0, width - 1).join("")}…`;
}

function drawInput(renderer: NativeRenderer, query: string) {
  const innerWidth = Math.max(0, renderer.width - 2);
  renderer.drawText(0, 0, `┌${"─".repeat(innerWidth)}┐`, THEME.borderActive, THEME.background);
  renderer.drawText(0, 1, "│", THEME.borderActive, THEME.background);
  renderer.drawText(Math.max(0, renderer.width - 1), 1, "│", THEME.borderActive, THEME.background);
  renderer.drawText(0, 2, `└${"─".repeat(innerWidth)}┘`, THEME.borderActive, THEME.background);

  const value = query || "Filter repositories and worktrees...";
  renderer.drawText(2, 1, fit(value, Math.max(0, renderer.width - 4)), query ? THEME.text : THEME.textMuted, THEME.background);
}

function drawRows(
  renderer: NativeRenderer,
  height: number,
  visibleRows: Row[],
  selectedIndex: number,
  scrollOffset: number,
  loading: boolean,
) {
  if (loading) {
    renderer.drawText(1, ROWS_TOP, "Discovering repositories...", THEME.textMuted, THEME.background);
    return;
  }

  if (visibleRows.length === 0) {
    renderer.drawText(1, ROWS_TOP, "No matches", THEME.textMuted, THEME.background);
    return;
  }

  for (let index = 0; index < height; index += 1) {
    const row = visibleRows[scrollOffset + index];
    if (!row) break;

    const selected = scrollOffset + index === selectedIndex;
    const marker = selected ? "▶ " : "  ";
    const main = `${marker}${row.label}`;
    const branch = selected && row.depth === 0 && row.branch ? `   ${row.branch}` : "";
    const y = ROWS_TOP + index;

    if (!selected) {
      renderer.drawText(0, y, fit(main, renderer.width), THEME.text, THEME.background);
      continue;
    }

    renderer.fillRect(0, y, renderer.width, 1, THEME.backgroundElement);
    const branchWidth = branch.length;
    const mainWidth = Math.max(0, renderer.width - branchWidth);
    renderer.drawText(0, y, fit(main, mainWidth), THEME.text, THEME.backgroundElement);
    if (branch) {
      renderer.drawText(Math.max(0, renderer.width - branchWidth), y, fit(branch, branchWidth), THEME.textMuted, THEME.backgroundElement);
    }
  }
}

function drawFooter(renderer: NativeRenderer) {
  renderer.drawText(
    1,
    Math.max(0, renderer.height - 1),
    fit("type to filter | enter to open | esc to cancel | ctrl+n/ctrl+p or arrows to move", Math.max(0, renderer.width - 2)),
    THEME.textMuted,
    THEME.background,
  );
}

function positionInputCursor(width: number, query: string) {
  const cursorColumn = 3 + Math.min(query.length, Math.max(0, width - 4));
  positionCursor(2, cursorColumn);
}
