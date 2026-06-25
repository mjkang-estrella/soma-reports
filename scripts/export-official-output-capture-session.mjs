#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const defaultStatusPath = "reference/catalog/official-output-capture-status.json";
const catalogDirectory = "reference/catalog";
const publicReportEndpointProbePrefix = "public-report-endpoint-probe-";
const todayStamp = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

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
const format = args.get("--format") ?? "json";
const outPath = args.get("--out") ?? null;
const tierFilter = args.get("--tier") ?? "all";
const stageFilter = args.get("--stage") ?? "all";
const classFilter = args.get("--class") ?? "all";
const limit = args.has("--limit") ? Number(args.get("--limit")) : null;
const dateStamp = args.get("--date") ?? todayStamp();
const sourceMode = args.get("--source") ?? "public";
const sortMode = args.get("--sort") ?? "priority";
const reportFilter = args.get("--report") ?? args.get("--slug") ?? null;

const allowedFormats = new Set(["json", "md", "compact"]);
const allowedSourceModes = new Set(["public", "private", "both"]);
const allowedSortModes = new Set(["priority", "public-opportunity"]);
const allowedTierFilters = new Set([
  "all",
  "official-boundary-modeled",
  "official-metadata-only",
  "official-output-signal-unreviewed",
  "official-template-only",
  "official-capture-needs-rework",
  "official-unknown",
]);

if (!allowedFormats.has(format)) {
  throw new Error(`Unsupported --format ${format}; expected json, md, or compact`);
}
if (!allowedSourceModes.has(sourceMode)) {
  throw new Error(`Unsupported --source ${sourceMode}; expected public, private, or both`);
}
if (!allowedSortModes.has(sortMode)) {
  throw new Error(`Unsupported --sort ${sortMode}; expected ${[...allowedSortModes].join(", ")}`);
}
if (!allowedTierFilters.has(tierFilter)) {
  throw new Error(`Unsupported --tier ${tierFilter}; expected ${[...allowedTierFilters].join(", ")}`);
}
if (!["all", "missing-exact-detail", "metadata-only"].includes(classFilter)) {
  throw new Error(`Unsupported --class ${classFilter}; expected all, missing-exact-detail, or metadata-only`);
}
if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
  throw new Error(`Unsupported --limit ${args.get("--limit")}; expected a positive integer`);
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const asArray = (value) => (Array.isArray(value) ? value : []);
const latestCatalogPathFor = (prefix) => {
  if (!existsSync(catalogDirectory)) {
    return null;
  }
  const latestFile = readdirSync(catalogDirectory)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
    .sort()
    .at(-1);
  return latestFile ? `${catalogDirectory}/${latestFile}` : null;
};
const status = readJson(statusPath);
const rows = asArray(status.rows);
const publicEndpointProbePath = latestCatalogPathFor(publicReportEndpointProbePrefix);
const publicEndpointProbe = publicEndpointProbePath ? readJson(publicEndpointProbePath) : null;
const publicEndpointProbeBySlug = new Map(
  asArray(publicEndpointProbe?.rows).map((row) => [row.slug, row]),
);
const knownSlugs = new Set(rows.map((row) => row.slug).filter(Boolean));
if (reportFilter && !knownSlugs.has(reportFilter)) {
  throw new Error(`No official-output capture status row found for --report ${reportFilter}`);
}

const stageRank = new Map(
  [
    "row-evidence-ready",
    "reviewed-no-promote",
    "reviewed-boundary-only",
    "reviewed-metadata-only",
    "output-signal-review",
    "capture-needs-rework",
    "template-ready",
    "template-needed",
    "blocked",
    "unknown",
  ].map((stage, index) => [stage, index]),
);

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

const rowEvidenceReady = (row) =>
  row.stage === "row-evidence-ready" ||
  (row.rowEvidenceReadyCaptures ?? 0) > 0 ||
  (row.rowEvidencePromotionReadyCaptures ?? 0) > 0;

