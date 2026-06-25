#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  officialOutputCaptureSchema,
  validateOfficialOutputCaptureArtifact,
} from "./lib/official-output-capture-validator.mjs";

const redactionSchemaVersion = "soma-reports.private-output-redaction.v1";
const blockerLedgerPath = "reference/catalog/sample-promotion-rejections-2026-06-23.json";

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
const inputPath = args.get("--input");
const allowBoundaryOnly = args.get("--allow-boundary-only") === "true";
const confirmCommitSafe = args.get("--confirm-commit-safe") === "true";
const allowReferenceOut = args.get("--allow-reference-out") === "true" || confirmCommitSafe;
const dryRun = args.get("--dry-run") === "true";

if (!inputPath) {
  throw new Error(
    "Usage: npm run scaffold:sanitize-output -- --input .soma/private/official-output-redactions/<slug>-redaction-input.json [--out tmp/sanitized-captures/<slug>-official-output-capture-YYYY-MM-DD.json] [--dry-run true]",
  );
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const asArray = (value) => (Array.isArray(value) ? value : []);
const localDateStamp = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = localDateStamp();
const input = readJson(inputPath);
const slug = input.slug;
const defaultOutPath = `tmp/sanitized-captures/${slug}-official-output-capture-${today}.json`;
const outPath = args.get("--out") ?? defaultOutPath;
const committedOutPath = `reference/catalog/${slug}-official-output-capture-${today}.json`;

const problems = [];
const addProblem = (message) => problems.push(message);

if (input.schemaVersion !== redactionSchemaVersion) {
  addProblem(`input schemaVersion must equal ${redactionSchemaVersion}`);
}
if (!isNonEmptyString(slug)) {
  addProblem("input slug is required");
}
if (!isNonEmptyString(input.title)) {
  addProblem("input title is required");
}
if (!isNonEmptyString(input.captureUrl) || !/^https:\/\/(?:www\.)?sequencing\.com\//i.test(input.captureUrl)) {
  addProblem("input captureUrl must be an official Sequencing.com URL");
}
if (!isNonEmptyString(input.capturedAt) || Number.isNaN(Date.parse(input.capturedAt))) {
  addProblem("input capturedAt must be an ISO timestamp");
}
if (!dryRun && outPath.startsWith("reference/catalog/") && !allowReferenceOut) {
  addProblem("writing directly to reference/catalog requires --confirm-commit-safe true");
}

const blockerLedger = existsSync(blockerLedgerPath) ? readJson(blockerLedgerPath) : { decisions: [] };
const blockerDecision = (blockerLedger.decisions ?? []).find((decision) => decision.slug === slug) ?? null;
if (!blockerDecision) {
  addProblem(`input slug ${slug ?? "(missing)"} is not in the current formal evidence blocker ledger`);
}

const privacyReview = isPlainObject(input.privacyReview) ? input.privacyReview : {};
if (privacyReview.rawGenomeIncluded !== false || input.privateSource?.rawGenomeIncluded !== false) {
  addProblem("rawGenomeIncluded must be false in privateSource and privacyReview");
}
if (input.privateSource?.keepOutsideRepository !== true) {
  addProblem("privateSource.keepOutsideRepository must be true");
}
if (privacyReview.privateValuesRedacted !== true) {
  addProblem("privacyReview.privateValuesRedacted must be true");
}
if (privacyReview.commitSafeAfterSanitizer !== true) {
  addProblem("privacyReview.commitSafeAfterSanitizer must be true");
}

const placeholderPattern = /\breplace-(?:me|with)\b|replace_with_|YYYY-MM-DD/i;
const privatePathPattern =
  /(?:\/Users\/[^/\s]+\/Documents\/Genome\/Raw|\.soma\/private|(?:^|[/"'\s])(?:data|private(?!\/local\b)|genomes|reports\/output)\/|file:\/\/|\/[^/\s]+\.(?:vcf(?:\.gz)?|bam|cram|fastq(?:\.gz)?)\b|\b(?:genome|sample|raw|wgs|dna|23andme|ancestry)[\w.-]*\.(?:vcf(?:\.gz)?|bam|cram|fastq(?:\.gz)?)\b|_RawData\.txt\b)/i;
const privateSequencingUrlPattern =
  /https:\/\/(?:www\.)?sequencing\.com\/(?!(?:marketplace|knowledge-center|education-center|order|apps\/app-market)\b)[^\s"'<>]*/i;

if (privacyReview.privateFindingValuesCommitted !== false) {
  addProblem("privacyReview.privateFindingValuesCommitted must be false");
}
if (privateSequencingUrlPattern.test(input.captureUrl ?? "")) {
  addProblem("input captureUrl must be a public Sequencing.com source URL, not a private result/account URL");
}
if (input.generatedOutputSummary?.privateResultUrlCommitted === true) {
  addProblem("generatedOutputSummary.privateResultUrlCommitted must not be true");
}

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

const scanExemptPathPrefixes = ["$.privateSource.", "$.validationCommands"];

scanStrings(input, (text, path) => {
  if (scanExemptPathPrefixes.some((prefix) => path.startsWith(prefix))) {
    return;
  }
  if (placeholderPattern.test(text)) {
    addProblem(`${path}: placeholder text must be replaced before sanitizing`);
  }
  if (privatePathPattern.test(text)) {
    addProblem(`${path}: private/local file paths cannot appear in the sanitized capture`);
  }
  if (privateSequencingUrlPattern.test(text)) {
    addProblem(`${path}: private Sequencing.com result/account URLs cannot appear in the sanitized capture`);
  }
});

const safeResourceKeys = new Set([
  "id",
  "title",
  "sourceType",
  "url",
  "privacy",
  "evidenceLevel",
  "extractionStatus",
  "scope",
  "usedFor",
  "note",
  "theme",
]);
const sourceResources = asArray(input.sourceResources).map((resource, index) => {
  const sanitized = {};
  if (!isPlainObject(resource)) {
    addProblem(`sourceResources[${index}] must be an object`);
    return sanitized;
  }
  for (const [key, value] of Object.entries(resource)) {
    if (safeResourceKeys.has(key)) {
      sanitized[key] = value;
    }
  }
  if (!isNonEmptyString(sanitized.id)) {
    addProblem(`sourceResources[${index}].id is required`);
  }
  if (!isNonEmptyString(sanitized.title)) {
    addProblem(`sourceResources[${index}].title is required`);
  }
  if (!isNonEmptyString(sanitized.url)) {
    sanitized.url = input.captureUrl;
  }
  return sanitized;
});
if (sourceResources.length === 0) {
  addProblem("sourceResources must include at least one sanitized source resource");
}

const sourceResourceIds = new Set(sourceResources.map((resource) => resource.id).filter(isNonEmptyString));
const rowSourceIds = (row) => asArray(row?.sourceResourceIds ?? row?.sourceIds ?? row?.sourceArtifactIds);
for (const [index, row] of asArray(input.sampleRows).entries()) {
  if (!isPlainObject(row)) {
    addProblem(`sampleRows[${index}] must be an object`);
    continue;
  }
  for (const sourceId of rowSourceIds(row)) {
    if (!sourceResourceIds.has(sourceId)) {
      addProblem(`sampleRows[${index}] cites source id ${sourceId} that is not listed in sourceResources`);
    }
  }
}
for (const [index, binding] of asArray(input.citationBindings).entries()) {
  if (!isPlainObject(binding)) {
    addProblem(`citationBindings[${index}] must be an object`);
    continue;
  }
  for (const sourceId of rowSourceIds(binding)) {
    if (!sourceResourceIds.has(sourceId)) {
      addProblem(`citationBindings[${index}] cites source id ${sourceId} that is not listed in sourceResources`);
    }
  }
}

const sanitizedCapture = {
  schema: officialOutputCaptureSchema,
  slug,
  title: input.title,
  capturedAt: input.capturedAt,
  captureUrl: input.captureUrl,
  sourceKind: input.sourceKind ?? "private-completed-output-redacted",
  privacyBoundary: {
    rawGenomeIncluded: false,
    privateValuesRedacted: true,
    commitSafe: true,
    notes:
      "Generated from a private local completed-output redaction input. Full private output stayed outside the repository.",
  },
  reportFile: isNonEmptyString(input.reportFile) ? input.reportFile : "",
  sourceArtifacts: [input.captureUrl],
  sourceResources,
  sampleRows: asArray(input.sampleRows),
  resultRows: asArray(input.resultRows),
  formalFields: asArray(input.formalFields),
  citationBindings: asArray(input.citationBindings),
  generatedOutput: input.generatedOutputSummary ?? {
    valueRedaction: "private completed-output values redacted before repository export",
    privateResultUrlCommitted: false,
  },
  validationCommands: [
    `npm run scaffold:validate-captures -- --path ${outPath}`,
    `npm run scaffold:promotion-preview -- --path ${outPath}`,
    "npm run scaffold:evidence-audit",
    "npm run readiness:audit:summary",
    "npm run agent:validate:formal",
  ],
  promotionBoundary: {
    targetStartsAsScaffoldOnly: true,
    requiredEvidenceForPromotion:
      input.promotionBoundary?.requiredEvidenceForPromotion ?? blockerDecision?.requiredEvidenceForPromotion ?? [],
    nonPromotionBoundary: blockerLedger.promotionStandard ?? [],
  },
  reviewContext: isPlainObject(input.promotionReadinessReview)
    ? {
        stage: input.promotionReadinessReview.stage ?? null,
        actionClass: input.promotionReadinessReview.actionClass ?? null,
        reviewedEvidencePresent: asArray(input.promotionReadinessReview.reviewedEvidencePresent),
        reviewedEvidenceMissing: asArray(input.promotionReadinessReview.reviewedEvidenceMissing),
        nextEvidenceNeeded: asArray(input.promotionReadinessReview.nextEvidenceNeeded),
        currentOutputSignals: isPlainObject(input.promotionReadinessReview.currentOutputSignals)
          ? input.promotionReadinessReview.currentOutputSignals
          : {},
        formalGateMissing: asArray(input.promotionReadinessReview.formalGateMissing),
        rowEvidenceReadyRequires: asArray(input.promotionReadinessReview.rowEvidenceReadyRequires),
      }
    : undefined,
};

const validation = validateOfficialOutputCaptureArtifact(sanitizedCapture, {
  path: outPath,
  expectedSlug: slug,
});
if (!validation.ok) {
  for (const problem of validation.problems) {
    addProblem(`${problem.path}: ${problem.message}`);
  }
}
if (!allowBoundaryOnly && !validation.rowEvidenceReady) {
  addProblem(
    "sanitized capture is not row-evidence-ready; sampleRows, formalFields, and citationBindings must cite official-output source resources with ready binding status; pass --allow-boundary-only true only for boundary captures",
  );
}

if (problems.length > 0) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        dryRun,
        wroteFile: false,
        inputPath,
        outPath,
        validation,
        problems,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

if (!dryRun) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(sanitizedCapture, null, 2)}\n`);
}

const writeCommand = `npm run scaffold:sanitize-output -- --input ${inputPath} --out ${outPath}${
  outPath.startsWith("reference/catalog/") ? " --confirm-commit-safe true" : ""
}`;
const committedWriteCommand = `npm run scaffold:sanitize-output -- --input ${inputPath} --out ${committedOutPath} --confirm-commit-safe true`;
const draftNextCommands = [
  dryRun ? writeCommand : null,
  `npm run scaffold:validate-captures -- --path ${outPath}`,
  validation.rowEvidenceReady
    ? `npm run scaffold:promotion-preview -- --path ${outPath}`
    : "# Promotion preview stays hidden until validate-captures reports rowEvidenceReady: true.",
  outPath.startsWith("reference/catalog/")
    ? "npm run scaffold:capture-status:snapshot"
    : committedWriteCommand,
  outPath.startsWith("reference/catalog/")
    ? null
    : `npm run scaffold:validate-captures -- --path ${committedOutPath}`,
  outPath.startsWith("reference/catalog/") || !validation.rowEvidenceReady
    ? null
    : `npm run scaffold:promotion-preview -- --path ${committedOutPath}`,
].filter(Boolean);

console.log(
  JSON.stringify(
    {
      ok: true,
      dryRun,
      wroteFile: !dryRun,
      inputPath,
      outPath,
      sanitizedPreview: dryRun ? sanitizedCapture : undefined,
      validation: {
        ok: validation.ok,
        rowEvidenceReady: validation.rowEvidenceReady,
        promotionSafeProvenance: validation.promotionSafeProvenance,
        outputSignalReview: validation.outputSignalReview,
        promotionCandidate: validation.promotionCandidate,
        outputSignals: validation.outputSignals,
      },
      nextCommands: draftNextCommands,
    },
    null,
    2,
  ),
);
