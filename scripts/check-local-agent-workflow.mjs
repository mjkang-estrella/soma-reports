#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

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
const strict = args.get("--strict") === "true";
const format = args.get("--format") ?? "json";

if (!["json", "compact"].includes(format)) {
  throw new Error(`Unsupported --format ${format}; expected json or compact`);
}

if (!reportSlug) {
  throw new Error(
    "Usage: npm run agent:workflow-check -- --report <slug> [--bundle tmp/agent-bundles/<slug>.validated.json] [--evidence tmp/evidence-templates/<slug>.filled-derived-evidence.json] [--input tmp/agent-runs/<slug>.agent-input.json] [--result tmp/agent-runs/<slug>.agent-result.json] [--strict true]",
  );
}

const bundlePath = args.get("--bundle") ?? `tmp/agent-bundles/${reportSlug}.validated.json`;
const evidenceTemplatePath =
  args.get("--template") ?? `tmp/evidence-templates/${reportSlug}.derived-evidence-template.json`;
const evidencePath = args.get("--evidence") ?? `tmp/evidence-templates/${reportSlug}.filled-derived-evidence.json`;
const inputPath = args.get("--input") ?? `tmp/agent-runs/${reportSlug}.agent-input.json`;
const resultPath = args.get("--result") ?? `tmp/agent-runs/${reportSlug}.agent-result.json`;
const validationPath = args.get("--validation") ?? `tmp/agent-runs/${reportSlug}.validation.json`;
const promptPath = `prompts/${reportSlug}.md`;
const fixturePath = `fixtures/synthetic/${reportSlug}.fixture.json`;
const deterministicResultPath = `fixtures/synthetic/${reportSlug}.result.json`;
const formalBlockerLedgerPath = "reference/catalog/sample-promotion-rejections-2026-06-23.json";