const redactionInputPathFor = (slug) => `.soma/private/official-output-redactions/${slug}-redaction-input.json`;
const publicCaptureTemplatePathFor = (slug) => `tmp/capture-templates/${slug}-official-output-capture-template.json`;
const sanitizedDraftPathFor = (slug) => `tmp/sanitized-captures/${slug}-official-output-capture-${dateStamp}.json`;
const committedCapturePathFor = (slug) => `reference/catalog/${slug}-official-output-capture-${dateStamp}.json`;

const uniqueCommands = (commands) =>
  commands.filter((command, index) => Boolean(command) && commands.indexOf(command) === index);

const publicCommandChainFor = (row) => {
  const slug = row.slug;
  const publicCaptureTemplatePath = row.captureTemplatePath ?? publicCaptureTemplatePathFor(slug);
  const committedCapturePath = row.committedCapturePath ?? committedCapturePathFor(slug);
  return uniqueCommands([
    row.templateCommand ?? `npm run scaffold:capture-template -- --report ${slug} --out ${publicCaptureTemplatePath}`,
    `npm run scaffold:template-audit -- --report ${slug}`,
    `# Fill ${publicCaptureTemplatePath} only from a public/non-private official sample, reportFile, export, or sanitized completed-output structure for ${slug}.`,
    `# After placeholders are replaced and sourceResources/sourceResourceIds are exact, validate the public capture draft.`,
    `npm run scaffold:validate-captures -- --path ${publicCaptureTemplatePath}`,
    `# If the source is public/non-private and validation passes, write the reviewed capture to ${committedCapturePath}.`,
    row.validateCommittedCaptureCommand ?? `npm run scaffold:validate-captures -- --path ${committedCapturePath}`,
    "npm run scaffold:capture-status:snapshot",
    row.promotionPreviewCommittedCommand ??
      `# Stop before promotion preview until validate-captures reports rowEvidenceReady: true for ${slug}.`,
  ]);
};

const privateCommandChainFor = (row) => {
  const slug = row.slug;
  const redactionInputPath = row.redactionInputPath ?? redactionInputPathFor(slug);
  const sanitizedDraftPath = row.sanitizedDraftArtifactPath ?? sanitizedDraftPathFor(slug);
  const committedCapturePath = row.committedCapturePath ?? committedCapturePathFor(slug);
  return uniqueCommands([
    row.redactionTemplateCommand ?? `npm run scaffold:redaction-template -- --report ${slug}`,
    row.dryRunSanitizeCommand ??
      `npm run scaffold:sanitize-output -- --input ${redactionInputPath} --out ${sanitizedDraftPath} --dry-run true`,
    row.sanitizeDraftCommand ?? `npm run scaffold:sanitize-output -- --input ${redactionInputPath} --out ${sanitizedDraftPath}`,
    row.validateDraftCaptureCommand ?? `npm run scaffold:validate-captures -- --path ${sanitizedDraftPath}`,
    row.commitSanitizedCaptureCommand ??
      `npm run scaffold:sanitize-output -- --input ${redactionInputPath} --out ${committedCapturePath} --confirm-commit-safe true`,
    row.validateCommittedCaptureCommand ?? `npm run scaffold:validate-captures -- --path ${committedCapturePath}`,
    "npm run scaffold:capture-status:snapshot",
    row.promotionPreviewCommittedCommand ??
      `# Stop before promotion preview until validate-captures reports rowEvidenceReady: true for ${slug}.`,
  ]);
};

