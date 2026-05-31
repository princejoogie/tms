# Repo Workflows

These are the repository workflow conventions for `tms` as a private CLI with standalone release assets.

## Scripts

- `bun run check`: full local verification pipeline.
- `bun run typecheck`: TypeScript gate.
- `bun run test`: Bun tests.
- `bun run package:smoke`: builds the binary and checks `--help`/`--version`.
- `bun run build:standalone`: creates release tarballs and `.sha256` files for the current or requested target.
- `bun run screenshot`: builds `tms` and captures a PNG/TXT terminal screenshot with Cellshot.

Run `bun run check` before handing off substantial changes.

## Release Assets

`scripts/release-targets.ts` defines supported standalone targets:

- `darwin-arm64`
- `darwin-x64`
- `linux-arm64`
- `linux-x64`

`scripts/build-standalone.ts` builds a Bun-compiled `tms`, archives it as `tms-<target>.tar.gz`, and writes matching SHA-256 files.

Examples:

```sh
bun run build:standalone
bun run build:standalone -- linux-x64
bun run build:standalone -- all
```

## Terminal Screenshots

`bun run screenshot` uses [Cellshot](https://github.com/kitlangton/cellshot) to capture the real OpenTUI terminal output into `docs/screenshots/tms-picker.png`.

Install Cellshot first if it is not already available:

```sh
cargo install --locked --git https://github.com/kitlangton/cellshot cellshot
```

The screenshot script writes an isolated config under `.tmp/cellshot/config.json` so captures do not depend on a user's personal `~/.config/tms/config.json`.

Override the default capture shape or repo root if needed:

```sh
bun run screenshot -- --cols 120 --rows 34 --path /Users/pjuguilon/Documents/codes/personal --out docs/screenshots/wide-picker
```

## CI

`.github/workflows/ci.yml` runs:

1. `bun install --frozen-lockfile`
2. `bun run typecheck`
3. `bun run test`
4. `bun run package:smoke`

Keep CI aligned with `bun run check`.

## Publishing

`.github/workflows/release.yml` uses Changesets to open version PRs and creates a GitHub Release when `package.json` changes on `main`.

`.github/workflows/publish.yml` runs when a GitHub Release is published. It verifies the tag matches `package.json`, builds standalone assets for every supported target, uploads each tarball and `.sha256`, and can optionally dispatch Homebrew checksum updates with the `tms-release` event.

## Changesets

`.changeset/` is present for release notes/versioning.

Use:

```sh
bun run changeset
bun run changeset:status
bun run changeset:version
```

Because `tms` is private, Changesets are a convention for release discipline rather than npm publishing.
