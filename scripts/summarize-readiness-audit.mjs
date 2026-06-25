#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const run = spawnSync("npx", ["convex", "run", "reports:seedReadinessAudit"], {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

if (run.status !== 0) {
  process.stderr.write(run.stderr);
  process.exit(run.status ?? 1);
}

let audit;
try {
  audit = JSON.parse(run.stdout);
} catch (error) {
  process.stderr.write(run.stdout);
  process.stderr.write(run.stderr);
  throw new Error(`Unable to parse readiness audit JSON: ${error.message}`);
}

const rows = Array.isArray(audit.rows) ? audit.rows : [];
const slugsWith = (predicate) => rows.filter(predicate).map((row) => row.slug).sort();

const summary = {
  schemaVersion: "soma-reports.readiness-audit-summary.v1",
  total: audit.total,
  declaredReady: audit.declaredReady,
  sampleBackedFormalReady: audit.sampleBackedFormalReady,
  formalEquivalentReady: audit.formalEquivalentReady,
  declaredGapCounts: audit.declaredGapCounts ?? {},
  derivedGapCounts: audit.derivedGapCounts ?? audit.gapCounts ?? {},
  formalFieldPendingSlugs: slugsWith((row) => (row.derivedGaps ?? []).includes("formal_fields_pending")),
  sampleBackedDetailGapSlugs: slugsWith((row) => row.sampleBackedFormalReady && !row.formalEquivalentReady),
  localScaffoldSlugs: slugsWith((row) => !row.sampleBackedFormalReady && row.evidence?.prompt && row.evidence?.localFixture),
  rowsWithMissingReadinessEvidence: slugsWith(
    (row) => !row.evidence?.prompt || !row.evidence?.localFixture || !row.evidence?.outputSections,
  ),
};

console.log(JSON.stringify(summary, null, 2));
