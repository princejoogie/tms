# tms

## 0.3.1

### Patch Changes

- Use the real repos-list Cellshot capture as the README demo image and remove the unused text screenshot artifact from the screenshot workflow.

## 0.3.0

### Minor Changes

- Add orch-style private CLI packaging and release workflows with standalone tarball assets, SHA-256 checksums, package smoke tests, CI verification, and `tms --version` support.

- Add repo path copy support from the picker with `Ctrl-Y` and regression coverage for copyable repo/worktree paths.

## 0.2.0

### Minor Changes

- [`d8291f5`](https://github.com/princejoogie/tms/commit/d8291f58ef89dbad16c869008281ef330ffd2c61) Thanks [@princejoogie](https://github.com/princejoogie)! - Add a tabbed OpenTUI picker with separate Repos and Sessions views.

  Repos remains the default tab and keeps the existing repository/worktree workflow. Sessions is a new tab that lists existing tmux sessions by name and opens the selected session by switching the current tmux client or attaching from outside tmux.

  Add `--tab repos|sessions` and `--tab=repos|sessions` so keybindings can choose the initial view. The `Tab` key cycles between Repos and Sessions inside the picker.

  Improve perceived picker startup without repository caching. The picker now renders an immediate lightweight loading frame before OpenTUI native initialization, defers repository discovery until after the first render, and skips config/git/worktree discovery entirely when starting directly on `--tab=sessions` until the user switches to Repos.

  Improve picker reliability and polish by fixing raw key parsing so `Ctrl-J` moves down instead of selecting the current row, preserving stale terminal replies from becoming input, keeping cursor positioning stable, and showing only tmux session names in the Sessions tab.

  Refactor the picker implementation into smaller UI modules, centralize build compilation through `scripts/build.ts`, and add reusable benchmark coverage for built binaries and picker startup paths.

### Patch Changes

- [`f43c282`](https://github.com/princejoogie/tms/commit/f43c2823b2415a6738d8c425be80bd22353cc2c3) Thanks [@princejoogie](https://github.com/princejoogie)! - Add fuzzy subsequence matching to picker filtering while preserving parent/child row context.

  Improve picker error handling so async loader, render, resize, setup, and cleanup failures restore the terminal and surface the original error instead of exiting as a cancelled selection.

## 0.1.4

### Patch Changes

- [#8](https://github.com/princejoogie/tms/pull/8) [`ac06fbc`](https://github.com/princejoogie/tms/commit/ac06fbc05c48299995c471ff5c9712e1268708fb) Thanks [@princejoogie](https://github.com/princejoogie)! - Improve picker startup without repository caching by rendering a loading UI before discovery, moving OpenTUI drawing helpers under `src/ui`, and centralizing binary builds in `scripts/build.ts`. Fix raw picker key parsing so `Ctrl-J` cycles down the list instead of selecting the current item.

## 0.1.3

### Patch Changes

- [#6](https://github.com/princejoogie/tms/pull/6) [`0ba7a98`](https://github.com/princejoogie/tms/commit/0ba7a98acfc8bd4d78628178b96ae2fa2593a394) Thanks [@princejoogie](https://github.com/princejoogie)! - Test GitHub release asset builds for native runners.

## 0.1.2

### Patch Changes

- [#4](https://github.com/princejoogie/tms/pull/4) [`dfd7049`](https://github.com/princejoogie/tms/commit/dfd70492dc73318b37104e727b49263b62937144) Thanks [@princejoogie](https://github.com/princejoogie)! - Test the native release asset workflow for patch releases.

## 0.1.1

### Patch Changes

- [#2](https://github.com/princejoogie/tms/pull/2) [`59ec9a6`](https://github.com/princejoogie/tms/commit/59ec9a6eda3fec8b0bb7c6a257e02141af9a9bee) Thanks [@princejoogie](https://github.com/princejoogie)! - Build release binaries on native GitHub Actions runners for each supported platform.