const outputSignalCount = (signals, key) => Number(signals?.[key] ?? 0);
const compactPublicEndpointProbeFor = (row) => {
  if (!row) {
    return null;
  }
  const exactOutputKeySignals = row.exactPackageOutputSignals?.nonEmptyOutputKeySignals ?? [];
  return {
    artifactPath: publicEndpointProbePath,
    generatedAt: publicEndpointProbe?.generatedAt ?? null,
    endpointUrl: row.endpointUrl ?? null,
    httpStatus: row.httpStatus ?? null,
    ok: Boolean(row.ok),
    parsed: Boolean(row.parsed),
    endpointTitle: row.endpointTitle ?? null,
    endpointUri: row.endpointUri ?? null,
    appId: row.appId ?? null,
    productId: row.productData?.productId ?? null,
    reportFilePresent: Boolean(row.reportFile),
    reportFile: row.reportFile || null,
    exactOutputKeySignals: exactOutputKeySignals.length,
    exactOutputKeySignalDetails: exactOutputKeySignals.slice(0, 5),
    formalFieldTerms: asArray(row.formalFieldTerms),
    relatedReportFiles: asArray(row.relatedReportFiles).map((related) => ({
      title: related.title ?? null,
      uri: related.uri ?? null,
      reportFile: related.reportFile ?? null,
      boundary: related.boundary ?? null,
    })),
    promotionBoundary: row.promotionBoundary ?? null,
  };
};

const publicCaptureOpportunityFor = (row, tier, signals, endpointProbeRow) => {
  const formalFields = outputSignalCount(signals, "formalFields");
  const hasRows =
    Boolean(signals?.reportFile) ||
    outputSignalCount(signals, "sampleRows") > 0 ||
    outputSignalCount(signals, "resultRows") > 0;
  const liveRoute = row.liveDetailInspection ?? null;
  const endpointProbe = compactPublicEndpointProbeFor(endpointProbeRow);
  const reasons = [];
  let score = 0;

  if (tier === "official-boundary-modeled") {
    score += 35;
    reasons.push("reviewed official boundary already preserves output shape without promoting rows");
  } else if (tier === "official-metadata-only") {
    score += 10;
    reasons.push("exact package identity exists but output rows are still missing");
  }

  if (formalFields > 0) {
    score += Math.min(formalFields, 20);
    reasons.push(`${formalFields} formal/output field signal${formalFields === 1 ? "" : "s"} already mapped`);
  }
  if (signals?.generatedOutput) {
    score += 10;
    reasons.push("generated-output or output-shape signal was reviewed as non-promotional boundary evidence");
  }
  if (liveRoute?.exactRoute) {
    score += 8;
    reasons.push("authenticated live detail inspection resolved the exact package route");
  }
  if (liveRoute?.apiAppId) {
    score += 4;
    reasons.push(`live detail inspection exposed app id ${liveRoute.apiAppId}`);
  }
  if (row.publicBundleEvidence) {
    score += 4;
    reasons.push("public bundle evidence exists but still lacks row-level output evidence");
  }
  if (endpointProbe) {
    if (endpointProbe.parsed) {
      score += 2;
      reasons.push(`public report endpoint parsed ${endpointProbe.endpointTitle ?? row.title}`);
    } else if (endpointProbe.httpStatus) {
      reasons.push(`public report endpoint returned HTTP ${endpointProbe.httpStatus} and no parsed report metadata`);
    }
    if (endpointProbe.reportFilePresent) {
      score += 30;
      reasons.push("public endpoint exposes an exact-package reportFile; validate rows and source bindings before promotion");
    }
    if (endpointProbe.exactOutputKeySignals > 0) {
      score += Math.min(endpointProbe.exactOutputKeySignals * 8, 24);
      reasons.push(`${endpointProbe.exactOutputKeySignals} exact-package public output-key signal(s) need validation`);
    }
    if (endpointProbe.formalFieldTerms.length > 0) {
      score += Math.min(endpointProbe.formalFieldTerms.length, 6);
      reasons.push(`public endpoint exposes ${endpointProbe.formalFieldTerms.length} formal field term(s) as planning hints`);
    }
    if (endpointProbe.relatedReportFiles.length > 0) {
      score += 1;
      reasons.push(
        `${endpointProbe.relatedReportFiles.length} related reportFile signal(s) are sibling context only, not target evidence`,
      );
    }
  }
  if (row.stage === "reviewed-no-promote") {
    score += 8;
    reasons.push("manual review found output-shape signals but blocked promotion until official rows are captured");
  } else if (row.stage === "reviewed-boundary-only") {
    score += 4;
    reasons.push("manual review classifies the capture as boundary-only");
  }
  if (hasRows) {
    score += 20;
    reasons.push("current signals already include rows or a reportFile, so validate row bindings before promotion");
  }

  const missing = row.officialOutputReviewEvidenceMissing?.length
    ? row.officialOutputReviewEvidenceMissing
    : row.formalReadinessGate?.missing ?? [];
  const nextEvidenceNeeded = row.officialOutputReviewNextEvidenceNeeded?.length
    ? row.officialOutputReviewNextEvidenceNeeded
    : row.formalReadinessGate?.requiredEvidenceForPromotion ?? [];

  return {
    score,
    level: score >= 60 ? "high" : score >= 30 ? "medium" : "low",
    reasons,
    missingEvidence: missing,
    nextPublicEvidenceToSeek: nextEvidenceNeeded,
    publicEndpointProbe: endpointProbe,
    safePublicSourceTypes: [
      "exact-package public sample report",
      "exact-package public reportFile",
      "exact-package public export rows",
      "already sanitized completed-output row structure with source IDs",
    ],
    boundary:
      "Planning guidance only. This does not promote readiness; promotion still requires rowEvidenceReady validation on a commit-safe official-output capture.",
    publicEndpointBoundary:
      endpointProbe?.promotionBoundary ??
      "Public endpoint metadata is planning evidence only until exact-package rows, fields, and source bindings pass validation.",
  };
};

