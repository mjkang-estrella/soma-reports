#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";

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
const reportSlugArg = args.get("--report") ?? null;
const outPathArg = args.get("--out") ?? args.get("--result") ?? null;
const baseResultArg = args.get("--base-result") ?? null;
const format = args.get("--format") ?? "json";

if (!["json", "compact"].includes(format)) {
  throw new Error(`Unsupported --format ${format}; expected json or compact`);
}

if (!inputPath) {
  throw new Error(
    "Usage: npm run agent:generate-local-result -- --input tmp/agent-runs/<slug>.agent-input.json [--out tmp/agent-runs/<slug>.agent-result.json]",
  );
}

if (!existsSync(inputPath)) {
  throw new Error(`Missing prepared local-agent input: ${inputPath}`);
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};
const sha256Text = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const sha256File = (path) => (existsSync(path) ? sha256Text(readFileSync(path)) : null);
const clone = (value) => JSON.parse(JSON.stringify(value));
const isPlainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const asArray = (value) => (Array.isArray(value) ? value : []);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const uniqueStrings = (values) => [...new Set(values.filter(isNonEmptyString).map((value) => value.trim()))];
const normalizeComparable = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const prepared = readJson(inputPath);
const reportSlug = reportSlugArg ?? prepared.reportSlug;

if (prepared.schemaVersion !== "soma-reports.local-agent-run-input.v1") {
  throw new Error(`Prepared input must use soma-reports.local-agent-run-input.v1; saw ${prepared.schemaVersion}`);
}
if (!isNonEmptyString(reportSlug)) {
  throw new Error("Prepared input must include reportSlug, or pass --report <slug>");
}

const baseResultPath = baseResultArg ?? prepared.outputValidation?.resultPath ?? `fixtures/synthetic/${reportSlug}.result.json`;
if (!existsSync(baseResultPath)) {
  throw new Error(`Missing base deterministic result: ${baseResultPath}`);
}

const outPath = outPathArg ?? `tmp/agent-runs/${reportSlug}.agent-result.json`;
const baseResult = readJson(baseResultPath);
const result = clone(baseResult);
const genomeEvidence = asArray(prepared.agentRunInput?.genomeEvidence);
const usableLocalEvidenceRows = genomeEvidence.filter(
  (row) =>
    ["observed", "observed_record_no_genotype", "reference_block_covered"].includes(row?.matchStatus) &&
    isNonEmptyString(row?.observedValue),
);

const preparedReferences = [
  ...asArray(prepared.agentRunInput?.referenceResources),
  ...asArray(prepared.formalArtifacts?.references),
  ...asArray(prepared.formalArtifacts?.sourceArtifacts),
];
const referenceById = new Map();
for (const resource of preparedReferences) {
  const id = resource?.id ?? resource?.resourceId;
  if (!isNonEmptyString(id) || referenceById.has(id)) {
    continue;
  }
  referenceById.set(id, {
    id,
    title: resource.title ?? resource.name ?? id,
    url: resource.url,
    usedFor: uniqueStrings(asArray(resource.usedFor).concat(asArray(resource.sourceTags))),
  });
}

const ensureObject = (owner, key) => {
  if (!isPlainObject(owner[key])) {
    owner[key] = {};
  }
  return owner[key];
};
const ensureStringArray = (owner, key, fallback) => {
  if (!Array.isArray(owner[key])) {
    owner[key] = fallback;
  }
  owner[key] = uniqueStrings(owner[key].concat(fallback));
};

const appendix = ensureObject(result, "appendix");
appendix.genotypeSummary = genomeEvidence.map((row) => ({
  inputId: row.inputId,
  ...(isNonEmptyString(row.rsid) ? { rsid: row.rsid } : {}),
  ...(isNonEmptyString(row.variantId) ? { variantId: row.variantId } : {}),
  gene: row.gene,
  observedValue: row.observedValue,
  matchStatus: row.matchStatus,
  assembly: row.assembly,
}));

if (!Array.isArray(appendix.probabilities)) {
  appendix.probabilities = [];
}
appendix.probabilities = appendix.probabilities.map((entry) => (isPlainObject(entry) ? entry : { note: String(entry) }));
if (appendix.probabilities.length === 0) {
  appendix.probabilities.push({
    label: "Local probability boundary",
    value: "not quantified",
    note: "This deterministic local result does not calculate calibrated probabilities.",
  });
}

