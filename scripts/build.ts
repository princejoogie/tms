#!/usr/bin/env bun

export {};

const outfile = parseOutfile(process.argv.slice(2));

const result = await Bun.build({
  entrypoints: ["src/index.ts"],
  compile: {
    outfile,
    autoloadDotenv: false,
    autoloadBunfig: false,
  },
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

function parseOutfile(args: string[]) {
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

  return "dist/tms";
}