const selectedRows = rows
  .filter((row) => !rowEvidenceReady(row))
  .filter((row) => !reportFilter || row.slug === reportFilter)
  .filter((row) => tierFilter === "all" || officialEvidenceTierFor(row) === tierFilter)
  .filter((row) => stageFilter === "all" || row.stage === stageFilter)
  .filter((row) => classFilter === "all" || row.evidenceClass === classFilter)
  .sort((a, b) => {
    if (sortMode === "public-opportunity") {
      const aTier = officialEvidenceTierFor(a);
      const bTier = officialEvidenceTierFor(b);
      const aSignals = a.formalReadinessGate?.currentOutputSignals ?? {};
      const bSignals = b.formalReadinessGate?.currentOutputSignals ?? {};
      const scoreDelta =
        publicCaptureOpportunityFor(b, bTier, bSignals, publicEndpointProbeBySlug.get(b.slug)).score -
        publicCaptureOpportunityFor(a, aTier, aSignals, publicEndpointProbeBySlug.get(a.slug)).score;
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
    }
    return (
      (a.priority ?? 999) - (b.priority ?? 999) ||
      (stageRank.get(a.stage) ?? 100) - (stageRank.get(b.stage) ?? 100) ||
      String(a.title).localeCompare(String(b.title))
    );
  })
  .slice(0, limit ?? rows.length)
  .map((row) => {
    const tier = officialEvidenceTierFor(row);
    const publicCaptureTemplatePath = row.captureTemplatePath ?? publicCaptureTemplatePathFor(row.slug);
    const redactionInputPath = row.redactionInputPath ?? redactionInputPathFor(row.slug);
    const sanitizedDraftPath = row.sanitizedDraftArtifactPath ?? sanitizedDraftPathFor(row.slug);
    const committedCapturePath = row.committedCapturePath ?? committedCapturePathFor(row.slug);
    const currentSignals = row.formalReadinessGate?.currentOutputSignals ?? {};
    const publicCommands = sourceMode === "public" || sourceMode === "both" ? publicCommandChainFor(row) : [];
    const privateCommands = sourceMode === "private" || sourceMode === "both" ? privateCommandChainFor(row) : [];
    const publicEndpointProbeRow = publicEndpointProbeBySlug.get(row.slug) ?? null;
    const publicEndpointProbeSummary = compactPublicEndpointProbeFor(publicEndpointProbeRow);
    const publicCaptureOpportunity = publicCaptureOpportunityFor(row, tier, currentSignals, publicEndpointProbeRow);
    return {
      slug: row.slug,
      title: row.title,
      priority: row.priority ?? null,
      evidenceClass: row.evidenceClass,
      stage: row.stage,
      sourceMode,
      officialEvidenceTier: tier,
      officialBoundaryModeled: Boolean(row.officialBoundaryModeled),
      officialBoundaryModeledFields: row.officialBoundaryModeledFields ?? 0,
      captureUrl: row.captureUrl,
      publicEndpointProbe: publicEndpointProbeSummary,
      liveRoute: row.liveDetailInspection
        ? {
            exactRoute: Boolean(row.liveDetailInspection.exactRoute),
            apiAppId: row.liveDetailInspection.apiAppId ?? null,
            startButtonText: row.liveDetailInspection.startButtonText ?? "",
            finalUrl: row.liveDetailInspection.finalUrl ?? row.liveDetailInspection.requestedUrl ?? null,
          }
        : null,
      outputSignals: {
        reportFile: Boolean(currentSignals.reportFile),
        sampleRows: Number(currentSignals.sampleRows ?? 0),
        resultRows: Number(currentSignals.resultRows ?? 0),
        formalFields: Number(currentSignals.formalFields ?? 0),
        citationBindings: Number(currentSignals.citationBindings ?? 0),
        generatedOutput: Boolean(currentSignals.generatedOutput),
      },
      evidencePresent: row.officialOutputReviewEvidencePresent ?? [],
      evidenceMissing: row.officialOutputReviewEvidenceMissing ?? row.formalReadinessGate?.missing ?? [],
      nextEvidenceNeeded: row.officialOutputReviewNextEvidenceNeeded?.length
        ? row.officialOutputReviewNextEvidenceNeeded
        : row.formalReadinessGate?.requiredEvidenceForPromotion ?? [],
      publicCaptureOpportunity,
      formalGateMissing: row.formalReadinessGate?.missing ?? [],
      publicCaptureTemplatePath,
      redactionInputPath,
      sanitizedDraftPath,
      committedCapturePath,
      publicCommands,
      privateCommands,
      commands: uniqueCommands([...publicCommands, ...privateCommands]),
      stopConditions: [
        "Do not click Start Report, Get Report, Get App, or Order actions from this manifest.",
        "Use --source public only for public/non-private official samples, reportFiles, exports, or already sanitized completed-output structure.",
        "Do not move tmp capture templates into reference/catalog until placeholders are replaced, source bindings are exact/direct/official, and validate-captures passes.",
        "Do not commit raw genome records, personal genotypes, private values, account identifiers, or private result URLs.",
        "For --source private, do not export to reference/catalog unless sanitize-output passes with --confirm-commit-safe true.",
        "Do not run promotion-preview or edit seed files unless validate-captures reports rowEvidenceReady: true.",
      ],
    };
  });