ensureStringArray(appendix, "uncertainty", [
  "Local derived evidence can support a report-style interpretation, but this deterministic result is not clinical advice.",
]);
ensureStringArray(appendix, "missingInputs", []);
ensureStringArray(appendix, "limitations", [
  "This deterministic local result uses derived evidence only and does not include raw genome data.",
  "Probabilities, calibration, diagnosis, treatment action, and medication dosing require separate validated evidence and clinician review.",
]);

if (!isPlainObject(result.reportOverview)) {
  result.reportOverview = {};
}
result.reportOverview.localRunHash = prepared.localRunHash;
result.reportOverview.bundleHash = prepared.bundleHash;
result.reportOverview.inputManifestHash = sha256Text(JSON.stringify(prepared.agentRunInput));
result.reportOverview.plainEnglishSummary =
  "This deterministic local result adapts the package output shape to local derived evidence. It is intended for local review and validation, not diagnosis or treatment.";

if (!Array.isArray(result.resultRows) || result.resultRows.length === 0) {
  result.resultRows = [
    {
      groupTitle: "Local derived evidence",
      item: reportSlug,
      brandName: null,
      geneticAnalysis: "Local derived evidence is available for this prepared input.",
      genes: uniqueStrings(genomeEvidence.map((row) => row.gene)),
      sourceLabel: "Prepared local agent input",
      sourceIds: ["source-unavailable"],
      plainEnglishMeaning:
        "This row summarizes local derived evidence for validation. It does not diagnose a condition or recommend treatment.",
    },
  ];
}

const rows = result.resultRows;
const rowText = (row) =>
  normalizeComparable(
    JSON.stringify({
      groupTitle: row.groupTitle,
      item: row.item,
      genes: row.genes,
      geneticAnalysis: row.geneticAnalysis,
      plainEnglishMeaning: row.plainEnglishMeaning,
    }),
  );
const rowIndexForEvidence = (evidenceRow, fallbackIndex) => {
  const gene = normalizeComparable(evidenceRow.gene);
  const rsid = normalizeComparable(evidenceRow.rsid ?? evidenceRow.variantId);
  const direct = rows.findIndex((row) => {
    const text = rowText(row);
    return (gene && text.includes(gene)) || (rsid && text.includes(rsid));
  });
  return direct >= 0 ? direct : fallbackIndex % rows.length;
};

const localEvidenceNotes = [];
for (const [index, evidenceRow] of usableLocalEvidenceRows.entries()) {
  const marker = uniqueStrings([evidenceRow.gene, evidenceRow.rsid ?? evidenceRow.variantId ?? evidenceRow.inputId]).join(" ");
  const sentence = `Local derived evidence for ${marker} observed ${evidenceRow.observedValue}; use this as local context only, not as a diagnosis or treatment instruction.`;
  const row = rows[rowIndexForEvidence(evidenceRow, index)];
  row.plainEnglishMeaning = uniqueStrings([row.plainEnglishMeaning, sentence]).join(" ");
  localEvidenceNotes.push(sentence);
}

