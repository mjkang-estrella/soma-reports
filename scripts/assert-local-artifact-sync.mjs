#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";
import { loadArtifactSeeds } from "./lib/local-artifact-seeds.mjs";

const fixturesDir = "fixtures/synthetic";
const fixtureSuffix = ".fixture.json";
const resultSuffix = ".result.json";

const normalizedText = (value) =>
  value
    .replace(/^# .+$/gm, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

const spawnMessage = (run, fallback) =>
  run.error?.message || run.stderr?.trim() || run.stdout?.trim() || fallback;

const readJson = (path) => {
  try {
    return { value: JSON.parse(readFileSync(path, "utf8")), error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) };
  }
};

const resultRowsFrom = (value) => {
  if (!value || typeof value !== "object") return [];
  const candidates = [value.resultRows, value.findings, value.results, value.report?.resultRows, value.report?.findings];
  return candidates.find(Array.isArray) ?? [];
};

const genericResultRowKeys = ["groupTitle", "item", "brandName", "geneticAnalysis", "genes", "sourceLabel", "plainEnglishMeaning"];
const formalResultRowKeyAllowlist = new Set([...genericResultRowKeys, "description", "sourceIds", "sourceBindingStatus"]);
const formalResultRowKeysFrom = (seedArtifact) => {
  const keys = new Set();
  for (const field of seedArtifact?.formalFields ?? []) {
    if (field.status !== "covered") {
      continue;
    }
    const match = /^resultRows\[\]\.([A-Za-z][A-Za-z0-9_]*)$/.exec(field.outputPath ?? "");
    if (match && formalResultRowKeyAllowlist.has(match[1])) {
      keys.add(match[1]);
    }
  }
  return [...keys].sort();
};

const seedSampleSourceIds = (seedArtifact) =>
  [
    ...new Set(
      (seedArtifact?.sampleRows ?? []).flatMap((row) => row.sourceResourceIds ?? row.sourceIds ?? []),
    ),
  ].sort();

const analyzeResultSync = ({ result, seedArtifact, localFixture }) => {
  const rows = resultRowsFrom(result);
  const seedSampleRowsExposed = Array.isArray(seedArtifact?.sampleRows);
  const seedGenotypeSummaryExposed = Array.isArray(seedArtifact?.genotypeSummary);
  const allowedReferenceIds = new Set((localFixture?.referenceResources ?? []).map((resource) => resource.id));
  const sampleSourceIds = seedSampleSourceIds(seedArtifact);
  const requiredFormalRowKeys = formalResultRowKeysFrom(seedArtifact);
  const nonCanonicalSourceRows = [];
  const missingFormalRowFieldRows = [];
  const unknownSourceIds = new Set();
  let rowsWithCanonicalSourceIds = 0;
  let rowsWithAllowedSourceIds = 0;
  let rowsCitingSeedSampleSources = 0;
  let rowsWithFormalRowFields = 0;

  rows.forEach((row, index) => {
    const missingFormalRowFields = requiredFormalRowKeys.filter((key) => !(key in (row ?? {})));
    if (missingFormalRowFields.length === 0) {
      rowsWithFormalRowFields += 1;
    } else {
      missingFormalRowFieldRows.push({
        index,
        missingFormalRowFields,
      });
    }

    const sourceIds = row?.sourceIds;
    const hasCanonicalSourceIds = Array.isArray(sourceIds) && sourceIds.length > 0;
    if (!hasCanonicalSourceIds) {
      nonCanonicalSourceRows.push({
        index,
        sourceKeys: Object.keys(row ?? {}).filter((key) => /source|ref/i.test(key)),
      });
      return;
    }

    rowsWithCanonicalSourceIds += 1;

    const rowUnknownSourceIds = sourceIds.filter(
      (sourceId) => sourceId !== "source-unavailable" && !allowedReferenceIds.has(sourceId),
    );
    if (rowUnknownSourceIds.length === 0) {
      rowsWithAllowedSourceIds += 1;
    }
    for (const sourceId of rowUnknownSourceIds) {
      unknownSourceIds.add(sourceId);
    }
    if (sourceIds.some((sourceId) => sampleSourceIds.includes(sourceId))) {
      rowsCitingSeedSampleSources += 1;
    }
  });

  return {
    resultRowCount: rows.length,
    resultRowsWithCanonicalSourceIds: rowsWithCanonicalSourceIds,
    resultRowsWithAllowedSourceIds: rowsWithAllowedSourceIds,
    resultRowsCitingSeedSampleSources: rowsCitingSeedSampleSources,
    seedSampleRowsExposed,
    seedGenotypeSummaryExposed,
    seedSampleRows: seedSampleRowsExposed ? seedArtifact.sampleRows.length : 0,
    seedGenotypeSummaryRows: seedGenotypeSummaryExposed ? seedArtifact.genotypeSummary.length : 0,
    seedSampleSourceIds: sampleSourceIds,
    requiredFormalRowKeys,
    resultRowsWithFormalRowFields: rowsWithFormalRowFields,
    nonCanonicalSourceRows: nonCanonicalSourceRows.slice(0, 20),
    missingFormalRowFieldRows: missingFormalRowFieldRows.slice(0, 20),
    unknownSourceIds: [...unknownSourceIds].sort(),
    resultCitationSyncOk:
      rows.length > 0 &&
      rowsWithCanonicalSourceIds === rows.length &&
      rowsWithAllowedSourceIds === rows.length &&
      unknownSourceIds.size === 0,
    resultFormalRowFieldsSyncOk:
      requiredFormalRowKeys.length === 0 ||
      (rows.length > 0 && rowsWithFormalRowFields === rows.length),
  };
};

