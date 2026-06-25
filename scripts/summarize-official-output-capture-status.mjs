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
  const validateCommittedCaptureCommand = `npm run scaffold:validate-captures -- --path ${committedCapturePath}`;
  const captureValidations = target.officialOutputCaptureValidations ?? [];
  const artifactSummaries = captureValidations.map((validation) => ({
    path: validation.path,
    ok: Boolean(validation.ok),
    gitTracked: gitTrackedOfficialCapturePaths.has(validation.path),
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

  return {
    slug: target.slug,
    title: target.title,
    priority: target.priority,
    evidenceClass: target.evidenceClass,
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
    validOfficialCapturePaths: captureValidations
      .filter((validation) => validation.ok)
      .map((validation) => validation.path),
    gitTrackedValidOfficialCapturePaths: captureValidations
      .filter((validation) => validation.ok && gitTrackedOfficialCapturePaths.has(validation.path))
      .map((validation) => validation.path),
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
    validateCommittedCaptureCommand,
    promotionPreviewCommittedCommand,
    captureUrl: target.captureUrl,
    expectedSanitizedArtifactPath: committedCapturePath,
    validationCommandForExpectedCapture: validateCommittedCaptureCommand,
    captureTemplatePath: target.captureTemplatePath,
    publicCaptureTemplatePath,
    publicCaptureTemplateCommand,
    publicTemplateAuditCommand,
    publicCaptureSessionCommand,
  };
});
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
    lines.push(
      `### ${row.title}`,
      "",
      `- Slug: \`${row.slug}\``,
      `- Stage: \`${row.stage}\``,
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
      problems: summary.problems,
      nextQueue: summary.rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        stage: row.stage,
        officialEvidenceTier: row.officialEvidenceTier,
        officialBoundaryModeled: row.officialBoundaryModeled,
        officialBoundaryModeledFields: row.officialBoundaryModeledFields,
        evidenceClass: row.evidenceClass,
        missing: row.formalReadinessGate.missing,
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
