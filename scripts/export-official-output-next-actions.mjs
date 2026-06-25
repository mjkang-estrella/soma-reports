#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const defaultStatusPath = "reference/catalog/official-output-capture-status.json";
const defaultLedgerPath = "reference/catalog/sample-promotion-rejections-2026-06-23.json";

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
const statusPath = args.get("--status") ?? defaultStatusPath;
const ledgerPath = args.get("--ledger") ?? defaultLedgerPath;
const format = args.get("--format") ?? "json";
const outPath = args.get("--out") ?? null;
const stageFilter = args.get("--stage") ?? "all";
const limit = args.has("--limit") ? Number(args.get("--limit")) : null;

if (!["json", "md", "compact"].includes(format)) {
  throw new Error(`Unsupported --format ${format}; expected json, md, or compact`);
}

if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
  throw new Error(`Unsupported --limit ${args.get("--limit")}; expected a positive integer`);
}

const asArray = (value) => (Array.isArray(value) ? value : []);
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const status = readJson(statusPath);
const ledger = readJson(ledgerPath);
const rows = asArray(status.rows);
const ledgerDecisions = asArray(ledger.decisions);
const ledgerSlugs = new Set(ledgerDecisions.map((decision) => decision.slug).filter(Boolean));
const statusSlugs = new Set(rows.map((row) => row.slug).filter(Boolean));
const missingStatusRows = [...ledgerSlugs].filter((slug) => !statusSlugs.has(slug)).sort();
const extraStatusRows = [...statusSlugs].filter((slug) => !ledgerSlugs.has(slug)).sort();
const statusCoverageOk = missingStatusRows.length === 0 && extraStatusRows.length === 0;
const publicCaptureTemplatePathFor = (slug) => `tmp/capture-templates/${slug}-official-output-capture-template.json`;
const publicCaptureTemplateCommandFor = (slug, path = publicCaptureTemplatePathFor(slug)) =>
  `npm run scaffold:capture-template -- --report ${slug} --out ${path}`;
const publicTemplateAuditCommandFor = (slug) => `npm run scaffold:template-audit -- --report ${slug}`;
const publicCaptureSessionCommandFor = (slug) =>
  `npm run scaffold:capture-session -- --source public --report ${slug} --format md --out tmp/official-output-capture-session-${slug}.md`;
const uniqueStrings = (values) => [
  ...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0)),
];
const readinessBoundary =
  "Planning-only summary; promotion readiness still requires official non-private rows, covered formalFields, source-backed citationBindings, and rowEvidenceReady validation.";
const nonPromotionalEvidenceClasses = [
  "synthetic fixtures",
  "local deterministic results",
  "metadata-only detail captures",
  "order-route boundary evidence",
  "public education/background pages",
];
const requiredEvidenceForPromotionFor = (row) =>
  uniqueStrings([
    ...asArray(row.requiredEvidenceForPromotion),
    ...asArray(row.formalReadinessGate?.requiredEvidenceForPromotion),
  ]);
const publicBundleEvidenceMissingForPromotionFor = (row) =>
  uniqueStrings([
    ...asArray(row.publicBundleEvidenceMissingForPromotion),
    ...asArray(row.publicBundleEvidence?.evidenceMissingForPromotion),
  ]);
const nextEvidenceNeededFor = (row) =>
  uniqueStrings(
    row.officialOutputReviewNextEvidenceNeeded?.length
      ? row.officialOutputReviewNextEvidenceNeeded
      : (row.formalReadinessGate?.requiredEvidenceForPromotion ?? []),
  );
const packageSpecificMissingEvidenceFor = (row, nextEvidenceNeeded = nextEvidenceNeededFor(row)) =>
  uniqueStrings([
    ...asArray(row.packageSpecificMissingEvidence),
    ...requiredEvidenceForPromotionFor(row),
    ...publicBundleEvidenceMissingForPromotionFor(row),
    ...asArray(row.officialOutputReviewEvidenceMissing),
    ...asArray(row.reviewedEvidenceMissing),
    ...nextEvidenceNeeded,
  ]);