const {
  artifacts: seedArtifactList,
  error: seedLoadError,
  source: seedArtifactSource,
} = loadArtifactSeeds();
const seedArtifacts = new Map();
const seedDuplicateSlugs = new Set();
const seedArtifactsCachePath = "tmp/agent-bundles/local-artifact-seeds.json";

if (!seedLoadError) {
  mkdirSync("tmp/agent-bundles", { recursive: true });
  writeFileSync(seedArtifactsCachePath, `${JSON.stringify(seedArtifactList, null, 2)}\n`);
}

for (const artifact of seedArtifactList) {
  if (!artifact?.slug) {
    continue;
  }
  if (seedArtifacts.has(artifact.slug)) {
    seedDuplicateSlugs.add(artifact.slug);
  }
  seedArtifacts.set(artifact.slug, artifact);
}

const slugsForFiles = (dir, suffix) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((file) => file.endsWith(suffix))
        .map((file) => basename(file, suffix))
    : [];

const fixtureSlugs = slugsForFiles(fixturesDir, fixtureSuffix);
const resultSlugs = slugsForFiles(fixturesDir, resultSuffix);
const promptSlugs = slugsForFiles("prompts", ".md");

const packages = [
  ...new Set([
    ...seedArtifacts.keys(),
    ...fixtureSlugs,
    ...resultSlugs,
    ...promptSlugs,
  ]),
].sort();

const results = [];

for (const slug of packages) {
  const promptPath = `prompts/${slug}.md`;
  const fixturePath = join(fixturesDir, `${slug}${fixtureSuffix}`);
  const resultPath = join(fixturesDir, `${slug}${resultSuffix}`);
  const seedArtifact = seedArtifacts.get(slug);
  const hasSeedArtifact = Boolean(seedArtifact);
  const hasPrompt = existsSync(promptPath);
  const hasFixture = existsSync(fixturePath);
  const hasResult = existsSync(resultPath);

  const fixtureRead = hasFixture ? readJson(fixturePath) : { value: null, error: null };
  const resultRead = hasResult ? readJson(resultPath) : { value: null, error: null };
  const localFixture = fixtureRead.value;
  const resultSync = resultRead.error
    ? analyzeResultSync({ result: null, seedArtifact, localFixture })
    : analyzeResultSync({ result: resultRead.value, seedArtifact, localFixture });
  const localPrompt = hasPrompt ? normalizedText(readFileSync(promptPath, "utf8")) : "";
  const seedFixture = seedArtifact?.localTestFixture ?? null;
  const seedPrompt = seedArtifact?.prompt?.deterministicPrompt
    ? normalizedText(seedArtifact.prompt.deterministicPrompt)
    : "";

  const fixtureMatches = isDeepStrictEqual(localFixture, seedFixture);
  const promptMatches = hasPrompt && localPrompt === seedPrompt;
  const validation = hasPrompt && hasFixture && hasResult
    ? spawnSync(process.execPath, [
        "scripts/agent-bundle.mjs",
        "--report",
        slug,
        "--fixture",
        fixturePath,
        "--result",
        resultPath,
        "--seed-artifacts",
        seedArtifactsCachePath,
      ], {
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 20,
      })
    : null;
  const resultValidates = validation ? validation.status === 0 : false;

  results.push({
    slug,
    ok:
      !seedLoadError &&
      !seedDuplicateSlugs.has(slug) &&
      hasSeedArtifact &&
      hasPrompt &&
      hasFixture &&
      hasResult &&
      !fixtureRead.error &&
      !resultRead.error &&
      fixtureMatches &&
      promptMatches &&
      resultValidates &&
      resultSync.seedSampleRowsExposed &&
      resultSync.seedGenotypeSummaryExposed &&
      resultSync.resultCitationSyncOk &&
      resultSync.resultFormalRowFieldsSyncOk,
    seedArtifactFound: hasSeedArtifact,
    seedDuplicate: seedDuplicateSlugs.has(slug),
    promptFound: hasPrompt,
    fixtureFound: hasFixture,
    resultFound: hasResult,
    fixtureParseError: fixtureRead.error,
    resultParseError: resultRead.error,
    fixtureMatches,
    promptMatches,
    resultValidates,
    ...resultSync,
    validationError: validation && validation.status !== 0
      ? spawnMessage(validation, `agent-bundle exited with ${validation.status}`)
      : null,
  });
}

const failed = results.filter((result) => !result.ok);
const summary = {
  ok: failed.length === 0,
  checked: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  seedLoadError,
  seedArtifactSource,
  seedDuplicateSlugs: [...seedDuplicateSlugs].sort(),
  results,
};

console.log(JSON.stringify(summary, null, 2));

if (failed.length > 0) {
  process.exit(1);
}
