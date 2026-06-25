#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { loadArtifactSeeds } from "./lib/local-artifact-seeds.mjs";

const parseArgs = () => {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const next = process.argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(arg, next);
      index += 1;
    } else {
      args.set(arg, "true");
    }
  }
  return args;
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const unique = (values) => [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
const sameSet = (left, right) => left.length === right.length && left.every((value) => right.includes(value));

const args = parseArgs();
const format = args.get("--format") ?? "json";
const ledgerPath = args.get("--ledger") ?? "reference/catalog/sample-promotion-rejections-2026-06-23.json";
const captureStatusPath = args.get("--capture-status") ?? "reference/catalog/official-output-capture-status.json";

if (!["json", "compact"].includes(format)) {
  throw new Error(`Unsupported --format ${format}; expected json or compact`);
}

const problems = [];
const ledger = existsSync(ledgerPath) ? readJson(ledgerPath) : null;
if (!ledger) {
  problems.push(`Missing formal blocker ledger: ${ledgerPath}`);
}

const decisions = Array.isArray(ledger?.decisions) ? ledger.decisions : [];
const blockerSlugs = unique(decisions.map((decision) => decision.slug)).sort();
const duplicateLedgerSlugs = decisions
  .map((decision) => decision.slug)
  .filter((slug, index, slugs) => slug && slugs.indexOf(slug) !== index);

if (duplicateLedgerSlugs.length > 0) {
  problems.push(`Formal blocker ledger has duplicate slugs: ${unique(duplicateLedgerSlugs).join(", ")}`);
}

const {
  artifacts,
  error: seedArtifactError,
  source: seedArtifactSource,
} = loadArtifactSeeds({ seedArtifactsPath: args.get("--seed-artifacts") });

if (seedArtifactError) {
  problems.push(seedArtifactError);
}

const artifactsBySlug = new Map();
const duplicateSeedSlugs = [];
for (const artifact of artifacts) {
  if (!artifact?.slug) {
    continue;
  }
  if (artifactsBySlug.has(artifact.slug)) {
    duplicateSeedSlugs.push(artifact.slug);
  }
  artifactsBySlug.set(artifact.slug, artifact);
}

if (duplicateSeedSlugs.length > 0) {
  problems.push(`Seed artifacts have duplicate slugs: ${unique(duplicateSeedSlugs).sort().join(", ")}`);
}

const validateBlueprint = (blueprint, path, row) => {
  if (!blueprint || typeof blueprint !== "object") {
    row.missingBlueprints.push(path);
    problems.push(`${row.slug}: ${path} is missing formalOutputBlueprint`);
    return;
  }

  row.blueprints += 1;
  if (blueprint.promotesFormalReadiness !== false) {
    row.promotingBlueprints.push(path);
    problems.push(`${row.slug}: ${path} must have promotesFormalReadiness=false`);
  } else {
    row.nonPromotingBlueprints += 1;
  }

  if (typeof blueprint.nonPromotionBoundary !== "string" || blueprint.nonPromotionBoundary.trim().length === 0) {
    row.missingNonPromotionBoundaries.push(path);
    problems.push(`${row.slug}: ${path} is missing a nonPromotionBoundary`);
  }

  if (typeof blueprint.evidenceKind !== "string" || blueprint.evidenceKind.trim().length === 0) {
    row.invalidBlueprints.push(path);
    problems.push(`${row.slug}: ${path} is missing evidenceKind`);
  }

  if (typeof blueprint.availability !== "string" || blueprint.availability.trim().length === 0) {
    row.invalidBlueprints.push(path);
    problems.push(`${row.slug}: ${path} is missing availability`);
  }
};

const rows = blockerSlugs.map((slug) => {
  const artifact = artifactsBySlug.get(slug);
  const row = {
    slug,
    title: decisions.find((decision) => decision.slug === slug)?.title ?? slug,
    artifactPresent: Boolean(artifact),
    sections: 0,
    fields: 0,
    blueprints: 0,
    nonPromotingBlueprints: 0,
    missingBlueprints: [],
    missingNonPromotionBoundaries: [],
    invalidBlueprints: [],
    promotingBlueprints: [],
  };

  if (!artifact) {
    problems.push(`${slug}: missing seed artifact`);
    return row;
  }

  const outputSections = Array.isArray(artifact.outputSections) ? artifact.outputSections : [];
  if (outputSections.length === 0) {
    problems.push(`${slug}: missing outputSections`);
  }

  for (const [sectionIndex, section] of outputSections.entries()) {
    row.sections += 1;
    const sectionPath = `outputSections[${sectionIndex}]`;
    validateBlueprint(section?.formalOutputBlueprint, `${sectionPath}.formalOutputBlueprint`, row);

    const expectedFields = Array.isArray(section?.expectedFields) ? section.expectedFields : [];
    for (const [fieldIndex, field] of expectedFields.entries()) {
      row.fields += 1;
      const fieldPath = `${sectionPath}.expectedFields[${fieldIndex}]`;
      validateBlueprint(field?.formalOutputBlueprint, `${fieldPath}.formalOutputBlueprint`, row);

      if (field?.formalOutputBlueprint && typeof field.officialFieldPath !== "string") {
        row.invalidBlueprints.push(`${fieldPath}.officialFieldPath`);
        problems.push(`${slug}: ${fieldPath} is missing officialFieldPath`);
      }

      if (field?.formalOutputBlueprint && typeof field.formalDisplayRole !== "string") {
        row.invalidBlueprints.push(`${fieldPath}.formalDisplayRole`);
        problems.push(`${slug}: ${fieldPath} is missing formalDisplayRole`);
      }

      if (field?.formalOutputBlueprint && typeof field.availability !== "string") {
        row.invalidBlueprints.push(`${fieldPath}.availability`);
        problems.push(`${slug}: ${fieldPath} is missing availability`);
      }
    }
  }

  return row;
});

const captureStatus = existsSync(captureStatusPath) ? readJson(captureStatusPath) : null;
const captureRows = Array.isArray(captureStatus?.rows) ? captureStatus.rows : [];
const captureStatusSlugs = unique(captureRows.map((row) => row.slug)).sort();
const rowEvidenceReadyBlockers = captureRows.filter((row) => {
  if (!blockerSlugs.includes(row.slug)) {
    return false;
  }
  return (
    row.stage === "row-evidence-ready" ||
    row.officialEvidenceTier === "official-row-evidence-ready" ||
    (row.rowEvidenceReadyCaptures ?? 0) > 0 ||
    (row.rowEvidencePromotionReadyCaptures ?? 0) > 0 ||
    row.formalReadinessGate?.readyForPromotion === true
  );
});

if (captureStatus) {
  if (!sameSet(captureStatusSlugs, blockerSlugs)) {
    problems.push(
      `Capture-status blocker rows do not match ledger slugs: ledger=${blockerSlugs.length}, status=${captureStatusSlugs.length}`,
    );
  }
  if (captureStatus?.catalogSnapshot?.formalPendingPackages !== blockerSlugs.length) {
    problems.push(
      `Capture-status formalPendingPackages=${captureStatus?.catalogSnapshot?.formalPendingPackages} does not match ledger blockers=${blockerSlugs.length}`,
    );
  }
  for (const row of rowEvidenceReadyBlockers) {
    problems.push(`${row.slug}: row-ready or promotion-ready status is present while slug remains in blocker ledger`);
  }
}

const totals = {
  blockers: blockerSlugs.length,
  artifacts: rows.filter((row) => row.artifactPresent).length,
  sections: rows.reduce((sum, row) => sum + row.sections, 0),
  fields: rows.reduce((sum, row) => sum + row.fields, 0),
  missingBlueprints: rows.reduce((sum, row) => sum + row.missingBlueprints.length, 0),
  invalidBlueprints: rows.reduce((sum, row) => sum + row.invalidBlueprints.length, 0),
  promotingBlueprints: rows.reduce((sum, row) => sum + row.promotingBlueprints.length, 0),
  missingNonPromotionBoundaries: rows.reduce((sum, row) => sum + row.missingNonPromotionBoundaries.length, 0),
  rowEvidenceReadyBlockers: rowEvidenceReadyBlockers.length,
};

const output = {
  schemaVersion: "soma-reports.formal-output-blueprint-coverage-audit.v1",
  generatedAt: new Date().toISOString(),
  ok: problems.length === 0,
  seedArtifactSource,
  ledger: {
    path: ledgerPath,
    decisions: decisions.length,
    blockerSlugs,
  },
  catalogSnapshot: {
    authenticatedMarketplacePositions:
      captureStatus?.catalogSnapshot?.authenticatedMarketplacePositions ??
      ledger?.catalogSnapshot?.authenticatedMarketplacePositions ??
      null,
    identifiedNamedPackages:
      captureStatus?.catalogSnapshot?.identifiedNamedPackages ?? ledger?.catalogSnapshot?.identifiedNamedPackages ?? null,
    formalPendingPackages: captureStatus?.catalogSnapshot?.formalPendingPackages ?? blockerSlugs.length,
  },
  captureStatus: captureStatus
    ? {
        path: captureStatusPath,
        rows: captureRows.length,
        rowEvidenceReadyBlockers: rowEvidenceReadyBlockers.map((row) => row.slug).sort(),
      }
    : null,
  totals,
  problems,
  rows,
};

const compactOutput =
  format === "compact"
    ? {
        schemaVersion: output.schemaVersion,
        ok: output.ok,
        seedArtifactSource,
        catalogSnapshot: output.catalogSnapshot,
        totals,
        problemSamples: problems.slice(0, 20),
        blockerSlugs,
      }
    : output;

console.log(JSON.stringify(compactOutput, null, 2));

if (!output.ok) {
  process.exitCode = 1;
}