const operatorEvidenceChecklistFor = (
  row,
  currentOutputSignals,
  missingFormalGateEvidence,
  packageSpecificMissingEvidence,
) => {
  const signals = currentOutputSignals ?? {};
  const rowEvidenceReadyCapturePresent = Boolean(
    (row.rowEvidencePromotionReadyCaptures ?? 0) > 0 ||
      (row.rowEvidenceReadyCaptures ?? 0) > 0 ||
      asArray(row.rowEvidenceReadyCapturePaths).length > 0,
  );
  const checklist = row.operatorEvidenceChecklist ?? {};
  const requiredEvidenceForPromotion = uniqueStrings([
    ...asArray(checklist.requiredEvidenceForPromotion),
    ...requiredEvidenceForPromotionFor(row),
  ]);
  const missingOfficialRowEvidence = uniqueStrings([
    ...asArray(checklist.missingOfficialRowEvidence),
    ...asArray(missingFormalGateEvidence),
    ...asArray(packageSpecificMissingEvidence),
  ]);
  return {
    promotionalOfficialRowsPresent:
      checklist.promotionalOfficialRowsPresent ?? Boolean(signals.reportFile || signals.sampleRows > 0 || signals.resultRows > 0),
    coveredFormalFieldsPresent: checklist.coveredFormalFieldsPresent ?? Boolean(signals.formalFields > 0),
    citationBindingsPresent: checklist.citationBindingsPresent ?? Boolean(signals.citationBindings > 0),
    rowEvidenceReadyCapturePresent,
    requiredEvidenceForPromotion,
    missingOfficialRowEvidence,
    publicFirstNextAction: checklist.publicFirstNextAction ?? row.nextPublicQueueAction ?? null,
    publicFirstNextCommand: checklist.publicFirstNextCommand ?? row.nextPublicCommand ?? row.publicCaptureSessionCommand ?? null,
    nonPromotionalEvidenceClasses: uniqueStrings([
      ...asArray(checklist.nonPromotionalEvidenceClasses),
      ...nonPromotionalEvidenceClasses,
    ]),
    promotionBoundary: checklist.promotionBoundary ?? {
      syntheticFixturesPromote: false,
      localDeterministicResultsPromote: false,
      metadataOnlyDetailCapturesPromote: false,
      orderRouteBoundaryEvidencePromote: false,
      publicEducationBackgroundPagesPromote: false,
    },
  };
};
const publicCapturePriorityOpportunitySummaryFor = (row) => {
  const priority = row.priority ?? null;
  const rowEvidenceReadyCaptures = Math.max(
    row.rowEvidencePromotionReadyCaptures ?? 0,
    row.rowEvidenceReadyCaptures ?? 0,
    asArray(row.rowEvidenceReadyCapturePaths).length,
  );
  const outputSignalReviews = row.outputSignalReviews ?? row.promotionCandidates ?? 0;
  const blockers = uniqueStrings([
    ...asArray(row.formalReadinessGate?.missing),
    ...asArray(row.formalReadinessGate?.requiredEvidenceForPromotion),
    ...asArray(row.missingFormalGateEvidence),
    ...asArray(row.requiredEvidenceForPromotion),
    ...asArray(row.publicBundleEvidence?.evidenceMissingForPromotion),
    ...asArray(row.operatorEvidenceChecklist?.missingOfficialRowEvidence),
    ...asArray(row.officialOutputReviewEvidenceMissing),
    ...asArray(row.reviewedEvidenceMissing),
    ...asArray(row.officialOutputReviewNextEvidenceNeeded),
    ...asArray(row.nextEvidenceNeeded),
  ]);
  let opportunityClass = "inspect-status-before-capture";
  let summary = "Inspect the status row before choosing a public capture action.";
  let publicNextCommand = row.publicTemplateAuditCommand ?? row.publicCaptureTemplateCommand ?? null;
  let publicNextStep = "Inspect public template state.";

  if (
    rowEvidenceReadyCaptures > 0 ||
    row.stage === "row-evidence-ready" ||
    row.officialEvidenceTier === "official-row-evidence-ready"
  ) {
    opportunityClass = "promotion-review-ready";
    summary = "Official row-evidence-ready capture exists; review validation and promotion separately.";
    publicNextCommand = row.validateCommittedCaptureCommand ?? null;
    publicNextStep = "Revalidate the committed capture before any promotion review.";
  } else if (row.stage === "capture-needs-rework" || row.officialEvidenceTier === "official-capture-needs-rework") {
    opportunityClass = "repair-public-capture";
    summary = "A capture exists but needs rework before it can support the queue.";
    publicNextCommand = row.publicCaptureSessionCommand ?? row.publicTemplateAuditCommand ?? row.publicCaptureTemplateCommand ?? null;
    publicNextStep = "Use a public capture session to repair commit-safe evidence shape.";
  } else if (row.officialBoundaryModeled || row.officialEvidenceTier === "official-boundary-modeled") {
    opportunityClass = "capture-row-evidence-for-boundary-model";
    summary = "Boundary evidence is modeled, but official rows and source bindings are still missing.";
    publicNextCommand = row.publicCaptureSessionCommand ?? row.publicTemplateAuditCommand ?? row.publicCaptureTemplateCommand ?? null;
    publicNextStep = "Capture exact non-private rows and citation bindings from completed official output.";
  } else if (row.stage === "reviewed-metadata-only" || row.officialEvidenceTier === "official-metadata-only") {
    opportunityClass = "capture-completed-output-for-metadata-only";
    summary = "Only metadata has been reviewed; completed output rows are the next public opportunity.";
    publicNextCommand = row.publicCaptureSessionCommand ?? row.publicTemplateAuditCommand ?? row.publicCaptureTemplateCommand ?? null;
    publicNextStep = "Use the public capture session once official completed output is available.";
  } else if (outputSignalReviews > 0 || row.officialEvidenceTier === "official-output-signal-unreviewed") {
    opportunityClass = "review-output-signal-capture";
    summary = "Output-shape signals exist and need review before they can be treated as boundary evidence.";
    publicNextCommand = row.publicTemplateAuditCommand ?? row.publicCaptureSessionCommand ?? row.publicCaptureTemplateCommand ?? null;
    publicNextStep = "Review the public output-signal capture and keep it non-promotional unless row evidence is added.";
  } else if (row.templateExists || row.stage === "template-ready") {
    opportunityClass = "fill-public-capture-template";
    summary = "A public capture template is available for the next official completed-output pass.";
    publicNextCommand = row.publicCaptureSessionCommand ?? row.publicTemplateAuditCommand ?? row.publicCaptureTemplateCommand ?? null;
    publicNextStep = "Open a public capture session and collect only commit-safe official output evidence.";
  } else if (row.stage === "template-needed" || row.officialEvidenceTier === "official-template-only") {
    opportunityClass = "generate-public-capture-template";
    summary = "Generate the public capture template before collecting official completed-output evidence.";
    publicNextCommand = row.publicCaptureTemplateCommand ?? null;
    publicNextStep = "Generate the public capture template.";
  }

  return {
    priority,
    priorityLabel: priority === null ? "not set" : `P${priority}`,
    stage: row.stage ?? null,
    officialEvidenceTier: row.officialEvidenceTier ?? null,
    opportunityClass,
    summary,
    publicNextStep,
    publicNextCommand,
    blockers,
    readinessBoundary,
  };
};

