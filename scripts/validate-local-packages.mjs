#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { loadArtifactSeeds } from "./lib/local-artifact-seeds.mjs";

const fixturesDir = "fixtures/synthetic";
const fixtureSuffix = ".fixture.json";
const formalEvidenceLedgerPath = "reference/catalog/sample-promotion-rejections-2026-06-23.json";
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) {
    continue;
  }
  const next = process.argv[index + 1];
  args.set(arg, next && !next.startsWith("--") ? next : "true");
  if (next && !next.startsWith("--")) {
    index += 1;
  }
}

const validationMode = args.get("--validation-mode") ?? "local";
const outDir = args.get("--out-dir") ?? "tmp/agent-bundles";
const manifestOutArg = args.get("--manifest-out");
const manifestOut =
  manifestOutArg === undefined ? null : manifestOutArg === "true" ? join(outDir, "manifest.json") : manifestOutArg;
const validationModes = new Set(["local", "sample-parity", "formal-ready"]);
if (!validationModes.has(validationMode)) {
  throw new Error(`Unsupported --validation-mode ${validationMode}; expected local, sample-parity, or formal-ready`);
}
const strictCheckIds = new Set([
  "RESULT.SAMPLE_ROWS_PRESERVED",
  "BUNDLE.FORMAL_READY_SAMPLE_ROWS_PRESENT",
  "BUNDLE.FORMAL_READY_FIELDS_COVERED",
]);
const sha256Text = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

