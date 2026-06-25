#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
const format = args.get("--format") ?? "json";

if (!["json", "compact"].includes(format)) {
  throw new Error(`Unsupported --format ${format}; expected json or compact`);
}

const expected = {
  marketplacePositions: 164,
  namedPackages: 154,
  unidentifiedAuthenticatedSlots: 0,
};

const runJsonCommand = (name, args) => {
  const startedAt = Date.now();
  const result = spawnSync(args[0], args.slice(1), {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 80,
  });
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  let parsed = null;
  let parseError = null;
  try {
    parsed = stdout ? JSON.parse(stdout) : null;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  return {
    name,
    command: args.join(" "),
    exitCode: result.status,
    durationMs: Date.now() - startedAt,
    parsed,
    parseError,
    stderr: stderr ? stderr.slice(0, 1200) : null,
  };
};

const compactFormalValidation = (validation) => {
  if (!validation) {
    return null;
  }
  return {
    ok: validation.ok,
    validationMode: validation.validationMode,
    expectedSeedPackages: validation.expectedSeedPackages,
    checked: validation.checked,
    passed: validation.passed,
    failed: validation.failed,
    consumerLanguageChecked: validation.consumerLanguageChecked,
    consumerLanguageFailures: validation.consumerLanguageFailures,
    consumerLanguageWarnings: validation.consumerLanguageWarnings,
    formalPending: validation.formalPending,
    formalIncomplete: validation.formalIncomplete,
    strictFormalFailures: validation.strictFormalFailures,
    formalBlockerLedger: validation.formalBlockerLedger
      ? {
          path: validation.formalBlockerLedger.path,
          decisions: validation.formalBlockerLedger.decisions,
          localScaffoldPackages: validation.formalBlockerLedger.localScaffoldPackages,
          problems: validation.formalBlockerLedger.problems ?? [],
        }
      : null,
    failedSlugs: Array.isArray(validation.results)
      ? validation.results.filter((row) => !row.ok).map((row) => row.slug)
      : [],
  };
};

const summarizeRun = (run) => {
  if (run.name === "agent:validate:formal") {
    return {
      ...run,
      parsed: compactFormalValidation(run.parsed),
    };
  }
  if (run.name === "scaffold:capture-status" && run.parsed) {
    return {
      ...run,
      parsed: {
        ok: run.parsed.ok,
        totals: run.parsed.totals
          ? {
              targets: run.parsed.totals.targets,
              officialOutputCaptureArtifacts: run.parsed.totals.officialOutputCaptureArtifacts,
              rowEvidenceReadyTargets: run.parsed.totals.rowEvidenceReadyTargets,
              rowEvidencePromotionReadyTargets: run.parsed.totals.rowEvidencePromotionReadyTargets,
              officialBoundaryModeledTargets: run.parsed.totals.officialBoundaryModeledTargets,
              officialBoundaryModeledFormalFields: run.parsed.totals.officialBoundaryModeledFormalFields,
              committedRowEvidenceReadyCaptures: run.parsed.totals.committedRowEvidenceReadyCaptures,
              outsideCurrentBlockerLedgerCaptures: run.parsed.totals.outsideCurrentBlockerLedgerCaptures,
            }
          : null,
        officialEvidenceTierCounts: run.parsed.officialEvidenceTierCounts,
        officialBoundaryNonPromotionAudit: run.parsed.officialBoundaryNonPromotionAudit
          ? {
              ok: run.parsed.officialBoundaryNonPromotionAudit.ok,
              checked: run.parsed.officialBoundaryNonPromotionAudit.checked,
              failed: run.parsed.officialBoundaryNonPromotionAudit.failed,
              rowEvidenceReadyTargets: run.parsed.officialBoundaryNonPromotionAudit.rowEvidenceReadyTargets,
              rowEvidencePromotionReadyTargets:
                run.parsed.officialBoundaryNonPromotionAudit.rowEvidencePromotionReadyTargets,
              failures: run.parsed.officialBoundaryNonPromotionAudit.failures ?? [],
            }
          : null,
        problems: run.parsed.problems?.slice(0, 10) ?? [],
      },
    };
  }
  if (run.name === "agent:assert-sync" && run.parsed) {
    return {
      ...run,
      parsed: {
        ok: run.parsed.ok,
        checked: run.parsed.checked,
        passed: run.parsed.passed,
        failed: run.parsed.failed,
        seedLoadError: run.parsed.seedLoadError,
        failedSlugs: Array.isArray(run.parsed.results)
          ? run.parsed.results.filter((row) => !row.ok).map((row) => row.slug)
          : [],
      },
    };
  }
  if (run.name.startsWith("scaffold:promotion-verify") && run.parsed) {
    return {
      ...run,
      parsed: {
        ok: run.parsed.ok,
        capturePath: run.parsed.capturePath,
        reportSlug: run.parsed.reportSlug,
        failedChecks: Array.isArray(run.parsed.failedChecks)
          ? run.parsed.failedChecks.map((check) => check.key)
          : [],
      },
    };
  }
  if (run.name === "agent:smoke" && run.parsed) {
    return {
      ...run,
      parsed: {
        ok: run.parsed.ok,
        reportSlug: run.parsed.reportSlug,
        packageExport: run.parsed.packageExport,
        wellness: run.parsed.wellness,
        coordinate: run.parsed.coordinate,
        rsidCoordinate: run.parsed.rsidCoordinate,
        guards: run.parsed.guards,
        rawGenomeIncluded: run.parsed.rawGenomeIncluded,
      },
    };
  }
  return run;
};

const runResults = [
  runJsonCommand("catalog:assert", ["npm", "run", "--silent", "catalog:assert"]),
  runJsonCommand("scaffold:evidence-audit", ["npm", "run", "--silent", "scaffold:evidence-audit"]),
  runJsonCommand("scaffold:capture-plan", ["npm", "run", "--silent", "scaffold:capture-plan", "--", "--format", "compact"]),
  runJsonCommand("scaffold:capture-status", [
    "npm",
    "run",
    "--silent",
    "scaffold:capture-status",
    "--",
    "--format",
    "compact",
    "--allow-empty-captures",
    "true",
  ]),
  runJsonCommand("scaffold:blueprint-audit", [
    "npm",
    "run",
    "--silent",
    "scaffold:blueprint-audit",
    "--",
    "--format",
    "compact",
  ]),
  runJsonCommand("scaffold:next-actions", ["npm", "run", "--silent", "scaffold:next-actions", "--", "--format", "compact"]),
  runJsonCommand("scaffold:capture-session:public", [
    "npm",
    "run",
    "--silent",
    "scaffold:capture-session",
    "--",
    "--source",
    "public",
    "--limit",
    "5",
    "--format",
    "compact",
    "--sort",
    "public-opportunity",
  ]),
  runJsonCommand("scaffold:validate-captures", ["npm", "run", "--silent", "scaffold:validate-captures"]),
  runJsonCommand("scaffold:privacy-canary", ["npm", "run", "--silent", "scaffold:privacy-canary"]),
  runJsonCommand("objective:audit", ["npm", "run", "--silent", "objective:audit", "--", "--format", "compact"]),
  runJsonCommand("ui:audit", ["npm", "run", "--silent", "ui:audit"]),
  runJsonCommand("readiness:audit:summary", ["npm", "run", "--silent", "readiness:audit:summary"]),
  runJsonCommand("agent:validate:formal", ["npm", "run", "--silent", "agent:validate:formal"]),
  runJsonCommand("agent:assert-sync", ["npm", "run", "--silent", "agent:assert-sync"]),
  runJsonCommand("agent:workflow-check", [
    "npm",
    "run",
    "--silent",
    "agent:workflow-check",
    "--",
    "--report",
    "wellness-genetic-guide",
    "--format",
    "compact",
  ]),
  runJsonCommand("agent:smoke", ["npm", "run", "--silent", "agent:smoke"]),
];

const runsByName = new Map(runResults.map((run) => [run.name, run]));
const catalog = runsByName.get("catalog:assert")?.parsed;
const scaffold = runsByName.get("scaffold:evidence-audit")?.parsed;
const capturePlan = runsByName.get("scaffold:capture-plan")?.parsed;
const captureStatus = runsByName.get("scaffold:capture-status")?.parsed;
const blueprintAudit = runsByName.get("scaffold:blueprint-audit")?.parsed;
const nextActions = runsByName.get("scaffold:next-actions")?.parsed;
const publicCaptureSession = runsByName.get("scaffold:capture-session:public")?.parsed;
const captureValidation = runsByName.get("scaffold:validate-captures")?.parsed;
const privacyCanary = runsByName.get("scaffold:privacy-canary")?.parsed;
const objectiveAudit = runsByName.get("objective:audit")?.parsed;
const uiAudit = runsByName.get("ui:audit")?.parsed;
const readiness = runsByName.get("readiness:audit:summary")?.parsed;
const formal = runsByName.get("agent:validate:formal")?.parsed;
const sync = runsByName.get("agent:assert-sync")?.parsed;
const localAgentSmoke = runsByName.get("agent:smoke")?.parsed;
const localAgentWorkflowCheck = runsByName.get("agent:workflow-check")?.parsed;
const blockerLedger = existsSync("reference/catalog/sample-promotion-rejections-2026-06-23.json")
  ? JSON.parse(readFileSync("reference/catalog/sample-promotion-rejections-2026-06-23.json", "utf8"))
  : { decisions: [] };
const blockerSlugs = new Set((blockerLedger.decisions ?? []).map((decision) => decision.slug));
const promotionReview = loadOfficialOutputPromotionReview();
const capturePromotionReviewFor = (row) =>
  promotionReview.entriesByPath.get(row.path) ??
  (row.slug && !blockerSlugs.has(row.slug) ? promotionReview.entriesBySlug.get(row.slug) : null);
const rowEvidenceReadyCapturePaths = Array.isArray(captureValidation?.results)
  ? captureValidation.results.filter((row) => row.rowEvidenceReady).map((row) => row.path)
  : [];
const rowEvidencePromotionReadyCaptureRows = Array.isArray(captureValidation?.results)
  ? captureValidation.results.filter(
      (row) =>
        (row.rowEvidencePromotionReady ?? (row.rowEvidenceReady && row.promotionSafeProvenance)) &&
        !capturePromotionReviewFor(row),
    )
  : [];
const reviewBlockedPromotionReadyCaptureRows = Array.isArray(captureValidation?.results)
  ? captureValidation.results.filter(
      (row) =>
        (row.rowEvidencePromotionReady ?? (row.rowEvidenceReady && row.promotionSafeProvenance)) &&
        capturePromotionReviewFor(row),
    )
  : [];
const rowEvidencePromotionReadyCapturePaths = rowEvidencePromotionReadyCaptureRows.map((row) => row.path);
const reviewBlockedPromotionReadyCapturePaths = reviewBlockedPromotionReadyCaptureRows.map((row) => row.path);
const promotionVerificationRuns = rowEvidencePromotionReadyCapturePaths.map((path) =>
  runJsonCommand(`scaffold:promotion-verify:${path}`, [
    "npm",
    "run",
    "--silent",
    "scaffold:promotion-verify",
    "--",
    "--path",
    path,
  ]),
);

const officialOutputCaptureArtifacts = readdirSync("reference/catalog").filter(
  (file) => file.includes("-official-output-capture-") && file.endsWith(".json"),
);
const latestCatalogJsonPathFor = (prefix) => {
  const latestFile = readdirSync("reference/catalog")
    .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
    .sort()
    .at(-1);
  return latestFile ? `reference/catalog/${latestFile}` : null;
};
const publicEndpointProbePath = latestCatalogJsonPathFor("public-report-endpoint-probe-");
const publicEndpointProbe = publicEndpointProbePath ? JSON.parse(readFileSync(publicEndpointProbePath, "utf8")) : null;
const knownUnavailablePublicEndpointSlugs = new Set([
  "comprehensive-health-screen-wgs-bundle",
  "expedited-advanced-health-screen-wgs-bundle",
  "ultra-rapid-professional-health-screen-wgs-bundle",
]);
const publicEndpointProbeRows = Array.isArray(publicEndpointProbe?.rows) ? publicEndpointProbe.rows : [];
const publicEndpointProbeSlugSet = new Set(publicEndpointProbeRows.map((row) => row.slug));
const publicEndpointProbeMissingSlugs = [...blockerSlugs].filter((slug) => !publicEndpointProbeSlugSet.has(slug));
const publicEndpointProbeExtraSlugs = publicEndpointProbeRows
  .map((row) => row.slug)
  .filter((slug) => !blockerSlugs.has(slug));
const publicEndpointProbeUnexpectedUnavailableSlugs = publicEndpointProbeRows
  .filter((row) => row.ok === false || (row.httpStatus ?? 200) >= 400)
  .map((row) => row.slug)
  .filter((slug) => !knownUnavailablePublicEndpointSlugs.has(slug));
const publicEndpointBase = "https://sequencing.com/api/sequencing/public/reports";
const publicEndpointProbeRowsUsePublicReportEndpoint = publicEndpointProbeRows.every(
  (row) => typeof row.endpointUrl === "string" && row.endpointUrl.startsWith(`${publicEndpointBase}/`),
);
const publicEndpointParsedRowsHaveAppProductMetadata = publicEndpointProbeRows.every(
  (row) => row.parsed !== true || (row.endpointIdentity && row.appMetadata && row.productData),
);
const publicEndpointTextSummaryIsHashOnly = (summary) =>
  summary === null ||
  (typeof summary?.hash === "string" &&
    summary.hash.startsWith("sha256:") &&
    typeof summary.length === "number" &&
    !("text" in summary) &&
    !("html" in summary) &&
    !("content" in summary));
const publicEndpointProbeStoresHashOnlyText = publicEndpointProbeRows.every(
  (row) =>
    publicEndpointTextSummaryIsHashOnly(row.body ?? null) &&
    publicEndpointTextSummaryIsHashOnly(row.summary ?? null) &&
    (row.infoTabs ?? []).every((tab) => publicEndpointTextSummaryIsHashOnly(tab.content ?? null)),
);

const appSource = existsSync("src/App.tsx") ? readFileSync("src/App.tsx", "utf8") : "";
const reportCardSource = existsSync("src/components/ReportCard.tsx")
  ? readFileSync("src/components/ReportCard.tsx", "utf8")
  : "";
const reportDetailSource = existsSync("src/components/ReportDetail.tsx")
  ? readFileSync("src/components/ReportDetail.tsx", "utf8")
  : "";
const formalEvidenceBacklogSource = existsSync("src/lib/formalEvidenceBacklog.ts")
  ? readFileSync("src/lib/formalEvidenceBacklog.ts", "utf8")
  : "";

const uiSourceChecks = {
  appGapQueue:
    appSource.includes("Evidence gap queue"),
  reportCapturePanel:
    reportDetailSource.includes("official-output-capture"),
  reportCardLocalRunSurface:
    reportCardSource.includes("Run locally") &&
    reportCardSource.includes("Scaffold run only"),
  reportDetailLocalRunCoordinateMap:
    reportDetailSource.includes("agent:update-rsid-coordinate-map"),
  reportDetailLocalRunWorkflowCheck:
    reportDetailSource.includes("agent:workflow-check"),
  reportDetailLocalRunWrapper:
    reportDetailSource.includes("agent:prepare-local"),
  reportDetailLocalRunCommandSplit:
    reportDetailSource.includes("localRunReadOnlyWorkflow") &&
    reportDetailSource.includes("localRunWritableWorkflow") &&
    reportDetailSource.includes("Copy read-only checks") &&
    reportDetailSource.includes("Copy local run commands (writes tmp)") &&
    reportDetailSource.includes("Copy bundle validator (writes tmp)") &&
    reportDetailSource.includes("Create Convex draft") &&
    reportDetailSource.includes("Save Convex result summary"),
  reportDetailLocalDeterministicResult:
    reportDetailSource.includes("agent:generate-local-result") &&
    existsSync("scripts/generate-local-agent-result.mjs"),
  formalEvidenceBacklog:
    formalEvidenceBacklogSource.includes("formalEvidenceBacklogSummary"),
  sourceCoverage:
    appSource.includes("Source coverage for open blockers") &&
    reportDetailSource.includes("Source coverage boundary") &&
    formalEvidenceBacklogSource.includes("OfficialOutputSourceCoverage"),
};

const checks = [
  {
    key: "catalog_positions",
    ok:
      runsByName.get("catalog:assert")?.exitCode === 0 &&
      catalog?.ok === true &&
      catalog?.targetTotal === expected.marketplacePositions &&
      catalog?.authenticatedCardPositions === expected.marketplacePositions &&
      catalog?.seededRecordsExpected === expected.namedPackages &&
      catalog?.unidentifiedAuthenticatedSlots === expected.unidentifiedAuthenticatedSlots,
    expected:
      "164 authenticated marketplace positions, 154 named seeded packages, and 0 unidentified authenticated slots",
    actual: catalog
      ? {
          targetTotal: catalog.targetTotal,
          authenticatedCardPositions: catalog.authenticatedCardPositions,
          seededRecordsExpected: catalog.seededRecordsExpected,
          unidentifiedAuthenticatedSlots: catalog.unidentifiedAuthenticatedSlots,
        }
      : null,
  },
  {
    key: "no_scaffold_packages",
    ok:
      runsByName.get("scaffold:evidence-audit")?.exitCode === 0 &&
      scaffold?.ok === true &&
      scaffold?.scaffoldPackages === 0 &&
      scaffold?.candidatePromotions === 0,
    expected: "0 scaffold-only packages remain in the formal evidence blocker ledger",
    actual: scaffold
      ? {
          scaffoldPackages: scaffold.scaffoldPackages,
          outputSignalReviewRows: scaffold.outputSignalReviewRows,
          unreviewedOutputSignalReviews: scaffold.unreviewedOutputSignalReviews,
          reviewedOutputSignalNoPromote: scaffold.reviewedOutputSignalNoPromote,
          candidatePromotions: scaffold.candidatePromotions,
          rawCandidatePromotions: scaffold.rawCandidatePromotions,
          reviewedNoPromoteCandidates: scaffold.reviewedNoPromoteCandidates,
          reviewedBoundaryOnlyCaptures: scaffold.reviewedBoundaryOnlyCaptures,
          reviewedMetadataOnlyTargets: scaffold.reviewedMetadataOnlyTargets,
          unreviewedPromotionCandidatePromotions: scaffold.unreviewedPromotionCandidatePromotions,
          missingDetailArtifacts: scaffold.missingDetailArtifacts,
          exactMetadataOnly: scaffold.exactMetadataOnly,
          describedFieldBoundaryRows: scaffold.describedFieldBoundaryRows,
          missingDetailSlugs: scaffold.missingDetailSlugs ?? [],
          formalFieldNearMissSlugs: scaffold.formalFieldNearMissSlugs ?? [],
        }
      : null,
  },
  {
    key: "objective_coverage",
    ok:
      runsByName.get("objective:audit")?.exitCode === 0 &&
      objectiveAudit?.ok === true &&
      objectiveAudit?.totals?.marketplacePositions === expected.marketplacePositions &&
      objectiveAudit?.totals?.packagesChecked === expected.namedPackages &&
      objectiveAudit?.totals?.promptArtifacts === expected.namedPackages &&
      objectiveAudit?.totals?.fixtureArtifacts === expected.namedPackages &&
      objectiveAudit?.totals?.resultArtifacts === expected.namedPackages &&
      (objectiveAudit?.problems?.length ?? 0) === 0,
    expected:
      "164 Sequencing.com marketplace positions and 154 named packages have prompts, derived fixtures, deterministic outputs, references, source-bound rows, and appendix probability contracts",
    actual: objectiveAudit
      ? {
          marketplacePositions: objectiveAudit.totals?.marketplacePositions,
          packagesChecked: objectiveAudit.totals?.packagesChecked,
          promptArtifacts: objectiveAudit.totals?.promptArtifacts,
          fixtureArtifacts: objectiveAudit.totals?.fixtureArtifacts,
          resultArtifacts: objectiveAudit.totals?.resultArtifacts,
          resultRows: objectiveAudit.totals?.resultRows,
          plainEnglishResultRows: objectiveAudit.totals?.plainEnglishResultRows,
          sourceBoundResultRows: objectiveAudit.totals?.sourceBoundResultRows,
          appendixProbabilityArrays: objectiveAudit.totals?.appendixProbabilityArrays,
          problems: objectiveAudit.problems?.slice(0, 10) ?? [],
        }
      : null,
  },
  {
    key: "readiness_full_coverage",
    ok:
      runsByName.get("readiness:audit:summary")?.exitCode === 0 &&
      readiness?.total === expected.namedPackages &&
      readiness?.sampleBackedFormalReady === expected.namedPackages &&
      readiness?.formalEquivalentReady === expected.namedPackages &&
      (readiness?.localScaffoldSlugs?.length ?? 0) === 0,
    expected: "154 sample-backed formal and 154 formal-equivalent packages",
    actual: readiness
      ? {
          total: readiness.total,
          declaredReady: readiness.declaredReady,
          sampleBackedFormalReady: readiness.sampleBackedFormalReady,
          formalEquivalentReady: readiness.formalEquivalentReady,
          localScaffoldSlugs: readiness.localScaffoldSlugs ?? [],
          derivedGapCounts: readiness.derivedGapCounts ?? {},
        }
      : null,
  },
  {
    key: "rendered_marketplace_ui",
    ok:
      runsByName.get("ui:audit")?.exitCode === 0 &&
      uiAudit?.ok === true &&
      uiAudit?.rendered?.positionRows === expected.marketplacePositions &&
      uiAudit?.rendered?.reportCards === expected.namedPackages &&
      uiAudit?.rendered?.inspectButtons === expected.marketplacePositions &&
      uiAudit?.rendered?.officialOutputBlockerCards === 21 &&
      uiAudit?.rendered?.officialCaptureCardsWithSourceCoverage === 21 &&
      uiAudit?.rendered?.containsSourceCoverageSummary === true,
    expected:
      "rendered app shows all 164 marketplace positions, 154 report cards, local-run controls, 21 official-output blockers, and source coverage for each blocker",
    actual: uiAudit
      ? {
          positionRows: uiAudit.rendered?.positionRows,
          reportCards: uiAudit.rendered?.reportCards,
          inspectButtons: uiAudit.rendered?.inspectButtons,
          duplicateGroupItems: uiAudit.rendered?.duplicateGroupItems,
          aliasRows: uiAudit.rendered?.aliasRows,
          routeAliasRows: uiAudit.rendered?.routeAliasRows,
          officialOutputBlockerCards: uiAudit.rendered?.officialOutputBlockerCards,
          officialCaptureCardsWithSourceCoverage: uiAudit.rendered?.officialCaptureCardsWithSourceCoverage,
          containsSourceCoverageSummary: uiAudit.rendered?.containsSourceCoverageSummary,
          failedChecks: uiAudit.failedChecks ?? [],
        }
      : null,
  },
  {
    key: "formal_validator",
    ok:
      runsByName.get("agent:validate:formal")?.exitCode === 0 &&
      formal?.ok === true &&
      formal?.checked === expected.namedPackages &&
      formal?.formalIncomplete === 0 &&
      formal?.strictFormalFailures === 0,
    expected: "agent:validate:formal passes all 154 packages with no formal incomplete rows",
    actual: compactFormalValidation(formal),
  },
  {
    key: "consumer_plain_english_output",
    ok:
      formal?.checked === expected.namedPackages &&
      formal?.consumerLanguageChecked === expected.namedPackages &&
      formal?.consumerLanguageFailures === 0,
    expected:
      "all 154 deterministic report outputs contain substantive plain-English customer explanations in resultRows[].plainEnglishMeaning",
    actual: formal
      ? {
          checked: formal.checked,
          consumerLanguageChecked: formal.consumerLanguageChecked,
          consumerLanguageFailures: formal.consumerLanguageFailures,
          consumerLanguageWarnings: formal.consumerLanguageWarnings,
        }
      : null,
  },
  {
    key: "official_output_capture_validator",
    ok: runsByName.get("scaffold:validate-captures")?.exitCode === 0 && captureValidation?.ok === true,
    expected:
      "all commit-safe official-output capture artifacts pass schema, privacy, origin, and row-binding checks",
    actual: captureValidation
      ? {
          checked: captureValidation.checked,
          passed: captureValidation.passed,
          failed: captureValidation.failed,
          rowEvidenceReady: captureValidation.rowEvidenceReady,
          rowEvidencePromotionReady: captureValidation.rowEvidencePromotionReady,
          promotionSafeProvenance: captureValidation.promotionSafeProvenance,
          outputSignalReviews: captureValidation.outputSignalReviews,
          promotionCandidates: captureValidation.promotionCandidates,
          reviewBlockedPromotionReadyCaptures: reviewBlockedPromotionReadyCapturePaths,
          failedArtifacts: Array.isArray(captureValidation.results)
            ? captureValidation.results.filter((row) => !row.ok).map((row) => row.path)
            : [],
        }
      : null,
  },
  {
    key: "official_output_privacy_canary",
    ok: runsByName.get("scaffold:privacy-canary")?.exitCode === 0 && privacyCanary?.ok === true,
    expected: "official-output validator rejects private result URLs, private identifiers, genotype values, and row-ready captures without citation bindings",
    actual: privacyCanary
      ? {
          ok: privacyCanary.ok,
          failedCanaries: Array.isArray(privacyCanary.results)
            ? privacyCanary.results.filter((row) => !row.passed).map((row) => row.name)
            : [],
        }
      : null,
  },
  {
    key: "official_output_promotion_applied",
    ok:
      runsByName.get("scaffold:validate-captures")?.exitCode === 0 &&
      captureValidation?.ok === true &&
      promotionVerificationRuns.every((run) => run.exitCode === 0 && run.parsed?.ok === true),
    expected:
      "every unblocked row-evidence promotion-ready official-output capture has landed in seed, prompt, fixture, and result artifacts",
    actual: {
      rowEvidenceReadyCapturePaths,
      rowEvidencePromotionReadyCapturePaths,
      reviewBlockedPromotionReadyCapturePaths,
      failedVerifications: promotionVerificationRuns
        .filter((run) => run.exitCode !== 0 || run.parsed?.ok !== true)
        .map((run) => ({
          command: run.command,
          exitCode: run.exitCode,
          parseError: run.parseError,
          failedChecks: Array.isArray(run.parsed?.failedChecks)
            ? run.parsed.failedChecks.map((check) => check.key)
            : [],
      })),
    },
  },
  {
    key: "local_agent_workflow_check",
    ok:
      runsByName.get("agent:workflow-check")?.exitCode === 0 &&
      localAgentWorkflowCheck?.ok === true &&
      localAgentWorkflowCheck?.readOnly === true &&
      localAgentWorkflowCheck?.formalFieldPathContract?.bundleRequiredPaths > 0 &&
      localAgentWorkflowCheck?.formalFieldPathContract?.preparedRequiredPaths > 0 &&
      localAgentWorkflowCheck?.formalFieldPathContract?.preparedMatchesBundle === true &&
      localAgentWorkflowCheck?.formalFieldPathContract?.preparedAgentInputMatchesValidation === true &&
      localAgentWorkflowCheck?.commandPlan?.localRunnerExample?.includes("SOMA_LOCAL_RUNNER") &&
      localAgentWorkflowCheck?.commandPlan?.validateRun?.includes("agent:validate-run"),
    expected:
      "agent:workflow-check provides a read-only local-run preflight with formal field-path contract proof, runner handoff, and validation command plan",
    actual: localAgentWorkflowCheck
      ? {
          ok: localAgentWorkflowCheck.ok,
          readOnly: localAgentWorkflowCheck.readOnly,
          reportSlug: localAgentWorkflowCheck.reportSlug,
          summary: localAgentWorkflowCheck.summary,
          formalFieldPathContract: localAgentWorkflowCheck.formalFieldPathContract,
          runnerExample: localAgentWorkflowCheck.commandPlan?.localRunnerExample,
          validateRun: localAgentWorkflowCheck.commandPlan?.validateRun,
        }
      : null,
  },
  {
    key: "local_agent_smoke",
    ok:
      runsByName.get("agent:smoke")?.exitCode === 0 &&
      localAgentSmoke?.ok === true &&
      localAgentSmoke?.rawGenomeIncluded === false &&
      localAgentSmoke?.packageExport?.packages === expected.namedPackages &&
      localAgentSmoke?.packageExport?.failed === 0 &&
      localAgentSmoke?.wellness?.validationFailures === 0 &&
      localAgentSmoke?.guards?.staticSampleResultFailsAgainstLocalEvidence === true &&
      localAgentSmoke?.guards?.rawPrepareFails === true &&
      localAgentSmoke?.guards?.nestedRawPrepareFails === true &&
      localAgentSmoke?.guards?.sampleLeakPrepareFails === true &&
      localAgentSmoke?.guards?.scaffoldFixtureLeakPrepareFails === true &&
      localAgentSmoke?.guards?.scaffoldPrepareFailsByDefault === true &&
      localAgentSmoke?.guards?.missingReadinessPrepareFails === true &&
      localAgentSmoke?.guards?.policyOverrideIgnored === true &&
      localAgentSmoke?.guards?.rawResultFails === true &&
      localAgentSmoke?.guards?.scaffoldBoundaryRecorded === true,
    expected:
      "local genome workflow derives evidence, prepares a local agent payload, rejects static/sample leakage, and validates a local result without raw genome data",
    actual: localAgentSmoke
      ? {
          ok: localAgentSmoke.ok,
          packageExport: localAgentSmoke.packageExport,
          wellness: localAgentSmoke.wellness,
          rawGenomeIncluded: localAgentSmoke.rawGenomeIncluded,
          guards: {
            staticSampleResultFailsAgainstLocalEvidence:
              localAgentSmoke.guards?.staticSampleResultFailsAgainstLocalEvidence,
            rawPrepareFails: localAgentSmoke.guards?.rawPrepareFails,
            nestedRawPrepareFails: localAgentSmoke.guards?.nestedRawPrepareFails,
            sampleLeakPrepareFails: localAgentSmoke.guards?.sampleLeakPrepareFails,
            scaffoldFixtureLeakPrepareFails: localAgentSmoke.guards?.scaffoldFixtureLeakPrepareFails,
            rawResultFails: localAgentSmoke.guards?.rawResultFails,
            scaffoldPrepareFailsByDefault: localAgentSmoke.guards?.scaffoldPrepareFailsByDefault,
            missingReadinessPrepareFails: localAgentSmoke.guards?.missingReadinessPrepareFails,
            policyOverrideIgnored: localAgentSmoke.guards?.policyOverrideIgnored,
            scaffoldBoundaryRecorded: localAgentSmoke.guards?.scaffoldBoundaryRecorded,
          },
        }
      : null,
  },
  {
    key: "artifact_sync",
    ok:
      runsByName.get("agent:assert-sync")?.exitCode === 0 &&
      sync?.ok === true &&
      sync?.checked === expected.namedPackages &&
      sync?.failed === 0,
    expected: "agent:assert-sync passes all 154 named packages",
    actual: sync
      ? {
          ok: sync.ok,
          checked: sync.checked,
          passed: sync.passed,
          failed: sync.failed,
        }
      : null,
  },
  {
    key: "ui_gap_and_capture_surface",
    ok: Object.values(uiSourceChecks).every(Boolean),
    expected:
      "UI source exposes gap queue, local-run card actions, per-report capture panel, canonical local-run workflow, and formal-evidence backlog data",
    actual: uiSourceChecks,
  },
  {
    key: "official_output_captures_present_when_needed",
    ok: officialOutputCaptureArtifacts.length > 0 || (scaffold?.scaffoldPackages ?? 0) === 0,
    expected: "commit-safe official-output capture artifacts exist while scaffold packages remain",
    actual: {
      count: officialOutputCaptureArtifacts.length,
      artifacts: officialOutputCaptureArtifacts.map((file) => `reference/catalog/${file}`),
    },
  },
  {
    key: "official_output_capture_plan",
    ok:
      runsByName.get("scaffold:capture-plan")?.exitCode === 0 &&
      capturePlan?.schemaVersion === "soma-reports.evidence-capture-plan.v1" &&
      capturePlan?.totals?.allScaffoldPackages === (scaffold?.scaffoldPackages ?? blockerLedger.decisions?.length ?? 0) &&
      capturePlan?.totals?.targets === (scaffold?.scaffoldPackages ?? blockerLedger.decisions?.length ?? 0) &&
      Array.isArray(capturePlan?.targets) &&
      capturePlan.targets.length === (scaffold?.scaffoldPackages ?? blockerLedger.decisions?.length ?? 0) &&
      capturePlan.targets.every(
        (target) =>
          target.redactionTemplateCommand?.includes("scaffold:redaction-template") &&
          target.sanitizeRedactionCommand?.includes("scaffold:sanitize-output") &&
          target.sourceCoverage?.label &&
          target.sourceCoverage?.authenticatedMarketplacePositionTotal === expected.marketplacePositions &&
          target.captureWorkflow?.nextCommand,
      ),
    expected:
      "scaffold:capture-plan compact output covers every remaining scaffold blocker with redaction and sanitizer commands",
    actual: capturePlan
      ? {
          totals: capturePlan.totals,
          firstTargets: capturePlan.targets?.slice(0, 5).map((target) => ({
            slug: target.slug,
            evidenceClass: target.evidenceClass,
            sourceCoverage: target.sourceCoverage,
            stage: target.captureWorkflow?.stage,
            nextCommand: target.captureWorkflow?.nextCommand,
          })),
        }
      : null,
  },
  {
    key: "official_boundary_modeled_non_promotional",
    ok:
      runsByName.get("scaffold:capture-status")?.exitCode === 0 &&
      captureStatus?.ok === true &&
      captureStatus?.totals?.targets === (scaffold?.scaffoldPackages ?? blockerLedger.decisions?.length ?? 0) &&
      captureStatus?.totals?.officialBoundaryModeledTargets ===
        (captureStatus?.officialBoundaryNonPromotionAudit?.checked ?? -1) &&
      captureStatus?.officialBoundaryNonPromotionAudit?.ok === true &&
      captureStatus?.officialBoundaryNonPromotionAudit?.failed === 0,
    expected:
      "every official-boundary-modeled blocker stays non-promotional until rowEvidenceReady validation exists",
    actual: captureStatus
      ? {
          totals: {
            targets: captureStatus.totals?.targets,
            officialBoundaryModeledTargets: captureStatus.totals?.officialBoundaryModeledTargets,
            officialBoundaryModeledFormalFields: captureStatus.totals?.officialBoundaryModeledFormalFields,
            rowEvidenceReadyTargets: captureStatus.totals?.rowEvidenceReadyTargets,
            rowEvidencePromotionReadyTargets: captureStatus.totals?.rowEvidencePromotionReadyTargets,
            committedRowEvidenceReadyCaptures: captureStatus.totals?.committedRowEvidenceReadyCaptures,
            outsideCurrentBlockerLedgerCaptures: captureStatus.totals?.outsideCurrentBlockerLedgerCaptures,
          },
          officialEvidenceTierCounts: captureStatus.officialEvidenceTierCounts,
          officialBoundaryNonPromotionAudit: captureStatus.officialBoundaryNonPromotionAudit,
          problems: captureStatus.problems?.slice(0, 10) ?? [],
        }
      : null,
  },
  {
    key: "formal_output_blueprint_blocker_coverage",
    ok:
      runsByName.get("scaffold:blueprint-audit")?.exitCode === 0 &&
      blueprintAudit?.ok === true &&
      blueprintAudit?.totals?.blockers === 21 &&
      blueprintAudit?.totals?.artifacts === 21 &&
      blueprintAudit?.totals?.sectionBlueprints === blueprintAudit?.totals?.sections &&
      blueprintAudit?.totals?.fieldBlueprints === blueprintAudit?.totals?.fields &&
      blueprintAudit?.totals?.requiredFieldPaths === blueprintAudit?.totals?.requiredFields &&
      blueprintAudit?.totals?.missingRequiredFieldPaths === 0 &&
      blueprintAudit?.totals?.missingBlueprints === 0 &&
      blueprintAudit?.totals?.invalidBlueprints === 0 &&
      blueprintAudit?.totals?.promotingBlueprints === 0 &&
      blueprintAudit?.totals?.missingNonPromotionBoundaries === 0 &&
      blueprintAudit?.totals?.rowsWithPackageSpecificEvidence === 21 &&
      blueprintAudit?.totals?.rowsWithPublicNextCommand === 21 &&
      blueprintAudit?.totals?.rowEvidenceReadyBlockers === 0 &&
      Array.isArray(blueprintAudit?.fieldGapRows) &&
      blueprintAudit.fieldGapRows.length === 21 &&
      blueprintAudit.fieldGapRows.every(
        (row) =>
          row.sections > 0 &&
          row.sectionBlueprints === row.sections &&
          row.fields > 0 &&
          row.fieldBlueprints === row.fields &&
          row.requiredFields === row.fields &&
          row.requiredFieldPaths === row.requiredFields &&
          Array.isArray(row.missingRequiredFieldPaths) &&
          row.missingRequiredFieldPaths.length === 0 &&
          row.rowEvidenceReadyCaptures === 0 &&
          row.rowEvidencePromotionReadyCaptures === 0 &&
          Array.isArray(row.requiredEvidenceForPromotion) &&
          row.requiredEvidenceForPromotion.length > 0 &&
          Array.isArray(row.packageSpecificMissingEvidence) &&
          row.packageSpecificMissingEvidence.length >= row.requiredEvidenceForPromotion.length &&
          String(row.nextPublicCommand ?? "").includes("scaffold:capture-session -- --source public") &&
          String(row.outputFieldGapBoundary ?? "").includes("non-promoting output-format guidance"),
      ) &&
      blueprintAudit?.catalogSnapshot?.authenticatedMarketplacePositions === expected.marketplacePositions,
    expected:
      "all 21 formal blockers have complete non-promoting formalOutputBlueprint metadata, canonical required field paths, field-gap rows, package-specific evidence gaps, and public-safe capture commands inside the 164-position marketplace snapshot",
    actual: blueprintAudit
      ? {
          catalogSnapshot: blueprintAudit.catalogSnapshot,
          totals: blueprintAudit.totals,
          fieldGapRows: blueprintAudit.fieldGapRows?.slice(0, 5).map((row) => ({
            slug: row.slug,
            sections: row.sections,
            sectionBlueprints: row.sectionBlueprints,
            fields: row.fields,
            fieldBlueprints: row.fieldBlueprints,
            requiredFields: row.requiredFields,
            requiredFieldPaths: row.requiredFieldPaths,
            missingRequiredFieldPaths: row.missingRequiredFieldPaths,
            officialEvidenceTier: row.officialEvidenceTier,
            sourceCoverageClass: row.sourceCoverageClass,
            nextPublicCommand: row.nextPublicCommand,
            packageSpecificMissingEvidence: row.packageSpecificMissingEvidence?.slice(0, 5) ?? [],
          })),
          problemSamples: blueprintAudit.problemSamples ?? blueprintAudit.problems?.slice(0, 10) ?? [],
        }
      : null,
  },
  {
    key: "official_output_next_actions_coverage",
    ok:
      runsByName.get("scaffold:next-actions")?.exitCode === 0 &&
      nextActions?.schemaVersion === "soma-reports.official-output-next-actions.v1" &&
      nextActions?.coverage?.ok === true &&
      nextActions?.coverage?.ledgerTargets === (scaffold?.scaffoldPackages ?? blockerLedger.decisions?.length ?? 0) &&
      nextActions?.coverage?.allStatusRows === (scaffold?.scaffoldPackages ?? blockerLedger.decisions?.length ?? 0) &&
      Array.isArray(nextActions?.rows) &&
      nextActions.rows.length === (scaffold?.scaffoldPackages ?? blockerLedger.decisions?.length ?? 0) &&
      nextActions.rows.every(
        (row) =>
          row.publicCaptureTemplateCommand?.includes("scaffold:capture-template") &&
          row.publicTemplateAuditCommand?.includes("scaffold:template-audit") &&
          row.publicCaptureSessionCommand?.includes("scaffold:capture-session -- --source public") &&
          row.redactionTemplateCommand?.includes("scaffold:redaction-template") &&
          row.sourceCoverage?.label &&
          row.validateCommittedCaptureCommand?.includes("scaffold:validate-captures"),
      ),
    expected:
      "scaffold:next-actions compact output proves 21/21 blocker coverage and includes public capture, redaction, and validation commands",
    actual: nextActions
      ? {
          totals: nextActions.totals,
          coverage: nextActions.coverage,
          firstTargets: nextActions.rows?.slice(0, 5).map((row) => ({
            slug: row.slug,
            actionClass: row.actionClass,
            sourceCoverage: row.sourceCoverage,
            publicCaptureSessionCommand: row.publicCaptureSessionCommand,
            nextCommand: row.nextCommand,
            validateCommittedCaptureCommand: row.validateCommittedCaptureCommand,
          })),
        }
      : null,
  },
  {
    key: "official_output_public_capture_session",
    ok:
      runsByName.get("scaffold:capture-session:public")?.exitCode === 0 &&
      publicCaptureSession?.schemaVersion === "soma-reports.official-output-capture-session.v1" &&
      publicCaptureSession?.filters?.source === "public" &&
      publicCaptureSession?.filters?.sort === "public-opportunity" &&
      publicCaptureSession?.totals?.availableBlockers === (scaffold?.scaffoldPackages ?? blockerLedger.decisions?.length ?? 0) &&
      Array.isArray(publicCaptureSession?.rows) &&
      publicCaptureSession.rows.length === Math.min(5, scaffold?.scaffoldPackages ?? blockerLedger.decisions?.length ?? 0) &&
      publicCaptureSession?.totals?.publicEndpointProbeRows === publicCaptureSession.rows.length &&
      publicCaptureSession?.totals?.publicEndpointParsedRows > 0 &&
      publicCaptureSession?.totals?.publicEndpointExactReportFileRows === 0 &&
      publicCaptureSession?.totals?.publicEndpointExactOutputKeySignalRows === 0 &&
      publicCaptureSession?.totals?.publicEndpointRelatedReportFileRows >= 1 &&
      publicCaptureSession?.totals?.publicEndpointFormalFieldSignalRows >= 1 &&
      publicCaptureSession.rows.every(
        (row) =>
          row.publicTemplateCommand?.includes("scaffold:capture-template") &&
          row.publicCaptureOpportunity?.boundary?.includes("rowEvidenceReady") &&
          row.publicCaptureOpportunity?.publicEndpointBoundary?.includes("rowEvidenceReady validation") &&
          row.publicCaptureOpportunity?.publicEndpointProbe?.artifactPath?.includes("public-report-endpoint-probe-") &&
          row.publicEndpointProbe?.artifactPath?.includes("public-report-endpoint-probe-") &&
          row.publicEndpointProbe?.endpointUrl?.startsWith(publicEndpointBase) &&
          typeof row.publicEndpointProbe?.ok === "boolean" &&
          row.publicEndpointProbe?.reportFilePresent === false &&
          row.publicEndpointProbe?.reportFile === null &&
          row.publicEndpointProbe?.exactOutputKeySignals === 0 &&
          Array.isArray(row.publicEndpointProbe?.exactOutputKeySignalDetails) &&
          row.publicEndpointProbe?.promotionBoundary?.includes("rowEvidenceReady validation") &&
          row.formalGateMissing?.includes("a rowEvidenceReady official-output capture validator pass") &&
          Array.isArray(row.publicCaptureOpportunity?.safePublicSourceTypes) &&
          row.publicCaptureOpportunity.safePublicSourceTypes.length > 0,
      ) &&
      publicCaptureSession.rows.every((row, index, rows) => {
        if (index === 0) {
          return true;
        }
        return (
          (rows[index - 1].publicCaptureOpportunity?.score ?? -1) >=
          (row.publicCaptureOpportunity?.score ?? -1)
        );
      }),
    expected:
      "public capture-session compact output ranks the first blocker batch with safe public source guidance and no readiness promotion",
    actual: publicCaptureSession
      ? {
          totals: publicCaptureSession.totals,
          filters: publicCaptureSession.filters,
          firstTargets: publicCaptureSession.rows?.slice(0, 5).map((row) => ({
            slug: row.slug,
            priority: row.priority,
            opportunity: row.publicCaptureOpportunity
              ? {
                  level: row.publicCaptureOpportunity.level,
                  score: row.publicCaptureOpportunity.score,
                  endpointBoundary: row.publicCaptureOpportunity.publicEndpointBoundary,
                }
              : null,
            publicEndpointProbe: row.publicEndpointProbe
              ? {
                  artifactPath: row.publicEndpointProbe.artifactPath,
                  endpointUrl: row.publicEndpointProbe.endpointUrl,
                  ok: row.publicEndpointProbe.ok,
                  parsed: row.publicEndpointProbe.parsed,
                  reportFilePresent: row.publicEndpointProbe.reportFilePresent,
                  reportFile: row.publicEndpointProbe.reportFile,
                  exactOutputKeySignals: row.publicEndpointProbe.exactOutputKeySignals,
                  exactOutputKeySignalDetails: row.publicEndpointProbe.exactOutputKeySignalDetails,
                  formalFieldTerms: row.publicEndpointProbe.formalFieldTerms,
                  relatedReportFiles: row.publicEndpointProbe.relatedReportFiles?.length ?? 0,
                }
              : null,
            publicTemplateCommand: row.publicTemplateCommand,
          })),
        }
      : null,
  },
  {
    key: "official_output_public_endpoint_probe",
    ok:
      publicEndpointProbe?.schemaVersion === "soma-reports.public-report-endpoint-probe.v1" &&
      publicEndpointProbe?.endpointBase === publicEndpointBase &&
      publicEndpointProbe?.totals?.targets === (scaffold?.scaffoldPackages ?? blockerLedger.decisions?.length ?? 0) &&
      publicEndpointProbe?.totals?.fetched === (scaffold?.scaffoldPackages ?? blockerLedger.decisions?.length ?? 0) &&
      publicEndpointProbe?.totals?.exactReportFiles === 0 &&
      publicEndpointProbe?.totals?.exactOutputKeySignalTargets === 0 &&
      publicEndpointProbeMissingSlugs.length === 0 &&
      publicEndpointProbeExtraSlugs.length === 0 &&
      publicEndpointProbeUnexpectedUnavailableSlugs.length === 0 &&
      publicEndpointProbeRowsUsePublicReportEndpoint &&
      publicEndpointParsedRowsHaveAppProductMetadata &&
      publicEndpointProbeStoresHashOnlyText &&
      publicEndpointProbeRows.every((row) => row.promotionBoundary?.includes("rowEvidenceReady validation")) &&
      (publicEndpointProbe.relatedReportFileRows ?? []).every((row) =>
        (row.relatedReportFiles ?? []).every((related) => related.boundary?.includes("exact-package official output")),
      ),
    expected:
      "latest public endpoint probe covers all official-output blockers, uses only public report endpoints, stores hash-only text summaries plus app/product metadata, finds no exact report files/output rows, and keeps related report files non-promotional",
    actual: publicEndpointProbe
      ? {
          path: publicEndpointProbePath,
          totals: publicEndpointProbe.totals,
          missingSlugs: publicEndpointProbeMissingSlugs,
          extraSlugs: publicEndpointProbeExtraSlugs,
          unexpectedUnavailableSlugs: publicEndpointProbeUnexpectedUnavailableSlugs,
          rowsUsePublicReportEndpoint: publicEndpointProbeRowsUsePublicReportEndpoint,
          parsedRowsHaveAppProductMetadata: publicEndpointParsedRowsHaveAppProductMetadata,
          storesHashOnlyText: publicEndpointProbeStoresHashOnlyText,
          exactReportFileRows: publicEndpointProbe.exactReportFileRows,
          exactOutputKeySignalRows: publicEndpointProbe.exactOutputKeySignalRows,
          relatedReportFileRows: publicEndpointProbe.relatedReportFileRows,
        }
      : { path: publicEndpointProbePath },
  },
];

const summary = {
  schemaVersion: "soma-reports.completion-audit.v1",
  generatedAt: new Date().toISOString(),
  ok: checks.every((check) => check.ok),
  expected,
  checks,
  commandRuns: [...runResults, ...promotionVerificationRuns].map(summarizeRun),
};

const compactSummary = {
  schemaVersion: summary.schemaVersion,
  generatedAt: summary.generatedAt,
  ok: summary.ok,
  expected: summary.expected,
  failedChecks: checks.filter((check) => !check.ok).map((check) => ({
    key: check.key,
    expected: check.expected,
    actual: check.actual,
  })),
  passingChecks: checks.filter((check) => check.ok).map((check) => check.key),
  commandRuns: summary.commandRuns.map((run) => ({
    name: run.name,
    exitCode: run.exitCode,
    durationMs: run.durationMs,
    parseError: run.parseError,
    stderr: run.stderr,
  })),
};

console.log(JSON.stringify(format === "compact" ? compactSummary : summary, null, 2));

if (!summary.ok) {
  process.exit(1);
}