const stageRank = new Map(
  [
    "row-evidence-ready",
    "reviewed-no-promote",
    "reviewed-boundary-only",
    "reviewed-metadata-only",
    "capture-needs-rework",
    "template-ready",
    "template-needed",
    "blocked",
    "unknown",
  ].map((stage, index) => [stage, index]),
);

const actionClassFor = (row) => {
  if ((row.rowEvidenceReadyCaptures ?? 0) > 0 || row.stage === "row-evidence-ready") {
    return "row-ready-promote-after-review";
  }
  if (row.stage === "reviewed-metadata-only") {
    return "completed-output-required-metadata-only";
  }
  if (row.stage === "reviewed-boundary-only" || row.stage === "reviewed-no-promote") {
    return "completed-output-required-boundary-capture";
  }
  if (row.stage === "capture-needs-rework") {
    return "fix-invalid-capture";
  }
  if (row.stage === "template-needed" || row.stage === "template-ready") {
    return "prepare-private-redaction-input";
  }
  return "inspect-manually";
};

const boundaryUseFor = (row) => {
  if (row.officialOutputReviewBoundaryUse) {
    return row.officialOutputReviewBoundaryUse;
  }
  if (row.stage === "reviewed-no-promote") {
    return "Reviewed capture has output-shape signals but remains non-promotional until official non-private rows and row-level source bindings are captured.";
  }
  if (row.stage === "reviewed-boundary-only") {
    return "Reviewed capture is boundary-only; do not infer result rows, generated values, or citation bindings from field descriptions.";
  }
  if (row.stage === "reviewed-metadata-only") {
    return "Reviewed sources are metadata-only; do not infer formal output fields or report rows without official completed output.";
  }
  return "No reviewed no-promotion boundary was recorded; inspect the capture artifacts before promotion.";
};

