#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const parseArgs = () => {
  const parsed = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const next = process.argv[index + 1];
    parsed.set(arg, next && !next.startsWith("--") ? next : "true");
    if (next && !next.startsWith("--")) {
      index += 1;
    }
  }
  return parsed;
};

const args = parseArgs();
const reportSlug = args.get("--report");
const fixturePath = args.get("--fixture");
const outPath = args.get("--out");
const resultPath = args.get("--result");
const seedArtifactsPath = args.get("--seed-artifacts");

if (!reportSlug || !fixturePath) {
  throw new Error(
    "Usage: npm run agent:bundle -- --report <slug> --fixture <derived-fixture.json> [--out tmp/agent-bundles/<slug>.json] [--result generated-report.json]",
  );
}

const promptPath = `prompts/${reportSlug}.md`;
const prompt = readFileSync(promptPath, "utf8");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const result = resultPath ? JSON.parse(readFileSync(resultPath, "utf8")) : null;
const errors = [];
const warnings = [];
const checks = [];

const scopeFromId = (id) => id.split(".")[0].toLowerCase();

const recordCheck = ({ id, status, severity, path, message }) => {
  checks.push({
    id,
    status,
    severity,
    scope: scopeFromId(id),
    path,
    message,
  });
};

const pass = (id, path, message) => {
  recordCheck({ id, status: "pass", severity: "info", path, message });
};

const fail = (id, path, message) => {
  errors.push(message);
  recordCheck({ id, status: "fail", severity: "error", path, message });
};

const warn = (id, path, message) => {
  warnings.push(message);
  recordCheck({ id, status: "warn", severity: "warning", path, message });
};

const check = (condition, id, path, message) => {
  if (condition) {
    pass(id, path, message);
    return;
  }
  fail(id, path, message);
};

const validationLedger = () => ({
  schemaVersion: "soma-reports.validation-ledger.v1",
  ok: errors.length === 0,
  summary: {
    passed: checks.filter((entry) => entry.status === "pass").length,
    failed: checks.filter((entry) => entry.status === "fail").length,
    warnings: checks.filter((entry) => entry.status === "warn").length,
    notRun: checks.filter((entry) => entry.status === "not_run").length,
  },
  checks,
});

const requireString = (value, path, id) => {
  check(typeof value === "string" && value.trim().length > 0, id, path, `${path} must be a non-empty string`);
};

const sha256 = (value) =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

