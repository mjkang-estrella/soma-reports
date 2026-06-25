#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { evaluateConsumerLanguageRows } from "./lib/consumer-language.mjs";
import { loadArtifactSeeds } from "./lib/local-artifact-seeds.mjs";

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
const validationMode = args.get("--validation-mode") ?? "local";
const validationModes = new Set(["local", "sample-parity", "formal-ready"]);
const formalEvidenceLedgerPath = "reference/catalog/sample-promotion-rejections-2026-06-23.json";

if (!validationModes.has(validationMode)) {
  throw new Error(`Unsupported --validation-mode ${validationMode}; expected local, sample-parity, or formal-ready`);
}

if (!reportSlug || !fixturePath) {
  throw new Error(
    "Usage: npm run agent:bundle -- --report <slug> --fixture <derived-fixture.json> [--out tmp/agent-bundles/<slug>.validated.json] [--result generated-report.json] [--validation-mode local|sample-parity|formal-ready]",
  );
}

const promptPath = `prompts/${reportSlug}.md`;
const prompt = readFileSync(promptPath, "utf8");
const fixtureText = readFileSync(fixturePath, "utf8");
const fixture = JSON.parse(fixtureText);
const resultText = resultPath ? readFileSync(resultPath, "utf8") : null;
const result = resultText ? JSON.parse(resultText) : null;
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

