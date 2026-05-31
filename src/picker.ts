import { copyToClipboard } from "./clipboard";
import { copyableRepoPath } from "./copy-path";
import { filterRows } from "./filter";
import { parseKeys } from "./picker-keys";
import type { PickerTab, Row, Target } from "./types";
import { createRenderer, restoreTerminal, setupTerminal } from "./ui/opentui";
import { drawBootstrapPicker, drawPicker, listHeight } from "./ui/picker-view";

type TabState = {
  loading: boolean;
  loaded: boolean;
  rows: Row[];
  visibleRows: Row[];
  query: string;
  selectedIndex: number;
  scrollOffset: number;
};

export async function pickTarget(
  loadRepos: () => Promise<Row[]>,
  loadSessions: () => Promise<Row[]>,
  defaultTab: PickerTab = "repos",
): Promise<Target | undefined> {
  setupTerminal();
  drawBootstrapPicker(defaultTab);

  let renderer: Awaited<ReturnType<typeof createRenderer>>;
  try {
    renderer = await createRenderer();
  } catch (error) {
    restoreTerminal();
    throw error;
  }

  const stdin = process.stdin;
  const wasRaw = stdin.isRaw;
  let settled = false;
  let activeTab = defaultTab;
  let statusMessage = "";
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  const tabs: Record<PickerTab, TabState> = {
    repos: createTabState(defaultTab === "repos"),
    sessions: createTabState(defaultTab === "sessions"),
  };

  return new Promise((resolveTarget, rejectTarget) => {
    const restoreForSignal = () => finish();

    const finish = (target?: Target, error?: unknown) => {
      if (settled) return;
      settled = true;
      let cleanupError: unknown;
      const cleanup = (step: () => void) => {
        try {
          step();
        } catch (error) {
          cleanupError ??= error;
        }
      };

      process.off("SIGWINCH", resize);
      process.off("SIGINT", restoreForSignal);
      process.off("SIGTERM", restoreForSignal);
      if (statusTimer) {
        clearTimeout(statusTimer);
      }
      stdin.off("data", handleInput);
      if (stdin.setRawMode) {
        cleanup(() => stdin.setRawMode(Boolean(wasRaw)));
      }
      cleanup(() => stdin.pause());
      cleanup(() => renderer.destroy());
      cleanup(restoreTerminal);

      if (error) {
        rejectTarget(error);
      } else if (cleanupError) {
        rejectTarget(cleanupError);
      } else {
        resolveTarget(target);
      }
    };

    const draw = () => {
      syncScrollOffset();
      const tab = currentTab();
      drawPicker({
        renderer,
        query: tab.query,
        visibleRows: tab.visibleRows,
        selectedIndex: tab.selectedIndex,
        scrollOffset: tab.scrollOffset,
        loading: tab.loading,
        activeTab,
        statusMessage,
      });
    };

    const updateList = () => {
      const tab = currentTab();
      tab.visibleRows = filterRows(tab.rows, tab.query);
      tab.selectedIndex = 0;
      tab.scrollOffset = 0;
      draw();
    };

    const moveSelection = (delta: number) => {
      const tab = currentTab();
      if (tab.visibleRows.length === 0 || tab.loading) return;
      tab.selectedIndex = Math.max(0, Math.min(tab.selectedIndex + delta, tab.visibleRows.length - 1));
      draw();
    };

    const selectCurrent = () => {
      const tab = currentTab();
      if (tab.loading) return;
      finish(tab.visibleRows[tab.selectedIndex]?.target);
    };

    const switchTab = () => {
      activeTab = activeTab === "repos" ? "sessions" : "repos";
      const tab = currentTab();
      if (!tab.loaded && !tab.loading) {
        loadTab(activeTab, loaderForTab(activeTab));
      }
      draw();
    };

    const setStatus = (message: string) => {
      statusMessage = message;
      draw();

      if (statusTimer) {
        clearTimeout(statusTimer);
      }

      statusTimer = setTimeout(() => {
        if (settled || statusMessage !== message) return;
        statusMessage = "";
        draw();
      }, 1500);
    };

    const copyCurrentPath = () => {
      const tab = currentTab();
      if (tab.loading) return;

      const path = copyableRepoPath(tab.visibleRows[tab.selectedIndex]);
      if (!path) {
        setStatus("No repo path to copy");
        return;
      }

      copyToClipboard(path);
      finish();
    };

    function currentTab() {
      return tabs[activeTab];
    }

    function syncScrollOffset() {
      const tab = currentTab();
      const visibleHeight = listHeight(renderer.height);
      if (tab.selectedIndex < tab.scrollOffset) {
        tab.scrollOffset = tab.selectedIndex;
      } else if (tab.selectedIndex >= tab.scrollOffset + visibleHeight) {
        tab.scrollOffset = tab.selectedIndex - visibleHeight + 1;
      }
      tab.scrollOffset = Math.max(0, Math.min(tab.scrollOffset, Math.max(0, tab.visibleRows.length - visibleHeight)));
    }

    function resize() {
      try {
        renderer.resize();
        draw();
      } catch (error) {
        finish(undefined, error);
      }
    }

    function handleInput(chunk: Buffer) {
      try {
        for (const key of parseKeys(chunk.toString("utf8"))) {
          if (key === "escape" || key === "ctrl-c") {
            finish();
            return;
          }
          if (key === "ctrl-y") {
            copyCurrentPath();
            return;
          }
          if (key === "enter") {
            selectCurrent();
            return;
          }
          if (key === "tab") {
            switchTab();
            continue;
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
            const tab = currentTab();
            tab.query = Array.from(tab.query).slice(0, -1).join("");
            updateList();
            continue;
          }
          if (key.length > 0) {
            currentTab().query += key;
            updateList();
          }
        }
      } catch (error) {
        finish(undefined, error);
      }
    }

    try {
      if (stdin.setRawMode) {
        stdin.setRawMode(true);
      }
      stdin.resume();
      stdin.on("data", handleInput);
      process.on("SIGWINCH", resize);
      process.on("SIGINT", restoreForSignal);
      process.on("SIGTERM", restoreForSignal);
      draw();
    } catch (error) {
      finish(undefined, error);
      return;
    }

    setTimeout(() => {
      if (!settled) {
        loadTab(activeTab, loaderForTab(activeTab));
      }
    }, 0);

    function loadTab(tabName: PickerTab, loadRows: () => Promise<Row[]>) {
      if (settled) return;

      const tab = tabs[tabName];
      try {
        tab.loading = true;
        draw();
      } catch (error) {
        finish(undefined, error);
        return;
      }

      void (async () => {
        try {
          const rows = await loadRows();
          if (settled) return;
          tab.rows = rows;
          tab.visibleRows = filterRows(rows, tab.query);
          tab.loading = false;
          tab.loaded = true;
          tab.selectedIndex = 0;
          tab.scrollOffset = 0;
          draw();
        } catch (error) {
          finish(undefined, error);
        }
      })();
    }
  });

  function loaderForTab(tab: PickerTab) {
    return tab === "repos" ? loadRepos : loadSessions;
  }
}

function createTabState(loading: boolean): TabState {
  return {
    loading,
    loaded: false,
    rows: [],
    visibleRows: [],
    query: "",
    selectedIndex: 0,
    scrollOffset: 0,
  };
}
