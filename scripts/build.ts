#!/usr/bin/env bun

import { chmodSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import packageJson from "../package.json" with { type: "json" };

type BuildPlatform = "darwin" | "linux" | "windows";
type BuildArch = "x64" | "arm64";

interface BuildTarget {
  platform: BuildPlatform;
  arch: BuildArch;
}

function getHostTarget(): BuildTarget {
  const platform = process.platform === "win32" ? "windows" : process.platform;

  if (platform !== "darwin" && platform !== "linux" && platform !== "windows") {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  if (process.arch !== "x64" && process.arch !== "arm64") {
    throw new Error(`Unsupported architecture: ${process.arch}`);
  }

  return { platform, arch: process.arch };
}

const args = process.argv.slice(2);
const rootDir = resolve(import.meta.dirname, "..");
const distDir = join(rootDir, "dist");
const target = getHostTarget();
const outfile = parseOutfile(args, join(distDir, target.platform === "windows" ? "tms.exe" : "tms"));

if (!args.includes("--no-clean")) {
  rmSync(distDir, { recursive: true, force: true });
}

mkdirSync(dirname(outfile), { recursive: true });

console.log(`Building tms ${packageJson.version} for ${target.platform}-${target.arch}...`);

const result = await Bun.build({
  entrypoints: [join(rootDir, "src", "index.ts")],
  tsconfig: join(rootDir, "tsconfig.json"),
  target: "bun",
  format: "esm",
  minify: args.includes("--minify"),
  sourcemap: args.includes("--sourcemap") ? "external" : "none",
  compile: {
    target: `bun-${target.platform}-${target.arch}` as const,
    outfile,
    execArgv: [`--user-agent=tms/${packageJson.version}`, `--env-file=""`, "--"],
    windows: {},
  },
});

for (const log of result.logs) {
  if (log.level === "error") {
    console.error(log.message);
  } else if (log.level === "warning") {
    console.warn(log.message);
  } else {
    console.log(log.message);
  }
}

if (!result.success) {
  console.error("Build failed.");
  process.exit(1);
}

if (target.platform !== "windows") {
  chmodSync(outfile, 0o755);
}

console.log(`Built ${outfile}`);

function parseOutfile(args: string[], defaultOutfile: string) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--outfile") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --outfile.");
      }
      return value;
    }

    if (arg.startsWith("--outfile=")) {
      const value = arg.slice("--outfile=".length);
      if (!value) {
        throw new Error("Missing value for --outfile.");
      }
      return value;
    }

    if (!arg.startsWith("-")) {
      return arg;
    }
  }

  return defaultOutfile;
}
