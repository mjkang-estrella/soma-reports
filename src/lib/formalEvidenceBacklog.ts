import officialOutputCaptureStatus from "../../reference/catalog/official-output-capture-status.json";
import publicReportEndpointProbe from "../../reference/catalog/public-report-endpoint-probe-2026-06-25.json";
import samplePromotionRejections from "../../reference/catalog/sample-promotion-rejections-2026-06-23.json";

export type FormalEvidenceDecision = {
  slug: string;
  title: string;
  decision: string;
  evidenceStatus: string;
  sources: string[];
  routeBehavior: string;
  reportFileStatus: string;
  sampleRows: number;
  reason: string;
  requiredEvidenceForPromotion: string[];
};

export type FormalEvidenceTarget = FormalEvidenceDecision & {
  actionLabel: string;
  captureUrl: string | null;
  sourceCoverage: OfficialOutputSourceCoverage | null;
  evidenceClass: "missing-exact-detail" | "metadata-only";
  firstRequiredEvidence: string;
  priority: number;
  expectedSanitizedArtifactPath: string;
  sanitizedDraftArtifactPath: string;
  captureTemplatePath: string;
  redactionInputPath: string;
  templateCommand: string;
  redactionTemplateCommand: string;
  dryRunSanitizeCommand: string;
  sanitizeRedactionCommand: string;
  commitSanitizedCaptureCommand: string;
  promotionPreviewCommand: string;
  expectedCaptureSchema: string;
  acceptedCaptureSchemas: string[];
  acceptanceCriteria: string[];
  validationCommands: string[];
  currentSources: string[];
  nonPromotionBoundary: string[];
  describedOutputFields: string[];
  describedOutputFieldSource: string | null;
  describedOutputFieldBoundary: string | null;
  captureStatus: OfficialOutputCaptureStatusRow | null;
  liveDetailInspection: LiveDetailInspection | null;
  publicEndpointProbe: PublicReportEndpointProbeRow | null;
  actionClass: OfficialOutputActionClass;
  completedOutputRequired: boolean;
};

export type OfficialOutputActionClass =
  | "row-ready-promote-after-review"
  | "completed-output-required-metadata-only"
  | "completed-output-required-boundary-capture"
  | "fix-invalid-capture"
  | "prepare-private-redaction-input"
  | "inspect-manually";

export type FormalEvidenceStatusCount = {
  evidenceStatus: string;
  count: number;
};

export type FormalEvidenceBacklogSummary = {
  capturedAt: string;
  scaffoldPackages: number;
  officialOutputCaptureStatus: OfficialOutputCaptureStatusSummary;
  officialOutputPublicEndpointProbe: PublicReportEndpointProbeSummary;
  promotionStandard: string[];
  catalogSnapshot: {
    authenticatedMarketplacePositions: number;
    identifiedNamedPackages: number;
    authenticatedUniqueHrefs: number;
    authenticatedDuplicateCardPositions: number;
    authenticatedPagePropsItems: number;
    authenticatedDetailArtifacts: number;
    sampleBackedFormalReady: number;
    formalEquivalentReady: number;
    formalPendingPackages: number;
    detailGaps: number;
  };
  evidenceStatusCounts: FormalEvidenceStatusCount[];
  missingExactDetailDecisions: FormalEvidenceDecision[];
  exactDetailMetadataOnlyDecisions: FormalEvidenceDecision[];
  missingExactDetailTargets: FormalEvidenceTarget[];
  exactDetailMetadataOnlyTargets: FormalEvidenceTarget[];
  officialOutputCaptureTargets: FormalEvidenceTarget[];
  officialOutputActionCounts: Partial<Record<OfficialOutputActionClass, number>>;
  officialOutputCompletedOutputRequiredTargets: number;
  officialOutputNextActionCaveats: string[];
};

const formalEvidenceDecisions = samplePromotionRejections.decisions as FormalEvidenceDecision[];

export type OfficialOutputPromotionReviewEntry = {
  slug: string;
  title: string | null;
  decision: string;
  reviewClass: string;
  officialCapturePath: string | null;
  sourcePaths?: string[];
  sourceUrls?: string[];
  promotionPreviewExit: number | null;
  outputSignals: Record<string, boolean | number>;
  evidencePresent: string[];
  evidenceMissing: string[];
  nextEvidenceNeeded: string[];
  boundaryUse: string | null;
};

export type OfficialEvidenceTier =
  | "official-row-evidence-ready"
  | "official-boundary-modeled"
  | "official-metadata-only"
  | "official-output-signal-unreviewed"
  | "official-template-only"
  | "official-capture-needs-rework"
  | "official-unknown";

export type OfficialOutputCaptureStage =
  | "row-evidence-ready"
  | "promotion-candidate-review"
  | "output-signal-review"
  | "reviewed-no-promote"
  | "reviewed-boundary-only"
  | "reviewed-metadata-only"
  | "capture-needs-rework"
  | "template-ready"
  | "template-needed"
  | "blocked"
  | "unknown";

export type PublicCapturePriorityOpportunitySummary = {
  priority: number;
  priorityLabel: string;
  stage: OfficialOutputCaptureStage;
  officialEvidenceTier: OfficialEvidenceTier;
  opportunityClass: string;
  summary: string;
  publicNextStep: string;
  publicNextCommand: string;
  blockers: string[];
  readinessBoundary: string;
};

