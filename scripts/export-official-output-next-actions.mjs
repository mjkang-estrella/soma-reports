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

const rowsForExport = rows
  .filter((row) => stageFilter === "all" || row.stage === stageFilter || actionClassFor(row) === stageFilter)
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
  .map((row) => ({
    slug: row.slug,
    title: row.title,
    priority: row.priority ?? null,
    stage: row.stage,
    nextAction: row.nextAction ?? null,
    nextCommand: row.nextCommand ?? null,
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
    currentOutputSignals: row.formalReadinessGate?.currentOutputSignals ?? null,
    missingFormalGateEvidence: row.formalReadinessGate?.missing ?? [],
    reviewedEvidencePresent: row.officialOutputReviewEvidencePresent ?? [],
    reviewedEvidenceMissing: row.officialOutputReviewEvidenceMissing ?? [],
    nextEvidenceNeeded: row.officialOutputReviewNextEvidenceNeeded?.length
      ? row.officialOutputReviewNextEvidenceNeeded
      : row.formalReadinessGate?.requiredEvidenceForPromotion ?? [],
    boundaryUse: boundaryUseFor(row),
    officialCapturePaths: row.officialCapturePaths ?? [],
    rowEvidenceReadyCapturePaths: row.rowEvidenceReadyCapturePaths ?? [],
    dryRunSanitizeCommand: row.dryRunSanitizeCommand ?? null,
    redactionTemplateCommand: row.redactionTemplateCommand ?? null,
    commitSanitizedCaptureCommand: row.commitSanitizedCaptureCommand ?? null,
    validateCommittedCaptureCommand: row.validateCommittedCaptureCommand ?? null,
    promotionPreviewCommittedCommand: row.promotionPreviewCommittedCommand ?? null,
  }));

const actionCounts = rowsForExport.reduce((counts, row) => {
  counts[row.actionClass] = (counts[row.actionClass] ?? 0) + 1;
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
  },
  actionCounts,
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
    `- Metadata-only blockers: ${summary.totals.metadataOnly}`,
    `- Boundary-capture blockers: ${summary.totals.boundaryCapture}`,
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
    lines.push(
      `### ${row.title}`,
      "",
      `- Slug: \`${row.slug}\``,
      `- Priority: ${row.priority ?? "not set"}`,
      `- Stage: \`${row.stage}\``,
      `- Action class: \`${row.actionClass}\``,
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
      `- Next command: \`${row.nextCommand ?? "not available"}\``,
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
        captureUrl: row.captureUrl,
        nextAction: row.nextAction,
        nextCommand: row.nextCommand,
        actionClass: row.actionClass,
        missingFormalGateEvidence: row.missingFormalGateEvidence,
        nextEvidenceNeeded: row.nextEvidenceNeeded,
        dryRunSanitizeCommand: row.dryRunSanitizeCommand,
        redactionTemplateCommand: row.redactionTemplateCommand,
        commitSanitizedCaptureCommand: row.commitSanitizedCaptureCommand,
        validateCommittedCaptureCommand: row.validateCommittedCaptureCommand,
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
