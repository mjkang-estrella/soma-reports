#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const expected = {
  marketplacePositions: 164,
  namedPackages: 154,
  unidentifiedAuthenticatedSlots: 0,
};

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

const format = args.get("--format") ?? "json";
if (!["json", "compact"].includes(format)) {
  throw new Error(`Unsupported --format ${format}; expected json or compact`);
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const readText = (path) => readFileSync(path, "utf8");
const readOptionalJson = (path, fallback) => (existsSync(path) ? readJson(path) : fallback);
const isPlainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isNonEmptyStringArray = (value) => Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
const isStringArray = (value) => Array.isArray(value) && value.every(isNonEmptyString);
const isObjectArray = (value) => Array.isArray(value) && value.every(isPlainObject);

const slugsForFiles = (dir, suffix) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((file) => file.endsWith(suffix))
        .map((file) => basename(file, suffix))
        .sort()
    : [];

const resultRowsFrom = (value) => {
  if (!value || typeof value !== "object") return [];
  const candidates = [value.resultRows, value.findings, value.results, value.report?.resultRows, value.report?.findings];
  return candidates.find(Array.isArray) ?? [];
};

const referencesFrom = (value) => {
  if (!value || typeof value !== "object") return [];
  const candidates = [value.references, value.report?.references];
  return candidates.find(Array.isArray) ?? [];
};

const appendixFrom = (value) => {
  if (!value || typeof value !== "object") return null;
  return value.appendix ?? value.report?.appendix ?? null;
};

const walk = (value, visit, path = "$") => {
  visit(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      walk(child, visit, `${path}.${key}`);
    }
  }
};

const sourceIdsFromRow = (row) => {
  if (!row || typeof row !== "object") return [];
  const sourceIds = row.sourceIds ?? row.sourceResourceIds ?? [];
  return Array.isArray(sourceIds) ? sourceIds.filter(isNonEmptyString) : [];
};

const sha256Text = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const representativeBundleContractSlug = "wellness-genetic-guide";

