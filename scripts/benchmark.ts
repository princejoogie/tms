#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Bench = {
  name: string;
  command: string;
  warmup?: number;
  runs?: number;
};

const tmpDir = ".tmp/bench";
const benches: Bench[] = [
  { name: "empty compiled process", command: `${tmpDir}/empty`, warmup: 10 },
  { name: "tms help", command: "./dist/tms help", warmup: 10 },
  { name: "tms config --show", command: "./dist/tms config --show", warmup: 10 },
  { name: "picker fixture render+esc", command: `printf "\\033" | ${tmpDir}/picker-fixture`, warmup: 10 },
  { name: "tms picker discovery+render+esc", command: "printf \"\\033\" | ./dist/tms", warmup: 5, runs: 20 },
];

if (!existsSync(tmpDir)) {
  mkdirSync(tmpDir, { recursive: true });
}

writeBenchFixtures();

console.log("Building dist/tms...");
await $`bun run build`;

console.log("Building benchmark fixtures...");
await buildFixture("empty.ts", `${tmpDir}/empty`);
await buildFixture("internals.ts", `${tmpDir}/internals`);
await buildFixture("picker-fixture.ts", `${tmpDir}/picker-fixture`);

console.log("\nFunction timings from compiled internals fixture:");
await $`${tmpDir}/internals`;

console.log("\nProcess timings from built binaries:");
for (const bench of benches) {
  await runHyperfine(bench);
}

async function buildFixture(file: string, outfile: string) {
  const result = await Bun.build({
    entrypoints: [join(tmpDir, file)],
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
}

async function runHyperfine(bench: Bench) {
  console.log(`\n${bench.name}`);
  const args = ["--warmup", String(bench.warmup ?? 5)];
  if (bench.runs) {
    args.push("--runs", String(bench.runs));
  }

  await $`hyperfine ${args} ${bench.command}`;
}

function writeBenchFixtures() {
  writeFileSync(join(tmpDir, "empty.ts"), "\n");
  writeFileSync(
    join(tmpDir, "internals.ts"),
    `import { loadConfig } from "../../src/config";
import { discoverRepos } from "../../src/git";
import { buildRows } from "../../src/rows";
import { filterRows } from "../../src/filter";

const timings: Record<string, number> = {};
let last = performance.now();

function mark(name: string) {
  const now = performance.now();
  timings[name] = Number((now - last).toFixed(3));
  last = now;
}

const config = loadConfig(true);
mark("loadConfig");

const groups = await discoverRepos(config);
mark("discoverRepos");

const rows = buildRows(groups);
mark("buildRows");

filterRows(rows, "");
mark("filterRows(empty)");

filterRows(rows, "retail develop");
mark("filterRows(query)");

console.table(timings);
`,
  );
  writeFileSync(
    join(tmpDir, "picker-fixture.ts"),
    `import { pickTarget } from "../../src/picker";
import type { Row } from "../../src/types";

const rows: Row[] = Array.from({ length: 40 }, (_, index) => ({
  label: index === 0 ? "bench-repo" : \`  bench-repo-\${index}\`,
  filterText: \`bench repo \${index}\`,
  target: { display: \`bench-\${index}\`, path: process.cwd(), sessionName: \`bench_\${index}\` },
  depth: 0,
  branch: index === 0 ? "main" : undefined,
  id: \`bench-\${index}\`,
}));

await pickTarget(async () => rows);
`,
  );
}
