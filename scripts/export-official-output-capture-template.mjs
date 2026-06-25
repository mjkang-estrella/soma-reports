#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { officialOutputCaptureSchema } from "./lib/official-output-capture-validator.mjs";

const ledgerPath = "reference/catalog/sample-promotion-rejections-2026-06-23.json";
const detailArtifactDirectory = "reference/catalog";
const authenticatedBlockerDetailInspectionPath =
  "reference/catalog/authenticated-blocker-detail-inspection-2026-06-24.json";

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
const reportSlug = args.get("--report") ?? args.get("--slug");
const outPath = args.get("--out") ?? null;
const listOnly = args.get("--list") === "true";

const compactText = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
const isCommitSafeContextSource = (value) =>
  typeof value === "string" &&
  !/fixtures\/synthetic\//i.test(value) &&
  !/\/Users\/[^/\s]+\/Documents\/Genome\/Raw/i.test(value) &&
  !/\.soma\/private/i.test(value);
const fieldKey = (label, index) => {
  const key = label.replace(/\W+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
  return key || `field_${index + 1}`;
};

const formalFieldTextPattern =
  /\b(each row|columns? such as|columns? include|fields? include|search by|provides information on a position|graph and table|average, maximum, and minimum depth|depth for your entire genome|broken down by each chromosome|truly sequenced at 30x)\b/i;
const formalFieldListPatterns = [
  /\bcolumns? (?:such as|include|including)\s+([^.;]+)/gi,
  /\bfields? (?:such as|include|including)\s+([^.;]+)/gi,
  /\bsearch by\s+([^.;]+)/gi,
];

const extractFormalFieldTerms = (text) => {
  const terms = [];
  for (const pattern of formalFieldListPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fragment = match[1].split(/\b(?:when|if|where)\b/i)[0];
      for (const term of fragment.replace(/\s+and\s+/gi, ", ").split(",")) {
        const cleaned = term.trim().replace(/^(?:and|or)\s+/i, "");
        if (cleaned.length > 0 && cleaned.length <= 48) {
          terms.push(cleaned);
        }
      }
    }
  }
  if (
    /\b(depth|coverage)\b/i.test(text) &&
    /\b(graph|table|average|maximum|minimum|chromosome|30x)\b/i.test(text)
  ) {
    terms.push("scope", "chromosome", "averageDepth", "maximumDepth", "minimumDepth", "thirtyXDepthCheck");
  }
  return [...new Set(terms)];
};

const fieldLabelAliases = new Map([
  ["reference", "ref"],
  ["alternate allele", "alt"],
  ["user data", "your data"],
  ["status", "your status"],
]);

const normalizedFieldLabel = (label) => {
  const normalized = label.replace(/\W+/g, " ").trim().toLowerCase();
  return fieldLabelAliases.get(normalized) ?? normalized;
};