export type OfficialBoundaryModel = {
  reviewClass: string | null;
  decision: string | null;
  outputSignals: FormalReadinessGate["currentOutputSignals"];
  evidencePresent: string[];
  evidenceMissing: string[];
  nextEvidenceNeeded: string[];
  boundaryUse: string | null;
  promotionBoundary: {
    promotesSampleBackedFormalReady: false;
    promotesFormalEquivalentReady: false;
    promotesSampleRows: false;
    promotesResultRows: false;
    promotesCitationBindings: false;
    removesFormalBlocker: false;
  };
};

export type LatestRouteProbe = {
  slug: string;
  capturedAt: string | null;
  artifactPath: string | null;
  requestedUrl: string | null;
  finalUrl: string | null;
  finalUrlKind: string | null;
  documentTitle: string;
  h1: string;
  pagePropsReportData: boolean;
  reportTitle: string | null;
  reportUri: string | null;
  reportFile: string | null;
  productId: string | null;
  appId: string | null;
  startButtonText: string;
  notFound: boolean;
  promotesDetailParity: boolean;
  promotesSampleRows: boolean;
  promotesFormalFields: boolean;
  promotesCitationBindings: boolean;
  privacyBoundary: string;
  promotionBoundary: Record<string, unknown> | null;
};

export type PublicBundleEvidence = {
  slug: string;
  capturedAt: string | null;
  artifactPath: string | null;
  evidenceUse: string;
  sourceIds: string[];
  evidencePresent: string[];
  evidenceMissingForPromotion: string[];
  promotionBoundary: Record<string, unknown> | null;
};

export type OfficialOutputSourceCoverage = {
  class: "authenticated-position" | "authenticated-order-alias" | "public-only" | "unknown";
  label: string;
  sourceCatalogPath: string | null;
  sourceUrl: string | null;
  authenticatedMarketplacePositionTotal: number | null;
  namedIdentityTotal: number | null;
  publicCatalogOnly: boolean;
  authenticatedPositionCount: number;
  authenticatedPositionNumbers: number[];
  authenticatedGroupLabels: string[];
  authenticatedKinds: string[];
  authenticatedHrefs: string[];
  orderAliasSlugs: string[];
  boundary: string;
};

export type PublicReportEndpointTextSummary = {
  hash: string;
  length: number;
  outputLanguageSignals: string[];
  formalFieldTerms: string[];
};

export type PublicReportEndpointProbeRow = {
  slug: string;
  title: string;
  priority: number | null;
  stage?: OfficialOutputCaptureStage | null;
  officialEvidenceTier?: OfficialEvidenceTier | null;
  endpointUrl: string;
  httpStatus?: number;
  ok: boolean;
  contentType?: string | null;
  bytes?: number;
  parsed?: boolean;
  endpointTitle?: string;
  endpointUri?: string;
  endpointIdentity?: {
    id: string | number | boolean | null;
    nid: string | number | boolean | null;
    type: string | number | boolean | null;
    category: string | number | boolean | null;
    publisher: string | number | boolean | null;
    productId: string | number | boolean | null;
  } | null;
  appId?: string | null;
  appMetadata?: {
    appid: string | number | boolean | null;
    label: string | number | boolean | null;
    backend: string | number | boolean | null;
    backendApiAppId: string | number | boolean | null;
  } | null;
  productData?: {
    productId: string | number | boolean | null;
    sku: string | number | boolean | null;
    type: string | number | boolean | null;
    fieldAppTargets: Array<{
      targetId: string | number | boolean | null;
      targetRevisionId: string | number | boolean | null;
    }>;
  } | null;
  price?: string;
  reportFile?: string;
  exactPackageOutputSignals?: {
    reportFile: boolean;
    nonEmptyOutputKeySignals: Array<Record<string, unknown>>;
    bodyOutputLanguageSignals: string[];
    summaryOutputLanguageSignals: string[];
    infoTabOutputLanguageSignals: string[];
  };
  body?: PublicReportEndpointTextSummary | null;
  summary?: PublicReportEndpointTextSummary | null;
  infoTabs?: Array<{
    label: string;
    content: PublicReportEndpointTextSummary | null;
  }>;
  formalFieldTerms?: string[];
  relatedReportFiles?: Array<{
    title: string;
    uri: string;
    reportFile: string;
    boundary: string;
  }>;
  promotionBoundary?: string;
};

export type PublicReportEndpointProbeSummary = {
  schemaVersion: string;
  generatedAt: string;
  statusPath: string;
  endpointBase: string;
  filters: {
    report: string | null;
    timeoutMs: number;
  };
  totals: {
    targets: number;
    fetched: number;
    ok: number;
    failed: number;
    unavailable: number;
    parsed: number;
    exactReportFiles: number;
    exactOutputKeySignalTargets: number;
    relatedReportFileTargets: number;
    formalFieldSignalTargets: number;
    infoTabTargets: number;
  };
  exactReportFileRows: Array<Record<string, unknown>>;
  exactOutputKeySignalRows: Array<Record<string, unknown>>;
  relatedReportFileRows: Array<Record<string, unknown>>;
  formalFieldSignalRows: Array<Record<string, unknown>>;
  rows: PublicReportEndpointProbeRow[];
  privacyBoundary: string;
};