for (const [index, row] of rows.entries()) {
  if (!isPlainObject(row)) {
    rows[index] = {
      groupTitle: "Local derived evidence",
      item: reportSlug,
      brandName: null,
      geneticAnalysis: String(row ?? "Local derived evidence unavailable."),
      genes: uniqueStrings(genomeEvidence.map((entry) => entry.gene)),
      sourceLabel: "Prepared local agent input",
      sourceIds: ["source-unavailable"],
      plainEnglishMeaning:
        "This row summarizes local derived evidence for validation. It does not diagnose a condition or recommend treatment.",
    };
    continue;
  }
  row.groupTitle = isNonEmptyString(row.groupTitle) ? row.groupTitle : "Local derived evidence";
  row.item = isNonEmptyString(row.item) ? row.item : reportSlug;
  row.brandName = row.brandName === null || typeof row.brandName === "string" ? row.brandName : null;
  row.geneticAnalysis = isNonEmptyString(row.geneticAnalysis)
    ? row.geneticAnalysis
    : "Local derived evidence is available for this prepared input.";
  row.genes = uniqueStrings(asArray(row.genes).concat(genomeEvidence[index]?.gene ? [genomeEvidence[index].gene] : []));
  if (row.genes.length === 0) {
    row.genes = uniqueStrings(genomeEvidence.map((entry) => entry.gene));
  }
  row.sourceLabel = isNonEmptyString(row.sourceLabel) ? row.sourceLabel : "Prepared local agent input";
  const sourceIds = uniqueStrings(asArray(row.sourceIds));
  row.sourceIds = sourceIds.length > 0 ? sourceIds : ["source-unavailable"];
  row.plainEnglishMeaning = isNonEmptyString(row.plainEnglishMeaning)
    ? row.plainEnglishMeaning
    : "This row summarizes local derived evidence for validation. It does not diagnose a condition or recommend treatment.";
  if (isNonEmptyString(row.sourceBindingStatus)) {
    row.sourceBindingStatus = ["exact", "curated", "sample_label_only", "unavailable"].includes(row.sourceBindingStatus)
      ? row.sourceBindingStatus
      : "curated";
  }
}

const resultSourceIds = uniqueStrings(rows.flatMap((row) => asArray(row.sourceIds)));
const existingReferences = asArray(result.references).filter(isPlainObject);
const existingReferenceIds = new Set(
  existingReferences.map((resource) => resource.id ?? resource.resourceId).filter(isNonEmptyString),
);
const references = [...existingReferences];
for (const sourceId of resultSourceIds) {
  if (existingReferenceIds.has(sourceId)) {
    continue;
  }
  const preparedReference = referenceById.get(sourceId);
  references.push(
    preparedReference ?? {
      id: sourceId,
      title: sourceId === "source-unavailable" ? "Source unavailable for this local row" : sourceId,
      usedFor: ["local_result_validation"],
    },
  );
  existingReferenceIds.add(sourceId);
}
result.references = references;

if (prepared.readiness?.localScaffoldOnly === true || prepared.scaffoldBoundary?.localScaffoldOnly === true) {
  result.officialCoverageBoundary = {
    status: "local_scaffold_only",
    message:
      "This local result is provisional scaffold output because official sample-backed output evidence is unavailable for this package.",
  };
  ensureStringArray(appendix, "limitations", [
    "Official sample-backed output evidence is not captured for this package, so this local result must remain scaffold-only.",
  ]);
}

writeJson(outPath, result);

const localObservedValuesInBody = usableLocalEvidenceRows.filter((row) =>
  normalizeComparable(JSON.stringify({ resultRows: result.resultRows, sampleRows: result.sampleRows, findings: result.findings })).includes(
    normalizeComparable(row.observedValue),
  ),
);
const summary = {
  schemaVersion: "soma-reports.local-deterministic-agent-result.v1",
  generatedAt: new Date().toISOString(),
  ok: true,
  reportSlug,
  inputPath,
  baseResultPath,
  outPath,
  inputHash: sha256File(inputPath),
  resultHash: sha256File(outPath),
  resultRows: rows.length,
  genotypeSummaryRows: appendix.genotypeSummary.length,
  localEvidenceRows: genomeEvidence.length,
  usableLocalEvidenceRows: usableLocalEvidenceRows.length,
  localObservedValuesInBody: localObservedValuesInBody.length,
  rawGenomeIncluded: false,
  localRunHash: prepared.localRunHash,
};

console.log(
  JSON.stringify(
    format === "compact"
      ? {
          ok: summary.ok,
          reportSlug: summary.reportSlug,
          outPath: summary.outPath,
          resultRows: summary.resultRows,
          genotypeSummaryRows: summary.genotypeSummaryRows,
          localEvidenceRows: summary.localEvidenceRows,
          usableLocalEvidenceRows: summary.usableLocalEvidenceRows,
          localObservedValuesInBody: summary.localObservedValuesInBody,
          rawGenomeIncluded: summary.rawGenomeIncluded,
          localRunHash: summary.localRunHash,
          resultHash: summary.resultHash,
        }
      : summary,
    null,
    2,
  ),
);
