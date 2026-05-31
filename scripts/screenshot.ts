#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

const rootDir = resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const out = valueFor("--out") ?? join(rootDir, "docs", "screenshots", "tms-picker");
const cols = valueFor("--cols") ?? "100";
const rows = valueFor("--rows") ?? "28";
const waitFor = valueFor("--wait-for") ?? "cookmu";
const demoPath = valueFor("--path") ?? resolve(rootDir, "..");
const configPath = join(rootDir, ".tmp", "cellshot", "config.json");
const binaryPath = join(rootDir, "dist", process.platform === "win32" ? "tms.exe" : "tms");

function valueFor(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index >= 0) return args[index + 1];

  const prefix = `${flag}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function run(cmd: readonly string[], options: { env?: NodeJS.ProcessEnv } = {}): void {
  const proc = Bun.spawnSync({
    cmd: [...cmd],
    cwd: rootDir,
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, ...options.env },
  });

  if (proc.exitCode !== 0) {
    throw new Error(`Command failed (${proc.exitCode}): ${cmd.join(" ")}`);
  }
}

function assertCellshotInstalled(): void {
  const proc = Bun.spawnSync({ cmd: ["cellshot", "--version"], stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) {
    throw new Error(
      "cellshot is required. Install it with `cargo install --locked --git https://github.com/kitlangton/cellshot cellshot`.",
    );
  }
}

assertCellshotInstalled();
mkdirSync(dirname(configPath), { recursive: true });
mkdirSync(dirname(out), { recursive: true });

writeFileSync(
  configPath,
  `${JSON.stringify(
    {
      paths: [demoPath],
      depth: 1,
      excluded: [".git", "dist", "node_modules", "target", ".tmp"],
    },
    null,
    2,
  )}\n`,
);

run(["bun", "run", "build"]);
run(
  [
    "cellshot",
    "save",
    "--host",
    "opentui",
    "--cols",
    cols,
    "--rows",
    rows,
    "--wait-for",
    waitFor,
    "--deadline-ms",
    "10000",
    "--format",
    "png",
    "--out",
    out,
    "--",
    binaryPath,
  ],
  { env: { TMS_CONFIG_FILE: configPath } },
);

console.log(`Saved ${out}.png`);