export type OfficialOutputCaptureStatusRow = {
  slug: string;
  title: string;
  evidenceClass: "missing-exact-detail" | "metadata-only";
  sourceCoverage?: OfficialOutputSourceCoverage | null;
  stage: OfficialOutputCaptureStage;
  templateExists: boolean;
  officialCaptures: number;
  validOfficialCaptures: number;
  rowEvidenceReadyCaptures: number;
  rowEvidencePromotionReadyCaptures?: number;
  promotionSafeProvenanceCaptures?: number;
  outputSignalReviews?: number;
  promotionCandidates: number;
  officialCapturePaths?: string[];
  gitTrackedOfficialCapturePaths?: string[];
  gitUntrackedOfficialCapturePaths?: string[];
  validOfficialCapturePaths?: string[];
  gitTrackedValidOfficialCapturePaths?: string[];
  rowEvidenceReadyCapturePaths?: string[];
  rowEvidencePromotionReadyCapturePaths?: string[];
  outputSignalReviewCapturePaths?: string[];
  promotionCandidateCapturePaths?: string[];
  officialOutputPromotionReview?: OfficialOutputPromotionReviewEntry | null;
  officialOutputReviewBoundaryUse?: string | null;
  officialOutputReviewEvidencePresent?: string[];
  officialOutputReviewEvidenceMissing?: string[];
  officialOutputReviewNextEvidenceNeeded?: string[];
  officialOutputReviewOutputSignals?: Record<string, boolean | number> | null;
  officialEvidenceTier?: OfficialEvidenceTier;
  officialBoundaryModeled?: boolean;
  officialBoundaryModeledReason?: string | null;
  officialBoundaryModeledFields?: number;
  officialBoundaryModeledEvidence?: string[];
  officialBoundaryModel?: OfficialBoundaryModel | null;
  officialBoundaryModeledBoundary?: string | null;
  latestRouteProbe?: LatestRouteProbe | null;
  publicBundleEvidence?: PublicBundleEvidence | null;
  officialCaptureArtifactSummaries?: Array<{
    path: string;
    ok: boolean;
    gitTracked?: boolean;
    rowEvidenceReady: boolean;
    promotionSafeProvenance?: boolean;
    outputSignalReview?: boolean;
    outputSignalReviewCandidate?: boolean;
    rowEvidencePromotionReady?: boolean;
    promotionCandidate: boolean;
    outputSignals: Record<string, boolean | number>;
  }>;
  formalReadinessGate?: FormalReadinessGate;
  requiredEvidenceForPromotion?: string[];
  publicBundleEvidenceMissingForPromotion?: string[];
  packageSpecificMissingEvidence?: string[];
  operatorEvidenceChecklist?: OperatorEvidenceChecklist;
  liveDetailInspection?: LiveDetailInspection | null;
  nextAction: string | null;
  nextCommand: string | null;
  nextPublicQueueAction?: string | null;
  nextPublicCommand?: string | null;
  publicCaptureTemplatePath?: string | null;
  publicCaptureTemplateCommand?: string | null;
  publicTemplateAuditCommand?: string | null;
  publicCaptureSessionCommand?: string | null;
  publicCapturePriorityOpportunitySummary?: PublicCapturePriorityOpportunitySummary | null;
  redactionInputPath?: string | null;
  redactionTemplateCommand?: string | null;
  dryRunSanitizeCommand?: string | null;
  sanitizeRedactionCommand?: string | null;
  sanitizeDraftCommand?: string | null;
  commitSanitizedCaptureCommand?: string | null;
  sanitizedDraftArtifactPath?: string | null;
  committedCapturePath?: string | null;
  validateDraftCaptureCommand?: string | null;
  validateCommittedCaptureCommand?: string | null;
  promotionPreviewCommittedCommand?: string | null;
  captureUrl: string | null;
  expectedSanitizedArtifactPath: string;
  validationCommandForExpectedCapture?: string | null;
  captureTemplatePath: string;
};

export type NonTargetOfficialOutputCapture = {
  slug: string;
  title: string | null;
  path: string;
  ok: boolean;
  rowEvidenceReady: boolean;
  promotionSafeProvenance?: boolean;
  outputSignalReview?: boolean;
  outputSignalReviewCandidate?: boolean;
  rowEvidencePromotionReady?: boolean;
  promotionCandidate: boolean;
  manualPromotionBlocked?: boolean;
  officialOutputPromotionReview?: OfficialOutputPromotionReviewEntry | null;
  outputSignals: Record<string, boolean | number>;
  status: string;
};

export type FormalReadinessGate = {
  validatorCommand: string;
  requirements: string[];
  requiredEvidenceForPromotion: string[];
  currentOutputSignals: {
    reportFile: boolean;
    sampleRows: number;
    resultRows: number;
    formalFields: number;
    citationBindings: number;
    generatedOutput: boolean;
  };
  missing: string[];
  readyForPromotion: boolean;
};

export type OperatorEvidenceChecklist = {
  promotionalOfficialRowsPresent: boolean;
  coveredFormalFieldsPresent: boolean;
  citationBindingsPresent: boolean;
  rowEvidenceReadyCapturePresent: boolean;
  requiredEvidenceForPromotion?: string[];
  missingOfficialRowEvidence: string[];
  publicFirstNextAction?: string | null;
  publicFirstNextCommand?: string | null;
  nonPromotionalEvidenceClasses: string[];
  promotionBoundary: Record<string, false>;
};

export type LiveDetailInspection = {
  slug: string;
  inspectedAt: string | null;
  requestedUrl: string | null;
  finalUrl: string | null;
  exactRoute: boolean;
  routeKind: string | null;
  pageTitle: string | null;
  startButtonText: string;
  apiAppId: string | null;
  appBackend: string | null;
  appLabel: string | null;
  productId: string | null;
  price: string;
  reportFile: string;
  scriptSignals: Record<string, number>;
  privacyBoundary: string;
};

