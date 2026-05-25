# tms (Tmux Sessionizer)

[![Release](https://github.com/princejoogie/tms/actions/workflows/release.yml/badge.svg)](https://github.com/princejoogie/tms/actions/workflows/release.yml)

A blazing fast, zero-dependency (other than `fzf` and `tmux`) sessionizer written in [Bun](https://bun.sh/) and TypeScript. `tms` smartly discovers your Git repositories and automatically groups Git Worktrees underneath their parent repository, keeping your session switcher clean and organized.

## Features

- 🌳 **Worktree Aware:** Groups `git worktree` instances directly under their parent repository in the fuzzy finder.
- 🚀 **Blazing Fast:** Written in TypeScript and compiled to a single native binary using Bun.
- 🔍 **Smart Discovery:** Respects `.gitignore` rules (skipping common noisy folders like `node_modules/`, `dist/`, `.next/`) to heavily optimize the repository walk.
- 🛡️ **Tmux Integration:** Safely creates new detached sessions or attaches to existing ones, and intelligently uses `switch-client` if you are already inside tmux.
- ⚙️ **Simple Config:** JSON-based configuration mapping your preferred repository roots and search depth.

## Installation

### From GitHub Releases (Pre-compiled Binaries)

Head over to the [Releases](https://github.com/princejoogie/tms/releases) page and download the pre-compiled binary for your architecture (macOS or Linux).

```sh
chmod +x tms-darwin-arm64
mv tms-darwin-arm64 ~/.local/bin/tms
```

### Build from Source

You will need [Bun](https://bun.sh/) installed on your system.

```sh
git clone https://github.com/princejoogie/tms.git
cd tms
bun install
bun run build
ln -sf "$PWD/dist/tms" ~/.local/bin/tms
```

Make sure `~/.local/bin` is in your `$PATH`.

## Configuration

Before using `tms` for the first time, you must tell it where your repositories live.

Configure your search paths (comma or space-separated):

```sh
tms config -p ~/dotfiles,~/Documents/codes/personal,~/Documents/codex/github
```

You can optionally configure the directory search depth (default is `5`):

```sh
tms config -d 5
```

You can also explicitly exclude certain noisy directories from being crawled (defaults cover common ones like `node_modules`, `dist`, `.next`, etc.):

```sh
tms config --excluded vendor build .cache
```

*Note: The configuration is stored at `~/.config/tms/config.json` by default. You can override this location using the `TMS_CONFIG_FILE` environment variable.*

## Usage

Simply run `tms` in your terminal to open the fuzzy finder:

```sh
tms
```

You can also print the discovered repository tree without opening `fzf` (useful for debugging):

```sh
tms list
```

## Contributing

Contributions are welcome!

```sh
# Run typechecking
bunx tsc --noEmit

# Run tests
bun test

# Run directly without compiling
bun run dev
```

## License

MIT
