# Repo Workflows

These are the repository workflow conventions for `tms` as a private CLI with standalone release assets.

## Scripts

- `bun run check`: full local verification pipeline.
- `bun run typecheck`: TypeScript gate.
- `bun run test`: Bun tests.
- `bun run package:smoke`: builds the binary and checks `--help`/`--version`.
- `bun run build:standalone`: creates release tarballs and `.sha256` files for the current or requested target.

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