const officialEvidenceTierFor = (row) => {
  if (row.officialEvidenceTier) {
    return row.officialEvidenceTier;
  }
  if ((row.rowEvidencePromotionReadyCaptures ?? row.rowEvidenceReadyCaptures ?? 0) > 0 || row.stage === "row-evidence-ready") {
    return "official-row-evidence-ready";
  }
  if (row.officialBoundaryModeled || row.stage === "reviewed-boundary-only" || row.stage === "reviewed-no-promote") {
    return "official-boundary-modeled";
  }
  if (row.stage === "reviewed-metadata-only") {
    return "official-metadata-only";
  }
  if ((row.outputSignalReviews ?? row.promotionCandidates ?? 0) > 0 || row.stage === "output-signal-review") {
    return "official-output-signal-unreviewed";
  }
  if (row.stage === "capture-needs-rework") {
    return "official-capture-needs-rework";
  }
  if (row.stage === "template-ready" || row.stage === "template-needed") {
    return "official-template-only";
  }
  return "official-unknown";
};

const rowsForExport = rows
  .filter(
    (row) =>
      stageFilter === "all" ||
      row.stage === stageFilter ||
      actionClassFor(row) === stageFilter ||
      officialEvidenceTierFor(row) === stageFilter,
  )
  .sort((a, b) => {
    const rowReadyDelta =
      Number((b.rowEvidenceReadyCaptures ?? 0) > 0 || b.stage === "row-evidence-ready") -
      Number((a.rowEvidenceReadyCaptures ?? 0) > 0 || a.stage === "row-evidence-ready");
    if (rowReadyDelta !== 0) {
      return rowReadyDelta;
    }
    return (
      (a.priority ?? 999) - (b.priority ?? 999) ||
      (stageRank.get(a.stage) ?? 100) - (stageRank.get(b.stage) ?? 100) ||
      String(a.title).localeCompare(String(b.title))
    );
  })
  .slice(0, limit ?? rows.length)
  .map((row) => {
    const publicCaptureTemplatePath =
      row.publicCaptureTemplatePath ?? row.captureTemplatePath ?? publicCaptureTemplatePathFor(row.slug);
    const publicCaptureTemplateCommand =
      row.publicCaptureTemplateCommand ??
      row.templateCommand ??
      publicCaptureTemplateCommandFor(row.slug, publicCaptureTemplatePath);
    const publicTemplateAuditCommand = row.publicTemplateAuditCommand ?? publicTemplateAuditCommandFor(row.slug);
    const publicCaptureSessionCommand =
      row.publicCaptureSessionCommand ?? publicCaptureSessionCommandFor(row.slug);
    const currentOutputSignals = row.formalReadinessGate?.currentOutputSignals ?? null;
    const missingFormalGateEvidence = row.formalReadinessGate?.missing ?? [];
    const requiredEvidenceForPromotion = requiredEvidenceForPromotionFor(row);
    const publicBundleEvidenceMissingForPromotion = publicBundleEvidenceMissingForPromotionFor(row);
    const nextEvidenceNeeded = nextEvidenceNeededFor(row);
    const packageSpecificMissingEvidence = packageSpecificMissingEvidenceFor(row, nextEvidenceNeeded);
    const operatorEvidenceChecklist = operatorEvidenceChecklistFor(
      row,
      currentOutputSignals,
      missingFormalGateEvidence,
      packageSpecificMissingEvidence,
    );

    const exportRow = {
      slug: row.slug,
      title: row.title,
      priority: row.priority ?? null,
      stage: row.stage,
      sourceCoverage: row.sourceCoverage ?? null,
      officialEvidenceTier: officialEvidenceTierFor(row),
      officialBoundaryModeled: Boolean(row.officialBoundaryModeled),
      officialBoundaryModeledFields: row.officialBoundaryModeledFields ?? 0,
      officialBoundaryModeledBoundary: row.officialBoundaryModeledBoundary ?? null,
      nextAction: row.nextAction ?? null,
      nextCommand: row.nextCommand ?? null,
      requiredEvidenceForPromotion,
      packageSpecificMissingEvidence,
      publicBundleEvidenceMissingForPromotion,
      actionClass: actionClassFor(row),
      captureUrl: row.captureUrl,
      liveRoute: row.liveDetailInspection
        ? {
            exactRoute: Boolean(row.liveDetailInspection.exactRoute),
            routeKind: row.liveDetailInspection.routeKind ?? null,
            apiAppId: row.liveDetailInspection.apiAppId ?? null,
            startButtonText: row.liveDetailInspection.startButtonText ?? "",
            finalUrl: row.liveDetailInspection.finalUrl ?? row.liveDetailInspection.requestedUrl ?? null,
          }
        : null,
      currentOutputSignals,
      officialBoundaryModel: row.officialBoundaryModel ?? null,
      operatorEvidenceChecklist,
      missingFormalGateEvidence,
      reviewedEvidencePresent: row.officialOutputReviewEvidencePresent ?? [],
      reviewedEvidenceMissing: row.officialOutputReviewEvidenceMissing ?? [],
      nextEvidenceNeeded,
      boundaryUse: boundaryUseFor(row),
      officialCapturePaths: row.officialCapturePaths ?? [],
      rowEvidenceReadyCapturePaths: row.rowEvidenceReadyCapturePaths ?? [],
      publicCaptureTemplatePath,
      publicCaptureTemplateCommand,
      publicTemplateAuditCommand,
      publicCaptureSessionCommand,
      dryRunSanitizeCommand: row.dryRunSanitizeCommand ?? null,
      redactionTemplateCommand: row.redactionTemplateCommand ?? null,
      commitSanitizedCaptureCommand: row.commitSanitizedCaptureCommand ?? null,
      validateCommittedCaptureCommand: row.validateCommittedCaptureCommand ?? null,
      promotionPreviewCommittedCommand: row.promotionPreviewCommittedCommand ?? null,
    };
    exportRow.publicCapturePriorityOpportunitySummary = publicCapturePriorityOpportunitySummaryFor(exportRow);
    exportRow.nextPublicQueueAction = exportRow.publicCapturePriorityOpportunitySummary.publicNextStep;
    exportRow.nextPublicCommand = exportRow.publicCapturePriorityOpportunitySummary.publicNextCommand;
    exportRow.operatorEvidenceChecklist.publicFirstNextAction = exportRow.nextPublicQueueAction;
    exportRow.operatorEvidenceChecklist.publicFirstNextCommand = exportRow.nextPublicCommand;
    return exportRow;
  });

