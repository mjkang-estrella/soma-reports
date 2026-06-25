import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";

import { api } from "../../convex/_generated/api";
import {
  formalEvidenceDecisionFor,
  formalEvidenceTargetFor,
  officialEvidencePacketFor,
  officialEvidenceTierBoundaryFor,
  officialEvidenceTierFor,
  officialEvidenceTierLabelFor,
  officialOutputActionBoundaryFor,
  officialOutputActionClassFor,
  officialOutputCaptureCaveats,
  officialOutputNextEvidenceFor,
} from "../lib/formalEvidenceBacklog";
import { CURATION_READINESS_ITEMS, deriveAgentReadinessState } from "../lib/readiness";
import type { ReadinessAuditRow, ReportPackage } from "../lib/types";

type ReportDetailProps = {
  report: ReportPackage | null | undefined;
  readiness?: ReadinessAuditRow | null;
};

const FORMAL_FIELD_STATUS_META: Record<
  ReportPackage["formalFields"][number]["status"],
  { className: string; label: string }
> = {
  covered: { className: "ready", label: "Mapped" },
  pending: { className: "pending", label: "Unmapped" },
  not_applicable: { className: "neutral", label: "N/A" },
};

type LocalFixture = NonNullable<ReportPackage["localTestFixture"]>;
type ExampleOutputPreview = Record<string, unknown>;
type ReportRunSummary = {
  runId: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  inputManifestHash?: string;
  genomeBuild?: string;
  derivedEvidenceCount?: number;
  sampleBackedFormalReady: boolean;
  localScaffoldOnly: boolean;
  rawGenomeIncluded: boolean;
  storageBoundary: string;
  inputSummary?: {
    preparedInputPath?: string;
    derivedEvidencePath?: string;
    privacyBoundary: string;
  } | null;
  resultSummary?: {
    schemaVersion?: string;
    resultArtifactPath?: string;
    resultRows: number;
    referenceCount: number;
    appendixProbabilityCount: number;
    appendixUncertaintyCount: number;
    appendixMissingInputCount: number;
    appendixLimitationCount: number;
    validationStatus: string;
    validationProblemCount: number;
    validationWarningCount: number;
    rawGenomeIncluded: boolean;
    savedAt: number;
  } | null;
};

const resultFixtureLoaders = import.meta.glob<ExampleOutputPreview>("/fixtures/synthetic/*.result.json", { import: "default" });

const getResultFixtureLoader = (slug: string) => resultFixtureLoaders[`/fixtures/synthetic/${slug}.result.json`] ?? null;

const getPreviewArrayLength = (preview: ExampleOutputPreview | null, keys: string[]) => {
  for (const key of keys) {
    const value = preview?.[key];
    if (Array.isArray(value)) {
      return value.length;
    }
  }
  return 0;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const getRecordArray = (record: Record<string, unknown> | null, keys: string[]) => {
  for (const key of keys) {
    const value = record?.[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
};

const previewItemLabel = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.inputId ?? record.gene ?? record.item ?? record.title ?? JSON.stringify(value));
  }
  return "not supplied";
};

