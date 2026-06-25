#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { evaluateConsumerLanguageRows } from "./lib/consumer-language.mjs";

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
const inputPath = args.get("--input");
const resultPath = args.get("--result");
const outPath = args.get("--out");

if (!inputPath || !resultPath) {
  throw new Error(
    "Usage: npm run agent:validate-run -- --input tmp/agent-runs/<slug>.agent-input.json --result <agent-result.json> [--out tmp/agent-runs/<slug>.validation.json]",
  );
}

for (const path of [inputPath, resultPath]) {
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${path}`);
  }
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const prepared = readJson(inputPath);
const result = readJson(resultPath);
const checks = [];
const sha256Text = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const sha256 = (value) => sha256Text(JSON.stringify(value));

const record = (status, id, path, message, severity = status === "fail" ? "error" : status) => {
  checks.push({ id, status, severity, path, message });
};

const pass = (id, path, message) => record("pass", id, path, message, "info");
const fail = (id, path, message) => record("fail", id, path, message, "error");
const warn = (id, path, message) => record("warn", id, path, message, "warning");
const check = (condition, id, path, message) => {
  if (condition) {
    pass(id, path, message);
  } else {
    fail(id, path, message);
  }
};

const isPlainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const isStringArray = (value) => Array.isArray(value) && value.every(isNonEmptyString);
const isNonEmptyStringArray = (value) => isStringArray(value) && value.length > 0;
const isObjectArray = (value) => Array.isArray(value) && value.every(isPlainObject);

const walk = (node, visitor, path = "$") => {
  visitor(node, path);
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, visitor, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(node)) {
    for (const [key, value] of Object.entries(node)) {
      walk(value, visitor, `${path}.${key}`);
    }
  }
};

const parseFieldPath = (fieldPath) => fieldPath.replaceAll("[]", ".[]").split(".").filter(Boolean);
const normalizeComparable = (value) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");
const normalizeId = (value) => normalizeComparable(value).toLowerCase();

const valuesAtFieldPath = (value, fieldPath) => {
  const walkPath = (node, parts) => {
    if (parts.length === 0) {
      return [node];
    }
    const [head, ...rest] = parts;
    if (head === "[]") {
      return Array.isArray(node) ? node.flatMap((item) => walkPath(item, rest)) : [];
    }
    if (isPlainObject(node) && head in node) {
      return walkPath(node[head], rest);
    }
    return [];
  };
  return walkPath(value, parseFieldPath(fieldPath));
};

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

const resultRowsFrom = (value) => {
  if (!isPlainObject(value)) return [];
  const candidates = [value.resultRows, value.findings, value.results, value.report?.resultRows, value.report?.findings];
  return candidates.find(Array.isArray) ?? [];
};

const resultSampleRowsFrom = (value) => {
  if (!isPlainObject(value)) return [];
  const candidates = [value.sampleRows, value.report?.sampleRows];
  return candidates.find(Array.isArray) ?? [];
};

const appendixFrom = (value) => {
  if (!isPlainObject(value)) return null;
  return value.appendix ?? value.report?.appendix ?? null;
};

const resultReferencesFrom = (value) => {
  if (!isPlainObject(value)) return [];
  const candidates = [value.references, value.report?.references];
  return candidates.find(Array.isArray) ?? [];
};

const reportOverviewFrom = (value) => {
  if (!isPlainObject(value)) return null;
  const candidates = [value.reportOverview, value.report?.reportOverview];
  return candidates.find(isPlainObject) ?? null;
};

const sourceIdsFromRow = (row) => {
  if (!isPlainObject(row)) return [];
  const candidate = row.sourceResourceIds ?? row.sourceIds ?? [];
  return Array.isArray(candidate)
    ? candidate.filter((sourceId) => typeof sourceId === "string" && sourceId.trim().length > 0)
    : [];
};

const genomeEvidenceKeys = (row) =>
  [
    ["inputId", row?.inputId],
    ["rsid", row?.rsid],
    ["rsid", row?.variantId],
    ["rsid", row?.variantID],
  ]
    .map(([kind, value]) => ({ kind, value: normalizeId(value) }))
    .filter((entry) => entry.value);

const genotypeSummaryKeys = (row) =>
  [
    ["inputId", row?.inputId],
    ["rsid", row?.rsid],
    ["rsid", row?.variantId],
    ["rsid", row?.variantID],
  ]
    .map(([kind, value]) => ({ kind, value: normalizeId(value) }))
    .filter((entry) => entry.value);

const genericResultRowKeys = [
  "groupTitle",
  "item",
  "brandName",
  "geneticAnalysis",
  "genes",
  "sourceLabel",
  "plainEnglishMeaning",
];
const formalResultRowKeyAllowlist = new Set([
  ...genericResultRowKeys,
  "description",
  "sourceIds",
  "sourceBindingStatus",
]);

const formalResultRowKeysFrom = (artifacts) => {
  const keys = new Set();
  for (const field of artifacts?.formalFields ?? []) {
    if (field.status !== "covered") {
      continue;
    }
    const match = /^resultRows\[\]\.([A-Za-z][A-Za-z0-9_]*)$/.exec(field.outputPath ?? field.fieldPath ?? "");
    if (match && formalResultRowKeyAllowlist.has(match[1])) {
      keys.add(match[1]);
    }
  }
  return [...keys].sort();
};

const stableAppendixFieldPaths = new Set([
  "appendix.genotypeSummary",
  "appendix.probabilities",
  "appendix.uncertainty",
  "appendix.limitations",
  "appendix.missingInputs",
]);

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

const collectReferenceIds = (preparedInput) => {
  const ids = new Set(["source-unavailable"]);
  const add = (value) => {
    if (typeof value === "string" && value.trim()) {
      ids.add(value);
    }
  };
  for (const resource of preparedInput.agentRunInput?.referenceResources ?? []) {
    add(resource.id);
    add(resource.resourceId);
  }
  for (const resource of preparedInput.formalArtifacts?.references ?? []) {
    add(resource.id);
    add(resource.resourceId);
  }
  for (const resource of preparedInput.formalArtifacts?.sourceArtifacts ?? []) {
    add(resource.id);
    add(resource.resourceId);
  }
  for (const row of preparedInput.formalArtifacts?.sampleRows ?? []) {
    for (const sourceId of sourceIdsFromRow(row)) {
      add(sourceId);
    }
  }
  return ids;
};

const rawFieldNames = new Set([
  "bam",
  "bases",
  "cram",
  "fastq",
  "genotypeCalls",
  "rawFileContents",
  "rawGenome",
  "rawGenomeData",
  "rawGenotypeRows",
  "rawLine",
  "rawVariants",
  "reads",
  "sam",
  "sequence",
  "vcf",
  "vcfLine",
]);
const rawGenomeFileReference = /(?:^|[\s"'(])(?:[~./]|[A-Za-z0-9_-])[\w./~ -]*\.(?:bam|cram|fastq|fq|gvcf|sam|vcf)(?:\.gz)?(?=$|[\s"',)])/i;
const longDnaSequence = /\b[ACGTN]{80,}\b/i;
const vcfHeader = /#CHROM\s+POS\s+ID\s+REF\s+ALT/i;
const vcfRecord =
  /(^|\n)(?:chr)?(?:[0-9]{1,2}|X|Y|M|MT)\t\d+\t[^\t]*\t[ACGTN.]+\t(?:[ACGTN,<>.]+)\t/i;
const fastqShape = /(^|\n)@[^\n]+\n[ACGTN]{20,}\n\+\n[!-~]{20,}/i;
const rawFileTerminology = /\braw\s+genome\b|(?:^|[^A-Za-z0-9])(?:vcf|gvcf|fastq|bam|cram|sam)(?=$|[^A-Za-z0-9])/i;

const validateNoRawGenomeLeakage = (value, rootPath, { allowTerminologyInAppendixLimitations = false } = {}) => {
  walk(value, (node, path) => {
    const key = path.split(".").pop()?.replace(/\[\d+\]$/, "") ?? "";
    if (rawFieldNames.has(key)) {
      fail("PRIVACY.NO_RAW_GENOME_KEYS", `${rootPath}${path.slice(1)}`, `${rootPath}${path.slice(1)} must not expose raw genome data`);
    }
    if (typeof node !== "string") {
      return;
    }
    const fullPath = `${rootPath}${path.slice(1)}`;
    if (vcfHeader.test(node) || vcfRecord.test(node) || fastqShape.test(node) || longDnaSequence.test(node)) {
      fail("PRIVACY.NO_RAW_SEQUENCE_CONTENT", fullPath, `${fullPath} contains raw-sequence-like content`);
    }
    if (rawGenomeFileReference.test(node)) {
      fail("PRIVACY.NO_RAW_FILE_REFERENCES", fullPath, `${fullPath} points at a raw genome file`);
    }
    if (
      rawFileTerminology.test(node) &&
      !(allowTerminologyInAppendixLimitations && fullPath.startsWith("$.appendix.limitations"))
    ) {
      warn(
        "PRIVACY.RAW_FILE_TERMINOLOGY_REVIEW",
        fullPath,
        `${fullPath} mentions raw genome/file terminology; confirm it is a boundary statement, not emitted data`,
      );
    }
  });
};

const probabilityKeys = ["probability", "probabilities", "confidence", "uncertainty", "calibration"];
const probabilityTextPattern = /\b(probability|probabilities|confidence|uncertainty|calibration|calibrated|clinical sensitivity)\b/i;
const probabilityBoundaryTextPattern =
  /\b(unavailable|missing|not supplied|does not|do not|cannot|no calibrated|no probability|not quantified|not calculated|not supported|without a calibrated|not infer|not a local|pending|appendix only|belongs in the appendix)\b/i;

const validateProbabilityBoundary = (value) => {
  walk(value, (node, path) => {
    const key = path.split(".").pop()?.replace(/\[\d+\]$/, "") ?? "";
    const isAppendixPath = path.startsWith("$.appendix") || path.startsWith("$.report.appendix");
    if (probabilityKeys.some((term) => key.toLowerCase().includes(term)) && !isAppendixPath) {
      fail("RESULT.PROBABILITY_KEYS_APPENDIX_ONLY", path, `${path} must be inside appendix`);
    }
    if (
      typeof node === "string" &&
      probabilityTextPattern.test(node) &&
      !isAppendixPath &&
      !path.toLowerCase().includes("limitations") &&
      !path.toLowerCase().includes("unsupportedclaims") &&
      !probabilityBoundaryTextPattern.test(node)
    ) {
      warn(
        "RESULT.PROBABILITY_TEXT_REVIEW",
        path,
        `${path} mentions probability, confidence, calibration, or uncertainty outside appendix; confirm it is boundary language, not a quantified result`,
      );
    }
  });
};

const scaffoldBoundary = isPlainObject(prepared.scaffoldBoundary) ? prepared.scaffoldBoundary : {};
const isLocalScaffoldOnlyRun =
  scaffoldBoundary.localScaffoldOnly === true || prepared.readiness?.localScaffoldOnly === true;
const scaffoldOfficialClaimPattern =
  /\b(official(?:ly)?|Sequencing\.com|sample[- ]backed|formal[- ]ready|source[- ]backed|generated output|sample parity|report parity|completed output)\b/i;
const scaffoldBoundaryLanguagePattern =
  /\b(not|no|without|does not|do not|cannot|unavailable|pending|missing|requires|only after|provisional|scaffold|boundary|not captured|not available|outside|local fixture)\b/i;

check(
  prepared.schemaVersion === "soma-reports.local-agent-run-input.v1",
  "INPUT.SCHEMA_VERSION",
  "$.schemaVersion",
  "prepared input must use soma-reports.local-agent-run-input.v1",
);
check(isNonEmptyString(prepared.reportSlug), "INPUT.REPORT_SLUG", "$.reportSlug", "prepared input must name a report slug");
check(isNonEmptyString(prepared.bundleHash), "INPUT.BUNDLE_HASH", "$.bundleHash", "prepared input must include bundleHash");
check(
  isNonEmptyString(prepared.localRunHash),
  "INPUT.LOCAL_RUN_HASH",
  "$.localRunHash",
  "prepared input must include localRunHash",
);
check(
  prepared.localRunHash === sha256(prepared.agentRunInput),
  "INPUT.LOCAL_RUN_HASH_MATCHES_AGENT_INPUT",
  "$.localRunHash",
  "prepared input localRunHash must match agentRunInput",
);
check(
  prepared.privacyBoundary?.rawGenomeIncluded === false,
  "INPUT.RAW_GENOME_EXCLUDED",
  "$.privacyBoundary.rawGenomeIncluded",
  "prepared input must not include raw genome data",
);
check(
  prepared.privacyBoundary?.derivedEvidenceOnly === true,
  "INPUT.DERIVED_EVIDENCE_ONLY",
  "$.privacyBoundary.derivedEvidenceOnly",
  "prepared input must use derived evidence only",
);
check(
  prepared.agentRunInput?.inputManifest?.rawGenomeReturned === false,
  "INPUT.MANIFEST_RAW_GENOME_RETURNED_FALSE",
  "$.agentRunInput.inputManifest.rawGenomeReturned",
  "inputManifest.rawGenomeReturned must be false",
);
if (isLocalScaffoldOnlyRun) {
  check(
    scaffoldBoundary.allowed === true,
    "INPUT.SCAFFOLD_BOUNDARY_ALLOWED",
    "$.scaffoldBoundary.allowed",
    "local-scaffold-only prepared input must be explicitly allowed before validation",
  );
  check(
    scaffoldBoundary.sampleBackedFormalReady === false,
    "INPUT.SCAFFOLD_SAMPLE_BACKED_FALSE",
    "$.scaffoldBoundary.sampleBackedFormalReady",
    "local-scaffold-only prepared input must not claim sample-backed formal readiness",
  );
}

const genomeEvidence = prepared.agentRunInput?.genomeEvidence ?? [];
check(
  Array.isArray(genomeEvidence) && genomeEvidence.length > 0,
  "INPUT.GENOME_EVIDENCE_PRESENT",
  "$.agentRunInput.genomeEvidence",
  "prepared input must include derived genomeEvidence[] rows",
);
for (const [index, row] of (Array.isArray(genomeEvidence) ? genomeEvidence : []).entries()) {
  check(isPlainObject(row), "INPUT.GENOME_EVIDENCE_ROW_OBJECT", `$.agentRunInput.genomeEvidence[${index}]`, "genome evidence row must be an object");
  for (const key of ["inputId", "gene", "observedValue", "assembly", "matchStatus"]) {
    check(
      isNonEmptyString(row?.[key]),
      "INPUT.GENOME_EVIDENCE_FIELD",
      `$.agentRunInput.genomeEvidence[${index}].${key}`,
      `genome evidence row ${index} must include non-empty ${key}`,
    );
  }
  validateNoRawGenomeLeakage(row, `$.agentRunInput.genomeEvidence[${index}]`);
}

const appendix = appendixFrom(result);
const rows = resultRowsFrom(result);
const sampleRows = resultSampleRowsFrom(result);
const reportOverview = reportOverviewFrom(result);
const knownReferenceIds = collectReferenceIds(prepared);
const resultReferenceIds = new Set(
  resultReferencesFrom(result)
    .map((resource) => resource.id ?? resource.resourceId)
    .filter((sourceId) => typeof sourceId === "string" && sourceId.trim()),
);
const resultSourceIds = new Set();
const requiredRowKeys = [...new Set([...genericResultRowKeys, ...formalResultRowKeysFrom(prepared.formalArtifacts)])];
const usableLocalEvidenceStatuses = new Set(["observed", "observed_record_no_genotype", "reference_block_covered"]);
const usableLocalEvidenceRows = (Array.isArray(genomeEvidence) ? genomeEvidence : []).filter(
  (row) => usableLocalEvidenceStatuses.has(row?.matchStatus) && isNonEmptyString(row?.observedValue),
);
const customerFacingResultText = normalizeComparable(
  JSON.stringify({
    resultRows: rows,
    sampleRows,
    findings: result.findings,
    results: result.results,
    reportRows: result.report?.resultRows,
    reportFindings: result.report?.findings,
    reportSampleRows: result.report?.sampleRows,
  }),
);

check(
  isPlainObject(reportOverview),
  "RESULT.REPORT_OVERVIEW_PRESENT",
  "$.reportOverview|$.report.reportOverview",
  "local-agent result must include reportOverview provenance",
);
check(
  isNonEmptyString(reportOverview?.localRunHash),
  "RESULT.LOCAL_RUN_HASH_PRESENT",
  "$.reportOverview.localRunHash",
  "local-agent result must include reportOverview.localRunHash",
);
check(
  reportOverview?.localRunHash === prepared.localRunHash,
  "RESULT.LOCAL_RUN_HASH_MATCHES_PREPARED_INPUT",
  "$.reportOverview.localRunHash",
  "reportOverview.localRunHash must match prepared.localRunHash",
);
check(
  isNonEmptyString(reportOverview?.bundleHash),
  "RESULT.BUNDLE_HASH_PRESENT",
  "$.reportOverview.bundleHash",
  "local-agent result must include reportOverview.bundleHash",
);
check(
  reportOverview?.bundleHash === prepared.bundleHash,
  "RESULT.BUNDLE_HASH_MATCHES_PREPARED_INPUT",
  "$.reportOverview.bundleHash",
  "reportOverview.bundleHash must match prepared.bundleHash",
);
check(
  isNonEmptyString(reportOverview?.inputManifestHash),
  "RESULT.INPUT_MANIFEST_HASH_PRESENT",
  "$.reportOverview.inputManifestHash",
  "local-agent result must include reportOverview.inputManifestHash",
);
check(
  reportOverview?.inputManifestHash === prepared.localRunHash,
  "RESULT.INPUT_MANIFEST_HASH_MATCHES_PREPARED_INPUT",
  "$.reportOverview.inputManifestHash",
  "reportOverview.inputManifestHash must match the prepared agentRunInput hash",
);

const validateConsumerLanguage = (rowsToCheck) => {
  if (rowsToCheck.length === 0) {
    return;
  }

  const evaluations = evaluateConsumerLanguageRows(rowsToCheck);
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

check(isPlainObject(result), "RESULT.JSON_OBJECT", "$", "agent result must be a JSON object");
check(Boolean(appendix && isPlainObject(appendix)), "RESULT.APPENDIX_PRESENT", "$.appendix", "result.appendix must exist");
check(
  isObjectArray(appendix?.probabilities),
  "RESULT.APPENDIX_PROBABILITIES_ARRAY",
  "$.appendix.probabilities",
  "result.appendix.probabilities[] must be an array of objects; use an empty array when unavailable",
);
check(
  isNonEmptyStringArray(appendix?.uncertainty),
  "RESULT.APPENDIX_UNCERTAINTY_ARRAY",
  "$.appendix.uncertainty",
  "result.appendix.uncertainty[] must be a non-empty string array",
);
check(
  isStringArray(appendix?.missingInputs),
  "RESULT.APPENDIX_MISSING_INPUTS_ARRAY",
  "$.appendix.missingInputs",
  "result.appendix.missingInputs[] must be a string array",
);
check(
  isNonEmptyStringArray(appendix?.limitations),
  "RESULT.APPENDIX_LIMITATIONS_ARRAY",
  "$.appendix.limitations",
  "result.appendix.limitations[] must be a non-empty string array",
);
check(
  isObjectArray(appendix?.genotypeSummary),
  "RESULT.APPENDIX_GENOTYPE_SUMMARY_ARRAY",
  "$.appendix.genotypeSummary",
  "result.appendix.genotypeSummary[] must be an array of objects that mirrors local derived genomeEvidence[]",
);
check(rows.length > 0, "RESULT.ROWS_PRESENT", "$.resultRows|$.findings", "result must contain resultRows[] or findings[]");
if (isLocalScaffoldOnlyRun) {
  const scaffoldBoundaryText = normalizeComparable(
    JSON.stringify({
      sectionsUnavailable: result.reportOverview?.sectionsUnavailable ?? result.report?.reportOverview?.sectionsUnavailable,
      missingInputs: appendix?.missingInputs,
      limitations: appendix?.limitations,
      officialCoverageBoundary: result.officialCoverageBoundary ?? result.report?.officialCoverageBoundary,
    }),
  );
  check(
    /scaffold|provisional|not source-backed|not official|not captured|not available|unavailable|sample report rows are not available/i.test(
      scaffoldBoundaryText,
    ),
    "RESULT.SCAFFOLD_BOUNDARY_LIMITATION_PRESENT",
    "$.reportOverview.sectionsUnavailable|$.appendix.limitations",
    "local-scaffold-only results must state that official/sample-backed output evidence is unavailable or provisional",
  );
  walk(
    {
      resultRows: rows,
      sampleRows,
      findings: result.findings,
      results: result.results,
      reportRows: result.report?.resultRows,
      reportFindings: result.report?.findings,
      reportSampleRows: result.report?.sampleRows,
    },
    (node, path) => {
      if (
        typeof node === "string" &&
        scaffoldOfficialClaimPattern.test(node) &&
        !scaffoldBoundaryLanguagePattern.test(node)
      ) {
        fail(
          "RESULT.SCAFFOLD_NO_OFFICIAL_PARITY_CLAIMS",
          path,
          `${path} must not claim official Sequencing.com output, sample parity, or source-backed formal readiness for a local scaffold run`,
        );
      }
    },
  );
}

const genotypeSummaryRows = isObjectArray(appendix?.genotypeSummary) ? appendix.genotypeSummary : [];
const genotypeSummaryByKey = new Map();
for (const [index, summaryRow] of genotypeSummaryRows.entries()) {
  for (const key of genotypeSummaryKeys(summaryRow)) {
    genotypeSummaryByKey.set(`${key.kind}:${key.value}`, { row: summaryRow, index });
  }
}

for (const [index, evidenceRow] of (Array.isArray(genomeEvidence) ? genomeEvidence : []).entries()) {
  const keys = genomeEvidenceKeys(evidenceRow);
  const matched = keys.map((key) => genotypeSummaryByKey.get(`${key.kind}:${key.value}`)).find(Boolean);
  check(
    Boolean(matched),
    "RESULT.GENOTYPE_SUMMARY_LOCAL_EVIDENCE_ROW_PRESENT",
    `$.appendix.genotypeSummary`,
    `appendix.genotypeSummary[] must include local genomeEvidence row ${index} (${evidenceRow.inputId ?? evidenceRow.rsid ?? "unknown"})`,
  );
  if (!matched) {
    continue;
  }

  check(
    normalizeComparable(matched.row.observedValue) === normalizeComparable(evidenceRow.observedValue),
    "RESULT.GENOTYPE_SUMMARY_OBSERVED_VALUE_MATCHES_LOCAL_EVIDENCE",
    `$.appendix.genotypeSummary[${matched.index}].observedValue`,
    `genotypeSummary row for ${evidenceRow.inputId ?? evidenceRow.rsid ?? "local evidence"} must match local observedValue`,
  );
  check(
    normalizeComparable(matched.row.matchStatus) === normalizeComparable(evidenceRow.matchStatus),
    "RESULT.GENOTYPE_SUMMARY_STATUS_MATCHES_LOCAL_EVIDENCE",
    `$.appendix.genotypeSummary[${matched.index}].matchStatus`,
    `genotypeSummary row for ${evidenceRow.inputId ?? evidenceRow.rsid ?? "local evidence"} must match local matchStatus`,
  );
}

for (const [index, evidenceRow] of usableLocalEvidenceRows.entries()) {
  check(
    customerFacingResultText.includes(normalizeComparable(evidenceRow.observedValue)),
    "RESULT.LOCAL_EVIDENCE_OBSERVED_VALUE_IN_BODY",
    "$.resultRows|$.sampleRows|$.findings",
    `customer-facing rows must reflect usable local evidence row ${index} (${evidenceRow.inputId ?? evidenceRow.rsid ?? "local evidence"}) observedValue`,
  );
}

for (const [index, row] of rows.entries()) {
  check(isPlainObject(row), "RESULT.ROW_OBJECT", `$.resultRows[${index}]`, `result row ${index} must be an object`);
  for (const key of requiredRowKeys) {
    check(key in row, "RESULT.ROW_FIELD_PRESENT", `$.resultRows[${index}].${key}`, `result row ${index} must include ${key}`);
    if (!(key in row)) {
      continue;
    }
    if (key === "genes") {
      check(
        Array.isArray(row.genes) && row.genes.every(isNonEmptyString),
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
        Array.isArray(row.sourceIds) && row.sourceIds.length > 0 && row.sourceIds.every(isNonEmptyString),
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
      isNonEmptyString(row[key]),
      "RESULT.ROW_TEXT_FIELD_NONEMPTY",
      `$.resultRows[${index}].${key}`,
      `result row ${index} ${key} must be a non-empty string`,
    );
  }

  const sourceIds = Array.isArray(row.sourceIds) ? row.sourceIds : [];
  check(
    sourceIds.length > 0 && sourceIds.every(isNonEmptyString),
    "RESULT.ROW_SOURCE_IDS_PRESENT",
    `$.resultRows[${index}].sourceIds`,
    `result row ${index} must include canonical sourceIds[]`,
  );
  for (const [sourceIndex, sourceId] of sourceIds.entries()) {
    if (!isNonEmptyString(sourceId)) {
      fail(
        "RESULT.ROW_SOURCE_ID_STRING",
        `$.resultRows[${index}].sourceIds[${sourceIndex}]`,
        `result row ${index} sourceId ${sourceIndex} must be a non-empty string`,
      );
      continue;
    }
    resultSourceIds.add(sourceId);
    check(
      knownReferenceIds.has(sourceId),
      "RESULT.ROW_SOURCE_ID_ALLOWED",
      `$.resultRows[${index}].sourceIds[${sourceIndex}]`,
      `result row ${index} sourceId must come from the prepared input references or be source-unavailable`,
    );
    if (resultReferenceIds.size > 0) {
      check(
        sourceId === "source-unavailable" || resultReferenceIds.has(sourceId),
        "RESULT.ROW_SOURCE_ID_EMITTED_REFERENCE_PRESENT",
        `$.resultRows[${index}].sourceIds[${sourceIndex}]`,
        `result row ${index} sourceId must also appear in result.references[] when references are emitted`,
      );
    }
  }
}

for (const field of stableEmittedFieldPathsFrom(prepared.formalArtifacts)) {
  const values = valuesAtFieldPath(result, field.fieldPath);
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
validateNoRawGenomeLeakage(result, "$", { allowTerminologyInAppendixLimitations: true });
validateProbabilityBoundary(result);

const summary = {
  passed: checks.filter((entry) => entry.status === "pass").length,
  failed: checks.filter((entry) => entry.status === "fail").length,
  warnings: checks.filter((entry) => entry.status === "warn").length,
};
const ledger = {
  schemaVersion: "soma-reports.local-agent-run-validation.v1",
  generatedAt: new Date().toISOString(),
  ok: summary.failed === 0,
  inputPath,
  resultPath,
  reportSlug: prepared.reportSlug ?? null,
  localRunHash: prepared.localRunHash ?? null,
  bundleHash: prepared.bundleHash ?? null,
  resultProvenance: {
    localRunHash: reportOverview?.localRunHash ?? null,
    bundleHash: reportOverview?.bundleHash ?? null,
    inputManifestHash: reportOverview?.inputManifestHash ?? null,
    expectedLocalRunHash: prepared.localRunHash ?? null,
    expectedBundleHash: prepared.bundleHash ?? null,
  },
  summary,
  privacyBoundary: {
    rawGenomeIncluded: prepared.privacyBoundary?.rawGenomeIncluded ?? null,
    derivedEvidenceOnly: prepared.privacyBoundary?.derivedEvidenceOnly ?? null,
    rawGenomeReturned: prepared.agentRunInput?.inputManifest?.rawGenomeReturned ?? null,
  },
  evidenceCounts: {
    derivedEvidenceRows: Array.isArray(genomeEvidence) ? genomeEvidence.length : 0,
    usableLocalEvidenceRows: usableLocalEvidenceRows.length,
    resultRows: rows.length,
    sampleRows: sampleRows.length,
    citedSourceIds: resultSourceIds.size,
    knownReferences: knownReferenceIds.size,
    emittedReferences: resultReferenceIds.size,
  },
  checks,
};

if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(ledger, null, 2)}\n`);
}

console.log(
  JSON.stringify(
    outPath
      ? {
          ok: ledger.ok,
          reportSlug: ledger.reportSlug,
          inputPath,
          resultPath,
          outPath,
          summary,
          privacyBoundary: ledger.privacyBoundary,
          evidenceCounts: ledger.evidenceCounts,
        }
      : ledger,
    null,
    2,
  ),
);
process.exitCode = ledger.ok ? 0 : 1;
