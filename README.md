# tms

A small Bun/TypeScript tmux sessionizer that groups Git worktrees under their parent repository.

## Usage

Configure search paths:

```sh
tms config -p ~/dotfiles,~/Documents/codes/personal,~/Documents/codex/github
```

Optionally set search depth:

```sh
tms config -d 2
```

Open the picker:

```sh
tms
```

Print the tree without opening `fzf`:

```sh
tms list
```

Repository discovery skips configured excluded directory names and simple directory-name entries from `.gitignore` files encountered while walking, such as `node_modules/`, `.next/`, and `dist/`.

Build a single executable:

```sh
bun run build
```

The config is stored at `~/.config/tms/config.json` unless `TMS_CONFIG_FILE` is set.