const sha256Text = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const sha256 = (value) => sha256Text(JSON.stringify(value));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const maybeReadJson = (path) => (existsSync(path) ? readJson(path) : null);
const isPlainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const parseFieldPath = (fieldPath) => fieldPath.replaceAll("[]", ".[]").split(".").filter(Boolean);
const valuesAtFieldPath = (value, fieldPath) => {
  const walkPath = (node, parts) => {
    if (parts.length === 0) return [node];
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
  if (type?.endsWith("[]")) {
    if (!Array.isArray(value)) return false;
    const itemType = type.slice(0, -2);
    if (itemType === "string") return value.every(isNonEmptyString);
    if (itemType === "number") return value.every((entry) => typeof entry === "number" && Number.isFinite(entry));
    if (itemType === "boolean") return value.every((entry) => typeof entry === "boolean");
    if (itemType === "object") return value.every(isPlainObject);
    return value.every((entry) => entry !== null && entry !== undefined);
  }
  if (type === "string") return isNonEmptyString(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "boolean") return typeof value === "boolean";
  if (type === "object") return isPlainObject(value);
  return value !== null && value !== undefined;
};
const formalOutputFieldPathContractFrom = (value) => value?.outputValidation?.formalOutputFieldPathContract ?? null;
const formalContractRequiredPaths = (contract) =>
  Array.isArray(contract?.requiredPaths) ? contract.requiredPaths : [];
const formalContractSignature = (contract) =>
  formalContractRequiredPaths(contract).map((field) =>
    JSON.stringify({
      sortOrder: field.sortOrder,
      fieldPath: field.fieldPath,
      label: field.label,
      type: field.type,
      required: field.required === true,
      citationRequired: field.citationRequired === true,
      allowsUnavailable: field.allowsUnavailable === true,
      sourceBinding: field.sourceBinding ?? null,
    }),
  );
const isUsableEvidenceStatus = (value) =>
  !new Set([
    "filtered",
    "missing",
    "not_found",
    "not-found",
    "source-output-unavailable",
    "unavailable",
    "unknown",
  ]).has(String(value ?? "").trim().toLowerCase());
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
const longDnaSequence = /\b[ACGTN]{80,}\b/i;
const vcfHeader = /#CHROM\s+POS\s+ID\s+REF\s+ALT/i;
const vcfRecord =
  /(^|\n)(?:chr)?(?:[0-9]{1,2}|X|Y|M|MT)\t\d+\t[^\t]*\t[ACGTN.]+\t(?:[ACGTN,<>.]+)\t/i;
const fastqShape = /(^|\n)@[^\n]+\n[ACGTN]{20,}\n\+\n[!-~]{20,}/i;
const rawGenomeFileReference = /(?:^|[\s"'(])(?:[~./]|[A-Za-z0-9_-])[\w./~ -]*\.(?:bam|cram|fastq|fq|gvcf|sam|vcf)(?:\.gz)?(?=$|[\s"',)])/i;

const checks = [];
const record = (status, id, path, message, strictFailure = false) => {
  checks.push({
    id,
    status,
    severity: status === "fail" ? "error" : status === "warn" ? "warning" : "info",
    path,
    message,
    strictFailure,
  });
};
const pass = (id, path, message) => record("pass", id, path, message, false);
const warn = (id, path, message, strictFailure = false) => record("warn", id, path, message, strictFailure);
const fail = (id, path, message) => record("fail", id, path, message, true);
const scanForRawGenomeLeakage = (value, rootPath) => {
  const problems = [];
  const visit = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (isPlainObject(node)) {
      for (const [key, entry] of Object.entries(node)) {
        const childPath = `${path}.${key}`;
        if (rawFieldNames.has(key)) {
          problems.push(`${childPath} looks like raw genome data`);
        }
        visit(entry, childPath);
      }
      return;
    }
    if (typeof node !== "string") {
      return;
    }
    if (vcfHeader.test(node) || vcfRecord.test(node) || fastqShape.test(node) || longDnaSequence.test(node)) {
      problems.push(`${path} contains raw-sequence-like content`);
    }
    if (rawGenomeFileReference.test(node)) {
      problems.push(`${path} points at a raw genome file`);
    }
  };
  visit(value, rootPath);
  return problems;
};
const checkRequiredFile = (id, path, label) => {
  if (existsSync(path)) {
    pass(id, path, `${label} exists`);
    return true;
  }
  fail(id, path, `${label} is missing`);
  return false;
};
const checkOptionalGeneratedFile = (id, path, label) => {
  if (existsSync(path)) {
    pass(id, path, `${label} exists`);
    return true;
  }
  warn(id, path, `${label} is not present yet`, strict);
  return false;
};

checkRequiredFile("SOURCE.PROMPT", promptPath, "prompt");
checkRequiredFile("SOURCE.FIXTURE", fixturePath, "synthetic fixture");
checkRequiredFile("SOURCE.RESULT", deterministicResultPath, "deterministic example result");
const hasBundle = checkOptionalGeneratedFile("GENERATED.BUNDLE", bundlePath, "validated bundle");
const hasEvidence = checkOptionalGeneratedFile("GENERATED.EVIDENCE", evidencePath, "filled derived evidence");
const hasPreparedInput = checkOptionalGeneratedFile("GENERATED.PREPARED_INPUT", inputPath, "prepared local-agent input");
const hasAgentResult = checkOptionalGeneratedFile("GENERATED.AGENT_RESULT", resultPath, "local-agent result");

const formalBlockerLedger = maybeReadJson(formalBlockerLedgerPath);
const formalBlockerDecision = (formalBlockerLedger?.decisions ?? []).find((entry) => entry?.slug === reportSlug) ?? null;
const bundle = hasBundle ? maybeReadJson(bundlePath) : null;
const evidence = hasEvidence ? maybeReadJson(evidencePath) : null;
const preparedInput = hasPreparedInput ? maybeReadJson(inputPath) : null;
const agentResultText = hasAgentResult ? readFileSync(resultPath, "utf8") : null;

if (bundle && bundle.reportSlug !== reportSlug) {
  fail("BUNDLE.REPORT_SLUG", bundlePath, `bundle reportSlug ${bundle.reportSlug ?? "missing"} does not match ${reportSlug}`);
} else if (bundle) {
  pass("BUNDLE.REPORT_SLUG", bundlePath, "bundle reportSlug matches requested report");
}

if (preparedInput && preparedInput.reportSlug !== reportSlug) {
  fail(
    "INPUT.REPORT_SLUG",
    inputPath,
    `prepared input reportSlug ${preparedInput.reportSlug ?? "missing"} does not match ${reportSlug}`,
  );
} else if (preparedInput) {
  pass("INPUT.REPORT_SLUG", inputPath, "prepared input reportSlug matches requested report");
}

const evidenceRows = Array.isArray(evidence) ? evidence : evidence?.genomeEvidence;
const evidenceCounts = {
  rows: Array.isArray(evidenceRows) ? evidenceRows.length : 0,
  usableRows: Array.isArray(evidenceRows)
    ? evidenceRows.filter((row) => row?.observedValue && isUsableEvidenceStatus(row?.matchStatus)).length
    : 0,
  unavailableRows: Array.isArray(evidenceRows)
    ? evidenceRows.filter((row) => !row?.observedValue || !isUsableEvidenceStatus(row?.matchStatus)).length
    : 0,
};
if (hasEvidence && !Array.isArray(evidenceRows)) {
  fail("EVIDENCE.SHAPE", evidencePath, "filled derived evidence must be an array or an object with genomeEvidence[]");
} else if (hasEvidence) {
  pass("EVIDENCE.SHAPE", evidencePath, "filled derived evidence has genomeEvidence rows");
  const rawEvidenceProblems = scanForRawGenomeLeakage(evidenceRows, "$.genomeEvidence");
  if (rawEvidenceProblems.length > 0) {
    fail("EVIDENCE.PRIVACY_RAW_GENOME", evidencePath, rawEvidenceProblems.slice(0, 3).join("; "));
  } else {
    pass("EVIDENCE.PRIVACY_RAW_GENOME", evidencePath, "filled derived evidence contains no raw-genome-shaped payload");
  }
  if (evidenceCounts.usableRows === 0) {
    warn("EVIDENCE.USABLE_ROWS", evidencePath, "no usable local observations are present; prepare requires --allow-empty true", strict);
  } else {
    pass("EVIDENCE.USABLE_ROWS", evidencePath, `${evidenceCounts.usableRows} usable local observations are present`);
  }
}

const bundleLocalScaffoldOnly =
  bundle?.readiness?.localScaffoldOnly === true || formalBlockerDecision?.localScaffoldPackage === true || Boolean(formalBlockerDecision);
const allowLocalScaffold = args.get("--allow-local-scaffold") === "true" || args.get("--allow-scaffold") === "true";
if (bundleLocalScaffoldOnly && !allowLocalScaffold) {
  warn(
    "READINESS.LOCAL_SCAFFOLD_FLAG",
    bundlePath,
    "report is local-scaffold-only; prepare requires --allow-local-scaffold true for provisional local runs",
    strict,
  );
} else if (bundleLocalScaffoldOnly) {
  pass("READINESS.LOCAL_SCAFFOLD_FLAG", bundlePath, "local-scaffold boundary is explicit in the workflow command");
}

if (preparedInput) {
  const rawGenomeIncluded = preparedInput.privacyBoundary?.rawGenomeIncluded ?? preparedInput.agentRunInput?.inputManifest?.rawGenomeReturned;
  if (rawGenomeIncluded === true) {
    fail("INPUT.PRIVACY_RAW_GENOME", inputPath, "prepared input reports raw genome inclusion");
  } else {
    pass("INPUT.PRIVACY_RAW_GENOME", inputPath, "prepared input keeps raw genome out of the payload");
  }
  const rawInputProblems = scanForRawGenomeLeakage(preparedInput, "$");
  if (rawInputProblems.length > 0) {
    fail("INPUT.PRIVACY_RAW_GENOME_SCAN", inputPath, rawInputProblems.slice(0, 3).join("; "));
  } else {
    pass("INPUT.PRIVACY_RAW_GENOME_SCAN", inputPath, "prepared input contains no raw-genome-shaped payload");
  }
}

let parsedAgentResult = null;
if (hasAgentResult) {
  try {
    parsedAgentResult = JSON.parse(agentResultText);
    if (!isPlainObject(parsedAgentResult)) {
      fail("RESULT.JSON_OBJECT", resultPath, "local-agent result must be a JSON object");
    } else {
      pass("RESULT.JSON_OBJECT", resultPath, "local-agent result is a JSON object");
      const rawResultProblems = scanForRawGenomeLeakage(parsedAgentResult, "$");
      if (rawResultProblems.length > 0) {
        fail("RESULT.PRIVACY_RAW_GENOME_SCAN", resultPath, rawResultProblems.slice(0, 3).join("; "));
      } else {
        pass("RESULT.PRIVACY_RAW_GENOME_SCAN", resultPath, "local-agent result contains no raw-genome-shaped payload");
      }
    }
  } catch (error) {
    fail("RESULT.JSON_PARSE", resultPath, `local-agent result is not valid JSON: ${error.message}`);
  }
}

const bundleFieldPathContract = formalOutputFieldPathContractFrom(bundle);
const preparedFieldPathContract = formalOutputFieldPathContractFrom(preparedInput);
const preparedAgentInputFieldPathContract = preparedInput?.agentRunInput?.formalOutputFieldPathContract ?? null;
const bundleContractPaths = formalContractRequiredPaths(bundleFieldPathContract);
const preparedContractPaths = formalContractRequiredPaths(preparedFieldPathContract);
const bundleContractSignature = JSON.stringify(formalContractSignature(bundleFieldPathContract));
const preparedContractSignature = JSON.stringify(formalContractSignature(preparedFieldPathContract));
const preparedAgentContractSignature = JSON.stringify(formalContractSignature(preparedAgentInputFieldPathContract));
const formalFieldPathContract = {
  bundleRequiredPaths: bundleContractPaths.length,
  preparedRequiredPaths: preparedContractPaths.length,
  preparedAgentInputRequiredPaths: formalContractRequiredPaths(preparedAgentInputFieldPathContract).length,
  preparedMatchesBundle: Boolean(bundleFieldPathContract && preparedFieldPathContract) &&
    bundleContractSignature === preparedContractSignature,
  preparedAgentInputMatchesValidation: Boolean(preparedFieldPathContract && preparedAgentInputFieldPathContract) &&
    preparedContractSignature === preparedAgentContractSignature &&
    sha256(preparedFieldPathContract) === sha256(preparedAgentInputFieldPathContract),
  resultRequiredPathsPresent: null,
  resultRequiredPathsTyped: null,
};

if (bundle) {
  if (bundleContractPaths.length > 0) {
    pass(
      "BUNDLE.FORMAL_FIELD_PATH_CONTRACT",
      `${bundlePath}#outputValidation.formalOutputFieldPathContract.requiredPaths`,
      `bundle exposes ${bundleContractPaths.length} ordered formal output field paths`,
    );
  } else {
    fail(
      "BUNDLE.FORMAL_FIELD_PATH_CONTRACT",
      `${bundlePath}#outputValidation.formalOutputFieldPathContract.requiredPaths`,
      "bundle must expose an ordered formal output field-path contract",
    );
  }
}

if (preparedInput) {
  if (preparedContractPaths.length > 0) {
    pass(
      "INPUT.FORMAL_FIELD_PATH_CONTRACT",
      `${inputPath}#outputValidation.formalOutputFieldPathContract.requiredPaths`,
      `prepared input exposes ${preparedContractPaths.length} ordered formal output field paths`,
    );
  } else {
    fail(
      "INPUT.FORMAL_FIELD_PATH_CONTRACT",
      `${inputPath}#outputValidation.formalOutputFieldPathContract.requiredPaths`,
      "prepared input must expose an ordered formal output field-path contract",
    );
  }
  if (bundle) {
    if (formalFieldPathContract.preparedMatchesBundle) {
      pass(
        "INPUT.FORMAL_FIELD_PATH_CONTRACT_MATCHES_BUNDLE",
        `${inputPath}#outputValidation.formalOutputFieldPathContract`,
        "prepared input formal output field-path contract matches the bundle",
      );
    } else {
      fail(
        "INPUT.FORMAL_FIELD_PATH_CONTRACT_MATCHES_BUNDLE",
        `${inputPath}#outputValidation.formalOutputFieldPathContract`,
        "prepared input formal output field-path contract must match the bundle",
      );
    }
  }
  if (formalFieldPathContract.preparedAgentInputMatchesValidation) {
    pass(
      "INPUT.FORMAL_FIELD_PATH_CONTRACT_BINDS_AGENT_INPUT",
      `${inputPath}#agentRunInput.formalOutputFieldPathContract`,
      "agentRunInput carries the same formal output field-path contract as outputValidation",
    );
  } else {
    fail(
      "INPUT.FORMAL_FIELD_PATH_CONTRACT_BINDS_AGENT_INPUT",
      `${inputPath}#agentRunInput.formalOutputFieldPathContract`,
      "agentRunInput must carry the same formal output field-path contract as outputValidation",
    );
  }
}

if (parsedAgentResult && preparedContractPaths.length > 0) {
  const presentCount = preparedContractPaths.filter(
    (field) => isNonEmptyString(field.fieldPath) && valuesAtFieldPath(parsedAgentResult, field.fieldPath).length > 0,
  ).length;
  const typedCount = preparedContractPaths.filter((field) => {
    if (!isNonEmptyString(field.fieldPath)) return false;
    const values = valuesAtFieldPath(parsedAgentResult, field.fieldPath);
    return values.length > 0 && values.every((entry) => valueMatchesExpectedType(entry, field.type, field.fieldPath));
  }).length;
  formalFieldPathContract.resultRequiredPathsPresent = presentCount;
  formalFieldPathContract.resultRequiredPathsTyped = typedCount;
  if (presentCount === preparedContractPaths.length) {
    pass(
      "RESULT.FORMAL_FIELD_PATH_CONTRACT_PRESENT",
      resultPath,
      `local-agent result includes all ${preparedContractPaths.length} formal output field paths`,
    );
  } else {
    fail(
      "RESULT.FORMAL_FIELD_PATH_CONTRACT_PRESENT",
      resultPath,
      `local-agent result includes ${presentCount}/${preparedContractPaths.length} formal output field paths`,
    );
  }
  if (typedCount === preparedContractPaths.length) {
    pass(
      "RESULT.FORMAL_FIELD_PATH_CONTRACT_TYPED",
      resultPath,
      `local-agent result types all ${preparedContractPaths.length} formal output field paths`,
    );
  } else {
    fail(
      "RESULT.FORMAL_FIELD_PATH_CONTRACT_TYPED",
      resultPath,
      `local-agent result types ${typedCount}/${preparedContractPaths.length} formal output field paths`,
    );
  }
}

const scaffoldFlag = bundleLocalScaffoldOnly ? " --allow-local-scaffold true" : "";
const commandPlan = {
  seedCache: "npm run agent:seed-cache",
  exportAllBundles: "npm run agent:export",
  bundleOne: `npm run agent:bundle -- --report ${reportSlug} --fixture ${fixturePath} --result ${deterministicResultPath} --out ${bundlePath}`,
  checkPreflight: `npm run agent:workflow-check -- --report ${reportSlug} --bundle ${bundlePath} --evidence ${evidencePath} --input ${inputPath} --result ${resultPath}${scaffoldFlag}`,
  updateCoordinateMap: "npm run agent:update-rsid-coordinate-map",
  evidenceTemplate: `npm run agent:evidence-template -- --report ${reportSlug} --bundle ${bundlePath} --out ${evidenceTemplatePath}`,
  deriveEvidenceFromVcf: `npm run agent:derive-evidence -- --template ${evidenceTemplatePath} --vcf "$SOMA_LOCAL_GENOME" --out ${evidencePath}`,
  deriveCoverageEvidence:
    reportSlug === "sequencing-depth-and-coverage"
      ? `npm run agent:derive-evidence -- --template ${evidenceTemplatePath} --qc-summary /absolute/path/to/local-depth-summary.json --out ${evidencePath}`
      : null,
  prepare: `npm run agent:prepare -- --report ${reportSlug} --bundle ${bundlePath} --evidence ${evidencePath} --out ${inputPath}${scaffoldFlag}`,
  localRunnerExample: `SOMA_LOCAL_RUNNER=/absolute/path/to/local-json-runner; "$SOMA_LOCAL_RUNNER" < ${inputPath} > ${resultPath}`,
  validateRun: `npm run agent:validate-run -- --input ${inputPath} --result ${resultPath}`,
  validateRunSavedLedger: `npm run agent:validate-run -- --input ${inputPath} --result ${resultPath} --out ${validationPath}`,
  checkStrict: `npm run agent:workflow-check -- --report ${reportSlug} --bundle ${bundlePath} --evidence ${evidencePath} --input ${inputPath} --result ${resultPath}${scaffoldFlag} --strict true`,
};

const summary = {
  passed: checks.filter((entry) => entry.status === "pass").length,
  failed: checks.filter((entry) => entry.status === "fail").length,
  warnings: checks.filter((entry) => entry.status === "warn").length,
  strictWarnings: checks.filter((entry) => entry.status === "warn" && entry.strictFailure).length,
};
const ok = summary.failed === 0 && (!strict || summary.strictWarnings === 0);
const resultRows = Array.isArray(parsedAgentResult?.resultRows) ? parsedAgentResult.resultRows : [];
const sampleRows = Array.isArray(parsedAgentResult?.sampleRows) ? parsedAgentResult.sampleRows : [];
const citedSourceIds = new Set(
  resultRows.flatMap((row) => (Array.isArray(row?.sourceIds) ? row.sourceIds : [])),
);
const emittedReferences = Array.isArray(parsedAgentResult?.references) ? parsedAgentResult.references : [];

const workflow = {
  schemaVersion: "soma-reports.local-agent-workflow-check.v1",
  generatedAt: new Date().toISOString(),
  ok,
  readOnly: true,
  strict,
  reportSlug,
  inputs: {
    bundlePath,
    evidencePath,
    preparedInputPath: inputPath,
    resultPath,
  },
  paths: {
    promptPath,
    fixturePath,
    deterministicResultPath,
    bundlePath,
    evidenceTemplatePath,
    evidencePath,
    inputPath,
    resultPath,
    validationPath,
  },
  sourceHashes: {
    prompt: existsSync(promptPath) ? sha256Text(readFileSync(promptPath, "utf8")) : null,
    fixture: existsSync(fixturePath) ? sha256Text(readFileSync(fixturePath, "utf8")) : null,
    deterministicResult: existsSync(deterministicResultPath)
      ? sha256Text(readFileSync(deterministicResultPath, "utf8"))
      : null,
    bundle: existsSync(bundlePath) ? sha256Text(readFileSync(bundlePath, "utf8")) : null,
    evidence: existsSync(evidencePath) ? sha256Text(readFileSync(evidencePath, "utf8")) : null,
    preparedInput: existsSync(inputPath) ? sha256Text(readFileSync(inputPath, "utf8")) : null,
    agentResult: existsSync(resultPath) ? sha256Text(readFileSync(resultPath, "utf8")) : null,
  },
  hashes: {
    bundleHash: bundle?.bundleHash ?? null,
    evidenceFileHash: existsSync(evidencePath) ? sha256Text(readFileSync(evidencePath, "utf8")) : null,
    localRunHash: preparedInput?.localRunHash ?? null,
    resultHash: existsSync(resultPath) ? sha256Text(readFileSync(resultPath, "utf8")) : null,
  },
  readiness: {
    evidenceStatus: bundle?.readiness?.evidenceStatus ?? formalBlockerDecision?.evidenceStatus ?? null,
    sampleBackedFormalReady: bundle?.readiness?.sampleBackedFormalReady ?? null,
    localScaffoldOnly: bundleLocalScaffoldOnly,
    scaffoldFlagRequired: bundleLocalScaffoldOnly,
    scaffoldFlagPresent: allowLocalScaffold,
    formalBlockerDecision: formalBlockerDecision
      ? {
          decision: formalBlockerDecision.decision,
          reason: formalBlockerDecision.reason,
          requiredEvidenceForPromotion: formalBlockerDecision.requiredEvidenceForPromotion ?? [],
        }
      : null,
  },
  evidenceCounts,
  formalFieldPathContract,
  resultCounts: {
    resultRows: resultRows.length,
    sampleRows: sampleRows.length,
    citedSourceIds: citedSourceIds.size,
    emittedReferences: emittedReferences.length,
  },
  commandPlan,
  summary,
  checks,
  privacyBoundary: {
    rawGenomeIncluded: preparedInput?.privacyBoundary?.rawGenomeIncluded ?? false,
    derivedEvidenceOnly: preparedInput?.privacyBoundary?.derivedEvidenceOnly ?? true,
    rawGenomeReturned: preparedInput?.agentRunInput?.inputManifest?.rawGenomeReturned ?? false,
    policy:
      "This is a read-only workflow verifier. It only reads prompt, fixture, bundle, derived-evidence, prepared-input, and result metadata; it does not write tmp outputs and does not read raw genome files.",
  },
};

const compact = {
  schemaVersion: workflow.schemaVersion,
  generatedAt: workflow.generatedAt,
  ok: workflow.ok,
  strict: workflow.strict,
  reportSlug,
  readOnly: workflow.readOnly,
  readiness: workflow.readiness,
  evidenceCounts,
  formalFieldPathContract,
  resultCounts: workflow.resultCounts,
  summary,
  commandPlan,
  failedChecks: checks.filter((entry) => entry.status === "fail" || (strict && entry.strictFailure)),
};

console.log(JSON.stringify(format === "compact" ? compact : workflow, null, 2));
process.exitCode = ok ? 0 : 1;
