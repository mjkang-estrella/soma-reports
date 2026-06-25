#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { loadOfficialOutputPromotionReview } from "./lib/official-output-promotion-review.mjs";

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
const targetClass = args.get("--class") ?? "all";
const format = args.get("--format") ?? "json";
const allowEmptyCaptures = args.get("--allow-empty-captures") === "true";
const outPath = args.get("--out") ?? null;
const localDateStamp = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = localDateStamp();

if (!["all", "missing-exact-detail", "metadata-only"].includes(targetClass)) {
  throw new Error(`Unsupported --class ${targetClass}; expected all, missing-exact-detail, or metadata-only`);
}

if (!["json", "md", "compact"].includes(format)) {
  throw new Error(`Unsupported --format ${format}; expected json, md, or compact`);
}

const runJson = (script, scriptArgs = []) => {
  let stdout = "";
  let stderr = "";
  let status = 0;
  try {
    stdout = execFileSync(process.execPath, [script, ...scriptArgs], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 40,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    status = typeof error?.status === "number" ? error.status : 1;
    stdout = error?.stdout?.toString?.() ?? "";
    stderr = error?.stderr?.toString?.() ?? "";
  }
  let data = null;
  try {
    data = JSON.parse(stdout || "{}");
  } catch (error) {
    return {
      ok: false,
      exitCode: status,
      data: null,
      error: error instanceof Error ? error.message : String(error),
      stderr,
      stdout,
    };
  }

  return {
    ok: status === 0,
    exitCode: status,
    data,
    error: null,
    stderr,
    stdout,
  };
};

const gitTrackedOfficialCapturePaths = (() => {
  try {
    return new Set(
      execFileSync("git", ["ls-files", "--", "reference/catalog/*official-output-capture*.json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
})();

const planRun = runJson("scripts/export-evidence-capture-plan.mjs", ["--class", targetClass]);
const templateAuditRun = runJson("scripts/audit-official-output-capture-templates.mjs", ["--class", targetClass]);
const captureValidationRun = runJson("scripts/validate-official-output-captures.mjs");
const privacyCanaryRun = runJson("scripts/audit-official-output-capture-privacy-canary.mjs");

const plan = planRun.data;
const templateAudit = templateAuditRun.data;
const captureValidation = captureValidationRun.data;
const manualPromotionReview = loadOfficialOutputPromotionReview();
const problems = [];

if (!planRun.ok || !plan) {
  problems.push(`capture plan failed: ${planRun.error ?? planRun.stderr ?? `exit ${planRun.exitCode}`}`);
}
if (!templateAuditRun.ok || !templateAudit?.ok) {
  problems.push(
    `template audit failed: ${
      templateAudit?.problems?.slice(0, 3).join("; ") || templateAuditRun.error || templateAuditRun.stderr || `exit ${templateAuditRun.exitCode}`
    }`,
  );
}
if (!captureValidationRun.ok || !captureValidation?.ok) {
  problems.push(
    `official capture validation failed: ${
      captureValidation?.results
        ?.filter((result) => !result.ok)
        .slice(0, 3)
        .map((result) => `${result.path}: ${result.problems?.[0]?.message ?? "invalid"}`)
        .join("; ") || captureValidationRun.error || captureValidationRun.stderr || `exit ${captureValidationRun.exitCode}`
    }`,
  );
}
if (!privacyCanaryRun.ok || !privacyCanaryRun.data?.ok) {
  problems.push(
    `official capture privacy canary failed: ${
      privacyCanaryRun.data?.results
        ?.filter((result) => !result.passed)
        .map((result) => `${result.name}: expected ok=${result.expected?.ok} rowEvidenceReady=${result.expected?.rowEvidenceReady}`)
        .join("; ") || privacyCanaryRun.error || privacyCanaryRun.stderr || `exit ${privacyCanaryRun.exitCode}`
    }`,
  );
}
if (plan?.officialOutputPromotionReview?.problems?.length > 0) {
  problems.push(...plan.officialOutputPromotionReview.problems);
}

const planTotals = plan?.totals ?? {};
const templateTotals = templateAudit?.totals ?? {};
const officialCaptureArtifacts = planTotals.officialOutputCaptureArtifacts ?? captureValidation?.checked ?? 0;
const rowEvidenceReadyTargets = planTotals.rowEvidenceReadyTargets ?? captureValidation?.rowEvidenceReady ?? 0;
const targets = planTotals.targets ?? 0;
const publicCaptureTemplatePathFor = (slug) => `tmp/capture-templates/${slug}-official-output-capture-template.json`;
const publicCaptureTemplateCommandFor = (slug, path = publicCaptureTemplatePathFor(slug)) =>
  `npm run scaffold:capture-template -- --report ${slug} --out ${path}`;
const publicTemplateAuditCommandFor = (slug) => `npm run scaffold:template-audit -- --report ${slug}`;
const publicCaptureSessionCommandFor = (slug) =>
  `npm run scaffold:capture-session -- --source public --report ${slug} --format md --out tmp/official-output-capture-session-${slug}.md`;
const asArray = (value) => (Array.isArray(value) ? value : []);
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
const validationMessageSamples = (messages) =>
  asArray(messages)
    .slice(0, 3)
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }
      const path = typeof entry?.path === "string" && entry.path ? `${entry.path}: ` : "";
      const message =
        typeof entry?.message === "string" && entry.message
          ? entry.message
          : entry === null || entry === undefined
            ? "unknown validation message"
            : JSON.stringify(entry);
      return `${path}${message}`;
    });
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
    ...asArray(row.officialOutputReviewEvidenceMissing),
    ...asArray(row.officialOutputReviewNextEvidenceNeeded),
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

if (!allowEmptyCaptures && targets > 0 && officialCaptureArtifacts === 0) {
  problems.push(
    "no commit-safe official-output captures are present in reference/catalog; fill a local template from official output before promotion",
  );
}

const rows = (plan?.targets ?? []).map((target) => {
  const officialOutputPromotionReview = target.officialOutputPromotionReview ?? null;
  const publicCaptureTemplatePath = target.captureTemplatePath ?? publicCaptureTemplatePathFor(target.slug);
  const publicCaptureTemplateCommand =
    target.publicCaptureTemplateCommand ??
    target.templateCommand ??
    publicCaptureTemplateCommandFor(target.slug, publicCaptureTemplatePath);
  const publicTemplateAuditCommand = target.publicTemplateAuditCommand ?? publicTemplateAuditCommandFor(target.slug);
  const publicCaptureSessionCommand = target.publicCaptureSessionCommand ?? publicCaptureSessionCommandFor(target.slug);
  const redactionInputPath = target.redactionInputPath ?? `.soma/private/official-output-redactions/${target.slug}-redaction-input.json`;
  const sanitizedDraftArtifactPath = `tmp/sanitized-captures/${target.slug}-official-output-capture-${today}.json`;
  const committedCapturePath = `reference/catalog/${target.slug}-official-output-capture-${today}.json`;
  const dryRunSanitizeCommand =
    `npm run scaffold:sanitize-output -- --input ${redactionInputPath} --out ${sanitizedDraftArtifactPath} --dry-run true`;
  const sanitizeDraftCommand = `npm run scaffold:sanitize-output -- --input ${redactionInputPath} --out ${sanitizedDraftArtifactPath}`;
  const commitSanitizedCaptureCommand =
    `npm run scaffold:sanitize-output -- --input ${redactionInputPath} --out ${committedCapturePath} --confirm-commit-safe true`;
  const validateDraftCaptureCommand = `npm run scaffold:validate-captures -- --path ${sanitizedDraftArtifactPath}`;
  const validateExpectedCaptureCommand = `npm run scaffold:validate-captures -- --path ${committedCapturePath}`;
  const captureValidations = target.officialOutputCaptureValidations ?? [];
  const artifactSummaries = captureValidations.map((validation) => ({
    path: validation.path,
    ok: Boolean(validation.ok),
    gitTracked: gitTrackedOfficialCapturePaths.has(validation.path),
    problemCount: asArray(validation.problems).length,
    warningCount: asArray(validation.warnings).length,
    problemSamples: validationMessageSamples(validation.problems),
    warningSamples: validationMessageSamples(validation.warnings),
    rowEvidenceReady: Boolean(validation.rowEvidenceReady),
    promotionSafeProvenance: Boolean(validation.promotionSafeProvenance),
    outputSignalReview: Boolean(validation.outputSignalReview ?? validation.promotionCandidate),
    outputSignalReviewCandidate: Boolean(validation.outputSignalReviewCandidate ?? validation.outputSignalReview),
    rowEvidencePromotionReady: Boolean(
      validation.rowEvidencePromotionReady ?? (validation.rowEvidenceReady && validation.promotionSafeProvenance),
    ),
    promotionCandidate: Boolean(validation.promotionCandidate),
    outputSignals: validation.outputSignals ?? {},
  }));
  const validOfficialCapturePaths = captureValidations
    .filter((validation) => validation.ok)
    .map((validation) => validation.path);
  const gitTrackedValidOfficialCapturePaths = captureValidations
    .filter((validation) => validation.ok && gitTrackedOfficialCapturePaths.has(validation.path))
    .map((validation) => validation.path);
  const latestValidCommittedCapturePath =
    gitTrackedValidOfficialCapturePaths.at(-1) ?? validOfficialCapturePaths.at(-1) ?? null;
  const validateCommittedCapturePath = latestValidCommittedCapturePath ?? committedCapturePath;
  const validateCommittedCaptureCommand = `npm run scaffold:validate-captures -- --path ${validateCommittedCapturePath}`;
  const outputSignalTotals = artifactSummaries.reduce(
    (totals, artifact) => {
      const signals = artifact.outputSignals ?? {};
      return {
        reportFile: totals.reportFile || Boolean(signals.reportFile),
        sampleRows: totals.sampleRows + (typeof signals.sampleRows === "number" ? signals.sampleRows : 0),
        resultRows: totals.resultRows + (typeof signals.resultRows === "number" ? signals.resultRows : 0),
        formalFields: totals.formalFields + (typeof signals.formalFields === "number" ? signals.formalFields : 0),
        citationBindings:
          totals.citationBindings + (typeof signals.citationBindings === "number" ? signals.citationBindings : 0),
        generatedOutput: totals.generatedOutput || Boolean(signals.generatedOutput),
      };
    },
    {
      reportFile: false,
      sampleRows: 0,
      resultRows: 0,
      formalFields: 0,
      citationBindings: 0,
      generatedOutput: false,
    },
  );
  const hasOfficialOutputRows =
    outputSignalTotals.reportFile || outputSignalTotals.sampleRows > 0 || outputSignalTotals.resultRows > 0;
  const hasCoveredFormalFields = outputSignalTotals.formalFields > 0;
  const hasCitationBindings = outputSignalTotals.citationBindings > 0;
  const hasRowEvidenceReadyCapture = artifactSummaries.some(
    (artifact) => artifact.rowEvidenceReady && artifact.promotionSafeProvenance,
  );
  const promotionPreviewCommittedCommand = hasRowEvidenceReadyCapture
    ? `npm run scaffold:promotion-preview -- --path ${committedCapturePath}`
    : null;
  const formalReadinessMissing = [
    !hasOfficialOutputRows ? "official non-private sampleRows[], resultRows[], reportFile, or export rows" : null,
    !hasCoveredFormalFields ? "covered formalFields[] mapped from official output" : null,
    !hasCitationBindings ? "citationBindings[] and source IDs for row-level evidence" : null,
    !hasRowEvidenceReadyCapture ? "a rowEvidenceReady official-output capture validator pass" : null,
  ].filter(Boolean);
  const operatorEvidenceChecklist = {
    promotionalOfficialRowsPresent: hasOfficialOutputRows,
    coveredFormalFieldsPresent: hasCoveredFormalFields,
    citationBindingsPresent: hasCitationBindings,
    rowEvidenceReadyCapturePresent: hasRowEvidenceReadyCapture,
    missingOfficialRowEvidence: formalReadinessMissing,
    nonPromotionalEvidenceClasses,
    promotionBoundary: {
      syntheticFixturesPromote: false,
      localDeterministicResultsPromote: false,
      metadataOnlyDetailCapturesPromote: false,
      orderRouteBoundaryEvidencePromote: false,
      publicEducationBackgroundPagesPromote: false,
    },
  };
  const stage = target.captureWorkflow?.stage ?? "unknown";
  const reviewedOfficialBoundary =
    officialOutputPromotionReview?.reviewClass === "reviewed-boundary-only" ||
    officialOutputPromotionReview?.reviewClass === "reviewed-promotion-candidate" ||
    stage === "reviewed-boundary-only" ||
    stage === "reviewed-no-promote";
  const officialBoundaryModeled =
    reviewedOfficialBoundary &&
    !hasRowEvidenceReadyCapture &&
    outputSignalTotals.formalFields > 0 &&
    outputSignalTotals.sampleRows === 0 &&
    outputSignalTotals.resultRows === 0 &&
    outputSignalTotals.citationBindings === 0;
  const officialBoundaryModeledEvidence = [
    outputSignalTotals.generatedOutput ? "official generated-output or output-shape signal present" : null,
    outputSignalTotals.formalFields > 0 ? `${outputSignalTotals.formalFields} official field/scope signals` : null,
    officialOutputPromotionReview?.reviewClass
      ? `manual review: ${officialOutputPromotionReview.reviewClass}`
      : null,
    officialOutputPromotionReview?.officialCapturePath
      ? `capture: ${officialOutputPromotionReview.officialCapturePath}`
      : null,
    ...artifactSummaries
      .filter((artifact) => artifact.outputSignalReview)
      .map((artifact) => `validated output-signal capture: ${artifact.path}`),
  ].filter(Boolean);
  const officialEvidenceTier = hasRowEvidenceReadyCapture
    ? "official-row-evidence-ready"
    : officialBoundaryModeled
      ? "official-boundary-modeled"
      : stage === "reviewed-metadata-only"
        ? "official-metadata-only"
        : artifactSummaries.some((artifact) => artifact.outputSignalReview)
          ? "official-output-signal-unreviewed"
          : stage === "capture-needs-rework"
            ? "official-capture-needs-rework"
            : stage === "template-ready" || stage === "template-needed"
              ? "official-template-only"
              : "official-unknown";
  const officialBoundaryModeledReason = officialBoundaryModeled
    ? `${outputSignalTotals.formalFields} official field/scope signals reviewed as non-promotional boundary evidence.`
    : null;
  const officialBoundaryPromotionBoundary = {
    promotesSampleBackedFormalReady: false,
    promotesFormalEquivalentReady: false,
    promotesSampleRows: false,
    promotesResultRows: false,
    promotesCitationBindings: false,
    removesFormalBlocker: false,
  };
  const officialBoundaryModel = officialBoundaryModeled
    ? {
        reviewClass: officialOutputPromotionReview?.reviewClass ?? null,
        decision: officialOutputPromotionReview?.decision ?? null,
        outputSignals: outputSignalTotals,
        evidencePresent: officialOutputPromotionReview?.evidencePresent ?? officialBoundaryModeledEvidence,
        evidenceMissing: officialOutputPromotionReview?.evidenceMissing ?? formalReadinessMissing,
        nextEvidenceNeeded: officialOutputPromotionReview?.nextEvidenceNeeded ?? target.requiredEvidenceForPromotion ?? [],
        boundaryUse:
          officialOutputPromotionReview?.boundaryUse ??
          "Use only as official field/scope boundary evidence; do not infer rows, values, citations, or readiness.",
        promotionBoundary: officialBoundaryPromotionBoundary,
      }
    : null;

  const row = {
    slug: target.slug,
    title: target.title,
    priority: target.priority,
    evidenceClass: target.evidenceClass,
    sourceCoverage: target.sourceCoverage ?? null,
    stage,
    templateExists: Boolean(target.captureTemplateExists),
    officialCaptures: target.officialOutputCaptureStatus?.captures ?? 0,
    validOfficialCaptures: target.officialOutputCaptureStatus?.valid ?? 0,
    rowEvidenceReadyCaptures: target.officialOutputCaptureStatus?.rowEvidenceReady ?? 0,
    rowEvidencePromotionReadyCaptures: target.officialOutputCaptureStatus?.rowEvidencePromotionReady ?? 0,
    promotionSafeProvenanceCaptures: target.officialOutputCaptureStatus?.promotionSafeProvenance ?? 0,
    outputSignalReviews:
      target.officialOutputCaptureStatus?.outputSignalReviews ??
      target.officialOutputCaptureStatus?.promotionCandidates ??
      0,
    promotionCandidates: target.officialOutputCaptureStatus?.promotionCandidates ?? 0,
    officialCapturePaths: target.currentOfficialOutputCaptureArtifacts ?? [],
    gitTrackedOfficialCapturePaths: (target.currentOfficialOutputCaptureArtifacts ?? []).filter((path) =>
      gitTrackedOfficialCapturePaths.has(path),
    ),
    gitUntrackedOfficialCapturePaths: (target.currentOfficialOutputCaptureArtifacts ?? []).filter(
      (path) => !gitTrackedOfficialCapturePaths.has(path),
    ),
    validOfficialCapturePaths,
    gitTrackedValidOfficialCapturePaths,
    latestValidCommittedCapturePath,
    validateCommittedCapturePath,
    rowEvidenceReadyCapturePaths: captureValidations
      .filter((validation) => validation.rowEvidenceReady)
      .map((validation) => validation.path),
    outputSignalReviewCapturePaths: captureValidations
      .filter((validation) => validation.outputSignalReview ?? validation.promotionCandidate)
      .map((validation) => validation.path),
    promotionCandidateCapturePaths: captureValidations
      .filter((validation) => validation.promotionCandidate)
      .map((validation) => validation.path),
    rowEvidencePromotionReadyCapturePaths: captureValidations
      .filter((validation) => validation.rowEvidencePromotionReady)
      .map((validation) => validation.path),
    officialOutputPromotionReview,
    officialOutputReviewBoundaryUse: officialOutputPromotionReview?.boundaryUse ?? null,
    officialOutputReviewEvidencePresent: officialOutputPromotionReview?.evidencePresent ?? [],
    officialOutputReviewEvidenceMissing: officialOutputPromotionReview?.evidenceMissing ?? [],
    officialOutputReviewNextEvidenceNeeded: officialOutputPromotionReview?.nextEvidenceNeeded ?? [],
    officialOutputReviewOutputSignals: officialOutputPromotionReview?.outputSignals ?? null,
    officialEvidenceTier,
    officialBoundaryModeled,
    officialBoundaryModeledReason,
    officialBoundaryModeledFields: officialBoundaryModeled ? outputSignalTotals.formalFields : 0,
    officialBoundaryModeledEvidence,
    officialBoundaryModel,
    officialBoundaryModeledBoundary: officialBoundaryModeled
      ? "Official field/scope boundary only; still missing official non-private rows, row-level citation bindings, and rowEvidenceReady capture."
      : null,
    latestRouteProbe: target.latestRouteProbe ?? null,
    publicBundleEvidence: target.publicBundleEvidence ?? null,
    officialCaptureArtifactSummaries: artifactSummaries,
    formalReadinessGate: {
      validatorCommand: `npm run agent:bundle -- --report ${target.slug} --fixture fixtures/synthetic/${target.slug}.fixture.json --result fixtures/synthetic/${target.slug}.result.json --validation-mode formal-ready`,
      requirements: [
        "formalArtifacts.sampleRows[] contains at least one source-backed official sample/result row",
        "formalArtifacts.formalFields[] is non-empty and every formal field is covered",
        "each sample/result row carries sourceResourceIds/sourceIds and sourceBindingStatus other than unavailable",
        "result.sampleRows[] or resultRows[] preserves the formal sample-row fingerprints",
      ],
      requiredEvidenceForPromotion: target.requiredEvidenceForPromotion ?? [],
      currentOutputSignals: outputSignalTotals,
      missing: formalReadinessMissing,
      readyForPromotion: formalReadinessMissing.length === 0,
    },
    operatorEvidenceChecklist,
    liveDetailInspection: target.liveDetailInspection ?? null,
    nextAction: target.captureWorkflow?.nextAction ?? null,
    nextCommand: target.captureWorkflow?.nextCommand ?? dryRunSanitizeCommand,
    redactionInputPath,
    redactionTemplateCommand: target.redactionTemplateCommand ?? null,
    sanitizeRedactionCommand: target.sanitizeRedactionCommand ?? null,
    dryRunSanitizeCommand,
    sanitizeDraftCommand,
    commitSanitizedCaptureCommand,
    sanitizedDraftArtifactPath,
    committedCapturePath,
    validateDraftCaptureCommand,
    validateExpectedCaptureCommand,
    validateCommittedCaptureCommand,
    promotionPreviewCommittedCommand,
    captureUrl: target.captureUrl,
    expectedSanitizedArtifactPath: committedCapturePath,
    validationCommandForExpectedCapture: validateExpectedCaptureCommand,
    captureTemplatePath: target.captureTemplatePath,
    publicCaptureTemplatePath,
    publicCaptureTemplateCommand,
    publicTemplateAuditCommand,
    publicCaptureSessionCommand,
  };
  row.publicCapturePriorityOpportunitySummary = publicCapturePriorityOpportunitySummaryFor(row);
  return row;
});
const validateCommittedCaptureCommandPathFailures = rows
  .map((row) => {
    const latestTrackedValidPath = asArray(row.gitTrackedValidOfficialCapturePaths).at(-1);
    if (!latestTrackedValidPath) {
      return null;
    }
    const command = row.validateCommittedCaptureCommand ?? "";
    return command.includes(latestTrackedValidPath)
      ? null
      : `${row.slug}: validateCommittedCaptureCommand must target latest tracked valid capture ${latestTrackedValidPath}`;
  })
  .filter(Boolean);
if (validateCommittedCaptureCommandPathFailures.length > 0) {
  problems.push(...validateCommittedCaptureCommandPathFailures);
}
const targetSlugs = new Set(rows.map((row) => row.slug));
const capturePromotionReviewFor = (result) =>
  manualPromotionReview.entriesByPath.get(result.path) ??
  (result.slug && !targetSlugs.has(result.slug) ? manualPromotionReview.entriesBySlug.get(result.slug) : null);
const captureValidationResults = captureValidation?.results ?? [];
const manualPromotionBlockedCaptureResults = captureValidationResults.filter(
  (result) => result.promotionCandidate && capturePromotionReviewFor(result),
);
const unblockedPromotionCandidateCaptureResults = captureValidationResults.filter(
  (result) => result.promotionCandidate && !capturePromotionReviewFor(result),
);
const nonTargetOfficialOutputCaptureSummaries = (captureValidation?.results ?? [])
  .filter((result) => result.slug && !targetSlugs.has(result.slug))
  .map((result) => ({
    slug: result.slug,
    title: result.title ?? null,
    path: result.path,
    ok: Boolean(result.ok),
    gitTracked: gitTrackedOfficialCapturePaths.has(result.path),
    rowEvidenceReady: Boolean(result.rowEvidenceReady),
    promotionSafeProvenance: Boolean(result.promotionSafeProvenance),
    outputSignalReview: Boolean(result.outputSignalReview ?? result.promotionCandidate),
    outputSignalReviewCandidate: Boolean(result.outputSignalReviewCandidate ?? result.outputSignalReview),
    rowEvidencePromotionReady: Boolean(
      result.rowEvidencePromotionReady ?? (result.rowEvidenceReady && result.promotionSafeProvenance),
    ),
    promotionCandidate: Boolean(result.promotionCandidate),
    manualPromotionBlocked: Boolean(capturePromotionReviewFor(result)),
    officialOutputPromotionReview: capturePromotionReviewFor(result),
    outputSignals: result.outputSignals ?? {},
    status: "outside-current-blocker-ledger",
  }));
const officialBoundaryModeledRows = rows.filter((row) => row.officialBoundaryModeled);
const nonPromotionalBoundaryDecisions = new Set(["no-promote", "keep-boundary-only"]);
const officialBoundaryPromotionFlagKeys = [
  "promotesSampleBackedFormalReady",
  "promotesFormalEquivalentReady",
  "promotesSampleRows",
  "promotesResultRows",
  "promotesCitationBindings",
  "removesFormalBlocker",
];
const officialBoundaryNonPromotionFailures = officialBoundaryModeledRows
  .map((row) => {
    const failures = [];
    const reviewDecision = row.officialOutputPromotionReview?.decision ?? null;
    const missingFormalGateItems = asArray(row.formalReadinessGate?.missing);
    const promotionBoundary = row.officialBoundaryModel?.promotionBoundary ?? {};
    const promotionBoundaryFailures = officialBoundaryPromotionFlagKeys.filter(
      (key) => promotionBoundary[key] !== false,
    );

    if (row.officialEvidenceTier !== "official-boundary-modeled") {
      failures.push(`officialEvidenceTier must be official-boundary-modeled, got ${row.officialEvidenceTier}`);
    }
    if (!nonPromotionalBoundaryDecisions.has(reviewDecision)) {
      failures.push(`manual review decision must remain non-promotional, got ${reviewDecision ?? "none"}`);
    }
    if ((row.rowEvidenceReadyCaptures ?? 0) > 0 || asArray(row.rowEvidenceReadyCapturePaths).length > 0) {
      failures.push("boundary-modeled blockers must not have rowEvidenceReady captures");
    }
    if (
      (row.rowEvidencePromotionReadyCaptures ?? 0) > 0 ||
      asArray(row.rowEvidencePromotionReadyCapturePaths).length > 0
    ) {
      failures.push("boundary-modeled blockers must not have rowEvidencePromotionReady captures");
    }
    if (row.formalReadinessGate?.readyForPromotion === true) {
      failures.push("formal readiness gate must not be ready for promotion");
    }
    if (!missingFormalGateItems.some((item) => /rowEvidenceReady/i.test(item))) {
      failures.push("formal readiness gate must still require a rowEvidenceReady validator pass");
    }
    if (row.promotionPreviewCommittedCommand !== null) {
      failures.push("promotion preview command must stay hidden until rowEvidenceReady validation exists");
    }
    if (row.publicCapturePriorityOpportunitySummary?.opportunityClass === "promotion-review-ready") {
      failures.push("public opportunity class must not switch to promotion-review-ready for boundary-only evidence");
    }
    if (!row.publicCapturePriorityOpportunitySummary?.readinessBoundary?.includes("rowEvidenceReady validation")) {
      failures.push("public readiness boundary must explicitly require rowEvidenceReady validation");
    }
    if (promotionBoundaryFailures.length > 0) {
      failures.push(`promotion boundary flags must be false: ${promotionBoundaryFailures.join(", ")}`);
    }

    return {
      slug: row.slug,
      title: row.title,
      stage: row.stage,
      officialEvidenceTier: row.officialEvidenceTier,
      officialCapturePaths: row.officialCapturePaths,
      reviewDecision,
      failures,
    };
  })
  .filter((row) => row.failures.length > 0);
const officialBoundaryNonPromotionAudit = {
  ok: officialBoundaryNonPromotionFailures.length === 0,
  checked: officialBoundaryModeledRows.length,
  failed: officialBoundaryNonPromotionFailures.length,
  invariant:
    "Official-boundary-modeled blockers stay non-promotional until rowEvidenceReady validation exists.",
  rowEvidenceReadyTargets,
  rowEvidencePromotionReadyTargets:
    planTotals.rowEvidencePromotionReadyTargets ??
    captureValidation?.rowEvidencePromotionReady ??
    planTotals.promotionCandidateTargets ??
    captureValidation?.promotionCandidates ??
    0,
  allowedReviewDecisions: [...nonPromotionalBoundaryDecisions],
  passingSlugs: officialBoundaryModeledRows
    .filter((row) => !officialBoundaryNonPromotionFailures.some((failure) => failure.slug === row.slug))
    .map((row) => row.slug),
  failures: officialBoundaryNonPromotionFailures,
};

if (!officialBoundaryNonPromotionAudit.ok) {
  problems.push(
    ...officialBoundaryNonPromotionFailures.map(
      (row) => `${row.slug}: official-boundary non-promotion invariant failed: ${row.failures.join("; ")}`,
    ),
  );
}

const operatorEvidenceChecklistFailures = rows
  .map((row) => {
    const failures = [];
    const checklist = row.operatorEvidenceChecklist ?? null;
    const signals = row.formalReadinessGate?.currentOutputSignals ?? {};
    const missingOfficialRowEvidence = asArray(checklist?.missingOfficialRowEvidence);
    const nonPromotionalClasses = asArray(checklist?.nonPromotionalEvidenceClasses);
    const rowEvidenceReadyCapturePresent = Boolean(
      (row.rowEvidencePromotionReadyCaptures ?? 0) > 0 ||
        (row.rowEvidenceReadyCaptures ?? 0) > 0 ||
        asArray(row.rowEvidenceReadyCapturePaths).length > 0,
    );

    if (!checklist || typeof checklist !== "object") {
      failures.push("operatorEvidenceChecklist must be present");
    } else {
      if (checklist.promotionalOfficialRowsPresent !== Boolean(signals.reportFile || signals.sampleRows > 0 || signals.resultRows > 0)) {
        failures.push("promotionalOfficialRowsPresent must match official output row/report-file signals");
      }
      if (checklist.coveredFormalFieldsPresent !== Boolean(signals.formalFields > 0)) {
        failures.push("coveredFormalFieldsPresent must match covered formalFields signals");
      }
      if (checklist.citationBindingsPresent !== Boolean(signals.citationBindings > 0)) {
        failures.push("citationBindingsPresent must match citation binding signals");
      }
      if (checklist.rowEvidenceReadyCapturePresent !== rowEvidenceReadyCapturePresent) {
        failures.push("rowEvidenceReadyCapturePresent must match rowEvidenceReady capture paths/counts");
      }
      if (!checklist.rowEvidenceReadyCapturePresent && row.promotionPreviewCommittedCommand !== null) {
        failures.push("promotion preview command must remain hidden until rowEvidenceReady evidence exists");
      }
      for (const expectedClass of nonPromotionalEvidenceClasses) {
        if (!nonPromotionalClasses.includes(expectedClass)) {
          failures.push(`nonPromotionalEvidenceClasses missing ${expectedClass}`);
        }
      }
      if ((signals.formalFields ?? 0) > 0 && (signals.citationBindings ?? 0) === 0) {
        if (!missingOfficialRowEvidence.some((item) => /citationBindings/i.test(item))) {
          failures.push("formal fields without citation bindings must list citationBindings as missing");
        }
        if (!missingOfficialRowEvidence.some((item) => /rowEvidenceReady/i.test(item))) {
          failures.push("formal fields without citation bindings must list rowEvidenceReady as missing");
        }
      }
      const promotionBoundary = checklist.promotionBoundary ?? {};
      for (const [key, value] of Object.entries(promotionBoundary)) {
        if (value !== false) {
          failures.push(`operator promotion boundary flag must be false: ${key}`);
        }
      }
    }

    return {
      slug: row.slug,
      title: row.title,
      failures,
    };
  })
  .filter((row) => row.failures.length > 0);
const operatorEvidenceChecklistAudit = {
  ok: operatorEvidenceChecklistFailures.length === 0,
  checked: rows.length,
  failed: operatorEvidenceChecklistFailures.length,
  invariant:
    "Each blocker exposes a non-promotional operator evidence checklist aligned with formal readiness gates.",
  failures: operatorEvidenceChecklistFailures,
};

if (!operatorEvidenceChecklistAudit.ok) {
  problems.push(
    ...operatorEvidenceChecklistFailures.map(
      (row) => `${row.slug}: operator evidence checklist invariant failed: ${row.failures.join("; ")}`,
    ),
  );
}

const summary = {
  schemaVersion: "soma-reports.official-output-capture-status.v1",
  generatedAt: new Date().toISOString(),
  ok: problems.length === 0,
  targetClass,
  allowEmptyCaptures,
  catalogSnapshot: plan?.catalogSnapshot ?? null,
  totals: {
    targets,
    missingExactDetailTargets: planTotals.missingExactDetailTargets ?? 0,
    metadataOnlyTargets: planTotals.metadataOnlyTargets ?? 0,
    sourceCoverageCounts: planTotals.sourceCoverageCounts ?? {},
    authenticatedPositionTargets: planTotals.authenticatedPositionTargets ?? 0,
    authenticatedOrderAliasTargets: planTotals.authenticatedOrderAliasTargets ?? 0,
    publicOnlyTargets: planTotals.publicOnlyTargets ?? 0,
    unknownSourceCoverageTargets: planTotals.unknownSourceCoverageTargets ?? 0,
    captureTemplatesPresent: planTotals.captureTemplatesPresent ?? templateTotals.existingTemplates ?? 0,
    placeholderTemplates: templateTotals.placeholderTemplates ?? 0,
    invalidTemplates: templateTotals.invalidTemplates ?? 0,
    officialOutputCaptureArtifacts: officialCaptureArtifacts,
    invalidOfficialOutputCaptureArtifacts:
      planTotals.invalidOfficialOutputCaptureArtifacts ?? captureValidation?.failed ?? 0,
    rowEvidenceReadyTargets,
    rowEvidencePromotionReadyTargets:
      planTotals.rowEvidencePromotionReadyTargets ??
      captureValidation?.rowEvidencePromotionReady ??
      planTotals.promotionCandidateTargets ??
      captureValidation?.promotionCandidates ??
      0,
    outputSignalReviewTargets:
      planTotals.outputSignalReviewTargets ??
      planTotals.promotionCandidateTargets ??
      captureValidation?.outputSignalReviews ??
      captureValidation?.promotionCandidates ??
      0,
    promotionCandidateTargets: planTotals.promotionCandidateTargets ?? captureValidation?.promotionCandidates ?? 0,
    reviewedNoPromoteTargets: planTotals.reviewedNoPromoteTargets ?? 0,
    reviewedBoundaryOnlyTargets: planTotals.reviewedBoundaryOnlyTargets ?? 0,
    reviewedMetadataOnlyTargets: planTotals.reviewedMetadataOnlyTargets ?? 0,
    officialBoundaryModeledTargets: officialBoundaryModeledRows.length,
    officialBoundaryModeledFormalFields: officialBoundaryModeledRows.reduce(
      (total, row) => total + (row.officialBoundaryModeledFields ?? 0),
      0,
    ),
    unreviewedOutputSignalReviewTargets:
      planTotals.unreviewedOutputSignalReviewTargets ?? planTotals.unreviewedPromotionCandidateTargets ?? 0,
    unreviewedPromotionCandidateTargets: planTotals.unreviewedPromotionCandidateTargets ?? 0,
    latestRouteProbeTargets: planTotals.latestRouteProbeTargets ?? rows.filter((row) => row.latestRouteProbe).length,
    latestRouteProbeReportData:
      planTotals.latestRouteProbeReportData ?? rows.filter((row) => row.latestRouteProbe?.pagePropsReportData).length,
    latestRouteProbeNotFound:
      planTotals.latestRouteProbeNotFound ?? rows.filter((row) => row.latestRouteProbe?.notFound).length,
    latestRouteProbeFallbacks:
      planTotals.latestRouteProbeFallbacks ??
      rows.filter((row) => row.latestRouteProbe?.finalUrlKind === "marketplace-index-fallback").length,
    publicBundleEvidenceTargets:
      planTotals.publicBundleEvidenceTargets ?? rows.filter((row) => row.publicBundleEvidence).length,
    liveDetailInspectionTargets: planTotals.liveDetailInspectionTargets ?? 0,
    liveDetailInspectionExactRoutes: planTotals.liveDetailInspectionExactRoutes ?? 0,
    liveDetailInspectionApiAppIds: planTotals.liveDetailInspectionApiAppIds ?? 0,
    liveDetailInspectionReportFiles: planTotals.liveDetailInspectionReportFiles ?? 0,
    committedOfficialOutputCaptureArtifacts: captureValidation?.checked ?? officialCaptureArtifacts,
    committedRowEvidenceReadyCaptures: captureValidation?.rowEvidenceReady ?? rowEvidenceReadyTargets,
    committedPromotionSafeProvenanceCaptures: captureValidation?.promotionSafeProvenance ?? 0,
    committedOutputSignalReviews:
      captureValidation?.outputSignalReviews ??
      captureValidation?.promotionCandidates ??
      planTotals.outputSignalReviewTargets ??
      planTotals.promotionCandidateTargets ??
      0,
    committedRowEvidencePromotionReadyCaptures:
      captureValidation?.rowEvidencePromotionReady ?? captureValidation?.promotionCandidates ?? planTotals.promotionCandidateTargets ?? 0,
    committedPromotionCandidates: unblockedPromotionCandidateCaptureResults.length,
    manualPromotionBlockedCaptures: manualPromotionBlockedCaptureResults.length,
    gitTrackedOfficialOutputCaptureArtifacts: (captureValidation?.results ?? []).filter((result) =>
      gitTrackedOfficialCapturePaths.has(result.path),
    ).length,
    gitUntrackedOfficialOutputCaptureArtifacts: (captureValidation?.results ?? []).filter(
      (result) => result.path && !gitTrackedOfficialCapturePaths.has(result.path),
    ).length,
    gitTrackedRowEvidenceReadyCaptures: (captureValidation?.results ?? []).filter(
      (result) => result.rowEvidenceReady && gitTrackedOfficialCapturePaths.has(result.path),
    ).length,
    gitTrackedOutputSignalReviews: (captureValidation?.results ?? []).filter(
      (result) =>
        (result.outputSignalReview ?? result.promotionCandidate) && gitTrackedOfficialCapturePaths.has(result.path),
    ).length,
    outsideCurrentBlockerLedgerCaptures: nonTargetOfficialOutputCaptureSummaries.length,
  },
  officialOutputPromotionReview: plan?.officialOutputPromotionReview ?? null,
  problems,
  statusCounts: Object.fromEntries(
    rows.reduce((counts, row) => counts.set(row.stage, (counts.get(row.stage) ?? 0) + 1), new Map()),
  ),
  officialEvidenceTierCounts: Object.fromEntries(
    rows.reduce(
      (counts, row) => counts.set(row.officialEvidenceTier, (counts.get(row.officialEvidenceTier) ?? 0) + 1),
      new Map(),
    ),
  ),
  officialBoundaryNonPromotionAudit,
  operatorEvidenceChecklistAudit,
  rows,
  nonTargetOfficialOutputCaptures: nonTargetOfficialOutputCaptureSummaries,
  privacyCanary: privacyCanaryRun.data ?? null,
  commands: {
    generateTemplates: "npm run scaffold:capture-templates",
    auditTemplates: "npm run scaffold:template-audit",
    validateCommittedCaptures: "npm run scaffold:validate-captures",
    auditPrivacyCanary: "npm run scaffold:privacy-canary",
    exportCapturePlan: "npm run scaffold:capture-plan -- --format md --out tmp/evidence-capture-plan.md",
  },
  privacyBoundary:
    "Status is derived from commit-safe metadata, local placeholder templates, and reference/catalog capture artifacts only. Keep raw genome files and private completed-report payloads outside the repo.",
};

const renderMarkdown = () => {
  const lines = [
    "# Official Output Capture Status",
    "",
    `Generated: ${summary.generatedAt}`,
    `Status: ${summary.ok ? "ok" : "needs official captures"}`,
    "",
    "## Totals",
    "",
    ...(summary.catalogSnapshot
      ? [
          `- Authenticated marketplace positions: ${summary.catalogSnapshot.authenticatedMarketplacePositions}`,
          `- Identified named packages: ${summary.catalogSnapshot.identifiedNamedPackages}`,
          `- Current formal pending packages: ${summary.catalogSnapshot.formalPendingPackages}`,
        ]
      : []),
    `- Targets: ${summary.totals.targets}`,
    `- Source coverage: ${summary.totals.authenticatedPositionTargets} authenticated positions; ${summary.totals.authenticatedOrderAliasTargets} authenticated order aliases; ${summary.totals.publicOnlyTargets} public-only; ${summary.totals.unknownSourceCoverageTargets} unknown`,
    `- Templates present: ${summary.totals.captureTemplatesPresent}`,
    `- Placeholder templates: ${summary.totals.placeholderTemplates}`,
    `- Official captures: ${summary.totals.officialOutputCaptureArtifacts}`,
    `- Row-evidence-ready targets: ${summary.totals.rowEvidenceReadyTargets}`,
    `- Output-signal review targets: ${summary.totals.outputSignalReviewTargets}`,
    `- Committed official captures: ${summary.totals.committedOfficialOutputCaptureArtifacts}`,
    `- Git-tracked official captures: ${summary.totals.gitTrackedOfficialOutputCaptureArtifacts}`,
    `- Git-untracked official captures: ${summary.totals.gitUntrackedOfficialOutputCaptureArtifacts}`,
    `- Committed row-evidence-ready captures: ${summary.totals.committedRowEvidenceReadyCaptures}`,
    `- Committed row-evidence promotion-ready captures: ${summary.totals.committedRowEvidencePromotionReadyCaptures}`,
    `- Unblocked committed promotion candidates: ${summary.totals.committedPromotionCandidates}`,
    `- Manual-review-blocked captures: ${summary.totals.manualPromotionBlockedCaptures}`,
    `- Git-tracked row-evidence-ready captures: ${summary.totals.gitTrackedRowEvidenceReadyCaptures}`,
    `- Captures outside current blocker ledger: ${summary.totals.outsideCurrentBlockerLedgerCaptures}`,
    `- Reviewed no-promote: ${summary.totals.reviewedNoPromoteTargets}`,
    `- Reviewed boundary-only: ${summary.totals.reviewedBoundaryOnlyTargets}`,
    `- Reviewed metadata-only: ${summary.totals.reviewedMetadataOnlyTargets}`,
    `- Official-boundary modeled: ${summary.totals.officialBoundaryModeledTargets}`,
    `- Official-boundary modeled formal fields: ${summary.totals.officialBoundaryModeledFormalFields}`,
    `- Official-boundary non-promotion audit: ${
      summary.officialBoundaryNonPromotionAudit.ok ? "pass" : "fail"
    } (${summary.officialBoundaryNonPromotionAudit.checked} checked)`,
    `- Operator evidence checklist audit: ${
      summary.operatorEvidenceChecklistAudit.ok ? "pass" : "fail"
    } (${summary.operatorEvidenceChecklistAudit.checked} checked)`,
    `- Unreviewed output-signal reviews: ${summary.totals.unreviewedOutputSignalReviewTargets}`,
    "",
    "## Problems",
    "",
    ...(summary.problems.length > 0 ? summary.problems.map((problem) => `- ${problem}`) : ["- none"]),
    "",
    "## Captures Outside Current Blocker Ledger",
    "",
    ...(summary.nonTargetOfficialOutputCaptures.length > 0
      ? summary.nonTargetOfficialOutputCaptures.map(
          (capture) =>
            `- \`${capture.slug}\`: \`${capture.path}\` (${capture.ok ? "valid" : "invalid"}, row-ready: ${
              capture.rowEvidenceReady ? "yes" : "no"
            }, promotion-ready: ${capture.rowEvidencePromotionReady ? "yes" : "no"}, manual-blocked: ${
              capture.manualPromotionBlocked ? "yes" : "no"
            }, git-tracked: ${capture.gitTracked ? "yes" : "no"})`,
        )
      : ["- none"]),
    "",
    "## Next Queue",
    "",
  ];

  for (const row of summary.rows) {
    const publicOpportunitySummary = row.publicCapturePriorityOpportunitySummary;
    lines.push(
      `### ${row.title}`,
      "",
      `- Slug: \`${row.slug}\``,
      `- Stage: \`${row.stage}\``,
      `- Source coverage: ${row.sourceCoverage?.label ?? "not classified"}; positions: ${
        row.sourceCoverage?.authenticatedPositionNumbers?.length > 0
          ? row.sourceCoverage.authenticatedPositionNumbers.join(", ")
          : "none"
      }`,
      `- Public priority/opportunity: ${publicOpportunitySummary.priorityLabel} / \`${publicOpportunitySummary.opportunityClass}\` - ${publicOpportunitySummary.summary}`,
      `- Public opportunity command: \`${publicOpportunitySummary.publicNextCommand ?? "not available"}\``,
      `- Public capture template: \`${row.publicCaptureTemplatePath ?? row.captureTemplatePath ?? "not available"}\``,
      `- Public capture template command: \`${row.publicCaptureTemplateCommand ?? "not available"}\``,
      `- Public template audit: \`${row.publicTemplateAuditCommand ?? "not available"}\``,
      `- Public capture session: \`${row.publicCaptureSessionCommand ?? "not available"}\``,
      `- Redaction input: \`${row.redactionInputPath ?? "not available"}\``,
      `- Redaction template: \`${row.redactionTemplateCommand ?? "not available"}\``,
      `- Dry-run sanitizer: \`${row.dryRunSanitizeCommand ?? "not available"}\``,
      `- Sanitize draft command: \`${row.sanitizeDraftCommand ?? row.sanitizeRedactionCommand ?? "not available"}\``,
      `- Expected sanitized artifact: \`${row.expectedSanitizedArtifactPath ?? "not available"}\``,
      `- Today's committed artifact: \`${row.committedCapturePath ?? "not available"}\``,
      `- Commit-safe export: \`${row.commitSanitizedCaptureCommand ?? "not available"}\``,
      `- Committed capture validation: \`${row.validateCommittedCaptureCommand ?? row.validationCommandForExpectedCapture ?? "not available"}\``,
      `- Official captures: ${row.officialCaptures}`,
      `- Official-boundary modeled: ${row.officialBoundaryModeled ? "yes" : "no"}${
        row.officialBoundaryModeled ? ` (${row.officialBoundaryModeledFields} fields)` : ""
      }`,
      `- Boundary model limit: ${row.officialBoundaryModeledBoundary ?? "not available"}`,
      `- Formal gate missing: ${
        row.formalReadinessGate.missing.length > 0 ? row.formalReadinessGate.missing.join("; ") : "none"
      }`,
      `- Operator checklist: official rows ${
        row.operatorEvidenceChecklist.promotionalOfficialRowsPresent ? "present" : "missing"
      }; covered formal fields ${row.operatorEvidenceChecklist.coveredFormalFieldsPresent ? "present" : "missing"}; citation bindings ${
        row.operatorEvidenceChecklist.citationBindingsPresent ? "present" : "missing"
      }; rowEvidenceReady capture ${row.operatorEvidenceChecklist.rowEvidenceReadyCapturePresent ? "present" : "missing"}`,
      `- Non-promotional evidence classes: ${row.operatorEvidenceChecklist.nonPromotionalEvidenceClasses.join("; ")}`,
      `- Formal validator: \`${row.formalReadinessGate.validatorCommand}\``,
      `- Official-output review: ${
        row.officialOutputPromotionReview
          ? `${row.officialOutputPromotionReview.decision} / ${row.officialOutputPromotionReview.reviewClass}`
          : "none"
      }`,
      `- Review boundary: ${row.officialOutputReviewBoundaryUse ?? "not available"}`,
      `- Review evidence present: ${
        row.officialOutputReviewEvidencePresent.length > 0
          ? row.officialOutputReviewEvidencePresent.join("; ")
          : "none"
      }`,
      `- Review evidence missing: ${
        row.officialOutputReviewEvidenceMissing.length > 0
          ? row.officialOutputReviewEvidenceMissing.join("; ")
          : "none"
      }`,
      `- Live detail: ${
        row.liveDetailInspection
          ? `${row.liveDetailInspection.exactRoute ? "exact route" : "fallback"}; app ID ${
              row.liveDetailInspection.apiAppId ?? "none"
            }; ${row.liveDetailInspection.startButtonText || "no start action"}`
          : "not inspected"
      }`,
      `- Next command: \`${row.nextCommand}\``,
      `- Next action: ${row.nextAction}`,
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
      ok: summary.ok,
      catalogSnapshot: summary.catalogSnapshot,
      totals: summary.totals,
      statusCounts: summary.statusCounts,
      officialEvidenceTierCounts: summary.officialEvidenceTierCounts,
      officialBoundaryNonPromotionAudit: summary.officialBoundaryNonPromotionAudit,
      operatorEvidenceChecklistAudit: summary.operatorEvidenceChecklistAudit,
      problems: summary.problems,
      nextQueue: summary.rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        stage: row.stage,
        officialEvidenceTier: row.officialEvidenceTier,
        officialBoundaryModeled: row.officialBoundaryModeled,
        officialBoundaryModeledFields: row.officialBoundaryModeledFields,
        evidenceClass: row.evidenceClass,
        sourceCoverage: row.sourceCoverage,
        publicCapturePriorityOpportunitySummary: row.publicCapturePriorityOpportunitySummary,
        operatorEvidenceChecklist: row.operatorEvidenceChecklist,
        missing: row.formalReadinessGate.missing,
        officialCaptureArtifactSummaries: row.officialCaptureArtifactSummaries,
        officialOutputReview: row.officialOutputPromotionReview
          ? {
              decision: row.officialOutputPromotionReview.decision,
              reviewClass: row.officialOutputPromotionReview.reviewClass,
              boundaryUse: row.officialOutputReviewBoundaryUse,
              evidencePresent: row.officialOutputReviewEvidencePresent,
              evidenceMissing: row.officialOutputReviewEvidenceMissing,
              nextEvidenceNeeded: row.officialOutputReviewNextEvidenceNeeded,
              outputSignals: row.officialOutputReviewOutputSignals,
            }
          : null,
        redactionTemplateCommand: row.redactionTemplateCommand,
        publicCaptureTemplatePath: row.publicCaptureTemplatePath,
        publicCaptureTemplateCommand: row.publicCaptureTemplateCommand,
        publicTemplateAuditCommand: row.publicTemplateAuditCommand,
        publicCaptureSessionCommand: row.publicCaptureSessionCommand,
        gitTrackedOfficialCapturePaths: row.gitTrackedOfficialCapturePaths,
        gitUntrackedOfficialCapturePaths: row.gitUntrackedOfficialCapturePaths,
        dryRunSanitizeCommand: row.dryRunSanitizeCommand,
        sanitizeDraftCommand: row.sanitizeDraftCommand,
        commitSanitizedCaptureCommand: row.commitSanitizedCaptureCommand,
        validateCommittedCaptureCommand: row.validateCommittedCaptureCommand,
        promotionPreviewCommittedCommand: row.promotionPreviewCommittedCommand,
        publicCaptureCommands: {
          publicCaptureTemplatePath: row.publicCaptureTemplatePath,
          publicCaptureTemplateCommand: row.publicCaptureTemplateCommand,
          publicTemplateAuditCommand: row.publicTemplateAuditCommand,
          publicCaptureSessionCommand: row.publicCaptureSessionCommand,
        },
        privateRedactionCommands: {
          redactionInputPath: row.redactionInputPath,
          redactionTemplateCommand: row.redactionTemplateCommand,
          dryRunSanitizeCommand: row.dryRunSanitizeCommand,
          sanitizeDraftCommand: row.sanitizeDraftCommand,
          commitSanitizedCaptureCommand: row.commitSanitizedCaptureCommand,
          validateCommittedCaptureCommand: row.validateCommittedCaptureCommand,
          promotionPreviewCommittedCommand: row.promotionPreviewCommittedCommand,
        },
      })),
      nonTargetOfficialOutputCaptures: summary.nonTargetOfficialOutputCaptures,
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

if (!summary.ok) {
  process.exit(1);
}