const parseJsonOutput = (output) => {
  try {
    return JSON.parse(output);
  } catch {
    const start = output.indexOf("{");
    const end = output.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(output.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
};

const summarizeLedger = (ledger) => {
  const checks = ledger?.checks ?? [];
  const failedChecks = checks.filter((check) => check.status === "fail");
  const artifactPassed = !failedChecks.some((check) => !strictCheckIds.has(check.id));
  const sampleParityChecks = checks.filter((check) => check.id === "RESULT.SAMPLE_ROWS_PRESERVED");
  const sampleRowsTopLevelPresentChecks = checks.filter((check) => check.id === "RESULT.SAMPLE_ROWS_TOP_LEVEL_PRESENT");
  const sampleRowsTopLevelMissingChecks = checks.filter((check) => check.id === "RESULT.SAMPLE_ROWS_TOP_LEVEL_MISSING");
  const consumerLanguageChecks = checks.filter((check) => check.id.startsWith("RESULT.CONSUMER_LANGUAGE_"));
  const sampleParityChecked = sampleParityChecks.some((check) => check.status !== "not_run");
  const sampleParityPassed = sampleParityChecked && sampleParityChecks.every((check) => check.status !== "fail");
  const sampleParitySkipped = sampleParityChecks.some((check) => check.status === "not_run");
  const formalPending = checks.some(
    (check) =>
      (check.id === "BUNDLE.FORMAL_READY_SAMPLE_ROWS_PRESENT" || check.id === "BUNDLE.FORMAL_READY_FIELDS_COVERED") &&
      check.status === "fail",
  );
  return {
    artifactPassed,
    sampleParityChecked,
    sampleParityPassed,
    sampleParitySkipped,
    sampleRowsTopLevelPresent: sampleRowsTopLevelPresentChecks.some((check) => check.status === "pass"),
    sampleRowsResultRowsOnly: sampleRowsTopLevelMissingChecks.some((check) => check.status === "warn"),
    consumerLanguageChecked: consumerLanguageChecks.length > 0,
    consumerLanguageFailures: consumerLanguageChecks.filter((check) => check.status === "fail").length,
    consumerLanguageWarnings: consumerLanguageChecks.filter((check) => check.status === "warn").length,
    formalPending,
  };
};

if (!existsSync(fixturesDir)) {
  throw new Error(`Missing fixture directory: ${fixturesDir}`);
}

const formalEvidenceLedger = existsSync(formalEvidenceLedgerPath)
  ? JSON.parse(readFileSync(formalEvidenceLedgerPath, "utf8"))
  : { decisions: [] };
const formalEvidenceDecisions = formalEvidenceLedger.decisions ?? [];
const formalEvidenceDecisionCounts = new Map();
for (const decision of formalEvidenceDecisions) {
  if (typeof decision?.slug === "string") {
    formalEvidenceDecisionCounts.set(decision.slug, (formalEvidenceDecisionCounts.get(decision.slug) ?? 0) + 1);
  }
}

mkdirSync(outDir, { recursive: true });

const seedArtifactsPath = join(outDir, "local-artifact-seeds.json");
const { artifacts: seedArtifacts, error: seedArtifactsError, source: seedArtifactSource } = loadArtifactSeeds();
if (seedArtifactsError) {
  throw new Error(seedArtifactsError);
}
writeFileSync(seedArtifactsPath, `${JSON.stringify(seedArtifacts, null, 2)}\n`);

const seedSlugCounts = new Map();
for (const artifact of seedArtifacts) {
  const slug = artifact?.slug;
  if (typeof slug !== "string" || slug.trim().length === 0) {
    continue;
  }
  seedSlugCounts.set(slug, (seedSlugCounts.get(slug) ?? 0) + 1);
}
const expectedSlugs = [...seedSlugCounts.keys()].sort();
const duplicateSeedSlugs = [...seedSlugCounts.entries()]
  .filter(([, count]) => count > 1)
  .map(([slug]) => slug);
const packages = readdirSync(fixturesDir)
  .filter((file) => file.endsWith(fixtureSuffix))
  .map((file) => basename(file, fixtureSuffix))
  .sort();
const packageSet = new Set(packages);
const expectedSlugSet = new Set(expectedSlugs);
const missingFixtureSlugs = expectedSlugs.filter((slug) => !packageSet.has(slug));
const unexpectedFixtureSlugs = packages.filter((slug) => !expectedSlugSet.has(slug));
const packagesToValidate = packages.filter((slug) => expectedSlugSet.has(slug));

const results = [
  ...duplicateSeedSlugs.map((slug) => ({
    slug,
    ok: false,
    error: `duplicate seed artifact slug ${slug}`,
  })),
  ...missingFixtureSlugs.map((slug) => ({
    slug,
    ok: false,
    error: `missing fixture for seeded package ${slug}`,
  })),
  ...unexpectedFixtureSlugs.map((slug) => ({
    slug,
    ok: false,
    error: `fixture does not map to a seeded package ${slug}`,
  })),
];

for (const slug of packagesToValidate) {
  const promptPath = `prompts/${slug}.md`;
  const fixturePath = join(fixturesDir, `${slug}${fixtureSuffix}`);
  const resultPath = join(fixturesDir, `${slug}.result.json`);
  const outPath = join(outDir, `${slug}.validated.json`);

  if (!existsSync(promptPath)) {
    results.push({ slug, ok: false, promptPath, fixturePath, resultPath, outPath, error: `missing ${promptPath}` });
    continue;
  }
  if (!existsSync(resultPath)) {
    results.push({ slug, ok: false, promptPath, fixturePath, resultPath, outPath, error: `missing ${resultPath}` });
    continue;
  }

  const args = [
    "scripts/agent-bundle.mjs",
    "--report",
    slug,
    "--fixture",
    fixturePath,
    "--result",
    resultPath,
    "--out",
    outPath,
    "--seed-artifacts",
    seedArtifactsPath,
    "--validation-mode",
    validationMode,
  ];

  const run = spawnSync(process.execPath, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
  });
  if (run.status === 0) {
    const parsed = JSON.parse(run.stdout);
    if (!parsed.resultValidated) {
      results.push({ slug, ok: false, error: `result was not validated for ${slug}` });
      continue;
    }
    let bundleText;
    let bundle;
    try {
      bundleText = readFileSync(outPath, "utf8");
      bundle = JSON.parse(bundleText);
    } catch (error) {
      results.push({
        slug,
        ok: false,
        promptPath,
        fixturePath,
        resultPath,
        outPath,
        error: `validated bundle could not be read from ${outPath}: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    const packageSummary = summarizeLedger(parsed.validationLedger);
    results.push({
      slug,
      ok: true,
      ...packageSummary,
      outPath,
      promptPath,
      fixturePath,
      resultPath,
      reportPurpose: bundle.agentRunInput?.reportPurpose ?? null,
      bundleHash: bundle.bundleHash ?? parsed.bundleHash,
      bundleFileHash: sha256Text(bundleText),
      readiness: bundle.readiness ?? parsed.readiness,
      auditHashes: bundle.auditManifest
        ? {
            fileHashes: bundle.auditManifest.fileHashes,
            objectHashes: bundle.auditManifest.objectHashes,
          }
        : null,
      resultValidated: parsed.resultValidated,
      warningCount: parsed.validationLedger?.summary?.warnings ?? parsed.warnings?.length ?? 0,
      warnings: parsed.warnings?.slice(0, 5) ?? [],
      validationSummary: parsed.validationLedger?.summary,
    });
    continue;
  }

  const parsedFailure = parseJsonOutput(run.stderr.trim()) ?? parseJsonOutput(run.stdout.trim());
  const packageSummary = summarizeLedger(parsedFailure?.validationLedger);
  results.push({
    slug,
    ok: false,
    ...packageSummary,
    outPath,
    promptPath,
    fixturePath,
    resultPath,
    error: parsedFailure?.errors?.[0] ?? (run.stderr.trim() || run.stdout.trim() || `validator exited with ${run.status}`),
    errors: parsedFailure?.errors?.slice(0, 5),
    warningCount: parsedFailure?.validationLedger?.summary?.warnings ?? parsedFailure?.warnings?.length ?? 0,
    warnings: parsedFailure?.warnings?.slice(0, 5),
    validationSummary: parsedFailure?.validationLedger?.summary,
  });
}

const failed = results.filter((result) => !result.ok);
const successful = results.filter((result) => result.ok);
const strictFormalFailures = results.filter((result) => result.formalPending).length;
const formalIncomplete = results.filter(
  (result) => result.formalPending || result.readiness?.localScaffoldOnly,
).length;
const isLocalScaffoldBacklog = (result) => result.readiness?.localScaffoldOnly || result.formalPending;
const localScaffoldSlugs = results
  .filter(isLocalScaffoldBacklog)
  .map((result) => result.slug)
  .sort();
const localScaffoldSlugSet = new Set(localScaffoldSlugs);
const formalEvidenceDecisionSlugs = [...formalEvidenceDecisionCounts.keys()].sort();
const formalBlockerLedgerProblems = [
  ...[...formalEvidenceDecisionCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([slug]) => `${slug}: duplicate formal evidence blocker decisions`),
  ...localScaffoldSlugs
    .filter((slug) => !formalEvidenceDecisionCounts.has(slug))
    .map((slug) => `${slug}: local-scaffold package is missing a formal evidence blocker decision`),
  ...formalEvidenceDecisionSlugs
    .filter((slug) => !expectedSlugSet.has(slug))
    .map((slug) => `${slug}: formal evidence blocker decision does not map to a seeded package`),
  ...formalEvidenceDecisionSlugs
    .filter((slug) => expectedSlugSet.has(slug) && !localScaffoldSlugSet.has(slug))
    .map((slug) => `${slug}: formal evidence blocker decision is stale because package is not local-scaffold`),
];
const summary = {
  ok: failed.length === 0 && formalBlockerLedgerProblems.length === 0,
  validationMode,
  seedArtifactSource,
  expectedSeedPackages: expectedSlugs.length,
  fixturePackages: packages.length,
  checked: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  artifactPassed: results.filter((result) => result.artifactPassed).length,
  sampleParityChecked: results.filter((result) => result.sampleParityChecked).length,
  sampleParityPassed: results.filter((result) => result.sampleParityPassed).length,
  sampleParitySkipped: results.filter((result) => result.sampleParitySkipped).length,
  sampleRowsTopLevelPresent: results.filter((result) => result.sampleRowsTopLevelPresent).length,
  sampleRowsResultRowsOnly: results.filter((result) => result.sampleRowsResultRowsOnly).length,
  consumerLanguageChecked: results.filter((result) => result.consumerLanguageChecked).length,
  consumerLanguageFailures: results.reduce((sum, result) => sum + (result.consumerLanguageFailures ?? 0), 0),
  consumerLanguageWarnings: results.reduce((sum, result) => sum + (result.consumerLanguageWarnings ?? 0), 0),
  formalPending: formalIncomplete,
  formalIncomplete,
  strictFormalFailures,
  formalBlockerLedger: {
    path: formalEvidenceLedgerPath,
    decisions: formalEvidenceDecisions.length,
    localScaffoldPackages: localScaffoldSlugs.length,
    problems: formalBlockerLedgerProblems,
  },
  warnings: results.reduce((sum, result) => sum + (result.warningCount ?? 0), 0),
  results,
};

if (manifestOut) {
  const manifest = {
    schemaVersion: "soma-reports.agent-bundle-manifest.v1",
    generatedAt: new Date().toISOString(),
    validationMode,
    pathBase: "repo-root",
    summary: {
      ok: summary.ok,
      expectedSeedPackages: summary.expectedSeedPackages,
      fixturePackages: summary.fixturePackages,
      bundleCount: successful.length,
      checked: summary.checked,
      passed: summary.passed,
      failed: summary.failed,
      artifactPassed: summary.artifactPassed,
      sampleParityChecked: summary.sampleParityChecked,
      sampleParityPassed: summary.sampleParityPassed,
      sampleParitySkipped: summary.sampleParitySkipped,
      sampleRowsTopLevelPresent: summary.sampleRowsTopLevelPresent,
      sampleRowsResultRowsOnly: summary.sampleRowsResultRowsOnly,
      consumerLanguageChecked: summary.consumerLanguageChecked,
      consumerLanguageFailures: summary.consumerLanguageFailures,
      consumerLanguageWarnings: summary.consumerLanguageWarnings,
      formalPending: summary.formalPending,
      formalIncomplete: summary.formalIncomplete,
      strictFormalFailures: summary.strictFormalFailures,
      formalBlockerLedger: summary.formalBlockerLedger,
      sampleBackedFormalReady: successful.filter((result) => result.readiness?.sampleBackedFormalReady).length,
      localScaffoldOnly: results.filter(isLocalScaffoldBacklog).length,
      warnings: summary.warnings,
    },
    bundles: successful.map((result) => ({
      slug: result.slug,
      reportPurpose: result.reportPurpose,
      bundlePath: result.outPath,
      promptPath: result.promptPath,
      fixturePath: result.fixturePath,
      resultPath: result.resultPath,
      bundleHash: result.bundleHash,
      bundleFileHash: result.bundleFileHash,
      readiness: result.readiness,
      resultValidated: result.resultValidated,
      formalIncomplete: Boolean(result.formalPending || result.readiness?.localScaffoldOnly),
      strictFormalFailure: Boolean(result.formalPending),
      sampleRowsTopLevelPresent: Boolean(result.sampleRowsTopLevelPresent),
      sampleRowsResultRowsOnly: Boolean(result.sampleRowsResultRowsOnly),
      consumerLanguageChecked: Boolean(result.consumerLanguageChecked),
      consumerLanguageFailures: result.consumerLanguageFailures ?? 0,
      consumerLanguageWarnings: result.consumerLanguageWarnings ?? 0,
      warningCount: result.warningCount ?? 0,
      warnings: result.warnings ?? [],
      validationSummary: result.validationSummary,
      auditHashes: result.auditHashes,
    })),
    failed: failed.map((result) => ({
      slug: result.slug,
      error: result.error,
      errors: result.errors,
      formalPending: Boolean(result.formalPending),
      sampleParitySkipped: Boolean(result.sampleParitySkipped),
      validationSummary: result.validationSummary,
    })),
  };
  mkdirSync(dirname(manifestOut), { recursive: true });
  writeFileSync(manifestOut, `${JSON.stringify(manifest, null, 2)}\n`);
}

await new Promise((resolve, reject) => {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`, (error) => {
    if (error) {
      reject(error);
      return;
    }
    resolve();
  });
});

if (!summary.ok) {
  process.exitCode = 1;
}
