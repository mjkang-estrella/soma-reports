#!/usr/bin/env node

import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const readText = (path) => readFileSync(path, "utf8");

const coveragePath = "reference/catalog/sequencing-marketplace-coverage.json";
const publicCatalogPath = "reference/catalog/sequencing-public-marketplace-catalog.json";
const reportPackagesPath = "convex/reportPackages.ts";
const reportsPath = "convex/reports.ts";
const appPath = "src/App.tsx";

const coverage = readJson(coveragePath);
const publicCatalog = readJson(publicCatalogPath);
const reportPackages = readText(reportPackagesPath);
const reportsSource = readText(reportsPath);
const appSource = readText(appPath);

const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

const counts = coverage.counts;
const inferredNamedTotal = counts.publicUrlDistinct + counts.authenticatedOnlyNamed;
const inferredSeededTotal = inferredNamedTotal + counts.unidentifiedAuthenticatedSlots;

assert(coverage.targetTotal === 164, "coverage targetTotal must remain 164 until reverified");
assert(publicCatalog.count === counts.publicUrlDistinct, "public catalog count must match coverage publicUrlDistinct");
assert(inferredNamedTotal === counts.identifiedNamedTotal, "identifiedNamedTotal must equal public + authenticated-only named");
assert(inferredSeededTotal === counts.seededRecordsExpected, "seededRecordsExpected must equal identified + unidentified");
assert(counts.seededRecordsExpected === coverage.targetTotal, "seeded records must cover the observed marketplace total");
assert(coverage.unidentifiedSlots.length === counts.unidentifiedAuthenticatedSlots, "unidentified slot list length must match count");
assert(new Set(coverage.unidentifiedSlots).size === coverage.unidentifiedSlots.length, "unidentified slot slugs must be unique");

const slotSourceCount = reportPackages.match(/unidentifiedAuthenticatedSlots = Array\.from\(\{ length: (\d+) \}/)?.[1];
assert(Number(slotSourceCount) === counts.unidentifiedAuthenticatedSlots, "reportPackages unidentified slot generator must match coverage count");

const backendTotal = reportsSource.match(/knownMarketplaceTotal = (\d+)/)?.[1];
assert(Number(backendTotal) === coverage.targetTotal, "reports.catalogStats total must match coverage target");

const frontendTotal = appSource.match(/SEQUENCING_MARKETPLACE_TOTAL = (\d+)/)?.[1];
assert(Number(frontendTotal) === coverage.targetTotal, "frontend marketplace total must match coverage target");

if (errors.length > 0) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      targetTotal: coverage.targetTotal,
      publicUrlDistinct: counts.publicUrlDistinct,
      authenticatedOnlyNamed: counts.authenticatedOnlyNamed,
      identifiedNamedTotal: counts.identifiedNamedTotal,
      unidentifiedAuthenticatedSlots: counts.unidentifiedAuthenticatedSlots,
      seededRecordsExpected: counts.seededRecordsExpected,
    },
    null,
    2,
  ),
);
