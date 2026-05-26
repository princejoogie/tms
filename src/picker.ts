import { filterRows } from "./filter";
import { parseKeys } from "./picker-keys";
import type { Row, Target } from "./types";
import { createRenderer, restoreTerminal, setupTerminal } from "./ui/opentui";
import { drawPicker, listHeight } from "./ui/picker-view";

export async function pickTarget(loadRows: () => Promise<Row[]>): Promise<Target | undefined> {
  const renderer = await createRenderer();
  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  let settled = false;
  let loading = true;
  let allRows: Row[] = [];
  let query = "";
  let visibleRows: Row[] = [];
  let selectedIndex = 0;
  let scrollOffset = 0;

  setupTerminal();

  return new Promise((resolveTarget) => {
    const restoreForSignal = () => finish();

    const finish = (target?: Target) => {
      if (settled) return;
      settled = true;
      process.off("SIGWINCH", resize);
      process.off("SIGINT", restoreForSignal);
      process.off("SIGTERM", restoreForSignal);
      stdin.off("data", handleInput);
      if (stdin.setRawMode) {
        stdin.setRawMode(Boolean(wasRaw));
      }
      stdin.pause();
      renderer.destroy();
      restoreTerminal();
      resolveTarget(target);
    };

    const draw = () => {
      syncScrollOffset();
      drawPicker({ renderer, query, visibleRows, selectedIndex, scrollOffset, loading });
    };

    const updateList = () => {
      visibleRows = filterRows(allRows, query);
      selectedIndex = 0;
      scrollOffset = 0;
      draw();
    };

    const moveSelection = (delta: number) => {
      if (visibleRows.length === 0 || loading) return;
      selectedIndex = Math.max(0, Math.min(selectedIndex + delta, visibleRows.length - 1));
      draw();
    };

    const selectCurrent = () => {
      if (loading) return;
      finish(visibleRows[selectedIndex]?.target);
    };

    function syncScrollOffset() {
      const visibleHeight = listHeight(renderer.height);
      if (selectedIndex < scrollOffset) {
        scrollOffset = selectedIndex;
      } else if (selectedIndex >= scrollOffset + visibleHeight) {
        scrollOffset = selectedIndex - visibleHeight + 1;
      }
      scrollOffset = Math.max(0, Math.min(scrollOffset, Math.max(0, visibleRows.length - visibleHeight)));
    }

    function resize() {
      renderer.resize();
      draw();
    }

    function handleInput(chunk: Buffer) {
      for (const key of parseKeys(chunk.toString("utf8"))) {
        if (key === "escape" || key === "ctrl-c") {
          finish();
          return;
        }
        if (key === "enter") {
          selectCurrent();
          return;
        }
        if (key === "down" || key === "ctrl-n" || key === "ctrl-j") {
          moveSelection(1);
          continue;
        }
        if (key === "up" || key === "ctrl-p" || key === "ctrl-k") {
          moveSelection(-1);
          continue;
        }
        if (key === "backspace") {
          query = Array.from(query).slice(0, -1).join("");
          updateList();
          continue;
        }
        if (key.length > 0) {
          query += key;
          updateList();
        }
      }
    }

    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.on("data", handleInput);
    process.on("SIGWINCH", resize);
    process.on("SIGINT", restoreForSignal);
    process.on("SIGTERM", restoreForSignal);
    draw();

    setTimeout(() => {
      loadRows().then(
        (loadedRows) => {
          if (settled) return;
          allRows = loadedRows;
          loading = false;
          updateList();
        },
        (error) => {
          finish();
          throw error;
        },
      );
    }, 0);
  });
}