const notRun = (id, path, message) => {
  recordCheck({ id, status: "not_run", severity: "info", path, message });
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

const sha256Digest = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const sha256 = (value) => sha256Digest(JSON.stringify(value));
const sha256Text = (value) => sha256Digest(value);

const readFormalEvidenceDecision = () => {
  if (!existsSync(formalEvidenceLedgerPath)) {
    return null;
  }

  const ledger = JSON.parse(readFileSync(formalEvidenceLedgerPath, "utf8"));
  const decision = (ledger.decisions ?? []).find((entry) => entry?.slug === reportSlug);
  if (!decision) {
    return null;
  }

  return {
    decision: decision.decision,
    evidenceStatus: decision.evidenceStatus,
    routeBehavior: decision.routeBehavior,
    reportFileStatus: decision.reportFileStatus,
    reason: decision.reason,
    requiredEvidenceForPromotion: decision.requiredEvidenceForPromotion ?? [],
    sources: decision.sources ?? [],
  };
};

const seedArtifactRead = loadArtifactSeeds({ seedArtifactsPath });
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

const formalSampleRows = formalArtifacts?.sampleRows ?? [];
const formalFields = formalArtifacts?.formalFields ?? [];
const coveredFormalFields = formalFields.filter((field) => field.status !== "pending");
const pendingFormalFields = formalFields.filter((field) => field.status === "pending");
const formalSampleRowsAvailable = formalSampleRows.length > 0;
const formalFieldsCovered = formalFields.length > 0 && pendingFormalFields.length === 0;
const rowCitationBindingsReady =
  formalSampleRowsAvailable &&
  formalSampleRows.every((row) => {
    const sourceIds = row.sourceResourceIds ?? row.sourceIds ?? [];
    return (
      Array.isArray(sourceIds) &&
      sourceIds.length > 0 &&
      sourceIds.every((sourceId) => typeof sourceId === "string" && sourceId.trim().length > 0) &&
      row.sourceBindingStatus !== "unavailable"
    );
  });
const formalReadinessGaps = [
  !formalSampleRowsAvailable ? "sampleReport" : null,
  !formalFieldsCovered ? "formalFields" : null,
  !rowCitationBindingsReady ? "citationBindings" : null,
].filter(Boolean);
const formalEvidenceBlocker = readFormalEvidenceDecision();
const agentReadiness = {
  schemaVersion: "soma-reports.agent-readiness.v1",
  evidenceStatus:
    formalSampleRowsAvailable && formalFieldsCovered && rowCitationBindingsReady
      ? "sample-backed-formal"
      : "local-scaffold",
  sampleBackedFormalReady: formalSampleRowsAvailable && formalFieldsCovered && rowCitationBindingsReady,
  localScaffoldOnly: !(formalSampleRowsAvailable && formalFieldsCovered && rowCitationBindingsReady),
  evidenceCounts: {
    references: formalArtifacts?.references.length ?? fixture.referenceResources?.length ?? 0,
    outputSections: formalArtifacts?.outputSections.length ?? 0,
    formalFields: formalFields.length,
    coveredFormalFields: coveredFormalFields.length,
    pendingFormalFields: pendingFormalFields.length,
    sampleRows: formalSampleRows.length,
    sourceBackedSampleRows: formalSampleRows.length,
    citedSampleRows: formalSampleRows.filter((row) => {
      const sourceIds = row.sourceResourceIds ?? row.sourceIds ?? [];
      return (
        Array.isArray(sourceIds) &&
        sourceIds.length > 0 &&
        row.sourceBindingStatus !== "unavailable"
      );
    }).length,
    genotypeSummaryRows: formalArtifacts?.genotypeSummary.length ?? 0,
    exactCitationRows: formalSampleRows.filter((row) => row.sourceBindingStatus === "exact").length,
  },
  gaps: formalReadinessGaps,
  usageBoundary:
    formalReadinessGaps.length > 0
      ? "Use as local prompt, fixture, references, and deterministic output schema only; do not treat as source-backed Sequencing.com formal sample evidence."
      : "Use as sample-backed local-agent report structure while preserving source bindings and appendix-only probability disclosure.",
  ...(formalEvidenceBlocker ? { formalEvidenceBlocker } : {}),
};

if (agentReadiness.localScaffoldOnly) {
  check(
    Boolean(formalEvidenceBlocker),
    "BUNDLE.FORMAL_BLOCKER_DECISION_PRESENT",
    "readiness.formalEvidenceBlocker",
    "local-scaffold bundles must carry a formal evidence blocker decision",
  );
}

if (formalEvidenceBlocker) {
  check(
    agentReadiness.localScaffoldOnly,
    "BUNDLE.FORMAL_BLOCKER_STALE",
    "readiness.formalEvidenceBlocker",
    "formal evidence blocker decisions must be removed when a package becomes sample-backed formal",
  );
}

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

const resultSampleRowsFrom = (value) => {
  if (!value || typeof value !== "object") return [];
  const candidates = [value.sampleRows, value.report?.sampleRows];
  return candidates.find(Array.isArray) ?? [];
};

const sourceIdsFromRow = (row) => {
  if (!row || typeof row !== "object") return [];
  const candidate = row.sourceResourceIds ?? row.sourceIds ?? [];
  return Array.isArray(candidate)
    ? candidate.filter((sourceId) => typeof sourceId === "string" && sourceId.trim().length > 0)
    : [];
};

const normalizedFingerprintText = (value) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const canonicalSampleFingerprint = (row) =>
  JSON.stringify({
    groupTitle: normalizedFingerprintText(row?.groupTitle),
    item: normalizedFingerprintText(row?.item),
    sourceIds: sourceIdsFromRow(row).sort(),
    sourceBindingStatus: normalizedFingerprintText(row?.sourceBindingStatus),
  });

const uniqueFingerprints = (rows) => [...new Set(rows.map(canonicalSampleFingerprint))];

const genericResultRowKeys = ["groupTitle", "item", "brandName", "geneticAnalysis", "genes", "sourceLabel", "plainEnglishMeaning"];
const formalResultRowKeyAllowlist = new Set([...genericResultRowKeys, "description", "sourceIds", "sourceBindingStatus"]);
const formalResultRowKeysFrom = (artifacts) => {
  const keys = new Set();
  for (const field of artifacts?.formalFields ?? []) {
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

const parseFieldPath = (fieldPath) => fieldPath.replaceAll("[]", ".[]").split(".").filter(Boolean);

const valuesAtFieldPath = (value, fieldPath) => {
  const walkPath = (node, parts) => {
    if (parts.length === 0) {
      return [node];
    }
    const [head, ...rest] = parts;
    if (head === "[]") {
      return Array.isArray(node) ? node.flatMap((item) => walkPath(item, rest)) : [];
    }
    if (node && typeof node === "object" && !Array.isArray(node) && head in node) {
      return walkPath(node[head], rest);
    }
    return [];
  };
  return walkPath(value, parseFieldPath(fieldPath));
};

const stableAppendixFieldPaths = new Set([
  "appendix.genotypeSummary",
  "appendix.probabilities",
  "appendix.uncertainty",
  "appendix.limitations",
  "appendix.missingInputs",
]);

const isPlainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isStringArray = (value) => Array.isArray(value) && value.every(isNonEmptyString);
const isNonEmptyStringArray = (value) => isStringArray(value) && value.length > 0;
const isObjectArray = (value) => Array.isArray(value) && value.every(isPlainObject);

const valueMatchesExpectedType = (value, type, fieldPath) => {
  if (fieldPath === "resultRows[].brandName") {
    return value === null || typeof value === "string";
  }
  if (type.endsWith("[]")) {
    if (!Array.isArray(value)) {
      return false;
    }
    const itemType = type.slice(0, -2);
    if (itemType === "string") {
      return value.every(isNonEmptyString);
    }
    if (itemType === "number") {
      return value.every((entry) => typeof entry === "number" && Number.isFinite(entry));
    }
    if (itemType === "boolean") {
      return value.every((entry) => typeof entry === "boolean");
    }
    if (itemType === "object") {
      return value.every(isPlainObject);
    }
    return value.every((entry) => entry !== null && entry !== undefined);
  }
  if (type === "string") {
    return isNonEmptyString(value);
  }
  if (type === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (type === "boolean") {
    return typeof value === "boolean";
  }
  if (type === "object") {
    return isPlainObject(value);
  }
  return value !== null && value !== undefined;
};

const stableEmittedFieldPathsFrom = (artifacts) => {
  const fields = [];
  for (const section of artifacts?.outputSections ?? []) {
    for (const field of section.expectedFields ?? []) {
      if (!field.required || !field.fieldPath) {
        continue;
      }
      if (field.fieldPath.startsWith("sampleRows[]")) {
        continue;
      }
      fields.push(field);
    }
  }
  return fields;
};

const seedSampleSourceIdsFrom = (artifacts) =>
  [
    ...new Set(
      (artifacts?.sampleRows ?? []).flatMap((row) => row.sourceResourceIds ?? row.sourceIds ?? []),
    ),
  ].filter(Boolean);

const appendixFrom = (value) => {
  if (!value || typeof value !== "object") return null;
  return value.appendix ?? value.report?.appendix ?? null;
};

const resultReferencesFrom = (value) => {
  if (!value || typeof value !== "object") return [];
  const candidates = [value.references, value.report?.references];
  return candidates.find(Array.isArray) ?? [];
};

const validateSampleRowPreservation = (value, rows) => {
  const seedRows = formalArtifacts?.sampleRows ?? [];
  const sampleRows = resultSampleRowsFrom(value);
  const candidateRows = [...sampleRows, ...rows];

  if (seedRows.length === 0) {
    notRun(
      "RESULT.SAMPLE_ROWS_PRESERVED",
      "$.sampleRows|$.resultRows",
      "formal artifacts do not expose sampleRows[] for this package",
    );
    return;
  }

  const expected = uniqueFingerprints(seedRows);
  const topLevel = new Set(uniqueFingerprints(sampleRows));
  const candidates = new Set(uniqueFingerprints(candidateRows));
  const missingFromTopLevel = expected.filter((fingerprint) => !topLevel.has(fingerprint));
  const missingFromCandidates = expected.filter((fingerprint) => !candidates.has(fingerprint));

  if (missingFromCandidates.length === 0) {
    pass(
      "RESULT.SAMPLE_ROWS_PRESERVED",
      "$.sampleRows|$.resultRows",
      `result preserves ${expected.length} formal sample row fingerprints`,
    );
    if (missingFromTopLevel.length === 0) {
      pass(
        "RESULT.SAMPLE_ROWS_TOP_LEVEL_PRESENT",
        "$.sampleRows",
        "result.sampleRows[] preserves formal sample-row structure directly",
      );
    } else {
      warn(
        "RESULT.SAMPLE_ROWS_TOP_LEVEL_MISSING",
        "$.sampleRows",
        `formal sample rows are preserved through resultRows[] but ${missingFromTopLevel.length} are absent from top-level sampleRows[]`,
      );
    }
    return;
  }

  const message = `${missingFromCandidates.length} of ${expected.length} formal sample row fingerprints are absent from result.sampleRows[] and resultRows[]`;
  if (validationMode === "sample-parity" || validationMode === "formal-ready") {
    fail("RESULT.SAMPLE_ROWS_PRESERVED", "$.sampleRows|$.resultRows", message);
    return;
  }
  warn("RESULT.SAMPLE_ROWS_PRESERVED", "$.sampleRows|$.resultRows", message);
};

const probabilityTextPattern = /\b(probability|probabilities|confidence|uncertainty|calibration|calibrated|clinical sensitivity)\b/i;
const probabilityBoundaryTextPattern =
  /\b(unavailable|missing|not supplied|does not|do not|cannot|no calibrated|no probability|not quantified|not calculated|not supported|without a calibrated|not infer|not a local|pending|appendix only|belongs in the appendix)\b/i;

const shouldWarnProbabilityBodyText = (node, path) => {
  if (typeof node !== "string" || !probabilityTextPattern.test(node)) {
    return false;
  }
  const lowerPath = path.toLowerCase();
  if (
    path.startsWith("$.appendix") ||
    path.startsWith("$.report.appendix") ||
    lowerPath.includes("unsupportedclaims") ||
    lowerPath.includes("limitations") ||
    probabilityBoundaryTextPattern.test(node)
  ) {
    return false;
  }
  return true;
};

const validateConsumerLanguage = (rows) => {
  if (rows.length === 0) {
    return;
  }

  const evaluations = evaluateConsumerLanguageRows(rows);
  const failures = evaluations.flatMap((evaluation) =>
    evaluation.failures.map((message) => ({ evaluation, message })),
  );
  const reviewWarnings = evaluations.flatMap((evaluation) =>
    evaluation.warnings.map((message) => ({ evaluation, message })),
  );

  if (failures.length === 0) {
    pass(
      "RESULT.CONSUMER_LANGUAGE_EXPLANATIONS_PRESENT",
      "$.resultRows[].plainEnglishMeaning",
      `${evaluations.length} result rows include substantive plain-English customer explanations`,
    );
  }

  for (const { evaluation, message } of failures) {
    fail("RESULT.CONSUMER_LANGUAGE_EXPLANATION_REQUIRED", evaluation.path, message);
  }
  for (const { evaluation, message } of reviewWarnings) {
    warn("RESULT.CONSUMER_LANGUAGE_REVIEW", evaluation.path, message);
  }
};

const validateResult = (value) => {
  const appendix = appendixFrom(value);
  const rows = resultRowsFrom(value);
  const requiredRowKeys = [...new Set([...genericResultRowKeys, ...formalResultRowKeysFrom(formalArtifacts)])];
  const allowedReferenceIds = new Set((fixture.referenceResources ?? []).map((resource) => resource.id));
  const resultReferenceIds = new Set(
    resultReferencesFrom(value)
      .map((resource) => resource.id ?? resource.resourceId)
      .filter(Boolean),
  );
  const resultSourceIds = new Set();

  check(
    Boolean(appendix && typeof appendix === "object"),
    "RESULT.APPENDIX_PRESENT",
    "$.appendix",
    "result.appendix must exist and contain probability, uncertainty, and missing-input details",
  );
  check(
    isObjectArray(appendix?.probabilities),
    "RESULT.APPENDIX_PROBABILITIES_ARRAY",
    "$.appendix.probabilities",
    "result.appendix.probabilities[] must be an array of probability objects; use an empty array when calibrated probabilities are unavailable",
  );
  check(
    isNonEmptyStringArray(appendix?.uncertainty),
    "RESULT.APPENDIX_UNCERTAINTY_ARRAY",
    "$.appendix.uncertainty",
    "result.appendix.uncertainty[] must be a non-empty string array explaining confidence, calibration, or missing-evidence limits",
  );
  check(
    isStringArray(appendix?.missingInputs),
    "RESULT.APPENDIX_MISSING_INPUTS_ARRAY",
    "$.appendix.missingInputs",
    "result.appendix.missingInputs[] must be a string array, even when no inputs are missing",
  );
  check(
    isNonEmptyStringArray(appendix?.limitations),
    "RESULT.APPENDIX_LIMITATIONS_ARRAY",
    "$.appendix.limitations",
    "result.appendix.limitations[] must be a non-empty string array explaining source, scope, calibration, or professional-review limits",
  );

  check(
    rows.length > 0,
    "RESULT.ROWS_PRESENT",
    "$.resultRows|$.findings",
    "result must contain resultRows[] or findings[]",
  );

  rows.forEach((row, index) => {
    for (const key of requiredRowKeys) {
      check(
        key in row,
        "RESULT.ROW_FIELD_PRESENT",
        `$.resultRows[${index}].${key}`,
        `result row ${index} must include ${key}`,
      );
      if (!(key in row)) {
        continue;
      }
      if (key === "genes") {
        check(
          Array.isArray(row.genes) && row.genes.every((gene) => typeof gene === "string" && gene.trim().length > 0),
          "RESULT.ROW_GENES_NONEMPTY_STRINGS",
          `$.resultRows[${index}].genes`,
          `result row ${index} genes must be an array of non-empty strings`,
        );
        continue;
      }
      if (key === "brandName") {
        check(
          row.brandName === null || typeof row.brandName === "string",
          "RESULT.ROW_BRAND_NAME_VALID",
          `$.resultRows[${index}].brandName`,
          `result row ${index} brandName must be null or a string`,
        );
        continue;
      }
      if (key === "sourceIds") {
        check(
          Array.isArray(row.sourceIds) &&
            row.sourceIds.length > 0 &&
            row.sourceIds.every((sourceId) => typeof sourceId === "string" && sourceId.trim().length > 0),
          "RESULT.ROW_SOURCE_IDS_ARRAY",
          `$.resultRows[${index}].sourceIds`,
          `result row ${index} sourceIds must be an array of non-empty strings`,
        );
        continue;
      }
      if (key === "sourceBindingStatus") {
        check(
          ["exact", "curated", "sample_label_only", "unavailable"].includes(row.sourceBindingStatus),
          "RESULT.ROW_SOURCE_BINDING_STATUS_ALLOWED",
          `$.resultRows[${index}].sourceBindingStatus`,
          `result row ${index} sourceBindingStatus must be allowed`,
        );
        continue;
      }
      check(
        typeof row[key] === "string" && row[key].trim().length > 0,
        "RESULT.ROW_TEXT_FIELD_NONEMPTY",
        `$.resultRows[${index}].${key}`,
        `result row ${index} ${key} must be a non-empty string`,
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
        resultSourceIds.add(sourceId);
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

  for (const [index, sampleRow] of resultSampleRowsFrom(value).entries()) {
    for (const [sourceIndex, sourceId] of sourceIdsFromRow(sampleRow).entries()) {
      resultSourceIds.add(sourceId);
      check(
        sourceId === "source-unavailable" || allowedReferenceIds.has(sourceId),
        "RESULT.SAMPLE_ROW_SOURCE_ID_ALLOWED",
        `$.sampleRows[${index}].sourceIds[${sourceIndex}]`,
        `sample row ${index} sourceId must be known or source-unavailable`,
      );
    }
  }

  for (const field of stableEmittedFieldPathsFrom(formalArtifacts)) {
    const values = valuesAtFieldPath(value, field.fieldPath);
    check(
      values.length > 0,
      "RESULT.EXPECTED_FIELD_PATH_PRESENT",
      `$.${field.fieldPath}`,
      `required output field path ${field.fieldPath} must be present for ${field.label}`,
    );
    if (values.length === 0) {
      continue;
    }
    check(
      values.every((entry) => valueMatchesExpectedType(entry, field.type, field.fieldPath)),
      "RESULT.EXPECTED_FIELD_PATH_TYPE",
      `$.${field.fieldPath}`,
      `required output field path ${field.fieldPath} must match type ${field.type}`,
      );
  }

  validateConsumerLanguage(rows);
  validateSampleRowPreservation(value, rows);

  const seedSampleSourceIds = seedSampleSourceIdsFrom(formalArtifacts);
  if (seedSampleSourceIds.length > 0 && !seedSampleSourceIds.some((sourceId) => resultSourceIds.has(sourceId))) {
    warn(
      "RESULT.SEED_SAMPLE_SOURCE_NOT_CITED",
      "$.resultRows[].sourceIds|$.sampleRows[].sourceIds",
      "sample-backed formal artifacts expose source IDs, but no result or sample row cites a seed sample source ID",
    );
  }

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
    if (shouldWarnProbabilityBodyText(node, path)) {
      warn(
        "RESULT.PROBABILITY_TEXT_REVIEW",
        path,
        `${path} mentions probability, confidence, calibration, or uncertainty outside appendix; confirm it is boundary language, not a quantified result`,
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
    const hasCoordinate =
      (isNonEmptyString(evidence.chrom) || isNonEmptyString(evidence.contig)) &&
      (Number.isFinite(evidence.pos) || Number.isFinite(evidence.position));
    check(
      Boolean(evidence.rsid || evidence.starAllele || evidence.haplotype || hasCoordinate),
      "FIXTURE.EVIDENCE_VARIANT_ID_PRESENT",
      `fixture.genomeEvidence[${index}]`,
      `fixture.genomeEvidence[${index}] must include rsid, starAllele, haplotype, or chrom/pos`,
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
  if (validationMode === "formal-ready") {
    check(
      formalArtifacts.sampleRows.length > 0,
      "BUNDLE.FORMAL_READY_SAMPLE_ROWS_PRESENT",
      "formalArtifacts.sampleRows",
      "formal-ready validation requires source-backed formal sampleRows[]",
    );
    check(
      formalArtifacts.formalFields.length > 0 && formalArtifacts.formalFields.every((field) => field.status !== "pending"),
      "BUNDLE.FORMAL_READY_FIELDS_COVERED",
      "formalArtifacts.formalFields",
      "formal-ready validation requires covered formal field mappings",
    );
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
  writeFileSync(2, `${JSON.stringify({ ok: false, errors, warnings, validationLedger: validationLedger() }, null, 2)}\n`);
  process.exit(1);
}

  const bundleCore = {
    schemaVersion: "soma-reports.agent-bundle.v1",
    reportSlug,
    promptPath,
    fixturePath,
    readiness: agentReadiness,
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
    "Put probability, confidence, uncertainty, missing-input, and limitation disclosures in the appendix only.",
    "Do not include raw genome data in output.",
  ],
  outputValidation: {
    validationMode,
    resultPath: resultPath ?? null,
    checks: [
      "raw genome data is absent",
      "resultRows[] or findings[] exist",
      "each result row includes groupTitle, item, brandName, geneticAnalysis, genes, sourceLabel, and plainEnglishMeaning",
      "each result row preserves covered formal resultRows[] fields from formalArtifacts.formalFields",
      "each finding cites canonical sourceIds[]",
      "each cited sourceIds[] entry appears in result.references[] when the result emits references",
      "appendix.probabilities[], appendix.uncertainty[], appendix.missingInputs[], and appendix.limitations[] are present",
      "probability, confidence, calibration, and uncertainty keys only appear under appendix",
      "prompt requires deterministic sections before appendix probabilities",
    ],
  },
	  agentRunInput: {
	    readiness: agentReadiness,
	    reportPurpose: fixture.reportPurpose,
	    referenceResources: fixture.referenceResources,
	    formalArtifacts,
	    genomeEvidence: fixture.genomeEvidence,
	    missingInputPolicy: fixture.missingInputPolicy,
	    consumerTone: fixture.consumerTone,
	  },
	  exampleOutput: result,
	  prompt,
	  fixture,
	  formalArtifacts,
	};

const validation = validationLedger();
const bundleHash = sha256(bundleCore);
const auditManifest = {
  schemaVersion: "soma-reports.agent-audit.v1",
  fileHashes: {
    prompt: {
      path: promptPath,
      hash: sha256Text(prompt),
    },
    fixture: {
      path: fixturePath,
      hash: sha256Text(fixtureText),
    },
    result: resultPath && resultText
      ? {
          path: resultPath,
          hash: sha256Text(resultText),
        }
      : null,
  },
  objectHashes: {
    bundleCore: bundleHash,
	    agentRunInput: sha256(bundleCore.agentRunInput),
	    outputValidation: sha256(bundleCore.outputValidation),
	    exampleOutput: result ? sha256(result) : null,
	    formalArtifacts: formalArtifacts ? sha256(formalArtifacts) : null,
	    validationLedger: sha256(validation),
	  },
  seedArtifacts: {
    source: seedArtifactRead.source,
    slugFound: Boolean(seedArtifact),
  },
  validationSummary: validation.summary,
  validationLedger: validation,
};

const bundle = {
  ...bundleCore,
  generatedAt: new Date().toISOString(),
  bundleHash,
  auditManifest,
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
        readiness: agentReadiness,
        resultValidated: Boolean(result),
        validationMode,
        bundleHash,
        auditManifest: {
          schemaVersion: auditManifest.schemaVersion,
          fileHashes: auditManifest.fileHashes,
          objectHashes: auditManifest.objectHashes,
          seedArtifacts: auditManifest.seedArtifacts,
          validationSummary: auditManifest.validationSummary,
        },
        warnings,
        validationLedger: validation,
      },
      null,
      2,
    ),
  );
} else {
  process.stdout.write(text);
}