const actionCounts = rowsForExport.reduce((counts, row) => {
  counts[row.actionClass] = (counts[row.actionClass] ?? 0) + 1;
  return counts;
}, {});
const officialEvidenceTierCounts = rowsForExport.reduce((counts, row) => {
  counts[row.officialEvidenceTier] = (counts[row.officialEvidenceTier] ?? 0) + 1;
  return counts;
}, {});
const sourceCoverageCounts = rowsForExport.reduce((counts, row) => {
  const sourceClass = row.sourceCoverage?.class ?? "unknown";
  counts[sourceClass] = (counts[sourceClass] ?? 0) + 1;
  return counts;
}, {});

const summary = {
  schemaVersion: "soma-reports.official-output-next-actions.v1",
  generatedAt: new Date().toISOString(),
  sourceStatusPath: statusPath,
  sourceStatusGeneratedAt: status.generatedAt ?? null,
  sourceLedgerPath: ledgerPath,
  sourceLedgerCapturedAt: ledger.capturedAt ?? null,
  filters: {
    stage: stageFilter,
    limit,
  },
  totals: {
    rows: rowsForExport.length,
    allStatusRows: rows.length,
    ledgerTargets: ledgerSlugs.size,
    statusCoverageOk,
    missingStatusRows: missingStatusRows.length,
    extraStatusRows: extraStatusRows.length,
    rowEvidenceReady: rowsForExport.filter((row) => row.actionClass === "row-ready-promote-after-review").length,
    completedOutputRequired: rowsForExport.filter((row) => row.actionClass.startsWith("completed-output-required")).length,
    metadataOnly: rowsForExport.filter((row) => row.actionClass === "completed-output-required-metadata-only").length,
    boundaryCapture: rowsForExport.filter((row) => row.actionClass === "completed-output-required-boundary-capture").length,
    sourceCoverageCounts,
    authenticatedPositionRows: sourceCoverageCounts["authenticated-position"] ?? 0,
    authenticatedOrderAliasRows: sourceCoverageCounts["authenticated-order-alias"] ?? 0,
    publicOnlyRows: sourceCoverageCounts["public-only"] ?? 0,
    unknownSourceCoverageRows: sourceCoverageCounts.unknown ?? 0,
    officialBoundaryModeled: rowsForExport.filter((row) => row.officialEvidenceTier === "official-boundary-modeled").length,
    officialMetadataOnly: rowsForExport.filter((row) => row.officialEvidenceTier === "official-metadata-only").length,
    officialBoundaryModeledFormalFields: rowsForExport.reduce(
      (total, row) => total + (row.officialBoundaryModeledFields ?? 0),
      0,
    ),
  },
  actionCounts,
  officialEvidenceTierCounts,
  privacyBoundary:
    "Use this queue for planning only. Do not commit raw genome data, private completed report payloads, account identifiers, or private Sequencing.com result URLs. Do not run Start Report/Get Report/Get App/Order actions without explicit user approval.",
  caveats: [
    "Synthetic fixture resultRows are local validation scaffolds, not official Sequencing.com sampleRows/resultRows/reportFile/export evidence.",
    "Related-report reportFile links do not promote the target slug; only exact-package official output rows or exact-package report files count.",
    "Genome Explorer currently has an empty exact-target reportFile; any nearby Healthcare Pro related-report file is non-promotional sibling context.",
  ],
  promotionStandard: [
    "A package needs official non-private sampleRows/resultRows/reportFile/export rows before promotion.",
    "Formal fields alone are only output-shape evidence.",
    "Row-evidence-ready requires official rows, covered formalFields, and citationBindings with source IDs.",
  ],
  rows: rowsForExport,
};