const formatGapLabel = (gap: string) => gap.replace(/[-_]/g, " ");
const sourceBindingStatusPlaceholder = "replace-with-exact-direct-or-official";
const sourceBindingConfirmationNotePlaceholder = "replace-with-visible-row-or-export-binding-note";
const formatRunTimestamp = (value: number | undefined) => {
  if (!value) {
    return "pending";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};
const formatBoundaryReason = (boundary: Record<string, unknown> | null | undefined) => {
  const reason = boundary?.reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
};
const captureStageClass = (stage: string | null | undefined) =>
  stage ? `evidence-status evidence-status-${stage}` : "evidence-status evidence-status-loading";
const formatOutputSignals = (signals: Record<string, boolean | number> | undefined) => {
  const entries = Object.entries(signals ?? {}).filter(([, value]) =>
    typeof value === "number" ? value > 0 : value,
  );
  return entries.length > 0
    ? entries.map(([key, value]) => `${formatGapLabel(key)} ${typeof value === "boolean" ? "yes" : value}`).join(", ")
    : "no output signals";
};

const buildDeterministicExampleOutput = (report: ReportPackage, localFixture: LocalFixture) => {
  const unavailableInputs = localFixture.genomeEvidence
    .filter((evidence) => !["matched", "available", "present"].includes(evidence.matchStatus))
    .map((evidence) => ({
      inputId: evidence.inputId,
      gene: evidence.gene,
      observedValue: evidence.observedValue,
      matchStatus: evidence.matchStatus,
    }));

  const findings =
    report.sampleRows.length > 0
      ? report.sampleRows.map((row) => ({
          groupTitle: row.groupTitle,
          item: row.item,
          brandName: row.brandName || null,
          geneticAnalysis: row.geneticAnalysis,
          description: row.description ?? null,
          genes: row.genes,
          sourceLabel: row.sourceLabel,
          sourceIds: row.sourceResourceIds ?? [],
          sourceBindingStatus: row.sourceBindingStatus ?? "unavailable",
          plainEnglishMeaning: row.sourceBindingNote ?? "Use the source-bound sample row as the report structure.",
        }))
      : localFixture.genomeEvidence.map((evidence) => ({
          groupTitle: "Genome evidence",
          item: evidence.gene,
          brandName: null,
          geneticAnalysis: evidence.observedValue,
          description: `${evidence.inputId} on ${evidence.assembly}`,
          genes: [evidence.gene],
          sourceLabel: evidence.sourceArtifact ?? "fixture.genomeEvidence",
          sourceIds: [],
          sourceBindingStatus: evidence.matchStatus,
          plainEnglishMeaning: "Report-specific sample rows are pending; this preview exposes derived fixture evidence only.",
        }));

  return {
    schemaVersion: "soma-reports.example-output.v1",
    packageSlug: report.slug,
    reportTitle: report.title,
    generatedFrom: {
      fixtureDatasetId: localFixture.datasetId,
      packageVersion: localFixture.packageVersion,
      inputManifestHash: localFixture.inputManifest.hash,
      genomeBuild: localFixture.inputManifest.genomeBuild,
      promptHash: report.prompt?.promptHash ?? null,
      outputFormatHash: report.prompt?.outputFormatHash ?? null,
    },
    report: {
      purpose: localFixture.reportPurpose ?? report.summary,
      claimScope: report.claimScope,
      sections: report.outputSections.map((section) => ({
        title: section.title,
        purpose: section.purpose,
        requiredFields: section.expectedFields.filter((field) => field.required).map((field) => field.key),
      })),
    },
    findings,
    citations: localFixture.referenceResources.map((reference) => ({
      id: reference.id,
      title: reference.title,
      sourceType: reference.sourceType,
      evidenceLevel: reference.evidenceLevel,
      usedFor: reference.usedFor,
    })),
    appendix: {
      genotypeSummary: report.genotypeSummary.map((row) => ({
        tier: row.tier,
        gene: row.gene,
        variantId: row.variantId,
        genotype: row.genotype,
        effect: row.effect,
        phenotype: row.phenotype,
      })),
      missingInputs: unavailableInputs,
      probabilities: [],
      uncertainty: [
        "No probability values appear in main findings.",
        "Quantitative confidence or calibration belongs in the appendix only when a validated source supplies it.",
        localFixture.missingInputPolicy ?? "Missing inputs are reported as unavailable rather than imputed.",
      ],
      limitations: [
        localFixture.missingInputPolicy ?? "Missing inputs are reported as unavailable rather than imputed.",
        "This example uses synthetic derived evidence and does not include raw genome records.",
      ],
    },
    audit: {
      rawGenomeIncluded: false,
      deterministic: true,
      everyFindingRequiresReference: localFixture.expectedAssertions?.everyFindingHasReference === true,
      probabilitiesOnlyInAppendix: localFixture.expectedAssertions?.probabilitiesOnlyInAppendix === true,
    },
  };
};

export function ReportDetail({ report, readiness }: ReportDetailProps) {
  const reportSlug = report?.slug ?? null;
  const [resultFixturePreview, setResultFixturePreview] = useState<ExampleOutputPreview | null>(null);
  const [isResultFixtureLoading, setIsResultFixtureLoading] = useState(false);
  const [runLedgerStatus, setRunLedgerStatus] = useState<string | null>(null);
  const [isCreatingRunDraft, setIsCreatingRunDraft] = useState(false);
  const [isSavingRunResult, setIsSavingRunResult] = useState(false);
  const reportRuns = useQuery(api.reportRuns.listForReport, reportSlug ? { reportSlug, limit: 5 } : "skip") as
    | ReportRunSummary[]
    | undefined;
  const createRunDraft = useMutation(api.reportRuns.createDraft);
  const saveRunResultSummary = useMutation(api.reportRuns.saveResultSummary);

  useEffect(() => {
    if (!reportSlug) {
      setResultFixturePreview(null);
      setIsResultFixtureLoading(false);
      return;
    }

    const loader = getResultFixtureLoader(reportSlug);
    if (!loader) {
      setResultFixturePreview(null);
      setIsResultFixtureLoading(false);
      return;
    }

    let isCurrent = true;
    setResultFixturePreview(null);
    setIsResultFixtureLoading(true);

    loader()
      .then((preview) => {
        if (isCurrent) {
          setResultFixturePreview(preview);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setResultFixturePreview(null);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsResultFixtureLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [reportSlug]);

  if (report === undefined) {
    return (
      <section id="report-detail" className="theme-light detail-wrapper container" aria-busy="true">
        <div className="empty-state">Loading report package...</div>
      </section>
    );
  }

  if (report === null) {
    return (
      <section id="report-detail" className="theme-light detail-wrapper container">
        <div className="empty-state">Select a report package to inspect its prompt and output schema.</div>
      </section>
    );
  }

  const promptReady = Boolean(report.prompt && report.curationCompleteness.prompt);
  const localFixture = report.localTestFixture;
  const deterministicExampleOutput: ExampleOutputPreview | null =
    resultFixturePreview ?? (isResultFixtureLoading ? null : localFixture ? buildDeterministicExampleOutput(report, localFixture) : null);
  const deterministicExampleSource = resultFixturePreview ? "fixture result artifact" : "generated package preview";
  const deterministicExampleRows = getPreviewArrayLength(deterministicExampleOutput, ["resultRows", "findings"]);
  const exampleAppendix = asRecord(deterministicExampleOutput?.appendix);
  const appendixProbabilities = getRecordArray(exampleAppendix, ["probabilities"]);
  const appendixUncertainty = getRecordArray(exampleAppendix, ["uncertainty"]);
  const appendixMissingInputs = getRecordArray(exampleAppendix, ["missingInputs", "missingOrUnavailableInputs"]);
  const appendixLimitations = getRecordArray(exampleAppendix, ["limitations"]);
  const expectedAssertions = localFixture?.expectedAssertions;
  const referenceProvenance = report.references.filter(
    (reference) => reference.sourceArtifact || reference.accessedAt || reference.contentHash,
  );
  const runSafeguards = [
    {
      label: "Audience",
      value: report.audience || "general customer",
    },
    {
      label: "Consumer tone",
      value: localFixture?.consumerTone ?? "plain English required by prompt",
    },
    {
      label: "Raw genome",
      value: localFixture?.inputManifest.rawGenomeReturned === false ? "not returned" : "not yet verified",
    },
    {
      label: "Probability",
      value: expectedAssertions?.probabilitiesOnlyInAppendix ? "appendix only" : "review appendix policy",
    },
    {
      label: "Citation policy",
      value: expectedAssertions?.everyFindingHasReference ? "every finding cited" : "citation review pending",
    },
  ];
  const readinessDeclaredGaps = readiness
    ? [...new Set([...readiness.declaredGaps, ...readiness.formalReportDeclaredGaps])]
    : [];
  const readinessDerivedGaps = readiness?.derivedGaps ?? [];
  const readinessState = deriveAgentReadinessState(report, readiness);
  const formalEvidenceDecision = formalEvidenceDecisionFor(report.slug);
  const formalEvidenceTarget = formalEvidenceTargetFor(report.slug);
  const coveredFormalFieldCount = report.formalFields.filter((field) => field.status !== "pending").length;
  const pendingFormalFieldCount = report.formalFields.filter((field) => field.status === "pending").length;
  const citedSampleRowCount = report.sampleRows.filter((row) => {
    return (
      row.sourceBindingStatus !== "unavailable" &&
      Array.isArray(row.sourceResourceIds) &&
      row.sourceResourceIds.length > 0
    );
  }).length;
  const localAgentReadiness = {
    schemaVersion: "soma-reports.agent-readiness.v1",
    evidenceStatus: readinessState.evidenceStatus,
    label: readinessState.label,
    formalEquivalentReady: readinessState.formalEquivalentReady,
    sampleBackedFormalReady: readinessState.sampleBackedFormalReady,
    localScaffoldOnly: readinessState.localScaffoldOnly,
    evidenceCounts: {
      references: readiness?.evidence.references ?? report.references.length,
      outputSections: readiness?.evidence.outputSections ?? report.outputSections.length,
      formalFields: readiness?.evidence.formalFields ?? report.formalFields.length,
      coveredFormalFields: coveredFormalFieldCount,
      pendingFormalFields: pendingFormalFieldCount,
      sampleRows: readiness?.evidence.sampleRows ?? report.sampleRows.length,
      sourceBackedSampleRows: report.sampleRows.length,
      citedSampleRows: citedSampleRowCount,
      genotypeSummaryRows: readiness?.evidence.genotypeSummaryRows ?? report.genotypeSummary.length,
      exactCitationRows: readiness?.evidence.exactCitationRows ?? 0,
    },
    gaps: [...new Set([...readinessDeclaredGaps, ...readinessDerivedGaps])],
    usageBoundary: readinessState.usageBoundary,
    formalEvidenceBlocker: formalEvidenceDecision
      ? {
          decision: formalEvidenceDecision.decision,
          evidenceStatus: formalEvidenceDecision.evidenceStatus,
          routeBehavior: formalEvidenceDecision.routeBehavior,
          reportFileStatus: formalEvidenceDecision.reportFileStatus,
          reason: formalEvidenceDecision.reason,
          requiredEvidenceForPromotion: formalEvidenceDecision.requiredEvidenceForPromotion,
          sources: formalEvidenceDecision.sources,
        }
      : null,
  };
  const localAgentInput =
    report.prompt && localFixture && report.curationCompleteness.prompt
      ? {
          schemaVersion: "soma-reports.local-agent-input.v1",
          reportSlug: report.slug,
          reportTitle: report.title,
          readiness: localAgentReadiness,
          reportPurpose: localFixture.reportPurpose ?? report.summary,
          prompt: report.prompt.deterministicPrompt,
          promptMetadata: {
            title: report.prompt.title,
            promptVersion: report.prompt.promptVersion ?? null,
            promptHash: report.prompt.promptHash ?? null,
            outputFormatHash: report.prompt.outputFormatHash ?? null,
            inputContract: report.prompt.inputContract,
            outputContract: report.prompt.outputContract,
            appendixPolicy: report.prompt.appendixPolicy,
            probabilityDisclosure: report.prompt.probabilityDisclosure,
            safetyNotes: report.prompt.safetyNotes,
          },
          privacyBoundary: {
            rawGenomeIncluded: false,
            derivedEvidenceOnly: true,
            uploadRequired: false,
          },
          fixture: {
            ...localFixture,
            packageSlug: localFixture.packageSlug ?? report.slug,
          },
          formalArtifacts: {
            references: report.references,
            outputSections: report.outputSections,
            formalFields: report.formalFields,
            sampleRows: report.sampleRows,
            genotypeSummary: report.genotypeSummary,
            sourceArtifacts: report.sourceArtifacts,
          },
          exampleOutput: deterministicExampleOutput,
          outputValidation: {
            schemaVersion: "soma-reports.output-validation.v1",
            usageBoundary: readinessState.usageBoundary,
            cliWarningLedger:
              "Run npm run agent:validate for the full validation ledger; the browser preview does not include every CLI warning.",
            checks: [
              "Every main finding is linked to a reference resource or marked unavailable.",
              "Every result row preserves covered resultRows[] fields from the formal map, including description when mapped.",
              "Raw genome records are excluded from the final output.",
              "appendix.probabilities[], appendix.uncertainty[], appendix.missingInputs[], and appendix.limitations[] are present.",
              "Probabilities, confidence values, and uncertainty text are kept out of main findings.",
              "Missing input behavior follows fixture.missingInputPolicy.",
            ],
          },
          artifactPaths: {
            prompt: `prompts/${report.slug}.md`,
            fixture: `fixtures/synthetic/${report.slug}.fixture.json`,
            deterministicResult: `fixtures/synthetic/${report.slug}.result.json`,
            sourceArtifacts: report.sourceArtifacts,
          },
          agentInstructions: [
            "Use the prompt exactly as supplied unless the user explicitly asks for edits.",
            "Use fixture.genomeEvidence, fixture.referenceResources, and formalArtifacts as evidence.",
            "When formalArtifacts.sampleRows are present, preserve their report structure and source bindings.",
            "Return deterministic report JSON first.",
            "Put probability, confidence, uncertainty, missing-input, and limitation disclosures in the appendix only.",
            "Do not include raw genome data in output.",
          ],
        }
      : null;
  const uiAgentManifest = localAgentInput
    ? {
        schemaVersion: "soma-reports.ui-agent-manifest.v1",
        note: "UI review manifest for the local-agent payload. Use npm run agent:validate for exact CLI bundle hashes and auditManifest.",
        reportSlug: report.slug,
        reportTitle: report.title,
        readiness: localAgentReadiness,
        artifactPaths: localAgentInput.artifactPaths,
        privacyBoundary: localAgentInput.privacyBoundary,
        manifestHashes: {
          promptHash: report.prompt?.promptHash ?? null,
          outputFormatHash: report.prompt?.outputFormatHash ?? null,
          fixtureInputManifestHash: localFixture?.inputManifest.hash ?? null,
        },
        payloadShape: {
          references: report.references.length,
          outputSections: report.outputSections.length,
          formalFields: report.formalFields.length,
          coveredFormalFields: coveredFormalFieldCount,
          pendingFormalFields: pendingFormalFieldCount,
          sampleRows: report.sampleRows.length,
          citedSampleRows: citedSampleRowCount,
          genotypeSummary: report.genotypeSummary.length,
          sourceArtifacts: report.sourceArtifacts.length,
        },
        outputValidation: localAgentInput.outputValidation,
      }
    : null;
  const localBundlePath = `tmp/agent-bundles/${report.slug}.validated.json`;
  const localEvidenceTemplatePath = `tmp/evidence-templates/${report.slug}.derived-evidence-template.json`;
  const localFilledEvidencePath = `tmp/evidence-templates/${report.slug}.filled-derived-evidence.json`;
  const localAgentInputPath = `tmp/agent-runs/${report.slug}.agent-input.json`;
  const localAgentResultPath = `tmp/agent-runs/${report.slug}.agent-result.json`;
  const localAgentValidationPath = `tmp/agent-runs/${report.slug}.validation.json`;
  const localValidationCommand = uiAgentManifest
    ? `npm run agent:validate -- --report ${report.slug} --fixture ${uiAgentManifest.artifactPaths.fixture} --result ${uiAgentManifest.artifactPaths.deterministicResult} --out ${localBundlePath}`
    : null;
  const officialOutputCaptureStatus = formalEvidenceTarget?.captureStatus ?? null;
  const officialOutputPromotionReview = officialOutputCaptureStatus?.officialOutputPromotionReview ?? null;
  const officialEvidencePacket = officialEvidencePacketFor(formalEvidenceTarget);
  const officialEvidenceTier = officialEvidenceTierFor(officialOutputCaptureStatus);
  const officialEvidenceTierLabel = officialEvidenceTierLabelFor(officialOutputCaptureStatus);
  const officialEvidenceTierBoundary = officialEvidenceTierBoundaryFor(officialOutputCaptureStatus);
  const officialBoundaryModel = officialOutputCaptureStatus?.officialBoundaryModel ?? null;
  const officialOutputReviewEvidencePresent = officialOutputCaptureStatus?.officialOutputReviewEvidencePresent ?? [];
  const officialOutputReviewEvidenceMissing = officialOutputCaptureStatus?.officialOutputReviewEvidenceMissing ?? [];
  const officialOutputActionClass = officialOutputActionClassFor(officialOutputCaptureStatus);
  const officialOutputActionBoundary = officialOutputActionBoundaryFor(officialOutputCaptureStatus);
  const officialOutputNextEvidence = officialOutputNextEvidenceFor(officialOutputCaptureStatus);
  const officialOutputDetailInspection =
    formalEvidenceTarget?.liveDetailInspection ?? officialOutputCaptureStatus?.liveDetailInspection ?? null;
  const officialOutputLatestRouteProbe = officialOutputCaptureStatus?.latestRouteProbe ?? null;
  const officialOutputPublicBundleEvidence = officialOutputCaptureStatus?.publicBundleEvidence ?? null;
  const officialOutputRedactionInputPath =
    officialOutputCaptureStatus?.redactionInputPath ?? formalEvidenceTarget?.redactionInputPath ?? null;
  const officialOutputCaptureTemplateCommand = formalEvidenceTarget?.templateCommand ?? null;
  const officialOutputPublicCaptureSessionCommand = formalEvidenceTarget
    ? `npm run scaffold:capture-session -- --source public --report ${report.slug} --format md --out tmp/official-output-capture-session-${report.slug}.md`
    : null;
  const officialOutputPrivateCaptureSessionCommand = formalEvidenceTarget
    ? `npm run scaffold:capture-session -- --source private --report ${report.slug} --format md --out tmp/official-output-capture-session-${report.slug}-private.md`
    : null;
  const officialOutputCombinedCaptureSessionCommand = formalEvidenceTarget
    ? `npm run scaffold:capture-session -- --source both --report ${report.slug} --format md --out tmp/official-output-capture-session-${report.slug}.md`
    : null;
  const officialOutputRedactionTemplateCommand =
    officialOutputCaptureStatus?.redactionTemplateCommand ?? formalEvidenceTarget?.redactionTemplateCommand ?? null;
  const officialOutputDryRunSanitizeCommand =
    officialOutputCaptureStatus?.dryRunSanitizeCommand ?? formalEvidenceTarget?.dryRunSanitizeCommand ?? null;
  const officialOutputSanitizeRedactionCommand =
    officialOutputCaptureStatus?.sanitizeDraftCommand ??
    officialOutputCaptureStatus?.sanitizeRedactionCommand ??
    formalEvidenceTarget?.sanitizeRedactionCommand ??
    null;
  const officialOutputSanitizedDraftPath =
    officialOutputCaptureStatus?.sanitizedDraftArtifactPath ?? formalEvidenceTarget?.sanitizedDraftArtifactPath ?? null;
  const officialOutputCommittedCapturePath =
    officialOutputCaptureStatus?.committedCapturePath ?? formalEvidenceTarget?.expectedSanitizedArtifactPath ?? null;
  const officialOutputCommitCaptureCommand =
    officialOutputCaptureStatus?.commitSanitizedCaptureCommand ??
    formalEvidenceTarget?.commitSanitizedCaptureCommand ??
    null;
  const officialOutputCaptureValidationCommand =
    officialOutputCaptureStatus?.validateCommittedCaptureCommand ??
    officialOutputCaptureStatus?.validationCommandForExpectedCapture ??
    (formalEvidenceTarget
      ? `npm run scaffold:validate-captures -- --path ${formalEvidenceTarget.expectedSanitizedArtifactPath}`
      : null);
  const officialOutputDraftCaptureValidationCommand =
    officialOutputCaptureStatus?.validateDraftCaptureCommand ??
    (officialOutputSanitizedDraftPath
      ? `npm run scaffold:validate-captures -- --path ${officialOutputSanitizedDraftPath}`
      : null);
  const officialOutputCanPreviewPromotion =
    (officialOutputCaptureStatus?.rowEvidencePromotionReadyCaptures ??
      officialOutputCaptureStatus?.promotionCandidates ??
      0) > 0;
  const officialOutputPromotionPreviewCommand = officialOutputCanPreviewPromotion
    ? officialOutputCaptureStatus?.promotionPreviewCommittedCommand ?? formalEvidenceTarget?.promotionPreviewCommand ?? null
    : null;
  const officialOutputCaptureNextCommand =
    officialOutputCaptureStatus?.nextCommand ??
    officialOutputCaptureTemplateCommand ??
    officialOutputRedactionTemplateCommand ??
    officialOutputDryRunSanitizeCommand ??
    officialOutputSanitizeRedactionCommand ??
    officialOutputCaptureValidationCommand;
  const officialOutputCaptureArtifactSummaries =
    officialOutputCaptureStatus?.officialCaptureArtifactSummaries ?? [];
  const officialOutputFormalGate = officialOutputCaptureStatus?.formalReadinessGate ?? null;
  const officialOutputCaptureCandidatePath =
    officialOutputCaptureStatus?.outputSignalReviewCapturePaths?.[0] ??
    officialOutputCaptureStatus?.promotionCandidateCapturePaths?.[0] ??
    null;
  const officialOutputTemplateSourceId = `${report.slug}-official-output-source`;
  const officialOutputCaptureArtifactTemplate = formalEvidenceTarget
    ? {
        schema: formalEvidenceTarget.expectedCaptureSchema,
        slug: report.slug,
        title: report.title,
        capturedAt: "replace-with-ISO-capture-timestamp",
        captureUrl: formalEvidenceTarget.captureUrl ?? `https://sequencing.com/marketplace/${report.slug}`,
        sourceKind: "replace-with-official-sample-report-or-completed-output",
        privacyBoundary: {
          rawGenomeIncluded: false,
          privateValuesRedacted: true,
          commitSafe: true,
          notes:
            "Commit only sanitized field names, row structure, source ids, and row-level bindings. Keep full private completed reports outside this repository.",
        },
        reportFile: "",
        sourceArtifacts: formalEvidenceTarget.captureUrl ? [formalEvidenceTarget.captureUrl] : [],
        sourceResources: [
          {
            id: officialOutputTemplateSourceId,
            title: `${report.title} official output source`,
            sourceType: "official_output",
            url: formalEvidenceTarget.captureUrl ?? `https://sequencing.com/marketplace/${report.slug}`,
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
            observedField: "replace-with-official-output-field",
            sourceResourceIds: [officialOutputTemplateSourceId],
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
              official_output_field: "replace-with-official-output-value-or-redacted-structure",
            },
            sourceResourceIds: [officialOutputTemplateSourceId],
            sourceBindingStatus: sourceBindingStatusPlaceholder,
            sourceBindingConfirmed: false,
            sourceBindingConfirmationNote: sourceBindingConfirmationNotePlaceholder,
          },
        ],
        formalFields:
          formalEvidenceTarget.describedOutputFields.length > 0
            ? formalEvidenceTarget.describedOutputFields.map((field, index) => ({
                key: field.replace(/\W+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || `field_${index + 1}`,
                label: field,
                observedField: field,
                outputPath: `replace-with-output-path-${index + 1}`,
                status: "covered",
                sourceResourceIds: [officialOutputTemplateSourceId],
                sourceBindingStatus: sourceBindingStatusPlaceholder,
                sourceBindingConfirmed: false,
                sourceBindingConfirmationNote: sourceBindingConfirmationNotePlaceholder,
                sourceLabel: officialOutputTemplateSourceId,
              }))
            : [
                {
                  key: "replace_with_field_key",
                  label: "replace-with-field-label",
                  observedField: "replace-with-observed-field",
                  outputPath: "replace-with-output-path",
                  status: "covered",
                  sourceResourceIds: [officialOutputTemplateSourceId],
                  sourceBindingStatus: sourceBindingStatusPlaceholder,
                  sourceBindingConfirmed: false,
                  sourceBindingConfirmationNote: sourceBindingConfirmationNotePlaceholder,
                  sourceLabel: officialOutputTemplateSourceId,
                },
              ],
        citationBindings: [
          {
            rowId: "replace-with-official-row-id",
            sourceResourceIds: [officialOutputTemplateSourceId],
            sourceBindingStatus: sourceBindingStatusPlaceholder,
            sourceBindingConfirmed: false,
            sourceBindingConfirmationNote: sourceBindingConfirmationNotePlaceholder,
          },
          {
            rowId: "replace-with-official-result-row-id",
            sourceResourceIds: [officialOutputTemplateSourceId],
            sourceBindingStatus: sourceBindingStatusPlaceholder,
            sourceBindingConfirmed: false,
            sourceBindingConfirmationNote: sourceBindingConfirmationNotePlaceholder,
          },
        ],
        validationCommands: [
          officialOutputPublicCaptureSessionCommand,
          officialOutputCaptureTemplateCommand,
          formalEvidenceTarget ? `npm run scaffold:template-audit -- --report ${report.slug}` : null,
          officialOutputPrivateCaptureSessionCommand,
          officialOutputCaptureNextCommand,
          officialOutputCaptureValidationCommand,
          ...formalEvidenceTarget.validationCommands.filter((command) => command !== officialOutputCaptureValidationCommand),
        ]
          .filter((command): command is string => Boolean(command))
          .filter((command, index, commands) => commands.indexOf(command) === index),
      }
    : null;
  const prepareScaffoldFlag = readinessState.localScaffoldOnly ? " --allow-local-scaffold true" : "";
  const localWorkflowCheckCommand = `npm run agent:workflow-check -- --report ${report.slug} --bundle ${localBundlePath} --evidence ${localFilledEvidencePath} --input ${localAgentInputPath} --result ${localAgentResultPath}${prepareScaffoldFlag}`;
  const localWorkflowStrictCheckCommand = `${localWorkflowCheckCommand} --strict true`;
  const localOneCommandRun = [
    "SOMA_LOCAL_GENOME=/absolute/path/to/local-genome.vcf.gz",
    `npm run agent:prepare-local -- --report ${report.slug} --vcf "$SOMA_LOCAL_GENOME" --assembly GRCh38 --out-dir tmp/local-runs/${report.slug} --format compact${prepareScaffoldFlag}`,
    "# Optional: add --runner-command \"$SOMA_LOCAL_RUNNER\" after setting SOMA_LOCAL_RUNNER to a local JSON runner.",
  ].join("\n");
  const localRunnerExampleCommand = [
    "SOMA_LOCAL_RUNNER=/absolute/path/to/local-json-runner",
    `"$SOMA_LOCAL_RUNNER" < ${localAgentInputPath} > ${localAgentResultPath}`,
  ].join("\n");
  const deterministicLocalResultCommand = `npm run agent:generate-local-result -- --input ${localAgentInputPath} --out ${localAgentResultPath} --format compact`;
  const localRunWorkflow = uiAgentManifest
    ? [
        {
          label: "Check workflow plan",
          command: localWorkflowCheckCommand,
          purpose:
            "Read-only preflight: verify source artifacts, show missing generated files as warnings, and print the exact local-run command plan without writing tmp outputs.",
        },
        {
          label: "One-command VCF run",
          command: localOneCommandRun,
          purpose:
            "Build or reuse the bundle, export the evidence template, derive local VCF/gVCF observations, prepare the local-agent input, and stop before model execution unless a runner command or deterministic-result flag is supplied.",
        },
        {
          label: "Build validated bundle",
          command: [
            "npm run agent:seed-cache",
            `npm run agent:bundle -- --report ${report.slug} --fixture ${uiAgentManifest.artifactPaths.fixture} --result ${uiAgentManifest.artifactPaths.deterministicResult} --out ${localBundlePath}`,
            "# To rebuild every report bundle instead, run npm run agent:export.",
          ].join("\n"),
          purpose:
            "Refresh the local artifact cache and this report's validated bundle before creating a private run payload.",
        },
        {
          label: "Refresh rsID coordinate map",
          command: "npm run agent:update-rsid-coordinate-map",
          purpose:
            "Add RefSNP coordinates for rsID rows so local VCF/gVCF derivation can recover ID=. records and END= reference blocks.",
        },
        {
          label: "Create derived-evidence template",
          command: `npm run agent:evidence-template -- --report ${report.slug} --bundle ${localBundlePath} --out ${localEvidenceTemplatePath}`,
          purpose: "Generate the rows your local parser should fill without copying raw genome records into the app.",
        },
        {
          label: "Derive local VCF/gVCF evidence",
          command: [
            "SOMA_LOCAL_GENOME=/absolute/path/to/local-genome.vcf.gz",
            `npm run agent:derive-evidence -- --template ${localEvidenceTemplatePath} --vcf "$SOMA_LOCAL_GENOME" --out ${localFilledEvidencePath}`,
            "# If the VCF build differs from the exported template, add --assembly GRCh37 or --assembly GRCh38.",
          ].join("\n"),
          purpose: "Fill rsID and optional coordinate rows from a local VCF/gVCF while leaving raw records and raw file paths out of the output.",
        },
        {
          label: "Prepare local-agent payload",
          command: `npm run agent:prepare -- --report ${report.slug} --bundle ${localBundlePath} --evidence ${localFilledEvidencePath} --out ${localAgentInputPath}${prepareScaffoldFlag}`,
          purpose:
            "Package the prompt, references, schema, formal artifacts, and complete derived evidence. Missing template rows fail unless --allow-partial true is explicit; scaffold-only packages require --allow-local-scaffold true; the prepared JSON still contains sensitive derived genome observations.",
        },
        {
          label: "Generate deterministic result",
          command: [
            deterministicLocalResultCommand,
            "# Equivalent one-command option: add --deterministic-result true to agent:prepare-local.",
          ].join("\n"),
          purpose:
            "Create a no-model local JSON result scaffold from the prepared input, mirror local observations into the appendix, include observed values in customer-facing rows, and keep probability language in appendix sections.",
        },
        {
          label: "Run local AI agent",
          command: [
            `# Give ${localAgentInputPath} only to a trusted runner/model.`,
            "# It excludes raw VCF data but still contains sensitive derived genome evidence.",
            "# Example local-only handoff; replace SOMA_LOCAL_RUNNER with a JSON runner you control on this machine.",
            localRunnerExampleCommand,
            `# Save the JSON-only response as ${localAgentResultPath}`,
          ].join("\n"),
          purpose:
            "This app does not call a model; your chosen runner/model receives the prepared JSON and produces the result that validation checks.",
        },
        {
          label: "Check completed artifacts",
          command: localWorkflowStrictCheckCommand,
          purpose:
            "Read-only strict check after the runner returns JSON. Missing bundle, derived evidence, prepared input, or result files fail here before validation.",
        },
        {
          label: "Validate returned report",
          command: [
            `npm run agent:validate-run -- --input ${localAgentInputPath} --result ${localAgentResultPath}`,
            "# Optional saved ledger:",
            `npm run agent:validate-run -- --input ${localAgentInputPath} --result ${localAgentResultPath} --out ${localAgentValidationPath}`,
          ].join("\n"),
          purpose:
            "Check-only validation prints the full ledger without writing. Add --out only when you want to save the validation artifact.",
        },
      ]
    : [];
  const localRunWorkflowCommandText = localRunWorkflow.map((step) => step.command).join("\n");
  const localAgentInputReady = Boolean(localAgentInput && deterministicExampleOutput);
  const localAgentInputBlockers = [
    !report.prompt ? "prompt package missing" : null,
    report.prompt && !promptReady ? "prompt not marked ready" : null,
    !localFixture ? "local fixture missing" : null,
    !deterministicExampleOutput
      ? isResultFixtureLoading
        ? "deterministic output loading"
        : "deterministic output missing"
      : null,
  ].filter((reason): reason is string => Boolean(reason));
  const copyAgentInputLabel = readinessState.localScaffoldOnly ? "Copy scaffold JSON" : "Copy synthetic review JSON";
  const readinessGapCount = readiness
    ? new Set([...readinessDeclaredGaps, ...readinessDerivedGaps]).size
    : report.curationCompleteness.notes.length;

  const copyPrompt = async () => {
    if (!report.prompt || !promptReady) {
      return;
    }
    await navigator.clipboard.writeText(report.prompt.deterministicPrompt);
  };

  const copyFixture = async () => {
    if (!report.localTestFixture) {
      return;
    }
    await navigator.clipboard.writeText(
      JSON.stringify({ ...report.localTestFixture, packageSlug: report.localTestFixture.packageSlug ?? report.slug }, null, 2),
    );
  };

  const copyLocalAgentInput = async () => {
    if (!localAgentInput || !deterministicExampleOutput) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(localAgentInput, null, 2));
  };

  const copyManifest = async () => {
    if (!uiAgentManifest) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(uiAgentManifest, null, 2));
  };

  const copyFormalEvidenceBlocker = async () => {
    if (!formalEvidenceDecision) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(formalEvidenceDecision, null, 2));
  };

  const copyOfficialOutputCaptureTask = async () => {
    if (!formalEvidenceTarget) {
      return;
    }
    await navigator.clipboard.writeText(
      JSON.stringify(
        {
          schemaVersion: "soma-reports.official-output-capture-task.v1",
          reportSlug: report.slug,
          reportTitle: report.title,
          liveDetailInspection: officialOutputDetailInspection,
          captureTask: formalEvidenceTarget,
        },
        null,
        2,
      ),
    );
  };

  const copyOfficialOutputNextCommand = async () => {
    if (!officialOutputCaptureNextCommand) {
      return;
    }
    await navigator.clipboard.writeText(officialOutputCaptureNextCommand);
  };

  const copyOfficialOutputCaptureTemplate = async () => {
    if (!officialOutputCaptureArtifactTemplate) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(officialOutputCaptureArtifactTemplate, null, 2));
  };

  const copyOfficialEvidencePacket = async () => {
    if (!officialEvidencePacket) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(officialEvidencePacket, null, 2));
  };

  const copyOfficialOutputRedactionWorkflow = async () => {
    if (!formalEvidenceTarget) {
      return;
    }
    const committedCapturePath = officialOutputCommittedCapturePath ?? formalEvidenceTarget.expectedSanitizedArtifactPath;
    await navigator.clipboard.writeText(
      [
        "# Official output capture -> seed promotion checklist",
        "# Stop before editing seed files unless validate-captures reports rowEvidenceReady: true.",
        officialOutputDetailInspection?.apiAppId
          ? `# Sequencing app ID: ${officialOutputDetailInspection.apiAppId}`
          : "# Sequencing app ID: not exposed in the latest safe detail inspection",
        officialOutputDetailInspection?.startButtonText
          ? `# Marketplace action: ${officialOutputDetailInspection.startButtonText}`
          : "# Marketplace action: not exposed in the latest safe detail inspection",
        "",
        "# 1. Public/non-private official sample, reportFile, or export path.",
        officialOutputPublicCaptureSessionCommand,
        officialOutputCaptureTemplateCommand,
        formalEvidenceTarget ? `npm run scaffold:template-audit -- --report ${report.slug}` : null,
        `# Fill ${formalEvidenceTarget.captureTemplatePath} only from a public/non-private official source or already sanitized completed-output structure.`,
        "",
        "# 2. Private completed-output path; create the ignored private redaction input.",
        officialOutputPrivateCaptureSessionCommand,
        officialOutputRedactionTemplateCommand,
        `# Fill ${officialOutputRedactionInputPath} from a private completed Sequencing.com output after manual redaction.`,
        "",
        "# 3. Sanitize private captures to ignored tmp output first.",
        officialOutputDryRunSanitizeCommand,
        officialOutputSanitizeRedactionCommand,
        officialOutputDraftCaptureValidationCommand,
        "",
        "# 4. Commit only a capture that validates with rowEvidenceReady: true.",
        officialOutputCombinedCaptureSessionCommand,
        officialOutputCommitCaptureCommand,
        officialOutputCaptureValidationCommand,
        "npm run scaffold:capture-status:snapshot",
        "",
        ...(officialOutputCanPreviewPromotion
          ? [
              "# 5. Generate the promotion brief, then apply its seedFragment manually.",
              officialOutputPromotionPreviewCommand,
              `npm run scaffold:promotion-preview -- --path ${committedCapturePath} --format md --out tmp/promotion-previews/${report.slug}.md`,
              "# Apply the reviewed seedFragment to convex/reportPackages.ts.",
              `# Synchronize prompts/${report.slug}.md, fixtures/synthetic/${report.slug}.fixture.json, and fixtures/synthetic/${report.slug}.result.json.`,
              `npm run scaffold:promotion-verify -- --path ${committedCapturePath}`,
            ]
          : [
              "# 4. Stop before promotion preview until validate-captures reports rowEvidenceReady: true.",
              "# Current capture can be reviewed as an output-shape signal only; do not edit seed files from it.",
            ]),
        "",
        "# 5. Remove the blocker ledger entry only after promotion verification passes and readiness no longer reports this slug as local scaffold.",
        "npm run readiness:audit:summary",
        "# Then remove the slug from reference/catalog/sample-promotion-rejections-2026-06-23.json.",
        "",
        "# 6. Run the formal and project gates.",
        `npm run agent:bundle -- --report ${report.slug} --fixture fixtures/synthetic/${report.slug}.fixture.json --result fixtures/synthetic/${report.slug}.result.json --validation-mode formal-ready`,
        "npm run scaffold:evidence-audit",
        "npm run readiness:audit:summary",
        "npm run agent:assert-sync",
        "npm run completion:audit -- --format compact",
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    );
  };

  const copyLocalValidationCommand = async () => {
    if (!localValidationCommand) {
      return;
    }
    await navigator.clipboard.writeText(localValidationCommand);
  };

  const copyLocalRunWorkflow = async () => {
    if (!localRunWorkflowCommandText) {
      return;
    }
    await navigator.clipboard.writeText(localRunWorkflowCommandText);
  };

  const copyExampleOutput = async () => {
    if (!deterministicExampleOutput) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(deterministicExampleOutput, null, 2));
  };

  const buildRunDraftPayload = () => ({
    reportSlug: report.slug,
    reportTitle: report.title,
    packageVersion: report.version,
    ...(report.prompt?.promptHash ? { promptHash: report.prompt.promptHash } : {}),
    ...(report.prompt?.outputFormatHash ? { outputFormatHash: report.prompt.outputFormatHash } : {}),
    ...(localFixture?.inputManifest.hash ? { inputManifestHash: localFixture.inputManifest.hash } : {}),
    ...(localFixture?.inputManifest.genomeBuild ? { genomeBuild: localFixture.inputManifest.genomeBuild } : {}),
    ...(localFixture ? { derivedEvidenceCount: localFixture.genomeEvidence.length } : {}),
    ...(appendixMissingInputs.length > 0 ? { missingInputCount: appendixMissingInputs.length } : {}),
    preparedInputPath: localAgentInputPath,
    derivedEvidencePath: localFilledEvidencePath,
    sampleBackedFormalReady: readinessState.sampleBackedFormalReady,
    localScaffoldOnly: readinessState.localScaffoldOnly,
  });

  const createLocalRunDraft = async () => {
    setIsCreatingRunDraft(true);
    setRunLedgerStatus(null);
    try {
      const created = await createRunDraft(buildRunDraftPayload());
      setRunLedgerStatus(`Draft run ${created.runId} saved to Convex.`);
      return created.runId;
    } catch (error) {
      setRunLedgerStatus(error instanceof Error ? error.message : "Could not save run draft.");
      return null;
    } finally {
      setIsCreatingRunDraft(false);
    }
  };

  const saveDeterministicPreviewSummary = async () => {
    if (!deterministicExampleOutput) {
      return;
    }

    setIsSavingRunResult(true);
    setRunLedgerStatus(null);
    try {
      const runId = reportRuns?.[0]?.runId ?? (await createLocalRunDraft());
      if (!runId) {
        return;
      }
      await saveRunResultSummary({
        runId,
        reportSlug: report.slug,
        resultArtifactPath: resultFixturePreview
          ? `fixtures/synthetic/${report.slug}.result.json`
          : `tmp/agent-runs/${report.slug}.agent-result.json`,
        schemaVersion:
          typeof deterministicExampleOutput.schemaVersion === "string"
            ? deterministicExampleOutput.schemaVersion
            : "report-specific result JSON",
        resultRows: deterministicExampleRows,
        referenceCount: localFixture?.referenceResources.length ?? report.references.length,
        appendixProbabilityCount: appendixProbabilities.length,
        appendixUncertaintyCount: appendixUncertainty.length,
        appendixMissingInputCount: appendixMissingInputs.length,
        appendixLimitationCount: appendixLimitations.length,
        validationStatus: "pending",
        validationProblemCount: 0,
        validationWarningCount: 0,
      });
      setRunLedgerStatus(`Result summary saved for ${runId}.`);
    } catch (error) {
      setRunLedgerStatus(error instanceof Error ? error.message : "Could not save result summary.");
    } finally {
      setIsSavingRunResult(false);
    }
  };

  return (
    <section id="report-detail" className="theme-light detail-wrapper container">
      <div className="detail-grid">
        <aside className="detail-sidebar">
          <div className="filter-group">
            <div className="filter-group-header">
              <span className="eyebrow">Selected report</span>
              <span className="meta-text">04.</span>
            </div>
            <h2>{report.title}</h2>
            <p className="body-text">{report.subtitle}</p>
            <dl className="meta-list">
              <div>
                <dt>Claim scope</dt>
                <dd>{report.claimScope}</dd>
              </div>
              <div>
                <dt>Curation</dt>
                <dd>{report.curationStatus}</dd>
              </div>
              <div>
                <dt>Sample status</dt>
                <dd>{report.sampleReportStatus}</dd>
              </div>
              {report.priceLabel ? (
                <div>
                  <dt>Marketplace price</dt>
                  <dd>{report.priceLabel}</dd>
                </div>
              ) : null}
              {report.catalogCategories?.length ? (
                <div>
                  <dt>Catalog categories</dt>
                  <dd>{report.catalogCategories.join(", ")}</dd>
                </div>
              ) : null}
            </dl>
            <a className="btn btn-outline wide" href={report.sourceUrl} target="_blank" rel="noreferrer">
              Source
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </a>
            <nav className="detail-nav" aria-label="Report detail sections">
              <a href="#essentials">Essentials</a>
              <a href="#prompt">Prompt</a>
              <a href="#schema">Schema</a>
              <a href="#references">References</a>
              <a href="#readiness">Readiness</a>
              {formalEvidenceDecision ? <a href="#formal-blocker">Blocker</a> : null}
              {formalEvidenceTarget ? <a href="#official-output-capture">Capture</a> : null}
              <a href="#visible-fields">Fields</a>
              <a href="#formal-map">Formal map</a>
              <a href="#curation">Curation</a>
              <a href="#provenance">Provenance</a>
              <a href="#genome-inputs">Inputs</a>
              <a href="#sample-report">Sample rows</a>
              <a href="#genotype-summary">Genotypes</a>
              <a href="#fixture">Fixture</a>
              <a href="#agent-input">Agent JSON</a>
              <a href="#manifest">Manifest</a>
              <a href="#local-run">Run workflow</a>
              <a href="#example-output">Example</a>
              <a href="#appendix">Appendix</a>
            </nav>
          </div>
        </aside>

        <div className="detail-content">
          <section className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Purpose</span>
              <span className="meta-text">{report.status}</span>
            </div>
            <p>{report.detail}</p>
            <div className="tag-row">
              {report.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="status-grid safeguard-grid" aria-label="Local run safeguards">
              {runSafeguards.map((safeguard) => (
                <div key={safeguard.label}>
                  <span>{safeguard.label}</span>
                  <strong>{safeguard.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section id="essentials" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Package essentials</span>
              <span className="meta-text">{readinessState.label}</span>
            </div>
            <div className="status-grid">
              <div>
                <span>Prompt</span>
                <strong>{promptReady ? "Ready" : report.prompt ? "Draft" : "Missing"}</strong>
              </div>
              <div>
                <span>References</span>
                <strong>{readiness?.evidence.references ?? report.references.length}</strong>
              </div>
              <div>
                <span>Output sections</span>
                <strong>{readiness?.evidence.outputSections ?? report.outputSections.length}</strong>
              </div>
              <div>
                <span>Formal fields</span>
                <strong>
                  {coveredFormalFieldCount}/{readiness?.evidence.formalFields ?? report.formalFields.length}
                </strong>
              </div>
              <div>
                <span>Sample rows</span>
                <strong>{readiness?.evidence.sampleRows ?? report.sampleRows.length}</strong>
              </div>
              <div>
                <span>Local agent bundle</span>
                <strong>{localAgentInputReady ? "Ready" : "Pending"}</strong>
              </div>
            </div>
            <div className="readiness-gap-list">
              <div>
                <strong>
                  <a href="#prompt">Agent prompt</a>
                </strong>
                <p>{report.prompt?.title ?? "Prompt package is pending."}</p>
              </div>
              <div>
                <strong>
                  <a href="#schema">Output format</a>
                </strong>
                <p>
                  {report.outputSections.length} sections with {coveredFormalFieldCount}/{report.formalFields.length} covered
                  formal fields.
                </p>
              </div>
              <div>
                <strong>
                  <a href="#references">Reference resources</a>
                </strong>
                <p>{report.references.length} resources; {referenceProvenance.length} include captured provenance.</p>
              </div>
              <div>
                <strong>
                  <a href="#local-run">Local run workflow</a>
                </strong>
                <p>
                  {localAgentInputReady
                    ? "Prepared bundle, schema, fixture, and example output are available."
                    : localAgentInputBlockers.join(", ")}
                </p>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={copyLocalRunWorkflow}
                  disabled={localRunWorkflow.length === 0}
                >
                  Copy run commands
                </button>
              </div>
            </div>
          </section>

          <section id="readiness" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Formal readiness</span>
              <span className="meta-text">
                {readiness ? readiness.status : readiness === undefined ? "loading audit row" : "audit row missing"}
              </span>
            </div>
            <div className="status-grid">
              <div>
                <span>Stage</span>
                <strong>{readinessState.label}</strong>
              </div>
              <div>
                <span>Full parity</span>
                <strong>{readinessState.formalEquivalentReady ? "Ready" : "Pending"}</strong>
              </div>
              <div>
                <span>Sample-backed formal</span>
                <strong>{readinessState.sampleBackedFormalReady ? "Ready" : "Pending"}</strong>
              </div>
              <div>
                <span>Official boundary</span>
                <strong>{formalEvidenceTarget ? officialEvidenceTierLabel : "Not a blocker"}</strong>
              </div>
              <div>
                <span>Scaffold-only</span>
                <strong>{readinessState.localScaffoldOnly ? "Yes; not source-backed" : "No"}</strong>
              </div>
              <div>
                <span>Sample rows</span>
                <strong>{readiness?.evidence.sampleRows ?? report.sampleRows.length}</strong>
              </div>
              <div>
                <span>Covered formal fields</span>
                <strong>
                  {coveredFormalFieldCount}/{readiness?.evidence.formalFields ?? report.formalFields.length}
                </strong>
              </div>
              <div>
                <span>Pending formal fields</span>
                <strong>{pendingFormalFieldCount}</strong>
              </div>
              <div>
                <span>Exact citation rows</span>
                <strong>{readiness?.evidence.exactCitationRows ?? 0}</strong>
              </div>
              <div>
                <span>Open gaps</span>
                <strong>{readinessGapCount}</strong>
              </div>
            </div>
            {readinessDeclaredGaps.length > 0 || readinessDerivedGaps.length > 0 ? (
              <div className="readiness-gap-list">
                <div>
                  <strong>Declared gaps</strong>
                  <p>{readinessDeclaredGaps.map(formatGapLabel).join(", ") || "None"}</p>
                </div>
                <div>
                  <strong>Derived gaps</strong>
                  <p>{readinessDerivedGaps.map(formatGapLabel).join(", ") || "None"}</p>
                </div>
              </div>
            ) : (
              <p className="body-text">No readiness gaps are declared in the current audit row.</p>
            )}
          </section>

          {formalEvidenceDecision ? (
            <section id="formal-blocker" className="detail-section">
              <div className="detail-section-header">
                <span className="eyebrow">Formal blocker ledger</span>
                <button className="btn btn-outline" type="button" onClick={copyFormalEvidenceBlocker}>
                  Copy blocker JSON
                </button>
              </div>
              <div className="status-grid">
                <div>
                  <span>Decision</span>
                  <strong>{formalEvidenceDecision.decision}</strong>
                </div>
                <div>
                  <span>Evidence status</span>
                  <strong>{formalEvidenceDecision.evidenceStatus}</strong>
                </div>
                <div>
                  <span>Report file</span>
                  <strong>{formalEvidenceDecision.reportFileStatus}</strong>
                </div>
                <div>
                  <span>Sample rows</span>
                  <strong>{formalEvidenceDecision.sampleRows}</strong>
                </div>
              </div>
              <div className="readiness-gap-list">
                <div>
                  <strong>Route behavior</strong>
                  <p>{formalEvidenceDecision.routeBehavior}</p>
                </div>
                <div>
                  <strong>Why it stays scaffold-only</strong>
                  <p>{formalEvidenceDecision.reason}</p>
                </div>
              </div>
              <div className="blocker-grid">
                <div>
                  <h3>Required evidence for promotion</h3>
                  <ul>
                    {formalEvidenceDecision.requiredEvidenceForPromotion.map((evidence) => (
                      <li key={evidence}>{evidence}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Sources already reviewed</h3>
                  <ul>
                    {formalEvidenceDecision.sources.map((source) => (
                      <li key={source}>{source}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {formalEvidenceTarget ? (
            <section id="official-output-capture" className="detail-section">
              <div className="detail-section-header">
                <span className="eyebrow">Official output capture</span>
                <div className="detail-actions">
                  <button className="btn btn-outline" type="button" onClick={copyOfficialOutputCaptureTask}>
                    Copy capture task
                  </button>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={copyOfficialOutputNextCommand}
                    disabled={!officialOutputCaptureNextCommand}
                  >
                    Copy next command
                  </button>
                  <button className="btn btn-outline" type="button" onClick={copyOfficialOutputCaptureTemplate}>
                    Copy artifact template
                  </button>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={copyOfficialEvidencePacket}
                    disabled={!officialEvidencePacket}
                  >
                    Copy evidence packet
                  </button>
                  <button className="btn btn-outline" type="button" onClick={copyOfficialOutputRedactionWorkflow}>
                    Copy redaction workflow
                  </button>
                </div>
              </div>
              <div className="status-grid">
                <div>
                  <span>Priority</span>
                  <strong>{formalEvidenceTarget.priority}</strong>
                </div>
                <div>
                  <span>Class</span>
                  <strong>{formalEvidenceTarget.evidenceClass}</strong>
                </div>
                <div>
                  <span>Current status</span>
                  <strong>{formalEvidenceTarget.evidenceStatus}</strong>
                </div>
                <div>
                  <span>Expected schema</span>
                  <strong>{formalEvidenceTarget.expectedCaptureSchema}</strong>
                </div>
                <div>
                  <span>Capture stage</span>
                  <strong>
                    <span className={captureStageClass(officialOutputCaptureStatus?.stage)}>
                      {officialOutputCaptureStatus ? formatGapLabel(officialOutputCaptureStatus.stage) : "status missing"}
                    </span>
                  </strong>
                </div>
                <div>
                  <span>Action class</span>
                  <strong>
                    <span className={`evidence-status evidence-status-${officialOutputActionClass}`}>
                      {formatGapLabel(officialOutputActionClass)}
                    </span>
                  </strong>
                </div>
                <div>
                  <span>Boundary tier</span>
                  <strong>
                    <span className={`evidence-status evidence-status-${officialEvidenceTier}`}>
                      {officialEvidenceTierLabel}
                    </span>
                  </strong>
                </div>
                <div>
                  <span>Boundary fields</span>
                  <strong>{officialOutputCaptureStatus?.officialBoundaryModeledFields ?? 0}</strong>
                </div>
                <div>
                  <span>Promotes readiness</span>
                  <strong>{officialBoundaryModel ? "No" : "No row evidence"}</strong>
                </div>
                <div>
                  <span>Template</span>
                  <strong>{officialOutputCaptureStatus?.templateExists ? "present" : "missing"}</strong>
                </div>
                <div>
                  <span>Exact route</span>
                  <strong>
                    {officialOutputDetailInspection
                      ? officialOutputDetailInspection.exactRoute
                        ? "yes"
                        : "fallback"
                      : "not inspected"}
                  </strong>
                </div>
                <div>
                  <span>Latest route probe</span>
                  <strong>
                    {officialOutputLatestRouteProbe
                      ? `${formatGapLabel(officialOutputLatestRouteProbe.finalUrlKind ?? "unknown")} / reportData ${
                          officialOutputLatestRouteProbe.pagePropsReportData ? "yes" : "no"
                        }`
                      : "not probed"}
                  </strong>
                </div>
                <div>
                  <span>Route probe artifact</span>
                  <strong>{officialOutputLatestRouteProbe?.artifactPath ?? "none"}</strong>
                </div>
                <div>
                  <span>Route probe URL</span>
                  <strong>
                    {officialOutputLatestRouteProbe?.finalUrl ??
                      officialOutputLatestRouteProbe?.requestedUrl ??
                      "none"}
                  </strong>
                </div>
                <div>
                  <span>Sequencing app ID</span>
                  <strong>{officialOutputDetailInspection?.apiAppId ?? "none"}</strong>
                </div>
                <div>
                  <span>Start action</span>
                  <strong>{officialOutputDetailInspection?.startButtonText || "unknown"}</strong>
                </div>
                <div>
                  <span>Official captures</span>
                  <strong>{officialOutputCaptureStatus?.officialCaptures ?? 0}</strong>
                </div>
                <div>
                  <span>Row-ready captures</span>
                  <strong>{officialOutputCaptureStatus?.rowEvidenceReadyCaptures ?? 0}</strong>
                </div>
                <div>
                  <span>Promotion-ready captures</span>
                  <strong>
                    {officialOutputCaptureStatus?.rowEvidencePromotionReadyCaptures ??
                      officialOutputCaptureStatus?.promotionCandidates ??
                      0}
                  </strong>
                </div>
                <div>
                  <span>Output-signal reviews</span>
                  <strong>
                    {officialOutputCaptureStatus?.outputSignalReviews ??
                      officialOutputCaptureStatus?.promotionCandidates ??
                      0}
                  </strong>
                </div>
                <div>
                  <span>Report file</span>
                  <strong>{formalEvidenceTarget.reportFileStatus}</strong>
                </div>
                <div>
                  <span>Public bundle evidence</span>
                  <strong>
                    {officialOutputPublicBundleEvidence
                      ? `${officialOutputPublicBundleEvidence.evidencePresent.length} boundary facts`
                      : "none"}
                  </strong>
                </div>
                <div>
                  <span>Public evidence artifact</span>
                  <strong>{officialOutputPublicBundleEvidence?.artifactPath ?? "none"}</strong>
                </div>
                <div>
                  <span>Sample rows</span>
                  <strong>{formalEvidenceTarget.sampleRows}</strong>
                </div>
              </div>
              <div className="readiness-gap-list">
                <div>
                  <strong>Action</strong>
                  <p>{formalEvidenceTarget.actionLabel}</p>
                </div>
                <div>
                  <strong>First evidence needed</strong>
                  <p>{formalEvidenceTarget.firstRequiredEvidence}</p>
                </div>
                <div>
                  <strong>Completed-output gate</strong>
                  <p>{officialOutputActionBoundary}</p>
                </div>
                <div>
                  <strong>{officialEvidenceTierLabel}</strong>
                  <p>{officialEvidenceTierBoundary}</p>
                  {officialBoundaryModel ? (
                    <p>
                      Does not promote sample-backed formal readiness, formal parity, sample rows, result rows,
                      citation bindings, or formal blocker removal.
                    </p>
                  ) : null}
                </div>
                {officialOutputNextEvidence.length > 0 ? (
                  <div>
                    <strong>Next official evidence</strong>
                    <ul>
                      {officialOutputNextEvidence.map((evidence) => (
                        <li key={evidence}>{evidence}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <strong>Next capture action</strong>
                  <p>{officialOutputCaptureStatus?.nextAction ?? formalEvidenceTarget.actionLabel}</p>
                </div>
                <div>
                  <strong>Next command</strong>
                  <p className="capture-path">{officialOutputCaptureNextCommand}</p>
                </div>
                {officialOutputReviewEvidencePresent.length > 0 || officialOutputReviewEvidenceMissing.length > 0 ? (
                  <div>
                    <strong>Review evidence ledger</strong>
                    {officialOutputReviewEvidencePresent.length > 0 ? (
                      <>
                        <p>Already confirmed:</p>
                        <ul>
                          {officialOutputReviewEvidencePresent.map((evidence) => (
                            <li key={`present-${evidence}`}>{evidence}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {officialOutputReviewEvidenceMissing.length > 0 ? (
                      <>
                        <p>Still missing:</p>
                        <ul>
                          {officialOutputReviewEvidenceMissing.map((evidence) => (
                            <li key={`missing-${evidence}`}>{evidence}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {officialOutputLatestRouteProbe ? (
                  <div>
                    <strong>Latest authenticated route probe</strong>
                    <p>
                      {officialOutputLatestRouteProbe.finalUrlKind
                        ? formatGapLabel(officialOutputLatestRouteProbe.finalUrlKind)
                        : "route kind unknown"}
                      ; reportData {officialOutputLatestRouteProbe.pagePropsReportData ? "present" : "absent"};
                      not-found {officialOutputLatestRouteProbe.notFound ? "yes" : "no"}
                    </p>
                    <p>Artifact: {officialOutputLatestRouteProbe.artifactPath ?? "none"}</p>
                    <p>
                      URL:{" "}
                      {officialOutputLatestRouteProbe.finalUrl ??
                        officialOutputLatestRouteProbe.requestedUrl ??
                        "none"}
                    </p>
                    <p>
                      {formatBoundaryReason(officialOutputLatestRouteProbe.promotionBoundary) ??
                        officialOutputLatestRouteProbe.privacyBoundary}
                    </p>
                  </div>
                ) : null}
                {officialOutputPublicBundleEvidence ? (
                  <div>
                    <strong>Public bundle boundary evidence</strong>
                    <p>{officialOutputPublicBundleEvidence.evidenceUse}</p>
                    <p>Artifact: {officialOutputPublicBundleEvidence.artifactPath ?? "none"}</p>
                    <ul>
                      {officialOutputPublicBundleEvidence.evidencePresent.slice(0, 5).map((evidence) => (
                        <li key={evidence}>{evidence}</li>
                      ))}
                    </ul>
                    <p>
                      Still not promotable:{" "}
                      {officialOutputPublicBundleEvidence.evidenceMissingForPromotion.join("; ")}
                    </p>
                    <p>
                      {formatBoundaryReason(officialOutputPublicBundleEvidence.promotionBoundary) ??
                        "Public bundle evidence cannot replace official sample rows, output rows, or citation bindings."}
                    </p>
                  </div>
                ) : null}
                <div>
                  <strong>Private-output redaction</strong>
                  <p>
                    Fill the ignored redaction input from a completed Sequencing.com output, then sanitize to tmp before
                    exporting anything into `reference/catalog/`.
                  </p>
                </div>
                <div>
                  <strong>Non-promotion caveats</strong>
                  <ul>
                    {officialOutputCaptureCaveats.map((caveat) => (
                      <li key={caveat}>{caveat}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>Ignored redaction input</strong>
                  <p className="capture-path">{officialOutputRedactionInputPath}</p>
                </div>
                <div>
                  <strong>Redaction template CLI</strong>
                  <p className="capture-path">{officialOutputRedactionTemplateCommand}</p>
                </div>
                <div>
                  <strong>Dry-run sanitizer</strong>
                  <p className="capture-path">{officialOutputDryRunSanitizeCommand}</p>
                </div>
                <div>
                  <strong>Sanitize local output</strong>
                  <p className="capture-path">{officialOutputSanitizeRedactionCommand}</p>
                </div>
                {officialOutputDraftCaptureValidationCommand ? (
                  <div>
                    <strong>Validate local draft</strong>
                    <p className="capture-path">{officialOutputDraftCaptureValidationCommand}</p>
                  </div>
                ) : null}
                <div>
                  <strong>Capture URL</strong>
                  <p>
                    {formalEvidenceTarget.captureUrl ? (
                      <a href={formalEvidenceTarget.captureUrl} target="_blank" rel="noreferrer">
                        {formalEvidenceTarget.captureUrl}
                      </a>
                    ) : (
                      "No exact external URL captured"
                    )}
                  </p>
                </div>
                {officialOutputDetailInspection ? (
                  <div>
                    <strong>Safe live detail inspection</strong>
                    <p>
                      {officialOutputDetailInspection.pageTitle ?? formalEvidenceTarget.title};{" "}
                      {officialOutputDetailInspection.exactRoute ? "exact route" : "route fallback"};{" "}
                      {officialOutputDetailInspection.apiAppId
                        ? `app ${officialOutputDetailInspection.apiAppId}`
                        : "no app ID exposed"}.
                    </p>
                    <p className="capture-path">
                      {officialOutputDetailInspection.finalUrl ?? officialOutputDetailInspection.requestedUrl}
                    </p>
                  </div>
                ) : null}
                <div>
                  <strong>Sanitized artifact</strong>
                  <p className="capture-path">
                    {officialOutputCaptureCandidatePath ?? officialOutputCommittedCapturePath}
                  </p>
                </div>
                <div>
                  <strong>Sanitized draft artifact</strong>
                  <p className="capture-path">{officialOutputSanitizedDraftPath}</p>
                </div>
                {officialOutputCaptureArtifactSummaries.length > 0 ? (
                  <div>
                    <strong>Validated capture signals</strong>
                    {officialOutputCaptureArtifactSummaries.map((artifact) => (
                      <p className="capture-path" key={artifact.path}>
                        {artifact.path}: {artifact.ok ? "valid" : "invalid"};{" "}
                        {formatOutputSignals(artifact.outputSignals)}
                      </p>
                    ))}
                  </div>
                ) : null}
                {officialOutputFormalGate ? (
                  <div>
                    <strong>Formal validator gate</strong>
                    <p>
                      {officialOutputFormalGate.readyForPromotion
                        ? "Current capture signals satisfy the formal gate."
                        : "Current capture signals are still missing formal-ready evidence."}
                    </p>
                    <ul>
                      {(officialOutputFormalGate.missing.length > 0
                        ? officialOutputFormalGate.missing
                        : ["no missing gate requirements"]
                      ).map((missing) => (
                        <li key={missing}>{missing}</li>
                      ))}
                    </ul>
                    <p className="capture-path">{officialOutputFormalGate.validatorCommand}</p>
                  </div>
                ) : null}
                {officialOutputPromotionReview ? (
                  <div>
                    <strong>Manual promotion review</strong>
                    <p>
                      {formatGapLabel(officialOutputPromotionReview.decision)} /{" "}
                      {formatGapLabel(officialOutputPromotionReview.reviewClass)}
                    </p>
                    <p>
                      {officialOutputPromotionReview.boundaryUse ??
                        "Reviewed current official sources remain non-promotional for formal output."}
                    </p>
                    {(officialOutputPromotionReview.sourcePaths?.length ?? 0) > 0 ? (
                      <p className="capture-path">{officialOutputPromotionReview.sourcePaths?.join(", ")}</p>
                    ) : null}
                    {(officialOutputPromotionReview.sourceUrls?.length ?? 0) > 0 ? (
                      <p className="capture-path">{officialOutputPromotionReview.sourceUrls?.join(", ")}</p>
                    ) : null}
                    {officialOutputPromotionReview.nextEvidenceNeeded.length > 0 ? (
                      <ul>
                        {officialOutputPromotionReview.nextEvidenceNeeded.map((evidence) => (
                          <li key={evidence}>{evidence}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                <div>
                  <strong>Public capture session</strong>
                  <p className="capture-path">{officialOutputPublicCaptureSessionCommand}</p>
                  <p className="capture-path">{formalEvidenceTarget.templateCommand}</p>
                  <p className="capture-path">npm run scaffold:template-audit -- --report {report.slug}</p>
                </div>
                <div>
                  <strong>Private capture session</strong>
                  <p className="capture-path">{officialOutputPrivateCaptureSessionCommand}</p>
                  <p className="capture-path">{officialOutputRedactionTemplateCommand}</p>
                  <p className="capture-path">{officialOutputDryRunSanitizeCommand}</p>
                </div>
                <div>
                  <strong>Commit-safe export</strong>
                  <p className="capture-path">{officialOutputCombinedCaptureSessionCommand}</p>
                  <p className="capture-path">{officialOutputCommitCaptureCommand}</p>
                </div>
                {officialOutputPromotionPreviewCommand ? (
                  <div>
                    <strong>Promotion preview</strong>
                    <p className="capture-path">{officialOutputPromotionPreviewCommand}</p>
                  </div>
                ) : (
	                  <div>
	                    <strong>Output-signal review</strong>
	                    <p className="capture-path">
	                      Promotion preview stays hidden until validate-captures reports rowEvidencePromotionReady: true.
	                    </p>
	                  </div>
                )}
                <div>
                  <strong>Validation</strong>
                  <p className="capture-path">{officialOutputCaptureValidationCommand}</p>
                  <p className="capture-path">{formalEvidenceTarget.validationCommands.join(" -> ")}</p>
                </div>
                {formalEvidenceTarget.describedOutputFields.length > 0 ? (
                  <div>
                    <strong>Described field source</strong>
                    <p className="capture-path">{formalEvidenceTarget.describedOutputFieldSource}</p>
                  </div>
                ) : null}
              </div>
              {formalEvidenceTarget.describedOutputFields.length > 0 ? (
                <div className="described-field-panel">
                  <strong>Officially described fields</strong>
                  {formalEvidenceTarget.describedOutputFieldBoundary ? (
                    <p>{formalEvidenceTarget.describedOutputFieldBoundary}</p>
                  ) : null}
                  <ul className="columns-list">
                    {formalEvidenceTarget.describedOutputFields.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {officialEvidencePacket ? (
                <div className="capture-template-panel">
                  <strong>Official evidence packet</strong>
                  <pre>{JSON.stringify(officialEvidencePacket, null, 2)}</pre>
                </div>
              ) : null}
              {officialOutputCaptureArtifactTemplate ? (
                <div className="capture-template-panel">
                  <strong>Sanitized artifact template</strong>
                  <pre>{JSON.stringify(officialOutputCaptureArtifactTemplate, null, 2)}</pre>
                </div>
              ) : null}
              <div className="blocker-grid">
                <div>
                  <h3>Acceptance criteria</h3>
                  <ul>
                    {formalEvidenceTarget.acceptanceCriteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Does not promote</h3>
                  <ul>
                    {formalEvidenceTarget.nonPromotionBoundary.map((boundary) => (
                      <li key={boundary}>{boundary}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3>Sources already reviewed</h3>
                  <ul>
                    {formalEvidenceTarget.currentSources.map((source) => (
                      <li key={source}>{source}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          <section id="visible-fields" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Visible report fields</span>
              <span className="meta-text">{report.visibleFields.length} fields</span>
            </div>
            <ul className="columns-list">
              {report.visibleFields.map((field, index) => (
                <li key={`${index}-${field}`}>{field}</li>
              ))}
            </ul>
          </section>

          <section id="formal-map" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Formal equivalent map</span>
              <span className="meta-text">{report.formalFields.length} fields</span>
            </div>
            {report.formalFields.length > 0 ? (
              <div className="coverage-list">
                {report.formalFields.map((field) => {
                  const status = FORMAL_FIELD_STATUS_META[field.status];
                  return (
                    <div key={`${field.sortOrder}-${field.observedField}`}>
                      <span className={status.className}>{status.label}</span>
                      <strong>{field.observedField}</strong>
                      <small>
                        {field.sourceLabel} {"->"} {field.outputPath}
                      </small>
                      <p>{field.notes}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="body-text">Formal equivalent mapping is pending extraction.</p>
            )}
          </section>

          <section id="curation" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Extraction completeness</span>
              <span className="meta-text">{report.sourceArtifacts.length} artifacts</span>
            </div>
            <div className="status-grid">
              {CURATION_READINESS_ITEMS.map((item) => {
                const value = report.curationCompleteness[item.key];
                return (
                  <div key={item.key}>
                    <span>{item.label}</span>
                    <strong>{value ? "Done" : "Pending"}</strong>
                  </div>
                );
              })}
            </div>
            <ul className="columns-list">
              {report.curationCompleteness.notes.map((note, index) => (
                <li key={`${index}-${note}`}>{note}</li>
              ))}
            </ul>
          </section>

          <section id="provenance" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Catalog/detail provenance</span>
              <span className="meta-text">{report.sourceArtifacts.length} artifacts</span>
            </div>
            <p className="body-text">
              Catalog/detail artifacts identify the package; they do not prove source-backed sample rows unless
              Sample-backed formal is Ready.
            </p>
            <dl className="inline-meta-list">
              <div>
                <dt>Catalog source</dt>
                <dd>{report.catalogSource ?? "not captured"}</dd>
              </div>
              <div>
                <dt>Prompt hash</dt>
                <dd>{report.prompt?.promptHash ?? "pending"}</dd>
              </div>
              <div>
                <dt>Output hash</dt>
                <dd>{report.prompt?.outputFormatHash ?? "pending"}</dd>
              </div>
              <div>
                <dt>Marketplace URL</dt>
                <dd>{report.marketplaceUrl}</dd>
              </div>
            </dl>
            {report.sourceArtifacts.length > 0 ? (
              <ul className="artifact-list">
                {report.sourceArtifacts.map((artifact) => (
                  <li key={artifact}>{artifact}</li>
                ))}
              </ul>
            ) : (
              <p className="body-text">Source artifacts are pending for this report.</p>
            )}
            {referenceProvenance.length > 0 ? (
              <div className="provenance-list">
                {referenceProvenance.map((reference) => (
                  <div key={`${reference.title}-${reference.sourceArtifact ?? reference.contentHash ?? reference.url}`}>
                    <strong>{reference.title}</strong>
                    <small>{reference.resourceId ?? "unkeyed-reference"}</small>
                    {reference.sourceArtifact ? <small>Artifact: {reference.sourceArtifact}</small> : null}
                    {reference.accessedAt ? <small>Accessed: {reference.accessedAt}</small> : null}
                    {reference.contentHash ? <small>Hash: {reference.contentHash}</small> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section id="genome-inputs" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Genome inputs</span>
              <span className="meta-text">{report.genomeInputs.length} inputs</span>
            </div>
            {report.genomeInputs.length > 0 ? (
              <div className="table-like">
                {report.genomeInputs.map((input) => (
                  <div key={input.id} className="table-row">
                    <span>{input.label}</span>
                    <span>{input.kind}</span>
                    <span>{input.assembly}</span>
                    <span>{input.required ? "required" : "optional"}</span>
                    <span>{input.missingDataBehavior}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-text">Inputs are pending source-backed sample-row extraction.</p>
            )}
          </section>

          <section id="sample-report" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Sample-backed rows</span>
              <span className="meta-text">{report.sampleRows.length} rows</span>
            </div>
            {report.sampleRows.length > 0 ? (
              <div className="sample-row-table">
                <div className="sample-row header">
                  <span>Group</span>
                  <span>Item</span>
                  <span>Result Of Genetic Analysis</span>
                  <span>Description</span>
                  <span>Gene(s)</span>
                  <span>Source binding</span>
                </div>
                {report.sampleRows.map((row) => (
                  <div key={`${row.sortOrder}-${row.item}`} className="sample-row">
                    <span>{row.groupTitle}</span>
                    <span>
                      <strong>{row.item}</strong>
                      {row.brandName ? <small>{row.brandName}</small> : null}
                    </span>
                    <span>{row.geneticAnalysis}</span>
                    <span>{row.description ?? "-"}</span>
                    <span>{row.genes.join(", ")}</span>
                    <span>
                      <strong>{row.sourceLabel}</strong>
                      {row.sourceResourceIds?.length ? <small>{row.sourceResourceIds.join(", ")}</small> : null}
                      {row.sourceBindingStatus ? <small>{row.sourceBindingStatus}</small> : null}
                      {row.sourceBindingNote ? <small>{row.sourceBindingNote}</small> : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-text">Sample-backed rows are pending extraction from source evidence.</p>
            )}
          </section>

          <section id="genotype-summary" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Genotype summary</span>
              <span className="meta-text">{report.genotypeSummary.length} rows</span>
            </div>
            {report.genotypeSummary.length > 0 ? (
              <div className="sample-row-table genotype-table">
                <div className="sample-row header">
                  <span>Tier</span>
                  <span>Gene</span>
                  <span>Variant ID</span>
                  <span>Genotype</span>
                  <span>Effect / phenotype</span>
                </div>
                {report.genotypeSummary.map((row) => (
                  <div key={`${row.sortOrder}-${row.gene}-${row.variantId}`} className="sample-row">
                    <span>{row.tier}</span>
                    <span>{row.gene}</span>
                    <span>{row.variantId || "-"}</span>
                    <span>{row.genotype}</span>
                    <span>
                      {row.effect}
                      {row.phenotype ? <small>{row.phenotype}</small> : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-text">Genotype summary is pending extraction.</p>
            )}
          </section>

          <section id="fixture" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Local run fixture</span>
              <div className="detail-actions">
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={copyLocalAgentInput}
                  disabled={!localAgentInputReady}
                >
                  {copyAgentInputLabel}
                </button>
                <button className="btn btn-primary" type="button" onClick={copyFixture} disabled={!report.localTestFixture}>
                  Copy fixture
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>
            {report.localTestFixture ? (
              <>
                <dl className="inline-meta-list">
                  <div>
                    <dt>Agent input</dt>
                    <dd>
                      {localAgentInputReady
                        ? readinessState.localScaffoldOnly
                          ? "local scaffold: prompt, fixture, schema, references, example output"
                          : `${readinessState.label.toLowerCase()}: prompt, fixture, schema, references, example output`
                        : "pending prompt or deterministic output"}
                    </dd>
                  </div>
                  <div>
                    <dt>Bundle status</dt>
                    <dd>{localAgentReadiness.label}</dd>
                  </div>
                  <div>
                    <dt>Sample-backed</dt>
                    <dd>{readinessState.sampleBackedFormalReady ? "yes" : "no; source-backed sample rows pending"}</dd>
                  </div>
                  <div>
                    <dt>References</dt>
                    <dd>{report.references.length}</dd>
                  </div>
                  <div>
                    <dt>Output sections</dt>
                    <dd>{report.outputSections.length}</dd>
                  </div>
                  <div>
                    <dt>Sample rows</dt>
                    <dd>{report.sampleRows.length}</dd>
                  </div>
                </dl>
                <p className="body-text">
                  Synthetic derived evidence only. This fixture is for testing prompt/output behavior
                  without putting raw genome files into Convex. Local scaffold inputs are not counted as
                  sample-backed formal reports until source-backed rows and citation bindings exist.
                </p>
                <pre className="fixture-block">{JSON.stringify(report.localTestFixture, null, 2)}</pre>
              </>
            ) : (
              <p className="body-text">Local run fixture is pending for this report.</p>
            )}
          </section>

          <section id="agent-input" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Synthetic agent input JSON</span>
              <button
                className="btn btn-outline"
                type="button"
                onClick={copyLocalAgentInput}
                disabled={!localAgentInputReady}
              >
                {copyAgentInputLabel}
              </button>
            </div>
            {localAgentInputReady && localAgentInput ? (
              <>
                <dl className="inline-meta-list">
                  <div>
                    <dt>Readiness</dt>
                    <dd>{localAgentInput.readiness.label}</dd>
                  </div>
                  <div>
                    <dt>Usage boundary</dt>
                    <dd>{localAgentInput.readiness.usageBoundary}</dd>
                  </div>
                  <div>
                    <dt>References</dt>
                    <dd>{localAgentInput.formalArtifacts.references.length}</dd>
                  </div>
                  <div>
                    <dt>Sample rows</dt>
                    <dd>{localAgentInput.formalArtifacts.sampleRows.length}</dd>
                  </div>
                  <div>
                    <dt>Formal gaps</dt>
                    <dd>{localAgentInput.readiness.gaps.join(", ") || "none"}</dd>
                  </div>
                </dl>
                <p className="body-text">
                  This is browser-copy JSON for local agent review, not an official Sequencing.com report output. It
                  includes the prompt, derived fixture, references, formal artifacts, deterministic example output, and
                  readiness envelope.
                </p>
                {readinessState.localScaffoldOnly ? (
                  <p className="body-text">
                    Scaffold only: the output schema validates, but sample rows, covered formal fields, and citation
                    bindings are not source-backed Sequencing.com sample evidence yet.
                  </p>
                ) : null}
                <pre className="fixture-block">{JSON.stringify(localAgentInput, null, 2)}</pre>
              </>
            ) : (
              <div className="readiness-gap-list">
                <div>
                  <strong>Agent input unavailable</strong>
                  <p>{localAgentInputBlockers.join(", ") || "readiness data unavailable"}</p>
                </div>
              </div>
            )}
          </section>

          <section id="manifest" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Agent bundle manifest</span>
              <div className="detail-actions">
                <button className="btn btn-outline" type="button" onClick={copyLocalValidationCommand} disabled={!localValidationCommand}>
                  Copy validate command
                </button>
                <button className="btn btn-outline" type="button" onClick={copyManifest} disabled={!uiAgentManifest}>
                  Copy manifest
                </button>
              </div>
            </div>
            {uiAgentManifest ? (
              <>
                <dl className="inline-meta-list">
                  <div>
                    <dt>Prompt path</dt>
                    <dd>{uiAgentManifest.artifactPaths.prompt}</dd>
                  </div>
                  <div>
                    <dt>Fixture path</dt>
                    <dd>{uiAgentManifest.artifactPaths.fixture}</dd>
                  </div>
                  <div>
                    <dt>Result path</dt>
                    <dd>{uiAgentManifest.artifactPaths.deterministicResult}</dd>
                  </div>
                  <div>
                    <dt>Bundle status</dt>
                    <dd>{uiAgentManifest.readiness.label}</dd>
                  </div>
                  <div>
                    <dt>Input hash</dt>
                    <dd>{uiAgentManifest.manifestHashes.fixtureInputManifestHash ?? "pending"}</dd>
                  </div>
                  <div>
                    <dt>Covered fields</dt>
                    <dd>
                      {uiAgentManifest.payloadShape.coveredFormalFields}/{uiAgentManifest.payloadShape.formalFields}
                    </dd>
                  </div>
                  <div>
                    <dt>Pending fields</dt>
                    <dd>{uiAgentManifest.payloadShape.pendingFormalFields}</dd>
                  </div>
                  <div>
                    <dt>Sample rows</dt>
                    <dd>{uiAgentManifest.payloadShape.sampleRows}</dd>
                  </div>
                </dl>
                <div className="manifest-checks">
                  {uiAgentManifest.outputValidation.checks.map((check) => (
                    <span key={check}>{check}</span>
                  ))}
                </div>
                {readinessState.localScaffoldOnly ? (
                  <p className="body-text">
                    Scaffold only: use this manifest as a prompt/schema handoff, not as proof of source-backed formal
                    report parity.
                  </p>
                ) : null}
                <p className="body-text">
                  Run the CLI validator for bundle hashes, transport hashes, and the full warning ledger; this browser
                  manifest is a review copy.
                </p>
                {localValidationCommand ? (
                  <pre className="command-block">{localValidationCommand}</pre>
                ) : null}
                <pre className="fixture-block">{JSON.stringify(uiAgentManifest, null, 2)}</pre>
              </>
            ) : (
              <p className="body-text">Manifest is pending until the report prompt and local fixture are ready.</p>
            )}
          </section>

          <section id="local-run" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Local genome run workflow</span>
              <button
                className="btn btn-outline"
                type="button"
                onClick={copyLocalRunWorkflow}
                disabled={localRunWorkflow.length === 0}
              >
                Copy run commands
              </button>
            </div>
            {localRunWorkflow.length > 0 ? (
              <>
                <dl className="inline-meta-list">
                  <div>
                    <dt>Raw genome file policy</dt>
                    <dd>raw records excluded; derived evidence only</dd>
                  </div>
                  <div>
                    <dt>App upload required</dt>
                    <dd>no; runner/model handling is user-controlled</dd>
                  </div>
                  <div>
                    <dt>Prepared input</dt>
                    <dd>{`tmp/agent-runs/${report.slug}.agent-input.json`}</dd>
                  </div>
                  <div>
                    <dt>Optional validation ledger</dt>
                    <dd>{`tmp/agent-runs/${report.slug}.validation.json`}</dd>
                  </div>
                </dl>
                <p className="body-text">
                  This is the handoff loop for using your own local genome data: derive only the requested observations
                  locally, prepare a report-specific agent payload, either generate a deterministic no-model scaffold or
                  run the agent outside the app, then validate the returned JSON before reviewing or comparing it.
                </p>
                {readinessState.localScaffoldOnly ? (
                  <p className="body-text">
                    For scaffold-only packages, a validated local run proves only the local prompt/schema workflow; it
                    does not promote the package to source-backed formal readiness.
                  </p>
                ) : null}
                <div className="run-ledger-panel">
                  <div className="run-ledger-header">
                    <div>
                      <span className="eyebrow">Convex run ledger</span>
                      <strong>{reportRuns ? `${reportRuns.length} recent runs` : "Loading runs"}</strong>
                    </div>
                    <div className="detail-actions">
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={createLocalRunDraft}
                        disabled={isCreatingRunDraft || !localFixture}
                      >
                        {isCreatingRunDraft ? "Saving..." : "Create draft"}
                      </button>
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={saveDeterministicPreviewSummary}
                        disabled={isSavingRunResult || !deterministicExampleOutput}
                      >
                        {isSavingRunResult ? "Saving..." : "Save result summary"}
                      </button>
                    </div>
                  </div>
                  <dl className="inline-meta-list">
                    <div>
                      <dt>Stored in Convex</dt>
                      <dd>hashes, counts, status, artifact paths</dd>
                    </div>
                    <div>
                      <dt>Raw genome stored</dt>
                      <dd>no</dd>
                    </div>
                    <div>
                      <dt>Prepared input path</dt>
                      <dd>{localAgentInputPath}</dd>
                    </div>
                    <div>
                      <dt>Result path</dt>
                      <dd>{localAgentResultPath}</dd>
                    </div>
                  </dl>
                  {runLedgerStatus ? <p className="run-ledger-status">{runLedgerStatus}</p> : null}
                  {reportRuns && reportRuns.length > 0 ? (
                    <div className="run-history-list">
                      {reportRuns.map((run) => (
                        <div key={run.runId}>
                          <strong>{run.runId}</strong>
                          <span>{run.status} / {formatRunTimestamp(run.updatedAt)}</span>
                          <small>
                            {run.genomeBuild ?? "genome build pending"}; derived evidence{" "}
                            {run.derivedEvidenceCount ?? "pending"}; raw genome{" "}
                            {run.rawGenomeIncluded ? "stored" : "not stored"}
                          </small>
                          {run.inputSummary ? <small>{run.inputSummary.preparedInputPath ?? localAgentInputPath}</small> : null}
                          {run.resultSummary ? (
                            <small>
                              result rows {run.resultSummary.resultRows}; references {run.resultSummary.referenceCount};
                              validation {run.resultSummary.validationStatus}; saved{" "}
                              {formatRunTimestamp(run.resultSummary.savedAt)}
                            </small>
                          ) : (
                            <small>result summary pending</small>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="body-text">No local run drafts have been saved for this report yet.</p>
                  )}
                </div>
                <div className="local-run-steps">
                  {localRunWorkflow.map((step, index) => (
                    <div key={step.label}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{step.label}</strong>
                      <p>{step.purpose}</p>
                      <pre className="command-block">{step.command}</pre>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="body-text">Local run commands are available after the manifest is ready.</p>
            )}
          </section>

          <section id="example-output" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Deterministic example output</span>
              <button
                className="btn btn-primary"
                type="button"
                onClick={copyExampleOutput}
                disabled={!deterministicExampleOutput}
              >
                Copy output
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
            {deterministicExampleOutput ? (
              <>
                <dl className="inline-meta-list">
                  <div>
                    <dt>Source</dt>
                    <dd>{deterministicExampleSource}</dd>
                  </div>
                  <div>
                    <dt>Schema</dt>
                    <dd>{String(deterministicExampleOutput.schemaVersion ?? "report-specific result JSON")}</dd>
                  </div>
                  <div>
                    <dt>Rows</dt>
                    <dd>{deterministicExampleRows}</dd>
                  </div>
                  <div>
                    <dt>References</dt>
                    <dd>{localFixture?.referenceResources.length ?? report.references.length}</dd>
                  </div>
                </dl>
                <p className="body-text">
                  This is the deterministic local-agent output shape for the selected report. It uses
                  synthetic derived evidence and preserves the no-raw-genome boundary.
                </p>
                {readinessState.localScaffoldOnly ? (
                  <p className="body-text">
                    Scaffold only: treat this as a validated example shape, not as recovered Sequencing.com sample rows
                    or source-backed formal findings.
                  </p>
                ) : null}
                <pre className="fixture-block">{JSON.stringify(deterministicExampleOutput, null, 2)}</pre>
              </>
            ) : (
              <p className="body-text">
                {isResultFixtureLoading
                  ? "Loading deterministic output preview..."
                  : "Deterministic output preview is pending for this report."}
              </p>
            )}
          </section>

          <section id="appendix" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Appendix and uncertainty</span>
              <span className="meta-text">{deterministicExampleSource}</span>
            </div>
            {deterministicExampleOutput ? (
              <>
                <dl className="inline-meta-list">
                  <div>
                    <dt>Probabilities</dt>
                    <dd>{appendixProbabilities.length}</dd>
                  </div>
                  <div>
                    <dt>Uncertainty rows</dt>
                    <dd>{appendixUncertainty.length}</dd>
                  </div>
                  <div>
                    <dt>Missing inputs</dt>
                    <dd>{appendixMissingInputs.length}</dd>
                  </div>
                  <div>
                    <dt>Limitations</dt>
                    <dd>{appendixLimitations.length}</dd>
                  </div>
                </dl>
                {report.prompt ? (
                  <div className="appendix-policy">
                    <strong>Appendix policy</strong>
                    <p>{report.prompt.appendixPolicy}</p>
                    <p>{report.prompt.probabilityDisclosure}</p>
                  </div>
                ) : null}
                <div className="appendix-grid">
                  <AppendixList
                    title="Probabilities"
                    items={appendixProbabilities}
                    emptyLabel="No calibrated probabilities supplied."
                  />
                  <AppendixList title="Uncertainty" items={appendixUncertainty} />
                  <AppendixList title="Missing inputs" items={appendixMissingInputs} />
                  <AppendixList title="Limitations" items={appendixLimitations} />
                </div>
              </>
            ) : (
              <p className="body-text">
                {isResultFixtureLoading
                  ? "Loading appendix preview..."
                  : "Appendix preview is pending for this report."}
              </p>
            )}
          </section>

          <section id="prompt" className="detail-section prompt-section">
            <div className="detail-section-header">
              <span className="eyebrow">Agent prompt</span>
              <button className="btn btn-primary" type="button" onClick={copyPrompt} disabled={!promptReady}>
                Copy prompt text
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
            {report.prompt ? (
              <>
                <dl className="inline-meta-list">
                  <div>
                    <dt>Prompt title</dt>
                    <dd>{report.prompt.title}</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>{report.prompt.promptVersion ?? "pending"}</dd>
                  </div>
                  <div>
                    <dt>Extraction</dt>
                    <dd>{report.prompt.extractionStatus}</dd>
                  </div>
                  <div>
                    <dt>Copy status</dt>
                    <dd>{promptReady ? "prompt text ready; agent input includes fixture and schema" : "draft only"}</dd>
                  </div>
                </dl>
                {!promptReady ? (
                  <p className="body-text">
                    This inferred prompt is visible for review, but it is not ready for local-agent execution.
                  </p>
                ) : null}
                <pre>{report.prompt.deterministicPrompt}</pre>
                <div className="contract-grid">
                  <ContractList title="Input contract" items={report.prompt.inputContract} />
                  <ContractList title="Output contract" items={report.prompt.outputContract} />
                  <ContractList title="Safety notes" items={report.prompt.safetyNotes} />
                </div>
                <p className="body-text">{report.prompt.appendixPolicy}</p>
                <p className="body-text">{report.prompt.probabilityDisclosure}</p>
              </>
            ) : (
              <p className="body-text">Prompt package is not yet available.</p>
            )}
          </section>

          <section id="schema" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Output format</span>
              <span className="meta-text">{report.outputSections.length} sections</span>
            </div>
            <div className="schema-list">
              {report.outputSections.map((section) => (
                <div key={section.title} className="schema-section">
                  <div className="schema-title">
                    <span>{String(section.sortOrder).padStart(2, "0")}.</span>
                    <h3>{section.title}</h3>
                  </div>
                  <p>{section.purpose}</p>
                  <ul>
                    {section.expectedFields.map((field) => (
                      <li key={`${field.key}-${field.fieldPath ?? field.label}`}>
                        <strong>{field.label}</strong>
                        <span>
                          {field.type}
                          {field.required ? " required" : " optional"}
                        </span>
                        <p>{field.description}</p>
                        {field.fieldPath ||
                        field.citationRequired ||
                        field.formalSourceField ||
                        field.sourceBinding ||
                        field.allowsUnavailable ? (
                          <small>
                            {field.fieldPath ? `Path: ${field.fieldPath}. ` : ""}
                            {field.citationRequired ? "Citation required. " : ""}
                            {field.formalSourceField ? `Source: ${field.formalSourceField}. ` : ""}
                            {field.sourceBinding ? `Binding: ${field.sourceBinding}. ` : ""}
                            {field.allowsUnavailable ? "Unavailable value allowed." : ""}
                          </small>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section id="references" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Reference resources</span>
              <span className="meta-text">{report.references.length} resources</span>
            </div>
            {report.references.length > 0 ? (
              <div className="references-list">
                {report.references.map((reference) => (
                  <a key={`${reference.title}-${reference.url}`} href={reference.url} target="_blank" rel="noreferrer">
                    <span className="eyebrow">{reference.sourceType}</span>
                    <strong>{reference.title}</strong>
                    <p>{reference.note}</p>
                    <small>
                      {reference.resourceId ? `${reference.resourceId} - ` : ""}
                      {reference.scope ?? "background"} - {reference.theme} - {reference.evidenceLevel} -{" "}
                      {reference.extractionStatus}
                    </small>
                    {reference.usedFor?.length ? <small>Used for: {reference.usedFor.join(", ")}</small> : null}
                    {reference.sourceArtifact ? <small>Artifact: {reference.sourceArtifact}</small> : null}
                    {reference.accessedAt ? <small>Accessed: {reference.accessedAt}</small> : null}
                    {reference.contentHash ? <small>Hash: {reference.contentHash}</small> : null}
                  </a>
                ))}
              </div>
            ) : (
              <p className="body-text">Reference resources are pending for this report.</p>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

function ContractList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul>
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function AppendixList({ title, items, emptyLabel }: { title: string; items: unknown[]; emptyLabel?: string }) {
  return (
    <div>
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item, index) => (
            <li key={`${title}-${index}-${previewItemLabel(item)}`}>{previewItemLabel(item)}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyLabel ?? "No entries supplied."}</p>
      )}
    </div>
  );
}
