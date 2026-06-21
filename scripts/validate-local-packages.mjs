#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

const fixturesDir = "fixtures/synthetic";
const outDir = "tmp/agent-bundles";
const fixtureSuffix = ".fixture.json";

if (!existsSync(fixturesDir)) {
  throw new Error(`Missing fixture directory: ${fixturesDir}`);
}

mkdirSync(outDir, { recursive: true });

const seedArtifactsPath = join(outDir, "local-artifact-seeds.json");
const seedRun = spawnSync("npx", ["convex", "run", "reports:localArtifactSeeds"], {
  encoding: "utf8",
  maxBuffer: 1024 * 1024 * 20,
});

if (seedRun.status !== 0) {
  throw new Error(
    seedRun.error?.message ||
      seedRun.stderr.trim() ||
      seedRun.stdout.trim() ||
      `reports:localArtifactSeeds exited with ${seedRun.status}`,
  );
}

JSON.parse(seedRun.stdout);
writeFileSync(seedArtifactsPath, seedRun.stdout.endsWith("\n") ? seedRun.stdout : `${seedRun.stdout}\n`);

const packages = readdirSync(fixturesDir)
  .filter((file) => file.endsWith(fixtureSuffix))
  .map((file) => basename(file, fixtureSuffix))
  .sort();

const results = [];

for (const slug of packages) {
  const promptPath = `prompts/${slug}.md`;
  const fixturePath = join(fixturesDir, `${slug}${fixtureSuffix}`);
  const resultPath = join(fixturesDir, `${slug}.result.json`);
  const outPath = join(outDir, `${slug}.validated.json`);

  if (!existsSync(promptPath)) {
    results.push({ slug, ok: false, error: `missing ${promptPath}` });
    continue;
  }

  const args = [
    "scripts/agent-bundle.mjs",
    "--report",
    slug,
    "--fixture",
    fixturePath,
    "--out",
    outPath,
    "--seed-artifacts",
    seedArtifactsPath,
  ];
  if (existsSync(resultPath)) {
    args.push("--result", resultPath);
  }

  const run = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (run.status === 0) {
    const parsed = JSON.parse(run.stdout);
    results.push({
      slug,
      ok: true,
      outPath,
      resultValidated: parsed.resultValidated,
      warnings: parsed.warnings,
      validationSummary: parsed.validationLedger?.summary,
    });
    continue;
  }

  results.push({
    slug,
    ok: false,
    error: run.stderr.trim() || run.stdout.trim() || `validator exited with ${run.status}`,
  });
}

const failed = results.filter((result) => !result.ok);
const summary = {
  ok: failed.length === 0,
  checked: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results,
};

console.log(JSON.stringify(summary, null, 2));

if (failed.length > 0) {
  process.exit(1);
}
