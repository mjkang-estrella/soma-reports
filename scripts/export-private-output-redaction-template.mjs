#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const schemaVersion = "soma-reports.private-output-redaction.v1";
const blockerLedgerPath = "reference/catalog/sample-promotion-rejections-2026-06-23.json";
const officialOutputCaptureStatusPath = "reference/catalog/official-output-capture-status.json";
const captureTemplateDirectory = "tmp/capture-templates";
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

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const publicSequencingUrlPattern =
  /^https:\/\/(?:www\.)?sequencing\.com\/(?:marketplace|knowledge-center|education-center|order|apps\/app-market)\b/i;
const safePublicSequencingUrl = (value) =>
  typeof value === "string" && publicSequencingUrlPattern.test(value) ? value : null;
const args = parseArgs();
let reportSlug = args.get("--report") ?? args.get("--slug");
const selectNext = args.get("--next") === "true";
const targetClass = args.get("--class") ?? "all";
const overwrite = args.get("--overwrite") === "true" || args.get("--force") === "true";

if (!["all", "missing-exact-detail", "metadata-only"].includes(targetClass)) {
  throw new Error(`Unsupported --class ${targetClass}; expected all, missing-exact-detail, or metadata-only`);
}

const blockerLedger = readJson(blockerLedgerPath);
const officialOutputCaptureStatus = existsSync(officialOutputCaptureStatusPath)
  ? readJson(officialOutputCaptureStatusPath)
  : null;
if (!reportSlug && selectNext) {
  const nextTarget = (officialOutputCaptureStatus?.rows ?? []).find(
    (row) =>
      (targetClass === "all" || row.evidenceClass === targetClass) &&
      row.stage !== "row-evidence-ready" &&
      (row.rowEvidenceReadyCaptures ?? 0) === 0,
  );
  reportSlug = nextTarget?.slug;
}

if (!reportSlug) {
  throw new Error(
    "Usage: npm run scaffold:redaction-template -- --report <slug> [--out .soma/private/official-output-redactions/<slug>-redaction-input.json]\n" +
      "   or: npm run scaffold:redaction-next -- [--class all|missing-exact-detail|metadata-only]",
  );
}

const authenticatedBlockerDetailInspection = existsSync(authenticatedBlockerDetailInspectionPath)
  ? readJson(authenticatedBlockerDetailInspectionPath)
  : null;
const authenticatedBlockerDetailInspectionBySlug = new Map(
  (authenticatedBlockerDetailInspection?.targets ?? []).map((target) => [target.slug, target]),
);
const decision = (blockerLedger.decisions ?? []).find((candidate) => candidate.slug === reportSlug);
if (!decision) {
  throw new Error(`No scaffold formal-evidence target found for report slug: ${reportSlug}`);
}
const officialOutputStatusRow = (officialOutputCaptureStatus?.rows ?? []).find((row) => row.slug === reportSlug) ?? null;

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

