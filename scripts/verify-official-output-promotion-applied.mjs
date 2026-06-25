#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { loadArtifactSeeds } from "./lib/local-artifact-seeds.mjs";
import {
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
      args.set(arg, next);
      index += 1;
    } else {
      args.set(arg, "true");
    }
  }
  return args;
};

const args = parseArgs();
const capturePath = args.get("--path") ?? args.get("--artifact");

if (!capturePath) {
  throw new Error(
    "Usage: npm run scaffold:promotion-verify -- --path reference/catalog/<slug>-official-output-capture-YYYY-MM-DD.json",
  );
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const asArray = (value) => (Array.isArray(value) ? value : []);
const normalizeText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const asString = (value) => (typeof value === "string" ? value.trim() : "");
const unique = (items) => [...new Set(items.filter((item) => typeof item === "string" && item.trim()))].sort();
const sourceIdsFrom = (value) => asArray(value?.sourceResourceIds ?? value?.sourceIds);
const hasSourceIds = (value, sourceIds) => {
  const actual = new Set(sourceIdsFrom(value));
  return sourceIds.every((sourceId) => actual.has(sourceId));
};
const textIncludesAny = (text, needles) => {
  const normalizedText = normalizeText(text);
  return needles.some((needle) => {
    const normalizedNeedle = normalizeText(needle);
    return normalizedNeedle && normalizedText.includes(normalizedNeedle);
  });
};

const readOptionalJson = (path) => {
  if (!existsSync(path)) {
    return { value: null, error: `missing ${path}` };
  }
  try {
    return { value: readJson(path), error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) };
  }
};

const readOptionalText = (path) => {
  if (!existsSync(path)) {
    return { value: "", error: `missing ${path}` };
  }
  try {
    return { value: readFileSync(path, "utf8"), error: null };
  } catch (error) {
    return { value: "", error: error instanceof Error ? error.message : String(error) };
  }
};

const captureArtifact = readJson(capturePath);
const reportSlug = args.get("--report") ?? captureArtifact.slug ?? slugFromOfficialOutputCapturePath(capturePath);
const validation = validateOfficialOutputCaptureArtifact(captureArtifact, {
  path: capturePath,
  expectedSlug: slugFromOfficialOutputCapturePath(capturePath) ?? reportSlug,
});

const {
  artifacts: seedArtifacts,
  error: seedLoadError,
  source: seedArtifactSource,
} = loadArtifactSeeds({
  seedArtifactsPath: args.get("--seed-artifacts"),
});
const seedArtifact = seedArtifacts.find((artifact) => artifact?.slug === reportSlug) ?? null;

const promptPath = args.get("--prompt") ?? `prompts/${reportSlug}.md`;
const fixturePath = args.get("--fixture") ?? `fixtures/synthetic/${reportSlug}.fixture.json`;
const resultPath = args.get("--result") ?? `fixtures/synthetic/${reportSlug}.result.json`;
const promptRead = readOptionalText(promptPath);
const fixtureRead = readOptionalJson(fixturePath);
const resultRead = readOptionalJson(resultPath);

const captureSources = [...asArray(captureArtifact.sourceResources), ...asArray(captureArtifact.sourceArtifacts)];
const sourceResourceIds = unique(
  captureSources.map((source, index) =>
    typeof source === "string"
      ? `${reportSlug}-official-output-${index + 1}`
      : asString(source.id ?? source.resourceId),
  ),
);
const sourceAliases = unique(
  captureSources.flatMap((source, index) => {
    if (typeof source === "string") {
      return [source, `${reportSlug}-official-output-${index + 1}`];
    }
    return [
      source.id,
      source.resourceId,
      source.title,
      source.url,
      source.href,
      source.sourceArtifact,
      source.sourceLabel,
    ].map(asString);
  }),
);
const citationSourceIds = unique(asArray(captureArtifact.citationBindings).flatMap(sourceIdsFrom));
const sampleSourceIds = unique(asArray(captureArtifact.sampleRows).flatMap(sourceIdsFrom));
const formalSourceIds = unique(asArray(captureArtifact.formalFields).flatMap(sourceIdsFrom));
const officialSourceIds = unique([
  ...citationSourceIds,
  ...sampleSourceIds,
  ...formalSourceIds,
  ...sourceResourceIds.filter((sourceId) => citationSourceIds.includes(sourceId) || sampleSourceIds.includes(sourceId)),
]);