const uniqueFieldLabels = (labels) => {
  const seen = new Set();
  const unique = [];
  for (const label of labels) {
    const compact = compactText(label);
    if (!compact) {
      continue;
    }
    const key = normalizedFieldLabel(compact);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(compact);
  }
  return unique;
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const publicSequencingUrlPattern =
  /^https:\/\/(?:www\.)?sequencing\.com\/(?:marketplace|knowledge-center|education-center|order|apps\/app-market)\b/i;
const safePublicSequencingUrl = (value) =>
  typeof value === "string" && publicSequencingUrlPattern.test(value) ? value : null;
const ledger = readJson(ledgerPath);
const authenticatedBlockerDetailInspection = existsSync(authenticatedBlockerDetailInspectionPath)
  ? readJson(authenticatedBlockerDetailInspectionPath)
  : null;
const authenticatedBlockerDetailInspectionBySlug = new Map(
  (authenticatedBlockerDetailInspection?.targets ?? []).map((target) => [target.slug, target]),
);
const decisions = Array.isArray(ledger.decisions) ? ledger.decisions : [];

const liveDetailInspectionFor = (slug) => {
  const target = authenticatedBlockerDetailInspectionBySlug.get(slug);
  if (!target) {
    return null;
  }

  return {
    slug: target.slug,
    inspectedAt: target.inspectedAt ?? null,
    requestedUrl: safePublicSequencingUrl(target.requestedUrl),
    finalUrl: safePublicSequencingUrl(target.finalUrl),
    exactRoute: Boolean(target.exactRoute),
    routeKind: target.routeKind ?? null,
    pageTitle: target.pageTitle ?? null,
    startButtonText: target.startButtonText ?? "",
    apiAppId: target.apiAppId ?? null,
    appBackend: target.appBackend ?? null,
    appLabel: target.appLabel ?? null,
    productId: target.productId ?? null,
    price: target.price ?? "",
    reportFile: safePublicSequencingUrl(target.reportFile),
    scriptSignals: {
      generated: target.scriptSignals?.generated ?? 0,
      mock: target.scriptSignals?.mock ?? 0,
      output: target.scriptSignals?.output ?? 0,
      preview: target.scriptSignals?.preview ?? 0,
      reportFile: target.scriptSignals?.reportFile ?? 0,
      result: target.scriptSignals?.result ?? 0,
      sample: target.scriptSignals?.sample ?? 0,
    },
    privacyBoundary: target.privacyBoundary ?? authenticatedBlockerDetailInspection?.privacyBoundary ?? "",
  };
};

if (listOnly) {
  console.log(
    JSON.stringify(
      {
        schemaVersion: "soma-reports.official-output-capture-template-index.v1",
        ledgerPath,
        count: decisions.length,
        slugs: decisions.map((decision) => decision.slug).sort(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (!reportSlug) {
  throw new Error("Usage: npm run scaffold:capture-template -- --report <slug> [--out tmp/capture-templates/<slug>.json]");
}

const decision = decisions.find((candidate) => candidate.slug === reportSlug);
if (!decision) {
  throw new Error(`No scaffold formal-evidence target found for report slug: ${reportSlug}`);
}

const catalogFiles = readdirSync(detailArtifactDirectory);
const currentDetailArtifacts = catalogFiles
  .filter(
    (file) =>
      (file.startsWith(`${reportSlug}-authenticated-detail-`) ||
        file.startsWith(`${reportSlug}-official-output-capture-`)) &&
      file.endsWith(".json"),
  )
  .map((file) => `${detailArtifactDirectory}/${file}`)
  .sort();

const fieldDefinitionLabelsFor = (artifact) =>
  Array.isArray(artifact.fieldDefinitions)
    ? artifact.fieldDefinitions.map((field) => compactText(field?.label)).filter(Boolean)
    : [];

const describedFieldSignalsFor = (artifact) => {
  const textFields = [
    artifact.bodyPreview,
    artifact.summaryPreview,
    ...(Array.isArray(artifact.visibleParagraphs) ? artifact.visibleParagraphs : []),
    ...(Array.isArray(artifact.evidenceNotes) ? artifact.evidenceNotes : []),
  ];
  const textSignals = textFields.flatMap((text) => {
    const compact = compactText(text);
    if (!compact || !formalFieldTextPattern.test(compact)) {
      return [];
    }
    return extractFormalFieldTerms(compact);
  });
  return {
    fieldDefinitionLabels: fieldDefinitionLabelsFor(artifact),
    textSignals,
  };
};

const describedFieldSignalGroups = currentDetailArtifacts.map((artifactPath) =>
  describedFieldSignalsFor(readJson(artifactPath)),
);
const describedOutputFields = uniqueFieldLabels([
  ...describedFieldSignalGroups.flatMap((group) => group.fieldDefinitionLabels),
  ...describedFieldSignalGroups.flatMap((group) => group.textSignals),
]);
const captureUrl =
  decision.sources?.find((source) => /^https?:\/\//i.test(source)) ?? `https://sequencing.com/marketplace/${reportSlug}`;
const reviewedSources = (decision.sources ?? []).filter(isCommitSafeContextSource);
const omittedReviewedSourceCount = (decision.sources ?? []).length - reviewedSources.length;
const expectedRepositoryPath = `reference/catalog/${reportSlug}-official-output-capture-YYYY-MM-DD.json`;
const validationCommand = `npm run scaffold:validate-captures -- --path ${expectedRepositoryPath}`;
const promotionPreviewCommand = `npm run scaffold:promotion-preview -- --path ${expectedRepositoryPath}`;
const sampleObservedField = describedOutputFields[0] ?? "replace-with-official-output-field";
const liveDetailInspection = liveDetailInspectionFor(reportSlug);
const officialOutputSourceResourceId = `${reportSlug}-official-output-source`;
const sourceBindingStatusPlaceholder = "replace-with-exact-direct-or-official";
const sourceBindingConfirmationNotePlaceholder = "replace-with-visible-row-or-export-binding-note";

const template = {
  schema: officialOutputCaptureSchema,
  slug: reportSlug,
  title: decision.title,
  capturedAt: "replace-with-ISO-capture-timestamp",
  captureUrl,
  sourceKind: "replace-with-official-sample-report-or-completed-output",
  privacyBoundary: {
    rawGenomeIncluded: false,
    publicSourceOnly: true,
    privateValuesRedacted: false,
    commitSafe: true,
    notes:
      "Use this template for public/non-private official samples, report files, exports, or already sanitized completed-output structure. For personal completed runs, keep the full output outside this repository and use scaffold:sanitize-output so privateValuesRedacted is true.",
  },
  reportFile: "",
  sourceArtifacts: [captureUrl],
  sourceResources: [
    {
      id: officialOutputSourceResourceId,
      title: `${decision.title} official output source`,
      sourceType: "official_output",
      url: captureUrl,
      privacy:
        "Use a public/non-private official sample, reportFile, export, or sanitized completed-output artifact. Keep private completed reports outside this repository.",
      evidenceLevel: "official-output",
      extractionStatus: "replace-with-direct-public-or-sanitized-official-output",
      scope: "report_specific",
      usedFor: ["sampleRows", "resultRows", "formalFields", "citationBindings"],
    },
  ],
  sampleRows: [
    {
      rowId: "replace-with-official-row-id",
      section: "replace-with-official-section",
      item: "replace-with-official-row-label",
      observedField: sampleObservedField,
      sourceResourceIds: [officialOutputSourceResourceId],
      sourceBindingStatus: sourceBindingStatusPlaceholder,
      sourceBindingConfirmed: false,
      sourceBindingConfirmationNote: sourceBindingConfirmationNotePlaceholder,
    },
  ],
  resultRows: [
    {
      rowId: "replace-with-official-result-row-id",
      section: "replace-with-official-result-section",
      item: "replace-with-official-result-label",
      values: {
        [fieldKey(sampleObservedField, 0)]: "replace-with-official-output-value-or-redacted-structure",
      },
      sourceResourceIds: [officialOutputSourceResourceId],
      sourceBindingStatus: sourceBindingStatusPlaceholder,
      sourceBindingConfirmed: false,
      sourceBindingConfirmationNote: sourceBindingConfirmationNotePlaceholder,
    },
  ],
  formalFields:
    describedOutputFields.length > 0
      ? describedOutputFields.map((field, index) => ({
          key: fieldKey(field, index),
          label: field,
          observedField: field,
          outputPath: `replace-with-output-path-${index + 1}`,
          status: "covered",
          sourceResourceIds: [officialOutputSourceResourceId],
          sourceLabel: officialOutputSourceResourceId,
          sourceBindingStatus: sourceBindingStatusPlaceholder,
          sourceBindingConfirmed: false,
          sourceBindingConfirmationNote: sourceBindingConfirmationNotePlaceholder,
        }))
      : [
          {
            key: "replace_with_field_key",
            label: "replace-with-field-label",
            observedField: "replace-with-observed-field",
            outputPath: "replace-with-output-path",
            status: "covered",
            sourceResourceIds: [officialOutputSourceResourceId],
            sourceLabel: officialOutputSourceResourceId,
            sourceBindingStatus: sourceBindingStatusPlaceholder,
            sourceBindingConfirmed: false,
            sourceBindingConfirmationNote: sourceBindingConfirmationNotePlaceholder,
          },
        ],
  citationBindings: [
    {
      rowId: "replace-with-official-row-id",
      sourceResourceIds: [officialOutputSourceResourceId],
      sourceBindingStatus: sourceBindingStatusPlaceholder,
      sourceBindingConfirmed: false,
      sourceBindingConfirmationNote: sourceBindingConfirmationNotePlaceholder,
    },
    {
      rowId: "replace-with-official-result-row-id",
      sourceResourceIds: [officialOutputSourceResourceId],
      sourceBindingStatus: sourceBindingStatusPlaceholder,
      sourceBindingConfirmed: false,
      sourceBindingConfirmationNote: sourceBindingConfirmationNotePlaceholder,
    },
  ],
  validationCommands: [
    validationCommand,
    promotionPreviewCommand,
    "npm run scaffold:evidence-audit",
    "npm run readiness:audit:summary",
    "npm run agent:validate:formal",
  ],
  promotionBoundary: {
    targetStartsAsScaffoldOnly: true,
    requiredEvidenceForPromotion: decision.requiredEvidenceForPromotion ?? [],
    nonPromotionBoundary: ledger.promotionStandard ?? [],
  },
  currentEvidence: {
    evidenceStatus: decision.evidenceStatus,
    routeBehavior: decision.routeBehavior,
    reportFileStatus: decision.reportFileStatus,
    sampleRows: decision.sampleRows,
    reviewedSources,
    omittedReviewedSourceCount,
    omittedReviewedSourceNote:
      omittedReviewedSourceCount > 0
        ? "Synthetic fixture or private/local source paths were intentionally omitted from this official-output template."
        : null,
    currentDetailArtifacts,
    describedOutputFields,
    liveDetailInspection,
    liveDetailInspectionSourcePath: liveDetailInspection ? authenticatedBlockerDetailInspectionPath : null,
  },
};

const output = `${JSON.stringify(template, null, 2)}\n`;
if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
  console.log(
    JSON.stringify(
      {
        ok: true,
        reportSlug,
        path: outPath,
        expectedRepositoryPath,
        validationCommand: `npm run scaffold:validate-captures -- --path ${outPath}`,
        note: "Template placeholders intentionally fail validation until official output rows and source bindings are filled.",
      },
      null,
      2,
    ),
  );
} else {
  process.stdout.write(output);
}