const countBy = (items, key) =>
  items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});

const summary = {
  schemaVersion: "soma-reports.official-output-capture-session.v1",
  generatedAt: new Date().toISOString(),
  sourceStatusPath: statusPath,
  sourceStatusGeneratedAt: status.generatedAt ?? null,
  filters: {
    tier: tierFilter,
    stage: stageFilter,
    class: classFilter,
    report: reportFilter,
    limit,
    date: dateStamp,
    source: sourceMode,
    sort: sortMode,
  },
  totals: {
    selected: selectedRows.length,
    availableBlockers: rows.filter((row) => !rowEvidenceReady(row)).length,
    allStatusRows: rows.length,
    rowEvidenceReadyRows: rows.filter(rowEvidenceReady).length,
    officialBoundaryModeled: selectedRows.filter((row) => row.officialEvidenceTier === "official-boundary-modeled").length,
    officialMetadataOnly: selectedRows.filter((row) => row.officialEvidenceTier === "official-metadata-only").length,
    highPublicCaptureOpportunities: selectedRows.filter((row) => row.publicCaptureOpportunity.level === "high").length,
    mediumPublicCaptureOpportunities: selectedRows.filter((row) => row.publicCaptureOpportunity.level === "medium").length,
    selectedBoundaryModeledFields: selectedRows.reduce(
      (total, row) => total + (row.officialBoundaryModeledFields ?? 0),
      0,
    ),
    publicEndpointProbeRows: selectedRows.filter((row) => row.publicEndpointProbe).length,
    publicEndpointParsedRows: selectedRows.filter((row) => row.publicEndpointProbe?.parsed).length,
    publicEndpointExactReportFileRows: selectedRows.filter((row) => row.publicEndpointProbe?.reportFilePresent).length,
    publicEndpointExactOutputKeySignalRows: selectedRows.filter(
      (row) => (row.publicEndpointProbe?.exactOutputKeySignals ?? 0) > 0,
    ).length,
    publicEndpointRelatedReportFileRows: selectedRows.filter(
      (row) => (row.publicEndpointProbe?.relatedReportFiles?.length ?? 0) > 0,
    ).length,
    publicEndpointFormalFieldSignalRows: selectedRows.filter(
      (row) => (row.publicEndpointProbe?.formalFieldTerms?.length ?? 0) > 0,
    ).length,
  },
  officialEvidenceTierCounts: countBy(selectedRows, "officialEvidenceTier"),
  stageCounts: countBy(selectedRows, "stage"),
  privacyBoundary:
    "This manifest contains operator commands and public/sanitized metadata only. Use public mode only for non-private official samples/reportFiles/exports; fill private completed-output redaction inputs locally and keep full completed reports, raw genome data, private findings, and account data outside the repository.",
  requiredPromotionEvidence: [
    "official non-private sampleRows[] or resultRows[] from the exact package",
    "covered formalFields[] bound to an official-output sourceResources[] entry",
    "citationBindings[] with exact/direct/official sourceBindingStatus and sourceResourceIds",
    "validate-captures rowEvidenceReady: true on a committed reference/catalog capture before seed promotion",
  ],
  rows: selectedRows,
};

