#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const defaultStatusPath = "reference/catalog/official-output-capture-status.json";
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
const sourceMode = args.get("--source") ?? "both";
const reportFilter = args.get("--report") ?? args.get("--slug") ?? null;

const allowedFormats = new Set(["json", "md", "compact"]);
const allowedSourceModes = new Set(["public", "private", "both"]);
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
const status = readJson(statusPath);
const rows = asArray(status.rows);
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

const commandChainFor = (row) =>
  uniqueCommands([
    ...(sourceMode === "public" || sourceMode === "both" ? publicCommandChainFor(row) : []),
    ...(sourceMode === "private" || sourceMode === "both" ? privateCommandChainFor(row) : []),
  ]);

const selectedRows = rows
  .filter((row) => !rowEvidenceReady(row))
  .filter((row) => !reportFilter || row.slug === reportFilter)
  .filter((row) => tierFilter === "all" || officialEvidenceTierFor(row) === tierFilter)
  .filter((row) => stageFilter === "all" || row.stage === stageFilter)
  .filter((row) => classFilter === "all" || row.evidenceClass === classFilter)
  .sort(
    (a, b) =>
      (a.priority ?? 999) - (b.priority ?? 999) ||
      (stageRank.get(a.stage) ?? 100) - (stageRank.get(b.stage) ?? 100) ||
      String(a.title).localeCompare(String(b.title)),
  )
  .slice(0, limit ?? rows.length)
  .map((row) => {
    const tier = officialEvidenceTierFor(row);
    const publicCaptureTemplatePath = row.captureTemplatePath ?? publicCaptureTemplatePathFor(row.slug);
    const redactionInputPath = row.redactionInputPath ?? redactionInputPathFor(row.slug);
    const sanitizedDraftPath = row.sanitizedDraftArtifactPath ?? sanitizedDraftPathFor(row.slug);
    const committedCapturePath = row.committedCapturePath ?? committedCapturePathFor(row.slug);
    const currentSignals = row.formalReadinessGate?.currentOutputSignals ?? {};
    const publicCommands = publicCommandChainFor(row);
    const privateCommands = privateCommandChainFor(row);
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
      formalGateMissing: row.formalReadinessGate?.missing ?? [],
      publicCaptureTemplatePath,
      redactionInputPath,
      sanitizedDraftPath,
      committedCapturePath,
      publicCommands,
      privateCommands,
      commands: commandChainFor(row),
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
  },
  totals: {
    selected: selectedRows.length,
    availableBlockers: rows.filter((row) => !rowEvidenceReady(row)).length,
    allStatusRows: rows.length,
    rowEvidenceReadyRows: rows.filter(rowEvidenceReady).length,
    officialBoundaryModeled: selectedRows.filter((row) => row.officialEvidenceTier === "official-boundary-modeled").length,
    officialMetadataOnly: selectedRows.filter((row) => row.officialEvidenceTier === "official-metadata-only").length,
    selectedBoundaryModeledFields: selectedRows.reduce(
      (total, row) => total + (row.officialBoundaryModeledFields ?? 0),
      0,
    ),
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
    `- Official-boundary modeled: ${summary.totals.officialBoundaryModeled}`,
    `- Metadata-only: ${summary.totals.officialMetadataOnly}`,
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
      `- Source mode: \`${row.sourceMode}\``,
      `- Live route: ${
        row.liveRoute
          ? `${row.liveRoute.exactRoute ? "exact" : "fallback"}; ${row.liveRoute.apiAppId ?? "no app ID"}; ${
              row.liveRoute.startButtonText || "no start action"
            }`
          : "not inspected"
      }`,
      `- Current output signals: formalFields ${row.outputSignals.formalFields}, sampleRows ${row.outputSignals.sampleRows}, resultRows ${row.outputSignals.resultRows}, citationBindings ${row.outputSignals.citationBindings}`,
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
        redactionInputPath: row.redactionInputPath,
        sanitizedDraftPath: row.sanitizedDraftPath,
        committedCapturePath: row.committedCapturePath,
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