export type OfficialOutputCaptureStatusSummary = {
  schemaVersion: string;
  generatedAt: string;
  ok: boolean;
  targetClass: string;
  allowEmptyCaptures: boolean;
  catalogSnapshot: FormalEvidenceBacklogSummary["catalogSnapshot"] | null;
  totals: {
    targets: number;
    missingExactDetailTargets: number;
    metadataOnlyTargets: number;
    sourceCoverageCounts?: Partial<Record<OfficialOutputSourceCoverage["class"], number>>;
    authenticatedPositionTargets?: number;
    authenticatedOrderAliasTargets?: number;
    publicOnlyTargets?: number;
    unknownSourceCoverageTargets?: number;
    captureTemplatesPresent: number;
    placeholderTemplates: number;
    invalidTemplates: number;
    officialOutputCaptureArtifacts: number;
    invalidOfficialOutputCaptureArtifacts: number;
    rowEvidenceReadyTargets: number;
    rowEvidencePromotionReadyTargets?: number;
    outputSignalReviewTargets?: number;
    promotionCandidateTargets: number;
    reviewedNoPromoteTargets?: number;
    reviewedBoundaryOnlyTargets?: number;
    reviewedMetadataOnlyTargets?: number;
    officialBoundaryModeledTargets?: number;
    officialBoundaryModeledFormalFields?: number;
    unreviewedOutputSignalReviewTargets?: number;
    unreviewedPromotionCandidateTargets?: number;
    latestRouteProbeTargets?: number;
    latestRouteProbeReportData?: number;
    latestRouteProbeNotFound?: number;
    latestRouteProbeFallbacks?: number;
    publicBundleEvidenceTargets?: number;
    liveDetailInspectionTargets?: number;
    liveDetailInspectionExactRoutes?: number;
    liveDetailInspectionApiAppIds?: number;
    liveDetailInspectionReportFiles?: number;
    committedOfficialOutputCaptureArtifacts?: number;
    committedRowEvidenceReadyCaptures?: number;
    committedRowEvidencePromotionReadyCaptures?: number;
    committedPromotionSafeProvenanceCaptures?: number;
    committedOutputSignalReviews?: number;
    committedPromotionCandidates?: number;
    manualPromotionBlockedCaptures?: number;
    gitTrackedOfficialOutputCaptureArtifacts?: number;
    gitUntrackedOfficialOutputCaptureArtifacts?: number;
    gitTrackedRowEvidenceReadyCaptures?: number;
    gitTrackedOutputSignalReviews?: number;
    outsideCurrentBlockerLedgerCaptures?: number;
  };
  officialOutputPromotionReview?: {
    present: boolean;
    path: string;
    entries: number;
    problems: string[];
  } | null;
  problems: string[];
  statusCounts: Record<string, number>;
  officialEvidenceTierCounts?: Partial<Record<OfficialEvidenceTier, number>>;
  nonTargetOfficialOutputCaptures: NonTargetOfficialOutputCapture[];
  commands: {
    generateTemplates: string;
    auditTemplates: string;
    validateCommittedCaptures: string;
    exportCapturePlan: string;
  };
  privacyBoundary: string;
};

const officialOutputCaptureRows = officialOutputCaptureStatus.rows as OfficialOutputCaptureStatusRow[];
const officialOutputCaptureStatusBySlug = new Map(
  officialOutputCaptureRows.map((row) => [row.slug, row] as const),
);
const publicEndpointProbe = publicReportEndpointProbe as PublicReportEndpointProbeSummary;
const publicEndpointProbeRowsBySlug = new Map(
  publicEndpointProbe.rows.map((row) => [row.slug, row] as const),
);

export const officialOutputCaptureCaveats = [
  "Synthetic fixture result rows are local validation scaffolds, not official Sequencing.com sample, result, report-file, or export evidence.",
  "Related-report files do not promote the target package; only exact-package official output rows or exact-package report files count.",
  "Genome Explorer currently has an empty exact-target reportFile; any nearby Healthcare Pro related-report file is non-promotional sibling context.",
  "Start App, Get App, and Get Report buttons are account actions, not evidence; only sanitized completed-output captures can promote those targets.",
];

