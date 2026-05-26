---
"tms": minor
---

Add a tabbed OpenTUI picker with separate Repos and Sessions views.

Repos remains the default tab and keeps the existing repository/worktree workflow. Sessions is a new tab that lists existing tmux sessions by name and opens the selected session by switching the current tmux client or attaching from outside tmux.

Add `--tab repos|sessions` and `--tab=repos|sessions` so keybindings can choose the initial view. The `Tab` key cycles between Repos and Sessions inside the picker.

Improve perceived picker startup without repository caching. The picker now renders an immediate lightweight loading frame before OpenTUI native initialization, defers repository discovery until after the first render, and skips config/git/worktree discovery entirely when starting directly on `--tab=sessions` until the user switches to Repos.

Improve picker reliability and polish by fixing raw key parsing so `Ctrl-J` moves down instead of selecting the current row, preserving stale terminal replies from becoming input, keeping cursor positioning stable, and showing only tmux session names in the Sessions tab.

Refactor the picker implementation into smaller UI modules, centralize build compilation through `scripts/build.ts`, and add reusable benchmark coverage for built binaries and picker startup paths.
