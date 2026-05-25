import {
  BoxRenderable,
  createCliRenderer,
  fg,
  InputRenderable,
  InputRenderableEvents,
  StyledText,
  TextRenderable,
  t,
  type KeyEvent,
} from "@opentui/core";
import type { Row, Target } from "./types";
import { filterRows } from "./rows";

const THEME = {
  text: "#eeeeee",
  textMuted: "#808080",
  primary: "#fab283",
  backgroundElement: "#1e1e1e",
  border: "#484848",
  borderActive: "#606060",
};

export async function pickTarget(rows: Row[]): Promise<Target | undefined> {
  const renderer = await createCliRenderer({ exitOnCtrlC: true, targetFps: 30 });

  return new Promise((resolveTarget) => {
    let settled = false;
    let visibleRows = filterRows(rows, "");
    let selectedIndex = 0;
    let scrollOffset = 0;
    let visibleHeight = 1;
    const rowRenderables: TextRenderable[] = [];

    const finish = (target?: Target) => {
      if (settled) return;
      settled = true;
      renderer.destroy();
      resolveTarget(target);
    };

    const inputBox = new BoxRenderable(renderer, {
      id: "input-box",
      position: "absolute",
      left: 1,
      top: 1,
      width: "auto",
      height: 3,
      border: true,
      borderStyle: "single",
      borderColor: THEME.border,
      focusedBorderColor: THEME.borderActive,
    });

    const input = new InputRenderable(renderer, {
      id: "filter-input",
      position: "absolute",
      left: 2,
      top: 2,
      width: "auto",
      placeholder: "Filter repositories and worktrees...",
      textColor: THEME.text,
      focusedTextColor: THEME.text,
      placeholderColor: THEME.textMuted,
      cursorColor: THEME.primary,
    });

    const footer = new TextRenderable(renderer, {
      id: "footer",
      content: "type to filter | enter to open | esc to cancel | ctrl+n/ctrl+p or arrows to move",
      position: "absolute",
      left: 2,
      top: renderer.height - 2,
      width: "auto",
      height: 1,
      fg: THEME.textMuted,
    });

    const syncScrollOffset = () => {
      if (selectedIndex < scrollOffset) {
        scrollOffset = selectedIndex;
      } else if (selectedIndex >= scrollOffset + visibleHeight) {
        scrollOffset = selectedIndex - visibleHeight + 1;
      }
      scrollOffset = Math.max(0, Math.min(scrollOffset, Math.max(0, visibleRows.length - visibleHeight)));
    };

    const updateRows = () => {
      syncScrollOffset();
      const width = Math.max(20, renderer.width - 2);

      for (let index = 0; index < visibleHeight; index += 1) {
        const row = visibleRows[scrollOffset + index];
        let line = rowRenderables[index];
        if (!line) {
          line = new TextRenderable(renderer, {
            id: `row-${index}`,
            content: "",
            position: "absolute",
            left: 1,
            top: 5 + index,
            width,
            height: 1,
          });
          rowRenderables[index] = line;
          renderer.root.add(line);
        }

        line.top = 5 + index;
        line.width = width;

        if (!row) {
          line.content = "";
          continue;
        }

        const selected = scrollOffset + index === selectedIndex;
        line.content = formatRow(row, selected, width);
      }
    };

    const updateLayout = () => {
      const width = Math.max(20, renderer.width - 2);
      inputBox.width = width;
      input.width = Math.max(1, width - 2);
      visibleHeight = Math.max(1, renderer.height - 7);
      footer.top = Math.max(0, renderer.height - 2);
      footer.width = width;
      updateRows();
    };

    const updateList = (query: string) => {
      visibleRows = filterRows(rows, query);
      selectedIndex = 0;
      scrollOffset = 0;
      updateRows();
    };

    const moveSelection = (delta: number) => {
      if (visibleRows.length === 0) return;
      selectedIndex = Math.max(0, Math.min(selectedIndex + delta, visibleRows.length - 1));
      updateRows();
    };

    const selectCurrent = () => {
      finish(visibleRows[selectedIndex]?.target);
    };

    input.on(InputRenderableEvents.INPUT, updateList);
    input.on(InputRenderableEvents.ENTER, selectCurrent);

    const handleKeyPress = (key: KeyEvent) => {
      if (key.name === "escape") {
        finish();
        return;
      }
      if (key.name === "return" || key.name === "linefeed") {
        selectCurrent();
        return;
      }
      if (key.ctrl && (key.name === "n" || key.name === "j")) {
        moveSelection(1);
      } else if (key.ctrl && (key.name === "p" || key.name === "k")) {
        moveSelection(-1);
      } else if (key.name === "down" || key.name === "j") {
        moveSelection(1);
      } else if (key.name === "up" || key.name === "k") {
        moveSelection(-1);
      }
    };

    renderer.keyInput.on("keypress", handleKeyPress);
    renderer.on("resize", updateLayout);
    renderer.root.add(inputBox);
    renderer.root.add(input);
    renderer.root.add(footer);
    updateLayout();
    input.focus();
    inputBox.focus();
    renderer.start();
  });
}

function formatRow(row: Row, selected: boolean, width: number): StyledText {
  const marker = selected ? "▶ " : "  ";
  const main = `${marker}${row.label}`;
  const branch = selected && row.depth === 0 && row.branch ? `   ${row.branch}` : "";

  if (selected) {
    const padding = " ".repeat(Math.max(0, width - main.length - branch.length));
    if (branch) {
      return new StyledText([
        { __isChunk: true, text: main, fg: fg(THEME.text)(main).fg, bg: fg(THEME.backgroundElement)(main).fg },
        { __isChunk: true, text: branch, fg: fg(THEME.textMuted)(branch).fg, bg: fg(THEME.backgroundElement)(branch).fg },
        { __isChunk: true, text: padding, fg: fg(THEME.text)(padding).fg, bg: fg(THEME.backgroundElement)(padding).fg },
      ]);
    }

    const text = `${main}${padding}`;
    return new StyledText([{ __isChunk: true, text, fg: fg(THEME.text)(text).fg, bg: fg(THEME.backgroundElement)(text).fg }]);
  }

  if (row.depth === 0 && row.branch) {
    return t`${main}`;
  }

  return t`${main}`;
}