const seedReferences = asArray(seedArtifact?.references);
const seedReferenceIds = unique(seedReferences.map((reference) => asString(reference.resourceId ?? reference.id)));
const seedReferenceAliases = unique(
  seedReferences.flatMap((reference) => [
    reference.resourceId,
    reference.id,
    reference.title,
    reference.url,
    reference.sourceArtifact,
  ].map(asString)),
);
const officialAliases = unique([...sourceAliases, ...seedReferenceAliases.filter((alias) => officialSourceIds.includes(alias))]);
const fixtureReferenceIds = unique(asArray(fixtureRead.value?.referenceResources).map((resource) => asString(resource.id)));
const resultReferenceIds = unique(asArray(resultRead.value?.references).map((reference) => asString(reference.id ?? reference.resourceId)));
const resultRows = [
  ...asArray(resultRead.value?.sampleRows),
  ...asArray(resultRead.value?.resultRows),
  ...asArray(resultRead.value?.findings),
  ...asArray(resultRead.value?.report?.resultRows),
  ...asArray(resultRead.value?.report?.findings),
];

const checkResults = [];
const addCheck = (key, ok, actual, expected) => {
  checkResults.push({ key, ok: Boolean(ok), expected, actual });
};

addCheck("capture_validates", validation.ok, validation.problems, "capture validates with no problems");
addCheck("capture_row_evidence_ready", validation.rowEvidenceReady, validation.outputSignals, "rowEvidenceReady is true");
addCheck("seed_artifacts_loaded", !seedLoadError, seedLoadError, "seed artifacts load");
addCheck("seed_artifact_present", Boolean(seedArtifact), reportSlug, "exported seed artifact exists for slug");

const seedSourceArtifactTexts = [
  ...asArray(seedArtifact?.sourceArtifacts),
  ...seedReferences.map((reference) => asString(reference.sourceArtifact)),
];
addCheck(
  "seed_contains_capture_path",
  seedSourceArtifactTexts.includes(capturePath),
  seedSourceArtifactTexts.filter(Boolean),
  `seed sourceArtifacts or references include ${capturePath}`,
);
addCheck(
  "seed_contains_official_reference_ids",
  officialSourceIds.length > 0 && officialSourceIds.every((sourceId) => seedReferenceIds.includes(sourceId)),
  { officialSourceIds, seedReferenceIds },
  "seed references include every official source ID cited by the capture",
);

const captureSampleRows = asArray(captureArtifact.sampleRows);
const seedSampleRows = asArray(seedArtifact?.sampleRows);
const sampleRowMatches = captureSampleRows.map((row, index) => {
  const item = asString(row.item ?? row.label ?? row.rowLabel ?? row.observedField);
  const geneticAnalysis = asString(row.geneticAnalysis ?? row.analysis ?? row.result ?? row.value ?? row.observedValue);
  const sourceIds = sourceIdsFrom(row);
  const matched = seedSampleRows.find((candidate) => {
    const candidateItem = asString(candidate.item ?? candidate.label ?? candidate.rowLabel ?? candidate.observedField);
    const candidateAnalysis = asString(candidate.geneticAnalysis ?? candidate.analysis ?? candidate.result ?? candidate.value);
    const itemMatches = !item || normalizeText(candidateItem) === normalizeText(item);
    const analysisMatches = !geneticAnalysis || normalizeText(candidateAnalysis) === normalizeText(geneticAnalysis);
    return itemMatches && analysisMatches && hasSourceIds(candidate, sourceIds);
  });
  return {
    index,
    item,
    sourceIds,
    matched: Boolean(matched),
  };
});
addCheck(
  "seed_contains_source_bound_sample_rows",
  captureSampleRows.length > 0 && sampleRowMatches.every((row) => row.matched),
  sampleRowMatches,
  "every capture sample row is present in seed sampleRows with the same source IDs",
);

