export const officialOutputCaptureSchema = "soma-reports.official-output-capture.v1";

const sequencingUrlPattern = /^https:\/\/(?:www\.)?sequencing\.com\//i;
const sourceBindingStatuses = new Set(["exact", "direct", "official", "derived", "curated"]);
const rowEvidenceReadySourceBindingStatuses = new Set(["exact", "direct", "official"]);
const disallowedStringPatterns = [
  { pattern: /\breplace-(?:me|with)\b/i, message: "placeholder text must be replaced before validation" },
  { pattern: /fixtures\/synthetic\//i, message: "synthetic fixture paths cannot be promotion evidence" },
  { pattern: /\/Users\/[^/\s]+\/Documents\/Genome\/Raw/i, message: "private raw genome paths cannot be committed" },
  { pattern: /\.soma\/private/i, message: "private local data paths cannot be committed" },
  {
    pattern: /(?:^|[/"'\s])(?:data|private(?!\/local\b)|genomes|reports\/output)\//i,
    message: "ignored private data paths cannot be committed",
  },
  {
    pattern:
      /file:\/\/|\/[^/\s]+\.(?:vcf(?:\.gz)?|bam|cram|fastq(?:\.gz)?)\b|\b(?:genome|sample|raw|wgs|dna|23andme|ancestry)[\w.-]*\.(?:vcf(?:\.gz)?|bam|cram|fastq(?:\.gz)?)\b|_RawData\.txt\b/i,
    message: "raw genome file references cannot be committed",
  },
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    message: "private account identifiers such as email addresses cannot be committed",
  },
  {
    pattern: /https:\/\/(?:www\.)?sequencing\.com\/(?!(?:marketplace|knowledge-center|education-center|order|apps\/app-market)\b)[^\s"'<>]*/i,
    message: "private or account-specific Sequencing.com result URLs cannot be committed",
  },
  {
    pattern:
      /\b(?:rsid|rsID|rs\d{2,}|genotype|observed(?:Value| genotype)?|variant)\b.{0,40}\b(?:[ACGT]{1,2}\/[ACGT]{1,2}|[ACGT]>[ACGT]|rs\d{3,}|chr(?:[0-9]{1,2}|X|Y|M|MT):\d{2,})\b/i,
    message: "private genotype or variant values cannot be committed in official-output captures",
  },
];

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const arrayLength = (value) => (Array.isArray(value) ? value.length : 0);
const hasNonEmptyObject = (value) => isPlainObject(value) && Object.keys(value).length > 0;
const committedOfficialOutputCapturePathPattern =
  /^reference\/catalog\/[^/]+-official-output-capture-\d{4}-\d{2}-\d{2}\.json$/;
const unsafePromotionProvenancePattern = /(?:^|[/"'\s])(?:tmp|smoke|template|placeholder|dry[-_ ]?run)(?:[/"'\s]|$)/i;

const firstString = (artifact, keys) => {
  for (const key of keys) {
    if (isNonEmptyString(artifact[key])) {
      return artifact[key];
    }
  }
  return null;
};

const sourceIdsForRow = (row) => {
  const sourceIds = row?.sourceResourceIds ?? row?.sourceIds ?? row?.sourceArtifactIds ?? [];
  return Array.isArray(sourceIds) ? sourceIds : [];
};

const officialOutputSourceTypes = new Set([
  "official-output",
  "official_output",
  "official_completed_output",
  "redacted_official_completed_output",
]);

const sourceResourceId = (resource) => {
  if (!isPlainObject(resource)) {
    return null;
  }
  return firstString(resource, ["id", "resourceId", "sourceId", "artifactId"]);
};

const isOfficialOutputSourceResource = (resource) => {
  if (!isPlainObject(resource)) {
    return false;
  }
  const evidenceLevel = typeof resource.evidenceLevel === "string" ? resource.evidenceLevel.toLowerCase() : "";
  const sourceType = typeof resource.sourceType === "string" ? resource.sourceType.toLowerCase() : "";
  return (
    evidenceLevel === "official-output" ||
    officialOutputSourceTypes.has(sourceType) ||
    (sourceType.includes("official") && sourceType.includes("output"))
  );
};

const sourceIdsForField = (field) => {
  const explicitSourceIds = field?.sourceResourceIds ?? field?.sourceIds ?? field?.sourceArtifactIds ?? [];
  const sourceIds = Array.isArray(explicitSourceIds) ? explicitSourceIds : [];
  return [
    ...sourceIds,
    ...(isNonEmptyString(field?.sourceLabel) ? [field.sourceLabel] : []),
  ].filter((sourceId, index, all) => isNonEmptyString(sourceId) && all.indexOf(sourceId) === index);
};

const explicitSourceIdsForField = (field) => {
  const explicitSourceIds = field?.sourceResourceIds ?? field?.sourceIds ?? field?.sourceArtifactIds ?? [];
  return Array.isArray(explicitSourceIds) ? explicitSourceIds.filter(isNonEmptyString) : [];
};

const rowHasSourceBinding = (row) => {
  const sourceIds = sourceIdsForRow(row);
  const bindingStatus = row?.sourceBindingStatus;
  return (
    sourceIds.length > 0 &&
    sourceIds.every((sourceId) => isNonEmptyString(sourceId)) &&
    sourceBindingStatuses.has(bindingStatus)
  );
};

const rowHasOfficialOutputBinding = (row, officialOutputSourceIds) =>
  sourceIdsForRow(row).some((sourceId) => officialOutputSourceIds.has(sourceId));

const rowHasReadyOfficialOutputBinding = (row, officialOutputSourceIds) =>
  rowHasSourceBinding(row) &&
  rowEvidenceReadySourceBindingStatuses.has(row?.sourceBindingStatus) &&
  rowHasOfficialOutputBinding(row, officialOutputSourceIds);

const validateOutputRowSourceBinding = (row, jsonPath, officialOutputSourceIds, addProblem, addWarning) => {
  if (!isPlainObject(row)) {
    addProblem(jsonPath, "must be an object");
    return;
  }
  if (!rowHasSourceBinding(row)) {
    addProblem(jsonPath, "must carry non-empty source ids and a sourceBindingStatus other than unavailable");
    return;
  }
  if (!rowHasOfficialOutputBinding(row, officialOutputSourceIds)) {
    addWarning(jsonPath, "output rows must cite an official-output source resource before rowEvidenceReady can be true");
  }
};

const validateListedSourceIds = (sourceIds, jsonPath, listedSourceIds, addProblem) => {
  for (const sourceId of sourceIds) {
    if (!listedSourceIds.has(sourceId)) {
      addProblem(jsonPath, `must reference a listed source resource id (${sourceId} was not found)`);
    }
  }
};

const commitSafePrivacyMode = (privacyBoundary) =>
  privacyBoundary.privateValuesRedacted === true || privacyBoundary.publicSourceOnly === true;

const fieldIsCovered = (field) => {
  const hasFieldIdentity =
    isNonEmptyString(field?.key) ||
    isNonEmptyString(field?.label) ||
    isNonEmptyString(field?.observedField) ||
    isNonEmptyString(field?.outputPath);
  return hasFieldIdentity && field?.status !== "pending";
};

const bindingIsReady = (binding) => {
  const sourceIds = sourceIdsForRow(binding);
  return (
    sourceIds.length > 0 &&
    sourceIds.every((sourceId) => isNonEmptyString(sourceId)) &&
    sourceBindingStatuses.has(binding?.sourceBindingStatus)
  );
};

const bindingHasOfficialOutputSource = (binding, officialOutputSourceIds) =>
  sourceIdsForRow(binding).some((sourceId) => officialOutputSourceIds.has(sourceId));

const bindingHasReadyOfficialOutputSource = (binding, officialOutputSourceIds) =>
  bindingIsReady(binding) &&
  rowEvidenceReadySourceBindingStatuses.has(binding?.sourceBindingStatus) &&
  bindingHasOfficialOutputSource(binding, officialOutputSourceIds);

const scanStrings = (value, visit, path = "$") => {
  if (typeof value === "string") {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanStrings(entry, visit, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      scanStrings(entry, visit, `${path}.${key}`);
    }
  }
};

export const validateOfficialOutputCaptureArtifact = (artifact, options = {}) => {
  const path = options.path ?? null;
  const expectedSlug = options.expectedSlug ?? null;
  const problems = [];
  const warnings = [];

  const addProblem = (jsonPath, message) => problems.push({ path: jsonPath, message });
  const addWarning = (jsonPath, message) => warnings.push({ path: jsonPath, message });

  if (!isPlainObject(artifact)) {
    return {
      ok: false,
      path,
      slug: expectedSlug,
      problems: [{ path: "$", message: "capture artifact must be a JSON object" }],
      warnings,
      outputSignals: {},
      rowEvidenceReady: false,
      promotionSafeProvenance: false,
      outputSignalReview: false,
      outputSignalReviewCandidate: false,
      rowEvidencePromotionReady: false,
      promotionCandidate: false,
    };
  }

  scanStrings(artifact, (text, jsonPath) => {
    for (const { pattern, message } of disallowedStringPatterns) {
      if (pattern.test(text)) {
        addProblem(jsonPath, message);
      }
    }
  });

  if (artifact.schema !== officialOutputCaptureSchema) {
    addProblem("$.schema", `must equal ${officialOutputCaptureSchema}`);
  }
  if (!isNonEmptyString(artifact.slug)) {
    addProblem("$.slug", "must be a non-empty package slug");
  }
  if (expectedSlug && artifact.slug !== expectedSlug) {
    addProblem("$.slug", `must match artifact filename slug ${expectedSlug}`);
  }
  if (!isNonEmptyString(artifact.title)) {
    addProblem("$.title", "must be a non-empty report title");
  }
  if (!isNonEmptyString(artifact.capturedAt) || Number.isNaN(Date.parse(artifact.capturedAt))) {
    addProblem("$.capturedAt", "must be an ISO timestamp");
  }

  const officialUrl = firstString(artifact, ["captureUrl", "sourceUrl", "url", "finalUrl"]);
  if (!officialUrl || !sequencingUrlPattern.test(officialUrl)) {
    addProblem("$.captureUrl", "must identify the official Sequencing.com capture/source URL");
  }

  const privacyBoundary = artifact.privacyBoundary;
  if (!isPlainObject(privacyBoundary)) {
    addProblem("$.privacyBoundary", "must describe the privacy boundary for the commit-safe capture");
  } else {
    if (privacyBoundary.rawGenomeIncluded !== false) {
      addProblem("$.privacyBoundary.rawGenomeIncluded", "must be false");
    }
    if (!commitSafePrivacyMode(privacyBoundary)) {
      addProblem(
        "$.privacyBoundary",
        "must set privateValuesRedacted true for sanitized private captures or publicSourceOnly true for public/non-private captures",
      );
    }
    if (privacyBoundary.commitSafe !== true) {
      addProblem("$.privacyBoundary.commitSafe", "must be true");
    }
  }

  const reportFile = isNonEmptyString(artifact.reportFile) ? artifact.reportFile : null;
  const sampleRows = Array.isArray(artifact.sampleRows) ? artifact.sampleRows : [];
  const resultRows = Array.isArray(artifact.resultRows) ? artifact.resultRows : [];
  const formalFields = Array.isArray(artifact.formalFields) ? artifact.formalFields : [];
  const citationBindings = Array.isArray(artifact.citationBindings) ? artifact.citationBindings : [];
  const generatedOutput = artifact.generatedOutput;
  if (isPlainObject(generatedOutput) && generatedOutput.privateResultUrlCommitted === true) {
    addProblem("$.generatedOutput.privateResultUrlCommitted", "must not be true");
  }
  const outputSignals = {
    reportFile: Boolean(reportFile),
    sampleRows: sampleRows.length,
    resultRows: resultRows.length,
    formalFields: formalFields.length,
    citationBindings: citationBindings.length,
    generatedOutput: isNonEmptyString(generatedOutput) || hasNonEmptyObject(generatedOutput),
  };

  const sourceArtifacts = artifact.sourceArtifacts ?? artifact.sourceResources ?? [];
  const sourceResources = [
    ...(Array.isArray(artifact.sourceResources) ? artifact.sourceResources : []),
    ...(Array.isArray(artifact.sourceArtifacts)
      ? artifact.sourceArtifacts.filter((resource) => isPlainObject(resource))
      : []),
  ];
  const officialOutputSourceIds = new Set(
    sourceResources
      .filter(isOfficialOutputSourceResource)
      .map(sourceResourceId)
      .filter(isNonEmptyString),
  );
  const listedSourceIds = new Set(sourceResources.map(sourceResourceId).filter(isNonEmptyString));
  const fieldHasOfficialOutputBinding = (field) =>
    sourceIdsForField(field).some((sourceId) => officialOutputSourceIds.has(sourceId));
  const fieldHasReadyOfficialOutputBinding = (field) =>
    rowEvidenceReadySourceBindingStatuses.has(field?.sourceBindingStatus) && fieldHasOfficialOutputBinding(field);

  if (
    !outputSignals.reportFile &&
    outputSignals.sampleRows === 0 &&
    outputSignals.resultRows === 0 &&
    outputSignals.formalFields === 0 &&
    outputSignals.citationBindings === 0 &&
    !outputSignals.generatedOutput
  ) {
    addProblem(
      "$",
      "must expose at least one official output signal: reportFile, sampleRows, resultRows, formalFields, citationBindings, or generatedOutput",
    );
  }

  for (const [index, row] of sampleRows.entries()) {
    validateListedSourceIds(
      sourceIdsForRow(row),
      `$.sampleRows[${index}].sourceResourceIds`,
      listedSourceIds,
      addProblem,
    );
    validateOutputRowSourceBinding(
      row,
      `$.sampleRows[${index}]`,
      officialOutputSourceIds,
      addProblem,
      addWarning,
    );
  }

  for (const [index, row] of resultRows.entries()) {
    validateListedSourceIds(
      sourceIdsForRow(row),
      `$.resultRows[${index}].sourceResourceIds`,
      listedSourceIds,
      addProblem,
    );
    validateOutputRowSourceBinding(
      row,
      `$.resultRows[${index}]`,
      officialOutputSourceIds,
      addProblem,
      addWarning,
    );
  }

  for (const [index, field] of formalFields.entries()) {
    if (!isPlainObject(field)) {
      addProblem(`$.formalFields[${index}]`, "must be an object");
      continue;
    }
    validateListedSourceIds(
      explicitSourceIdsForField(field),
      `$.formalFields[${index}].sourceResourceIds`,
      listedSourceIds,
      addProblem,
    );
    if (!fieldIsCovered(field)) {
      addProblem(
        `$.formalFields[${index}]`,
        "must identify an output/formal field and must not have status pending",
      );
      continue;
    }
    if (!fieldHasOfficialOutputBinding(field)) {
      addWarning(
        `$.formalFields[${index}]`,
        "covered formal fields must cite an official-output source resource before rowEvidenceReady can be true",
      );
    }
    if (!sourceBindingStatuses.has(field.sourceBindingStatus)) {
      addWarning(
        `$.formalFields[${index}].sourceBindingStatus`,
        "covered formal fields must carry an available sourceBindingStatus before rowEvidenceReady can be true",
      );
    }
  }

  const outputRowIds = new Set(
    [...sampleRows, ...resultRows]
      .map((row) => (isPlainObject(row) ? row.rowId : null))
      .filter(isNonEmptyString),
  );

  for (const [index, binding] of citationBindings.entries()) {
    if (!isPlainObject(binding)) {
      addProblem(`$.citationBindings[${index}]`, "must be an object");
      continue;
    }
    if (!isNonEmptyString(binding.rowId)) {
      addProblem(`$.citationBindings[${index}].rowId`, "must reference a source-backed sampleRows[] or resultRows[] rowId");
    } else if (!outputRowIds.has(binding.rowId)) {
      addProblem(
        `$.citationBindings[${index}].rowId`,
        `must reference an existing sampleRows[] or resultRows[] rowId (${binding.rowId} was not found)`,
      );
    }
    validateListedSourceIds(
      sourceIdsForRow(binding),
      `$.citationBindings[${index}].sourceResourceIds`,
      listedSourceIds,
      addProblem,
    );
    if (!bindingIsReady(binding)) {
      addProblem(`$.citationBindings[${index}]`, "must carry non-empty source ids and an available binding status");
    } else if (!bindingHasOfficialOutputSource(binding, officialOutputSourceIds)) {
      addWarning(
        `$.citationBindings[${index}]`,
        "citation bindings must cite an official-output source resource before rowEvidenceReady can be true",
      );
    }
  }

  if (sourceArtifacts !== undefined && !Array.isArray(sourceArtifacts)) {
    addProblem("$.sourceArtifacts", "must be an array when present");
  }
  if (Array.isArray(sourceArtifacts) && sourceArtifacts.length === 0) {
    addWarning("$.sourceArtifacts", "no source artifact/resource references were listed");
  }

  const outputRows = [...sampleRows, ...resultRows];
  const rowEvidenceReady =
    outputRows.length > 0 &&
    outputRows.every((row) => rowHasReadyOfficialOutputBinding(row, officialOutputSourceIds)) &&
    formalFields.length > 0 &&
    formalFields.every((field) => fieldIsCovered(field) && fieldHasReadyOfficialOutputBinding(field)) &&
    citationBindings.length > 0 &&
    citationBindings.every((binding) => bindingHasReadyOfficialOutputSource(binding, officialOutputSourceIds));
  const provenanceStrings = [
    path,
    ...(Array.isArray(sourceArtifacts)
      ? sourceArtifacts.map((source) => (typeof source === "string" ? source : JSON.stringify(source)))
      : []),
    ...(Array.isArray(sourceResources)
      ? sourceResources.map((source) => (typeof source === "string" ? source : JSON.stringify(source)))
      : []),
  ].filter(isNonEmptyString);
  const promotionSafeProvenance =
    isNonEmptyString(path) &&
    committedOfficialOutputCapturePathPattern.test(path) &&
    provenanceStrings.every((value) => !unsafePromotionProvenancePattern.test(value));
  if (rowEvidenceReady && !promotionSafeProvenance) {
    warnings.push({
      path: "$",
      message:
        "row evidence shape is valid, but promotion requires a committed reference/catalog official-output capture without tmp, smoke, template, placeholder, or dry-run provenance",
    });
  }
  const validRowEvidenceReady = problems.length === 0 && rowEvidenceReady;
  const outputSignalReview =
    problems.length === 0 &&
    (validRowEvidenceReady || Boolean(reportFile) || resultRows.length > 0 || outputSignals.generatedOutput);
  const rowEvidencePromotionReady = validRowEvidenceReady && promotionSafeProvenance;

  return {
    ok: problems.length === 0,
    path,
    slug: artifact.slug ?? expectedSlug ?? null,
    title: artifact.title ?? null,
    officialUrl,
    problems,
    warnings,
    outputSignals,
    rowEvidenceReady: validRowEvidenceReady,
    promotionSafeProvenance,
    outputSignalReview,
    outputSignalReviewCandidate: outputSignalReview,
    rowEvidencePromotionReady,
    promotionCandidate: rowEvidencePromotionReady,
  };
};

export const slugFromOfficialOutputCapturePath = (path) => {
  const filename = String(path).split("/").pop() ?? "";
  const match = /^(.+)-official-output-capture-\d{4}-\d{2}-\d{2}\.json$/.exec(filename);
  return match?.[1] ?? null;
};