const readSeedArtifacts = () => {
  const readArtifactFile = (path) => {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  };

  if (seedArtifactsPath) {
    return { artifacts: readArtifactFile(seedArtifactsPath), error: null, source: seedArtifactsPath };
  }

  const defaultCachePath = "tmp/local-artifact-seeds.agent-cache.json";
  if (existsSync(defaultCachePath)) {
    return { artifacts: readArtifactFile(defaultCachePath), error: null, source: defaultCachePath };
  }

  const run = spawnSync("npx", ["convex", "run", "reports:localArtifactSeeds"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
  if (run.status !== 0) {
    return {
      artifacts: [],
      error: run.error?.message || run.stderr.trim() || run.stdout.trim() || `convex run exited with ${run.status}`,
      source: "convex:reports:localArtifactSeeds",
    };
  }

  try {
    const parsed = JSON.parse(run.stdout);
    return {
      artifacts: Array.isArray(parsed) ? parsed : [],
      error: Array.isArray(parsed) ? null : "reports:localArtifactSeeds did not return an array",
      source: "convex:reports:localArtifactSeeds",
    };
  } catch (error) {
    return {
      artifacts: [],
      error: error instanceof Error ? error.message : String(error),
      source: "convex:reports:localArtifactSeeds",
    };
  }
};

const seedArtifactRead = readSeedArtifacts();
const seedArtifact = seedArtifactRead.artifacts.find((artifact) => artifact?.slug === reportSlug) ?? null;
const formalArtifacts = seedArtifact
  ? {
      references: seedArtifact.references ?? [],
      outputSections: seedArtifact.outputSections ?? [],
      formalFields: seedArtifact.formalFields ?? [],
      sampleRows: seedArtifact.sampleRows ?? [],
      genotypeSummary: seedArtifact.genotypeSummary ?? [],
      sourceArtifacts: seedArtifact.sourceArtifacts ?? [],
    }
  : null;

const includesAll = (source, words, path) => {
  const normalized = source.toLowerCase();
  for (const word of words) {
    check(
      normalized.includes(word.toLowerCase()),
      "PROMPT.REQUIRED_TERM_PRESENT",
      `${path}.${word.toLowerCase().replace(/\s+/g, "_")}`,
      `${path} must mention ${word}`,
    );
  }
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

const resultRowsFrom = (value) => {
  if (!value || typeof value !== "object") return [];
  const candidates = [value.resultRows, value.findings, value.results, value.report?.resultRows, value.report?.findings];
  return candidates.find(Array.isArray) ?? [];
};

const appendixFrom = (value) => {
  if (!value || typeof value !== "object") return null;
  return value.appendix ?? value.report?.appendix ?? null;
};

const resultReferencesFrom = (value) => {
  if (!value || typeof value !== "object") return [];
  const candidates = [value.references, value.report?.references];
  return candidates.find(Array.isArray) ?? [];
};

const validateResult = (value) => {
  const appendix = appendixFrom(value);
  const rows = resultRowsFrom(value);
  const allowedReferenceIds = new Set((fixture.referenceResources ?? []).map((resource) => resource.id));
  const resultReferenceIds = new Set(
    resultReferencesFrom(value)
      .map((resource) => resource.id ?? resource.resourceId)
      .filter(Boolean),
  );

  check(
    Boolean(appendix && typeof appendix === "object"),
    "RESULT.APPENDIX_PRESENT",
    "$.appendix",
    "result.appendix must exist and contain probability, uncertainty, and missing-input details",
  );

  check(
    rows.length > 0,
    "RESULT.ROWS_PRESENT",
    "$.resultRows|$.findings",
    "result must contain resultRows[] or findings[]",
  );

  rows.forEach((row, index) => {
    for (const key of ["groupTitle", "item", "brandName", "geneticAnalysis", "genes", "sourceLabel", "plainEnglishMeaning"]) {
      check(
        key in row,
        "RESULT.ROW_FIELD_PRESENT",
        `$.resultRows[${index}].${key}`,
        `result row ${index} must include ${key}`,
      );
    }
    const sourceIds = row.sourceIds;
    const sourceIdsPresent = Array.isArray(sourceIds) && sourceIds.length > 0;
    check(
      sourceIdsPresent,
      "RESULT.ROW_SOURCE_IDS_PRESENT",
      `$.resultRows[${index}].sourceIds`,
      `result row ${index} must include canonical sourceIds[]`,
    );
    if (sourceIdsPresent) {
      for (const [sourceIndex, sourceId] of sourceIds.entries()) {
        const sourceIdIsString = typeof sourceId === "string" && sourceId.trim().length > 0;
        check(
          sourceIdIsString,
          "RESULT.ROW_SOURCE_ID_STRING",
          `$.resultRows[${index}].sourceIds[${sourceIndex}]`,
          `result row ${index} sourceId ${sourceIndex} must be a non-empty string`,
        );
        if (!sourceIdIsString) {
          continue;
        }
        check(
          sourceId === "source-unavailable" || allowedReferenceIds.has(sourceId),
          "RESULT.ROW_SOURCE_ID_ALLOWED",
          `$.resultRows[${index}].sourceIds[${sourceIndex}]`,
          `result row ${index} sourceId must be known or source-unavailable`,
        );
        if (resultReferenceIds.size > 0) {
          check(
            sourceId === "source-unavailable" || resultReferenceIds.has(sourceId),
            "RESULT.ROW_SOURCE_ID_EMITTED_REFERENCE_PRESENT",
            `$.resultRows[${index}].sourceIds[${sourceIndex}]`,
            `result row ${index} sourceId must also appear in result.references[]`,
          );
        }
      }
    }
    if (row.sourceBindingStatus) {
      check(
        ["exact", "curated", "sample_label_only", "unavailable"].includes(row.sourceBindingStatus),
        "RESULT.ROW_SOURCE_BINDING_STATUS_ALLOWED",
        `$.resultRows[${index}].sourceBindingStatus`,
        `result row ${index} sourceBindingStatus must be allowed`,
      );
    } else {
      pass(
        "RESULT.ROW_SOURCE_BINDING_STATUS_ALLOWED",
        `$.resultRows[${index}].sourceBindingStatus`,
        `result row ${index} has no sourceBindingStatus override`,
      );
    }
  });

  const missingInputs = appendix?.missingInputs ?? value.reportOverview?.sectionsUnavailable ?? value.sectionsUnavailable;
  check(
    Array.isArray(missingInputs),
    "RESULT.MISSING_INPUTS_PRESENT",
    "$.appendix.missingInputs",
    "result must include appendix.missingInputs[] or reportOverview.sectionsUnavailable[]",
  );

  const forbiddenRawKeys = ["rawGenome", "rawGenomeData", "vcf", "fastq", "bam", "cram"];
  const probabilityKeys = ["probability", "probabilities", "confidence", "uncertainty", "calibration"];
  const rawFileTerminologyPattern = /\braw\s+genome\b|(?:^|[^A-Za-z0-9])(?:vcf|fastq|bam|cram)(?=$|[^A-Za-z0-9])/i;

  walk(value, (node, path) => {
    const key = path.split(".").pop()?.replace(/\[\d+\]$/, "") ?? "";
    if (forbiddenRawKeys.some((forbidden) => key.toLowerCase() === forbidden.toLowerCase())) {
      fail("PRIVACY.NO_RAW_GENOME_KEYS", path, `${path} must not expose raw genome data`);
    }
    if (probabilityKeys.some((term) => key.toLowerCase().includes(term)) && !path.startsWith("$.appendix") && !path.startsWith("$.report.appendix")) {
      fail("RESULT.PROBABILITY_KEYS_APPENDIX_ONLY", path, `${path} must be inside appendix`);
    }
    if (
      typeof node === "string" &&
      rawFileTerminologyPattern.test(node) &&
      !path.startsWith("$.appendix.limitations")
    ) {
      warn(
        "PRIVACY.RAW_FILE_TERMINOLOGY_LIMITATION_ONLY",
        path,
        `${path} mentions raw genome/file terminology; confirm it is only a limitation, not emitted data`,
      );
    }
  });
};

includesAll(prompt, ["deterministic", "appendix", "probability", "plain English", "raw genome"], "prompt");

check(fixture.packageSlug === reportSlug, "FIXTURE.PACKAGE_SLUG_MATCH", "$.packageSlug", `fixture.packageSlug must equal ${reportSlug}`);

check(
  fixture.inputManifest?.rawGenomeReturned === false,
  "FIXTURE.INPUT_MANIFEST_RAW_GENOME_RETURNED_FALSE",
  "$.inputManifest.rawGenomeReturned",
  "fixture.inputManifest.rawGenomeReturned must be false",
);

requireString(fixture.datasetId, "fixture.datasetId", "FIXTURE.DATASET_ID_PRESENT");
requireString(fixture.packageVersion, "fixture.packageVersion", "FIXTURE.PACKAGE_VERSION_PRESENT");
requireString(fixture.reportPurpose, "fixture.reportPurpose", "FIXTURE.REPORT_PURPOSE_PRESENT");
requireString(fixture.missingInputPolicy, "fixture.missingInputPolicy", "FIXTURE.MISSING_INPUT_POLICY_PRESENT");
requireString(fixture.consumerTone, "fixture.consumerTone", "FIXTURE.CONSUMER_TONE_PRESENT");
requireString(fixture.inputManifest?.hash, "fixture.inputManifest.hash", "FIXTURE.INPUT_MANIFEST_HASH_PRESENT");
requireString(
  fixture.inputManifest?.genomeBuild,
  "fixture.inputManifest.genomeBuild",
  "FIXTURE.INPUT_MANIFEST_GENOME_BUILD_PRESENT",
);
requireString(fixture.inputManifest?.source, "fixture.inputManifest.source", "FIXTURE.INPUT_MANIFEST_SOURCE_PRESENT");

const hasGenomeEvidence = Array.isArray(fixture.genomeEvidence) && fixture.genomeEvidence.length > 0;
check(
  hasGenomeEvidence,
  "FIXTURE.GENOME_EVIDENCE_NONEMPTY",
  "$.genomeEvidence",
  "fixture.genomeEvidence must contain at least one derived evidence row",
);
if (hasGenomeEvidence) {
  for (const [index, evidence] of fixture.genomeEvidence.entries()) {
    requireString(evidence.inputId, `fixture.genomeEvidence[${index}].inputId`, "FIXTURE.EVIDENCE_INPUT_ID_PRESENT");
    requireString(evidence.gene, `fixture.genomeEvidence[${index}].gene`, "FIXTURE.EVIDENCE_GENE_PRESENT");
    requireString(
      evidence.observedValue,
      `fixture.genomeEvidence[${index}].observedValue`,
      "FIXTURE.EVIDENCE_OBSERVED_VALUE_PRESENT",
    );
    requireString(evidence.assembly, `fixture.genomeEvidence[${index}].assembly`, "FIXTURE.EVIDENCE_ASSEMBLY_PRESENT");
    requireString(
      evidence.matchStatus,
      `fixture.genomeEvidence[${index}].matchStatus`,
      "FIXTURE.EVIDENCE_MATCH_STATUS_PRESENT",
    );
    requireString(evidence.sourceFile, `fixture.genomeEvidence[${index}].sourceFile`, "FIXTURE.EVIDENCE_SOURCE_FILE_PRESENT");
    requireString(
      evidence.sourceArtifact,
      `fixture.genomeEvidence[${index}].sourceArtifact`,
      "FIXTURE.EVIDENCE_SOURCE_ARTIFACT_PRESENT",
    );
    check(
      Boolean(evidence.rsid || evidence.starAllele || evidence.haplotype),
      "FIXTURE.EVIDENCE_VARIANT_ID_PRESENT",
      `fixture.genomeEvidence[${index}]`,
      `fixture.genomeEvidence[${index}] must include rsid, starAllele, or haplotype`,
    );
  }
}

const hasReferenceResources = Array.isArray(fixture.referenceResources) && fixture.referenceResources.length > 0;
check(
  hasReferenceResources,
  "FIXTURE.REFERENCE_RESOURCES_NONEMPTY",
  "$.referenceResources",
  "fixture.referenceResources must contain at least one resource",
);
if (hasReferenceResources) {
  for (const [index, resource] of fixture.referenceResources.entries()) {
    requireString(resource.id, `fixture.referenceResources[${index}].id`, "FIXTURE.REFERENCE_ID_PRESENT");
    requireString(resource.title, `fixture.referenceResources[${index}].title`, "FIXTURE.REFERENCE_TITLE_PRESENT");
    requireString(
      resource.sourceType,
      `fixture.referenceResources[${index}].sourceType`,
      "FIXTURE.REFERENCE_SOURCE_TYPE_PRESENT",
    );
  }
}

if (seedArtifactRead.error) {
  warn(
    "BUNDLE.SEED_ARTIFACT_LOAD_WARNING",
    "seedArtifacts",
    `formal seed artifacts unavailable from ${seedArtifactRead.source}: ${seedArtifactRead.error}`,
  );
} else {
  check(
    Boolean(seedArtifact),
    "BUNDLE.SEED_ARTIFACT_PRESENT",
    "seedArtifacts",
    `seed artifacts must include ${reportSlug}`,
  );
}

if (formalArtifacts) {
  for (const [key, value] of Object.entries(formalArtifacts)) {
    check(Array.isArray(value), "BUNDLE.FORMAL_ARTIFACT_ARRAY", `formalArtifacts.${key}`, `${key} must be an array`);
  }
  if (formalArtifacts.sampleRows.length > 0) {
    check(
      formalArtifacts.formalFields.length > 0,
      "BUNDLE.FORMAL_FIELDS_FOR_SAMPLE_REPORT",
      "formalArtifacts.formalFields",
      "sample-backed reports must expose formal field mappings to the local agent bundle",
    );
    check(
      formalArtifacts.outputSections.length > 0,
      "BUNDLE.OUTPUT_SECTIONS_FOR_SAMPLE_REPORT",
      "formalArtifacts.outputSections",
      "sample-backed reports must expose output sections to the local agent bundle",
    );
    check(
      formalArtifacts.genotypeSummary.length > 0,
      "BUNDLE.GENOTYPE_SUMMARY_FOR_SAMPLE_REPORT",
      "formalArtifacts.genotypeSummary",
      "sample-backed reports must expose genotype summaries to the local agent bundle",
    );
  }
}

const expected = fixture.expectedAssertions ?? {};
for (const assertion of [
  "noRawGenomeInOutput",
  "everyFindingHasReference",
  "missingInputsAreExplicit",
  "probabilitiesOnlyInAppendix",
  "consumerLanguage",
]) {
  check(
    expected[assertion] === true,
    "FIXTURE.EXPECTED_ASSERTION_TRUE",
    `fixture.expectedAssertions.${assertion}`,
    `fixture.expectedAssertions.${assertion} must be true`,
  );
}

if (result) {
  validateResult(result);
}

if (errors.length > 0) {
  console.error(JSON.stringify({ ok: false, errors, warnings, validationLedger: validationLedger() }, null, 2));
  process.exit(1);
}

const bundleCore = {
  schemaVersion: "soma-reports.agent-bundle.v1",
  reportSlug,
  promptPath,
  fixturePath,
  privacyBoundary: {
    rawGenomeIncluded: false,
    derivedEvidenceOnly: true,
    uploadRequired: false,
  },
  agentInstructions: [
    "Use the prompt exactly as supplied unless the user explicitly asks for edits.",
    "Use fixture.genomeEvidence, fixture.referenceResources, and formalArtifacts as evidence.",
    "When formalArtifacts.sampleRows are present, preserve their report structure and source bindings.",
    "Return deterministic report JSON first.",
    "Put probability, confidence, and uncertainty in the appendix only.",
    "Do not include raw genome data in output.",
  ],
  outputValidation: {
    resultPath: resultPath ?? null,
    checks: [
      "raw genome data is absent",
      "resultRows[] or findings[] exist",
      "each result row includes groupTitle, item, brandName, geneticAnalysis, genes, sourceLabel, and plainEnglishMeaning",
      "each finding cites canonical sourceIds[]",
      "each cited sourceIds[] entry appears in result.references[] when the result emits references",
      "probability, confidence, calibration, and uncertainty keys only appear under appendix",
      "prompt requires deterministic sections before appendix probabilities",
    ],
  },
  agentRunInput: {
    reportPurpose: fixture.reportPurpose,
    referenceResources: fixture.referenceResources,
    formalArtifacts,
    genomeEvidence: fixture.genomeEvidence,
    missingInputPolicy: fixture.missingInputPolicy,
    consumerTone: fixture.consumerTone,
  },
  prompt,
  fixture,
  formalArtifacts,
};

const bundle = {
  ...bundleCore,
  generatedAt: new Date().toISOString(),
  bundleHash: sha256(bundleCore),
};

const text = `${JSON.stringify(bundle, null, 2)}\n`;

if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, text);
  console.log(
    JSON.stringify(
      {
        ok: true,
        outPath,
        reportSlug,
        evidenceRows: fixture.genomeEvidence.length,
        formalArtifactsLoaded: Boolean(formalArtifacts),
        resultValidated: Boolean(result),
        warnings,
        validationLedger: validationLedger(),
      },
      null,
      2,
    ),
  );
} else {
  process.stdout.write(text);
}