const runBundleContractProbe = () => {
  const fixturePath = join("fixtures/synthetic", `${representativeBundleContractSlug}.fixture.json`);
  const resultPath = join("fixtures/synthetic", `${representativeBundleContractSlug}.result.json`);
  const run = spawnSync(
    process.execPath,
    [
      "scripts/agent-bundle.mjs",
      "--report",
      representativeBundleContractSlug,
      "--fixture",
      fixturePath,
      "--result",
      resultPath,
    ],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 20,
    },
  );
  if (run.status !== 0) {
    return {
      ok: false,
      slug: representativeBundleContractSlug,
      error: run.stderr.trim() || run.stdout.trim() || `agent-bundle exited with ${run.status}`,
    };
  }

  let bundle;
  try {
    bundle = JSON.parse(run.stdout);
  } catch (error) {
    return {
      ok: false,
      slug: representativeBundleContractSlug,
      error: `agent-bundle stdout was not JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const requiredOutputShape = bundle.outputValidation?.requiredOutputShape;
  const appendixFields = requiredOutputShape?.appendix?.fields ?? [];
  const resultRowFields = requiredOutputShape?.resultRows?.rowFields ?? [];
  const requiredTopLevel = ["reportOverview", "resultRows", "references", "appendix"];
  const missingTopLevel = requiredTopLevel.filter((key) => !isPlainObject(requiredOutputShape?.[key]));
  const missingAppendixFields = ["probabilities", "uncertainty", "missingInputs", "limitations", "genotypeSummary"].filter(
    (field) => !appendixFields.includes(field),
  );
  const missingRowFields = ["plainEnglishMeaning", "sourceIds"].filter((field) => !resultRowFields.includes(field));
  const instructionMentionsContract = (bundle.agentInstructions ?? []).some(
    (instruction) => typeof instruction === "string" && instruction.includes("outputValidation.requiredOutputShape"),
  );

  return {
    ok:
      missingTopLevel.length === 0 &&
      missingAppendixFields.length === 0 &&
      missingRowFields.length === 0 &&
      instructionMentionsContract,
    slug: representativeBundleContractSlug,
    missingTopLevel,
    missingAppendixFields,
    missingRowFields,
    instructionMentionsContract,
  };
};

const probabilityKeyFragments = ["probability", "probabilities", "confidence", "uncertainty", "calibration"];
const forbiddenRawKeys = new Set(["rawgenome", "rawgenomedata", "vcf", "fastq", "bam", "cram"]);
const probabilityTextPattern = /\b(probability|probabilities|confidence|uncertainty|calibration|calibrated|clinical sensitivity)\b/i;
const probabilityBoundaryTextPattern =
  /\b(unavailable|missing|not supplied|does not|do not|cannot|no calibrated|no probability|not quantified|not calculated|not supported|without a calibrated|not infer|not a local|pending|appendix only|belongs in the appendix)\b/i;

const addProblem = (problems, slug, path, message) => {
  problems.push({ slug, path, message });
};

const addWarning = (warnings, slug, path, message, details = {}) => {
  warnings.push({ slug, path, message, ...details });
};

const bodyProbabilityLanguageReviewPath = "reference/catalog/body-probability-language-review.json";
const bodyProbabilityLanguageReview = readOptionalJson(bodyProbabilityLanguageReviewPath, {
  schemaVersion: "soma-reports.body-probability-language-review.v1",
  entries: [],
});
const bodyProbabilityLanguageReviewProblems = [];
const allowedBodyProbabilityReviewDecisions = new Set([
  "boundary-language",
  "sample-structure-boundary",
  "rewrite-needed",
]);
const bodyProbabilityReviewEntries = Array.isArray(bodyProbabilityLanguageReview.entries)
  ? bodyProbabilityLanguageReview.entries
  : [];
const bodyProbabilityReviewByKey = new Map();
const bodyProbabilityReviewDuplicateKeys = new Set();
for (const entry of bodyProbabilityReviewEntries) {
  const key = `${entry?.slug ?? ""}\u0000${entry?.path ?? ""}\u0000${entry?.textHash ?? ""}`;
  if (bodyProbabilityReviewByKey.has(key)) {
    bodyProbabilityReviewDuplicateKeys.add(key);
  }
  bodyProbabilityReviewByKey.set(key, entry);
}
const currentBodyProbabilityWarningKeys = new Set();
let bodyProbabilityLanguageReviewed = 0;
let bodyProbabilityLanguageRewriteNeeded = 0;

const coverage = readJson("reference/catalog/sequencing-marketplace-coverage.json");
const normalizedAuthenticatedCatalog = readJson(
  "reference/catalog/sequencing-authenticated-marketplace-normalized-2026-06-21.json",
);

const promptSlugs = slugsForFiles("prompts", ".md");
const fixtureSlugs = slugsForFiles("fixtures/synthetic", ".fixture.json");
const resultSlugs = slugsForFiles("fixtures/synthetic", ".result.json");
const allSlugs = [...new Set([...promptSlugs, ...fixtureSlugs, ...resultSlugs])].sort();
const promptSlugSet = new Set(promptSlugs);
const fixtureSlugSet = new Set(fixtureSlugs);
const resultSlugSet = new Set(resultSlugs);

const problems = [];
const warnings = [];
const packageRows = [];
const totals = {
  marketplacePositions: coverage.targetTotal,
  authenticatedCardPositions: normalizedAuthenticatedCatalog.totals?.authenticatedCardPositions,
  authenticatedUniqueHrefs: normalizedAuthenticatedCatalog.totals?.authenticatedUniqueHrefs,
  authenticatedDuplicateCardPositions: normalizedAuthenticatedCatalog.totals?.authenticatedDuplicateCardPositions,
  namedPackages: coverage.counts?.identifiedNamedTotal,
  unidentifiedAuthenticatedSlots: coverage.counts?.unidentifiedAuthenticatedSlots,
  promptArtifacts: promptSlugs.length,
  fixtureArtifacts: fixtureSlugs.length,
  resultArtifacts: resultSlugs.length,
  packagesChecked: allSlugs.length,
  resultRows: 0,
  sourceBoundResultRows: 0,
  plainEnglishResultRows: 0,
  appendixProbabilityArrays: 0,
  appendixUncertaintyArrays: 0,
  appendixLimitationArrays: 0,
  referenceResourceRows: 0,
  resultReferenceRows: 0,
  bodyProbabilityTextReviewWarnings: 0,
};

const checkTopLevelCounts = () => {
  const countChecks = [
    [coverage.targetTotal, expected.marketplacePositions, "coverage.targetTotal must remain 164"],
    [
      coverage.authenticatedBrowserCapture?.visibleCardTotal,
      expected.marketplacePositions,
      "authenticated visible card positions must remain 164",
    ],
    [
      normalizedAuthenticatedCatalog.totals?.authenticatedCardPositions,
      expected.marketplacePositions,
      "normalized authenticated card positions must remain 164",
    ],
    [
      normalizedAuthenticatedCatalog.positionLedger?.positions?.length,
      expected.marketplacePositions,
      "position ledger must retain all 164 captured positions",
    ],
    [coverage.counts?.identifiedNamedTotal, expected.namedPackages, "identified named packages must remain 154"],
    [coverage.counts?.seededRecordsExpected, expected.namedPackages, "seeded package expectation must remain 154"],
    [
      coverage.counts?.unidentifiedAuthenticatedSlots,
      expected.unidentifiedAuthenticatedSlots,
      "unidentified authenticated slots must remain zero",
    ],
    [promptSlugs.length, expected.namedPackages, "prompt artifact count must remain 154"],
    [fixtureSlugs.length, expected.namedPackages, "fixture artifact count must remain 154"],
    [resultSlugs.length, expected.namedPackages, "result artifact count must remain 154"],
  ];

  for (const [actual, required, message] of countChecks) {
    if (actual !== required) {
      addProblem(problems, "catalog", "$", `${message}; saw ${actual}`);
    }
  }

  for (const slug of allSlugs) {
    if (!promptSlugSet.has(slug)) addProblem(problems, slug, `prompts/${slug}.md`, "missing prompt artifact");
    if (!fixtureSlugSet.has(slug)) {
      addProblem(problems, slug, `fixtures/synthetic/${slug}.fixture.json`, "missing local genome fixture artifact");
    }
    if (!resultSlugSet.has(slug)) {
      addProblem(problems, slug, `fixtures/synthetic/${slug}.result.json`, "missing deterministic result artifact");
    }
  }
};

const validatePrompt = (slug, prompt) => {
  const normalized = prompt.toLowerCase();
  for (const term of ["deterministic", "appendix", "probability", "plain english", "raw genome"]) {
    if (!normalized.includes(term)) {
      addProblem(problems, slug, `prompts/${slug}.md`, `prompt must mention ${term}`);
    }
  }
  if (!/every result row must cite .*reference ids/i.test(prompt)) {
    addProblem(
      problems,
      slug,
      `prompts/${slug}.md`,
      "prompt must require every result row to cite provided reference IDs",
    );
  }
  if (!/sourceIds|sourceResourceIds/.test(prompt)) {
    addProblem(
      problems,
      slug,
      `prompts/${slug}.md`,
      "prompt must name sourceIds or sourceResourceIds for row-level citation output",
    );
  }
};

const validateFixture = (slug, fixture) => {
  if (fixture.packageSlug !== slug) {
    addProblem(problems, slug, "$.packageSlug", `fixture.packageSlug must equal ${slug}`);
  }
  if (fixture.inputManifest?.rawGenomeReturned !== false) {
    addProblem(problems, slug, "$.inputManifest.rawGenomeReturned", "fixture must explicitly keep raw genome data out");
  }
  if (!isNonEmptyString(fixture.inputManifest?.hash) || !fixture.inputManifest.hash.startsWith("sha256:")) {
    addProblem(problems, slug, "$.inputManifest.hash", "fixture must expose a deterministic input manifest hash");
  }
  if (!isNonEmptyString(fixture.inputManifest?.genomeBuild)) {
    addProblem(problems, slug, "$.inputManifest.genomeBuild", "fixture must name the genome build");
  }
  if (!isNonEmptyString(fixture.consumerTone) || !/plain english/i.test(fixture.consumerTone)) {
    addProblem(problems, slug, "$.consumerTone", "fixture must require plain-English consumer tone");
  }
  if (!Array.isArray(fixture.genomeEvidence) || fixture.genomeEvidence.length === 0) {
    addProblem(problems, slug, "$.genomeEvidence", "fixture must include derived local genome evidence rows");
  }
  if (!Array.isArray(fixture.referenceResources) || fixture.referenceResources.length === 0) {
    addProblem(problems, slug, "$.referenceResources", "fixture must include reference research resources");
  } else {
    totals.referenceResourceRows += fixture.referenceResources.length;
    fixture.referenceResources.forEach((resource, index) => {
      if (!isNonEmptyString(resource.id)) {
        addProblem(problems, slug, `$.referenceResources[${index}].id`, "reference resource must have an id");
      }
      if (!isNonEmptyString(resource.title)) {
        addProblem(problems, slug, `$.referenceResources[${index}].title`, "reference resource must have a title");
      }
      if (!isNonEmptyString(resource.sourceType)) {
        addProblem(problems, slug, `$.referenceResources[${index}].sourceType`, "reference resource must name a source type");
      }
    });
  }

  const assertions = fixture.expectedAssertions ?? {};
  for (const assertion of [
    "noRawGenomeInOutput",
    "everyFindingHasReference",
    "missingInputsAreExplicit",
    "probabilitiesOnlyInAppendix",
    "consumerLanguage",
  ]) {
    if (assertions[assertion] !== true) {
      addProblem(problems, slug, `$.expectedAssertions.${assertion}`, `${assertion} must be true`);
    }
  }
};

const validateResult = (slug, result, fixture) => {
  const rows = resultRowsFrom(result);
  const references = referencesFrom(result);
  const appendix = appendixFrom(result);
  const fixtureReferenceIds = new Set((fixture.referenceResources ?? []).map((resource) => resource.id));
  const emittedReferenceIds = new Set(references.map((resource) => resource.id ?? resource.resourceId).filter(Boolean));

  if (!result.reportOverview || typeof result.reportOverview !== "object") {
    addProblem(problems, slug, "$.reportOverview", "result must include reportOverview");
  }
  if (!isNonEmptyString(result.reportOverview?.inputManifestHash) || !result.reportOverview.inputManifestHash.startsWith("sha256:")) {
    addProblem(problems, slug, "$.reportOverview.inputManifestHash", "result must include deterministic input manifest hash");
  }
  if (rows.length === 0) {
    addProblem(problems, slug, "$.resultRows|$.findings", "result must include generated finding rows");
  }
  if (!Array.isArray(references) || references.length === 0) {
    addProblem(problems, slug, "$.references", "result must emit reference resources");
  }

  totals.resultRows += rows.length;
  totals.resultReferenceRows += references.length;

  rows.forEach((row, index) => {
    if (!isNonEmptyString(row.plainEnglishMeaning)) {
      addProblem(problems, slug, `$.resultRows[${index}].plainEnglishMeaning`, "result row must include plain-English meaning");
    } else {
      totals.plainEnglishResultRows += 1;
    }

    const sourceIds = sourceIdsFromRow(row);
    if (sourceIds.length === 0) {
      addProblem(problems, slug, `$.resultRows[${index}].sourceIds`, "result row must include canonical sourceIds");
    } else {
      totals.sourceBoundResultRows += 1;
    }

    for (const [sourceIndex, sourceId] of sourceIds.entries()) {
      if (sourceId !== "source-unavailable" && !fixtureReferenceIds.has(sourceId)) {
        addProblem(
          problems,
          slug,
          `$.resultRows[${index}].sourceIds[${sourceIndex}]`,
          `sourceId ${sourceId} must appear in fixture.referenceResources`,
        );
      }
      if (emittedReferenceIds.size > 0 && sourceId !== "source-unavailable" && !emittedReferenceIds.has(sourceId)) {
        addProblem(
          problems,
          slug,
          `$.resultRows[${index}].sourceIds[${sourceIndex}]`,
          `sourceId ${sourceId} must appear in result.references`,
        );
      }
    }
  });

  if (!appendix || typeof appendix !== "object") {
    addProblem(problems, slug, "$.appendix", "result must include an appendix");
  } else {
    if (!isObjectArray(appendix.probabilities)) {
      addProblem(problems, slug, "$.appendix.probabilities", "appendix.probabilities must be an object array");
    } else {
      totals.appendixProbabilityArrays += 1;
    }
    if (!isNonEmptyStringArray(appendix.uncertainty)) {
      addProblem(problems, slug, "$.appendix.uncertainty", "appendix.uncertainty must explain confidence or calibration limits");
    } else {
      totals.appendixUncertaintyArrays += 1;
    }
    if (!isStringArray(appendix.missingInputs)) {
      addProblem(problems, slug, "$.appendix.missingInputs", "appendix.missingInputs must be a string array");
    }
    if (!isNonEmptyStringArray(appendix.limitations)) {
      addProblem(problems, slug, "$.appendix.limitations", "appendix.limitations must explain scope or source limits");
    } else {
      totals.appendixLimitationArrays += 1;
    }
  }

  walk(result, (node, path) => {
    const key = path.split(".").pop()?.replace(/\[\d+\]$/, "") ?? "";
    const normalizedKey = key.toLowerCase();
    if (forbiddenRawKeys.has(normalizedKey)) {
      addProblem(problems, slug, path, "result must not expose raw genome/file data keys");
    }
    if (
      probabilityKeyFragments.some((fragment) => normalizedKey.includes(fragment)) &&
      !path.startsWith("$.appendix") &&
      !path.startsWith("$.report.appendix")
    ) {
      addProblem(problems, slug, path, "probability/confidence/calibration keys must appear only inside appendix");
    }
    if (
      typeof node === "string" &&
      probabilityTextPattern.test(node) &&
      !path.startsWith("$.appendix") &&
      !path.startsWith("$.report.appendix") &&
      !path.toLowerCase().includes("limitations") &&
      !probabilityBoundaryTextPattern.test(node)
    ) {
      const textHash = sha256Text(node);
      const reviewKey = `${slug}\u0000${path}\u0000${textHash}`;
      const review = bodyProbabilityReviewByKey.get(reviewKey) ?? null;
      currentBodyProbabilityWarningKeys.add(reviewKey);
      if (!review) {
        bodyProbabilityLanguageReviewProblems.push({
          slug,
          path,
          textHash,
          message: "non-appendix probability/confidence/calibration language needs a review ledger entry",
        });
      } else if (!allowedBodyProbabilityReviewDecisions.has(review.decision)) {
        bodyProbabilityLanguageReviewProblems.push({
          slug,
          path,
          textHash,
          decision: review.decision,
          message: "review decision must be boundary-language or sample-structure-boundary",
        });
      } else if (review.decision === "rewrite-needed") {
        bodyProbabilityLanguageRewriteNeeded += 1;
        bodyProbabilityLanguageReviewProblems.push({
          slug,
          path,
          textHash,
          decision: review.decision,
          message: "reviewed body probability language is marked rewrite-needed",
        });
      } else {
        bodyProbabilityLanguageReviewed += 1;
      }
      addWarning(
        warnings,
        slug,
        path,
        "body text mentions probability/confidence/calibration outside appendix; review as boundary language",
        {
          textHash,
          textPreview: node.slice(0, 220),
          reviewDecision: review?.decision ?? null,
        },
      );
      totals.bodyProbabilityTextReviewWarnings += 1;
    }
  });
};

checkTopLevelCounts();

for (const slug of allSlugs) {
  const promptPath = `prompts/${slug}.md`;
  const fixturePath = join("fixtures/synthetic", `${slug}.fixture.json`);
  const resultPath = join("fixtures/synthetic", `${slug}.result.json`);
  if (!existsSync(promptPath) || !existsSync(fixturePath) || !existsSync(resultPath)) {
    continue;
  }

  const prompt = readText(promptPath);
  const fixture = readJson(fixturePath);
  const result = readJson(resultPath);
  validatePrompt(slug, prompt);
  validateFixture(slug, fixture);
  validateResult(slug, result, fixture);

  packageRows.push({
    slug,
    prompt: true,
    fixture: true,
    result: true,
    resultRows: resultRowsFrom(result).length,
    references: referencesFrom(result).length,
    appendix: Boolean(appendixFrom(result)),
  });
}

for (const duplicateKey of bodyProbabilityReviewDuplicateKeys) {
  const [slug, path, textHash] = duplicateKey.split("\u0000");
  bodyProbabilityLanguageReviewProblems.push({
    slug,
    path,
    textHash,
    message: "duplicate body probability language review entry",
  });
}

for (const entry of bodyProbabilityReviewEntries) {
  const key = `${entry?.slug ?? ""}\u0000${entry?.path ?? ""}\u0000${entry?.textHash ?? ""}`;
  if (!currentBodyProbabilityWarningKeys.has(key)) {
    bodyProbabilityLanguageReviewProblems.push({
      slug: entry?.slug ?? "unknown",
      path: entry?.path ?? "$",
      textHash: entry?.textHash ?? "",
      message: "stale body probability language review entry no longer matches current output text",
    });
  }
}

totals.bodyProbabilityLanguageReviewEntries = bodyProbabilityReviewEntries.length;
totals.bodyProbabilityLanguageReviewed = bodyProbabilityLanguageReviewed;
totals.bodyProbabilityLanguageRewriteNeeded = bodyProbabilityLanguageRewriteNeeded;
totals.bodyProbabilityLanguageReviewProblems = bodyProbabilityLanguageReviewProblems.length;

const bundleContractProbe = runBundleContractProbe();

const checks = [
  {
    key: "marketplace_position_count",
    ok: totals.marketplacePositions === expected.marketplacePositions,
    expected: expected.marketplacePositions,
    actual: totals.marketplacePositions,
  },
  {
    key: "named_package_count",
    ok: totals.namedPackages === expected.namedPackages && totals.packagesChecked === expected.namedPackages,
    expected: expected.namedPackages,
    actual: { namedPackages: totals.namedPackages, packagesChecked: totals.packagesChecked },
  },
  {
    key: "prompt_fixture_result_artifacts",
    ok:
      totals.promptArtifacts === expected.namedPackages &&
      totals.fixtureArtifacts === expected.namedPackages &&
      totals.resultArtifacts === expected.namedPackages,
    expected: "154 prompts, 154 fixtures, and 154 deterministic results",
    actual: {
      promptArtifacts: totals.promptArtifacts,
      fixtureArtifacts: totals.fixtureArtifacts,
      resultArtifacts: totals.resultArtifacts,
    },
  },
  {
    key: "reference_research_resources",
    ok: totals.referenceResourceRows >= expected.namedPackages && totals.resultReferenceRows >= expected.namedPackages,
    expected: "each package has fixture references and emitted result references",
    actual: { fixtureReferenceRows: totals.referenceResourceRows, resultReferenceRows: totals.resultReferenceRows },
  },
  {
    key: "deterministic_plain_english_outputs",
    ok: totals.resultRows > 0 && totals.plainEnglishResultRows === totals.resultRows,
    expected: "every generated finding row includes plainEnglishMeaning",
    actual: { resultRows: totals.resultRows, plainEnglishResultRows: totals.plainEnglishResultRows },
  },
  {
    key: "source_bound_outputs",
    ok: totals.resultRows > 0 && totals.sourceBoundResultRows === totals.resultRows,
    expected: "every generated finding row cites canonical sourceIds",
    actual: { resultRows: totals.resultRows, sourceBoundResultRows: totals.sourceBoundResultRows },
  },
  {
    key: "appendix_probability_contract",
    ok:
      totals.appendixProbabilityArrays === expected.namedPackages &&
      totals.appendixUncertaintyArrays === expected.namedPackages &&
      totals.appendixLimitationArrays === expected.namedPackages,
    expected: "all 154 results expose appendix probability, uncertainty, and limitation arrays",
    actual: {
      probabilityArrays: totals.appendixProbabilityArrays,
      uncertaintyArrays: totals.appendixUncertaintyArrays,
      limitationArrays: totals.appendixLimitationArrays,
    },
  },
  {
    key: "agent_bundle_required_output_shape",
    ok: bundleContractProbe.ok,
    expected:
      "representative local-agent bundle exposes outputValidation.requiredOutputShape and an instruction to use it",
    actual: bundleContractProbe,
  },
  {
    key: "body_probability_language_review",
    ok:
      bodyProbabilityLanguageReview.schemaVersion === "soma-reports.body-probability-language-review.v1" &&
      bodyProbabilityLanguageReviewProblems.length === 0 &&
      bodyProbabilityLanguageReviewed === warnings.length,
    expected:
      "every non-appendix probability/confidence/calibration text hit is hash-reviewed as boundary or sample-structure language",
    actual: {
      reviewPath: bodyProbabilityLanguageReviewPath,
      warnings: warnings.length,
      reviewEntries: bodyProbabilityReviewEntries.length,
      reviewed: bodyProbabilityLanguageReviewed,
      rewriteNeeded: bodyProbabilityLanguageRewriteNeeded,
      problems: bodyProbabilityLanguageReviewProblems.slice(0, 20),
    },
  },
  {
    key: "no_structural_privacy_or_probability_violations",
    ok: problems.length === 0,
    expected: "no raw genome keys, missing artifacts, source gaps, or non-appendix probability keys",
    actual: { problems: problems.length },
  },
];

const summary = {
  schemaVersion: "soma-reports.objective-coverage-audit.v1",
  generatedAt: new Date().toISOString(),
  ok: checks.every((check) => check.ok) && problems.length === 0,
  expected,
  totals,
  checks,
  problems,
  warnings,
  bodyProbabilityLanguageReview: {
    path: bodyProbabilityLanguageReviewPath,
    entries: bodyProbabilityReviewEntries.length,
    reviewed: bodyProbabilityLanguageReviewed,
    rewriteNeeded: bodyProbabilityLanguageRewriteNeeded,
    problems: bodyProbabilityLanguageReviewProblems,
  },
  bundleContractProbe,
  packageRows,
  privacyBoundary:
    "This audit reads prompts, synthetic derived fixtures, deterministic result JSON, and catalog metadata only. It does not read raw genome files or private completed-report payloads.",
};

const compactSummary = {
  schemaVersion: summary.schemaVersion,
  generatedAt: summary.generatedAt,
  ok: summary.ok,
  expected: summary.expected,
  totals: summary.totals,
  failedChecks: checks.filter((check) => !check.ok),
  problemCount: problems.length,
  problems: problems.slice(0, 25),
  warningCount: warnings.length,
  warningSample: warnings.slice(0, 10),
  bodyProbabilityLanguageReview: summary.bodyProbabilityLanguageReview,
  bundleContractProbe: summary.bundleContractProbe,
};

console.log(JSON.stringify(format === "compact" ? compactSummary : summary, null, 2));

if (!summary.ok) {
  process.exit(1);
}