const renderMarkdown = () => {
  const lines = [
    "# Official Output Capture Session",
    "",
    `Generated: ${summary.generatedAt}`,
    `Source status: \`${summary.sourceStatusPath}\` (${summary.sourceStatusGeneratedAt ?? "unknown"})`,
    "",
    "## Scope",
    "",
    `- Selected blockers: ${summary.totals.selected}/${summary.totals.availableBlockers}`,
    `- Source mode: \`${sourceMode}\``,
    `- Sort: \`${sortMode}\``,
    `- Official-boundary modeled: ${summary.totals.officialBoundaryModeled}`,
    `- Metadata-only: ${summary.totals.officialMetadataOnly}`,
    `- High public-capture opportunities: ${summary.totals.highPublicCaptureOpportunities}`,
    `- Medium public-capture opportunities: ${summary.totals.mediumPublicCaptureOpportunities}`,
    `- Boundary-modeled fields: ${summary.totals.selectedBoundaryModeledFields}`,
    `- Row-evidence-ready rows in source status: ${summary.totals.rowEvidenceReadyRows}`,
    "",
    "## Privacy Boundary",
    "",
    summary.privacyBoundary,
    "",
    "## Promotion Evidence Required",
    "",
    ...summary.requiredPromotionEvidence.map((item) => `- ${item}`),
    "",
    "## Capture Queue",
    "",
  ];

  for (const row of summary.rows) {
    lines.push(
      `### ${row.priority ?? "?"}. ${row.title}`,
      "",
      `- Slug: \`${row.slug}\``,
      `- Tier: \`${row.officialEvidenceTier}\``,
      `- Stage: \`${row.stage}\``,
      `- Capture URL: ${row.captureUrl ?? "not available"}`,
      `- Public endpoint probe: ${
        row.publicEndpointProbe
          ? `HTTP ${row.publicEndpointProbe.httpStatus ?? "n/a"}; parsed ${
              row.publicEndpointProbe.parsed ? "yes" : "no"
            }; exact reportFile ${row.publicEndpointProbe.reportFilePresent ? "yes" : "no"}; output keys ${
              row.publicEndpointProbe.exactOutputKeySignals
            }; artifact ${row.publicEndpointProbe.artifactPath}`
          : "not probed"
      }`,
      `- Source mode: \`${row.sourceMode}\``,
      `- Live route: ${
        row.liveRoute
          ? `${row.liveRoute.exactRoute ? "exact" : "fallback"}; ${row.liveRoute.apiAppId ?? "no app ID"}; ${
              row.liveRoute.startButtonText || "no start action"
            }`
          : "not inspected"
      }`,
      `- Current output signals: formalFields ${row.outputSignals.formalFields}, sampleRows ${row.outputSignals.sampleRows}, resultRows ${row.outputSignals.resultRows}, citationBindings ${row.outputSignals.citationBindings}`,
      `- Public capture opportunity: ${row.publicCaptureOpportunity.level} (${row.publicCaptureOpportunity.score})`,
      ...(row.publicCaptureOpportunity.reasons.length > 0
        ? row.publicCaptureOpportunity.reasons.map((reason) => `  - ${reason}`)
        : ["  - no current public-capture opportunity signal"]),
      `- Public endpoint boundary: ${row.publicCaptureOpportunity.publicEndpointBoundary}`,
      `- Public capture template: \`${row.publicCaptureTemplatePath}\``,
      `- Redaction input: \`${row.redactionInputPath}\``,
      `- Sanitized draft: \`${row.sanitizedDraftPath}\``,
      `- Committed capture: \`${row.committedCapturePath}\``,
      "- Evidence still needed:",
      ...(row.nextEvidenceNeeded.length > 0 ? row.nextEvidenceNeeded.map((item) => `  - ${item}`) : ["  - none recorded"]),
      "- Commands:",
      ...row.commands.map((command) => `  - \`${command}\``),
      "- Stop conditions:",
      ...row.stopConditions.map((condition) => `  - ${condition}`),
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
      filters: summary.filters,
      totals: summary.totals,
      officialEvidenceTierCounts: summary.officialEvidenceTierCounts,
      rows: summary.rows.map((row) => ({
        slug: row.slug,
        priority: row.priority,
        sourceMode: row.sourceMode,
        officialEvidenceTier: row.officialEvidenceTier,
        stage: row.stage,
        publicCaptureTemplatePath: row.publicCaptureTemplatePath,
        publicEndpointProbe: row.publicEndpointProbe,
        redactionInputPath: row.redactionInputPath,
        sanitizedDraftPath: row.sanitizedDraftPath,
        committedCapturePath: row.committedCapturePath,
        publicCaptureOpportunity: row.publicCaptureOpportunity,
        publicTemplateCommand: row.publicCommands[0] ?? null,
        templateAuditCommand: row.publicCommands.find((command) => command.includes("scaffold:template-audit")) ?? null,
        privateRedactionCommand: row.privateCommands[0] ?? null,
        firstCommand: row.commands[0] ?? null,
        dryRunCommand: row.commands.find((command) => command.includes("--dry-run true")) ?? null,
        formalGateMissing: row.formalGateMissing,
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