export const officialOutputActionClassFor = (
  row: OfficialOutputCaptureStatusRow | null | undefined,
): OfficialOutputActionClass => {
  if (!row) {
    return "inspect-manually";
  }
  if ((row.rowEvidencePromotionReadyCaptures ?? row.promotionCandidates ?? 0) > 0 || row.stage === "row-evidence-ready") {
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

export const officialEvidenceTierFor = (
  row: OfficialOutputCaptureStatusRow | null | undefined,
): OfficialEvidenceTier => {
  if (!row) {
    return "official-unknown";
  }
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

export const officialEvidenceTierLabelFor = (row: OfficialOutputCaptureStatusRow | null | undefined) => {
  const labels: Record<OfficialEvidenceTier, string> = {
    "official-row-evidence-ready": "Official row evidence ready",
    "official-boundary-modeled": "Official boundary modeled",
    "official-metadata-only": "Metadata only",
    "official-output-signal-unreviewed": "Output signal unreviewed",
    "official-template-only": "Template only",
    "official-capture-needs-rework": "Capture needs rework",
    "official-unknown": "Official output unknown",
  };
  return labels[officialEvidenceTierFor(row)];
};

export const officialEvidenceTierBoundaryFor = (row: OfficialOutputCaptureStatusRow | null | undefined) => {
  const tier = officialEvidenceTierFor(row);
  if (tier === "official-boundary-modeled") {
    return (
      row?.officialBoundaryModeledBoundary ??
      "Official field/scope boundary only; completed output rows, row-level citations, and rowEvidenceReady capture are still missing."
    );
  }
  if (tier === "official-metadata-only") {
    return "Metadata-only evidence does not model official output rows, generated values, formal fields, or row-level citations.";
  }
  if (tier === "official-row-evidence-ready") {
    return "A rowEvidenceReady capture exists, but promotion still requires manual review and sync verification.";
  }
  return "Official output evidence is still incomplete and does not promote readiness.";
};

export const officialOutputActionBoundaryFor = (row: OfficialOutputCaptureStatusRow | null | undefined) => {
  if (!row) {
    return "Inspect the capture artifacts before promotion.";
  }
  if (row.officialBoundaryModeledBoundary) {
    return row.officialBoundaryModeledBoundary;
  }
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
  return "Inspect the capture artifacts before promotion.";
};

export const officialOutputNextEvidenceFor = (row: OfficialOutputCaptureStatusRow | null | undefined) =>
  row?.officialOutputReviewNextEvidenceNeeded?.length
    ? row.officialOutputReviewNextEvidenceNeeded
    : (row?.formalReadinessGate?.requiredEvidenceForPromotion ?? []);

export const officialEvidencePacketFor = (target: FormalEvidenceTarget | null | undefined) => {
  if (!target) {
    return null;
  }

  const row = target.captureStatus;
  const tier = officialEvidenceTierFor(row);
  const redactionInputPath = row?.redactionInputPath ?? target.redactionInputPath;
  const sanitizedDraftPath = row?.sanitizedDraftArtifactPath ?? target.sanitizedDraftArtifactPath;
  const committedCapturePath = row?.committedCapturePath ?? target.expectedSanitizedArtifactPath;
  const publicCaptureSessionCommand =
    row?.publicCapturePriorityOpportunitySummary?.publicNextCommand ??
    row?.publicCaptureSessionCommand ??
    `npm run scaffold:capture-session -- --source public --report ${target.slug} --format md --out tmp/official-output-capture-session-${target.slug}.md`;
  const validateCommittedCaptureCommand =
    row?.validateCommittedCaptureCommand ??
    row?.validationCommandForExpectedCapture ??
    `npm run scaffold:validate-captures -- --path ${target.expectedSanitizedArtifactPath}`;

  return {
    schemaVersion: "soma-reports.official-evidence-packet.v1",
    slug: target.slug,
    title: target.title,
    captureUrl: target.captureUrl,
    sourceCoverage: target.sourceCoverage,
    evidenceClass: target.evidenceClass,
    officialEvidenceTier: tier,
    officialEvidenceTierLabel: officialEvidenceTierLabelFor(row),
    stage: row?.stage ?? "unknown",
    publicCaptureOpportunity: row?.publicCapturePriorityOpportunitySummary ?? null,
    rowEvidenceReadyCaptures: row?.rowEvidenceReadyCaptures ?? 0,
    rowEvidencePromotionReadyCaptures: row?.rowEvidencePromotionReadyCaptures ?? row?.promotionCandidates ?? 0,
    officialCaptures: row?.officialCaptures ?? 0,
    boundaryModel: row?.officialBoundaryModel ?? null,
    currentOutputSignals: row?.formalReadinessGate?.currentOutputSignals ?? row?.officialOutputReviewOutputSignals ?? null,
    routeProbe: row?.latestRouteProbe
      ? {
          artifactPath: row.latestRouteProbe.artifactPath,
          finalUrl: row.latestRouteProbe.finalUrl,
          requestedUrl: row.latestRouteProbe.requestedUrl,
          finalUrlKind: row.latestRouteProbe.finalUrlKind,
          pagePropsReportData: row.latestRouteProbe.pagePropsReportData,
          notFound: row.latestRouteProbe.notFound,
        }
      : null,
    publicBundleEvidence: row?.publicBundleEvidence
      ? {
          artifactPath: row.publicBundleEvidence.artifactPath,
          evidenceUse: row.publicBundleEvidence.evidenceUse,
          evidencePresent: row.publicBundleEvidence.evidencePresent,
          evidenceMissingForPromotion: row.publicBundleEvidence.evidenceMissingForPromotion,
        }
      : null,
    publicEndpointProbe: target.publicEndpointProbe
      ? {
          endpointUrl: target.publicEndpointProbe.endpointUrl,
          httpStatus: target.publicEndpointProbe.httpStatus ?? null,
          parsed: target.publicEndpointProbe.parsed ?? false,
          endpointTitle: target.publicEndpointProbe.endpointTitle ?? null,
          endpointUri: target.publicEndpointProbe.endpointUri ?? null,
          appId: target.publicEndpointProbe.appId ?? null,
          appMetadata: target.publicEndpointProbe.appMetadata ?? null,
          productData: target.publicEndpointProbe.productData ?? null,
          reportFilePresent: Boolean(target.publicEndpointProbe.reportFile),
          exactOutputKeySignals:
            target.publicEndpointProbe.exactPackageOutputSignals?.nonEmptyOutputKeySignals.length ?? 0,
          infoTabs: target.publicEndpointProbe.infoTabs?.map((tab) => tab.label) ?? [],
          formalFieldTerms: target.publicEndpointProbe.formalFieldTerms ?? [],
          relatedReportFiles: target.publicEndpointProbe.relatedReportFiles ?? [],
          promotionBoundary: target.publicEndpointProbe.promotionBoundary ?? null,
        }
      : null,
    liveDetailInspection: target.liveDetailInspection ?? row?.liveDetailInspection ?? null,
    paths: {
      publicCaptureTemplatePath: row?.publicCaptureTemplatePath ?? row?.captureTemplatePath ?? target.captureTemplatePath,
      redactionInputPath,
      sanitizedDraftPath,
      committedCapturePath,
      captureTemplatePath: row?.captureTemplatePath ?? target.captureTemplatePath,
    },
    commands: {
      publicCaptureTemplate: row?.publicCaptureTemplateCommand ?? target.templateCommand,
      publicTemplateAudit: `npm run scaffold:template-audit -- --report ${target.slug}`,
      publicCaptureSession: publicCaptureSessionCommand,
      privateCaptureSession: `npm run scaffold:capture-session -- --source private --report ${target.slug} --format md --out tmp/official-output-capture-session-${target.slug}-private.md`,
      combinedCaptureSession: `npm run scaffold:capture-session -- --source both --report ${target.slug} --format md --out tmp/official-output-capture-session-${target.slug}.md`,
      redactionTemplate: row?.redactionTemplateCommand ?? target.redactionTemplateCommand,
      dryRunSanitize: row?.dryRunSanitizeCommand ?? target.dryRunSanitizeCommand,
      sanitizeDraft: row?.sanitizeDraftCommand ?? row?.sanitizeRedactionCommand ?? target.sanitizeRedactionCommand,
      commitSanitizedCapture: row?.commitSanitizedCaptureCommand ?? target.commitSanitizedCaptureCommand,
      validateCommittedCapture: validateCommittedCaptureCommand,
      snapshot: "npm run scaffold:capture-status:snapshot",
      promotionPreview:
        (row?.rowEvidencePromotionReadyCaptures ?? row?.promotionCandidates ?? 0) > 0
          ? row?.promotionPreviewCommittedCommand ?? target.promotionPreviewCommand
          : null,
    },
    nextEvidenceNeeded: officialOutputNextEvidenceFor(row).length
      ? officialOutputNextEvidenceFor(row)
      : target.requiredEvidenceForPromotion,
    formalGateMissing: row?.formalReadinessGate?.missing ?? target.requiredEvidenceForPromotion,
    reviewEvidencePresent: row?.officialOutputReviewEvidencePresent ?? [],
    reviewEvidenceMissing: row?.officialOutputReviewEvidenceMissing ?? [],
    privacyBoundary: {
      rawGenomeIncluded: false,
      privateValuesRedacted: true,
      commitSafe: true,
      privateCompletedOutputStaysLocal: true,
      note:
        "Use this packet to capture and sanitize official output structure only. Keep raw genome data, private reports, private findings, account identifiers, and private result URLs outside the repository.",
    },
    promotionBoundary: {
      promotesSampleBackedFormalReady: false,
      promotesFormalEquivalentReady: false,
      promotesSampleRows: false,
      promotesResultRows: false,
      promotesCitationBindings: false,
      removesFormalBlocker: false,
      requiredBeforePromotion: [
        "validate-captures rowEvidenceReady: true",
        "official non-private sampleRows[] or resultRows[]",
        "covered formalFields[] bound to official-output source resources",
        "citationBindings[] with exact/direct/official sourceBindingStatus and sourceResourceIds",
      ],
    },
    nonPromotionBoundary: target.nonPromotionBoundary,
  };
};

const formalEvidenceDecisionBySlug = new Map(
  formalEvidenceDecisions.map((decision) => [decision.slug, decision] as const),
);
const expectedCaptureSchema = "soma-reports.official-output-capture.v1";
const acceptedCaptureSchemas = [
  "soma-reports.authenticated-detail-evidence.v1",
  expectedCaptureSchema,
];
const highValueOrder = [
  "sequencing-depth-and-coverage",
  "genome-explorer-dna-data-search",
  "convert-rsids-coordinates",
  "imputation-analysis",
  "variant-effect-predictor",
  "variant-discovery-bioinformatics-secondary-analysis",
  "genome-short-read-mapper",
  "promethease",
  "whole-genome-sequencing-30x",
  "comprehensive-health-screen-wgs-bundle",
  "expedited-advanced-health-screen-wgs-bundle",
  "ultra-rapid-professional-health-screen-wgs-bundle",
];
const highValueRank = new Map(highValueOrder.map((slug, index) => [slug, index + 1] as const));

const evidenceStatusCounts = Array.from(
  formalEvidenceDecisions.reduce((counts, decision) => {
    counts.set(decision.evidenceStatus, (counts.get(decision.evidenceStatus) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()),
)
  .map(([evidenceStatus, count]) => ({ evidenceStatus, count }))
  .sort((a, b) => b.count - a.count || a.evidenceStatus.localeCompare(b.evidenceStatus));

const missingExactDetailDecisions = formalEvidenceDecisions.filter(
  (decision) =>
    decision.evidenceStatus.startsWith("route-fallback") ||
    decision.evidenceStatus === "card-and-order-evidence-only",
);

const exactDetailMetadataOnlyDecisions = formalEvidenceDecisions.filter(
  (decision) => !missingExactDetailDecisions.includes(decision),
);

const externalEvidenceSource = (decision: FormalEvidenceDecision) =>
  decision.sources.find((source) => /^https?:\/\//i.test(source)) ?? null;

const evidenceClassFor = (decision: FormalEvidenceDecision): FormalEvidenceTarget["evidenceClass"] =>
  decision.evidenceStatus.startsWith("route-fallback") || decision.evidenceStatus === "card-and-order-evidence-only"
    ? "missing-exact-detail"
    : "metadata-only";

const priorityFor = (decision: FormalEvidenceDecision) =>
  highValueRank.get(decision.slug) ?? 100 + formalEvidenceDecisions.findIndex((candidate) => candidate.slug === decision.slug);

const artifactPathFor = (slug: string) => `reference/catalog/${slug}-official-output-capture-YYYY-MM-DD.json`;
const sanitizedDraftArtifactPathFor = (slug: string) =>
  `tmp/sanitized-captures/${slug}-official-output-capture-YYYY-MM-DD.json`;
const redactionInputPathFor = (slug: string) =>
  `.soma/private/official-output-redactions/${slug}-redaction-input.json`;
const captureTemplatePathFor = (slug: string) =>
  `tmp/capture-templates/${slug}-official-output-capture-template.json`;
const templateCommandFor = (slug: string) =>
  `npm run scaffold:capture-template -- --report ${slug} --out ${captureTemplatePathFor(slug)}`;
const redactionTemplateCommandFor = (slug: string) => `npm run scaffold:redaction-template -- --report ${slug}`;
const sanitizeRedactionCommandFor = (slug: string) =>
  `npm run scaffold:sanitize-output -- --input ${redactionInputPathFor(slug)}`;
const dryRunSanitizeCommandFor = (slug: string) =>
  `npm run scaffold:sanitize-output -- --input ${redactionInputPathFor(
    slug,
  )} --out ${sanitizedDraftArtifactPathFor(slug)} --dry-run true`;
const commitSanitizedCaptureCommandFor = (slug: string) =>
  `npm run scaffold:sanitize-output -- --input ${redactionInputPathFor(slug)} --out ${artifactPathFor(
    slug,
  )} --confirm-commit-safe true`;
const promotionPreviewCommandFor = (slug: string) =>
  `npm run scaffold:promotion-preview -- --path reference/catalog/${slug}-official-output-capture-YYYY-MM-DD.json`;

const acceptanceCriteriaFor = (decision: FormalEvidenceDecision) => [
  `Artifact is official Sequencing.com output for exact package slug ${decision.slug}.`,
  `Sanitized capture uses schema ${expectedCaptureSchema}; legacy authenticated detail captures also count when they expose strong output signals.`,
  "Artifact exposes generated report rows, a sample/mock report body, a non-empty reportFile, formal result table, or completed package export.",
  "Captured fields are sufficient to map sampleRows[], formalFields[], and citationBindings[] for this package.",
  "Marketing copy, order pages, public education pages, generic detail metadata, and sibling samples remain non-promotional.",
  "If the artifact comes from a personal completed run, keep full private output outside the repo and commit only sanitized field structure and row-level source bindings.",
  "After capture, npm run scaffold:evidence-audit must report this package as candidate-review before any readiness promotion.",
];

const validationCommands = [
  "npm run scaffold:validate-captures",
  "npm run scaffold:evidence-audit",
  "npm run readiness:audit:summary",
  "npm run agent:validate:all",
];

const describedOutputFieldHintsBySlug: Record<
  string,
  { fields: string[]; source: string; boundary: string }
> = {
  "genome-explorer-dna-data-search": {
    source: "reference/catalog/genome-explorer-dna-data-search-authenticated-detail-2026-06-25.json",
    fields: [
      "RCV ID",
      "chromosome",
      "position",
      "variant ID",
      "gene",
      "impact",
      "variant type",
      "reference",
      "alternate allele",
      "user data",
      "condition",
      "status",
      "classification",
      "confidence",
      "references",
      "links",
    ],
    boundary:
      "The official detail page describes Genome Explorer search/result columns, but no official search/export rows or row-level source bindings are captured.",
  },
  "sequencing-depth-and-coverage": {
    source: "reference/catalog/sequencing-depth-and-coverage-authenticated-detail-2026-06-22.json",
    fields: ["scope", "chromosome", "averageDepth", "maximumDepth", "minimumDepth", "thirtyXDepthCheck"],
    boundary:
      "The official detail page describes a graph/table with depth and 30x-check fields, but no official generated coverage table rows or row-level bindings are captured.",
  },
};

const toFormalEvidenceTarget = (
  decision: FormalEvidenceDecision,
  evidenceClass: FormalEvidenceTarget["evidenceClass"],
): FormalEvidenceTarget => {
  const describedOutputFieldHint = describedOutputFieldHintsBySlug[decision.slug] ?? null;
  const captureStatus = officialOutputCaptureStatusBySlug.get(decision.slug) ?? null;
  const actionClass = officialOutputActionClassFor(captureStatus);
  return {
    ...decision,
    actionLabel:
      evidenceClass === "missing-exact-detail"
        ? "Capture exact marketplace detail route"
        : "Find official Sequencing.com sample or completed output",
    captureUrl: externalEvidenceSource(decision),
    sourceCoverage: captureStatus?.sourceCoverage ?? null,
    evidenceClass,
    firstRequiredEvidence: decision.requiredEvidenceForPromotion[0] ?? "Package-specific source-backed report output",
    priority: priorityFor(decision),
    expectedSanitizedArtifactPath: captureStatus?.committedCapturePath ?? artifactPathFor(decision.slug),
    sanitizedDraftArtifactPath: captureStatus?.sanitizedDraftArtifactPath ?? sanitizedDraftArtifactPathFor(decision.slug),
    captureTemplatePath: captureStatus?.captureTemplatePath ?? captureTemplatePathFor(decision.slug),
    redactionInputPath: redactionInputPathFor(decision.slug),
    templateCommand: templateCommandFor(decision.slug),
    redactionTemplateCommand: redactionTemplateCommandFor(decision.slug),
    dryRunSanitizeCommand: captureStatus?.dryRunSanitizeCommand ?? dryRunSanitizeCommandFor(decision.slug),
    sanitizeRedactionCommand: captureStatus?.sanitizeDraftCommand ?? sanitizeRedactionCommandFor(decision.slug),
    commitSanitizedCaptureCommand:
      captureStatus?.commitSanitizedCaptureCommand ?? commitSanitizedCaptureCommandFor(decision.slug),
    promotionPreviewCommand: captureStatus?.promotionPreviewCommittedCommand ?? promotionPreviewCommandFor(decision.slug),
    expectedCaptureSchema,
    acceptedCaptureSchemas,
    acceptanceCriteria: acceptanceCriteriaFor(decision),
    validationCommands,
    currentSources: decision.sources,
    nonPromotionBoundary: samplePromotionRejections.promotionStandard,
    describedOutputFields: describedOutputFieldHint?.fields ?? [],
    describedOutputFieldSource: describedOutputFieldHint?.source ?? null,
    describedOutputFieldBoundary: describedOutputFieldHint?.boundary ?? null,
    captureStatus,
    liveDetailInspection: captureStatus?.liveDetailInspection ?? null,
    publicEndpointProbe: publicEndpointProbeRowsBySlug.get(decision.slug) ?? null,
    actionClass,
    completedOutputRequired: actionClass.startsWith("completed-output-required"),
  };
};

const formalEvidenceTargets = formalEvidenceDecisions
  .map((decision) => toFormalEvidenceTarget(decision, evidenceClassFor(decision)))
  .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));

const formalEvidenceTargetBySlug = new Map(
  formalEvidenceTargets.map((target) => [target.slug, target] as const),
);

const sortTargets = (targets: FormalEvidenceTarget[]) =>
  [...targets].sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));

const officialOutputActionCounts = formalEvidenceTargets.reduce<Partial<Record<OfficialOutputActionClass, number>>>(
  (counts, target) => {
    counts[target.actionClass] = (counts[target.actionClass] ?? 0) + 1;
    return counts;
  },
  {},
);

const officialOutputCompletedOutputRequiredTargets = formalEvidenceTargets.filter(
  (target) => target.completedOutputRequired,
).length;

export const formalEvidenceDecisionFor = (slug: string) => formalEvidenceDecisionBySlug.get(slug) ?? null;
export const formalEvidenceTargetFor = (slug: string) => formalEvidenceTargetBySlug.get(slug) ?? null;
export const officialOutputCaptureStatusFor = (slug: string) => officialOutputCaptureStatusBySlug.get(slug) ?? null;

export const formalEvidenceBacklogSummary: FormalEvidenceBacklogSummary = {
  capturedAt: samplePromotionRejections.capturedAt,
  scaffoldPackages: formalEvidenceDecisions.length,
  officialOutputCaptureStatus: {
    schemaVersion: officialOutputCaptureStatus.schemaVersion,
    generatedAt: officialOutputCaptureStatus.generatedAt,
    ok: officialOutputCaptureStatus.ok,
    targetClass: officialOutputCaptureStatus.targetClass,
    allowEmptyCaptures: officialOutputCaptureStatus.allowEmptyCaptures,
    catalogSnapshot: officialOutputCaptureStatus.catalogSnapshot ?? null,
    totals: officialOutputCaptureStatus.totals,
    problems: officialOutputCaptureStatus.problems,
    statusCounts: officialOutputCaptureStatus.statusCounts,
    officialEvidenceTierCounts: officialOutputCaptureStatus.officialEvidenceTierCounts,
    nonTargetOfficialOutputCaptures: officialOutputCaptureStatus.nonTargetOfficialOutputCaptures ?? [],
    commands: officialOutputCaptureStatus.commands,
    privacyBoundary: officialOutputCaptureStatus.privacyBoundary,
  },
  officialOutputPublicEndpointProbe: {
    schemaVersion: publicEndpointProbe.schemaVersion,
    generatedAt: publicEndpointProbe.generatedAt,
    statusPath: publicEndpointProbe.statusPath,
    endpointBase: publicEndpointProbe.endpointBase,
    filters: publicEndpointProbe.filters,
    totals: publicEndpointProbe.totals,
    exactReportFileRows: publicEndpointProbe.exactReportFileRows,
    exactOutputKeySignalRows: publicEndpointProbe.exactOutputKeySignalRows,
    relatedReportFileRows: publicEndpointProbe.relatedReportFileRows,
    formalFieldSignalRows: publicEndpointProbe.formalFieldSignalRows,
    rows: publicEndpointProbe.rows,
    privacyBoundary: publicEndpointProbe.privacyBoundary,
  },
  promotionStandard: samplePromotionRejections.promotionStandard,
  catalogSnapshot: samplePromotionRejections.catalogSnapshot,
  evidenceStatusCounts,
  missingExactDetailDecisions,
  exactDetailMetadataOnlyDecisions,
  missingExactDetailTargets: sortTargets(
    formalEvidenceTargets.filter((target) => target.evidenceClass === "missing-exact-detail"),
  ),
  exactDetailMetadataOnlyTargets: sortTargets(
    formalEvidenceTargets.filter((target) => target.evidenceClass === "metadata-only"),
  ),
  officialOutputCaptureTargets: formalEvidenceTargets,
  officialOutputActionCounts,
  officialOutputCompletedOutputRequiredTargets,
  officialOutputNextActionCaveats: officialOutputCaptureCaveats,
};
