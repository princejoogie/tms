import type { PickerTab, Row } from "../types";
import { type NativeRenderer, positionCursor, rgba, terminalHeight, terminalWidth } from "./opentui";

export const ROWS_TOP = 4;

const HELP_TEXT = "tab to switch | enter to open | ctrl+y to copy path | esc to cancel | ctrl+n/ctrl+p or arrows to move";

const THEME = {
  text: rgba("#eeeeee"),
  textMuted: rgba("#808080"),
  background: rgba("#000000"),
  backgroundElement: rgba("#1e1e1e"),
  borderActive: rgba("#606060"),
};

export function drawBootstrapPicker(activeTab: PickerTab) {
  const width = terminalWidth();
  const height = terminalHeight();
  const innerWidth = Math.max(0, width - 2);
  const label = activeTab === "repos" ? "Discovering repositories..." : "Loading tmux sessions...";
  const help = fit(HELP_TEXT, Math.max(0, width - 2));
  const footerY = Math.max(1, height - 1);

  process.stdout.write(
    [
      "\x1b[2J\x1b[H",
      `\x1b[37m┌${"─".repeat(innerWidth)}┐\x1b[0m`,
      `\x1b[2;1H\x1b[37m│\x1b[0m\x1b[2;${width}H\x1b[37m│\x1b[0m`,
      `\x1b[3;1H\x1b[37m└${"─".repeat(innerWidth)}┘\x1b[0m`,
      `\x1b[2;3H\x1b[90mFilter...\x1b[0m`,
      `\x1b[${ROWS_TOP + 1};2H\x1b[90m${fit(label, Math.max(0, width - 2))}\x1b[0m`,
      `\x1b[${Math.max(1, footerY - 1)};2H\x1b[90m${help}\x1b[0m`,
      `\x1b[${footerY};2H${activeTab === "repos" ? "\x1b[37;40m" : "\x1b[90m"} Repos \x1b[0m`,
      `\x1b[${footerY};11H${activeTab === "sessions" ? "\x1b[37;40m" : "\x1b[90m"} Sessions \x1b[0m`,
    ].join(""),
  );
}

export function drawPicker(input: {
  renderer: NativeRenderer;
  query: string;
  visibleRows: Row[];
  selectedIndex: number;
  scrollOffset: number;
  loading: boolean;
  activeTab: PickerTab;
  statusMessage?: string;
}) {
  const { renderer, query, visibleRows, selectedIndex, scrollOffset, loading, activeTab, statusMessage } = input;
  const visibleHeight = listHeight(renderer.height);
  renderer.clear(THEME.background);
  drawInput(renderer, query);
  drawRows(renderer, visibleHeight, visibleRows, selectedIndex, scrollOffset, loading, activeTab);
  drawTabs(renderer, activeTab, statusMessage);
  renderer.render();
  positionInputCursor(renderer.width, query);
}

export function listHeight(height: number) {
  return Math.max(1, height - ROWS_TOP - 2);
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

  const value = query || "Filter...";
  renderer.drawText(2, 1, fit(value, Math.max(0, renderer.width - 4)), query ? THEME.text : THEME.textMuted, THEME.background);
}

function drawRows(
  renderer: NativeRenderer,
  height: number,
  visibleRows: Row[],
  selectedIndex: number,
  scrollOffset: number,
  loading: boolean,
  activeTab: PickerTab,
) {
  if (loading) {
    const label = activeTab === "repos" ? "Discovering repositories..." : "Loading tmux sessions...";
    renderer.drawText(1, ROWS_TOP, label, THEME.textMuted, THEME.background);
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

function drawTabs(renderer: NativeRenderer, activeTab: PickerTab, statusMessage = "") {
  const y = Math.max(0, renderer.height - 1);
  renderer.drawText(1, Math.max(0, y - 1), fit(statusMessage || HELP_TEXT, Math.max(0, renderer.width - 2)), THEME.textMuted, THEME.background);
  drawTab(renderer, 1, y, "Repos", activeTab === "repos");
  drawTab(renderer, 10, y, "Sessions", activeTab === "sessions");
}

function drawTab(renderer: NativeRenderer, x: number, y: number, label: string, active: boolean) {
  const text = active ? ` ${label} ` : ` ${label} `;
  const bg = active ? THEME.backgroundElement : THEME.background;
  const fg = active ? THEME.text : THEME.textMuted;
  renderer.drawText(x, y, text, fg, bg);
}

function positionInputCursor(width: number, query: string) {
  const cursorColumn = 3 + Math.min(query.length, Math.max(0, width - 4));
  positionCursor(2, cursorColumn);
}