const captureFormalFields = asArray(captureArtifact.formalFields).filter((field) => field.status !== "not_applicable");
const seedFormalFields = asArray(seedArtifact?.formalFields);
const formalFieldMatches = captureFormalFields.map((field, index) => {
  const observedField = asString(field.observedField ?? field.label ?? field.key);
  const outputPath = asString(field.outputPath ?? field.fieldPath);
  const sourceIds = sourceIdsFrom(field);
  const aliases = unique([
    ...sourceIds,
    field.sourceLabel,
    ...sourceIds.flatMap((sourceId) =>
      seedReferences
        .filter((reference) => asString(reference.resourceId ?? reference.id) === sourceId)
        .flatMap((reference) => [reference.title, reference.sourceArtifact, reference.url].map(asString)),
    ),
    ...officialAliases,
  ]);
  const matched = seedFormalFields.find((candidate) => {
    if (candidate.status !== "covered") {
      return false;
    }
    const candidateText = [
      candidate.sourceLabel,
      candidate.observedField,
      candidate.outputPath,
      candidate.notes,
    ].join(" ");
    const exactPath = outputPath && candidate.outputPath === outputPath;
    const observedMatches =
      observedField &&
      (normalizeText(candidate.observedField).includes(normalizeText(observedField)) ||
        normalizeText(observedField).includes(normalizeText(candidate.observedField)));
    const aliasMatches = textIncludesAny(candidateText, aliases);
    return exactPath || (observedMatches && aliasMatches) || aliasMatches;
  });
  return {
    index,
    observedField,
    outputPath,
    sourceIds,
    matched: Boolean(matched),
    matchedOutputPath: matched?.outputPath ?? null,
  };
});
addCheck(
  "seed_contains_covered_formal_fields",
  captureFormalFields.length > 0 && formalFieldMatches.every((field) => field.matched),
  formalFieldMatches,
  "every capture formal field maps to a covered seed formal field",
);

const captureBindingMatches = asArray(captureArtifact.citationBindings).map((binding, index) => {
  const sourceIds = sourceIdsFrom(binding);
  const seedRowMatch = seedSampleRows.some((row) => hasSourceIds(row, sourceIds));
  const resultRowMatch = resultRows.some((row) => hasSourceIds(row, sourceIds));
  return {
    index,
    sourceIds,
    seedRowMatch,
    resultRowMatch,
    matched: seedRowMatch && resultRowMatch,
  };
});
addCheck(
  "row_citation_bindings_landed",
  captureBindingMatches.length > 0 && captureBindingMatches.every((binding) => binding.matched),
  captureBindingMatches,
  "capture citation source IDs are present in seed sampleRows and deterministic result rows",
);

addCheck("prompt_file_present", !promptRead.error, promptRead.error, `${promptPath} exists`);
addCheck("fixture_file_present", !fixtureRead.error, fixtureRead.error, `${fixturePath} exists`);
addCheck("result_file_present", !resultRead.error, resultRead.error, `${resultPath} exists`);
addCheck(
  "prompt_mentions_official_source_ids",
  officialSourceIds.length > 0 && officialSourceIds.every((sourceId) => promptRead.value.includes(sourceId)),
  { officialSourceIds },
  "prompt text includes every official source ID cited by the capture",
);
addCheck(
  "fixture_contains_official_reference_ids",
  officialSourceIds.length > 0 && officialSourceIds.every((sourceId) => fixtureReferenceIds.includes(sourceId)),
  { officialSourceIds, fixtureReferenceIds },
  "fixture referenceResources include every official source ID cited by the capture",
);
addCheck(
  "result_contains_official_reference_ids",
  officialSourceIds.length > 0 && officialSourceIds.every((sourceId) => resultReferenceIds.includes(sourceId)),
  { officialSourceIds, resultReferenceIds },
  "deterministic result references include every official source ID cited by the capture",
);

const summary = {
  schemaVersion: "soma-reports.official-output-promotion-applied.v1",
  generatedAt: new Date().toISOString(),
  ok: checkResults.every((check) => check.ok),
  capturePath,
  reportSlug,
  seedArtifactSource,
  promptPath,
  fixturePath,
  resultPath,
  mode: "non-mutating applied-promotion verification",
  validation: {
    ok: validation.ok,
    rowEvidenceReady: validation.rowEvidenceReady,
    outputSignals: validation.outputSignals,
    problems: validation.problems,
    warnings: validation.warnings,
  },
  fingerprint: {
    officialSourceIds,
    citationSourceIds,
    sampleSourceIds,
    formalSourceIds,
    sourceAliases,
  },
  checks: checkResults,
  failedChecks: checkResults.filter((check) => !check.ok),
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exit(1);
}
