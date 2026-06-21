#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const batchSize = Number(process.env.SOMA_SEED_BATCH_SIZE ?? 25);

if (!Number.isInteger(batchSize) || batchSize <= 0) {
  throw new Error("SOMA_SEED_BATCH_SIZE must be a positive integer");
}

const parseJsonTail = (text) => {
  const match = text.match(/\{[\s\S]*\}\s*$/);
  if (!match) {
    throw new Error(`Could not parse Convex JSON output:\n${text}`);
  }
  return JSON.parse(match[0]);
};

const runSeed = (args) => {
  const run = spawnSync("npx", ["convex", "run", "reports:seedDefaults", JSON.stringify(args)], {
    encoding: "utf8",
  });

  if (run.status !== 0) {
    throw new Error(run.stderr.trim() || run.stdout.trim() || `convex run exited with ${run.status}`);
  }

  return parseJsonTail(run.stdout);
};

const batches = [];
let start = 0;
let total = null;

while (total === null || start < total) {
  const result = runSeed({ start, limit: batchSize, pruneStale: false });
  batches.push(result);
  total = result.total;
  start += result.seeded;

  if (result.seeded === 0) {
    break;
  }
}

const prune = runSeed({ start: total ?? 0, limit: 0, pruneStale: true });

console.log(
  JSON.stringify(
    {
      ok: true,
      batchSize,
      total,
      batches: batches.length,
      seeded: batches.reduce((sum, batch) => sum + batch.seeded, 0),
      pruned: prune.pruned,
      updatedAt: prune.updatedAt,
    },
    null,
    2,
  ),
);