const captureTemplatePath = `${captureTemplateDirectory}/${reportSlug}-official-output-capture-template.json`;
const captureTemplate = existsSync(captureTemplatePath) ? readJson(captureTemplatePath) : null;
const captureUrl =
  decision.sources?.find((source) => /^https?:\/\//i.test(source)) ?? `https://sequencing.com/marketplace/${reportSlug}`;
const defaultOutPath = `.soma/private/official-output-redactions/${reportSlug}-redaction-input.json`;
const outPath = args.get("--out") ?? defaultOutPath;
const localDateStamp = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = localDateStamp();
const sanitizedDraftPath = `tmp/sanitized-captures/${reportSlug}-official-output-capture-${today}.json`;
const committedCapturePath = `reference/catalog/${reportSlug}-official-output-capture-${today}.json`;
const liveDetailInspection = liveDetailInspectionFor(reportSlug);
const outputStaysOutsideSource = outPath.startsWith(".soma/") || outPath.startsWith("tmp/");

if (existsSync(outPath) && !overwrite) {
  throw new Error(`${outPath} already exists; pass -- --overwrite true to replace it`);
}

const sourceResourceId = `${reportSlug}-redacted-official-output`;
const starterSampleRows =
  Array.isArray(captureTemplate?.sampleRows) && captureTemplate.sampleRows.length > 0
    ? captureTemplate.sampleRows.map((row, index) => ({
        ...row,
        rowId: row.rowId?.startsWith("replace-") ? `${reportSlug}-official-row-${index + 1}` : row.rowId,
        sourceResourceIds: [sourceResourceId],
        sourceBindingStatus: "exact",
      }))
    : [
        {
          rowId: `${reportSlug}-official-row-1`,
          section: "replace-with-official-section-label",
          item: "replace-with-official-row-label",
          geneticAnalysis: "replace-with-redacted-or-non-private-official-row-value",
          observedField: "replace-with-official-output-field",
          sourceResourceIds: [sourceResourceId],
          sourceBindingStatus: "exact",
          sourceBindingNote: "Bound to a local private completed-output file after manual redaction.",
        },
      ];

const starterFormalFields =
  Array.isArray(captureTemplate?.formalFields) && captureTemplate.formalFields.length > 0
    ? captureTemplate.formalFields.map((field) => ({
        ...field,
        sourceResourceIds: [sourceResourceId],
        sourceBindingStatus: "exact",
        sourceLabel: sourceResourceId,
      }))
    : [
        {
          key: "replace_with_field_key",
          label: "replace-with-field-label",
          observedField: "replace-with-observed-field",
          outputPath: "replace-with-output-path",
          status: "covered",
          sourceResourceIds: [sourceResourceId],
          sourceBindingStatus: "exact",
          sourceLabel: sourceResourceId,
        },
      ];

const starterResultRows = [
  {
    rowId: `${reportSlug}-official-result-row-1`,
    section: starterSampleRows[0]?.section ?? "replace-with-official-section-label",
    item: starterSampleRows[0]?.item ?? "replace-with-official-row-label",
    values: Object.fromEntries(
      starterFormalFields.map((field) => [
        field.key,
        `replace-with-redacted-official-value-for-${field.key}`,
      ]),
    ),
    sourceResourceIds: [sourceResourceId],
    sourceBindingStatus: "exact",
    sourceBindingNote:
      "Populate from one real official completed-output row/export after removing private values. Keep the matching sampleRows[] entry source-bound so rowEvidenceReady can be evaluated.",
  },
];

const redactionChecklist = [
  "Replace every placeholder before running the sanitizer.",
  "Copy only non-private official output structure and row labels from a completed Sequencing.com output.",
  "Do not copy private genotypes, variant values, names, account identifiers, dates, private result URLs, or raw genome records.",
  `Every sampleRows[], formalFields[], and citationBindings[] entry that should count toward rowEvidenceReady must cite ${sourceResourceId}.`,
  "Use sourceBindingStatus exact, direct, or official only when the row is directly visible in the redacted official output.",
  "Leave uncertain or missing output fields out of the promotion path instead of inferring them from product copy.",
];

const promotionReadinessReview = {
  stage: officialOutputStatusRow?.stage ?? null,
  actionClass: officialOutputStatusRow?.nextAction ?? null,
  reviewedEvidencePresent: officialOutputStatusRow?.officialOutputReviewEvidencePresent ?? [],
  reviewedEvidenceMissing:
    officialOutputStatusRow?.officialOutputReviewEvidenceMissing ??
    decision.requiredEvidenceForPromotion ??
    [],
  nextEvidenceNeeded:
    officialOutputStatusRow?.officialOutputReviewNextEvidenceNeeded ??
    decision.requiredEvidenceForPromotion ??
    [],
  currentOutputSignals:
    officialOutputStatusRow?.formalReadinessGate?.currentOutputSignals ??
    officialOutputStatusRow?.officialOutputReviewOutputSignals ??
    {},
  formalGateMissing: officialOutputStatusRow?.formalReadinessGate?.missing ?? [],
  rowEvidenceReadyRequires: [
    "official non-private sampleRows[] or resultRows[] from the exact package",
    "covered formalFields[] bound to the official-output source resource",
    "citationBindings[] with exact/direct/official sourceBindingStatus and sourceResourceIds",
  ],
};

const redactionTemplate = {
  schemaVersion,
  slug: reportSlug,
  title: decision.title,
  capturedAt: "replace-with-ISO-capture-timestamp",
  captureUrl,
  sourceKind: "private-completed-output-redacted",
  privateSource: {
    localPath: "replace-with-local-private-completed-output-path",
    inputKind: "replace-with-pdf-html-json-text-or-screenshot",
    keepOutsideRepository: true,
    rawGenomeIncluded: false,
    privateValuesNeedManualRedaction: true,
    notes:
      "Keep the full completed report and any raw genome files in .soma/private/, private/, or another ignored location. This file is ignored by git and is an input to the sanitizer only.",
  },
  privacyReview: {
    rawGenomeIncluded: false,
    privateValuesRedacted: true,
    commitSafeAfterSanitizer: true,
    privateFindingValuesCommitted: false,
    reviewerNote:
      "Before running the sanitizer, replace every placeholder and remove personal genotypes, variant values, private result URLs, names, account IDs, emails, and dates that identify the user.",
  },
  sourceResources: [
    {
      id: sourceResourceId,
      title: `${decision.title} redacted official completed output`,
      sourceType: "redacted_official_completed_output",
      url: captureUrl,
      privacy: "Private completed output stayed local; committed artifact contains only redacted structure and source bindings.",
      evidenceLevel: "official-output",
      extractionStatus: "direct",
      scope: "report_specific",
      usedFor: ["sampleRows", "formalFields", "citationBindings"],
    },
    ...(liveDetailInspection
      ? [
          {
            id: `${reportSlug}-authenticated-live-detail`,
            title: `${decision.title} authenticated marketplace detail metadata`,
            sourceType: "authenticated_marketplace_detail_metadata",
            url: liveDetailInspection.finalUrl ?? liveDetailInspection.requestedUrl ?? captureUrl,
            privacy: liveDetailInspection.privacyBoundary,
            evidenceLevel: "metadata-only",
            extractionStatus: liveDetailInspection.exactRoute ? "exact-route" : "fallback-route",
            scope: "report_specific",
            usedFor: ["currentEvidence.liveDetailInspection"],
          },
        ]
      : []),
  ],
  sampleRows: starterSampleRows,
  resultRows: starterResultRows,
  formalFields: starterFormalFields,
  citationBindings: starterSampleRows.map((row) => ({
    rowId: row.rowId,
    sourceResourceIds: [sourceResourceId],
    sourceBindingStatus: "exact",
  })),
  redactionChecklist,
  promotionReadinessReview,
  generatedOutputSummary: {
    valueRedaction: "private completed-output values manually redacted before repository export",
    privateResultUrlCommitted: false,
    sections: [],
  },
  validationCommands: [
    `npm run scaffold:sanitize-output -- --input ${outPath} --out ${sanitizedDraftPath} --dry-run true`,
    `npm run scaffold:sanitize-output -- --input ${outPath} --out ${sanitizedDraftPath}`,
    `npm run scaffold:validate-captures -- --path ${sanitizedDraftPath}`,
    `npm run scaffold:promotion-preview -- --path ${sanitizedDraftPath}`,
    `npm run scaffold:sanitize-output -- --input ${outPath} --out ${committedCapturePath} --confirm-commit-safe true`,
    `npm run scaffold:validate-captures -- --path ${committedCapturePath}`,
    `npm run scaffold:promotion-preview -- --path ${committedCapturePath}`,
  ],
  promotionBoundary: {
    targetStartsAsScaffoldOnly: true,
    requiredEvidenceForPromotion: decision.requiredEvidenceForPromotion ?? [],
    nonPromotionBoundary: blockerLedger.promotionStandard ?? [],
  },
  currentEvidence: {
    evidenceStatus: decision.evidenceStatus,
    routeBehavior: decision.routeBehavior,
    reportFileStatus: decision.reportFileStatus,
    currentSources: decision.sources ?? [],
    captureTemplatePath: existsSync(captureTemplatePath) ? captureTemplatePath : null,
    liveDetailInspection,
    liveDetailInspectionSourcePath: liveDetailInspection ? authenticatedBlockerDetailInspectionPath : null,
  },
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(redactionTemplate, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      ok: true,
      schemaVersion,
      reportSlug,
      selectedBy: selectNext ? `next-${targetClass}-official-output-blocker` : "explicit-report",
      path: outPath,
      gitIgnored: outputStaysOutsideSource,
      starterRows: {
        sampleRows: starterSampleRows.length,
        resultRows: starterResultRows.length,
        formalFields: starterFormalFields.length,
      },
      nextCommand: `npm run scaffold:sanitize-output -- --input ${outPath} --out ${sanitizedDraftPath} --dry-run true`,
      nextCommands: redactionTemplate.validationCommands,
      note:
        "Fill this redaction input from a local completed output. Keep the full report, raw genome data, and private values outside reference/catalog.",
    },
    null,
    2,
  ),
);
