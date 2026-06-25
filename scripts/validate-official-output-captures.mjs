#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import {
  officialOutputCaptureSchema,
  slugFromOfficialOutputCapturePath,
  validateOfficialOutputCaptureArtifact,
} from "./lib/official-output-capture-validator.mjs";

const parseArgs = () => {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const next = process.argv[index + 1];
    if (next && !next.startsWith("--")) {
      const existing = args.get(arg);
      args.set(arg, existing === undefined ? next : Array.isArray(existing) ? [...existing, next] : [existing, next]);
      index += 1;
    } else {
      args.set(arg, "true");
    }
  }
  return args;
};

const asArray = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const args = parseArgs();
const explicitPaths = asArray(args.get("--path"));
const catalogDir = args.get("--dir") ?? "reference/catalog";

const discoveredPaths = existsSync(catalogDir)
  ? readdirSync(catalogDir)
      .filter((file) => file.includes("-official-output-capture-") && file.endsWith(".json"))
      .map((file) => `${catalogDir}/${file}`)
      .sort()
  : [];
const paths = explicitPaths.length > 0 ? explicitPaths : discoveredPaths;

const results = paths.map((path) => {
  if (!existsSync(path)) {
    return {
      ok: false,
      path,
      slug: slugFromOfficialOutputCapturePath(path),
      problems: [{ path: "$", message: `capture artifact does not exist: ${path}` }],
      warnings: [],
      outputSignals: {},
      rowEvidenceReady: false,
      promotionSafeProvenance: false,
      outputSignalReview: false,
      outputSignalReviewCandidate: false,
      rowEvidencePromotionReady: false,
      promotionCandidate: false,
    };
  }

  let artifact;
  try {
    artifact = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return {
      ok: false,
      path,
      slug: slugFromOfficialOutputCapturePath(path),
      problems: [{ path: "$", message: error instanceof Error ? error.message : String(error) }],
      warnings: [],
      outputSignals: {},
      rowEvidenceReady: false,
      promotionSafeProvenance: false,
      outputSignalReview: false,
      outputSignalReviewCandidate: false,
      rowEvidencePromotionReady: false,
      promotionCandidate: false,
    };
  }

  return validateOfficialOutputCaptureArtifact(artifact, {
    path,
    expectedSlug: slugFromOfficialOutputCapturePath(path),
  });
});

const failed = results.filter((result) => !result.ok);
const summary = {
  schemaVersion: "soma-reports.official-output-capture-validation.v1",
  generatedAt: new Date().toISOString(),
  ok: failed.length === 0,
  expectedCaptureSchema: officialOutputCaptureSchema,
  catalogDir,
  checked: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  rowEvidenceReady: results.filter((result) => result.rowEvidenceReady).length,
  promotionSafeProvenance: results.filter((result) => result.promotionSafeProvenance).length,
  outputSignalReviews: results.filter((result) => result.outputSignalReview ?? result.promotionCandidate).length,
  rowEvidencePromotionReady: results.filter((result) => result.rowEvidencePromotionReady).length,
  promotionCandidates: results.filter((result) => result.promotionCandidate).length,
  paths,
  results,
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exit(1);
}