const renderMarkdown = () => {
  const lines = [
    "# Official Output Next Actions",
    "",
    `Generated: ${summary.generatedAt}`,
    `Source status: \`${summary.sourceStatusPath}\` (${summary.sourceStatusGeneratedAt ?? "unknown"})`,
    `Source ledger: \`${summary.sourceLedgerPath}\` (${summary.sourceLedgerCapturedAt ?? "unknown"})`,
    "",
    "## Totals",
    "",
    `- Rows exported: ${summary.totals.rows}/${summary.totals.allStatusRows}`,
    `- Ledger coverage: ${summary.totals.allStatusRows}/${summary.totals.ledgerTargets} status rows (${summary.totals.statusCoverageOk ? "complete" : "stale or mismatched"})`,
    `- Missing status rows: ${missingStatusRows.length > 0 ? missingStatusRows.join(", ") : "none"}`,
    `- Extra status rows: ${extraStatusRows.length > 0 ? extraStatusRows.join(", ") : "none"}`,
    `- Completed-output required: ${summary.totals.completedOutputRequired}`,
    `- Source coverage: ${summary.totals.authenticatedPositionRows} authenticated positions; ${summary.totals.authenticatedOrderAliasRows} authenticated order aliases; ${summary.totals.publicOnlyRows} public-only; ${summary.totals.unknownSourceCoverageRows} unknown`,
    `- Metadata-only blockers: ${summary.totals.metadataOnly}`,
    `- Boundary-capture blockers: ${summary.totals.boundaryCapture}`,
    `- Official-boundary modeled: ${summary.totals.officialBoundaryModeled}`,
    `- Official-boundary modeled formal fields: ${summary.totals.officialBoundaryModeledFormalFields}`,
    `- Row-ready promotion reviews: ${summary.totals.rowEvidenceReady}`,
    "",
    "## Privacy Boundary",
    "",
    summary.privacyBoundary,
    "",
    "## Caveats",
    "",
    ...summary.caveats.map((caveat) => `- ${caveat}`),
    "",
    "## Queue",
    "",
  ];

  for (const row of summary.rows) {
    const publicOpportunitySummary = row.publicCapturePriorityOpportunitySummary;
    lines.push(
      `### ${row.title}`,
      "",
      `- Slug: \`${row.slug}\``,
      `- Priority: ${row.priority ?? "not set"}`,
      `- Stage: \`${row.stage}\``,
      `- Official evidence tier: \`${row.officialEvidenceTier}\``,
      `- Action class: \`${row.actionClass}\``,
      `- Source coverage: ${row.sourceCoverage?.label ?? "not classified"}; positions: ${
        row.sourceCoverage?.authenticatedPositionNumbers?.length > 0
          ? row.sourceCoverage.authenticatedPositionNumbers.join(", ")
          : "none"
      }`,
      `- Public priority/opportunity: ${publicOpportunitySummary.priorityLabel} / \`${publicOpportunitySummary.opportunityClass}\` - ${publicOpportunitySummary.summary}`,
      `- Public opportunity command: \`${publicOpportunitySummary.publicNextCommand ?? "not available"}\``,
      `- Next public queue action: ${row.nextPublicQueueAction ?? "not available"}`,
      `- Next public command: \`${row.nextPublicCommand ?? "not available"}\``,
      `- Next action: ${row.nextAction ?? "not available"}`,
      `- Source: ${row.captureUrl ?? "not available"}`,
      `- Live route: ${
        row.liveRoute
          ? `${row.liveRoute.exactRoute ? "exact" : "fallback"}; ${row.liveRoute.apiAppId ?? "no app ID"}; ${
              row.liveRoute.startButtonText || "no start action"
            }`
          : "not inspected"
      }`,
      `- Boundary: ${row.boundaryUse}`,
      `- Operator checklist: ${
        row.operatorEvidenceChecklist
          ? `official rows ${
              row.operatorEvidenceChecklist.promotionalOfficialRowsPresent ? "present" : "missing"
            }; covered formal fields ${row.operatorEvidenceChecklist.coveredFormalFieldsPresent ? "present" : "missing"}; citation bindings ${
              row.operatorEvidenceChecklist.citationBindingsPresent ? "present" : "missing"
            }; rowEvidenceReady capture ${row.operatorEvidenceChecklist.rowEvidenceReadyCapturePresent ? "present" : "missing"}`
          : "not available"
      }`,
      `- Missing formal gate evidence: ${
        row.missingFormalGateEvidence.length > 0 ? row.missingFormalGateEvidence.join("; ") : "none"
      }`,
      `- Reviewed evidence present: ${
        row.reviewedEvidencePresent.length > 0 ? row.reviewedEvidencePresent.join("; ") : "none"
      }`,
      `- Reviewed evidence missing: ${
        row.reviewedEvidenceMissing.length > 0 ? row.reviewedEvidenceMissing.join("; ") : "none"
      }`,
      "- Next evidence needed:",
      ...(row.nextEvidenceNeeded.length > 0 ? row.nextEvidenceNeeded.map((item) => `  - ${item}`) : ["  - none"]),
      "- Package-specific missing evidence:",
      ...(row.packageSpecificMissingEvidence.length > 0
        ? row.packageSpecificMissingEvidence.map((item) => `  - ${item}`)
        : ["  - none"]),
      `- Next command: \`${row.nextCommand ?? "not available"}\``,
      `- Public capture template: \`${row.publicCaptureTemplatePath ?? "not available"}\``,
      `- Public capture template command: \`${row.publicCaptureTemplateCommand ?? "not available"}\``,
      `- Public template audit: \`${row.publicTemplateAuditCommand ?? "not available"}\``,
      `- Public capture session: \`${row.publicCaptureSessionCommand ?? "not available"}\``,
      `- Dry-run sanitizer: \`${row.dryRunSanitizeCommand ?? "not available"}\``,
      `- Commit-safe export: \`${row.commitSanitizedCaptureCommand ?? "not available"}\``,
      "",
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
};

const renderCompact = () =>
  `${JSON.stringify(
    {
      schemaVersion: summary.schemaVersion,
      generatedAt: summary.generatedAt,
      sourceStatusPath: summary.sourceStatusPath,
      sourceLedgerPath: summary.sourceLedgerPath,
      totals: summary.totals,
      actionCounts: summary.actionCounts,
      officialEvidenceTierCounts: summary.officialEvidenceTierCounts,
      coverage: {
        ok: statusCoverageOk,
        ledgerTargets: ledgerSlugs.size,
        allStatusRows: rows.length,
        missingStatusRows,
        extraStatusRows,
      },
      caveats: summary.caveats,
      rows: summary.rows.map((row) => ({
        slug: row.slug,
        priority: row.priority,
        stage: row.stage,
        officialEvidenceTier: row.officialEvidenceTier,
        officialBoundaryModeled: row.officialBoundaryModeled,
        officialBoundaryModeledFields: row.officialBoundaryModeledFields,
        captureUrl: row.captureUrl,
        sourceCoverage: row.sourceCoverage,
        nextAction: row.nextAction,
        nextCommand: row.nextCommand,
        nextPublicQueueAction: row.nextPublicQueueAction,
        nextPublicCommand: row.nextPublicCommand,
        actionClass: row.actionClass,
        publicCapturePriorityOpportunitySummary: row.publicCapturePriorityOpportunitySummary,
        operatorEvidenceChecklist: row.operatorEvidenceChecklist,
        missingFormalGateEvidence: row.missingFormalGateEvidence,
        requiredEvidenceForPromotion: row.requiredEvidenceForPromotion,
        packageSpecificMissingEvidence: row.packageSpecificMissingEvidence,
        publicBundleEvidenceMissingForPromotion: row.publicBundleEvidenceMissingForPromotion,
        nextEvidenceNeeded: row.nextEvidenceNeeded,
        publicCaptureTemplatePath: row.publicCaptureTemplatePath,
        publicCaptureTemplateCommand: row.publicCaptureTemplateCommand,
        publicTemplateAuditCommand: row.publicTemplateAuditCommand,
        publicCaptureSessionCommand: row.publicCaptureSessionCommand,
        dryRunSanitizeCommand: row.dryRunSanitizeCommand,
        redactionTemplateCommand: row.redactionTemplateCommand,
        commitSanitizedCaptureCommand: row.commitSanitizedCaptureCommand,
        validateCommittedCaptureCommand: row.validateCommittedCaptureCommand,
        publicCaptureCommands: {
          publicCaptureTemplatePath: row.publicCaptureTemplatePath,
          publicCaptureTemplateCommand: row.publicCaptureTemplateCommand,
          publicTemplateAuditCommand: row.publicTemplateAuditCommand,
          publicCaptureSessionCommand: row.publicCaptureSessionCommand,
        },
        privateRedactionCommands: {
          redactionTemplateCommand: row.redactionTemplateCommand,
          dryRunSanitizeCommand: row.dryRunSanitizeCommand,
          commitSanitizedCaptureCommand: row.commitSanitizedCaptureCommand,
          validateCommittedCaptureCommand: row.validateCommittedCaptureCommand,
          promotionPreviewCommittedCommand: row.promotionPreviewCommittedCommand,
        },
      })),
      privacyBoundary: summary.privacyBoundary,
    },
    null,
    2,
  )}\n`;

const output =
  format === "md" ? renderMarkdown() : format === "compact" ? renderCompact() : `${JSON.stringify(summary, null, 2)}\n`;

if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
} else {
  process.stdout.write(output);
}

if (!statusCoverageOk) {
  process.exitCode = 1;
}
