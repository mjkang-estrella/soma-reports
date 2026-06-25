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
const increment = (counts, key) => {
  if (typeof key !== "string" || key.trim().length === 0) {
    return;
  }
  counts[key] = (counts[key] ?? 0) + 1;
};

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

const captureStatus = existsSync(captureStatusPath) ? readJson(captureStatusPath) : null;
const captureRows = Array.isArray(captureStatus?.rows) ? captureStatus.rows : [];
const captureRowsBySlug = new Map(captureRows.map((row) => [row.slug, row]));
const captureStatusSlugs = unique(captureRows.map((row) => row.slug)).sort();

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
  const captureRow = captureRowsBySlug.get(slug) ?? null;
  const row = {
    slug,
    title: decisions.find((decision) => decision.slug === slug)?.title ?? slug,
    artifactPresent: Boolean(artifact),
    captureStatusPresent: Boolean(captureRow),
    officialEvidenceTier: captureRow?.officialEvidenceTier ?? null,
    sourceCoverageClass: captureRow?.sourceCoverage?.class ?? null,
    authenticatedPositionNumbers: captureRow?.sourceCoverage?.authenticatedPositionNumbers ?? [],
    rowEvidenceReadyCaptures: captureRow?.rowEvidenceReadyCaptures ?? 0,
    rowEvidencePromotionReadyCaptures: captureRow?.rowEvidencePromotionReadyCaptures ?? 0,
    requiredEvidenceForPromotion: captureRow?.requiredEvidenceForPromotion ?? [],
    packageSpecificMissingEvidence: captureRow?.packageSpecificMissingEvidence ?? [],
    nextPublicCommand: captureRow?.nextPublicCommand ?? null,
    outputFieldGapBoundary:
      "Expected fields are non-promoting output-format guidance until official non-private rows, citation bindings, and rowEvidenceReady validation exist.",
    sections: 0,
    sectionBlueprints: 0,
    fields: 0,
    fieldBlueprints: 0,
    requiredFields: 0,
    requiredFieldPaths: 0,
    optionalFields: 0,
    missingRequiredFieldPaths: [],
    blueprints: 0,
    nonPromotingBlueprints: 0,
    missingBlueprints: [],
    missingNonPromotionBoundaries: [],
    invalidBlueprints: [],
    promotingBlueprints: [],
    evidenceKindCounts: {},
    availabilityCounts: {},
    sectionSummaries: [],
  };

  if (!artifact) {
    problems.push(`${slug}: missing seed artifact`);
    return row;
  }
  if (!captureRow) {
    problems.push(`${slug}: missing capture-status row`);
  }
  if (captureRow && !String(captureRow.nextPublicCommand ?? "").includes("scaffold:capture-session -- --source public")) {
    problems.push(`${slug}: capture-status row must expose a public capture-session nextPublicCommand`);
  }
  if (captureRow && (!Array.isArray(captureRow.requiredEvidenceForPromotion) || captureRow.requiredEvidenceForPromotion.length === 0)) {
    problems.push(`${slug}: capture-status row must expose requiredEvidenceForPromotion`);
  }
  if (captureRow && (!Array.isArray(captureRow.packageSpecificMissingEvidence) || captureRow.packageSpecificMissingEvidence.length === 0)) {
    problems.push(`${slug}: capture-status row must expose packageSpecificMissingEvidence`);
  }

  const outputSections = Array.isArray(artifact.outputSections) ? artifact.outputSections : [];
  if (outputSections.length === 0) {
    problems.push(`${slug}: missing outputSections`);
  }

  for (const [sectionIndex, section] of outputSections.entries()) {
    row.sections += 1;
    const sectionPath = `outputSections[${sectionIndex}]`;
    const sectionBlueprint = section?.formalOutputBlueprint;
    if (sectionBlueprint) {
      row.sectionBlueprints += 1;
      increment(row.evidenceKindCounts, sectionBlueprint.evidenceKind);
      increment(row.availabilityCounts, sectionBlueprint.availability);
    }
    validateBlueprint(section?.formalOutputBlueprint, `${sectionPath}.formalOutputBlueprint`, row);

    const expectedFields = Array.isArray(section?.expectedFields) ? section.expectedFields : [];
    const sectionSummary = {
      title: typeof section?.title === "string" ? section.title : sectionPath,
      sectionKey: sectionBlueprint?.sectionKey ?? null,
      evidenceKind: sectionBlueprint?.evidenceKind ?? null,
      availability: sectionBlueprint?.availability ?? null,
      fields: expectedFields.length,
      blueprintFields: 0,
      requiredFields: 0,
      requiredFieldPaths: 0,
      officialFieldPathSamples: [],
      fieldPathSamples: [],
      availabilityCounts: {},
    };
    for (const [fieldIndex, field] of expectedFields.entries()) {
      row.fields += 1;
      if (field?.required) {
        row.requiredFields += 1;
        sectionSummary.requiredFields += 1;
        if (typeof field.fieldPath === "string" && field.fieldPath.trim().length > 0) {
          row.requiredFieldPaths += 1;
          sectionSummary.requiredFieldPaths += 1;
        } else {
          const missingPath = `${fieldPath}.fieldPath:${field?.key ?? fieldIndex}`;
          row.missingRequiredFieldPaths.push(missingPath);
          problems.push(`${slug}: ${fieldPath} required field is missing fieldPath`);
        }
      } else {
        row.optionalFields += 1;
      }
      const fieldPath = `${sectionPath}.expectedFields[${fieldIndex}]`;
      if (field?.formalOutputBlueprint) {
        row.fieldBlueprints += 1;
        sectionSummary.blueprintFields += 1;
        increment(row.evidenceKindCounts, field.formalOutputBlueprint.evidenceKind);
        increment(row.availabilityCounts, field.formalOutputBlueprint.availability);
      }
      increment(sectionSummary.availabilityCounts, field?.availability);
      if (typeof field?.officialFieldPath === "string" && sectionSummary.officialFieldPathSamples.length < 6) {
        sectionSummary.officialFieldPathSamples.push(field.officialFieldPath);
      }
      if (typeof field?.fieldPath === "string" && sectionSummary.fieldPathSamples.length < 6) {
        sectionSummary.fieldPathSamples.push(field.fieldPath);
      }
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
    row.sectionSummaries.push(sectionSummary);
  }

  if (row.sectionBlueprints !== row.sections) {
    problems.push(`${slug}: every output section must have a non-promoting blueprint`);
  }
  if (row.fieldBlueprints !== row.fields) {
    problems.push(`${slug}: every expected output field must have a non-promoting blueprint`);
  }

  return row;
});

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
  sectionBlueprints: rows.reduce((sum, row) => sum + row.sectionBlueprints, 0),
  fields: rows.reduce((sum, row) => sum + row.fields, 0),
  fieldBlueprints: rows.reduce((sum, row) => sum + row.fieldBlueprints, 0),
  requiredFields: rows.reduce((sum, row) => sum + row.requiredFields, 0),
  requiredFieldPaths: rows.reduce((sum, row) => sum + row.requiredFieldPaths, 0),
  missingRequiredFieldPaths: rows.reduce((sum, row) => sum + row.missingRequiredFieldPaths.length, 0),
  optionalFields: rows.reduce((sum, row) => sum + row.optionalFields, 0),
  missingBlueprints: rows.reduce((sum, row) => sum + row.missingBlueprints.length, 0),
  invalidBlueprints: rows.reduce((sum, row) => sum + row.invalidBlueprints.length, 0),
  promotingBlueprints: rows.reduce((sum, row) => sum + row.promotingBlueprints.length, 0),
  missingNonPromotionBoundaries: rows.reduce((sum, row) => sum + row.missingNonPromotionBoundaries.length, 0),
  rowsWithPackageSpecificEvidence: rows.filter((row) => row.packageSpecificMissingEvidence.length > 0).length,
  rowsWithPublicNextCommand: rows.filter((row) =>
    String(row.nextPublicCommand ?? "").includes("scaffold:capture-session -- --source public"),
  ).length,
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
        fieldGapRows: rows.map((row) => ({
          slug: row.slug,
          title: row.title,
          sections: row.sections,
          sectionBlueprints: row.sectionBlueprints,
          fields: row.fields,
          fieldBlueprints: row.fieldBlueprints,
          requiredFields: row.requiredFields,
          requiredFieldPaths: row.requiredFieldPaths,
          missingRequiredFieldPaths: row.missingRequiredFieldPaths,
          optionalFields: row.optionalFields,
          officialEvidenceTier: row.officialEvidenceTier,
          sourceCoverageClass: row.sourceCoverageClass,
          authenticatedPositionNumbers: row.authenticatedPositionNumbers,
          rowEvidenceReadyCaptures: row.rowEvidenceReadyCaptures,
          rowEvidencePromotionReadyCaptures: row.rowEvidencePromotionReadyCaptures,
          requiredEvidenceForPromotion: row.requiredEvidenceForPromotion,
          packageSpecificMissingEvidence: row.packageSpecificMissingEvidence,
          nextPublicCommand: row.nextPublicCommand,
          evidenceKindCounts: row.evidenceKindCounts,
          availabilityCounts: row.availabilityCounts,
          sectionSummaries: row.sectionSummaries,
          outputFieldGapBoundary: row.outputFieldGapBoundary,
        })),
      }
    : output;

console.log(JSON.stringify(compactOutput, null, 2));

if (!output.ok) {
  process.exitCode = 1;
}
